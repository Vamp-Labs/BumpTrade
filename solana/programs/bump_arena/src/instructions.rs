pub mod cancel;
pub mod claim_refund;
pub mod initialize;
pub mod join_match;
pub mod open_match;
pub mod set_paused;
pub mod settle;
pub mod start_match;

#[allow(ambiguous_glob_reexports)]
pub use cancel::*;
pub use claim_refund::*;
pub use initialize::*;
pub use join_match::*;
pub use open_match::*;
pub use set_paused::*;
pub use settle::*;
pub use start_match::*;

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::constants::MATCH_SEED;
use crate::error::BumpError;

pub fn pay_from_vault<'info>(
    vault: AccountInfo<'info>,
    destination: AccountInfo<'info>,
    match_account: AccountInfo<'info>,
    match_id: &[u8; 32],
    match_bump: u8,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let bump = [match_bump];
    let seeds: &[&[u8]] = &[MATCH_SEED, match_id.as_ref(), &bump];
    token::transfer(
        CpiContext::new_with_signer(
            Token::id(),
            Transfer { from: vault, to: destination, authority: match_account },
            &[seeds],
        ),
        amount,
    )
}

pub fn seat_token_account(info: &AccountInfo, owner: &Pubkey, mint: &Pubkey) -> Result<()> {
    require!(info.is_writable && info.owner == &Token::id(), BumpError::BadRemainingAccounts);
    let data = info.try_borrow_data()?;
    let account = TokenAccount::try_deserialize(&mut &data[..]).map_err(|_| error!(BumpError::BadRemainingAccounts))?;
    require_keys_eq!(account.owner, *owner, BumpError::BadRemainingAccounts);
    require_keys_eq!(account.mint, *mint, BumpError::BadRemainingAccounts);
    Ok(())
}
