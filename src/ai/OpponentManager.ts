import * as THREE from 'three';
import { HeroCar } from '../vehicles/HeroCar';
import { VehicleType } from '../vehicles/VehicleTypes';
import { VehicleFactory } from '../vehicles/VehicleFactory';
import { CarAI, AIMode } from './CarAI';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CollisionSystem } from '../collision/CollisionSystem';
import { BountySystem } from '../combat/BountySystem';

export interface OpponentEntry {
  id: string;
  vehicleType: VehicleType;
  car: HeroCar;
  ai: CarAI;
  spawnPos: THREE.Vector3;
  spawnRotY: number;
}

export class OpponentManager {
  private scene: THREE.Scene;
  private physicsWorld: PhysicsWorld;
  private collisionSystem: CollisionSystem;
  private playerCar: HeroCar;
  private opponents: Map<string, OpponentEntry> = new Map();
  private globalAIMode: AIMode = 'ACTIVE';

  constructor(
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    collisionSystem: CollisionSystem,
    playerCar: HeroCar
  ) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.collisionSystem = collisionSystem;
    this.playerCar = playerCar;
  }

  /**
   * Spawns a full 4-opponent roster (Bear, Tsla Racer, NVDA AI, Gold Whale)
   * showcasing all vehicle archetypes battling simultaneously in the arena!
   */
  public async spawnFullRoster(): Promise<void> {
    for (const id of Array.from(this.opponents.keys())) {
      this.removeOpponent(id);
    }

    // Spawn the 6 distinct opponent archetypes different from the player car
    const allTypes = VehicleFactory.getAllTypes();
    const opponentTypes = allTypes.filter((t) => t !== this.playerCar.vehicleType);

    const spawnSlots = [
      { pos: new THREE.Vector3(0, 0.4, 7.5), rotY: Math.PI },             // South Center
      { pos: new THREE.Vector3(-8.5, 0.4, 0), rotY: Math.PI * 0.4 },        // West Flank
      { pos: new THREE.Vector3(8.5, 0.4, 0), rotY: -Math.PI * 0.4 },        // East Flank
      { pos: new THREE.Vector3(0, 0.4, 15.0), rotY: Math.PI },             // Far South
      { pos: new THREE.Vector3(-7.5, 0.4, 11.5), rotY: Math.PI * 0.75 },    // Southwest Flank
      { pos: new THREE.Vector3(7.5, 0.4, 11.5), rotY: -Math.PI * 0.75 },    // Southeast Flank
    ];

    for (let i = 0; i < opponentTypes.length && i < spawnSlots.length; i++) {
      const type = opponentTypes[i];
      const slot = spawnSlots[i];
      await this.spawnOpponent(type, `opponent_${type}`, slot.pos, slot.rotY);
    }
  }

  /**
   * Spawns a new opponent vehicle of the specified archetype.
   */
  public async spawnOpponent(
    vehicleType: VehicleType,
    id: string,
    spawnPos: THREE.Vector3,
    spawnRotY: number = Math.PI
  ): Promise<HeroCar> {
    // If an opponent with this ID exists, destroy it first
    if (this.opponents.has(id)) {
      this.removeOpponent(id);
    }

    const car = await VehicleFactory.createVehicle(
      vehicleType,
      id,
      this.scene,
      this.physicsWorld,
      spawnPos,
      spawnRotY
    );

    const ai = new CarAI(car, this.playerCar, this.globalAIMode);

    // Register with collision system
    this.collisionSystem.registerVehicle(car);

    this.opponents.set(id, {
      id,
      vehicleType,
      car,
      ai,
      spawnPos: spawnPos.clone(),
      spawnRotY,
    });

    console.log(`[OpponentManager] Spawned ${car.config.displayName} (${vehicleType}) [${id}] at (${spawnPos.x}, ${spawnPos.z})`);
    return car;
  }

  /**
   * Removes and destroys an opponent vehicle.
   */
  public removeOpponent(id: string): void {
    const entry = this.opponents.get(id);
    if (!entry) return;

    this.collisionSystem.unregisterVehicle(entry.car.id);
    entry.car.destroy(this.scene, this.physicsWorld);
    this.opponents.delete(id);
  }

  /**
   * Updates player target for all opponents (e.g. after player switches car)
   * and ensures the 6 opponents represent the 6 distinct other archetypes.
   */
  public async setPlayerTarget(newPlayerCar: HeroCar): Promise<void> {
    this.playerCar = newPlayerCar;
    const allTypes: VehicleType[] = ['hood_bull', 'hood_bear', 'tsla_racer', 'nvda_ai', 'gold_whale', 'gme_ape', 'doge_kart'];
    const neededOpponents = allTypes.filter((t) => t !== newPlayerCar.vehicleType);

    for (const [id, entry] of Array.from(this.opponents.entries())) {
      if (entry.vehicleType === newPlayerCar.vehicleType) {
        const currentTypes = new Set(Array.from(this.opponents.values()).map((o) => o.vehicleType));
        const missingType = neededOpponents.find((t) => !currentTypes.has(t));
        if (missingType) {
          const spawnPos = entry.spawnPos.clone();
          const spawnRotY = entry.spawnRotY;
          this.removeOpponent(id);
          await this.spawnOpponent(missingType, `opponent_${missingType}`, spawnPos, spawnRotY);
        }
      }
    }

    for (const entry of this.opponents.values()) {
      entry.ai.setTarget(newPlayerCar);
    }
  }

  private retargetTimer: number = 0;

  /**
   * Fixed 60Hz physics tick for all opponents with dynamic bounty target selection.
   */
  public stepPhysics(dt: number): void {
    this.retargetTimer += dt;
    if (this.retargetTimer >= 0.8) {
      this.retargetTimer = 0;
      const allCars = [this.playerCar, ...this.getAllCars()];
      BountySystem.get().update(allCars);
      for (const entry of this.opponents.values()) {
        if (entry.car.controller.isEliminated()) continue;
        const target = BountySystem.get().getBestTargetForAI(entry.car, allCars);
        entry.ai.setTarget(target);
      }
    }

    for (const entry of this.opponents.values()) {
      const aiInput = entry.ai.update(dt);
      entry.car.controller.stepPhysics(dt, aiInput);
    }
  }

  /**
   * Variable framerate visual/animation update for all opponents.
   */
  public update(dt: number): void {
    for (const entry of this.opponents.values()) {
      const aiInput = entry.ai.update(0);
      entry.car.controller.update(dt, aiInput);
    }
  }

  /**
   * Resets all opponents to their original spawn locations.
   */
  public resetAll(): void {
    for (const entry of this.opponents.values()) {
      entry.car.reset(entry.spawnPos, entry.spawnRotY);
    }
  }

  /**
   * Toggles AI between ACTIVE (combat) and DUMMY (practice target) for all opponents.
   */
  public toggleAIMode(): AIMode {
    this.globalAIMode = this.globalAIMode === 'ACTIVE' ? 'DUMMY' : 'ACTIVE';
    for (const entry of this.opponents.values()) {
      entry.ai.mode = this.globalAIMode;
    }
    return this.globalAIMode;
  }

  public getAIMode(): AIMode {
    return this.globalAIMode;
  }

  /**
   * Returns list of all active opponent HeroCars.
   */
  public getAllCars(): HeroCar[] {
    return Array.from(this.opponents.values()).map((e) => e.car);
  }

  /**
   * Returns list of surviving (non-eliminated) opponent HeroCars.
   */
  public getAliveOpponents(): HeroCar[] {
    return this.getAllCars().filter((car) => !car.controller.isEliminated());
  }

  public getAliveCount(): number {
    return this.getAliveOpponents().length;
  }

  /**
   * Returns primary opponent (first registered, for 1v1 telemetry HUD).
   */
  public getPrimaryOpponent(): HeroCar | undefined {
    const first = this.opponents.values().next();
    return first.done ? undefined : first.value.car;
  }

  /**
   * Cycles the archetype of a specific opponent (or primary opponent).
   */
  public async cycleOpponentType(id: string): Promise<HeroCar | undefined> {
    const entry = this.opponents.get(id);
    if (!entry) return undefined;

    const nextType = VehicleFactory.getNextVehicleType(entry.vehicleType);
    const spawnPos = entry.spawnPos.clone();
    const spawnRotY = entry.spawnRotY;

    this.removeOpponent(id);
    return this.spawnOpponent(nextType, id, spawnPos, spawnRotY);
  }
}
