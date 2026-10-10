import { keccak256 } from "viem";
import { describe, expect, it } from "vitest";
import { InputLog } from "../src/log/InputLog";

describe("InputLog", () => {
  it("writes u32 tick, u8 seat, i8 throttle, i8 steer, u8 buttons per seat per tick", () => {
    const log = new InputLog(2);
    log.recordTick(5, [{ throttle: -100, steer: 100, buttons: 3 }, null]);
    const bytes = log.toBytes();
    expect(Array.from(bytes)).toEqual([
      0, 0, 0, 5, 0, 156, 100, 3, 0, 0, 0, 5, 1, 0, 0, 0,
    ]);
    expect(log.hash()).toBe(keccak256(bytes));
  });

  it("grows past the initial buffer and keeps ordering", () => {
    const log = new InputLog(8);
    for (let tick = 0; tick < 5400; tick++) log.recordTick(tick, []);
    expect(log.toBytes().length).toBe(5400 * 8 * 8);
  });
});
