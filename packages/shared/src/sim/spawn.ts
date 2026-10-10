import { MAX_SEATS } from "./constants";

export interface SpawnSlot {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

const SPAWN_RADIUS = 12.0;

export const SPAWN_SLOTS: readonly SpawnSlot[] = Array.from(
  { length: MAX_SEATS },
  (_, seat) => {
    const angle = (seat * 2 * Math.PI) / MAX_SEATS;
    return {
      x: Math.sin(angle) * SPAWN_RADIUS,
      y: 0.4,
      z: Math.cos(angle) * SPAWN_RADIUS,
      rotY: angle + Math.PI,
    };
  },
);
