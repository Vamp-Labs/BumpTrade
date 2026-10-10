import type { EliminationCause } from "../protocol/enums";
import { MarketEventKind, PowerUpKind } from "../protocol/enums";
import { Prng } from "../rng/Prng";
import { CollisionRules, type RulesHost } from "./CollisionRules";
import {
  CRITICAL_BALANCE,
  FIXED_DT,
  MAX_SEATS,
  POWER_UP_PICKUP_RADIUS,
  SURGE_TICKS,
  secondsToTicks,
  VOID,
} from "./constants";
import { Economy } from "./Economy";
import { type RankInput, rankSeats, ranksBySeat } from "./Ranking";
import { SimCar } from "./SimCar";
import { SimWorld } from "./SimWorld";
import { boostMultiplierOf, stepCar, updateBoost } from "./stepCar";
import {
  IDLE_INPUT,
  type SimCrate,
  type SimEvent,
  type VehicleInput,
} from "./types";

export interface MatchSimOptions {
  playerCount: number;
  startBalance: number;
  vehicleIds: readonly number[];
  seed: number;
  durationTicks: number;
  strict?: boolean;
  onViolation?: (sum: number, expected: number, tick: number) => void;
  disconnectEliminationTicks?: number | null;
}

export interface MatchOutcome {
  finalBalances: number[];
  ranks: number[];
  endTick: number;
}

const POWER_UP_SECONDS: Record<number, number> = {
  [PowerUpKind.TURBO]: 7,
  [PowerUpKind.HEAVY_HIT]: 8,
  [PowerUpKind.CASH_MAGNET]: 8,
  [PowerUpKind.SHIELD]: 6,
};

const RANDOM_CRATE_KINDS: readonly PowerUpKind[] = [
  PowerUpKind.TURBO,
  PowerUpKind.HEAVY_HIT,
  PowerUpKind.CASH_MAGNET,
  PowerUpKind.SHIELD,
];

const MARKET_DROP_POINTS: ReadonlyArray<{
  kind: PowerUpKind;
  x: number;
  z: number;
}> = [
  { kind: PowerUpKind.TURBO, x: -8, z: 0 },
  { kind: PowerUpKind.HEAVY_HIT, x: 8, z: 0 },
  { kind: PowerUpKind.CASH_MAGNET, x: 0, z: -8 },
  { kind: PowerUpKind.SHIELD, x: 0, z: 8 },
];

export class MatchSim implements RulesHost {
  tick = 0;
  over = false;
  endReason: "timeout" | "lastStanding" | null = null;
  surgeEndTick = 0;
  marketEvent: MarketEventKind = MarketEventKind.NONE;
  eventEndsAtTick = 0;
  readonly cars: SimCar[] = [];
  readonly economy: Economy;
  readonly crates: SimCrate[] = [];
  readonly options: MatchSimOptions;

  private readonly events: SimEvent[] = [];
  private readonly prng: Prng;
  private readonly rules: CollisionRules;
  private nextCrateId = 1;
  private timeline = {
    fire20: false,
    fire40: false,
    drop: false,
    surge: false,
    minor: false,
    final20: false,
  };

  private constructor(
    private readonly world: SimWorld,
    options: MatchSimOptions,
  ) {
    this.options = options;
    this.economy = new Economy(options.playerCount, options.startBalance);
    this.prng = new Prng(options.seed);
    this.rules = new CollisionRules(world);
  }

  static async create(options: MatchSimOptions): Promise<MatchSim> {
    if (options.playerCount < 1 || options.playerCount > MAX_SEATS) {
      throw new Error(`playerCount out of range: ${options.playerCount}`);
    }
    if (options.vehicleIds.length !== options.playerCount) {
      throw new Error("vehicleIds length must equal playerCount");
    }
    const world = await SimWorld.create();
    const sim = new MatchSim(world, options);
    for (let seat = 0; seat < options.playerCount; seat++) {
      sim.cars.push(new SimCar(world, seat, options.vehicleIds[seat] ?? 0));
    }
    world.prime();
    sim.spawnCrate(sim.randomKind(), -9, -6);
    sim.spawnCrate(sim.randomKind(), 9, 6);
    return sim;
  }

  dispose(): void {
    this.world.free();
  }

  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  setConnected(seat: number, connected: boolean): void {
    const car = this.cars[seat];
    if (!car) return;
    car.connected = connected;
    if (connected) car.disconnectedTicks = 0;
  }

  eliminateBankrupt(victimSeat: number, bySeat: number): void {
    this.eliminate(victimSeat, "bankrupt", bySeat);
  }

  forceEliminate(seat: number, cause: EliminationCause): void {
    this.eliminate(seat, cause, null);
  }

  step(inputs: ReadonlyArray<VehicleInput | null | undefined>): void {
    if (this.over) return;

    for (const car of this.cars) {
      if (this.economy.isEliminated(car.seat)) {
        car.lockWreck();
        continue;
      }
      this.tickPowerUps(car);
      const input = inputs[car.seat] ?? IDLE_INPUT;
      updateBoost(car.boost, FIXED_DT, input.boost);
      car.drive.boostActive = car.boost.active;
      car.drive.boostMultiplier = boostMultiplierOf(car.boost);
      car.drive.speedMultiplier = car.hasPowerUp(PowerUpKind.TURBO) ? 1.5 : 1.0;
      stepCar(car.drive, car.body, car.handling, input, FIXED_DT);
      if (car.drive.kin.isDrifting) car.lastDriftTick = this.tick;
    }

    this.world.step();
    this.rules.process(this);
    this.checkVoid();
    this.expireCombos();
    this.collectCrates();
    this.runTimeline();
    this.checkDisconnects();
    this.assertConserved();

    this.tick += 1;
    this.checkEnd();
  }

  outcome(): MatchOutcome {
    const entries = this.rankEntries();
    return {
      finalBalances: this.economy.snapshot(),
      ranks: ranksBySeat(entries),
      endTick: this.tick,
    };
  }

  rankedSeats(): number[] {
    return rankSeats(this.rankEntries());
  }

  stateHash(): string {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193 ^ 0x5bd1e995;
    const mix = (value: number): void => {
      view.setFloat64(0, value);
      for (let i = 0; i < 8; i++) {
        const byte = view.getUint8(i);
        h1 = Math.imul(h1 ^ byte, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ byte, 0x85ebca6b) >>> 0;
      }
    };
    mix(this.tick);
    mix(this.prng.getState());
    for (const car of this.cars) {
      const t = car.body.translation();
      const r = car.body.rotation();
      const lv = car.body.linvel();
      const av = car.body.angvel();
      [
        t.x,
        t.y,
        t.z,
        r.x,
        r.y,
        r.z,
        r.w,
        lv.x,
        lv.y,
        lv.z,
        av.x,
        av.y,
        av.z,
      ].forEach(mix);
      mix(this.economy.balanceOf(car.seat));
      mix(car.boost.fuel);
    }
    return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
  }

  private rankEntries(): RankInput[] {
    return this.cars.map((car) => ({
      seat: car.seat,
      balance: this.economy.balanceOf(car.seat),
      alive: this.economy.isAlive(car.seat),
      eliminatedTick: this.economy.eliminationTick(car.seat),
    }));
  }

  private randomKind(): PowerUpKind {
    return (
      RANDOM_CRATE_KINDS[this.prng.int(RANDOM_CRATE_KINDS.length)] ??
      PowerUpKind.TURBO
    );
  }

  private spawnCrate(kind: PowerUpKind, x: number, z: number): void {
    const crate: SimCrate = { id: this.nextCrateId++, kind, x, z };
    this.crates.push(crate);
    this.emit({ t: "crateSpawn", tick: this.tick, id: crate.id, kind, x, z });
  }

  private tickPowerUps(car: SimCar): void {
    for (const [kind, remaining] of car.powerUps) {
      if (remaining <= 1) car.powerUps.delete(kind);
      else car.powerUps.set(kind, remaining - 1);
    }
  }

  private eliminate(
    seat: number,
    cause: EliminationCause,
    bySeat: number | null,
  ): void {
    const car = this.cars[seat];
    if (!car) return;
    const outcome = this.economy.eliminate(seat, this.tick, cause);
    if (!outcome) return;
    car.eliminated = true;
    car.powerUps.clear();
    car.lockWreck();
    this.emit({
      t: "eliminate",
      tick: this.tick,
      seat,
      bySeat: bySeat ?? outcome.bySeat,
      cause,
      redistributed: outcome.redistributed,
    });
  }

  private checkVoid(): void {
    for (const car of this.cars) {
      if (this.economy.isEliminated(car.seat)) continue;
      const pos = car.kin().position;
      for (const loc of VOID.locations) {
        const dx = pos.x - loc.x;
        const dz = pos.z - loc.z;
        if (
          dx * dx + dz * dz < VOID.radius * VOID.radius &&
          pos.y < VOID.triggerY
        ) {
          this.eliminate(car.seat, "voidPit", null);
          break;
        }
      }
    }
  }

  private expireCombos(): void {
    for (const car of this.cars) {
      if (car.combo.count > 0 && this.tick >= car.combo.expiresTick) {
        car.combo.count = 0;
      }
    }
  }

  private collectCrates(): void {
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const crate = this.crates[i];
      if (!crate) continue;
      for (const car of this.cars) {
        if (this.economy.isEliminated(car.seat)) continue;
        const pos = car.kin().position;
        const dx = pos.x - crate.x;
        const dz = pos.z - crate.z;
        if (Math.sqrt(dx * dx + dz * dz) <= POWER_UP_PICKUP_RADIUS) {
          this.applyPowerUp(car, crate.kind);
          this.crates.splice(i, 1);
          this.emit({
            t: "crateTaken",
            tick: this.tick,
            id: crate.id,
            seat: car.seat,
            kind: crate.kind,
          });
          break;
        }
      }
    }
  }

  private applyPowerUp(car: SimCar, kind: PowerUpKind): void {
    const seconds = POWER_UP_SECONDS[kind];
    if (seconds === undefined) return;
    car.powerUps.set(kind, secondsToTicks(seconds));
    if (kind === PowerUpKind.TURBO) {
      car.boost.fuel = 1.0;
      car.boost.active = false;
    }
  }

  private fireMarket(
    kind: MarketEventKind,
    title: string,
    durationSeconds: number,
  ): void {
    const durationTicks = secondsToTicks(durationSeconds);
    this.marketEvent = kind;
    this.eventEndsAtTick = this.tick + durationTicks;
    this.emit({
      t: "marketEvent",
      tick: this.tick,
      kind,
      title,
      durationTicks,
    });
  }

  private runTimeline(): void {
    const tl = this.timeline;
    const at = (seconds: number): boolean =>
      this.tick >= secondsToTicks(seconds);

    if (at(20) && !tl.fire20) {
      tl.fire20 = true;
      this.fireMarket(
        MarketEventKind.FIRE_BURST,
        "ARENA HAZARD: FIRE BURST",
        2.5,
      );
    }
    if (at(40) && !tl.fire40) {
      tl.fire40 = true;
      this.fireMarket(
        MarketEventKind.FIRE_BURST,
        "ARENA HAZARD: FIRE BURST",
        2.5,
      );
    }
    if (at(50) && !tl.drop) {
      tl.drop = true;
      if (this.crates.length >= 4) this.crates.shift();
      for (const point of MARKET_DROP_POINTS)
        this.spawnCrate(point.kind, point.x, point.z);
      this.fireMarket(MarketEventKind.MARKET_DROP, "MARKET DROP", 3);
    }
    if (at(60) && !tl.surge) {
      tl.surge = true;
      this.surgeEndTick = this.tick + SURGE_TICKS;
      this.fireMarket(
        MarketEventKind.DOUBLE_STEAL_SURGE,
        "DOUBLE STEAL SURGE",
        10,
      );
    }
    if (at(66) && !tl.minor) {
      tl.minor = true;
      if (this.prng.next() > 0.5) {
        this.fireMarket(MarketEventKind.MARKET_CRASH, "MARKET CRASH", 4);
      } else {
        this.fireMarket(MarketEventKind.MARKET_FLASH, "MARKET FLASH", 3);
      }
    }
    const remaining = this.options.durationTicks - this.tick;
    if (remaining <= secondsToTicks(20) && !tl.final20) {
      tl.final20 = true;
      this.fireMarket(
        MarketEventKind.FINAL_20,
        "FINAL 20 SECONDS",
        remaining / 60,
      );
    }
    if (
      this.marketEvent !== MarketEventKind.NONE &&
      this.tick >= this.eventEndsAtTick
    ) {
      this.marketEvent = MarketEventKind.NONE;
    }
  }

  private checkDisconnects(): void {
    const limit = this.options.disconnectEliminationTicks;
    if (limit === null || limit === undefined) return;
    for (const car of this.cars) {
      if (this.economy.isEliminated(car.seat) || car.connected) continue;
      car.disconnectedTicks += 1;
      if (car.disconnectedTicks >= limit)
        this.eliminate(car.seat, "disconnectTimeout", null);
    }
  }

  private assertConserved(): void {
    const sum = this.economy.total();
    const expected = this.economy.expectedTotal();
    if (sum === expected) return;
    if (this.options.strict !== false) {
      throw new Error(
        `zero-sum violated at tick ${this.tick}: ${sum} != ${expected}`,
      );
    }
    this.options.onViolation?.(sum, expected, this.tick);
  }

  private checkEnd(): void {
    if (this.tick >= this.options.durationTicks) {
      this.over = true;
      this.endReason = "timeout";
      return;
    }
    if (
      this.options.playerCount >= 2 &&
      this.economy.aliveSeats().length <= 1
    ) {
      this.over = true;
      this.endReason = "lastStanding";
    }
  }

  isCritical(seat: number): boolean {
    return (
      this.economy.isAlive(seat) &&
      this.economy.balanceOf(seat) < CRITICAL_BALANCE
    );
  }
}
