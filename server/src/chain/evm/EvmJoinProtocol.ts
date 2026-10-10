import {
  buildDomain,
  type Hex32,
  JOIN_INTENT_TYPES,
  type JoinIntentMessage,
  toTypedJoinIntent,
  VEHICLE_COUNT,
} from "@bump/shared";
import {
  type Address,
  getAddress,
  type Hex,
  isAddress,
  recoverTypedDataAddress,
} from "viem";
import type {
  JoinCheck,
  JoinProtocol,
  JoinRejection,
} from "../../relay/JoinRelay";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const isHex = (value: unknown, length?: number): value is Hex =>
  typeof value === "string" &&
  /^0x[0-9a-fA-F]*$/.test(value) &&
  (length === undefined || value.length === length);

export const parseJoinMessage = (raw: unknown): JoinIntentMessage | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const i = m.intent;
  if (typeof i !== "object" || i === null || !isHex(m.signature)) return null;
  const intent = i as Record<string, unknown>;
  if (
    !isHex(intent.matchId, 66) ||
    !isAddress(intent.player as string) ||
    !isAddress(intent.sessionKey as string) ||
    typeof intent.vehicleId !== "number" ||
    !Number.isInteger(intent.vehicleId) ||
    typeof intent.deadline !== "string" ||
    !/^[0-9]{1,20}$/.test(intent.deadline)
  ) {
    return null;
  }
  return {
    intent: {
      matchId: intent.matchId,
      player: intent.player as Address,
      sessionKey: intent.sessionKey as Address,
      vehicleId: intent.vehicleId,
      deadline: intent.deadline,
    },
    signature: m.signature,
  };
};

const reject = (
  code: JoinRejection["code"],
  message: string,
  retryAfterS?: number,
): JoinCheck => ({ ok: false, code, message, retryAfterS });

export interface EvmJoinChain {
  readonly arenaAddress: Address;
  readonly evmChainId: number;
  joinWithSig(
    intent: ReturnType<typeof toTypedJoinIntent>,
    signature: Hex,
  ): Promise<Hex>;
}

export class EvmJoinProtocol implements JoinProtocol {
  constructor(private readonly chain: EvmJoinChain) {}

  async verify(raw: unknown, matchId: Hex32, nowS: number): Promise<JoinCheck> {
    const message = parseJoinMessage(raw);
    if (!message) return reject("JOIN_MALFORMED", "malformed join intent");
    const { intent, signature } = message;

    if (intent.matchId.toLowerCase() !== matchId.toLowerCase()) {
      return reject("WRONG_MATCH", "intent is for another match");
    }
    if (intent.vehicleId < 0 || intent.vehicleId >= VEHICLE_COUNT) {
      return reject("JOIN_MALFORMED", "unknown vehicle");
    }
    if (intent.sessionKey.toLowerCase() === ZERO_ADDRESS) {
      return reject("JOIN_MALFORMED", "session key is empty");
    }
    const typed = toTypedJoinIntent(intent);
    if (typed.deadline < BigInt(nowS)) {
      return reject("INTENT_EXPIRED", "join intent has expired");
    }

    let signer: Address;
    try {
      signer = await recoverTypedDataAddress({
        domain: buildDomain(this.chain.arenaAddress, this.chain.evmChainId),
        types: JOIN_INTENT_TYPES,
        primaryType: "JoinIntent",
        message: typed,
        signature,
      });
    } catch {
      return reject("BAD_SIGNATURE", "signature is invalid");
    }
    if (signer.toLowerCase() !== intent.player.toLowerCase()) {
      return reject("BAD_SIGNATURE", "signature is not from the player");
    }

    const player = getAddress(intent.player);
    return {
      ok: true,
      request: {
        wallet: player,
        key: player.toLowerCase(),
        send: () => this.chain.joinWithSig(typed, signature),
      },
    };
  }

  mapSendError(text: string): JoinRejection {
    if (text.includes("IntentExpired")) {
      return {
        code: "INTENT_EXPIRED",
        message: "join intent has expired",
      };
    }
    if (text.includes("AlreadyJoined")) {
      return {
        code: "ALREADY_JOINED",
        message: "wallet already joined this match",
      };
    }
    if (text.includes("MatchFull")) {
      return { code: "ROOM_FULL", message: "match is full" };
    }
    if (text.includes("JoinClosed")) {
      return { code: "MATCH_CLOSED", message: "join window has closed" };
    }
    if (text.includes("ERC20InsufficientBalance")) {
      return {
        code: "INSUFFICIENT_BALANCE",
        message: "not enough BUMP for the stake",
      };
    }
    return {
      code: "JOIN_FAILED",
      message: "join transaction failed",
      retryAfterS: 5,
    };
  }
}
