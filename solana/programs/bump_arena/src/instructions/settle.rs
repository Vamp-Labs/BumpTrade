use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::constants::*;
use crate::error::BumpError;
use crate::events::{MatchSettled, PlayerResult};
use crate::instructions::{pay_from_vault, seat_token_account};
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct Settle<'info> {
    #[account(constraint = operator.key() == config.operator @ BumpError::Unauthorized)]
    pub operator: Signer<'info>,
    #[account(constraint = result_signer.key() == config.result_signer @ BumpError::Unauthorized)]
    pub result_signer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = match_account.bump)]
    pub match_account: Account<'info, Match>,
    #[account(mut, seeds = [VAULT_SEED, match_id.as_ref()], bump = match_account.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, address = config.treasury)]
    pub treasury: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'a>(
    ctx: Context<'a, Settle<'a>>,
    match_id: [u8; 32],
    final_balances: Vec<u32>,
    ranks: Vec<u8>,
    input_log_hash: [u8; 32],
    replay_hash: [u8; 32],
    _ended_at: i64,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let m = &mut ctx.accounts.match_account;
    require!(m.status == STATUS_STARTED, BumpError::BadStatus);
    require!(now <= m.settle_deadline, BumpError::SettleWindowOver);

    let n = m.player_count as usize;
    require!(final_balances.len() == n && ranks.len() == n, BumpError::LengthMismatch);
    require!(ctx.remaining_accounts.len() == n, BumpError::BadRemainingAccounts);

    let mut rank_mask: u16 = 0;
    let mut sum: u64 = 0;
    for i in 0..n {
        sum += final_balances[i] as u64;
        let rank = ranks[i] as usize;
        require!(rank >= 1 && rank <= n, BumpError::BadRanks);
        require!(rank_mask & (1 << rank) == 0, BumpError::BadRanks);
        rank_mask |= 1 << rank;
    }
    require!(sum == m.start_balance as u64 * n as u64, BumpError::NotZeroSum);

    let mint = ctx.accounts.config.mint;
    for i in 0..n {
        seat_token_account(&ctx.remaining_accounts[i], &m.players[i], &mint)?;
    }

    m.status = STATUS_SETTLED;
    let stake = m.stake as u128;
    let start_balance = m.start_balance as u128;
    let pot = m.stake * n as u64;
    let match_bump = m.bump;
    let players = m.players;
    let match_info = m.to_account_info();

    let mut paid: u64 = 0;
    for i in 0..n {
        let payout = (stake * final_balances[i] as u128 / start_balance) as u64;
        paid += payout;
        pay_from_vault(
                        ctx.accounts.vault.to_account_info(),
            ctx.remaining_accounts[i].clone(),
            match_info.clone(),
            &match_id,
            match_bump,
            payout,
        )?;
        emit!(PlayerResult { match_id, player: players[i], final_balance: final_balances[i], rank: ranks[i], payout });
    }
    let dust = pot - paid;
    pay_from_vault(
                ctx.accounts.vault.to_account_info(),
        ctx.accounts.treasury.to_account_info(),
        match_info,
        &match_id,
        match_bump,
        dust,
    )?;

    emit!(MatchSettled { match_id, pot, dust, input_log_hash, replay_hash });
    Ok(())
}
