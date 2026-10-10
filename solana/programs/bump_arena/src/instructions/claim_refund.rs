use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::constants::*;
use crate::error::BumpError;
use crate::events::Refunded;
use crate::instructions::pay_from_vault;
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32], player: Pubkey)]
pub struct ClaimRefund<'info> {
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = match_account.bump)]
    pub match_account: Account<'info, Match>,
    #[account(mut, seeds = [VAULT_SEED, match_id.as_ref()], bump = match_account.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = config.mint, token::authority = player)]
    pub player_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimRefund>, match_id: [u8; 32], player: Pubkey) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let m = &mut ctx.accounts.match_account;
    require!(
        m.status == STATUS_OPEN || m.status == STATUS_STARTED || m.status == STATUS_REFUNDING,
        BumpError::BadStatus
    );
    require!(now > m.settle_deadline, BumpError::SettleWindowOpen);
    let seat = m.seat_of(&player).ok_or(BumpError::NotAPlayer)?;
    require!(m.refunded & (1 << seat) == 0, BumpError::AlreadyRefunded);

    m.refunded |= 1 << seat;
    m.status = STATUS_REFUNDING;
    let stake = m.stake;
    let match_bump = m.bump;
    let match_info = m.to_account_info();

    pay_from_vault(
                ctx.accounts.vault.to_account_info(),
        ctx.accounts.player_token.to_account_info(),
        match_info,
        &match_id,
        match_bump,
        stake,
    )?;

    emit!(Refunded { match_id, player, amount: stake });
    Ok(())
}
