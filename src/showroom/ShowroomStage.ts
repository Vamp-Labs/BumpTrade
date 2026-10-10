import * as THREE from 'three';
import { VehicleType, getVehicleConfig } from '../vehicles/VehicleTypes';
import { AssetManager } from '../core/AssetManager';

export type ShowroomMode = 'MAIN_MENU' | 'VEHICLE_SELECT' | 'LEADERBOARD';

export class ShowroomStage {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  private currentMode: ShowroomMode = 'MAIN_MENU';
  private currentVehicleType: VehicleType = 'hood_bull';

  public getCurrentVehicleType(): VehicleType {
    return this.currentVehicleType;
  }

  // Scene structures
  private turntableGroup: THREE.Group;
  private platter: THREE.Group;
  private carSlot: THREE.Group;
  private turntableRimMesh!: THREE.Mesh;
  private overheadGroup: THREE.Group;
  private overheadHaloMesh!: THREE.Mesh;

  private podiumGroup: THREE.Group;
  private podiumCarSlots: {
    slot1: THREE.Group;
    slot2: THREE.Group;
    slot3: THREE.Group;
  };

  // Lighting
  private keySpotlight!: THREE.SpotLight;
  private rimSpotlight!: THREE.SpotLight;
  private underTurntableLight!: THREE.PointLight;
  private podiumSpotlights: THREE.SpotLight[] = [];

  // Vehicle models cache
  private vehicleModels: Map<VehicleType, THREE.Object3D> = new Map();
  private podiumModels: {
    goldWhale?: THREE.Object3D;
    hoodBear?: THREE.Object3D;
    tslaRacer?: THREE.Object3D;
  } = {};

  // Camera targets for smooth cinematic lerp
  private currentCamPos: THREE.Vector3 = new THREE.Vector3(-1.8, 1.5, 4.8);
  private targetCamPos: THREE.Vector3 = new THREE.Vector3(-1.8, 1.5, 4.8);
  private currentLookAt: THREE.Vector3 = new THREE.Vector3(0.7, 0.65, 0);
  private targetLookAt: THREE.Vector3 = new THREE.Vector3(0.7, 0.65, 0);

  // Turntable interaction
  private autoRotateSpeed: number = 0.45;
  private isUserDragging: boolean = false;
  private dragPrevX: number = 0;
  private userDragVelocity: number = 0;

  // Transition animation for vehicle change
  private isTransitioningVehicle: boolean = false;
  private transitionTimer: number = 0;
  private nextVehicleToLoad: VehicleType | null = null;

  constructor(aspect: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0e1422);
    this.scene.fog = new THREE.FogExp2(0x0e1422, 0.016);

    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 100);
    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    this.turntableGroup = new THREE.Group();
    this.platter = new THREE.Group();
    this.carSlot = new THREE.Group();

    this.overheadGroup = new THREE.Group();
    this.scene.add(this.overheadGroup);

    this.podiumGroup = new THREE.Group();
    this.podiumCarSlots = {
      slot1: new THREE.Group(),
      slot2: new THREE.Group(),
      slot3: new THREE.Group(),
    };

    this.setupEnvironment();
    this.setupTurntable();
    this.setupPodium();
    this.setupLighting();
    this.setupInteractionListeners();
  }

  /**
   * Generates a procedural radial studio gradient texture for the showroom floor.
   */
  private createStudioFloorTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    grad.addColorStop(0, '#222f46');
    grad.addColorStop(0.35, '#182234');
    grad.addColorStop(0.7, '#121a28');
    grad.addColorStop(1.0, '#0c121e');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * Initializes procedural showroom environment: reflective floor, background cyber pillars,
   * overhead halo ring light.
   */
  private setupEnvironment(): void {
    // 1. High-reflective dark studio floor with subtle radial gradient
    const floorGeo = new THREE.CircleGeometry(26, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161e2e,
      map: this.createStudioFloorTexture(),
      roughness: 0.22,
      metalness: 0.75,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -0.01;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // Subtle concentric grid rings on the floor
    const ringRadii = [4.5, 7.5, 11.0, 15.0];
    ringRadii.forEach((r) => {
      const ringGeo = new THREE.RingGeometry(r - 0.02, r + 0.02, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        transparent: true,
        opacity: 0.07,
        side: THREE.DoubleSide,
      });
      const rMesh = new THREE.Mesh(ringGeo, ringMat);
      rMesh.rotation.x = -Math.PI / 2;
      rMesh.position.y = 0.005;
      this.scene.add(rMesh);
    });

    // 2. Cyber showroom architectural background pillars (soft warehouse ambiance)
    const pillarCount = 8;
    const arcRadius = 14.0;
    const startAngle = -Math.PI * 0.55;
    const endAngle = Math.PI * 0.55;

    for (let i = 0; i < pillarCount; i++) {
      const angle = startAngle + (i / (pillarCount - 1)) * (endAngle - startAngle);
      const px = Math.sin(angle) * arcRadius;
      const pz = -Math.cos(angle) * arcRadius;

      // Dark pillar
      const colGeo = new THREE.BoxGeometry(0.8, 12, 0.8);
      const colMat = new THREE.MeshStandardMaterial({
        color: 0x121926,
        roughness: 0.55,
        metalness: 0.75,
      });
      const colMesh = new THREE.Mesh(colGeo, colMat);
      colMesh.position.set(px, 5.0, pz);
      this.scene.add(colMesh);

      // Vertical glowing LED strip on pillar face
      const stripGeo = new THREE.PlaneGeometry(0.06, 8.0);
      const stripColor = i % 2 === 0 ? 0x00ff88 : 0x00b4d8;
      const stripMat = new THREE.MeshBasicMaterial({
        color: stripColor,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
      });
      const stripMesh = new THREE.Mesh(stripGeo, stripMat);
      stripMesh.position.set(px, 5.0, pz + 0.42);
      this.scene.add(stripMesh);
    }

    // 3. Suspended ceiling overhead halo ring (matches vehicle glow color)
    const haloGeo = new THREE.TorusGeometry(3.2, 0.038, 16, 64);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x00ff6a,
    });
    this.overheadHaloMesh = new THREE.Mesh(haloGeo, haloMat);
    this.overheadHaloMesh.rotation.x = Math.PI / 2;
    this.overheadHaloMesh.position.set(0, 3.8, 0);
    this.overheadGroup.add(this.overheadHaloMesh);

    // Overhead suspension cables
    for (let c = 0; c < 3; c++) {
      const a = (c * Math.PI * 2) / 3;
      const cx = Math.cos(a) * 3.2;
      const cz = Math.sin(a) * 3.2;
      const cableGeo = new THREE.CylinderGeometry(0.008, 0.008, 3.0);
      const cableMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
      const cableMesh = new THREE.Mesh(cableGeo, cableMat);
      cableMesh.position.set(cx, 5.3, cz);
      this.overheadGroup.add(cableMesh);
    }
  }

  /**
   * Sets up the circular rotating turntable for Main Menu & Vehicle Select.
   */
  private setupTurntable(): void {
    // Turntable base foundation
    const baseGeo = new THREE.CylinderGeometry(2.38, 2.48, 0.14, 64);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x0d111a,
      roughness: 0.35,
      metalness: 0.85,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.y = 0.07;
    baseMesh.receiveShadow = true;
    this.turntableGroup.add(baseMesh);

    // Glowing neon ring around the turntable edge
    const ringGeo = new THREE.TorusGeometry(2.40, 0.045, 16, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00ff6a,
    });
    this.turntableRimMesh = new THREE.Mesh(ringGeo, ringMat);
    this.turntableRimMesh.rotation.x = Math.PI / 2;
    this.turntableRimMesh.position.y = 0.138;
    this.turntableGroup.add(this.turntableRimMesh);

    // Rotating platter disc
    const platterGeo = new THREE.CylinderGeometry(2.28, 2.28, 0.08, 64);
    const platterMat = new THREE.MeshStandardMaterial({
      color: 0x06090e,
      roughness: 0.14,
      metalness: 0.95,
    });
    const platterMesh = new THREE.Mesh(platterGeo, platterMat);
    platterMesh.position.y = 0.17;
    platterMesh.receiveShadow = true;
    this.platter.add(platterMesh);

    // Inner glowing ring inlay on platter
    const innerInlayGeo = new THREE.RingGeometry(1.68, 1.72, 64);
    const innerInlayMat = new THREE.MeshBasicMaterial({
      color: 0x00ff6a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    });
    const innerInlayMesh = new THREE.Mesh(innerInlayGeo, innerInlayMat);
    innerInlayMesh.rotation.x = -Math.PI / 2;
    innerInlayMesh.position.y = 0.211;
    this.platter.add(innerInlayMesh);

    // Car slot mounted onto the rotating platter
    this.carSlot.position.set(0, 0.21, 0);
    this.platter.add(this.carSlot);

    // Under-turntable ground rim / bounce light so bottom contours pop
    this.underTurntableLight = new THREE.PointLight(0x3b5373, 2.4, 5.5, 1.0);
    this.underTurntableLight.position.set(0, 0.25, 0);
    this.turntableGroup.add(this.underTurntableLight);

    this.turntableGroup.add(this.platter);
    this.scene.add(this.turntableGroup);
  }

  /**
   * Sets up the 3-tier podium for the Leaderboard screen.
   */
  private setupPodium(): void {
    // Pedestal 1: Center #1 (Gold Whale)
    const p1Height = 1.05;
    const p1Radius = 1.48;
    const p1Base = new THREE.Mesh(
      new THREE.CylinderGeometry(p1Radius, p1Radius + 0.1, p1Height, 64),
      new THREE.MeshStandardMaterial({ color: 0x12151e, roughness: 0.2, metalness: 0.85 })
    );
    p1Base.position.set(0, p1Height / 2, 0);
    this.podiumGroup.add(p1Base);

    // Gold neon rim on top of pedestal 1
    const p1Rim = new THREE.Mesh(
      new THREE.TorusGeometry(p1Radius + 0.02, 0.045, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0xffd700 })
    );
    p1Rim.rotation.x = Math.PI / 2;
    p1Rim.position.set(0, p1Height, 0);
    this.podiumGroup.add(p1Rim);

    // Emblem disk with "( 1 )" on front face of pedestal 1
    const p1Badge = this.createPodiumBadge('( 1 )', '#ffd700');
    p1Badge.position.set(0, p1Height * 0.52, p1Radius + 0.08);
    this.podiumGroup.add(p1Badge);

    this.podiumCarSlots.slot1.position.set(0, p1Height + 0.05, 0);
    this.podiumGroup.add(this.podiumCarSlots.slot1);

    // Pedestal 2: Left #2 (Hood Bear - Silver/Red)
    const p2Height = 0.72;
    const p2Radius = 1.32;
    const p2X = -3.3;
    const p2Z = 0.25;
    const p2Base = new THREE.Mesh(
      new THREE.CylinderGeometry(p2Radius, p2Radius + 0.08, p2Height, 64),
      new THREE.MeshStandardMaterial({ color: 0x10131c, roughness: 0.25, metalness: 0.85 })
    );
    p2Base.position.set(p2X, p2Height / 2, p2Z);
    this.podiumGroup.add(p2Base);

    const p2Rim = new THREE.Mesh(
      new THREE.TorusGeometry(p2Radius + 0.02, 0.04, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0xff3366 })
    );
    p2Rim.rotation.x = Math.PI / 2;
    p2Rim.position.set(p2X, p2Height, p2Z);
    this.podiumGroup.add(p2Rim);

    const p2Badge = this.createPodiumBadge('2', '#ff3366');
    p2Badge.position.set(p2X, p2Height * 0.55, p2Z + p2Radius + 0.08);
    this.podiumGroup.add(p2Badge);

    this.podiumCarSlots.slot2.position.set(p2X, p2Height + 0.05, p2Z);
    this.podiumGroup.add(this.podiumCarSlots.slot2);

    // Pedestal 3: Right #3 (Tesla Racer - Bronze/Purple)
    const p3Height = 0.48;
    const p3Radius = 1.32;
    const p3X = 3.3;
    const p3Z = 0.25;
    const p3Base = new THREE.Mesh(
      new THREE.CylinderGeometry(p3Radius, p3Radius + 0.08, p3Height, 64),
      new THREE.MeshStandardMaterial({ color: 0x10131c, roughness: 0.25, metalness: 0.85 })
    );
    p3Base.position.set(p3X, p3Height / 2, p3Z);
    this.podiumGroup.add(p3Base);

    const p3Rim = new THREE.Mesh(
      new THREE.TorusGeometry(p3Radius + 0.02, 0.04, 16, 64),
      new THREE.MeshBasicMaterial({ color: 0xbf55ec })
    );
    p3Rim.rotation.x = Math.PI / 2;
    p3Rim.position.set(p3X, p3Height, p3Z);
    this.podiumGroup.add(p3Rim);

    const p3Badge = this.createPodiumBadge('3', '#bf55ec');
    p3Badge.position.set(p3X, p3Height * 0.55, p3Z + p3Radius + 0.08);
    this.podiumGroup.add(p3Badge);

    this.podiumCarSlots.slot3.position.set(p3X, p3Height + 0.05, p3Z);
    this.podiumGroup.add(this.podiumCarSlots.slot3);

    // Podium is hidden by default in Main Menu and Vehicle Select
    this.podiumGroup.visible = false;
    this.scene.add(this.podiumGroup);
  }

  /**
   * Generates a circular canvas texture plaque badge for the podium fronts (e.g. 1, 2, 3).
   */
  private createPodiumBadge(text: string, colorHex: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Circle background with neon border
    ctx.fillStyle = '#0a0d14';
    ctx.beginPath();
    ctx.arc(128, 128, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(128, 128, 115, 0, Math.PI * 2);
    ctx.stroke();

    // Stylized laurel or accent arcs
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(128, 128, 95, 0, Math.PI * 2);
    ctx.stroke();

    // Text number
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 96px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 18;
    ctx.fillText(text, 128, 132);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const geo = new THREE.PlaneGeometry(0.75, 0.75);
    return new THREE.Mesh(geo, mat);
  }

  /**
   * Showroom studio lighting setup.
   */
  private setupLighting(): void {
    // 1. Ambient studio fill for cockpit, panel gaps, and tires
    const ambientLight = new THREE.AmbientLight(0x445878, 3.4);
    this.scene.add(ambientLight);

    // 2. Soft sky/ground hemisphere bounce
    const hemiLight = new THREE.HemisphereLight(0x9cc2f0, 0x243348, 2.6);
    this.scene.add(hemiLight);

    // 3. Primary Key spotlight aimed at turntable car from front-right
    this.keySpotlight = new THREE.SpotLight(0xffffff, 6.2, 24, Math.PI / 3.4, 0.38, 1.1);
    this.keySpotlight.position.set(2.2, 6.5, 4.6);
    this.keySpotlight.target = this.carSlot;
    this.scene.add(this.keySpotlight);

    // 4. Secondary Key spotlight from front-left to illuminate dark car flanks
    const secondarySpot = new THREE.SpotLight(0xdbeafe, 4.6, 22, Math.PI / 3.5, 0.45, 1.1);
    secondarySpot.position.set(-2.4, 6.0, 4.4);
    secondarySpot.target = this.carSlot;
    this.scene.add(secondarySpot);

    // 5. Top-down showroom ceiling wash spotlight
    const topSpotlight = new THREE.SpotLight(0xffffff, 4.2, 20, Math.PI / 3, 0.5, 1.0);
    topSpotlight.position.set(0.0, 6.6, 0.5);
    topSpotlight.target = this.carSlot;
    this.scene.add(topSpotlight);

    // 6. Rim spotlight matching active vehicle glow color
    this.rimSpotlight = new THREE.SpotLight(0x00ff6a, 4.6, 20, Math.PI / 3, 0.5, 1.0);
    this.rimSpotlight.position.set(-3.5, 5.0, -2.5);
    this.rimSpotlight.target = this.carSlot;
    this.scene.add(this.rimSpotlight);

    // 7. Soft front studio fill
    const fillLight = new THREE.DirectionalLight(0xd4e4f8, 2.4);
    fillLight.position.set(0, 3.6, 6.2);
    this.scene.add(fillLight);

    // 7b. Under-car uplight to softly illuminate lower bumpers, dark wheels, and side skirts
    const underCarLight = new THREE.PointLight(0x527298, 2.8, 6.0, 1.2);
    underCarLight.position.set(0, 0.15, 0);
    this.turntableGroup.add(underCarLight);

    // 8. Spotlights for the 3 leaderboard pedestals
    const p1Spot = new THREE.SpotLight(0xffea77, 5.2, 18, Math.PI / 3.8, 0.35, 1.0);
    p1Spot.position.set(0, 6.5, 1.8);
    p1Spot.target = this.podiumCarSlots.slot1;
    this.scene.add(p1Spot);
    this.podiumSpotlights.push(p1Spot);

    const p2Spot = new THREE.SpotLight(0xff3366, 4.4, 16, Math.PI / 3.8, 0.38, 1.0);
    p2Spot.position.set(-3.3, 5.6, 1.8);
    p2Spot.target = this.podiumCarSlots.slot2;
    this.scene.add(p2Spot);
    this.podiumSpotlights.push(p2Spot);

    const p3Spot = new THREE.SpotLight(0xbf55ec, 4.4, 16, Math.PI / 3.8, 0.38, 1.0);
    p3Spot.position.set(3.3, 5.6, 1.8);
    p3Spot.target = this.podiumCarSlots.slot3;
    this.scene.add(p3Spot);
    this.podiumSpotlights.push(p3Spot);

    // 9. Soft front fill and under-pedestal glow for Leaderboard podium
    const podiumFill = new THREE.DirectionalLight(0xb8d0ec, 1.8);
    podiumFill.position.set(0, 3.5, 6.5);
    this.podiumGroup.add(podiumFill);

    const p1Under = new THREE.PointLight(0xffea77, 2.0, 4.0, 1.2);
    p1Under.position.set(0, 0.25, 0);
    this.podiumGroup.add(p1Under);

    const p2Under = new THREE.PointLight(0xff3366, 1.8, 3.5, 1.2);
    p2Under.position.set(-3.3, 0.25, 0.25);
    this.podiumGroup.add(p2Under);

    const p3Under = new THREE.PointLight(0xbf55ec, 1.8, 3.5, 1.2);
    p3Under.position.set(3.3, 0.25, 0.25);
    this.podiumGroup.add(p3Under);
  }

  /**
   * Preloads all 5 vehicle models into memory so transitions are instant.
   */
  public async preloadAllVehicles(): Promise<void> {
    const assetManager = AssetManager.get();
    const types: VehicleType[] = ['hood_bull', 'hood_bear', 'tsla_racer', 'nvda_ai', 'gold_whale', 'gme_ape', 'doge_kart'];

    for (const t of types) {
      if (!this.vehicleModels.has(t)) {
        const model = await assetManager.loadVehicle(t);
        this.vehicleModels.set(t, model);
      }
    }

    // Set initial hero car (HOOD BULL) on the turntable
    this.setTurntableVehicle('hood_bull');

    // Populate podium with actual 3D vehicles
    const whaleModel = await assetManager.loadVehicle('gold_whale');
    whaleModel.scale.set(0.92, 0.92, 0.92);
    this.podiumCarSlots.slot1.add(whaleModel);
    this.podiumModels.goldWhale = whaleModel;

    const bearModel = await assetManager.loadVehicle('hood_bear');
    bearModel.scale.set(0.85, 0.85, 0.85);
    this.podiumCarSlots.slot2.add(bearModel);
    this.podiumModels.hoodBear = bearModel;

    const tslaModel = await assetManager.loadVehicle('tsla_racer');
    tslaModel.scale.set(0.85, 0.85, 0.85);
    this.podiumCarSlots.slot3.add(tslaModel);
    this.podiumModels.tslaRacer = tslaModel;
  }

  /**
   * Switches the vehicle currently displayed on the turntable.
   */
  public setTurntableVehicle(type: VehicleType, animated: boolean = false): void {
    const model = this.vehicleModels.get(type);
    if (!model) return;

    this.currentVehicleType = type;
    const config = getVehicleConfig(type);

    // Update neon ring & halo lights to match vehicle's visual identity
    (this.turntableRimMesh.material as THREE.MeshBasicMaterial).color.setHex(config.glowColor);
    (this.overheadHaloMesh.material as THREE.MeshBasicMaterial).color.setHex(config.glowColor);
    this.rimSpotlight.color.setHex(config.glowColor);

    if (animated) {
      this.isTransitioningVehicle = true;
      this.transitionTimer = 0;
      this.nextVehicleToLoad = type;
    } else {
      // Clear previous car and mount new model
      while (this.carSlot.children.length > 0) {
        this.carSlot.remove(this.carSlot.children[0]);
      }
      this.carSlot.add(model);
      this.carSlot.scale.set(1, 1, 1);
      this.carSlot.position.set(0, 0, 0);
    }
  }

  /**
   * Sets the screen mode (MAIN_MENU, VEHICLE_SELECT, LEADERBOARD) and updates
   * camera framing and stage visibility.
   */
  public setMode(mode: ShowroomMode): void {
    this.currentMode = mode;

    if (mode === 'MAIN_MENU') {
      this.turntableGroup.visible = true;
      this.overheadGroup.visible = true;
      this.podiumGroup.visible = false;
      // Camera positioned slightly to the left, framing car heroically on center-right
      this.targetCamPos.set(-2.0, 2.2, 5.6);
      this.targetLookAt.set(0.72, 0.65, 0);
    } else if (mode === 'VEHICLE_SELECT') {
      this.turntableGroup.visible = true;
      this.overheadGroup.visible = true;
      this.podiumGroup.visible = false;
      // Camera centered for inspection between left and right showroom arrows,
      // lowered comfortably so the antenna halo has ample breathing room below top header
      this.targetCamPos.set(0.0, 2.15, 5.6);
      this.targetLookAt.set(0.0, 0.68, 0);
    } else if (mode === 'LEADERBOARD') {
      this.turntableGroup.visible = false;
      this.overheadGroup.visible = false;
      this.podiumGroup.visible = true;
      // Wide cinematic camera framing all 3 podium champions on the lower-mid region
      this.targetCamPos.set(0.0, 3.1, 10.4);
      this.targetLookAt.set(0.0, 0.95, 0);
    }
  }

  /**
   * Returns world anchor coordinates for the 3 leaderboard podium cars:
   * #1 Gold Whale (center), #2 Hood Bear (left), #3 Tsla Racer (right).
   */
  public getPodiumAnchors(): { slot1: THREE.Vector3; slot2: THREE.Vector3; slot3: THREE.Vector3 } {
    return {
      slot1: new THREE.Vector3(0, 2.70, 0),
      slot2: new THREE.Vector3(-3.3, 2.28, 0.25),
      slot3: new THREE.Vector3(3.3, 2.12, 0.25),
    };
  }

  /**
   * Registers mouse drag listeners on the window to allow dragging the car in Vehicle Select.
   */
  private setupInteractionListeners(): void {
    window.addEventListener('mousedown', (e) => {
      if (this.currentMode !== 'VEHICLE_SELECT') return;
      // Only allow drag if clicking in central 3D area, not on UI buttons
      if ((e.target as HTMLElement).tagName !== 'CANVAS') return;
      this.isUserDragging = true;
      this.dragPrevX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isUserDragging) return;
      const dx = e.clientX - this.dragPrevX;
      this.dragPrevX = e.clientX;
      this.platter.rotation.y += dx * 0.008;
      this.userDragVelocity = dx * 0.008;
    });

    window.addEventListener('mouseup', () => {
      this.isUserDragging = false;
    });
  }

  /**
   * Animation & physics tick for the showroom.
   */
  public update(dt: number): void {
    // 1. Turntable rotation
    if (this.turntableGroup.visible) {
      if (!this.isUserDragging) {
        // Decay user drag velocity into baseline auto-rotation
        this.userDragVelocity *= Math.max(0, 1 - dt * 4.0);
        this.platter.rotation.y += (this.autoRotateSpeed + this.userDragVelocity) * dt;
      }
    }

    // 2. Smooth vehicle transition animation (scale ease-out and ease-in)
    if (this.isTransitioningVehicle) {
      this.transitionTimer += dt;
      const halfTime = 0.16;

      if (this.transitionTimer < halfTime) {
        // Shrink / slide current vehicle
        const progress = this.transitionTimer / halfTime;
        const scale = 1.0 - progress * 0.25;
        this.carSlot.scale.set(scale, scale, scale);
        this.carSlot.position.y = -progress * 0.15;
      } else if (this.nextVehicleToLoad) {
        // Swap model at apex
        const targetModel = this.vehicleModels.get(this.nextVehicleToLoad);
        if (targetModel) {
          while (this.carSlot.children.length > 0) {
            this.carSlot.remove(this.carSlot.children[0]);
          }
          this.carSlot.add(targetModel);
        }
        this.nextVehicleToLoad = null;
      } else {
        // Scale back up to normal
        const progress = Math.min(1.0, (this.transitionTimer - halfTime) / halfTime);
        const scale = 0.75 + progress * 0.25;
        this.carSlot.scale.set(scale, scale, scale);
        this.carSlot.position.y = -(1.0 - progress) * 0.15;

        if (progress >= 1.0) {
          this.isTransitioningVehicle = false;
          this.carSlot.scale.set(1, 1, 1);
          this.carSlot.position.set(0, 0, 0);
        }
      }
    }

    // 3. Subtle idle animation on podium cars
    if (this.podiumGroup.visible) {
      const time = performance.now() * 0.001;
      if (this.podiumModels.goldWhale) {
        this.podiumModels.goldWhale.position.y = Math.sin(time * 2.0) * 0.012;
      }
      if (this.podiumModels.hoodBear) {
        this.podiumModels.hoodBear.position.y = Math.sin(time * 1.8 + 1.0) * 0.01;
      }
      if (this.podiumModels.tslaRacer) {
        this.podiumModels.tslaRacer.position.y = Math.sin(time * 2.2 + 2.0) * 0.01;
      }
    }

    // 4. Smooth cinematic camera lerp
    const lerpRate = Math.min(1.0, dt * 5.0);
    this.currentCamPos.lerp(this.targetCamPos, lerpRate);
    this.currentLookAt.lerp(this.targetLookAt, lerpRate);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);
  }

  /**
   * Resizes camera projection matrix on window resize.
   */
  public onResize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * Renders the showroom scene using the provided renderer.
   */
  public render(renderer: THREE.WebGLRenderer): void {
    renderer.render(this.scene, this.camera);
  }
}
