import type RAPIER from "@dimforge/rapier3d-compat";
import { PowerUpKind } from "../protocol/enums";
import { ELIMINATED_DAMPING } from "./constants";
import { type HandlingConfig, VEHICLE_HANDLING } from "./handling";
import type { SimWorld } from "./SimWorld";
import { SPAWN_SLOTS } from "./spawn";
import {
  type BoostState,
  createBoostState,
  createDriveState,
  type DriveState,
  readKinematics,
} from "./stepCar";

export interface ComboState {
  count: number;
  expiresTick: number;
}

export interface HitRecord {
  attackerSeat: number;
  tick: number;
}

export class SimCar {
  readonly seat: number;
  readonly vehicleId: number;
  readonly handling: HandlingConfig;
  readonly body: RAPIER.RigidBody;
  readonly bumper: RAPIER.Collider;
  readonly cabin: RAPIER.Collider;
  readonly drive: DriveState = createDriveState();
  readonly boost: BoostState = createBoostState();
  readonly powerUps = new Map<PowerUpKind, number>();
  readonly combo: ComboState = { count: 0, expiresTick: 0 };

  connected = true;
  disconnectedTicks = 0;
  eliminated = false;
  lastDriftTick = -1_000_000;
  lastWallBounce: { tick: number; speed: number } | null = null;
  recentVictimHit: HitRecord | null = null;
  revenge: HitRecord | null = null;

  constructor(sim: SimWorld, seat: number, vehicleId: number) {
    const handling = VEHICLE_HANDLING[vehicleId];
    const slot = SPAWN_SLOTS[seat];
    if (!handling || !slot) {
      throw new Error(`invalid seat ${seat} or vehicle ${vehicleId}`);
    }
    this.seat = seat;
    this.vehicleId = vehicleId;
    this.handling = handling;

    const { rapier, world } = sim;
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(slot.x, slot.y, slot.z)
        .setRotation({
          x: 0,
          y: Math.sin(slot.rotY / 2),
          z: 0,
          w: Math.cos(slot.rotY / 2),
        })
        .setLinearDamping(handling.linearDamping)
        .setAngularDamping(handling.angularDamping)
        .setAdditionalMass(handling.mass)
        .enabledRotations(false, true, false),
    );
    body.enableCcd(true);
    this.body = body;

    const halfX = handling.width * 0.5;
    const halfZ = handling.length * 0.5;

    this.bumper = world.createCollider(
      rapier.ColliderDesc.roundCuboid(halfX, 0.22, halfZ, 0.15)
        .setTranslation(0, 0.22, 0)
        .setRestitution(handling.bounce)
        .setFriction(0.12)
        .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS)
        .setActiveCollisionTypes(
          rapier.ActiveCollisionTypes.DEFAULT |
            rapier.ActiveCollisionTypes.DYNAMIC_DYNAMIC,
        ),
      body,
    );
    this.cabin = world.createCollider(
      rapier.ColliderDesc.cuboid(halfX * 0.75, 0.35, halfZ * 0.7)
        .setTranslation(0, 0.7, 0)
        .setRestitution(0.2)
        .setFriction(0.5),
      body,
    );
    sim.tag(this.bumper, { kind: "vehicle", seat });
    sim.tag(this.cabin, { kind: "vehicle", seat });

    readKinematics(body, handling, this.drive.kin);
  }

  kin(): DriveState["kin"] {
    return readKinematics(this.body, this.handling, this.drive.kin);
  }

  hasPowerUp(kind: PowerUpKind): boolean {
    return (this.powerUps.get(kind) ?? 0) > 0;
  }

  isTitan(): boolean {
    return this.hasPowerUp(PowerUpKind.HEAVY_HIT);
  }

  lockWreck(): void {
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setLinearDamping(ELIMINATED_DAMPING);
    this.body.setAngularDamping(ELIMINATED_DAMPING);
  }

  isDriftingRecently(tick: number, withinTicks: number): boolean {
    return this.kin().isDrifting || tick - this.lastDriftTick < withinTicks;
  }
}
