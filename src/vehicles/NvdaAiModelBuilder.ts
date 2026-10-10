import * as THREE from 'three';
import { NVDA_AI_CONFIG } from './VehicleTypes';

/**
 * Procedural Nvda Ai 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the AI Type precision & cornering specialist vehicle:
 * 1. Silhouette: Stealth obsidian black faceted bodywork with aggressive aerodynamic cuts.
 * 2. Dimensions: L 2.6m × W 1.9m × H 1.35m.
 * 3. Color & Materials: Stealth obsidian black metallic & carbon composite panels,
 *    accented by electric deep cyber purple (#9D00FF) neon channels and radioactive lime green (#00FF44) piping.
 * 4. Distinctive Features: Stylized AI neural eye/claw emblem on hood, cybernetic cockpit with matrix HUD,
 *    hex-patterned composite bumper with purple neon glow, and segmented neural antenna mast with glowing purple node.
 * 5. Dynamic Money Display: "$150" digital matrix code display.
 * 6. Contact Head: Segmented neural mast with glowing purple orb/node contact head.
 * 7. Full CarNodeBindings compliance with wheelSpinner grouping.
 */
export class NvdaAiModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = NVDA_AI_CONFIG.dimensions.length;
    const width = NVDA_AI_CONFIG.dimensions.width;
    const wheelRadius = NVDA_AI_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED PBR MATERIALS
    // =========================================================================
    // Stealth Obsidian Black Metallic Paint
    const obsidianPaintMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c0d12,
      roughness: 0.18,
      metalness: 0.92,
    });
    obsidianPaintMaterial.name = 'NvdaPaint';
    obsidianPaintMaterial.userData = { isPaint: true };

    // Matte Carbon Fiber / Hex Substrate
    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x14151a,
      roughness: 0.45,
      metalness: 0.55,
    });

    // Hex-Pattern Composite Bumper Material
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x101115,
      roughness: 0.85,
      metalness: 0.08,
    });

    // Radioactive Neon Lime Green Accent Glow (#00FF44 / #76B900)
    const neonGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff44,
      emissive: 0x00e63c,
      emissiveIntensity: 2.4,
      roughness: 0.10,
    });

    // Deep Electric Cyber Purple Neon Glow (#9D00FF)
    const neonPurpleMaterial = new THREE.MeshStandardMaterial({
      color: 0x9d00ff,
      emissive: 0x9d00ff,
      emissiveIntensity: 2.2,
      roughness: 0.12,
    });

    // Gunmetal / Dark Titanium
    const gunmetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x22252c,
      roughness: 0.35,
      metalness: 0.90,
    });

    // Chrome Trim
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.06,
      metalness: 0.98,
    });

    // Holographic HUD Glass (Tinted Cyber Purple)
    const hudGlassMaterial = new THREE.MeshStandardMaterial({
      color: 0xbb55ff,
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });

    // Headlight Material (Dual Lime-Green Projector Core)
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0x76b900,
      emissive: 0x00ff44,
      emissiveIntensity: 3.4,
      roughness: 0.08,
    });

    // Taillight Material (Matrix Purple/Red LED)
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa00ff,
      emissive: 0x9900ff,
      emissiveIntensity: 3.2,
      roughness: 0.10,
    });

    // =========================================================================
    // 2. CHASSIS NODE
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Stealth faceted floorpan
    const chassisGeo = new THREE.BoxGeometry(width * 0.80, 0.20, length * 0.86);
    const chassisMesh = new THREE.Mesh(chassisGeo, carbonMaterial);
    chassisMesh.position.y = 0.20;
    chassisMesh.castShadow = true;
    chassis.add(chassisMesh);

    // Glowing Purple Underglow PointLight
    const underglow = new THREE.PointLight(0x9d00ff, 2.2, 3.6);
    underglow.position.set(0, 0.12, 0);
    chassis.add(underglow);
    carRoot.add(chassis);

    // =========================================================================
    // 3. BUMPER NODE (Hex-Patterned Composite with Purple Neon Channel)
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Faceted angular bumper perimeter ring
    const bumperGeo = new THREE.CylinderGeometry(width * 0.53, width * 0.55, 0.24, 28);
    bumperGeo.scale(1.0, 1.0, length / width);
    const bumperMesh = new THREE.Mesh(bumperGeo, bumperMaterial);
    bumperMesh.position.y = 0.22;
    bumperMesh.castShadow = true;
    bumper.add(bumperMesh);

    // Deep Electric Purple Neon Accent Channel
    const neonRingGeo = new THREE.CylinderGeometry(width * 0.535, width * 0.555, 0.06, 28);
    neonRingGeo.scale(1.0, 1.0, length / width);
    const neonRingMesh = new THREE.Mesh(neonRingGeo, neonPurpleMaterial);
    neonRingMesh.position.y = 0.23;
    bumper.add(neonRingMesh);

    // Lower Lime Green Splitter Lip
    const greenLipGeo = new THREE.CylinderGeometry(width * 0.54, width * 0.56, 0.025, 28);
    greenLipGeo.scale(1.0, 1.0, length / width);
    const greenLipMesh = new THREE.Mesh(greenLipGeo, neonGreenMaterial);
    greenLipMesh.position.y = 0.11;
    bumper.add(greenLipMesh);

    carRoot.add(bumper);

    // =========================================================================
    // 4. BODY NODE (Faceted Obsidian Body + AI Eye/Tensor Mascot Crest)
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // Angular sculpted stealth hull
    const hullGeo = new THREE.BoxGeometry(width * 0.74, 0.34, length * 0.82);
    const hull = new THREE.Mesh(hullGeo, obsidianPaintMaterial);
    hull.position.set(0, 0.38, 0);
    hull.castShadow = true;
    body.add(hull);

    // Flared Faceted Wheel Arches
    const archGeo = new THREE.BoxGeometry(width * 0.86, 0.26, length * 0.74);
    const arches = new THREE.Mesh(archGeo, obsidianPaintMaterial);
    arches.position.set(0, 0.42, 0);
    arches.castShadow = true;
    body.add(arches);

    // Faceted Stealth Hood with Triangular Creases
    const hoodGeo = new THREE.BoxGeometry(width * 0.66, 0.20, length * 0.40);
    const hood = new THREE.Mesh(hoodGeo, obsidianPaintMaterial);
    hood.position.set(0, 0.48, length * 0.23);
    hood.rotation.x = -0.09;
    hood.castShadow = true;
    body.add(hood);

    // Diagonal Green Aerodynamic Speed Strips along hood
    for (let side of [-1, 1]) {
      const hoodStripGeo = new THREE.BoxGeometry(0.03, 0.015, length * 0.36);
      const hoodStrip = new THREE.Mesh(hoodStripGeo, neonGreenMaterial);
      hoodStrip.position.set(side * (width * 0.22), 0.57, length * 0.23);
      hoodStrip.rotation.x = -0.09;
      body.add(hoodStrip);
    }

    // SIGNATURE AI NEURAL EYE / TENSOR CREST ON HOOD
    const aiCrestGroup = new THREE.Group();
    aiCrestGroup.position.set(0, 0.58, length * 0.25);
    aiCrestGroup.rotation.x = -0.09;

    // Hexagonal Carbon Plaque
    const hexPlaqueGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 6);
    const hexPlaque = new THREE.Mesh(hexPlaqueGeo, carbonMaterial);
    aiCrestGroup.add(hexPlaque);

    // Neon Green Outer Hex Rim
    const hexRimGeo = new THREE.CylinderGeometry(0.155, 0.155, 0.025, 6);
    const hexRim = new THREE.Mesh(hexRimGeo, neonGreenMaterial);
    hexRim.position.y = 0.005;
    aiCrestGroup.add(hexRim);

    // Purple Core Neural Eye / Pupil Node
    const eyeCoreGeo = new THREE.SphereGeometry(0.065, 12, 12);
    const eyeCore = new THREE.Mesh(eyeCoreGeo, neonPurpleMaterial);
    eyeCore.position.y = 0.02;
    aiCrestGroup.add(eyeCore);

    // Neural Circuit Lines radiating out
    for (let i = 0; i < 4; i++) {
      const lineGeo = new THREE.BoxGeometry(0.02, 0.03, 0.10);
      const line = new THREE.Mesh(lineGeo, neonGreenMaterial);
      const ang = (i * Math.PI) / 2;
      line.position.set(Math.sin(ang) * 0.10, 0.015, Math.cos(ang) * 0.10);
      line.rotation.y = ang;
      aiCrestGroup.add(line);
    }

    body.add(aiCrestGroup);

    // Cybernetic Cockpit Tub
    const cockpitGeo = new THREE.BoxGeometry(width * 0.50, 0.24, 0.68);
    const cockpit = new THREE.Mesh(cockpitGeo, carbonMaterial);
    cockpit.position.set(0, 0.52, -0.06);
    body.add(cockpit);

    // Holographic Angular Visor Screen
    const visorGeo = new THREE.BoxGeometry(width * 0.48, 0.18, 0.03);
    const visor = new THREE.Mesh(visorGeo, hudGlassMaterial);
    visor.position.set(0, 0.64, 0.20);
    visor.rotation.x = 0.38;
    body.add(visor);

    // Holographic Matrix HUD Projector Bar
    const hudBarGeo = new THREE.BoxGeometry(0.32, 0.04, 0.04);
    const hudBar = new THREE.Mesh(hudBarGeo, neonGreenMaterial);
    hudBar.position.set(0, 0.59, 0.16);
    body.add(hudBar);

    // Carbon Racing Bucket Seat with Green Harness Belts
    const seatGeo = new THREE.BoxGeometry(0.46, 0.44, 0.40);
    const seat = new THREE.Mesh(seatGeo, obsidianPaintMaterial);
    seat.position.set(0, 0.54, -0.15);
    seat.rotation.x = -0.18;
    body.add(seat);

    // Green Shoulder Harness Straps
    for (let side of [-1, 1]) {
      const strapGeo = new THREE.BoxGeometry(0.04, 0.36, 0.02);
      const strap = new THREE.Mesh(strapGeo, neonGreenMaterial);
      strap.position.set(side * 0.12, 0.68, -0.18);
      strap.rotation.x = -0.18;
      body.add(strap);
    }

    // High-Downforce Faceted Stealth Rear Wing
    const wingGeo = new THREE.BoxGeometry(width * 0.70, 0.04, 0.26);
    const rearWing = new THREE.Mesh(wingGeo, carbonMaterial);
    rearWing.position.set(0, 0.88, -length * 0.35);
    rearWing.castShadow = true;
    body.add(rearWing);

    // Wing Endplates with Dual Purple & Green Accents
    for (let side of [-1, 1]) {
      const endplateGeo = new THREE.BoxGeometry(0.03, 0.16, 0.32);
      const endplate = new THREE.Mesh(endplateGeo, obsidianPaintMaterial);
      endplate.position.set(side * (width * 0.355), 0.88, -length * 0.35);
      body.add(endplate);

      const edgeGlowGeo = new THREE.BoxGeometry(0.035, 0.02, 0.32);
      const edgeGlow = new THREE.Mesh(edgeGlowGeo, neonPurpleMaterial);
      edgeGlow.position.set(side * (width * 0.355), 0.96, -length * 0.35);
      body.add(edgeGlow);
    }

    // Struts
    const strutGeo = new THREE.BoxGeometry(0.04, 0.26, 0.06);
    strutGeo.rotateX(0.12);
    const strutL = new THREE.Mesh(strutGeo, gunmetalMaterial);
    strutL.position.set(-width * 0.22, 0.74, -length * 0.34);
    const strutR = new THREE.Mesh(strutGeo, gunmetalMaterial);
    strutR.position.set(width * 0.22, 0.74, -length * 0.34);
    body.add(strutL, strutR);

    carRoot.add(body);

    // =========================================================================
    // 5. WHEELS NODE (High-Grip Carbon Wheels with Purple/Green Accents)
    // =========================================================================
    const wheelHalfWidth = 0.18;

    const makeWheel = (name: string, x: number, y: number, z: number): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(x, y, z);

      // Rotating sub-group (children[0]) spins around X via CarAnimation
      const wheelSpinner = new THREE.Group();
      wheelSpinner.name = 'WheelSpinner';

      // Carbon composite racing tire
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelHalfWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.82, metalness: 0.08 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelSpinner.add(tire);

      // Faceted Black Alloy Rim
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.68, wheelRadius * 0.68, wheelHalfWidth + 0.01, 18);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, gunmetalMaterial);
      wheelSpinner.add(rim);

      // Deep Purple Outer Rim Ring
      const isRightSide = x > 0;
      const faceOffset = isRightSide ? (wheelHalfWidth * 0.5 + 0.005) : -(wheelHalfWidth * 0.5 + 0.005);

      const lipRingGeo = new THREE.TorusGeometry(wheelRadius * 0.69, 0.014, 10, 24);
      lipRingGeo.rotateY(Math.PI / 2);
      const lipRing = new THREE.Mesh(lipRingGeo, neonPurpleMaterial);
      lipRing.position.x = faceOffset;
      wheelSpinner.add(lipRing);

      // Center Lime Green Hubcap
      const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 6); // Hex hub
      hubGeo.rotateZ(Math.PI / 2);
      const hubCap = new THREE.Mesh(hubGeo, neonGreenMaterial);
      hubCap.position.x = faceOffset + (isRightSide ? 0.01 : -0.01);
      wheelSpinner.add(hubCap);

      wheelGroup.add(wheelSpinner); // children[0] is spinning assembly

      // Stationary Ceramic Brake Rotor & Purple Caliper
      const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.02, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, chromeMaterial);
      rotor.position.x = isRightSide ? -0.02 : 0.02;

      const caliperGeo = new THREE.BoxGeometry(0.06, 0.11, 0.14);
      const caliper = new THREE.Mesh(caliperGeo, neonPurpleMaterial);
      caliper.position.set(rotor.position.x, wheelRadius * 0.27, 0);

      wheelGroup.add(rotor);
      wheelGroup.add(caliper);

      return wheelGroup;
    };

    const wheelPosX = width * 0.44;
    const wheelPosZ = length * 0.31;
    const wheelPosY = wheelRadius;

    carRoot.add(
      makeWheel('Wheel_FL', -wheelPosX, wheelPosY, wheelPosZ),
      makeWheel('Wheel_FR', wheelPosX, wheelPosY, wheelPosZ),
      makeWheel('Wheel_RL', -wheelPosX, wheelPosY, -wheelPosZ),
      makeWheel('Wheel_RR', wheelPosX, wheelPosY, -wheelPosZ)
    );

    // =========================================================================
    // 6. ANTENNA & PURPLE NEURAL NODE CONTACT HEAD
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.62, -length * 0.36);

    // Segmented Hexagonal Base Turret
    const turretGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.05, 6);
    const turret = new THREE.Mesh(turretGeo, carbonMaterial);
    antenna.add(turret);

    // Segmented Neural Carbon Mast with Green Nodes
    const mastHeight = 1.40;
    const mastGeo = new THREE.CylinderGeometry(0.007, 0.016, mastHeight, 10);
    mastGeo.translate(0, mastHeight * 0.5 + 0.08, 0);
    const mastMesh = new THREE.Mesh(mastGeo, gunmetalMaterial);
    antenna.add(mastMesh);

    // Small glowing rings along mast
    for (let j = 1; j <= 3; j++) {
      const ringGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.02, 10);
      const ring = new THREE.Mesh(ringGeo, neonGreenMaterial);
      ring.position.y = 0.08 + (mastHeight * 0.28 * j);
      antenna.add(ring);
    }

    // Glowing Purple Neural Orb Contact Head
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.set(0, mastHeight + 0.08, 0);

    const orbGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const orbMesh = new THREE.Mesh(orbGeo, neonPurpleMaterial);
    contactHead.add(orbMesh);

    // Outer Geodesic Hex Halo Rings
    const haloGeo = new THREE.TorusGeometry(0.16, 0.018, 10, 20);
    const halo = new THREE.Mesh(haloGeo, neonGreenMaterial);
    contactHead.add(halo);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 7. MONEY DISPLAY (Rear Matrix HUD showing "$150")
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.50, -length * 0.395);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#060a08';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#00ff44';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.shadowColor = '#00ff44';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$150', 128, 64);
    ctx.shadowBlur = 0;

    const displayTex = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const screenGeo = new THREE.PlaneGeometry(0.46, 0.22);
    screenGeo.rotateY(Math.PI);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);

    const frameGeo = new THREE.BoxGeometry(0.52, 0.26, 0.04);
    const frameMesh = new THREE.Mesh(frameGeo, carbonMaterial);
    frameMesh.position.z = 0.02;

    moneyDisplay.add(screenMesh);
    moneyDisplay.add(frameMesh);
    carRoot.add(moneyDisplay);

    // =========================================================================
    // 8. HEADLIGHTS & TAILLIGHTS
    // =========================================================================
    const makeHeadlight = (name: string, x: number): THREE.Group => {
      const hlGroup = new THREE.Group();
      hlGroup.name = name;
      hlGroup.position.set(x, 0.44, length * 0.40);

      const housingGeo = new THREE.BoxGeometry(0.24, 0.10, 0.08);
      const housing = new THREE.Mesh(housingGeo, carbonMaterial);
      hlGroup.add(housing);

      // Lime green dual projector core
      const projGeo = new THREE.SphereGeometry(0.038, 12, 12);
      const p1 = new THREE.Mesh(projGeo, headlightMaterial);
      p1.position.set(-0.05, 0, 0.035);
      const p2 = new THREE.Mesh(projGeo, headlightMaterial);
      p2.position.set(0.05, 0, 0.035);
      hlGroup.add(p1, p2);

      // Purple eyebrow brow
      const browGeo = new THREE.BoxGeometry(0.20, 0.018, 0.03);
      const brow = new THREE.Mesh(browGeo, neonPurpleMaterial);
      brow.position.set(0, 0.04, 0.03);
      hlGroup.add(brow);

      return hlGroup;
    };

    const headlightL = makeHeadlight('Headlight_L', -width * 0.28);
    const headlightR = makeHeadlight('Headlight_R', width * 0.28);
    carRoot.add(headlightL, headlightR);

    // Segmented Matrix Taillights
    const makeTailLight = (name: string, x: number): THREE.Group => {
      const tlGroup = new THREE.Group();
      tlGroup.name = name;
      tlGroup.position.set(x, 0.48, -length * 0.39);

      const barGeo = new THREE.BoxGeometry(0.22, 0.06, 0.03);
      const bar = new THREE.Mesh(barGeo, taillightMaterial);
      tlGroup.add(bar);

      return tlGroup;
    };

    const taillightL = makeTailLight('TailLight_L', -width * 0.26);
    const taillightR = makeTailLight('TailLight_R', width * 0.26);
    carRoot.add(taillightL, taillightR);

    // =========================================================================
    // 9. VFX ANCHOR NODES
    // =========================================================================
    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.24, -length * 0.42);

    // Hexagonal stealth exhaust ports
    const hexExhaustGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6);
    hexExhaustGeo.rotateX(Math.PI / 2);
    const exhaustL = new THREE.Mesh(hexExhaustGeo, gunmetalMaterial);
    exhaustL.position.x = -0.22;
    const exhaustR = new THREE.Mesh(hexExhaustGeo, gunmetalMaterial);
    exhaustR.position.x = 0.22;
    vfxBoost.add(exhaustL, exhaustR);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.set(0, mastHeight + 0.08, -length * 0.36);
    carRoot.add(vfxAntenna);

    const vfxImpact = new THREE.Group();
    vfxImpact.name = 'VFX_Impact';
    vfxImpact.position.set(0, 0.32, 0);
    carRoot.add(vfxImpact);

    const vfxCoin = new THREE.Group();
    vfxCoin.name = 'VFX_Coin';
    vfxCoin.position.set(0, 0.55, 0);
    carRoot.add(vfxCoin);

    const vfxSkid = new THREE.Group();
    vfxSkid.name = 'VFX_Skid';
    vfxSkid.position.set(0, 0.05, 0);
    carRoot.add(vfxSkid);

    return carRoot;
  }
}
