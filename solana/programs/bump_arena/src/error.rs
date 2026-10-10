use anchor_lang::prelude::*;

#[error_code]
pub enum BumpError {
    Paused,
    MatchNotOpen,
    MatchFull,
    JoinClosed,
    AlreadyJoined,
    NotEnoughPlayers,
    BadStatus,
    SettleWindowOver,
    SettleWindowOpen,
    LengthMismatch,
    NotZeroSum,
    BadRemainingAccounts,
    AlreadyRefunded,
    NotAPlayer,
    Unauthorized,
    BadRanks,
    BadVehicle,
    InvalidParams,
}
