#![allow(dead_code)]

use anchor_lang::{InstructionData, ToAccountMetas};
use litesvm::types::TransactionMetadata;
use litesvm::LiteSVM;
use solana_account::Account;
use solana_clock::Clock;
use solana_instruction::{AccountMeta, Instruction};
use solana_keypair::Keypair;
use solana_pubkey::Pubkey;
use solana_signer::Signer;
use solana_transaction::Transaction;

pub const T0: i64 = 1_000_000;
pub const WINDOW: i64 = 600;
pub const JOIN_IN: i64 = 120;

pub fn program_id() -> Pubkey {
    bump_arena::ID
}

pub fn token_program() -> Pubkey {
    anchor_spl::token::ID
}

#[derive(Debug)]
pub struct Fail {
    pub logs: String,
    pub err: String,
}

impl Fail {
    pub fn has(&self, name: &str) -> bool {
        self.logs.contains(&format!("Error Code: {name}"))
    }
}

pub type Res = Result<TransactionMetadata, Fail>;

pub fn expect_err(res: Res, name: &str) {
    match res {
        Ok(_) => panic!("expected {name}, got success"),
        Err(f) => assert!(f.has(name), "expected {name}, got {} / {}", f.err, f.logs),
    }
}

pub fn ok(res: Res) -> TransactionMetadata {
    match res {
        Ok(m) => m,
        Err(f) => panic!("unexpected failure: {} / {}", f.err, f.logs),
    }
}

pub struct Player {
    pub kp: Keypair,
    pub ata: Pubkey,
    pub session: Keypair,
}

impl Player {
    pub fn key(&self) -> Pubkey {
        self.kp.pubkey()
    }
}

pub struct Env {
    pub svm: LiteSVM,
    pub admin: Keypair,
    pub operator: Keypair,
    pub result_signer: Keypair,
    pub relayer: Keypair,
    pub mint: Pubkey,
    pub treasury: Pubkey,
    pub config: Pubkey,
    pub stake: u64,
    pub start_balance: u32,
    pub accounts_seen: Vec<Pubkey>,
}

pub fn token_account_data(mint: &Pubkey, owner: &Pubkey, amount: u64) -> Vec<u8> {
    let mut d = vec![0u8; 165];
    d[0..32].copy_from_slice(mint.as_ref());
    d[32..64].copy_from_slice(owner.as_ref());
    d[64..72].copy_from_slice(&amount.to_le_bytes());
    d[108] = 1;
    d
}

pub fn mint_data(authority: &Pubkey, supply: u64) -> Vec<u8> {
    let mut d = vec![0u8; 82];
    d[0..4].copy_from_slice(&1u32.to_le_bytes());
    d[4..36].copy_from_slice(authority.as_ref());
    d[36..44].copy_from_slice(&supply.to_le_bytes());
    d[44] = 9;
    d[45] = 1;
    d
}

impl Env {
    pub fn new(stake: u64, start_balance: u32) -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program_from_file(program_id(), "../../target/deploy/bump_arena.so").expect("build the program first: anchor build");
        let mut clock = svm.get_sysvar::<Clock>();
        clock.unix_timestamp = T0;
        svm.set_sysvar(&clock);

        let admin = Keypair::new();
        let operator = Keypair::new();
        let result_signer = Keypair::new();
        let relayer = Keypair::new();
        for k in [&admin, &operator, &result_signer, &relayer] {
            svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        }

        let mut env = Env {
            svm,
            admin,
            operator,
            result_signer,
            relayer,
            mint: Pubkey::default(),
            treasury: Pubkey::default(),
            config: Pubkey::find_program_address(&[b"config"], &program_id()).0,
            stake,
            start_balance,
            accounts_seen: vec![],
        };
        env.mint = env.create_mint();
        env.treasury = env.create_token_account(&env.mint.clone(), &Pubkey::new_unique(), 0);
        env
    }

    pub fn new_default() -> Self {
        Self::new(100_000_000_000, 100)
    }

    pub fn create_mint(&mut self) -> Pubkey {
        let key = Pubkey::new_unique();
        let acc = Account {
            lamports: self.svm.minimum_balance_for_rent_exemption(82),
            data: mint_data(&Pubkey::new_unique(), 0),
            owner: token_program(),
            executable: false,
            rent_epoch: 0,
        };
        self.svm.set_account(key, acc).unwrap();
        key
    }

    pub fn create_token_account(&mut self, mint: &Pubkey, owner: &Pubkey, amount: u64) -> Pubkey {
        let key = Pubkey::new_unique();
        let acc = Account {
            lamports: self.svm.minimum_balance_for_rent_exemption(165),
            data: token_account_data(mint, owner, amount),
            owner: token_program(),
            executable: false,
            rent_epoch: 0,
        };
        self.svm.set_account(key, acc).unwrap();
        self.accounts_seen.push(key);
        key
    }

    pub fn balance(&self, key: &Pubkey) -> u64 {
        let acc = self.svm.get_account(key).expect("token account missing");
        u64::from_le_bytes(acc.data[64..72].try_into().unwrap())
    }

    pub fn new_player(&mut self, tokens: u64) -> Player {
        let kp = Keypair::new();
        let mint = self.mint;
        let ata = self.create_token_account(&mint, &kp.pubkey(), tokens);
        Player { kp, ata, session: Keypair::new() }
    }

    pub fn now(&self) -> i64 {
        self.svm.get_sysvar::<Clock>().unix_timestamp
    }

    pub fn set_time(&mut self, t: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp = t;
        self.svm.set_sysvar(&clock);
    }

    pub fn warp_to(&mut self, t: i64) {
        self.set_time(t);
    }

    pub fn send(&mut self, ixs: &[Instruction], payer: &Keypair, signers: &[&Keypair]) -> Res {
        self.svm.expire_blockhash();
        let mut all: Vec<&Keypair> = vec![payer];
        for s in signers {
            if s.pubkey() != payer.pubkey() {
                all.push(s);
            }
        }
        let tx = Transaction::new_signed_with_payer(ixs, Some(&payer.pubkey()), &all, self.svm.latest_blockhash());
        self.svm.send_transaction(tx).map_err(|f| Fail { logs: f.meta.logs.join("\n"), err: format!("{:?}", f.err) })
    }

    pub fn pda_match(&self, id: &[u8; 32]) -> Pubkey {
        Pubkey::find_program_address(&[b"match", id], &program_id()).0
    }

    pub fn pda_vault(&self, id: &[u8; 32]) -> Pubkey {
        Pubkey::find_program_address(&[b"vault", id], &program_id()).0
    }

    pub fn ix_initialize(&self, treasury: Pubkey, mint: Pubkey) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::Initialize {
                admin: self.admin.pubkey(),
                config: self.config,
                mint,
                treasury,
                token_program: token_program(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: bump_arena::instruction::Initialize {
                operator: self.operator.pubkey(),
                result_signer: self.result_signer.pubkey(),
                treasury,
                stake: self.stake,
                start_balance: self.start_balance,
                settle_window_s: WINDOW,
            }
            .data(),
        }
    }

    pub fn initialize(&mut self) -> Res {
        let ix = self.ix_initialize(self.treasury, self.mint);
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[])
    }

    pub fn ix_open(&self, id: [u8; 32], max_players: u8, join_deadline: i64) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::OpenMatch {
                operator: self.operator.pubkey(),
                config: self.config,
                mint: self.mint,
                match_account: self.pda_match(&id),
                vault: self.pda_vault(&id),
                token_program: token_program(),
                system_program: anchor_lang::system_program::ID,
            }
            .to_account_metas(None),
            data: bump_arena::instruction::OpenMatch { match_id: id, max_players, join_deadline }.data(),
        }
    }

    pub fn open(&mut self, id: [u8; 32], max_players: u8) -> Res {
        let deadline = self.now() + JOIN_IN;
        let ix = self.ix_open(id, max_players, deadline);
        let op = self.operator.insecure_clone();
        self.send(&[ix], &op, &[])
    }

    pub fn ix_join(&self, id: [u8; 32], p: &Player, vehicle: u8) -> Instruction {
        self.ix_join_with(id, p, p.ata, vehicle)
    }

    pub fn ix_join_with(&self, id: [u8; 32], p: &Player, ata: Pubkey, vehicle: u8) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::JoinMatch {
                player: p.key(),
                config: self.config,
                match_account: self.pda_match(&id),
                vault: self.pda_vault(&id),
                player_token: ata,
                token_program: token_program(),
            }
            .to_account_metas(None),
            data: bump_arena::instruction::JoinMatch { match_id: id, session_key: p.session.pubkey(), vehicle_id: vehicle }.data(),
        }
    }

    pub fn join(&mut self, id: [u8; 32], p: &Player, vehicle: u8) -> Res {
        let ix = self.ix_join(id, p, vehicle);
        let relayer = self.relayer.insecure_clone();
        self.send(&[ix], &relayer, &[&p.kp])
    }

    pub fn ix_start(&self, id: [u8; 32]) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::StartMatch {
                operator: self.operator.pubkey(),
                config: self.config,
                match_account: self.pda_match(&id),
            }
            .to_account_metas(None),
            data: bump_arena::instruction::StartMatch { match_id: id }.data(),
        }
    }

    pub fn start(&mut self, id: [u8; 32]) -> Res {
        let ix = self.ix_start(id);
        let op = self.operator.insecure_clone();
        self.send(&[ix], &op, &[])
    }

    pub fn ix_settle(&self, id: [u8; 32], players: &[&Player], balances: Vec<u32>, ranks: Vec<u8>) -> Instruction {
        let mut accounts = bump_arena::accounts::Settle {
            operator: self.operator.pubkey(),
            result_signer: self.result_signer.pubkey(),
            config: self.config,
            match_account: self.pda_match(&id),
            vault: self.pda_vault(&id),
            treasury: self.treasury,
            token_program: token_program(),
        }
        .to_account_metas(None);
        for p in players {
            accounts.push(AccountMeta::new(p.ata, false));
        }
        Instruction {
            program_id: program_id(),
            accounts,
            data: bump_arena::instruction::Settle {
                match_id: id,
                final_balances: balances,
                ranks,
                input_log_hash: [7u8; 32],
                replay_hash: [9u8; 32],
                ended_at: self.now(),
            }
            .data(),
        }
    }

    pub fn settle(&mut self, id: [u8; 32], players: &[&Player], balances: Vec<u32>, ranks: Vec<u8>) -> Res {
        let ix = self.ix_settle(id, players, balances, ranks);
        self.send_settle(ix)
    }

    pub fn send_settle(&mut self, ix: Instruction) -> Res {
        let op = self.operator.insecure_clone();
        let rs = self.result_signer.insecure_clone();
        self.send(&[ix], &op, &[&rs])
    }

    pub fn ix_cancel(&self, id: [u8; 32], players: &[&Player]) -> Instruction {
        let mut accounts = bump_arena::accounts::Cancel {
            operator: self.operator.pubkey(),
            config: self.config,
            match_account: self.pda_match(&id),
            vault: self.pda_vault(&id),
            token_program: token_program(),
        }
        .to_account_metas(None);
        for p in players {
            accounts.push(AccountMeta::new(p.ata, false));
        }
        Instruction { program_id: program_id(), accounts, data: bump_arena::instruction::Cancel { match_id: id }.data() }
    }

    pub fn cancel(&mut self, id: [u8; 32], players: &[&Player]) -> Res {
        let ix = self.ix_cancel(id, players);
        let op = self.operator.insecure_clone();
        self.send(&[ix], &op, &[])
    }

    pub fn ix_claim(&self, id: [u8; 32], p: &Player) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::ClaimRefund {
                config: self.config,
                match_account: self.pda_match(&id),
                vault: self.pda_vault(&id),
                player_token: p.ata,
                token_program: token_program(),
            }
            .to_account_metas(None),
            data: bump_arena::instruction::ClaimRefund { match_id: id, player: p.key() }.data(),
        }
    }

    pub fn claim(&mut self, id: [u8; 32], p: &Player) -> Res {
        let ix = self.ix_claim(id, p);
        let payer = Keypair::new();
        self.svm.airdrop(&payer.pubkey(), 1_000_000_000).unwrap();
        self.send(&[ix], &payer, &[])
    }

    pub fn ix_set_paused(&self, signer: &Pubkey, paused: bool) -> Instruction {
        Instruction {
            program_id: program_id(),
            accounts: bump_arena::accounts::SetPaused { admin: *signer, config: self.config }.to_account_metas(None),
            data: bump_arena::instruction::SetPaused { paused }.data(),
        }
    }

    pub fn set_paused(&mut self, paused: bool) -> Res {
        let ix = self.ix_set_paused(&self.admin.pubkey(), paused);
        let admin = self.admin.insecure_clone();
        self.send(&[ix], &admin, &[])
    }

    pub fn setup_match(&mut self, id: [u8; 32], max_players: u8, joiners: usize) -> Vec<Player> {
        ok(self.open(id, max_players));
        let stake = self.stake;
        let mut players = vec![];
        for i in 0..joiners {
            let p = self.new_player(stake * 3);
            ok(self.join(id, &p, (i % 7) as u8));
            players.push(p);
        }
        players
    }

    pub fn match_state(&self, id: &[u8; 32]) -> MatchView {
        let acc = self.svm.get_account(&self.pda_match(id)).expect("match missing");
        let d = &acc.data[8..];
        let status = d[32];
        let player_count = d[32 + 1 + 8 + 4 + 1];
        let refunded_off = 32 + 1 + 8 + 4 + 1 + 1 + 256 + 256 + 8;
        MatchView { status, player_count, refunded: d[refunded_off], len: acc.data.len(), lamports: acc.lamports }
    }

    pub fn total_tokens(&self, players: &[&Player], id: &[u8; 32]) -> u64 {
        let mut t = self.balance(&self.treasury) + self.balance(&self.pda_vault(id));
        for p in players {
            t += self.balance(&p.ata);
        }
        t
    }
}

pub struct MatchView {
    pub status: u8,
    pub player_count: u8,
    pub refunded: u8,
    pub len: usize,
    pub lamports: u64,
}

pub fn mid(n: u8) -> [u8; 32] {
    [n; 32]
}
