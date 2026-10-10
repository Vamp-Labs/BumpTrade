import * as THREE from 'three';
import { ARENA_CONFIG } from '../core/Config';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ArenaFloorTextureGenerator } from './ArenaFloorTextureGenerator';

/**
 * ArenaFloor - Stylized 3D Neon Trading Floor with PBR synthesis.
 * Features:
 * - High-resolution 2048x2048 PBR canvas maps (Albedo, Normal, Roughness, Emissive)
 * - Central Bull Mascot Emblem ($12m \times 12m$) with crimson outline & glowing green horns
 * - Financial candlestick patterns, price levels, and modular tile grooves
 * - 100% flat surface with zero collision interference
 */
export class ArenaFloor {
  public readonly group: THREE.Group = new THREE.Group();
  public floorMesh: THREE.Mesh;

  constructor(private physicsWorld: PhysicsWorld) {
    this.floorMesh = this.buildFloorMesh();
    this.group.add(this.floorMesh);
    this.buildPhysicsGround();
  }

  private buildFloorMesh(): THREE.Mesh {
    const w = ARENA_CONFIG.width;
    const l = ARENA_CONFIG.length;

    // Completely flat plane across the 48m x 48m arena
    const geometry = new THREE.PlaneGeometry(w, l);
    geometry.rotateX(-Math.PI / 2);

    // Procedural 2048x2048 PBR texture suite
    const pbr = ArenaFloorTextureGenerator.generateTextures();

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: pbr.map,
      normalMap: pbr.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: pbr.roughnessMap,
      roughness: 0.86,
      metalness: 0.15,
      emissiveMap: pbr.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.85,
    });

    const mesh = new THREE.Mesh(geometry, floorMat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private buildPhysicsGround(): void {
    const halfW = ARENA_CONFIG.width * 0.5;
    const halfL = ARENA_CONFIG.length * 0.5;

    // Rapier Static Ground Collider
    const groundBody = this.physicsWorld.world.createRigidBody(
      this.physicsWorld.rapier.RigidBodyDesc.fixed()
    );

    const groundDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(halfW + 4, 0.1, halfL + 4)
      .setTranslation(0, -0.1, 0)
      .setRestitution(0.1)
      .setFriction(1.0);

    const groundCollider = this.physicsWorld.world.createCollider(groundDesc, groundBody);
    this.physicsWorld.registerCollider(groundCollider, { id: 'ground', type: 'ground' });
  }
}
