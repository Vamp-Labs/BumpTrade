import { type SchemaType, schema, t } from "@colyseus/schema";

export const Car = schema(
  {
    wallet: t.string(),
    seat: t.uint8(),
    vehicle: t.uint8(),
    connected: t.boolean(),
    px: t.quantized({ min: -26, max: 26, bits: 16 }),
    py: t.quantized({ min: -6, max: 12, bits: 16 }),
    pz: t.quantized({ min: -26, max: 26, bits: 16 }),
    qx: t.quantized({ min: -1, max: 1, bits: 16 }),
    qy: t.quantized({ min: -1, max: 1, bits: 16 }),
    qz: t.quantized({ min: -1, max: 1, bits: 16 }),
    qw: t.quantized({ min: -1, max: 1, bits: 16 }),
    vx: t.quantized({ min: -60, max: 60, bits: 16 }),
    vy: t.quantized({ min: -60, max: 60, bits: 16 }),
    vz: t.quantized({ min: -60, max: 60, bits: 16 }),
    wx: t.quantized({ min: -20, max: 20, bits: 16 }),
    wy: t.quantized({ min: -20, max: 20, bits: 16 }),
    wz: t.quantized({ min: -20, max: 20, bits: 16 }),
    boost: t.uint8(),
    flags: t.uint8(),
    powerUp: t.uint8(),
    powerUpMs: t.uint16(),
    balance: t.uint32(),
    state: t.uint8(),
  },
  "Car",
);
export type Car = SchemaType<typeof Car>;

export const Crate = schema(
  {
    id: t.uint16(),
    kind: t.uint8(),
    x: t.quantized({ min: -26, max: 26, bits: 16 }),
    z: t.quantized({ min: -26, max: 26, bits: 16 }),
  },
  "Crate",
);
export type Crate = SchemaType<typeof Crate>;

export const MatchState = schema(
  {
    matchId: t.string(),
    phase: t.uint8(),
    stakeWei: t.string(),
    startBalance: t.uint32(),
    joinDeadline: t.uint32(),
    fillEndsAt: t.uint32(),
    tick: t.uint32(),
    liveStartTick: t.uint32(),
    endsAtTick: t.uint32(),
    marketEvent: t.uint8(),
    eventEndsAtTick: t.uint32(),
    lobby: t.uint8(),
    cars: t.map(Car),
    crates: t.map(Crate),
  },
  "MatchState",
);
export type MatchState = SchemaType<typeof MatchState>;

export const InputFrame = schema(
  {
    tick: t.uint32(),
    throttle: t.int8(),
    steer: t.int8(),
    buttons: t.uint8(),
  },
  "Input",
);
export type InputFrame = SchemaType<typeof InputFrame>;
