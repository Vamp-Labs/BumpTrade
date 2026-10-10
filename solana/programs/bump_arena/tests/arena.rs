mod common;

use common::*;
use solana_pubkey::Pubkey;
use solana_signer::Signer;

const STAKE: u64 = 100_000_000_000;

fn ready() -> Env {
    let mut env = Env::new_default();
    ok(env.initialize());
    env
}

fn refs(players: &[Player]) -> Vec<&Player> {
    players.iter().collect()
}

#[test]
fn initialize_creates_config() {
    let mut env = Env::new_default();
    ok(env.initialize());
    let acc = env.svm.get_account(&env.config).unwrap();
    assert_eq!(acc.owner, program_id());
    let d = &acc.data[8..];
    assert_eq!(&d[0..32], env.admin.pubkey().as_ref());
    assert_eq!(&d[32..64], env.operator.pubkey().as_ref());
    assert_eq!(&d[64..96], env.result_signer.pubkey().as_ref());
    assert_eq!(&d[96..128], env.mint.as_ref());
    assert_eq!(&d[128..160], env.treasury.as_ref());
    assert_eq!(u64::from_le_bytes(d[160..168].try_into().unwrap()), STAKE);
    assert_eq!(u32::from_le_bytes(d[168..172].try_into().unwrap()), 100);
    assert_eq!(i64::from_le_bytes(d[172..180].try_into().unwrap()), WINDOW);
    assert_eq!(d[180], 0);
    assert_eq!(acc.data.len(), 8 + 32 * 5 + 8 + 4 + 8 + 1 + 1);
}

#[test]
fn initialize_twice_fails() {
    let mut env = ready();
    env.svm.expire_blockhash();
    assert!(env.initialize().is_err());
}

#[test]
fn initialize_rejects_treasury_of_other_mint() {
    let mut env = Env::new_default();
    let other = env.create_mint();
    let bad = env.create_token_account(&other, &Pubkey::new_unique(), 0);
    let ix = env.ix_initialize(bad, env.mint);
    let admin = env.admin.insecure_clone();
    expect_err(env.send(&[ix], &admin, &[]), "ConstraintTokenMint");
}

#[test]
fn initialize_rejects_zero_params() {
    let mut env = Env::new(0, 100);
    expect_err(env.initialize(), "InvalidParams");
}

#[test]
fn open_match_creates_match_and_vault() {
    let mut env = ready();
    let id = mid(1);
    let meta = ok(env.open(id, 8));
    assert!(meta.logs.iter().any(|l| l.contains("Program data:")));
    let m = env.match_state(&id);
    assert_eq!(m.status, 1);
    assert_eq!(m.player_count, 0);
    let vault = env.svm.get_account(&env.pda_vault(&id)).unwrap();
    assert_eq!(vault.owner, token_program());
    assert_eq!(&vault.data[32..64], env.pda_match(&id).as_ref());
    assert_eq!(&vault.data[0..32], env.mint.as_ref());
}

#[test]
fn open_match_rejects_bad_params_duplicates_and_authority() {
    let mut env = ready();
    let op = env.operator.insecure_clone();
    let now = env.now();

    for (max, deadline) in [(1u8, now + 100), (9, now + 100), (4, now), (4, now - 5)] {
        let ix = env.ix_open(mid(2), max, deadline);
        expect_err(env.send(&[ix], &op, &[]), "InvalidParams");
    }

    ok(env.open(mid(3), 4));
    assert!(env.open(mid(3), 4).is_err());

    let ix = env.ix_open(mid(4), 4, now + 100);
    let admin = env.admin.insecure_clone();
    let mut ix = ix;
    ix.accounts[0].pubkey = admin.pubkey();
    expect_err(env.send(&[ix], &admin, &[]), "Unauthorized");
}

#[test]
fn open_match_rejects_wrong_mint() {
    let mut env = ready();
    let other = env.create_mint();
    let id = mid(5);
    let mut ix = env.ix_open(id, 4, env.now() + 100);
    ix.accounts[2].pubkey = other;
    let op = env.operator.insecure_clone();
    expect_err(env.send(&[ix], &op, &[]), "ConstraintAddress");
}

#[test]
fn join_two_players_moves_stake_and_records_seats() {
    let mut env = ready();
    let id = mid(10);
    ok(env.open(id, 8));
    let a = env.new_player(STAKE * 2);
    let b = env.new_player(STAKE * 2);
    let meta = ok(env.join(id, &a, 3));
    println!("CU join_match (first seat): {}", meta.compute_units_consumed);
    ok(env.join(id, &b, 6));
    assert_eq!(env.balance(&a.ata), STAKE);
    assert_eq!(env.balance(&b.ata), STAKE);
    assert_eq!(env.balance(&env.pda_vault(&id)), 2 * STAKE);
    let acc = env.svm.get_account(&env.pda_match(&id)).unwrap();
    let d = &acc.data[8..];
    let players_off = 32 + 1 + 8 + 4 + 1 + 1;
    assert_eq!(&d[players_off..players_off + 32], a.key().as_ref());
    assert_eq!(&d[players_off + 32..players_off + 64], b.key().as_ref());
    let sess_off = players_off + 256;
    assert_eq!(&d[sess_off..sess_off + 32], a.session.pubkey().as_ref());
    assert_eq!(&d[sess_off + 32..sess_off + 64], b.session.pubkey().as_ref());
    let veh_off = sess_off + 256;
    assert_eq!(d[veh_off], 3);
    assert_eq!(d[veh_off + 1], 6);
    assert_eq!(env.match_state(&id).player_count, 2);
}

#[test]
fn join_player_pays_no_fee_relayer_does() {
    let mut env = ready();
    let id = mid(11);
    ok(env.open(id, 2));
    let a = env.new_player(STAKE);
    assert_eq!(env.svm.get_balance(&a.key()), None);
    let before = env.svm.get_balance(&env.relayer.pubkey()).unwrap();
    ok(env.join(id, &a, 0));
    assert!(env.svm.get_balance(&env.relayer.pubkey()).unwrap() < before);
    assert_eq!(env.svm.get_balance(&a.key()).unwrap_or(0), 0);
}

#[test]
fn join_eight_players_until_full() {
    let mut env = ready();
    let id = mid(12);
    ok(env.open(id, 8));
    let mut last = 0;
    for i in 0..8 {
        let p = env.new_player(STAKE);
        let meta = ok(env.join(id, &p, (i % 7) as u8));
        last = meta.compute_units_consumed;
    }
    println!("CU join_match (8th seat): {last}");
    assert_eq!(env.balance(&env.pda_vault(&id)), 8 * STAKE);
    let extra = env.new_player(STAKE);
    expect_err(env.join(id, &extra, 0), "MatchFull");
}

#[test]
fn join_rejections() {
    let mut env = ready();
    let id = mid(13);
    ok(env.open(id, 3));
    let a = env.new_player(STAKE);
    ok(env.join(id, &a, 0));
    expect_err(env.join(id, &a, 1), "AlreadyJoined");

    let poor = env.new_player(STAKE - 1);
    assert!(env.join(id, &poor, 0).is_err());

    let b = env.new_player(STAKE);
    expect_err(env.join(id, &b, 7), "BadVehicle");

    let other_mint = env.create_mint();
    let wrong = env.new_player(0);
    let wrong_ata = env.create_token_account(&other_mint, &wrong.key(), STAKE);
    let ix = env.ix_join_with(id, &wrong, wrong_ata, 0);
    let relayer = env.relayer.insecure_clone();
    expect_err(env.send(&[ix], &relayer, &[&wrong.kp]), "ConstraintTokenMint");

    let someone_elses = env.new_player(STAKE);
    let ix = env.ix_join_with(id, &b, someone_elses.ata, 0);
    expect_err(env.send(&[ix], &relayer, &[&b.kp]), "ConstraintTokenOwner");

    let mut ix = env.ix_join(id, &b, 0);
    ix.accounts[0].is_signer = false;
    let relayer2 = env.relayer.insecure_clone();
    expect_err(env.send(&[ix], &relayer2, &[]), "AccountNotSigner");

    env.set_time(env.now() + JOIN_IN + 1);
    expect_err(env.join(id, &b, 0), "JoinClosed");
}

#[test]
fn join_not_open_and_paused() {
    let mut env = ready();
    let id = mid(14);
    let players = env.setup_match(id, 4, 2);
    ok(env.start(id));
    let late = env.new_player(STAKE);
    expect_err(env.join(id, &late, 0), "MatchNotOpen");

    let id2 = mid(15);
    ok(env.open(id2, 4));
    ok(env.set_paused(true));
    expect_err(env.join(id2, &late, 0), "Paused");
    expect_err(env.open(mid(16), 4), "Paused");
    ok(env.set_paused(false));
    ok(env.join(id2, &late, 0));
    let _ = players;
}

#[test]
fn join_unknown_match_fails() {
    let mut env = ready();
    let p = env.new_player(STAKE);
    assert!(env.join(mid(99), &p, 0).is_err());
}

#[test]
fn start_requires_two_players_and_operator() {
    let mut env = ready();
    let id = mid(20);
    let players = env.setup_match(id, 4, 1);
    expect_err(env.start(id), "NotEnoughPlayers");
    let p2 = env.new_player(STAKE);
    ok(env.join(id, &p2, 1));

    let mut ix = env.ix_start(id);
    let intruder = solana_keypair::Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    ix.accounts[0].pubkey = intruder.pubkey();
    expect_err(env.send(&[ix], &intruder, &[]), "Unauthorized");

    ok(env.start(id));
    assert_eq!(env.match_state(&id).status, 2);
    expect_err(env.start(id), "BadStatus");
    let _ = players;
}

#[test]
fn settle_two_players_exact_balances() {
    let mut env = ready();
    let id = mid(30);
    let players = env.setup_match(id, 2, 2);
    ok(env.start(id));
    let before = env.total_tokens(&refs(&players), &id);
    let meta = ok(env.settle(id, &refs(&players), vec![150, 50], vec![1, 2]));
    println!("CU settle (2 players): {}", meta.compute_units_consumed);
    assert_eq!(env.balance(&players[0].ata), STAKE * 2 + STAKE * 150 / 100);
    assert_eq!(env.balance(&players[1].ata), STAKE * 2 + STAKE * 50 / 100);
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
    assert_eq!(env.balance(&env.treasury), 0);
    assert_eq!(env.total_tokens(&refs(&players), &id), before);
    assert_eq!(env.match_state(&id).status, 3);
    expect_err(env.settle(id, &refs(&players), vec![150, 50], vec![1, 2]), "BadStatus");
}

#[test]
fn settle_eight_players_exact_balances() {
    let mut env = ready();
    let id = mid(31);
    let players = env.setup_match(id, 8, 8);
    ok(env.start(id));
    let balances = vec![300, 200, 100, 100, 50, 25, 25, 0];
    let ranks = vec![1, 2, 3, 4, 5, 6, 7, 8];
    let meta = ok(env.settle(id, &refs(&players), balances.clone(), ranks));
    println!("CU settle (8 players): {}", meta.compute_units_consumed);
    for (p, b) in players.iter().zip(&balances) {
        assert_eq!(env.balance(&p.ata), STAKE * 2 + STAKE * (*b as u64) / 100);
    }
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
}

#[test]
fn settle_sends_dust_to_treasury() {
    let mut env = Env::new(1_000, 7);
    ok(env.initialize());
    let id = mid(32);
    let players = env.setup_match(id, 3, 3);
    ok(env.start(id));
    ok(env.settle(id, &refs(&players), vec![10, 7, 4], vec![1, 2, 3]));
    assert_eq!(env.balance(&players[0].ata), 3_000 - 1_000 + 1_428);
    assert_eq!(env.balance(&players[1].ata), 3_000 - 1_000 + 1_000);
    assert_eq!(env.balance(&players[2].ata), 3_000 - 1_000 + 571);
    assert_eq!(env.balance(&env.treasury), 1);
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
}

#[test]
fn settle_zero_payout_player_gets_nothing() {
    let mut env = ready();
    let id = mid(33);
    let players = env.setup_match(id, 2, 2);
    ok(env.start(id));
    ok(env.settle(id, &refs(&players), vec![200, 0], vec![1, 2]));
    assert_eq!(env.balance(&players[1].ata), STAKE * 2);
    assert_eq!(env.balance(&players[0].ata), STAKE * 2 + STAKE * 2);
}

fn started(env: &mut Env, id: [u8; 32], n: usize) -> Vec<Player> {
    let players = env.setup_match(id, 8, n);
    ok(env.start(id));
    players
}

#[test]
fn settle_requires_both_signers() {
    let mut env = ready();
    let id = mid(34);
    let players = started(&mut env, id, 2);

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100], vec![1, 2]);
    ix.accounts[1].is_signer = false;
    let op = env.operator.insecure_clone();
    expect_err(env.send(&[ix], &op, &[]), "AccountNotSigner");

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100], vec![1, 2]);
    ix.accounts[0].is_signer = false;
    let rs = env.result_signer.insecure_clone();
    expect_err(env.send(&[ix], &rs, &[]), "AccountNotSigner");

    let fake = solana_keypair::Keypair::new();
    env.svm.airdrop(&fake.pubkey(), 1_000_000_000).unwrap();
    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100], vec![1, 2]);
    ix.accounts[1].pubkey = fake.pubkey();
    expect_err(env.send(&[ix], &op, &[&fake]), "Unauthorized");

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100], vec![1, 2]);
    ix.accounts[0].pubkey = fake.pubkey();
    let rs = env.result_signer.insecure_clone();
    expect_err(env.send(&[ix], &fake, &[&rs]), "Unauthorized");
    assert_eq!(env.match_state(&id).status, 2);
}

#[test]
fn settle_rejects_bad_payloads() {
    let mut env = ready();
    let id = mid(35);
    let players = started(&mut env, id, 3);
    let p = refs(&players);

    expect_err(env.settle(id, &p, vec![150, 150], vec![1, 2, 3]), "LengthMismatch");
    expect_err(env.settle(id, &p, vec![100, 100, 100], vec![1, 2]), "LengthMismatch");
    expect_err(env.settle(id, &p, vec![100, 100, 101], vec![1, 2, 3]), "NotZeroSum");
    expect_err(env.settle(id, &p, vec![100, 100, 99], vec![1, 2, 3]), "NotZeroSum");
    expect_err(env.settle(id, &p, vec![u32::MAX, 100, 100], vec![1, 2, 3]), "NotZeroSum");
    expect_err(env.settle(id, &p, vec![100, 100, 100], vec![1, 1, 2]), "BadRanks");
    expect_err(env.settle(id, &p, vec![100, 100, 100], vec![0, 1, 2]), "BadRanks");
    expect_err(env.settle(id, &p, vec![100, 100, 100], vec![1, 2, 4]), "BadRanks");
    assert_eq!(env.match_state(&id).status, 2);
    ok(env.settle(id, &p, vec![100, 100, 100], vec![3, 1, 2]));
}

#[test]
fn settle_rejects_bad_remaining_accounts() {
    let mut env = ready();
    let id = mid(36);
    let players = started(&mut env, id, 3);

    expect_err(env.settle(id, &[&players[1], &players[0], &players[2]], vec![100, 100, 100], vec![1, 2, 3]), "BadRemainingAccounts");
    expect_err(env.settle(id, &[&players[0], &players[1]], vec![100, 100, 100], vec![1, 2, 3]), "BadRemainingAccounts");

    let outsider = env.new_player(0);
    expect_err(env.settle(id, &[&players[0], &players[1], &outsider], vec![100, 100, 100], vec![1, 2, 3]), "BadRemainingAccounts");

    let other_mint = env.create_mint();
    let fake_ata = env.create_token_account(&other_mint, &players[2].key(), 0);
    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]);
    ix.accounts[7 + 2].pubkey = fake_ata;
    expect_err(env.send_settle(ix), "BadRemainingAccounts");

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]);
    ix.accounts[7 + 2].pubkey = env.pda_vault(&id);
    expect_err(env.send_settle(ix), "BadRemainingAccounts");

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]);
    ix.accounts[7 + 1].is_writable = false;
    expect_err(env.send_settle(ix), "BadRemainingAccounts");

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]);
    ix.accounts[6].pubkey = env.config;
    assert!(env.send_settle(ix).is_err());

    let mut ix = env.ix_settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]);
    ix.accounts[5].pubkey = players[0].ata;
    expect_err(env.send_settle(ix), "ConstraintAddress");

    assert_eq!(env.balance(&env.pda_vault(&id)), 3 * STAKE);
    ok(env.settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]));
}

#[test]
fn settle_window_enforced() {
    let mut env = ready();
    let id = mid(37);
    let players = started(&mut env, id, 2);
    let deadline = env.now() + JOIN_IN + WINDOW;
    env.set_time(deadline);
    let p = refs(&players);
    ok(env.settle(id, &p, vec![100, 100], vec![1, 2]));

    let id2 = mid(38);
    let players2 = started(&mut env, id2, 2);
    env.set_time(env.now() + JOIN_IN + WINDOW + 1);
    let p2 = refs(&players2);
    expect_err(env.settle(id2, &p2, vec![100, 100], vec![1, 2]), "SettleWindowOver");
}

#[test]
fn settle_requires_started() {
    let mut env = ready();
    let id = mid(39);
    let players = env.setup_match(id, 4, 2);
    expect_err(env.settle(id, &refs(&players), vec![100, 100], vec![1, 2]), "BadStatus");
}

#[test]
fn cancel_refunds_everyone() {
    let mut env = ready();
    let id = mid(40);
    let players = env.setup_match(id, 8, 5);
    let before = env.total_tokens(&refs(&players), &id);
    ok(env.cancel(id, &refs(&players)));
    for p in &players {
        assert_eq!(env.balance(&p.ata), STAKE * 3);
    }
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
    assert_eq!(env.total_tokens(&refs(&players), &id), before);
    assert_eq!(env.match_state(&id).status, 4);
    expect_err(env.cancel(id, &refs(&players)), "BadStatus");
    expect_err(env.claim(id, &players[0]), "BadStatus");
}

#[test]
fn cancel_empty_match_and_authority() {
    let mut env = ready();
    let id = mid(41);
    ok(env.open(id, 4));
    let mut ix = env.ix_cancel(id, &[]);
    let intruder = solana_keypair::Keypair::new();
    env.svm.airdrop(&intruder.pubkey(), 1_000_000_000).unwrap();
    ix.accounts[0].pubkey = intruder.pubkey();
    expect_err(env.send(&[ix], &intruder, &[]), "Unauthorized");
    ok(env.cancel(id, &[]));
    assert_eq!(env.match_state(&id).status, 4);
}

#[test]
fn cancel_rejects_started_with_players_and_bad_accounts() {
    let mut env = ready();
    let id = mid(42);
    let players = env.setup_match(id, 4, 3);
    expect_err(env.cancel(id, &[&players[0], &players[1]]), "BadRemainingAccounts");
    expect_err(env.cancel(id, &[&players[1], &players[0], &players[2]]), "BadRemainingAccounts");
    ok(env.start(id));
    expect_err(env.cancel(id, &refs(&players)), "BadStatus");
}

#[test]
fn claim_refund_after_settle_window_once_per_seat() {
    let mut env = ready();
    let id = mid(50);
    let players = started(&mut env, id, 3);
    expect_err(env.claim(id, &players[0]), "SettleWindowOpen");
    env.set_time(env.now() + JOIN_IN + WINDOW + 1);

    ok(env.claim(id, &players[1]));
    assert_eq!(env.balance(&players[1].ata), STAKE * 3);
    assert_eq!(env.balance(&env.pda_vault(&id)), 2 * STAKE);
    assert_eq!(env.match_state(&id).status, 5);
    assert_eq!(env.match_state(&id).refunded, 0b010);
    expect_err(env.claim(id, &players[1]), "AlreadyRefunded");

    let stranger = env.new_player(0);
    expect_err(env.claim(id, &stranger), "NotAPlayer");

    let ix = env.ix_claim(id, &players[0]);
    let mut ix = ix;
    ix.accounts[3].pubkey = players[2].ata;
    let payer = solana_keypair::Keypair::new();
    env.svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
    expect_err(env.send(&[ix], &payer, &[]), "ConstraintTokenOwner");

    ok(env.claim(id, &players[0]));
    ok(env.claim(id, &players[2]));
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
    expect_err(env.settle(id, &refs(&players), vec![100, 100, 100], vec![1, 2, 3]), "BadStatus");
}

#[test]
fn claim_refund_for_abandoned_open_match() {
    let mut env = ready();
    let id = mid(51);
    let players = env.setup_match(id, 4, 2);
    expect_err(env.claim(id, &players[0]), "SettleWindowOpen");
    env.set_time(env.now() + JOIN_IN + 1);
    expect_err(env.claim(id, &players[0]), "SettleWindowOpen");
    env.set_time(env.now() + WINDOW);
    ok(env.claim(id, &players[0]));
    ok(env.claim(id, &players[1]));
    assert_eq!(env.balance(&players[0].ata), STAKE * 3);
    assert_eq!(env.balance(&players[1].ata), STAKE * 3);
    assert_eq!(env.balance(&env.pda_vault(&id)), 0);
    let late = env.new_player(STAKE);
    expect_err(env.join(id, &late, 0), "MatchNotOpen");
}

#[test]
fn claim_refund_rejected_after_settle() {
    let mut env = ready();
    let id = mid(52);
    let players = started(&mut env, id, 2);
    ok(env.settle(id, &refs(&players), vec![100, 100], vec![1, 2]));
    env.set_time(env.now() + 10_000);
    expect_err(env.claim(id, &players[0]), "BadStatus");
}

#[test]
fn set_paused_admin_only() {
    let mut env = ready();
    let ix = env.ix_set_paused(&env.operator.pubkey(), true);
    let op = env.operator.insecure_clone();
    expect_err(env.send(&[ix], &op, &[]), "Unauthorized");
    ok(env.set_paused(true));
    let acc = env.svm.get_account(&env.config).unwrap();
    assert_eq!(acc.data[8 + 32 * 5 + 8 + 4 + 8], 1);
    ok(env.set_paused(false));
}

#[test]
fn paused_does_not_block_settle_cancel_or_refund() {
    let mut env = ready();
    let id = mid(60);
    let players = started(&mut env, id, 2);
    let id2 = mid(61);
    let players2 = env.setup_match(id2, 4, 2);
    ok(env.set_paused(true));
    ok(env.settle(id, &refs(&players), vec![120, 80], vec![1, 2]));
    ok(env.cancel(id2, &refs(&players2)));
}

#[test]
fn rent_and_sizes() {
    let mut env = ready();
    let id = mid(70);
    ok(env.open(id, 8));
    let m = env.match_state(&id);
    let vault = env.svm.get_account(&env.pda_vault(&id)).unwrap();
    let config = env.svm.get_account(&env.config).unwrap();
    println!("Config: {} bytes, rent {} lamports", config.data.len(), config.lamports);
    println!("Match: {} bytes, rent {} lamports", m.len, m.lamports);
    println!("Vault: {} bytes, rent {} lamports", vault.data.len(), vault.lamports);
    assert_eq!(m.len, 8 + 32 + 1 + 8 + 4 + 1 + 1 + 256 + 256 + 8 + 1 + 8 + 8 + 1 + 1);
}

#[test]
fn invariant_random_scenarios() {
    use rand::{rngs::StdRng, Rng, SeedableRng};
    let mut rng = StdRng::seed_from_u64(0xB0_0B);

    for round in 0..40u32 {
        let stake: u64 = rng.gen_range(1..=5_000_000u64);
        let start_balance: u32 = rng.gen_range(1..=1000);
        let mut env = Env::new(stake, start_balance);
        ok(env.initialize());
        let id = mid(100 + round as u8);
        let n: usize = rng.gen_range(2..=8);
        ok(env.open(id, 8));
        let mut players = vec![];
        for i in 0..n {
            let p = env.new_player(stake * 2);
            ok(env.join(id, &p, (i % 7) as u8));
            players.push(p);
            let seated = (i + 1) as u64;
            assert_eq!(env.balance(&env.pda_vault(&id)), stake * seated);
        }
        let total_before = env.total_tokens(&refs(&players), &id);

        let outcome = rng.gen_range(0..3);
        match outcome {
            0 => {
                ok(env.start(id));
                let total = start_balance as u64 * n as u64;
                let mut balances = vec![0u32; n];
                let mut left = total;
                for b in balances.iter_mut().take(n - 1) {
                    let v = rng.gen_range(0..=left);
                    *b = v as u32;
                    left -= v;
                }
                balances[n - 1] = left as u32;
                let mut ranks: Vec<u8> = (1..=n as u8).collect();
                for i in (1..n).rev() {
                    ranks.swap(i, rng.gen_range(0..=i));
                }
                ok(env.settle(id, &refs(&players), balances.clone(), ranks));
                let paid: u64 = balances.iter().map(|b| stake * *b as u64 / start_balance as u64).sum();
                assert_eq!(env.balance(&env.treasury), stake * n as u64 - paid);
            }
            1 => {
                ok(env.cancel(id, &refs(&players)));
            }
            _ => {
                ok(env.start(id));
                env.set_time(env.now() + JOIN_IN + WINDOW + 1);
                let mut order: Vec<usize> = (0..n).collect();
                for i in (1..n).rev() {
                    order.swap(i, rng.gen_range(0..=i));
                }
                for (k, idx) in order.iter().enumerate() {
                    ok(env.claim(id, &players[*idx]));
                    let unsettled = (n - k - 1) as u64;
                    assert_eq!(env.balance(&env.pda_vault(&id)), stake * unsettled);
                }
            }
        }
        assert_eq!(env.balance(&env.pda_vault(&id)), 0);
        assert_eq!(env.total_tokens(&refs(&players), &id), total_before);
        if outcome != 0 {
            assert_eq!(env.balance(&env.treasury), 0);
        }
    }
}
