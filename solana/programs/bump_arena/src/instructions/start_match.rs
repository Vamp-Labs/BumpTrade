use anchor_lang::prelude::*;

use crate::constants::*;
use crate::error::BumpError;
use crate::events::MatchStarted;
use crate::state::{Config, Match};

#[derive(Accounts)]
#[instruction(match_id: [u8; 32])]
pub struct StartMatch<'info> {
    #[account(constraint = operator.key() == config.operator @ BumpError::Unauthorized)]
    pub operator: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [MATCH_SEED, match_id.as_ref()], bump = match_account.bump)]
    pub match_account: Account<'info, Match>,
}

pub fn handler(ctx: Context<StartMatch>, match_id: [u8; 32]) -> Result<()> {
    let m = &mut ctx.accounts.match_account;
    require!(m.status == STATUS_OPEN, BumpError::BadStatus);
    require!(m.player_count >= 2, BumpError::NotEnoughPlayers);
    m.status = STATUS_STARTED;
    emit!(MatchStarted { match_id, settle_deadline: m.settle_deadline });
    Ok(())
}
