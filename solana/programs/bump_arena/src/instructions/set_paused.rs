use anchor_lang::prelude::*;

use crate::constants::CONFIG_SEED;
use crate::error::BumpError;
use crate::state::Config;

#[derive(Accounts)]
pub struct SetPaused<'info> {
    #[account(constraint = admin.key() == config.admin @ BumpError::Unauthorized)]
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
}

pub fn handler(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
    ctx.accounts.config.paused = paused;
    Ok(())
}
