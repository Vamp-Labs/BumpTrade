import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroCar } from './HeroCar';
import { VehicleType, getVehicleConfig, VehicleArchetypeConfig } from './VehicleTypes';

export class VehicleFactory {
  public static readonly VEHICLE_TYPES: VehicleType[] = [
    'hood_bull',
    'hood_bear',
    'tsla_racer',
    'nvda_ai',
    'gold_whale',
    'gme_ape',
    'doge_kart',
  ];

  /**
   * Instantiates any vehicle archetype with its matching 3D procedural model,
   * Rapier rigid body physics tuning, CarNodeBindings, audio, and starting balance.
   */
  public static async createVehicle(
    type: VehicleType,
    id: string,
    scene: THREE.Scene,
    physicsWorld: PhysicsWorld,
    spawnPos: THREE.Vector3 = new THREE.Vector3(0, 0.4, 0),
    spawnRotY: number = 0,
    modelUrl?: string
  ): Promise<HeroCar> {
    return HeroCar.create(id, scene, physicsWorld, spawnPos, spawnRotY, type, modelUrl);
  }

  /**
   * Returns the next vehicle archetype in order (e.g. for keybinding 'V' cycle).
   */
  public static getNextVehicleType(current: VehicleType): VehicleType {
    const idx = this.VEHICLE_TYPES.indexOf(current);
    const nextIdx = (idx + 1) % this.VEHICLE_TYPES.length;
    return this.VEHICLE_TYPES[nextIdx];
  }

  /**
   * Returns full configuration for a vehicle archetype.
   */
  public static getConfig(type: VehicleType): VehicleArchetypeConfig {
    return getVehicleConfig(type);
  }

  /**
   * Returns list of all available vehicle types.
   */
  public static getAllTypes(): VehicleType[] {
    return [...this.VEHICLE_TYPES];
  }
}
