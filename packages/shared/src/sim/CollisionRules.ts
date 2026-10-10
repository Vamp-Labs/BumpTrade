import { type BumpTier, PowerUpKind, Skill } from "../protocol/enums";
import { BASE_CAR, COLLISION, VOID } from "./constants";
import type { Economy } from "./Economy";
import type { SimCar } from "./SimCar";
import type { SimWorld } from "./SimWorld";
import type { SimEvent, Vec3 } from "./types";

export interface RulesHost {
  readonly tick: number;
  readonly economy: Economy;
  readonly cars: readonly SimCar[];
  readonly surgeEndTick: number;
  emit(event: SimEvent): void;
  eliminateBankrupt(victimSeat: number, bySeat: number): void;
}

const length = (v: Vec3): number =>
  Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});
const scale = (a: Vec3, s: number): Vec3 => ({
  x: a.x * s,
  y: a.y * s,
  z: a.z * s,
});
const normalize = (a: Vec3): Vec3 => {
  const len = length(a);
  return len === 0 ? { x: 0, y: 0, z: 0 } : scale(a, 1 / len);
};
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const pairKey = (a: number, b: number): number =>
  a < b ? a * 16 + b : b * 16 + a;

export class CollisionRules {
  private readonly pairLast = new Map<number, number>();
  private readonly wallLast = new Map<number, number>();

  constructor(private readonly sim: SimWorld) {}

  process(host: RulesHost): void {
    const pending: Array<[number, number]> = [];
    this.sim.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      if (started) pending.push([handle1, handle2]);
    });

    for (const [handle1, handle2] of pending) {
      const tag1 = this.sim.tagOf(handle1);
      const tag2 = this.sim.tagOf(handle2);
      if (!tag1 || !tag2) continue;

      if (tag1.kind === "vehicle" && tag2.kind === "vehicle") {
        if (tag1.seat === tag2.seat) continue;
        const key = pairKey(tag1.seat, tag2.seat);
        const last = this.pairLast.get(key);
        if (
          last !== undefined &&
          host.tick - last < COLLISION.pairCooldownTicks
        )
          continue;
        const carA = host.cars[tag1.seat];
        const carB = host.cars[tag2.seat];
        if (!carA || !carB) continue;
        this.vehicleVehicle(host, carA, carB);
        this.pairLast.set(key, host.tick);
      } else if (
        (tag1.kind === "vehicle" && tag2.kind === "wall") ||
        (tag1.kind === "wall" && tag2.kind === "vehicle")
      ) {
        const seat =
          tag1.kind === "vehicle"
            ? tag1.seat
            : tag2.kind === "vehicle"
              ? tag2.seat
              : -1;
        const car = host.cars[seat];
        if (!car) continue;
        const last = this.wallLast.get(seat);
        if (
          last !== undefined &&
          host.tick - last < COLLISION.pairCooldownTicks
        )
          continue;
        this.vehicleWall(host, car);
        this.wallLast.set(seat, host.tick);
      }
    }
  }

  private vehicleVehicle(host: RulesHost, carA: SimCar, carB: SimCar): void {
    const tick = host.tick;
    const stateA = carA.kin();
    const stateB = carB.kin();

    const relVel = sub(stateA.velocity, stateB.velocity);
    const impactSpeed = length(relVel);
    if (impactSpeed < COLLISION.minImpactSpeed) return;

    const toB = normalize(sub(stateB.position, stateA.position));
    const dotA = dot(normalize(stateA.velocity), toB);
    const dotB = dot(normalize(stateB.velocity), scale(toB, -1));

    let attacker = carA;
    let victim = carB;
    let normal = toB;
    let stateAttacker = stateA;
    let stateVictim = stateB;
    if (dotB > dotA) {
      attacker = carB;
      victim = carA;
      normal = scale(toB, -1);
      stateAttacker = stateB;
      stateVictim = stateA;
    }

    const impactForce =
      impactSpeed * BASE_CAR.mass * COLLISION.collisionMultiplier;
    const intensity = clamp(impactForce / COLLISION.maxImpactForce, 0.05, 1.0);

    const attackerFrontAlignment = dot(stateAttacker.forward, normal);
    const victimFlankExposure = Math.abs(dot(stateVictim.right, normal));
    const victimRearExposure = Math.max(0, -dot(stateVictim.forward, normal));

    let angleQuality: "BAD" | "GOOD" | "PERFECT" = "BAD";
    if (attackerFrontAlignment >= 0.65) {
      if (
        victimFlankExposure >= 0.65 ||
        (victimRearExposure >= 0.7 && impactSpeed >= 9.0)
      ) {
        angleQuality = "PERFECT";
      } else if (
        victimFlankExposure >= 0.35 ||
        attackerFrontAlignment >= 0.82
      ) {
        angleQuality = "GOOD";
      }
    }

    let speedMultiplier = 1.0;
    if (impactSpeed >= 18.0) speedMultiplier = 1.5;
    else if (impactSpeed >= 10.0) speedMultiplier = 1.25;

    const victimDead = host.economy.isEliminated(victim.seat);
    const attackerDead = host.economy.isEliminated(attacker.seat);
    const eitherDead = victimDead || attackerDead;

    let skills = 0;
    let isHeadOn = false;
    let isBankShot = false;
    let isDriftBump = false;
    let isBoostCrash = false;
    let isRevenge = false;
    let isDoubleImpact = false;

    if (!eitherDead) {
      const headOnDot = dot(stateAttacker.forward, stateVictim.forward);
      const speedTowardVictim = dot(stateAttacker.velocity, normal);
      const speedTowardAttacker = dot(stateVictim.velocity, scale(normal, -1));
      isHeadOn =
        headOnDot < -0.55 &&
        speedTowardVictim > 2.5 &&
        speedTowardAttacker > 2.5 &&
        impactSpeed >= 12.0;
      if (isHeadOn) skills |= Skill.HEAD_ON;

      const wallBounce = attacker.lastWallBounce;
      isBankShot =
        wallBounce !== null &&
        tick - wallBounce.tick < COLLISION.bankShotTicks &&
        wallBounce.speed >= 3.0;
      if (isBankShot) {
        skills |= Skill.BANK;
        attacker.lastWallBounce = null;
      }

      isDriftBump = attacker.isDriftingRecently(
        tick,
        COLLISION.driftRecentTicks,
      );
      if (isDriftBump) skills |= Skill.DRIFT;

      isBoostCrash =
        attacker.boost.active || attacker.hasPowerUp(PowerUpKind.TURBO);
      if (isBoostCrash) skills |= Skill.BOOST;

      const rev = attacker.revenge;
      isRevenge =
        rev !== null &&
        rev.attackerSeat === victim.seat &&
        tick - rev.tick < COLLISION.revengeTicks;
      if (isRevenge) {
        skills |= Skill.REVENGE;
        attacker.revenge = null;
      }

      isDoubleImpact =
        (impactSpeed >= 16.0 && angleQuality === "PERFECT") ||
        (impactSpeed >= 20.0 && isHeadOn);
      if (isDoubleImpact) skills |= Skill.DOUBLE;

      victim.recentVictimHit = { attackerSeat: attacker.seat, tick };
      victim.revenge = { attackerSeat: attacker.seat, tick };
    }

    let tier: BumpTier = "LIGHT";
    if (
      isHeadOn ||
      impactSpeed >= COLLISION.criticalThreshold ||
      intensity >= 0.75
    ) {
      tier = "CRITICAL";
    } else if (
      angleQuality === "PERFECT" &&
      impactSpeed >= COLLISION.perfectThreshold
    ) {
      tier = "PERFECT";
    } else if (impactSpeed >= COLLISION.heavyThreshold || intensity >= 0.4) {
      tier = "HEAVY";
    }

    const contactX = (stateA.position.x + stateB.position.x) * 0.5;
    const contactZ = (stateA.position.z + stateB.position.z) * 0.5;

    let comboMultiplier = 1.0;
    if (!eitherDead) {
      const combo = attacker.combo;
      combo.count = tick < combo.expiresTick ? combo.count + 1 : 1;
      combo.expiresTick = tick + COLLISION.comboWindowTicks;
      comboMultiplier = comboMultiplierOf(combo.count);
    }

    const isAttackerTitan = attacker.isTitan();
    const attackerMassMult = isAttackerTitan ? 2.5 : 1.0;
    const attackerMass = attacker.handling.mass * attackerMassMult;
    const powerUpKnockback = isAttackerTitan ? 2.5 : 1.0;
    let knockbackMult = attacker.handling.impactKnockback * powerUpKnockback;
    const recoilResist =
      attacker.handling.recoilResistance * (isAttackerTitan ? 2.5 : 1.0);

    if (isHeadOn) knockbackMult *= 1.45;
    if (isBankShot) knockbackMult *= 1.3;
    if (isBoostCrash) knockbackMult *= 1.4;
    if (tier === "PERFECT") knockbackMult *= 1.25;

    const maxVictimImpulse = attackerMass * 11.5 * knockbackMult;
    const victimImpulseMag = Math.min(
      impactSpeed * attackerMass * 0.44 * knockbackMult,
      maxVictimImpulse,
    );
    victim.body.applyImpulse(
      {
        x: normal.x * victimImpulseMag,
        y: COLLISION.verticalHopImpulse * intensity * 260.0,
        z: normal.z * victimImpulseMag,
      },
      true,
    );

    const recoilScale = isHeadOn ? 0.75 : 0.22;
    const recoilMag = Math.min(
      (victimImpulseMag * recoilScale) / Math.max(0.1, recoilResist),
      attackerMass * 2.8,
    );
    attacker.body.applyImpulse(
      {
        x: -normal.x * recoilMag,
        y: -normal.y * recoilMag,
        z: -normal.z * recoilMag,
      },
      true,
    );

    const victimShielded = victim.hasPowerUp(PowerUpKind.SHIELD);
    if (victimShielded) {
      const reflect = -victimImpulseMag * 0.85;
      attacker.body.applyImpulse(
        { x: normal.x * reflect, y: normal.y * reflect, z: normal.z * reflect },
        true,
      );
    }

    let stolen = 0;
    const surgeActive = tick < host.surgeEndTick;
    if (!victimDead && !attackerDead) {
      let baseDamage = 8;
      if (tier === "CRITICAL" || tier === "PERFECT") baseDamage = 35;
      else if (tier === "HEAVY") baseDamage = 20;

      if (angleQuality === "PERFECT") baseDamage = Math.max(baseDamage, 35);
      else if (angleQuality === "BAD") baseDamage = Math.min(baseDamage, 8);

      let damage = Math.round(baseDamage * speedMultiplier);
      damage = Math.round(damage * comboMultiplier);
      if (isHeadOn) damage = Math.round(damage * 1.4);
      if (isBankShot) damage = Math.round(damage * 1.35);
      if (isDriftBump) damage = Math.round(damage * 1.25);
      if (isBoostCrash) damage = Math.round(damage * 2.0);
      if (isDoubleImpact) damage = Math.round(damage * 2.0);
      if (isRevenge) damage = Math.round(damage * 1.35);
      if (isAttackerTitan) damage = Math.round(damage * 2.0);
      if (surgeActive) damage = Math.round(damage * 2.0);
      if (victimShielded) damage = 0;

      stolen = host.economy.transfer(victim.seat, attacker.seat, damage);
      if (stolen > 0) {
        host.economy.recordHit(victim.seat, attacker.seat, tick);
        if (host.economy.balanceOf(victim.seat) === 0) {
          host.eliminateBankrupt(victim.seat, attacker.seat);
        }
      }
    }

    if (isAttackerTitan) skills |= Skill.TITAN;
    if (surgeActive) skills |= Skill.SURGE;

    if (!victimDead && tier !== "LIGHT" && victim.combo.count > 0) {
      victim.combo.count = 0;
      victim.combo.expiresTick = 0;
    }

    host.emit({
      t: "bump",
      tick,
      kind: "car",
      attackerSeat: attacker.seat,
      victimSeat: victim.seat,
      amount: stolen,
      tier,
      skills,
      x: contactX,
      z: contactZ,
      nx: normal.x,
      nz: normal.z,
    });
  }

  private vehicleWall(host: RulesHost, car: SimCar): void {
    const tick = host.tick;
    const state = car.kin();
    const speed = state.speed;
    if (speed < 2.0) return;

    const nx = -Math.sign(state.position.x);
    const nz = -Math.sign(state.position.z);
    const nlen = Math.sqrt(nx * nx + nz * nz);
    const normal = nlen === 0 ? { x: 0, z: 0 } : { x: nx / nlen, z: nz / nlen };

    let tier: BumpTier = "LIGHT";
    if (speed >= COLLISION.heavyThreshold) tier = "HEAVY";

    car.lastWallBounce = { tick, speed };

    const recentHit = car.recentVictimHit;
    let slamAttacker: SimCar | undefined;
    if (
      recentHit &&
      tick - recentHit.tick < COLLISION.wallSlamTicks &&
      speed >= 3.5
    ) {
      slamAttacker = host.cars[recentHit.attackerSeat];
      car.recentVictimHit = null;
    }

    let stolen = 0;
    let skills = 0;
    if (
      slamAttacker &&
      !host.economy.isEliminated(car.seat) &&
      !host.economy.isEliminated(slamAttacker.seat)
    ) {
      const slamBase = Math.round(15 + Math.min(speed, 10));
      stolen = host.economy.transfer(car.seat, slamAttacker.seat, slamBase);
      if (stolen > 0) {
        host.economy.recordHit(car.seat, slamAttacker.seat, tick);
        if (host.economy.balanceOf(car.seat) === 0) {
          host.eliminateBankrupt(car.seat, slamAttacker.seat);
        }
      }
      if (slamAttacker.isTitan()) skills |= Skill.TITAN;
    }

    host.emit({
      t: "bump",
      tick,
      kind: "wall",
      attackerSeat: stolen > 0 && slamAttacker ? slamAttacker.seat : car.seat,
      victimSeat: stolen > 0 ? car.seat : -1,
      amount: stolen,
      tier,
      skills,
      x: state.position.x + normal.x * -1.2,
      z: state.position.z + normal.z * -1.2,
      nx: normal.x,
      nz: normal.z,
    });
  }
}

export const comboMultiplierOf = (count: number): number => {
  if (count <= 1) return 1.0;
  if (count === 2) return 1.25;
  if (count === 3) return 1.5;
  return 2.0;
};

export const isInsideVoid = (x: number, z: number): boolean =>
  VOID.locations.some(
    (loc) => (x - loc.x) ** 2 + (z - loc.z) ** 2 < VOID.radius * VOID.radius,
  );
