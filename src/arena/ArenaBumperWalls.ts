import * as THREE from 'three';
import { ARENA_CONFIG } from '../core/Config';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface WallSegmentDef {
  name: string;
  x: number;
  z: number;
  length: number;
  rotY: number;
}

/**
 * ArenaBumperWalls - Seamless 4-wall perimeter box.
 * Fully enclosed with 0 gaps: cars can never escape.
 * No diagonal corner obstacles: 100% open, spacious driving arena.
 */
export class ArenaBumperWalls {
  public readonly group: THREE.Group = new THREE.Group();

  // Shared Materials for optimized WebGL batching (60 FPS)
  private steelMat!: THREE.MeshStandardMaterial;
  private rubberMat!: THREE.MeshStandardMaterial;
  private amberNeonMat!: THREE.MeshStandardMaterial;
  private cyanNeonMat!: THREE.MeshStandardMaterial;
  private magentaNeonMat!: THREE.MeshStandardMaterial;
  private bracketMat!: THREE.MeshStandardMaterial;
  private hazardStripeMat!: THREE.MeshStandardMaterial;

  constructor(private physicsWorld: PhysicsWorld) {
    this.initMaterials();
    this.buildPerimeterWalls();
    this.buildCornerCaps();
  }

  private initMaterials(): void {
    const rubberTex = this.createRubberBumperTexture();
    const hazardTex = this.createHazardStripeTexture();

    this.steelMat = new THREE.MeshStandardMaterial({
      color: 0x141924,
      metalness: 0.85,
      roughness: 0.35,
    });

    this.hazardStripeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: hazardTex,
      roughness: 0.5,
      metalness: 0.2,
      emissive: new THREE.Color(0xffaa00),
      emissiveIntensity: 0.25,
    });

    this.bracketMat = new THREE.MeshStandardMaterial({
      color: 0x222a3a,
      metalness: 0.9,
      roughness: 0.25,
    });

    this.rubberMat = new THREE.MeshStandardMaterial({
      color: 0x181c26,
      roughness: 0.88,
      metalness: 0.05,
      map: rubberTex,
    });

    this.amberNeonMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff7700,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    });

    this.cyanNeonMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    this.magentaNeonMat = new THREE.MeshStandardMaterial({
      color: 0xff0055,
      emissive: 0xff0055,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });
  }

  private createRubberBumperTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Dark industrial vulcanized rubber
    ctx.fillStyle = '#151922';
    ctx.fillRect(0, 0, 512, 256);

    // Subtle rubber grain & horizontal friction ridges
    ctx.strokeStyle = '#0e121a';
    ctx.lineWidth = 4;
    for (let y = 20; y < 240; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Directional chevrons (>>>)
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let x = 60; x < 500; x += 160) {
      ctx.beginPath();
      ctx.moveTo(x, 80);
      ctx.lineTo(x + 28, 128);
      ctx.lineTo(x, 176);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(2, 1);
    tex.needsUpdate = true;
    return tex;
  }

  private createHazardStripeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Black background
    ctx.fillStyle = '#11141a';
    ctx.fillRect(0, 0, 512, 128);

    // 45-degree yellow hazard stripes
    const stripeW = 32;
    ctx.fillStyle = '#ffaa00';
    for (let x = -128; x < 512 + 128; x += stripeW * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeW, 0);
      ctx.lineTo(x + stripeW + 128, 128);
      ctx.lineTo(x + 128, 128);
      ctx.closePath();
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(16, 1);
    tex.needsUpdate = true;
    return tex;
  }

  private buildPerimeterWalls(): void {
    // Arena bounds: 47m x 47m rectangular box (half = 23.5m)
    const wallPos = 23.5;
    const wallLength = 47.0;

    const segments: WallSegmentDef[] = [
      // North Wall (Z = +23.5, local -Z faces into arena)
      { name: 'north', x: 0, z: wallPos, length: wallLength, rotY: 0 },
      // South Wall (Z = -23.5, local -Z faces into arena)
      { name: 'south', x: 0, z: -wallPos, length: wallLength, rotY: Math.PI },
      // East Wall (X = +23.5, local -Z faces into arena)
      { name: 'east', x: wallPos, z: 0, length: wallLength, rotY: -Math.PI / 2 },
      // West Wall (X = -23.5, local -Z faces into arena)
      { name: 'west', x: -wallPos, z: 0, length: wallLength, rotY: Math.PI / 2 },
    ];

    for (const seg of segments) {
      this.createModularWallSegment(seg);
    }
  }

  private createModularWallSegment(def: WallSegmentDef): void {
    const wallGroup = new THREE.Group();
    const h = ARENA_CONFIG.wallHeight; // 1.8m
    const baseDepth = 0.8;
    const cushionDepth = 0.35;
    const cushionH = 0.95;

    // 1. Base Structural Steel Channel
    const baseGeo = new THREE.BoxGeometry(def.length, 0.35, baseDepth);
    const baseMesh = new THREE.Mesh(baseGeo, this.steelMat);
    baseMesh.position.set(0, 0.175, 0);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    wallGroup.add(baseMesh);

    // 2. Upper Back Steel Frame (behind cushions)
    const backGeo = new THREE.BoxGeometry(def.length, 0.7, 0.3);
    const backMesh = new THREE.Mesh(backGeo, this.steelMat);
    backMesh.position.set(0, 1.45, 0.2);
    backMesh.castShadow = true;
    wallGroup.add(backMesh);

    // 3. SEGMENTED Rubber Bumper Cushions
    const padCount = Math.max(3, Math.floor(def.length / 2.8));
    const padGap = 0.08;
    const totalGaps = (padCount - 1) * padGap;
    const padWidth = (def.length - totalGaps - 0.2) / padCount;
    const padGeo = new THREE.BoxGeometry(padWidth, cushionH, cushionDepth);

    const padFrontZ = -baseDepth * 0.5 - cushionDepth * 0.5;

    for (let i = 0; i < padCount; i++) {
      const posX = -def.length * 0.5 + 0.1 + padWidth * 0.5 + i * (padWidth + padGap);
      const padMesh = new THREE.Mesh(padGeo, this.rubberMat);
      padMesh.position.set(posX, 0.75, padFrontZ);
      padMesh.castShadow = true;
      padMesh.receiveShadow = true;
      wallGroup.add(padMesh);

      // Steel divider bracket between cushion pads
      if (i < padCount - 1) {
        const divGeo = new THREE.BoxGeometry(padGap * 0.9, cushionH + 0.08, cushionDepth + 0.06);
        const divMesh = new THREE.Mesh(divGeo, this.bracketMat);
        divMesh.position.set(posX + padWidth * 0.5 + padGap * 0.5, 0.75, padFrontZ);
        wallGroup.add(divMesh);
      }
    }

    // 4. Horizontal Amber / Warm Orange Glowing Neon Impact Strip
    const amberStripGeo = new THREE.BoxGeometry(def.length + 0.02, 0.12, 0.08);
    const amberStripMesh = new THREE.Mesh(amberStripGeo, this.amberNeonMat);
    amberStripMesh.position.set(0, 0.75, padFrontZ - cushionDepth * 0.5 - 0.02);
    wallGroup.add(amberStripMesh);

    // 5. Vertical Steel Stanchions / Upright Posts
    const postCount = Math.floor(def.length / 3.0);
    const postSpacing = def.length / (postCount + 1);
    const postGeo = new THREE.BoxGeometry(0.22, h, 0.28);

    for (let i = 1; i <= postCount; i++) {
      const posX = -def.length * 0.5 + i * postSpacing;
      const postMesh = new THREE.Mesh(postGeo, this.bracketMat);
      postMesh.position.set(posX, h * 0.5, 0.2);
      postMesh.castShadow = true;
      wallGroup.add(postMesh);
    }

    // 6. Glowing Top Cyan Cap Rail
    const cyanRailGeo = new THREE.CylinderGeometry(0.07, 0.07, def.length, 12);
    cyanRailGeo.rotateZ(Math.PI / 2);
    const cyanRailMesh = new THREE.Mesh(cyanRailGeo, this.cyanNeonMat);
    cyanRailMesh.position.set(0, 1.72, -0.05);
    wallGroup.add(cyanRailMesh);

    // 7. Hazard Caution Warning Strip (Below Cyan Rail)
    const hazardStripGeo = new THREE.BoxGeometry(def.length, 0.12, 0.06);
    const hazardStripMesh = new THREE.Mesh(hazardStripGeo, this.hazardStripeMat);
    hazardStripMesh.position.set(0, 1.56, -0.07);
    wallGroup.add(hazardStripMesh);

    // 8. Lower Magenta Accent Trim Strip
    const magentaTrimGeo = new THREE.BoxGeometry(def.length, 0.05, 0.04);
    const magentaTrimMesh = new THREE.Mesh(magentaTrimGeo, this.magentaNeonMat);
    magentaTrimMesh.position.set(0, 0.18, -baseDepth * 0.5 - 0.01);
    wallGroup.add(magentaTrimMesh);

    // Position and orient visual group
    wallGroup.position.set(def.x, 0, def.z);
    wallGroup.rotation.y = def.rotY;
    this.group.add(wallGroup);

    // 8. Rapier Static Rigid Body & Ultra-Solid Bouncy Collider (6m tall, 2.5m thick - leakproof!)
    const colliderHeight = 6.0;
    const colliderThickness = 2.5;

    const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.fixed()
      .setTranslation(def.x, colliderHeight * 0.5, def.z)
      .setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), def.rotY));
    const body = this.physicsWorld.world.createRigidBody(bodyDesc);

    const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(
      def.length * 0.5 + 0.5, // Slight overlap at corners for 100% seal
      colliderHeight * 0.5,
      colliderThickness * 0.5
    )
      .setRestitution(ARENA_CONFIG.wallBounciness) // Authentic bouncy bumper walls!
      .setFriction(0.25)
      .setActiveEvents(this.physicsWorld.rapier.ActiveEvents.COLLISION_EVENTS);

    const collider = this.physicsWorld.world.createCollider(colliderDesc, body);
    this.physicsWorld.registerCollider(collider, { id: `wall_${def.name}`, type: 'wall' });
  }

  /**
   * Corner Pillars cleanly capping the 4 rectangular intersections.
   */
  private buildCornerCaps(): void {
    const wallPos = 23.5;
    const corners = [
      { x: wallPos, z: wallPos },
      { x: -wallPos, z: wallPos },
      { x: wallPos, z: -wallPos },
      { x: -wallPos, z: -wallPos },
    ];

    const h = ARENA_CONFIG.wallHeight + 0.3;
    const capGeo = new THREE.BoxGeometry(1.4, h, 1.4);

    const neonEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.5,
    });

    for (const c of corners) {
      const capGroup = new THREE.Group();
      capGroup.position.set(c.x, 0, c.z);

      // Solid steel corner block
      const postMesh = new THREE.Mesh(capGeo, this.steelMat);
      postMesh.position.y = h * 0.5;
      postMesh.castShadow = true;
      capGroup.add(postMesh);

      // Warning hazard stripe band around corner block
      const cornerHazardGeo = new THREE.BoxGeometry(1.44, 0.35, 1.44);
      const cornerHazardMesh = new THREE.Mesh(cornerHazardGeo, this.hazardStripeMat);
      cornerHazardMesh.position.y = h * 0.65;
      capGroup.add(cornerHazardMesh);

      // Glowing cyan top cap
      const topCapGeo = new THREE.BoxGeometry(1.45, 0.15, 1.45);
      const topCap = new THREE.Mesh(topCapGeo, neonEdgeMat);
      topCap.position.y = h + 0.05;
      capGroup.add(topCap);

      this.group.add(capGroup);

      // Corner collision reinforcement
      const bodyDesc = this.physicsWorld.rapier.RigidBodyDesc.fixed().setTranslation(c.x, 3.0, c.z);
      const body = this.physicsWorld.world.createRigidBody(bodyDesc);
      const colliderDesc = this.physicsWorld.rapier.ColliderDesc.cuboid(1.2, 3.0, 1.2)
        .setRestitution(ARENA_CONFIG.wallBounciness)
        .setFriction(0.25)
        .setActiveEvents(this.physicsWorld.rapier.ActiveEvents.COLLISION_EVENTS);
      const collider = this.physicsWorld.world.createCollider(colliderDesc, body);
      this.physicsWorld.registerCollider(collider, { id: `wall_corner_${c.x}_${c.z}`, type: 'wall' });
    }
  }
}
