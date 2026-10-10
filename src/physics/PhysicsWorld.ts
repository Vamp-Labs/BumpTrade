import RAPIER from '@dimforge/rapier3d-compat';

export interface ColliderData {
  id: string;
  type: 'vehicle' | 'wall' | 'ground' | 'obstacle';
  entity?: any;
}

export class PhysicsWorld {
  public rapier: typeof RAPIER;
  public world: RAPIER.World;
  public eventQueue: RAPIER.EventQueue;
  private colliderDataMap: Map<number, ColliderData> = new Map();

  private constructor(rapier: typeof RAPIER, world: RAPIER.World, eventQueue: RAPIER.EventQueue) {
    this.rapier = rapier;
    this.world = world;
    this.eventQueue = eventQueue;
  }

  public static async create(): Promise<PhysicsWorld> {
    await RAPIER.init();
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    const world = new RAPIER.World(gravity);
    const eventQueue = new RAPIER.EventQueue(true);
    return new PhysicsWorld(RAPIER, world, eventQueue);
  }

  public registerCollider(collider: RAPIER.Collider, data: ColliderData): void {
    this.colliderDataMap.set(collider.handle, data);
  }

  public unregisterCollider(collider: RAPIER.Collider): void {
    this.colliderDataMap.delete(collider.handle);
  }

  public getColliderData(handle: number): ColliderData | undefined {
    return this.colliderDataMap.get(handle);
  }

  public step(fixedDeltaTime: number): void {
    this.world.timestep = fixedDeltaTime;
    this.world.step(this.eventQueue);
  }

  public getDebugRenderBuffers(): { vertices: Float32Array; colors: Float32Array } {
    return this.world.debugRender();
  }
}
