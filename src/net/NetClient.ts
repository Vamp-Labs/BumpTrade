import { Client, type InputHandle, type Room } from '@colyseus/sdk';
import {
  CLAIM_SEAT_MESSAGE,
  InputFrame,
  JOIN_INTENT_MESSAGE,
  MatchState,
  SOL_JOIN_PREPARE_MESSAGE,
  SOL_JOIN_SUBMIT_MESSAGE,
  type ClaimSeatMessage,
  type SolJoinPrepareMessage,
  type SolJoinSubmitMessage,
} from '@bump/shared';
import type { Hex } from 'viem';
import type { SignedJoin } from '../chain/evm/intent';
import { walletKey } from '../chain/format';
import { getActiveChain, type SessionKeyHandle } from '../chain/port';
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

export type EventVerdict = 'ignore' | 'take' | 'see';

interface EventWaiter {
  accept(event: ServerEvent): EventVerdict;
  resolve(event: ServerEvent): void;
  reject(error: Error): void;
  timer: number;
}

export class NetClient {
  private readonly waiters = new Set<EventWaiter>();
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
    this.client = new Client(getActiveChain().gameServerUrl);
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
      if (event && !this.dispatchWaiters(event)) this.handlers.onEvent(event);
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

  private dispatchWaiters(event: ServerEvent): boolean {
    let taken = false;
    for (const waiter of Array.from(this.waiters)) {
      const verdict = waiter.accept(event);
      if (verdict === 'ignore') continue;
      this.waiters.delete(waiter);
      window.clearTimeout(waiter.timer);
      waiter.resolve(event);
      if (verdict === 'take') {
        taken = true;
        break;
      }
    }
    return taken;
  }

  public awaitEvent(accept: (event: ServerEvent) => EventVerdict, timeoutMs: number): Promise<ServerEvent> {
    return new Promise((resolve, reject) => {
      const waiter: EventWaiter = {
        accept,
        resolve,
        reject,
        timer: window.setTimeout(() => {
          this.waiters.delete(waiter);
          reject(new Error('Timed out waiting for the arena server'));
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  private rejectWaiters(): void {
    for (const waiter of Array.from(this.waiters)) {
      window.clearTimeout(waiter.timer);
      waiter.reject(new Error('Connection to the arena closed'));
    }
    this.waiters.clear();
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

  public async claimSeat(wallet: string, sessionKey: SessionKeyHandle, matchId: string): Promise<void> {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    const issuedAt = Date.now();
    const signature = await sessionKey.signSeat(seatMessage({ matchId: matchId as Hex, wallet, roomId: room.roomId, issuedAt }));
    const payload: ClaimSeatMessage = {
      wallet: walletKey(wallet),
      sessionKey: sessionKey.publicId,
      issuedAt,
      signature,
      ...(sessionKey.scheme === 'ed25519' ? { scheme: 'ed25519' as const } : {}),
    };
    room.send(CLAIM_SEAT_MESSAGE, payload);
  }

  public sendJoin(signed: SignedJoin): void {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    room.send(JOIN_INTENT_MESSAGE, signed);
  }

  public sendSolJoinPrepare(message: SolJoinPrepareMessage): void {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    room.send(SOL_JOIN_PREPARE_MESSAGE, message);
  }

  public sendSolJoinSubmit(message: SolJoinSubmitMessage): void {
    const room = this.room;
    if (!room) throw new Error('Not connected to a room');
    room.send(SOL_JOIN_SUBMIT_MESSAGE, message);
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
    this.rejectWaiters();
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
