use anchor_lang::prelude::*;

#[event]
pub struct MatchOpened {
    pub match_id: [u8; 32],
    pub stake: u64,
    pub max_players: u8,
    pub join_deadline: i64,
}

#[event]
pub struct PlayerJoined {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub session_key: Pubkey,
    pub vehicle_id: u8,
    pub seat: u8,
}

#[event]
pub struct MatchStarted {
    pub match_id: [u8; 32],
    pub settle_deadline: i64,
}

#[event]
pub struct PlayerResult {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub final_balance: u32,
    pub rank: u8,
    pub payout: u64,
}

#[event]
pub struct MatchSettled {
    pub match_id: [u8; 32],
    pub pot: u64,
    pub dust: u64,
    pub input_log_hash: [u8; 32],
    pub replay_hash: [u8; 32],
}

#[event]
pub struct MatchCancelled {
    pub match_id: [u8; 32],
}

#[event]
pub struct Refunded {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub amount: u64,
}
