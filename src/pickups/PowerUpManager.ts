import * as THREE from 'three';
import { HeroCar } from '../vehicles/HeroCar';
import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';
import { PowerUpType, PowerUpConfig, POWER_UP_CONFIGS } from './PowerUpTypes';

export interface PowerUpItem {
  id: string;
  type: PowerUpType;
  group: THREE.Group;
  cubeMesh: THREE.Mesh;
  edgeLines: THREE.LineSegments;
  cornerGroup: THREE.Group;
  ringMesh1: THREE.Mesh;
  ringMesh2: THREE.Mesh;
  holoSprite: THREE.Sprite;
  sparkles: THREE.Mesh[];
  groundDecal: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
  baseY: number;
  age: number;
  isCollected: boolean;
}

interface TextureCacheEntry {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  groundMap: THREE.CanvasTexture;
  holoMap: THREE.CanvasTexture;
}

export class PowerUpManager {
  private scene: THREE.Scene;
  private powerUps: PowerUpItem[] = [];
  private nextId: number = 1;

  // Shared reusable geometries
  private cubeGeo: THREE.BoxGeometry;
  private edgeGeo: THREE.EdgesGeometry;
  private cornerGeo: THREE.BoxGeometry;
  private ringGeo1: THREE.TorusGeometry;
  private ringGeo2: THREE.TorusGeometry;
  private sparkleGeo: THREE.OctahedronGeometry;
  private groundGeo: THREE.PlaneGeometry;

  // Shared corner gold material
  private goldCornerMat: THREE.MeshStandardMaterial;

  // Cached procedural textures per power-up type
  private static textureCache: Map<PowerUpType, TextureCacheEntry> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Stylized Arcade Lucky Box Dimensions (~0.85m cube)
    this.cubeGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
    this.edgeGeo = new THREE.EdgesGeometry(this.cubeGeo);
    this.cornerGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    this.ringGeo1 = new THREE.TorusGeometry(0.96, 0.035, 12, 36);
    this.ringGeo2 = new THREE.TorusGeometry(1.12, 0.028, 12, 36);
    this.sparkleGeo = new THREE.OctahedronGeometry(0.075, 0);

    // Flat ground decal facing UP
    this.groundGeo = new THREE.PlaneGeometry(2.4, 2.4);
    this.groundGeo.rotateX(-Math.PI / 2);

    this.goldCornerMat = new THREE.MeshStandardMaterial({
      color: 0xdeb853,
      metalness: 0.95,
      roughness: 0.18,
      emissive: 0x3d2800,
      emissiveIntensity: 0.3,
    });
  }

  /**
   * Generates high-res procedural 6-face lucky box textures (diffuse + emissive bloom map)
   */
  private static generateLuckyBoxTextures(config: PowerUpConfig): TextureCacheEntry {
    const size = 512;

    // -------------------------------------------------------------------------
    // 1. Diffuse Face Texture (Deep gunmetal crate, gold corner brackets, bolts, neon seam, ?)
    // -------------------------------------------------------------------------
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1a. Base Dark Gunmetal Metallic Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, size, size);
    bgGrad.addColorStop(0, '#162232');
    bgGrad.addColorStop(0.5, '#0e1622');
    bgGrad.addColorStop(1, '#070b10');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 1b. Brushed Carbon / Cyber Hatching Pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }

    // 1c. Chamfered Outer Beveled Frame (40px border)
    const frameGrad = ctx.createLinearGradient(0, 0, size, 0);
    frameGrad.addColorStop(0, '#4a6078');
    frameGrad.addColorStop(0.5, '#222f3e');
    frameGrad.addColorStop(1, '#3b4d61');
    ctx.strokeStyle = frameGrad;
    ctx.lineWidth = 28;
    ctx.strokeRect(14, 14, size - 28, size - 28);

    // 1d. Heavy Gold / Chrome Reinforced L-Corner Brackets
    const drawCornerBracket = (x: number, y: number, rot: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);

      const bGrad = ctx.createLinearGradient(0, 0, 75, 75);
      bGrad.addColorStop(0, '#ffe073');
      bGrad.addColorStop(0.5, '#caa03d');
      bGrad.addColorStop(1, '#7a5a15');
      ctx.fillStyle = bGrad;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(82, 0);
      ctx.lineTo(82, 30);
      ctx.lineTo(30, 30);
      ctx.lineTo(30, 82);
      ctx.lineTo(0, 82);
      ctx.closePath();
      ctx.fill();

      // Bracket highlight edge
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    };

    drawCornerBracket(0, 0, 0);
    drawCornerBracket(size, 0, Math.PI / 2);
    drawCornerBracket(size, size, Math.PI);
    drawCornerBracket(0, size, -Math.PI / 2);

    // 1e. Industrial Heavy Rivets / Hex Bolts
    const drawBolt = (bx: number, by: number) => {
      ctx.save();
      // Outer shadow
      ctx.fillStyle = '#030508';
      ctx.beginPath();
      ctx.arc(bx + 1, by + 2, 9, 0, Math.PI * 2);
      ctx.fill();

      // Bolt body
      const boltGrad = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 8);
      boltGrad.addColorStop(0, '#ffffff');
      boltGrad.addColorStop(0.4, '#c2d2e2');
      boltGrad.addColorStop(1, '#475a6c');
      ctx.fillStyle = boltGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 8, 0, Math.PI * 2);
      ctx.fill();

      // Specular rim
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Center hex/cross socket
      ctx.fillStyle = '#080c12';
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    // 4 Corner bolts
    drawBolt(24, 24);
    drawBolt(size - 24, 24);
    drawBolt(size - 24, size - 24);
    drawBolt(24, size - 24);

    // 4 Mid-edge bolts
    drawBolt(size / 2, 14);
    drawBolt(size / 2, size - 14);
    drawBolt(14, size / 2);
    drawBolt(size - 14, size / 2);

    // 1f. Glowing Neon Inner Frame / Seams
    const inset = 54;
    const innerW = size - inset * 2;
    ctx.save();
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = config.glowColor;
    ctx.lineWidth = 6;
    ctx.strokeRect(inset, inset, innerW, innerW);

    // Second intense core line
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(inset, inset, innerW, innerW);
    ctx.restore();

    // 1g. Central Neon Halo Radial Glow
    const haloGrad = ctx.createRadialGradient(size / 2, size / 2, 20, size / 2, size / 2, 160);
    haloGrad.addColorStop(0, config.glowColor);
    haloGrad.addColorStop(0.45, config.glowColor + '44');
    haloGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = haloGrad;
    ctx.fillRect(inset, inset, innerW, innerW);

    // 1h. Mini Lucky Corner Stars ★
    ctx.save();
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffe066';
    ctx.shadowColor = '#ffb700';
    ctx.shadowBlur = 12;
    const starOff = 92;
    ctx.fillText('★', starOff, starOff);
    ctx.fillText('★', size - starOff, starOff);
    ctx.fillText('★', size - starOff, size - starOff);
    ctx.fillText('★', starOff, size - starOff);
    ctx.restore();

    // 1i. Massive Stylized Arcade Lucky Question Mark "?"
    ctx.save();
    ctx.font = '900 230px "Impact", "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Intense neon outer glow
    ctx.shadowColor = config.glowColor;
    ctx.shadowBlur = 32;

    // Deep dark contrast bevel stroke
    ctx.strokeStyle = '#050a12';
    ctx.lineWidth = 20;
    ctx.strokeText('?', size / 2, size / 2 + 10);

    // Second gold bevel outline
    ctx.strokeStyle = '#caa03d';
    ctx.lineWidth = 10;
    ctx.strokeText('?', size / 2, size / 2 + 10);

    // Golden / Hot Neon Gradient Fill
    const qGrad = ctx.createLinearGradient(0, size / 2 - 110, 0, size / 2 + 110);
    qGrad.addColorStop(0, '#ffffff');
    qGrad.addColorStop(0.3, '#fff48f');
    qGrad.addColorStop(0.7, '#ffb800');
    qGrad.addColorStop(1, '#ff8000');
    ctx.fillStyle = qGrad;
    ctx.fillText('?', size / 2, size / 2 + 10);
    ctx.restore();

    // -------------------------------------------------------------------------
    // 2. Emissive Bloom Map (Black canvas with pure glowing neon lines, ? and stars)
    // -------------------------------------------------------------------------
    const eCanvas = document.createElement('canvas');
    eCanvas.width = size;
    eCanvas.height = size;
    const eCtx = eCanvas.getContext('2d')!;

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, size, size);

    // Glowing Neon Inner Seam
    eCtx.save();
    eCtx.shadowColor = config.glowColor;
    eCtx.shadowBlur = 24;
    eCtx.strokeStyle = config.glowColor;
    eCtx.lineWidth = 8;
    eCtx.strokeRect(inset, inset, innerW, innerW);
    eCtx.restore();

    // Glowing Question Mark
    eCtx.save();
    eCtx.font = '900 230px "Impact", "Arial Black", sans-serif';
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.shadowColor = config.glowColor;
    eCtx.shadowBlur = 36;
    eCtx.fillStyle = config.glowColor;
    eCtx.fillText('?', size / 2, size / 2 + 10);
    eCtx.fillStyle = '#ffffff';
    eCtx.fillText('?', size / 2, size / 2 + 10);
    eCtx.restore();

    // Glowing Stars
    eCtx.save();
    eCtx.font = 'bold 36px "Segoe UI", sans-serif';
    eCtx.textAlign = 'center';
    eCtx.textBaseline = 'middle';
    eCtx.fillStyle = '#ffe066';
    eCtx.shadowColor = '#ffb700';
    eCtx.shadowBlur = 18;
    eCtx.fillText('★', starOff, starOff);
    eCtx.fillText('★', size - starOff, starOff);
    eCtx.fillText('★', size - starOff, size - starOff);
    eCtx.fillText('★', starOff, size - starOff);
    eCtx.restore();

    // -------------------------------------------------------------------------
    // 3. Ground Decal Texture ("★ LUCKY BOX ★" Arcade Circle)
    // -------------------------------------------------------------------------
    const gCanvas = document.createElement('canvas');
    gCanvas.width = size;
    gCanvas.height = size;
    const gCtx = gCanvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    // Radial backdrop fade
    const gBack = gCtx.createRadialGradient(cx, cy, 30, cx, cy, 240);
    gBack.addColorStop(0, config.glowColor + '66');
    gBack.addColorStop(0.5, config.glowColor + '22');
    gBack.addColorStop(1, 'transparent');
    gCtx.fillStyle = gBack;
    gCtx.fillRect(0, 0, size, size);

    // Dashed Outer Ring
    gCtx.save();
    gCtx.shadowColor = config.glowColor;
    gCtx.shadowBlur = 16;
    gCtx.strokeStyle = config.glowColor;
    gCtx.lineWidth = 6;
    gCtx.setLineDash([16, 12]);
    gCtx.beginPath();
    gCtx.arc(cx, cy, 220, 0, Math.PI * 2);
    gCtx.stroke();
    gCtx.restore();

    // Solid Middle Ring
    gCtx.save();
    gCtx.strokeStyle = '#ffffff';
    gCtx.lineWidth = 3;
    gCtx.beginPath();
    gCtx.arc(cx, cy, 185, 0, Math.PI * 2);
    gCtx.stroke();
    gCtx.restore();

    // Circular Arcade Text "★ LUCKY BOX ★"
    gCtx.save();
    gCtx.fillStyle = '#ffffff';
    gCtx.shadowColor = config.glowColor;
    gCtx.shadowBlur = 14;
    gCtx.font = 'bold 22px "Impact", sans-serif';
    gCtx.textAlign = 'center';
    gCtx.textBaseline = 'middle';

    const text = '★ LUCKY BOX ★ SURPRISE SURGE ★';
    const angleStep = (Math.PI * 2) / text.length;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charAngle = i * angleStep - Math.PI / 2;
      gCtx.save();
      gCtx.translate(cx + Math.cos(charAngle) * 155, cy + Math.sin(charAngle) * 155);
      gCtx.rotate(charAngle + Math.PI / 2);
      gCtx.fillText(char, 0, 0);
      gCtx.restore();
    }
    gCtx.restore();

    // Center 8-pointed starburst
    gCtx.save();
    gCtx.fillStyle = config.glowColor;
    gCtx.shadowColor = config.glowColor;
    gCtx.shadowBlur = 20;
    gCtx.beginPath();
    const points = 8;
    const outerR = 90;
    const innerR = 40;
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI) / points;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) gCtx.moveTo(px, py);
      else gCtx.lineTo(px, py);
    }
    gCtx.closePath();
    gCtx.fill();
    gCtx.restore();

    // -------------------------------------------------------------------------
    // 4. Holographic Billboard Icon Texture (Floating above Lucky Box)
    // -------------------------------------------------------------------------
    const hCanvas = document.createElement('canvas');
    hCanvas.width = 256;
    hCanvas.height = 256;
    const hCtx = hCanvas.getContext('2d')!;

    // Diamond holographic badge
    hCtx.save();
    hCtx.translate(128, 128);
    hCtx.rotate(Math.PI / 4);
    hCtx.strokeStyle = config.glowColor;
    hCtx.lineWidth = 6;
    hCtx.shadowColor = config.glowColor;
    hCtx.shadowBlur = 18;
    hCtx.strokeRect(-65, -65, 130, 130);

    hCtx.fillStyle = config.glowColor + '33';
    hCtx.fillRect(-65, -65, 130, 130);
    hCtx.restore();

    // Central Icon (e.g. ⚡, 💥, 🧲, 🛡)
    hCtx.save();
    hCtx.font = 'bold 96px "Segoe UI Emoji", sans-serif';
    hCtx.textAlign = 'center';
    hCtx.textBaseline = 'middle';
    hCtx.shadowColor = config.glowColor;
    hCtx.shadowBlur = 24;
    hCtx.fillText(config.icon, 128, 128);
    hCtx.restore();

    const map = new THREE.CanvasTexture(canvas);
    const emissiveMap = new THREE.CanvasTexture(eCanvas);
    const groundMap = new THREE.CanvasTexture(gCanvas);
    const holoMap = new THREE.CanvasTexture(hCanvas);

    return { map, emissiveMap, groundMap, holoMap };
  }

  private getCachedTextures(type: PowerUpType): TextureCacheEntry {
    let entry = PowerUpManager.textureCache.get(type);
    if (!entry) {
      entry = PowerUpManager.generateLuckyBoxTextures(POWER_UP_CONFIGS[type]);
      PowerUpManager.textureCache.set(type, entry);
    }
    return entry;
  }

  /**
   * Spawns a stylized Lucky Box power-up at arena world coordinates (x, z).
   */
  public spawnPowerUp(type: PowerUpType, x: number, z: number): PowerUpItem {
    const config = POWER_UP_CONFIGS[type];
    const group = new THREE.Group();
    const id = `powerup_${this.nextId++}`;
    const baseY = 1.05;

    const tex = this.getCachedTextures(type);

    // 1. Central Lucky Box Cube Mesh with 6-face procedural texture & emissive bloom
    const cubeMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      emissiveMap: tex.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.4,
      metalness: 0.88,
      roughness: 0.22,
    });
    const cubeMesh = new THREE.Mesh(this.cubeGeo, cubeMat);
    cubeMesh.castShadow = true;
    group.add(cubeMesh);

    // 1b. Stylized Glowing Edge Wireframe Lines
    const edgeMat = new THREE.LineBasicMaterial({
      color: config.color,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
    });
    const edgeLines = new THREE.LineSegments(this.edgeGeo, edgeMat);
    cubeMesh.add(edgeLines);

    // 1c. 3D Golden Reinforced Corner Brackets (8 corners of the cube)
    const cornerGroup = new THREE.Group();
    const half = 0.425;
    const cornerCoords = [
      [-half, -half, -half],
      [half, -half, -half],
      [-half, half, -half],
      [half, half, -half],
      [-half, -half, half],
      [half, -half, half],
      [-half, half, half],
      [half, half, half],
    ];
    for (const [cx, cy, cz] of cornerCoords) {
      const cMesh = new THREE.Mesh(this.cornerGeo, this.goldCornerMat);
      cMesh.position.set(cx, cy, cz);
      cornerGroup.add(cMesh);
    }
    cubeMesh.add(cornerGroup);

    // 2. Holographic Floating Icon Billboard above the Lucky Box
    const spriteMat = new THREE.SpriteMaterial({
      map: tex.holoMap,
      transparent: true,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    });
    const holoSprite = new THREE.Sprite(spriteMat);
    holoSprite.position.set(0, 0.92, 0);
    holoSprite.scale.set(0.9, 0.9, 0.9);
    group.add(holoSprite);

    // 3. Dual Gyroscopic Neon Orbital Rings
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: config.color,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh1 = new THREE.Mesh(this.ringGeo1, ringMat1);
    group.add(ringMesh1);

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xffe066, // Golden contrasting ring
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });
    const ringMesh2 = new THREE.Mesh(this.ringGeo2, ringMat2);
    ringMesh2.rotation.x = Math.PI / 4;
    group.add(ringMesh2);

    // 4. Sparkle Orbiting Octahedrons
    const sparkles: THREE.Mesh[] = [];
    const sparkleMat = new THREE.MeshBasicMaterial({
      color: config.color,
      wireframe: false,
    });
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(this.sparkleGeo, sparkleMat);
      sparkles.push(sp);
      group.add(sp);
    }

    // 5. Stylized Arcade Ground Decal
    const groundMat = new THREE.MeshBasicMaterial({
      map: tex.groundMap,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const groundDecal = new THREE.Mesh(this.groundGeo, groundMat);
    groundDecal.position.y = -baseY + 0.04;
    group.add(groundDecal);

    // 6. Dynamic Glow PointLight
    const light = new THREE.PointLight(config.color, 2.8, 7.0);
    light.position.set(0, 0, 0);
    group.add(light);

    // Set world placement
    group.position.set(x, baseY, z);
    this.scene.add(group);

    const item: PowerUpItem = {
      id,
      type,
      group,
      cubeMesh,
      edgeLines,
      cornerGroup,
      ringMesh1,
      ringMesh2,
      holoSprite,
      sparkles,
      groundDecal,
      light,
      position: group.position,
      baseY,
      age: 0,
      isCollected: false,
    };

    this.powerUps.push(item);
    SoundManager.get().playPowerupSpawn();

    return item;
  }

  /**
   * Spawns a random power-up at an arena location or random location.
   */
  public spawnRandomPowerUp(x?: number, z?: number): PowerUpItem {
    const types: PowerUpType[] = ['TURBO', 'TITAN', 'CASH_MAGNET', 'SHIELD'];
    const chosenType = types[Math.floor(Math.random() * types.length)];

    const spawnX = x ?? (Math.random() - 0.5) * 26.0;
    const spawnZ = z ?? (Math.random() - 0.5) * 26.0;

    return this.spawnPowerUp(chosenType, spawnX, spawnZ);
  }

  /**
   * Spawns a batch of power-ups for the Market Drop Event.
   */
  public spawnMarketDropBatch(): void {
    if (this.powerUps.length >= 4) {
      this.clearOldest();
    }

    const dropPoints = [
      { type: 'TURBO' as PowerUpType, x: -8, z: 0 },
      { type: 'TITAN' as PowerUpType, x: 8, z: 0 },
      { type: 'CASH_MAGNET' as PowerUpType, x: 0, z: -8 },
      { type: 'SHIELD' as PowerUpType, x: 0, z: 8 },
    ];

    dropPoints.forEach((pt) => {
      this.spawnPowerUp(pt.type, pt.x, pt.z);
    });
  }

  public update(dt: number, cars: HeroCar[]): void {
    const pickupRadius = 2.2; // Comfortable contact radius for bumper cars

    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.age += dt;

      // 1. Bobbing and floating Lucky Box physics animation
      const hoverY = p.baseY + Math.sin(p.age * 2.8) * 0.16;
      p.group.position.y = hoverY;

      // Rotate Lucky Box cube
      p.cubeMesh.rotation.y += 1.5 * dt;
      p.cubeMesh.rotation.x += 0.8 * dt;

      // Gyroscopic counter-rotating orbital rings
      p.ringMesh1.rotation.x += 2.0 * dt;
      p.ringMesh1.rotation.z += 1.5 * dt;
      p.ringMesh2.rotation.y -= 1.8 * dt;
      p.ringMesh2.rotation.x += 1.2 * dt;

      // Holographic symbol gentle pulse and bob
      const holoScale = 0.88 + Math.sin(p.age * 4.0) * 0.12;
      p.holoSprite.scale.set(holoScale, holoScale, holoScale);
      p.holoSprite.position.y = 0.92 + Math.sin(p.age * 3.5) * 0.08;

      // Orbiting sparkle particles
      for (let sIdx = 0; sIdx < p.sparkles.length; sIdx++) {
        const angle = p.age * 2.4 + (sIdx * Math.PI) / 2;
        const radius = 0.95 + Math.sin(p.age * 2.0 + sIdx) * 0.15;
        const spY = Math.sin(p.age * 3.0 + sIdx * 1.5) * 0.35;
        p.sparkles[sIdx].position.set(Math.cos(angle) * radius, spY, Math.sin(angle) * radius);
        p.sparkles[sIdx].rotation.x += 3.0 * dt;
        p.sparkles[sIdx].rotation.y += 3.0 * dt;
      }

      // Pulse ground decal and light
      const pulse = 0.85 + Math.sin(p.age * 4.5) * 0.15;
      p.light.intensity = 2.6 * pulse;
      (p.groundDecal.material as THREE.MeshBasicMaterial).opacity = 0.55 * pulse;
      p.groundDecal.rotation.z += 0.4 * dt; // Slow rotation of arcade ring

      // 2. Collision / Collection check with vehicles
      for (const car of cars) {
        const carPos = car.controller.getPhysicsState().position;
        const distToCar = new THREE.Vector2(carPos.x - p.position.x, carPos.z - p.position.z).length();

        if (distToCar <= pickupRadius) {
          // Collected!
          p.isCollected = true;

          // Apply power-up to vehicle
          car.controller.applyPowerUp(p.type);

          // Audio
          SoundManager.get().playPowerupCollect(p.type);

          // Emit EventBus notification
          EventBus.get().emit('powerup_collected', {
            carId: car.id,
            isPlayer: car.id === 'player_car',
            type: p.type,
            config: POWER_UP_CONFIGS[p.type],
            position: p.position.clone(),
          });

          // Cleanup and remove
          this.removePowerUp(i);
          break;
        }
      }
    }
  }

  private removePowerUp(index: number): void {
    const p = this.powerUps[index];
    this.scene.remove(p.group);
    this.powerUps.splice(index, 1);
  }

  public clearAll(): void {
    for (const p of this.powerUps) {
      this.scene.remove(p.group);
    }
    this.powerUps = [];
  }

  private clearOldest(): void {
    if (this.powerUps.length > 0) {
      this.removePowerUp(0);
    }
  }

  public getCount(): number {
    return this.powerUps.length;
  }
}
