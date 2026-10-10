use anchor_lang::prelude::*;

use crate::constants::MAX_PLAYERS;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub result_signer: Pubkey,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub stake: u64,
    pub start_balance: u32,
    pub settle_window_s: i64,
    pub paused: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Match {
    pub match_id: [u8; 32],
    pub status: u8,
    pub stake: u64,
    pub start_balance: u32,
    pub max_players: u8,
    pub player_count: u8,
    pub players: [Pubkey; MAX_PLAYERS],
    pub session_keys: [Pubkey; MAX_PLAYERS],
    pub vehicles: [u8; MAX_PLAYERS],
    pub refunded: u8,
    pub join_deadline: i64,
    pub settle_deadline: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Match {
    pub fn seat_of(&self, player: &Pubkey) -> Option<usize> {
        self.players[..self.player_count as usize].iter().position(|p| p == player)
    }
}
