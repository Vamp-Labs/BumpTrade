import { describe, expect, it } from "vitest";
import {
  adoptCar,
  CarAI,
  computePayouts,
  createPredictionWorld,
  Economy,
  FIXED_DT,
  IDLE_INPUT,
  MatchSim,
  poseCar,
  rankSeats,
  ranksBySeat,
  type SimEvent,
  secondsToTicks,
  stepPredictedCar,
  type VehicleInput,
} from "../src";

const botMatch = async (seed: number, seconds: number, players = 8) => {
  const sim = await MatchSim.create({
    playerCount: players,
    startBalance: 100,
    vehicleIds: Array.from({ length: players }, (_, i) => i % 7),
    seed,
    durationTicks: secondsToTicks(seconds),
  });
  const ais = Array.from({ length: players }, (_, seat) => new CarAI(seat));
  const events: SimEvent[] = [];
  while (!sim.over) {
    const inputs: VehicleInput[] = ais.map((ai) => ai.update(sim));
    sim.step(inputs);
    events.push(...sim.drainEvents());
  }
  return { sim, events };
};

describe("headless 8-car bot match", () => {
  it("runs 90 s of ticks and never breaks the zero-sum invariant", async () => {
    const { sim, events } = await botMatch(12345, 90);
    expect(sim.over).toBe(true);
    expect(sim.economy.total()).toBe(800);
    const bumps = events.filter((e) => e.t === "bump" && e.amount > 0);
    expect(bumps.length).toBeGreaterThan(0);
    sim.dispose();
  }, 60000);
});

describe("determinism", () => {
  it("same seed and same inputs give an identical final state hash", async () => {
    const a = await botMatch(777, 20);
    const hashA = a.sim.stateHash();
    a.sim.dispose();
    const b = await botMatch(777, 20);
    expect(b.sim.stateHash()).toBe(hashA);
    b.sim.dispose();
  }, 60000);
});

describe("per-pair contact rate limit", () => {
  it("transfers for two different pairs bumping in the same tick", async () => {
    const sim = await MatchSim.create({
      playerCount: 4,
      startBalance: 100,
      vehicleIds: [0, 0, 0, 0],
      seed: 1,
      durationTicks: secondsToTicks(30),
    });
    const place = (
      seat: number,
      x: number,
      z: number,
      rotY: number,
      vz: number,
    ) => {
      const body = sim.cars[seat]?.body;
      if (!body) throw new Error("missing car");
      body.setTranslation({ x, y: 0.4, z }, true);
      body.setRotation(
        { x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) },
        true,
      );
      body.setLinvel({ x: 0, y: 0, z: vz }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    };
    place(0, -12, -4, 0, 16);
    place(1, -12, 4, Math.PI, -16);
    place(2, 12, -4, 0, 16);
    place(3, 12, 4, Math.PI, -16);

    const bumpTicks = new Map<string, number>();
    for (let i = 0; i < 90; i++) {
      sim.step([IDLE_INPUT, IDLE_INPUT, IDLE_INPUT, IDLE_INPUT]);
      for (const event of sim.drainEvents()) {
        if (event.t === "bump" && event.kind === "car" && event.amount > 0) {
          const key = [event.attackerSeat, event.victimSeat].sort().join("-");
          if (!bumpTicks.has(key)) bumpTicks.set(key, event.tick);
        }
      }
    }
    expect(bumpTicks.get("0-1")).toBeDefined();
    expect(bumpTicks.get("2-3")).toBeDefined();
    expect(bumpTicks.get("0-1")).toBe(bumpTicks.get("2-3"));
    expect(sim.economy.total()).toBe(400);
    sim.dispose();
  });
});

describe("ranking", () => {
  it("orders alive cars by balance then seat and eliminated by later tick then seat", () => {
    const ranked = rankSeats([
      { seat: 0, balance: 0, alive: false, eliminatedTick: 100 },
      { seat: 1, balance: 150, alive: true, eliminatedTick: null },
      { seat: 2, balance: 150, alive: true, eliminatedTick: null },
      { seat: 3, balance: 0, alive: false, eliminatedTick: 300 },
      { seat: 4, balance: 0, alive: false, eliminatedTick: 100 },
      { seat: 5, balance: 200, alive: true, eliminatedTick: null },
    ]);
    expect(ranked).toEqual([5, 1, 2, 3, 0, 4]);
  });

  it("maps ranks back to seats", () => {
    const ranks = ranksBySeat([
      { seat: 0, balance: 50, alive: true, eliminatedTick: null },
      { seat: 1, balance: 150, alive: true, eliminatedTick: null },
    ]);
    expect(ranks).toEqual([2, 1]);
  });
});

describe("economy redistribution", () => {
  it("sends a non-bump elimination to the last hitter within 5 s", () => {
    const economy = new Economy(4, 100);
    economy.transfer(1, 0, 30);
    economy.recordHit(1, 0, 10);
    const outcome = economy.eliminate(1, 10 + 200, "voidPit");
    expect(outcome?.redistributed).toEqual([[0, 70]]);
    expect(outcome?.bySeat).toBe(0);
    expect(economy.balanceOf(0)).toBe(200);
    expect(economy.balanceOf(1)).toBe(0);
    expect(economy.total()).toBe(400);
  });

  it("splits equally with the remainder to the lowest alive seat when no recent hitter", () => {
    const economy = new Economy(4, 100);
    economy.transfer(3, 0, 2);
    economy.recordHit(3, 0, 0);
    const outcome = economy.eliminate(3, 1000, "disconnectTimeout");
    expect(outcome?.bySeat).toBeNull();
    expect(outcome?.redistributed).toEqual([
      [0, 34],
      [1, 32],
      [2, 32],
    ]);
    expect(economy.total()).toBe(400);
  });

  it("caps transfers at the victim balance and keeps integers", () => {
    const economy = new Economy(2, 100);
    expect(economy.transfer(0, 1, 250)).toBe(100);
    expect(economy.transfer(0, 1, 5)).toBe(0);
    expect(economy.transfer(1, 0, 10.9)).toBe(10);
    expect(economy.total()).toBe(200);
  });

  it("redistributes through the sim on a forced void elimination", async () => {
    const sim = await MatchSim.create({
      playerCount: 3,
      startBalance: 100,
      vehicleIds: [0, 1, 2],
      seed: 9,
      durationTicks: secondsToTicks(10),
    });
    sim.forceEliminate(2, "voidPit");
    const events = sim.drainEvents();
    const elim = events.find((e) => e.t === "eliminate");
    expect(elim && elim.t === "eliminate" ? elim.redistributed : null).toEqual([
      [0, 50],
      [1, 50],
    ]);
    sim.step([IDLE_INPUT, IDLE_INPUT, IDLE_INPUT]);
    expect(sim.economy.total()).toBe(300);
    expect(FIXED_DT).toBeCloseTo(1 / 60);
    sim.dispose();
  });
});

describe("computePayouts", () => {
  it("floors pro rata and puts the dust in the remainder", () => {
    const stake = 100000000000000n;
    const { payouts, dust, pot } = computePayouts(stake, 100, [133, 67, 0]);
    expect(pot).toBe(300000000000000n);
    expect(payouts).toEqual([133000000000000n, 67000000000000n, 0n]);
    expect(dust).toBe(100000000000000n);
    const odd = computePayouts(7n, 3, [2, 1]);
    expect(odd.payouts).toEqual([4n, 2n]);
    expect(odd.dust).toBe(14n - 6n);
  });
});

describe("prediction helpers", () => {
  it("replays the same car physics from an adopted server state", async () => {
    const sim = await MatchSim.create({
      playerCount: 1,
      startBalance: 100,
      vehicleIds: [0],
      seed: 3,
      durationTicks: secondsToTicks(30),
    });
    const input: VehicleInput = {
      throttle: 0.5,
      steer: 0,
      brake: false,
      boost: false,
      handbrake: false,
    };
    for (let i = 0; i < 60; i++) sim.step([input]);

    const car = sim.cars[0];
    if (!car) throw new Error("missing car");
    const t = car.body.translation();
    const r = car.body.rotation();
    const v = car.body.linvel();
    const w = car.body.angvel();
    const world = await createPredictionWorld(0, 0);
    adoptCar(world, {
      px: t.x,
      py: t.y,
      pz: t.z,
      qx: r.x,
      qy: r.y,
      qz: r.z,
      qw: r.w,
      vx: v.x,
      vy: v.y,
      vz: v.z,
      wx: w.x,
      wy: w.y,
      wz: w.z,
      boost: 100,
      flags: 0,
    });
    for (let i = 0; i < 30; i++) {
      sim.step([input]);
      stepPredictedCar(world, input);
    }
    const pose = poseCar(world);
    const truth = car.body.translation();
    expect(Math.hypot(pose.px - truth.x, pose.pz - truth.z)).toBeLessThan(0.05);
    sim.dispose();
    world.sim.free();
  });
});
