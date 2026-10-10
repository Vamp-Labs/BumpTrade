use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::*;
use crate::error::BumpError;
use crate::events::PlayerJoined;
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct JoinMatch<'info> {
    pub player: Signer<'info>,
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

pub fn handler(ctx: Context<JoinMatch>, match_id: [u8; 32], session_key: Pubkey, vehicle_id: u8) -> Result<()> {
    require!(!ctx.accounts.config.paused, BumpError::Paused);
    let now = Clock::get()?.unix_timestamp;
    let player = ctx.accounts.player.key();
    let m = &mut ctx.accounts.match_account;
    require!(m.status == STATUS_OPEN, BumpError::MatchNotOpen);
    require!(now <= m.join_deadline, BumpError::JoinClosed);
    require!(m.player_count < m.max_players, BumpError::MatchFull);
    require!(m.seat_of(&player).is_none(), BumpError::AlreadyJoined);
    require!(vehicle_id < VEHICLE_COUNT, BumpError::BadVehicle);

    let seat = m.player_count as usize;
    m.players[seat] = player;
    m.session_keys[seat] = session_key;
    m.vehicles[seat] = vehicle_id;
    m.player_count += 1;
    let stake = m.stake;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.player_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        stake,
    )?;

    emit!(PlayerJoined { match_id, player, session_key, vehicle_id, seat: seat as u8 });
    Ok(())
}
