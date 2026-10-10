import { Client, type InputHandle, type Room } from '@colyseus/sdk';
import { CLAIM_SEAT_MESSAGE, InputFrame, JOIN_INTENT_MESSAGE, MatchState, type ClaimSeatMessage } from '@bump/shared';
import type { Address, Hex } from 'viem';
import type { SignedJoin } from '../chain/intent';
import type { SessionKey } from '../chain/sessionKey';
import { env } from '../config/env';
import type { EncodedInput } from './inputEncoder';
import {
  ROOM_NAME,
  TICK_RATE,
  normalizeEvent,
  readMatchView,
  seatMessage,
  type MatchView,
  type ServerEvent,
} from './protocol';

export interface NetHandlers {
  onState(view: MatchView): void;
  onEvent(event: ServerEvent): void;
  onDrop(): void;
  onReconnect(): void;
  onClose(code: number): void;
}

export class NetClient {
  private client: Client | null = null;
  private room: Room | null = null;
  private inputHandle: InputHandle<InputFrame> | null = null;
  private inputUnavailable = false;
  private lastTick = 0;
  private lastPatchAt = 0;
  private rttMs = 0;
  private patchCount = 0;
  private closed = false;
  private readonly handlers: NetHandlers;

  constructor(handlers: NetHandlers) {
    this.handlers = handlers;
  }

  public async connect(vehicleId: number): Promise<void> {
    this.closed = false;
    this.client = new Client(env.gameServerUrl);
    const room = await this.client.joinOrCreate(ROOM_NAME, { vehicleId }, MatchState);
    this.attach(room);
  }

  private attach(room: Room): void {
    this.room = room;
    this.inputHandle = null;
    room.onStateChange((state) => {
      const view = readMatchView(state);
      this.lastTick = view.tick;
      this.lastPatchAt = performance.now();
      this.patchCount += 1;
      this.handlers.onState(view);
    });
    room.onMessage('*', (type, payload) => {
      const event = normalizeEvent(type, payload);
      if (event) this.handlers.onEvent(event);
    });
    room.onDrop(() => this.handlers.onDrop());
    room.onReconnect(() => {
      this.inputHandle = null;
      this.handlers.onReconnect();
    });
    room.onLeave((code) => {
      if (this.room === room && !this.closed) this.handlers.onClose(code);
    });
    room.onError((code, message) => {
      this.handlers.onEvent({ t: 'error', code: 'CHAIN_UNAVAILABLE', message: message ?? `Connection error ${code}` });
    });
  }

  public getRoomId(): string {
    return this.room?.roomId ?? '';
  }

  public isConnected(): boolean {
    return this.room !== null && !this.closed;
  }

  public getRttMs(): number {
    return this.rttMs;
  }

  public getPatchCount(): number {
    return this.patchCount;
  }

  public measureRtt(): void {
    this.room?.ping((ms) => {
      this.rttMs = ms;
    });
  }

  public async claimSeat(wallet: Address, sessionKey: SessionKey, matchId: string): Promise<void> {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    const issuedAt = Date.now();
    const signature = await sessionKey.account.signMessage({
      message: seatMessage({ matchId: matchId as Hex, wallet, roomId: room.roomId, issuedAt }),
    });
    const payload: ClaimSeatMessage = {
      wallet: wallet.toLowerCase() as Address,
      sessionKey: sessionKey.account.address,
      issuedAt,
      signature,
    };
    room.send(CLAIM_SEAT_MESSAGE, payload);
  }

  public sendJoin(signed: SignedJoin): void {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    room.send(JOIN_INTENT_MESSAGE, signed);
  }

  public estimateTick(): number {
    const elapsedMs = performance.now() - this.lastPatchAt;
    return this.lastTick + Math.max(0, Math.round((elapsedMs / 1000) * TICK_RATE));
  }

  public sendInput(payload: EncodedInput): void {
    const room = this.room;
    if (!room || this.closed) return;
    if (!this.inputUnavailable) {
      try {
        this.inputHandle ??= room.input<InputFrame>({ type: InputFrame, mode: 'reliable' });
        const data = this.inputHandle.data;
        data.tick = payload.tick;
        data.throttle = payload.throttle;
        data.steer = payload.steer;
        data.buttons = payload.buttons;
        this.inputHandle.send();
        return;
      } catch {
        this.inputUnavailable = true;
        this.inputHandle = null;
      }
    }
    room.send('input', payload);
  }

  public async leave(): Promise<void> {
    this.closed = true;
    const room = this.room;
    this.room = null;
    this.inputHandle = null;
    if (room) {
      try {
        await room.leave(true);
      } catch {
        return;
      }
    }
  }
}
