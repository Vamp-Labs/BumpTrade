import { CHAIN_META } from '../meta';
import type { ClientChain } from '../port';
import { describeSolError } from './errors';
import { joinSolana } from './join';
import { isSolConfigured, isSolTokenConfigured, readMatch, readSessionKeyOf, readTokenBalance } from './rpc';
import { clearSessionKey, createSessionKey, loadSessionKey } from './sessionKey';
import { solWallet } from './wallet';

const meta = CHAIN_META.solana;
const UNIT = 10n ** BigInt(meta.decimals);

export const solanaChain: ClientChain = {
  id: 'solana',
  label: meta.label,
  decimals: meta.decimals,
  gameServerUrl: meta.gameServerUrl,
  gameServerHttpUrl: meta.gameServerHttpUrl,
  leaderboardUrl: meta.leaderboardUrl,
  defaultStake: 100n * UNIT,
  claimAmount: 1000n * UNIT,
  wallet: solWallet,
  isConfigured: isSolConfigured,
  isTokenConfigured: isSolTokenConfigured,
  join: joinSolana,
  readMatch,
  readSessionKeyOf,
  tokenBalance: readTokenBalance,
  nextClaimAtFallback: async () => 0,
  createSessionKey,
  loadSessionKey,
  clearSessionKey,
  describeError: describeSolError,
  formatAmount: meta.formatAmount,
  explorerTx: meta.explorerTx,
  explorerAddress: meta.explorerAddress,
};
