use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::*;
use crate::error::BumpError;
use crate::events::MatchOpened;
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct OpenMatch<'info> {
    #[account(mut, constraint = operator.key() == config.operator @ BumpError::Unauthorized)]
    pub operator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(address = config.mint)]
    pub mint: Account<'info, Mint>,
    #[account(init, payer = operator, space = 8 + Match::INIT_SPACE, seeds = [MATCH_SEED, match_id.as_ref()], bump)]
    pub match_account: Account<'info, Match>,
    #[account(
        init,
        payer = operator,
        seeds = [VAULT_SEED, match_id.as_ref()],
        bump,
        token::mint = mint,
        token::authority = match_account,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<OpenMatch>, match_id: [u8; 32], max_players: u8, join_deadline: i64) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, BumpError::Paused);
    let now = Clock::get()?.unix_timestamp;
    require!(
        (2..=MAX_PLAYERS as u8).contains(&max_players) && join_deadline > now,
        BumpError::InvalidParams
    );
    let settle_deadline = join_deadline.checked_add(config.settle_window_s).ok_or(BumpError::InvalidParams)?;

    let m = &mut ctx.accounts.match_account;
    m.match_id = match_id;
    m.status = STATUS_OPEN;
    m.stake = config.stake;
    m.start_balance = config.start_balance;
    m.max_players = max_players;
    m.player_count = 0;
    m.players = [Pubkey::default(); MAX_PLAYERS];
    m.session_keys = [Pubkey::default(); MAX_PLAYERS];
    m.vehicles = [0; MAX_PLAYERS];
    m.refunded = 0;
    m.join_deadline = join_deadline;
    m.settle_deadline = settle_deadline;
    m.bump = ctx.bumps.match_account;
    m.vault_bump = ctx.bumps.vault;

    emit!(MatchOpened { match_id, stake: m.stake, max_players, join_deadline });
    Ok(())
}
