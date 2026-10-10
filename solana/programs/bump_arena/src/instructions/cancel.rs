use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::constants::*;
use crate::error::BumpError;
use crate::events::MatchCancelled;
use crate::instructions::{pay_from_vault, seat_token_account};
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct Cancel<'info> {
    #[account(constraint = operator.key() == config.operator @ BumpError::Unauthorized)]
    pub operator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = match_account.bump)]
    pub match_account: Account<'info, Match>,
    #[account(mut, seeds = [VAULT_SEED, match_id.as_ref()], bump = match_account.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler<'a>(ctx: Context<'a, Cancel<'a>>, match_id: [u8; 32]) -> Result<()> {
    let m = &mut ctx.accounts.match_account;
    let n = m.player_count as usize;
    require!(m.status == STATUS_OPEN || (m.status == STATUS_STARTED && n < 2), BumpError::BadStatus);
    require!(ctx.remaining_accounts.len() == n, BumpError::BadRemainingAccounts);

    let mint = ctx.accounts.config.mint;
    for i in 0..n {
        seat_token_account(&ctx.remaining_accounts[i], &m.players[i], &mint)?;
    }

    m.status = STATUS_CANCELLED;
    m.refunded = if n == 0 { 0 } else { ((1u16 << n) - 1) as u8 };
    let stake = m.stake;
    let match_bump = m.bump;
    let players = m.players;
    let match_info = m.to_account_info();

    for i in 0..n {
        pay_from_vault(
                        ctx.accounts.vault.to_account_info(),
            ctx.remaining_accounts[i].clone(),
            match_info.clone(),
            &match_id,
            match_bump,
            stake,
        )?;
        emit!(crate::events::Refunded { match_id, player: players[i], amount: stake });
    }

    emit!(MatchCancelled { match_id });
    Ok(())
}
