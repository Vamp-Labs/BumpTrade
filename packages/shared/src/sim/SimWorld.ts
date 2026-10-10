import RAPIER from "@dimforge/rapier3d-compat";
import {
  ARENA_HALF_EXTENT,
  ARENA_WALL_LENGTH,
  ARENA_WALL_POS,
  FIXED_DT,
  GRAVITY_Y,
} from "./constants";

export type ColliderTag =
  | { kind: "vehicle"; seat: number }
  | { kind: "wall" }
  | { kind: "ground" };

const WALL_RESTITUTION = 0.75;

let rapierReady: Promise<void> | null = null;

const ensureRapier = (): Promise<void> => {
  rapierReady ??= RAPIER.init();
  return rapierReady;
};

export class SimWorld {
  readonly rapier: typeof RAPIER;
  readonly world: RAPIER.World;
  readonly eventQueue: RAPIER.EventQueue;
  private readonly tags = new Map<number, ColliderTag>();

  private constructor(
    rapier: typeof RAPIER,
    world: RAPIER.World,
    eventQueue: RAPIER.EventQueue,
  ) {
    this.rapier = rapier;
    this.world = world;
    this.eventQueue = eventQueue;
  }

  static async create(): Promise<SimWorld> {
    await ensureRapier();
    const world = new RAPIER.World(new RAPIER.Vector3(0.0, GRAVITY_Y, 0.0));
    world.timestep = FIXED_DT;
    const eventQueue = new RAPIER.EventQueue(true);
    const sim = new SimWorld(RAPIER, world, eventQueue);
    sim.buildArena();
    return sim;
  }

  tag(collider: RAPIER.Collider, tag: ColliderTag): void {
    this.tags.set(collider.handle, tag);
  }

  tagOf(handle: number): ColliderTag | undefined {
    return this.tags.get(handle);
  }

  step(): void {
    this.world.step(this.eventQueue);
  }

  prime(): void {
    this.world.step(this.eventQueue);
    this.eventQueue.clear();
  }

  free(): void {
    this.eventQueue.free();
    this.world.free();
  }

  private buildArena(): void {
    const { rapier, world } = this;

    const groundBody = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    const groundDesc = rapier.ColliderDesc.cuboid(
      ARENA_HALF_EXTENT + 4,
      0.1,
      ARENA_HALF_EXTENT + 4,
    )
      .setTranslation(0, -0.1, 0)
      .setRestitution(0.1)
      .setFriction(1.0);
    this.tag(world.createCollider(groundDesc, groundBody), { kind: "ground" });

    const walls = [
      { x: 0, z: ARENA_WALL_POS, rotY: 0 },
      { x: 0, z: -ARENA_WALL_POS, rotY: Math.PI },
      { x: ARENA_WALL_POS, z: 0, rotY: -Math.PI / 2 },
      { x: -ARENA_WALL_POS, z: 0, rotY: Math.PI / 2 },
    ];
    const wallHeight = 6.0;
    const wallThickness = 2.5;

    for (const wall of walls) {
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed()
          .setTranslation(wall.x, wallHeight * 0.5, wall.z)
          .setRotation({
            x: 0,
            y: Math.sin(wall.rotY / 2),
            z: 0,
            w: Math.cos(wall.rotY / 2),
          }),
      );
      const desc = rapier.ColliderDesc.cuboid(
        ARENA_WALL_LENGTH * 0.5 + 0.5,
        wallHeight * 0.5,
        wallThickness * 0.5,
      )
        .setRestitution(WALL_RESTITUTION)
        .setFriction(0.25)
        .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);
      this.tag(world.createCollider(desc, body), { kind: "wall" });
    }

    const corners = [
      { x: ARENA_WALL_POS, z: ARENA_WALL_POS },
      { x: -ARENA_WALL_POS, z: ARENA_WALL_POS },
      { x: ARENA_WALL_POS, z: -ARENA_WALL_POS },
      { x: -ARENA_WALL_POS, z: -ARENA_WALL_POS },
    ];
    for (const corner of corners) {
      const body = world.createRigidBody(
        rapier.RigidBodyDesc.fixed().setTranslation(corner.x, 3.0, corner.z),
      );
      const desc = rapier.ColliderDesc.cuboid(1.2, 3.0, 1.2)
        .setRestitution(WALL_RESTITUTION)
        .setFriction(0.25)
        .setActiveEvents(rapier.ActiveEvents.COLLISION_EVENTS);
      this.tag(world.createCollider(desc, body), { kind: "wall" });
    }
  }
}
