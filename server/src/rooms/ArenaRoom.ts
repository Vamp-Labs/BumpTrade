import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  Car,
  CarFlag,
  CarState,
  CLAIM_SEAT_MESSAGE,
  type ClaimSeatMessage,
  COUNTDOWN_TICKS,
  Crate,
  computePayouts,
  type ErrorCode,
  EVENT_CHANNEL,
  INPUT_BUTTON_MASK,
  InputFrame,
  JOIN_INTENT_MESSAGE,
  MatchSim,
  MatchState,
  PATCH_RATE_MS,
  Phase,
  PowerUpKind,
  type SeatScheme,
  type ServerEvent,
  type SettlementStatus,
  type SimEvent,
  SPAWN_SLOTS,
  seatMessage,
  secondsToTicks,
  TICK_HZ,
  type Hex32,
  type VehicleInput,
  type WalletId,
} from "@bump/shared";
import { type Client, Room } from "colyseus";
import { type Hex, keccak256, toBytes } from "viem";
import { type ChainResult, MatchStatus } from "../chain/ArenaChain";
import { sameSessionKey, verifySeatProof } from "../chain/seatProof";
import { InputLog, type SeatInput } from "../log/InputLog";
import { RoomMetrics } from "../metrics";
import { getRoomContext, type RoomContext } from "./context";

const ZERO_HASH: Hex32 = `0x${"0".repeat(64)}`;
const FRESHNESS_MS = 60_000;
const SESSION_KEY_ATTEMPTS = 8;
const LOBBY_LINGER_MS = 5_000;
const END_LINGER_MS = 20_000;

const clampInt = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));

const isHexString = (value: unknown, length?: number): value is Hex =>
  typeof value === "string" &&
  /^0x[0-9a-fA-F]*$/.test(value) &&
  (length === undefined || value.length === length);

const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max;

const parseClaim = (
  message: unknown,
): (ClaimSeatMessage & { scheme: SeatScheme }) | null => {
  if (typeof message !== "object" || message === null) return null;
  const m = message as Record<string, unknown>;
  const scheme = m.scheme ?? "evm";
  if (typeof m.issuedAt !== "number" || !Number.isFinite(m.issuedAt))
    return null;
  if (scheme === "evm") {
    if (
      !isHexString(m.wallet, 42) ||
      !isHexString(m.sessionKey, 42) ||
      !isHexString(m.signature)
    ) {
      return null;
    }
  } else if (scheme === "ed25519") {
    if (
      !isText(m.wallet, 64) ||
      !isText(m.sessionKey, 64) ||
      !isText(m.signature, 128)
    ) {
      return null;
    }
  } else {
    return null;
  }
  return {
    wallet: m.wallet,
    sessionKey: m.sessionKey,
    issuedAt: m.issuedAt,
    signature: m.signature,
    scheme,
  };
};

export class ArenaRoom extends Room<{ state: MatchState; input: InputFrame }> {
  maxClients = 16;
  patchRate = PATCH_RATE_MS;
  state = new MatchState();

  inputs = this.defineInput(InputFrame, {
    bufferMaxSize: 32,
    idle: true,
    sanitize: (frame) => {
      frame.throttle = clampInt(frame.throttle, -100, 100);
      frame.steer = clampInt(frame.steer, -100, 100);
      frame.buttons = frame.buttons & INPUT_BUTTON_MASK;
    },
  });

  private ctx!: RoomContext;
  private matchId: Hex32 = ZERO_HASH;
  private seed: Hex = ZERO_HASH;
  private busy = false;
  private joinsInFlight = 0;
  private cancelled = false;
  private readonly bindings = new Map<string, string>();
  private readonly sessionByWallet = new Map<string, string>();
  private readonly claimed = new Map<
    string,
    { seat: number; vehicle: number }
  >();
  private readonly usedSignatures = new Set<string>();
  private chainPlayers: WalletId[] = [];
  private walletBySeat: string[] = [];
  private sim: MatchSim | null = null;
  private inputLog: InputLog | null = null;
  private liveStartTick = 0;
  private lastSettlement: ServerEvent | null = null;
  private metrics: RoomMetrics | null = null;
  private vehicleIds: number[] = [];
  private endedAtMs = 0;

  onAuth(_client: Client, _options: unknown, context: { ip?: string }) {
    return { ip: context.ip ?? "unknown" };
  }

  async onCreate(): Promise<void> {
    this.ctx = getRoomContext();
    const { config, chain } = this.ctx;

    this.matchId = `0x${randomBytes(32).toString("hex")}`;
    this.seed = `0x${randomBytes(32).toString("hex")}`;
    const joinDeadline = BigInt(
      Math.floor(this.ctx.now() / 1000) + config.joinWindowS,
    );

    this.state.matchId = this.matchId;
    this.state.phase = Phase.LOBBY;
    this.state.stakeWei = config.stakeAmount.toString();
    this.state.startBalance = config.startBalance;
    this.state.joinDeadline = Number(joinDeadline);

    await chain.openMatch({
      matchId: this.matchId,
      stake: config.stakeAmount,
      maxPlayers: config.maxPlayers,
      startBalance: config.startBalance,
      joinDeadline,
    });
    this.lastSettlement = {
      t: "settlement",
      matchId: this.matchId,
      status: "opened",
    };
    try {
      const view = await chain.getMatch(this.matchId);
      await this.ctx.keeper.track(this.matchId, view.settleDeadline);
    } catch (error) {
      this.ctx.log({ evt: "keeper_track_failed", error: String(error) });
    }
    this.ctx.stats.rooms += 1;
    this.metrics = new RoomMetrics(this.roomId, () => this.state.phase);
    this.ctx.metrics.register(this.metrics);
    this.clock.setInterval(() => {
      this.ctx.log({
        evt: "tick_stats",
        matchId: this.matchId,
        ...this.metrics?.snapshot(),
      });
    }, 10_000);
    this.ctx.log({
      evt: "room_open",
      matchId: this.matchId,
      roomId: this.roomId,
    });

    this.onMessage(JOIN_INTENT_MESSAGE, (client, message) => {
      void this.handleJoin(client, message);
    });
    this.onMessage(CLAIM_SEAT_MESSAGE, (client, message) => {
      void this.handleClaim(client, message);
    });
    this.setFixedTimestep((step) => {
      const started = performance.now();
      this.step(step.tick);
      this.metrics?.record(performance.now() - started);
    }, TICK_HZ);
  }

  onJoin(client: Client): void {
    this.state.lobby = this.clients.length;
    if (this.lastSettlement) this.sendEvent(client, this.lastSettlement);
  }

  onDrop(client: Client): void {
    const wallet = this.bindings.get(client.sessionId);
    if (!wallet) return;
    this.setWalletConnected(wallet, false);
    void this.allowReconnection(client, 10);
  }

  onReconnect(client: Client): void {
    const wallet = this.bindings.get(client.sessionId);
    if (wallet) this.setWalletConnected(wallet, true);
  }

  onLeave(client: Client): void {
    const wallet = this.bindings.get(client.sessionId);
    this.bindings.delete(client.sessionId);
    if (wallet) {
      if (this.sessionByWallet.get(wallet) === client.sessionId) {
        this.sessionByWallet.delete(wallet);
      }
      this.setWalletConnected(wallet, false);
    }
    this.state.lobby = this.clients.length;
  }

  onDispose(): void {
    this.sim?.dispose();
    this.sim = null;
    this.ctx.metrics.unregister(this.roomId);
    this.ctx.stats.rooms = Math.max(0, this.ctx.stats.rooms - 1);
  }

  private broadcastEvent(event: ServerEvent): void {
    this.broadcast(EVENT_CHANNEL, event);
  }

  private sendEvent(client: Client, event: ServerEvent): void {
    client.send(EVENT_CHANNEL, event);
  }

  private sendError(client: Client, code: ErrorCode, message: string): void {
    this.sendEvent(client, { t: "error", code, message });
  }

  private setPhase(phase: number): void {
    this.state.phase = phase;
    this.broadcastEvent({ t: "phase", phase, tick: this.state.tick });
  }

  private announceSettlement(
    status: SettlementStatus,
    txHash?: string,
    error?: string,
  ): void {
    const event: ServerEvent = {
      t: "settlement",
      matchId: this.matchId,
      status,
      txHash,
      error,
    };
    this.lastSettlement = event;
    this.broadcastEvent(event);
  }

  private setWalletConnected(wallet: string, connected: boolean): void {
    const car = this.state.cars.get(wallet);
    if (car) car.connected = connected;
    const seat = this.claimed.get(wallet)?.seat;
    if (seat !== undefined) this.sim?.setConnected(seat, connected);
  }

  private async handleJoin(client: Client, raw: unknown): Promise<void> {
    if (this.state.phase !== Phase.LOBBY || this.cancelled || this.busy) {
      this.sendError(client, "MATCH_CLOSED", "match is not accepting joins");
      return;
    }
    const auth = client.auth as { ip?: string } | undefined;
    this.joinsInFlight += 1;
    try {
      const outcome = await this.ctx.joinRelay.submit(
        raw,
        this.matchId,
        auth?.ip ?? "unknown",
      );
      if (outcome.ok) {
        this.sendEvent(client, {
          t: "joinResult",
          matchId: this.matchId,
          wallet: outcome.wallet,
          seat: outcome.seat,
          txHash: outcome.txHash,
        });
      } else {
        this.sendEvent(client, {
          t: "error",
          code: outcome.code,
          message: outcome.message,
          retryAfterS: outcome.retryAfterS,
        });
      }
    } catch (error) {
      this.ctx.log({ evt: "join_error", error: String(error) });
      this.sendError(client, "JOIN_FAILED", "join failed");
    } finally {
      this.joinsInFlight -= 1;
    }
  }

  private async handleClaim(client: Client, raw: unknown): Promise<void> {
    const claim = parseClaim(raw);
    if (!claim) {
      this.sendError(client, "SEAT_REJECTED", "malformed claim");
      return;
    }
    if (this.state.phase >= Phase.ENDED) {
      this.sendError(client, "SEAT_REJECTED", "match is over");
      return;
    }
    if (Math.abs(this.ctx.now() - claim.issuedAt) > FRESHNESS_MS) {
      this.sendError(client, "STALE_AUTH", "claim is too old");
      return;
    }
    const expectedScheme: SeatScheme =
      this.ctx.chain.id === "evm" ? "evm" : "ed25519";
    if (claim.scheme !== expectedScheme) {
      this.sendError(client, "SEAT_REJECTED", "unsupported seat scheme");
      return;
    }
    const signatureKey =
      claim.scheme === "evm" ? claim.signature.toLowerCase() : claim.signature;
    if (this.usedSignatures.has(signatureKey)) {
      this.sendError(client, "STALE_AUTH", "signature already used");
      return;
    }

    const wallet = this.ctx.chain.walletKey(claim.wallet);
    const alreadySeated = this.claimed.has(wallet);
    if (!alreadySeated && this.claimed.size >= this.ctx.config.maxPlayers) {
      this.sendError(client, "ROOM_FULL", "all seats are claimed");
      return;
    }

    try {
      const proven = await verifySeatProof(claim.scheme, {
        message: seatMessage({
          matchId: this.matchId,
          wallet: claim.wallet,
          roomId: this.roomId,
          issuedAt: claim.issuedAt,
        }),
        signature: claim.signature,
        sessionKey: claim.sessionKey,
      });
      if (!proven) {
        this.sendError(
          client,
          "SEAT_REJECTED",
          "signature does not match the session key",
        );
        return;
      }

      const onChainKey = await this.readSessionKey(claim.wallet);
      if (onChainKey === null) {
        this.sendError(
          client,
          "NOT_JOINED",
          "wallet has not joined this match on chain",
        );
        return;
      }
      if (!sameSessionKey(claim.scheme, onChainKey, claim.sessionKey)) {
        this.sendError(
          client,
          "SEAT_REJECTED",
          "session key is not the registered key",
        );
        return;
      }

      const players = await this.ctx.chain.getPlayers(this.matchId);
      const seat = players.findIndex(
        (player) => this.ctx.chain.walletKey(player) === wallet,
      );
      if (seat < 0) {
        this.sendError(
          client,
          "NOT_JOINED",
          "wallet is not a player of this match",
        );
        return;
      }
      const vehicle = await this.ctx.chain.vehicleOf(
        this.matchId,
        claim.wallet,
      );

      this.usedSignatures.add(signatureKey);
      this.bindSeat(client, wallet, seat, vehicle);
    } catch (error) {
      this.ctx.log({ evt: "claim_failed", error: String(error) });
      this.sendError(
        client,
        "CHAIN_UNAVAILABLE",
        "could not verify the seat on chain",
      );
    }
  }

  private async readSessionKey(wallet: WalletId): Promise<string | null> {
    let key: string | null = null;
    for (let attempt = 0; attempt < SESSION_KEY_ATTEMPTS; attempt++) {
      key = await this.ctx.chain.sessionKeyOf(this.matchId, wallet);
      if (key !== null) return key;
      await new Promise((resolve) =>
        setTimeout(resolve, this.ctx.receiptRetryDelayMs),
      );
    }
    return key;
  }

  private bindSeat(
    client: Client,
    wallet: string,
    seat: number,
    vehicle: number,
  ): void {
    const previous = this.sessionByWallet.get(wallet);
    if (previous && previous !== client.sessionId)
      this.bindings.delete(previous);
    this.bindings.set(client.sessionId, wallet);
    this.sessionByWallet.set(wallet, client.sessionId);

    const isNew = !this.claimed.has(wallet);
    this.claimed.set(wallet, { seat, vehicle });

    if (!this.state.cars.has(wallet)) {
      this.state.cars.set(wallet, this.makeCar(wallet, seat, vehicle, true));
    }
    this.setWalletConnected(wallet, true);

    if (isNew) {
      this.broadcastEvent({
        t: "seat",
        wallet,
        seat,
        vehicle,
      });
      if (
        this.claimed.size >= this.ctx.config.minPlayers &&
        this.state.fillEndsAt === 0
      ) {
        this.state.fillEndsAt =
          Math.floor(this.ctx.now() / 1000) + this.ctx.config.fillTimerS;
      }
    } else {
      this.sendEvent(client, {
        t: "seat",
        wallet,
        seat,
        vehicle,
      });
    }
  }

  private makeCar(
    wallet: string,
    seat: number,
    vehicle: number,
    connected: boolean,
  ): Car {
    const car = new Car();
    const slot = SPAWN_SLOTS[seat];
    car.wallet = wallet;
    car.seat = seat;
    car.vehicle = vehicle;
    car.connected = connected;
    car.balance = this.ctx.config.startBalance;
    car.state = CarState.ALIVE;
    car.boost = 100;
    if (slot) {
      car.px = slot.x;
      car.py = slot.y;
      car.pz = slot.z;
      car.qy = Math.sin(slot.rotY / 2);
      car.qw = Math.cos(slot.rotY / 2);
    } else {
      car.qw = 1;
    }
    return car;
  }

  private step(tick: number): void {
    this.state.tick = tick;
    switch (this.state.phase) {
      case Phase.LOBBY:
        this.lobbyStep();
        break;
      case Phase.COUNTDOWN:
        if (tick >= this.liveStartTick) {
          this.drainStaleInputs();
          this.setPhase(Phase.LIVE);
          this.liveStep();
        }
        break;
      case Phase.LIVE:
        this.liveStep();
        break;
      default:
        break;
    }
  }

  private lobbyStep(): void {
    if (this.busy || this.cancelled || this.joinsInFlight > 0) return;
    const nowS = Math.floor(this.ctx.now() / 1000);
    const seated = this.claimed.size;
    const { minPlayers, maxPlayers } = this.ctx.config;

    if (
      seated >= minPlayers &&
      (seated >= maxPlayers || nowS >= this.state.fillEndsAt)
    ) {
      this.runExclusive(() => this.beginMatch());
    } else if (nowS > this.state.joinDeadline) {
      this.runExclusive(() => this.joinWindowClosed());
    }
  }

  private runExclusive(task: () => Promise<void>): void {
    this.busy = true;
    task()
      .catch((error: unknown) => {
        this.ctx.log({ evt: "transition_failed", error: String(error) });
      })
      .finally(() => {
        this.busy = false;
      });
  }

  private async joinWindowClosed(): Promise<void> {
    const players = await this.ctx.chain.getPlayers(this.matchId);
    if (players.length >= this.ctx.config.minPlayers) {
      await this.beginMatch();
      return;
    }
    await this.ctx.chain.cancel(this.matchId);
    this.cancelled = true;
    void this.ctx.keeper.forget(this.matchId);
    this.setPhase(Phase.CANCELLED);
    this.announceSettlement("cancelled");
    this.clock.setTimeout(() => void this.disconnect(), LOBBY_LINGER_MS);
  }

  private async beginMatch(): Promise<void> {
    const { chain, config } = this.ctx;
    const view = await chain.getMatch(this.matchId);
    if (view.status === MatchStatus.Open) {
      await chain.startMatch(this.matchId);
    }
    this.announceSettlement("started");

    const players = await chain.getPlayers(this.matchId);
    const vehicles = await Promise.all(
      players.map((player) => chain.vehicleOf(this.matchId, player)),
    );
    this.chainPlayers = players;
    this.vehicleIds = vehicles;
    this.walletBySeat = players.map((player) => chain.walletKey(player));

    players.forEach((player, seat) => {
      const wallet = chain.walletKey(player);
      const vehicle = vehicles[seat] ?? 0;
      if (!this.state.cars.has(wallet)) {
        this.state.cars.set(wallet, this.makeCar(wallet, seat, vehicle, false));
      }
    });

    const seedNumber = Number.parseInt(this.seed.slice(2, 10), 16);
    const durationTicks = secondsToTicks(config.matchDurationS);
    this.sim = await MatchSim.create({
      playerCount: players.length,
      startBalance: config.startBalance,
      vehicleIds: vehicles,
      seed: seedNumber,
      durationTicks,
      strict: false,
      onViolation: (sum, expected, tick) => {
        this.ctx.log({
          evt: "ZERO_SUM_VIOLATION",
          matchId: this.matchId,
          sum,
          expected,
          tick,
        });
      },
    });
    this.inputLog = new InputLog(players.length);

    this.liveStartTick = this.state.tick + COUNTDOWN_TICKS;
    this.state.liveStartTick = this.liveStartTick;
    this.state.endsAtTick = this.liveStartTick + durationTicks;
    void this.lock();
    this.setPhase(Phase.COUNTDOWN);
    this.broadcastEvent({
      t: "matchStart",
      matchId: this.matchId,
      liveStartTick: this.liveStartTick,
      durationTicks,
      seed: this.seed,
      rapier: "0.21.0",
      serverBuild: config.serverBuild,
    });
    this.flushSim(this.sim);
    this.ctx.log({
      evt: "match_start",
      matchId: this.matchId,
      players: players.length,
    });
  }

  private liveStep(): void {
    const sim = this.sim;
    const log = this.inputLog;
    if (!sim || !log || sim.over) return;

    const logged: Array<SeatInput | null> = [];
    const driven: Array<VehicleInput | null> = [];
    for (let seat = 0; seat < sim.cars.length; seat++) {
      const wallet = this.walletBySeat[seat];
      const sessionId = wallet ? this.sessionByWallet.get(wallet) : undefined;
      if (!sessionId) {
        logged.push(null);
        driven.push(null);
        continue;
      }
      const frame = this.inputs.get(sessionId).next();
      const throttle = clampInt(frame.throttle, -100, 100);
      const steer = clampInt(frame.steer, -100, 100);
      const buttons = frame.buttons & INPUT_BUTTON_MASK;
      logged.push({ throttle, steer, buttons });
      driven.push({
        throttle: throttle / 100,
        steer: steer / 100,
        brake: (buttons & 1) !== 0,
        boost: (buttons & 2) !== 0,
        handbrake: (buttons & 4) !== 0,
      });
    }

    log.recordTick(sim.tick, logged);
    sim.step(driven);
    this.flushSim(sim);

    if (sim.over) {
      this.runExclusive(() => this.finishMatch(sim, log));
    }
  }

  private drainStaleInputs(): void {
    for (const sessionId of this.sessionByWallet.values()) {
      this.inputs.get(sessionId).clear();
    }
  }

  private wallet(seat: number): string {
    return this.walletBySeat[seat] ?? "";
  }

  private flushSim(sim: MatchSim): void {
    for (const event of sim.drainEvents()) this.relaySimEvent(event);
    this.syncCars(sim);
    this.state.marketEvent = sim.marketEvent;
    this.state.eventEndsAtTick = this.liveStartTick + sim.eventEndsAtTick;
  }

  private relaySimEvent(event: SimEvent): void {
    const tick = this.liveStartTick + event.tick;
    switch (event.t) {
      case "bump":
        this.broadcastEvent({
          t: "bump",
          tick,
          kind: event.kind,
          attacker: this.wallet(event.attackerSeat),
          victim: event.victimSeat < 0 ? "wall" : this.wallet(event.victimSeat),
          amount: event.amount,
          tier: event.tier,
          skills: event.skills,
          x: event.x,
          z: event.z,
          nx: event.nx,
          nz: event.nz,
        });
        break;
      case "eliminate":
        this.broadcastEvent({
          t: "eliminate",
          tick,
          car: this.wallet(event.seat),
          by: event.bySeat === null ? null : this.wallet(event.bySeat),
          cause: event.cause,
          redistributed: event.redistributed.map(([seat, amount]) => [
            this.wallet(seat),
            amount,
          ]),
        });
        break;
      case "marketEvent":
        this.broadcastEvent({
          t: "marketEvent",
          tick,
          kind: event.kind,
          title: event.title,
          durationTicks: event.durationTicks,
        });
        break;
      case "crateSpawn": {
        const crate = new Crate();
        crate.id = event.id;
        crate.kind = event.kind;
        crate.x = event.x;
        crate.z = event.z;
        this.state.crates.set(String(event.id), crate);
        this.broadcastEvent({
          t: "crateSpawn",
          tick,
          id: event.id,
          kind: event.kind,
          x: event.x,
          z: event.z,
        });
        break;
      }
      case "crateTaken":
        this.state.crates.delete(String(event.id));
        this.broadcastEvent({
          t: "crateTaken",
          tick,
          id: event.id,
          car: this.wallet(event.seat),
          kind: event.kind,
        });
        break;
    }
  }

  private syncCars(sim: MatchSim): void {
    for (const simCar of sim.cars) {
      const car = this.state.cars.get(this.wallet(simCar.seat));
      if (!car) continue;
      const t = simCar.body.translation();
      const r = simCar.body.rotation();
      const v = simCar.body.linvel();
      const w = simCar.body.angvel();
      car.px = t.x;
      car.py = t.y;
      car.pz = t.z;
      car.qx = r.x;
      car.qy = r.y;
      car.qz = r.z;
      car.qw = r.w;
      car.vx = v.x;
      car.vy = v.y;
      car.vz = v.z;
      car.wx = w.x;
      car.wy = w.y;
      car.wz = w.z;
      car.boost = Math.round(simCar.boost.fuel * 100);
      car.balance = sim.economy.balanceOf(simCar.seat);

      let flags = 0;
      if (simCar.boost.active) flags |= CarFlag.BOOSTING;
      if (simCar.drive.kin.isDrifting) flags |= CarFlag.DRIFTING;
      if (simCar.hasPowerUp(PowerUpKind.SHIELD)) flags |= CarFlag.SHIELD;
      if (simCar.hasPowerUp(PowerUpKind.HEAVY_HIT)) flags |= CarFlag.HEAVY_HIT;
      if (simCar.hasPowerUp(PowerUpKind.CASH_MAGNET)) flags |= CarFlag.MAGNET;
      if (simCar.hasPowerUp(PowerUpKind.TURBO)) flags |= CarFlag.TURBO;
      const eliminated = sim.economy.isEliminated(simCar.seat);
      const critical = sim.isCritical(simCar.seat);
      if (critical) flags |= CarFlag.CRITICAL;
      if (eliminated) flags |= CarFlag.ELIMINATED;
      car.flags = flags;

      let powerUp = 0;
      let powerUpTicks = 0;
      for (const [kind, ticks] of simCar.powerUps) {
        powerUp = kind;
        powerUpTicks = ticks;
        break;
      }
      car.powerUp = powerUp;
      car.powerUpMs = Math.min(
        65535,
        Math.round((powerUpTicks * 1000) / TICK_HZ),
      );

      if (eliminated) car.state = CarState.ELIMINATED;
      else if (!simCar.connected) car.state = CarState.DISCONNECTED;
      else if (critical) car.state = CarState.CRITICAL;
      else car.state = CarState.ALIVE;
    }
  }

  private async writeReplay(log: InputLog): Promise<Hex> {
    const { config } = this.ctx;
    const replay = JSON.stringify({
      matchId: this.matchId,
      seed: this.seed,
      rapier: "0.21.0",
      serverBuild: config.serverBuild,
      startBalance: config.startBalance,
      players: this.walletBySeat,
      vehicles: this.vehicleIds,
      inputLogBase64: Buffer.from(log.toBytes()).toString("base64"),
    });
    try {
      const dir = join(config.replayDir, "replays");
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, `${this.matchId}.json`), replay, "utf8");
      return keccak256(toBytes(replay));
    } catch (error) {
      this.ctx.log({ evt: "replay_write_failed", error: String(error) });
      return ZERO_HASH;
    }
  }

  private async finishMatch(sim: MatchSim, log: InputLog): Promise<void> {
    this.setPhase(Phase.ENDED);
    const outcome = sim.outcome();
    const { config, chain, settler } = this.ctx;

    const result: ChainResult = {
      matchId: this.matchId,
      players: this.chainPlayers,
      finalBalances: outcome.finalBalances,
      ranks: outcome.ranks,
      inputLogHash: log.hash(),
      replayHash: await this.writeReplay(log),
      endedAt: BigInt(Math.floor(this.ctx.now() / 1000)),
    };
    this.endedAtMs = this.ctx.now();
    const signature = await chain.signResult(result);
    const payouts = computePayouts(
      config.stakeAmount,
      config.startBalance,
      outcome.finalBalances,
    );

    const ranking = this.walletBySeat
      .map((wallet, seat) => ({
        wallet,
        finalBalance: outcome.finalBalances[seat] ?? 0,
        rank: outcome.ranks[seat] ?? 0,
        payoutWei: (payouts.payouts[seat] ?? 0n).toString(),
      }))
      .sort((a, b) => a.rank - b.rank);

    this.broadcastEvent({
      t: "matchEnd",
      matchId: this.matchId,
      endTick: this.liveStartTick + outcome.endTick,
      ranking,
      inputLogHash: result.inputLogHash,
      replayHash: result.replayHash,
      resultSignature: signature,
    });
    this.ctx.log({
      evt: "match_end",
      matchId: this.matchId,
      reason: sim.endReason,
    });

    const status = await settler.submit(result, (update) => {
      this.announceSettlement(update.status, update.txHash, update.error);
      if (update.status === "confirmed") {
        void this.ctx.keeper.forget(this.matchId);
        this.ctx.metrics.recordSettlementLag(this.ctx.now() - this.endedAtMs);
      }
    });
    this.setPhase(status === "confirmed" ? Phase.SETTLED : Phase.SETTLE_FAILED);
    this.clock.setTimeout(() => void this.disconnect(), END_LINGER_MS);
  }
}
