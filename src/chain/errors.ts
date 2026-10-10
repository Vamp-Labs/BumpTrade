import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem';

export type ChainErrorKind = 'rejected' | 'revert' | 'network' | 'other';

export interface ChainErrorInfo {
  kind: ChainErrorKind;
  message: string;
  errorName?: string;
}

const REVERT_COPY: Record<string, string> = {
  IntentExpired: 'Signature expired, sign again',
  BadSignature: 'Signature rejected, sign again',
  ERC20InsufficientBalance: 'Not enough BUMP, claim free BUMP first',
  ClaimCooldown: 'Already claimed today',
  JoinClosed: 'Join window closed',
  MatchFull: 'Match is full',
  AlreadyJoined: 'This wallet already joined the match',
  BadStatus: 'Match is not open for this action',
  BadVehicle: 'Unknown vehicle',
  ZeroSessionKey: 'Session key missing, retry',
  NotJoined: 'This wallet did not join the match',
  AlreadyRefunded: 'Stake already refunded',
  TooEarly: 'Too early',
  SettleWindowClosed: 'Settle window closed',
  NotEnoughPlayers: 'Not enough players',
  MatchExists: 'Match already exists',
  EnforcedPause: 'Arena is paused',
  NotOperator: 'Not allowed',
};

function readCode(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

export function describeChainError(error: unknown): ChainErrorInfo {
  if (error instanceof BaseError) {
    const rejected = error.walk((e) => e instanceof UserRejectedRequestError || readCode(e) === 4001);
    if (rejected) return { kind: 'rejected', message: 'Signature rejected in wallet' };

    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName ?? reverted.raw ?? '';
      const copy = REVERT_COPY[name];
      if (copy) return { kind: 'revert', message: copy, errorName: name };
      return { kind: 'revert', message: name ? `Contract reverted: ${name}` : 'Transaction would revert', errorName: name };
    }

    if (/network|fetch|timeout|HTTP request failed/i.test(error.message)) {
      return { kind: 'network', message: 'Network error, try again' };
    }
    return { kind: 'other', message: error.shortMessage };
  }
  if (readCode(error) === 4001) return { kind: 'rejected', message: 'Signature rejected in wallet' };
  if (error instanceof Error) return { kind: 'other', message: error.message };
  return { kind: 'other', message: 'Unknown error' };
}
