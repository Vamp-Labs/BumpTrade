import type { Address, Hex } from 'viem';
import { CHAIN_META } from '../meta';
import type {
  ChainErrorInfo,
  ChainWallet,
  ChainWalletState,
  ClientChain,
  JoinContext,
  SessionKeyHandle,
} from '../port';
import { isArenaConfigured, readMatch, readSessionKeyOf } from './arena';
import { describeChainError } from './errors';
import { signJoinIntent } from './intent';
import { clearSessionKey, createSessionKey, loadSessionKey, type SessionKey } from './sessionKey';
import { CLAIM_AMOUNT, DEFAULT_STAKE, isTokenConfigured, readNextClaimAt, readTokenBalance } from './token';
import { wallet, type WalletState } from './wallet';

const meta = CHAIN_META.evm;

function toState(state: WalletState): ChainWalletState {
  return {
    status: state.status,
    options: state.wallets.map((w) => ({ id: w.uuid, name: w.name, icon: w.icon })),
    selectedId: state.selected?.uuid ?? null,
    address: state.address,
    networkOk: wallet.isReady(),
    bumpBalance: state.bumpBalance,
    error: state.error,
  };
}

const evmWallet: ChainWallet = {
  discover: () => wallet.discover(),
  list: () => wallet.listWallets().map((w) => ({ id: w.uuid, name: w.name, icon: w.icon })),
  connect: async (id, silent = false) => {
    const target = wallet.listWallets().find((w) => w.uuid === id);
    if (target) await wallet.connect(target, silent);
  },
  disconnect: (forget = false) => wallet.disconnect(forget),
  subscribe: (listener) => wallet.subscribe((state) => listener(toState(state))),
  getState: () => toState(wallet.getState()),
  isReady: () => wallet.isReady(),
  refreshBalance: () => wallet.refreshBalance(),
  switchNetwork: () => wallet.switchToTarget(),
};

function handle(key: SessionKey): SessionKeyHandle {
  return {
    publicId: key.account.address,
    scheme: 'evm',
    signSeat: (text) => key.account.signMessage({ message: text }),
  };
}

async function join(ctx: JoinContext): Promise<void> {
  const client = wallet.getClient();
  const account = wallet.getState().address;
  if (!client || !account || !wallet.isReady()) throw new Error('Connect your wallet on the right network first');
  const matchId = ctx.matchId as Hex;
  const key = loadSessionKey(matchId) ?? createSessionKey(matchId);
  const signed = await signJoinIntent(client, account, matchId, key.account.address, ctx.vehicleId, ctx.joinDeadline);
  ctx.net.sendJoin(signed);
  ctx.onSigned?.();
}

function describeError(error: unknown): ChainErrorInfo {
  const info = describeChainError(error);
  return { kind: info.kind, message: info.message, code: info.errorName };
}

export const evmChain: ClientChain = {
  id: 'evm',
  label: meta.label,
  decimals: meta.decimals,
  gameServerUrl: meta.gameServerUrl,
  gameServerHttpUrl: meta.gameServerHttpUrl,
  leaderboardUrl: meta.leaderboardUrl,
  defaultStake: DEFAULT_STAKE,
  claimAmount: CLAIM_AMOUNT,
  wallet: evmWallet,
  isConfigured: isArenaConfigured,
  isTokenConfigured,
  join,
  readMatch: (matchId) => readMatch(matchId as Hex),
  readSessionKeyOf: async (matchId, player) => {
    const registered = await readSessionKeyOf(matchId as Hex, player as Address);
    return /^0x0{40}$/i.test(registered) ? null : registered;
  },
  tokenBalance: (account) => readTokenBalance(account as Address),
  nextClaimAtFallback: (account) => readNextClaimAt(account as Address),
  createSessionKey: (matchId) => handle(createSessionKey(matchId)),
  loadSessionKey: (matchId) => {
    const key = loadSessionKey(matchId);
    return key ? handle(key) : null;
  },
  clearSessionKey,
  describeError,
  formatAmount: meta.formatAmount,
  explorerTx: meta.explorerTx,
  explorerAddress: meta.explorerAddress,
};

