import type { EliminationCause } from "../protocol/enums";
import { COLLISION } from "./constants";

export interface EliminationOutcome {
  seat: number;
  bySeat: number | null;
  cause: EliminationCause;
  redistributed: Array<[number, number]>;
}

interface LastHit {
  attackerSeat: number;
  tick: number;
}

export class Economy {
  readonly playerCount: number;
  readonly startBalance: number;
  private readonly balances: number[];
  private readonly eliminatedAt: Array<number | null>;
  private readonly lastHit: Array<LastHit | null>;

  constructor(playerCount: number, startBalance: number) {
    this.playerCount = playerCount;
    this.startBalance = startBalance;
    this.balances = Array.from({ length: playerCount }, () => startBalance);
    this.eliminatedAt = Array.from({ length: playerCount }, () => null);
    this.lastHit = Array.from({ length: playerCount }, () => null);
  }

  balanceOf(seat: number): number {
    return this.balances[seat] ?? 0;
  }

  isEliminated(seat: number): boolean {
    return (
      this.eliminatedAt[seat] !== null && this.eliminatedAt[seat] !== undefined
    );
  }

  isAlive(seat: number): boolean {
    return !this.isEliminated(seat);
  }

  eliminationTick(seat: number): number | null {
    return this.eliminatedAt[seat] ?? null;
  }

  aliveSeats(): number[] {
    const seats: number[] = [];
    for (let seat = 0; seat < this.playerCount; seat++) {
      if (this.isAlive(seat)) seats.push(seat);
    }
    return seats;
  }

  total(): number {
    return this.balances.reduce((sum, balance) => sum + balance, 0);
  }

  expectedTotal(): number {
    return this.playerCount * this.startBalance;
  }

  snapshot(): number[] {
    return this.balances.slice();
  }

  recordHit(victimSeat: number, attackerSeat: number, tick: number): void {
    this.lastHit[victimSeat] = { attackerSeat, tick };
  }

  transfer(fromSeat: number, toSeat: number, requested: number): number {
    if (fromSeat === toSeat) return 0;
    if (this.isEliminated(fromSeat) || this.isEliminated(toSeat)) return 0;
    const wanted = Math.floor(requested);
    if (!Number.isFinite(wanted) || wanted <= 0) return 0;
    const amount = Math.min(wanted, this.balanceOf(fromSeat));
    if (amount <= 0) return 0;
    this.balances[fromSeat] = this.balanceOf(fromSeat) - amount;
    this.balances[toSeat] = this.balanceOf(toSeat) + amount;
    return amount;
  }

  eliminate(
    seat: number,
    tick: number,
    cause: EliminationCause,
  ): EliminationOutcome | null {
    if (this.isEliminated(seat)) return null;

    if (cause === "bankrupt") {
      if (this.balanceOf(seat) !== 0) return null;
      const hit = this.lastHit[seat];
      this.eliminatedAt[seat] = tick;
      return {
        seat,
        bySeat: hit ? hit.attackerSeat : null,
        cause,
        redistributed: [],
      };
    }

    const others = this.aliveSeats().filter((other) => other !== seat);
    if (others.length === 0) return null;

    const remaining = this.balanceOf(seat);
    const redistributed: Array<[number, number]> = [];
    let bySeat: number | null = null;

    const hit = this.lastHit[seat];
    const hitter =
      hit !== null &&
      hit !== undefined &&
      tick - hit.tick <= COLLISION.lastHitterTicks &&
      this.isAlive(hit.attackerSeat) &&
      hit.attackerSeat !== seat
        ? hit.attackerSeat
        : null;

    if (remaining > 0) {
      if (hitter !== null) {
        redistributed.push([hitter, remaining]);
        this.balances[hitter] = this.balanceOf(hitter) + remaining;
        bySeat = hitter;
      } else {
        const share = Math.floor(remaining / others.length);
        const remainder = remaining - share * others.length;
        const lowest = Math.min(...others);
        for (const other of others) {
          const amount = share + (other === lowest ? remainder : 0);
          if (amount > 0) {
            redistributed.push([other, amount]);
            this.balances[other] = this.balanceOf(other) + amount;
          }
        }
      }
    }

    this.balances[seat] = 0;
    this.eliminatedAt[seat] = tick;
    return { seat, bySeat, cause, redistributed };
  }
}
