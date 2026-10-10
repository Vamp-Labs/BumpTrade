import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { HeroCar } from '../vehicles/HeroCar';
import { ArenaFloor } from './ArenaFloor';
import { ArenaBumperWalls } from './ArenaBumperWalls';
import { MarginVoidPits } from './MarginVoidPits';
import { ArenaProps } from './ArenaProps';
import { ArenaEvents } from './ArenaEvents';

/**
 * NeonMarketArena - Production 3D Environment for BUMP.TRADE
 *
 * Implements the "stylized premium 3D + futuristic arcade + neon market" specification:
 * - High-res PBR procedural floor with Candlesticks, Price Levels, and Signature Bull Emblem
 * - Modular 8-segment Outer Bumper Walls with rubber cushions & amber neon impact strips
 * - 4 Corner Margin Void Liquidation Pits with caution stripes, red hazard light bars & depth abyss
 * - Clean unobstructed overhead view (ceiling trusses/overhead lamps removed for clear top-down diorama)
 * - 4 Industrial Corner Towers, 3D Ticker Screens, and perimeter spectator environment props
 * - Production lighting hierarchy, atmospheric arena events, and Rapier3D physics colliders
 */
export class NeonMarketArena {
  public readonly scene: THREE.Scene;
  public readonly physicsWorld: PhysicsWorld;

  public readonly floor: ArenaFloor;
  public readonly bumperWalls: ArenaBumperWalls;
  public readonly voidPits: MarginVoidPits;
  public readonly props: ArenaProps;
  public readonly events: ArenaEvents;

  public ambientLight!: THREE.AmbientLight;
  public dirLight!: THREE.DirectionalLight;

  constructor(scene: THREE.Scene, physicsWorld: PhysicsWorld) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    // 1. Production Lighting Setup
    this.setupLighting();

    // 2. Main Floor & Rapier Ground Physics
    this.floor = new ArenaFloor(this.physicsWorld);
    this.scene.add(this.floor.group);

    // 3. 8-Segment Chamfered Outer Bumper Walls & Bouncy Colliders
    this.bumperWalls = new ArenaBumperWalls(this.physicsWorld);
    this.scene.add(this.bumperWalls.group);

    // 4. Margin Void hazard handler (visual pits omitted so ground remains completely flat)
    this.voidPits = new MarginVoidPits();

    // 5. Corner Towers, 3D Wall Ticker Screens & Perimeter Props (clean perimeter, no overhead roof clutter)
    this.props = new ArenaProps();
    this.scene.add(this.props.group);

    // 6. Dynamic Arena Events (Flame bursts, market flash, blackout, crash)
    this.events = new ArenaEvents(this.scene, this.ambientLight, this.dirLight);
  }

  private setupLighting(): void {
    // 1. Midnight Blue Ambient Light (subtle fill preventing pure pitch-black shadows)
    this.ambientLight = new THREE.AmbientLight(0x091220, 1.6);
    this.scene.add(this.ambientLight);

    // 2. Main Stadium Directional Key Light (crisp shadows on vehicles and bumper walls)
    this.dirLight = new THREE.DirectionalLight(0xfff6ee, 1.8);
    this.dirLight.position.set(20, 32, 22);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 100;
    this.dirLight.shadow.camera.left = -30;
    this.dirLight.shadow.camera.right = 30;
    this.dirLight.shadow.camera.top = 30;
    this.dirLight.shadow.camera.bottom = -30;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // 3. Cyber Neon Cyan Fill Light
    const fillLight = new THREE.DirectionalLight(0x00e5ff, 0.75);
    fillLight.position.set(-24, 22, -18);
    this.scene.add(fillLight);

    // 4. Neon Magenta Rim Backlight
    const rimLight = new THREE.DirectionalLight(0xff0055, 0.7);
    rimLight.position.set(0, 18, -26);
    this.scene.add(rimLight);
  }

  /**
   * Evaluates vehicle positions against the 4 Margin Void liquidation pits.
   */
  public checkVoidHazards(cars: HeroCar[]): void {
    this.voidPits.checkVoidHazards(cars);
  }

  /**
   * Updates animated arena elements (ticker text scrolling, warning beacons, electrical sparks, pyrotechnics).
   */
  public update(dt: number): void {
    this.voidPits.update(dt);
    this.props.update(dt);
    this.events.update(dt);
  }
}
