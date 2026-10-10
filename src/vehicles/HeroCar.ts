import * as THREE from 'three';
import { AssetManager } from '../core/AssetManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CarController } from './CarController';
import { CarPhysics } from './CarPhysics';
import { CarVisual } from './CarVisual';
import { CarAnimation } from './CarAnimation';
import { CarVFX } from './CarVFX';
import { CarAudio } from './CarAudio';
import { VehicleType, VehicleArchetypeConfig, getVehicleConfig } from './VehicleTypes';

export class HeroCar {
  public readonly id: string;
  public readonly root: THREE.Object3D;
  public readonly controller: CarController;
  public readonly vehicleType: VehicleType;
  public readonly config: VehicleArchetypeConfig;

  private constructor(
    id: string,
    root: THREE.Object3D,
    controller: CarController,
    vehicleType: VehicleType,
    config: VehicleArchetypeConfig
  ) {
    this.id = id;
    this.root = root;
    this.controller = controller;
    this.vehicleType = vehicleType;
    this.config = config;
  }

  public static async create(
    id: string,
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0),
    spawnRotY: number = 0,
    vehicleType: VehicleType = 'hood_bull',
    modelUrl?: string
  ): Promise<HeroCar> {
    const assetManager = AssetManager.get();
    const config = getVehicleConfig(vehicleType);

    // 1. Load Model (GLB or procedural archetype builder)
    const root = await assetManager.loadVehicle(vehicleType, modelUrl);
    root.position.copy(spawnPos);
    scene.add(root);

    // 2. Bind Node Hierarchy
    const bindings = assetManager.bindCarNodes(root);

    // 3. Initialize Subsystems with Archetype Tuning
    const physics = new CarPhysics(id, physicsWorld, spawnPos, spawnRotY, config);
    const visual = new CarVisual(bindings);
    const animation = new CarAnimation(bindings);
    const vfx = new CarVFX(scene, bindings);
    const audio = new CarAudio();

    // 4. Assemble Controller with Initial Wallet Cash Balance
    const controller = new CarController(
      physics,
      visual,
      animation,
      vfx,
      audio,
      config.baseStartingBag
    );

    return new HeroCar(id, root, controller, vehicleType, config);
  }

  public reset(spawnPos: THREE.Vector3, spawnRotY: number = 0): void {
    this.controller.reset(spawnPos, spawnRotY);
  }

  public destroy(scene: THREE.Scene, physicsWorld: PhysicsWorld): void {
    this.controller.audio.dispose();
    physicsWorld.world.removeCollider(this.controller.physics.bumperCollider, false);
    physicsWorld.world.removeCollider(this.controller.physics.chassisCollider, false);
    physicsWorld.world.removeRigidBody(this.controller.physics.body);
    scene.remove(this.root);
  }
}
