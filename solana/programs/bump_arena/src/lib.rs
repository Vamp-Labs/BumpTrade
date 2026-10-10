pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("3LDXSuMuzP33VZ31sar4ZN1YB13pta7NRuR6aDJmwVgz");

#[program]
pub mod bump_arena {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        operator: Pubkey,
        result_signer: Pubkey,
        treasury: Pubkey,
        stake: u64,
        start_balance: u32,
        settle_window_s: i64,
    ) -> Result<()> {
        instructions::initialize::handler(ctx, operator, result_signer, treasury, stake, start_balance, settle_window_s)
    }

    pub fn open_match(
        ctx: Context<OpenMatch>,
        match_id: [u8; 32],
        max_players: u8,
        join_deadline: i64,
    ) -> Result<()> {
        instructions::open_match::handler(ctx, match_id, max_players, join_deadline)
    }

    pub fn join_match(
        ctx: Context<JoinMatch>,
        match_id: [u8; 32],
        session_key: Pubkey,
        vehicle_id: u8,
    ) -> Result<()> {
        instructions::join_match::handler(ctx, match_id, session_key, vehicle_id)
    }

    pub fn start_match(ctx: Context<StartMatch>, match_id: [u8; 32]) -> Result<()> {
        instructions::start_match::handler(ctx, match_id)
    }

    pub fn settle<'info>(
        ctx: Context<'info, Settle<'info>>,
        match_id: [u8; 32],
        final_balances: Vec<u32>,
        ranks: Vec<u8>,
        input_log_hash: [u8; 32],
        replay_hash: [u8; 32],
        ended_at: i64,
    ) -> Result<()> {
        instructions::settle::handler(ctx, match_id, final_balances, ranks, input_log_hash, replay_hash, ended_at)
    }

    pub fn cancel<'info>(ctx: Context<'info, Cancel<'info>>, match_id: [u8; 32]) -> Result<()> {
        instructions::cancel::handler(ctx, match_id)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>, match_id: [u8; 32], player: Pubkey) -> Result<()> {
        instructions::claim_refund::handler(ctx, match_id, player)
    }

    pub fn set_paused(ctx: Context<SetPaused>, paused: bool) -> Result<()> {
        instructions::set_paused::handler(ctx, paused)
    }
}
