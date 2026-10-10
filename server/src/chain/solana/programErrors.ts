const PROGRAM_ERRORS: Record<number, string> = {
  6000: "Paused",
  6001: "MatchNotOpen",
  6002: "MatchFull",
  6003: "JoinClosed",
  6004: "AlreadyJoined",
  6005: "NotEnoughPlayers",
  6006: "BadStatus",
  6007: "SettleWindowOver",
  6008: "SettleWindowOpen",
  6009: "LengthMismatch",
  6010: "NotZeroSum",
  6011: "BadRemainingAccounts",
  6012: "AlreadyRefunded",
  6013: "NotAPlayer",
  6014: "Unauthorized",
  6015: "BadRanks",
  6016: "BadVehicle",
  6017: "InvalidParams",
};

const TOKEN_ERRORS: Record<number, string> = {
  1: "InsufficientFunds",
};

interface ErrorLike {
  message?: unknown;
  context?: { code?: unknown };
  cause?: unknown;
}

export const programErrorName = (error: unknown): string | null => {
  let current: unknown = error;
  for (let depth = 0; depth < 8 && current; depth++) {
    const e = current as ErrorLike;
    const code = e.context?.code;
    if (typeof code === "number") {
      const name = PROGRAM_ERRORS[code] ?? TOKEN_ERRORS[code];
      if (name) return name;
    }
    const match =
      typeof e.message === "string"
        ? /custom program error: 0x([0-9a-fA-F]+)/.exec(e.message)
        : null;
    if (match) {
      const value = Number.parseInt(match[1] as string, 16);
      const name = PROGRAM_ERRORS[value] ?? TOKEN_ERRORS[value];
      if (name) return name;
    }
    current = e.cause;
  }
  return null;
};

export const wrapSendError = (error: unknown): Error => {
  const name = programErrorName(error);
  const first =
    error instanceof Error
      ? (error.message.split("\n")[0] ?? error.message)
      : String(error);
  return new Error(name ? `${name}: ${first}` : first, { cause: error });
};
