use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::CONFIG_SEED;
use crate::error::BumpError;
use crate::state::Config;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(token::mint = mint)]
    pub treasury: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<Initialize>,
    operator: Pubkey,
    result_signer: Pubkey,
    treasury: Pubkey,
    stake: u64,
    start_balance: u32,
    settle_window_s: i64,
) -> Result<()> {
    require!(stake > 0 && start_balance > 0 && settle_window_s > 0, BumpError::InvalidParams);
    require_keys_eq!(ctx.accounts.treasury.key(), treasury, BumpError::InvalidParams);
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.operator = operator;
    config.result_signer = result_signer;
    config.mint = ctx.accounts.mint.key();
    config.treasury = treasury;
    config.stake = stake;
    config.start_balance = start_balance;
    config.settle_window_s = settle_window_s;
    config.paused = false;
    config.bump = ctx.bumps.config;
    Ok(())
}
