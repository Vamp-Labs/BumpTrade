pub const CONFIG_SEED: &[u8] = b"config";
pub const MATCH_SEED: &[u8] = b"match";
pub const VAULT_SEED: &[u8] = b"vault";
pub const MAX_PLAYERS: usize = 8;
pub const VEHICLE_COUNT: u8 = 7;

pub const STATUS_NONE: u8 = 0;
pub const STATUS_OPEN: u8 = 1;
pub const STATUS_STARTED: u8 = 2;
pub const STATUS_SETTLED: u8 = 3;
pub const STATUS_CANCELLED: u8 = 4;
pub const STATUS_REFUNDING: u8 = 5;
