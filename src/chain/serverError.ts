const SERVER_ERROR_COPY: Record<string, string> = {
  COOLDOWN: 'Already claimed today',
  ClaimCooldown: 'Already claimed today',
  RATE_LIMITED: 'Too many requests from this network, try later',
  GLOBAL_LIMIT: 'Faucet is busy, try again later',
  RELAYER_LOW: 'Gas sponsor is low on funds, try again later',
  CHAIN_UNAVAILABLE: 'Chain unavailable, try again',
  CLAIM_FAILED: 'Claim failed, try again',
  INVALID_ADDRESS: 'Invalid wallet address',
  JOIN_MALFORMED: 'Join request was invalid, retry',
  BAD_SIGNATURE: 'Signature rejected, sign again',
  INTENT_EXPIRED: 'Signature expired, sign again',
  TX_EXPIRED: 'Transaction expired, sign again',
  TX_TAMPERED: 'The signed transaction did not match, sign again',
  WRONG_MATCH: 'Match changed, retry',
  MATCH_CLOSED: 'Join window closed',
  INSUFFICIENT_BALANCE: 'Not enough BUMP to stake',
  JOIN_PENDING: 'Join already in progress',
  JOIN_FAILED: 'Join failed, try again',
  ROOM_FULL: 'Match is full',
  SEAT_REJECTED: 'Seat claim rejected',
  NOT_JOINED: 'This wallet has not joined yet',
};

export function describeServerCode(code: string, fallback: string, retryAfterS?: number): string {
  const copy = SERVER_ERROR_COPY[code];
  if (!copy) return /RELAYER/i.test(code) ? SERVER_ERROR_COPY.RELAYER_LOW! : fallback || 'Request failed';
  if (code === 'RATE_LIMITED' && retryAfterS && retryAfterS > 0) {
    return `${copy} (${Math.ceil(retryAfterS / 60)} min)`;
  }
  return copy;
}

export class ServerJoinError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryAfterS?: number
  ) {
    super(message);
    this.name = 'ServerJoinError';
  }
}
