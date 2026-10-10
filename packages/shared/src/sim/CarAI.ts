import { FIXED_DT, VOID } from "./constants";
import type { MatchSim } from "./MatchSim";
import type { VehicleInput } from "./types";

const RETARGET_TICKS = 60;

const bountyMultiplier = (balance: number): number => {
  if (balance >= 500) return 3.5;
  if (balance >= 250) return 2.2;
  if (balance >= 100) return 1.5;
  return 1.0;
};

export class CarAI {
  private stuckTimer = 0;
  private reverseTimer = 0;
  private boostCooldown = 0;
  private targetSeat = -1;
  private retargetIn = 0;

  constructor(private readonly seat: number) {}

  update(sim: MatchSim): VehicleInput {
    const idle: VehicleInput = {
      throttle: 0,
      steer: 0,
      brake: false,
      boost: false,
      handbrake: false,
    };
    const self = sim.cars[this.seat];
    if (!self || sim.economy.isEliminated(this.seat)) return idle;

    this.retargetIn -= 1;
    if (
      this.retargetIn <= 0 ||
      this.targetSeat < 0 ||
      sim.economy.isEliminated(this.targetSeat)
    ) {
      this.targetSeat = this.pickTarget(sim);
      this.retargetIn = RETARGET_TICKS;
    }
    const target = sim.cars[this.targetSeat];
    if (!target) return idle;

    const selfPhys = self.kin();
    const targetPhys = target.kin();
    this.boostCooldown = Math.max(0, this.boostCooldown - FIXED_DT);

    if (selfPhys.speed < 0.6) {
      this.stuckTimer += FIXED_DT;
      if (this.stuckTimer > 1.2) {
        this.reverseTimer = 1.0;
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - FIXED_DT);
    }

    if (this.reverseTimer > 0) {
      this.reverseTimer -= FIXED_DT;
      return {
        throttle: -1.0,
        steer: 0.8,
        brake: false,
        boost: false,
        handbrake: false,
      };
    }

    let tx = targetPhys.position.x - selfPhys.position.x;
    let ty = targetPhys.position.y - selfPhys.position.y;
    let tz = targetPhys.position.z - selfPhys.position.z;
    const distance = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (distance > 0) {
      tx /= distance;
      ty /= distance;
      tz /= distance;
    }

    let ax = 0;
    let az = 0;
    for (const loc of VOID.locations) {
      const dx = selfPhys.position.x - loc.x;
      const dy = selfPhys.position.y;
      const dz = selfPhys.position.z - loc.z;
      const pitDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (pitDist < VOID.radius + 3.5 && pitDist > 0) {
        const push = (VOID.radius + 3.5 - pitDist) * 2.5;
        ax += (dx / pitDist) * push;
        az += (dz / pitDist) * push;
      }
    }

    let sx = tx + ax;
    const sy = ty;
    let sz = tz + az;
    const slen = Math.sqrt(sx * sx + sy * sy + sz * sz);
    if (slen > 0) {
      sx /= slen;
      sz /= slen;
    }

    const dotForward = selfPhys.forward.x * sx + selfPhys.forward.z * sz;
    const dotRight = selfPhys.right.x * sx + selfPhys.right.z * sz;

    let steer = 0;
    if (dotRight > 0.08) steer = 1.0;
    else if (dotRight < -0.08) steer = -1.0;
    else steer = dotRight * 8.0;

    let boost = false;
    if (
      dotForward > 0.88 &&
      distance > 3.0 &&
      distance < 18.0 &&
      this.boostCooldown <= 0
    ) {
      boost = true;
      if (distance < 4.0) this.boostCooldown = 4.0;
    }

    return {
      throttle: 1.0,
      steer: Math.min(1.0, Math.max(-1.0, steer)),
      brake: false,
      boost,
      handbrake: false,
    };
  }

  private pickTarget(sim: MatchSim): number {
    const self = sim.cars[this.seat];
    if (!self) return -1;
    const selfPos = self.kin().position;
    let best = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const car of sim.cars) {
      if (car.seat === this.seat || sim.economy.isEliminated(car.seat))
        continue;
      const pos = car.kin().position;
      const dx = pos.x - selfPos.x;
      const dy = pos.y - selfPos.y;
      const dz = pos.z - selfPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const balance = sim.economy.balanceOf(car.seat);
      const score =
        ((balance * 0.4 + 40) * bountyMultiplier(balance)) / (distance + 4.0);
      if (score > bestScore) {
        bestScore = score;
        best = car.seat;
      }
    }
    return best;
  }
}
