import * as THREE from 'three';
import { TSLA_RACER_CONFIG } from './VehicleTypes';

/**
 * Procedural Tsla Racer 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the Tech Type hit-and-run archetype vehicle:
 * 1. Silhouette: Ultra-streamlined aerodynamic low-slung cyber racer.
 * 2. Dimensions: L 2.5m × W 1.8m × H 1.30m (compact, low-drag profile).
 * 3. Color & Materials: Pearlescent high-gloss white/silver shell with crimson red racing accents
 *    and glowing electric cyan (#00E5FF) neon halo & underglow.
 * 4. Distinctive Features: Signature Tech 'T' crest on hood, minimalist cockpit with yoke steering wheel,
 *    curved glass HUD visor, turbofan aero-disc wheels with cyan rim glow, and razor-thin cyber lighting.
 * 5. Dynamic Money Display: "$200" crisp cyan digital ticker display.
 * 6. Contact Head: Slender high-tech carbon mast with electric cyan glowing toroidal contact head.
 * 7. Full CarNodeBindings compliance with wheelSpinner grouping.
 */
export class TslaRacerModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = TSLA_RACER_CONFIG.dimensions.length;
    const width = TSLA_RACER_CONFIG.dimensions.width;
    const wheelRadius = TSLA_RACER_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED PBR MATERIALS
    // =========================================================================
    // Pearlescent High-Gloss Cyber White/Silver Paint
    const whitePaintMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5f7fa,
      roughness: 0.12,
      metalness: 0.85,
    });
    whitePaintMaterial.name = 'TslaPaint';
    whitePaintMaterial.userData = { isPaint: true };

    // Crimson Red Racing Accent Paint
    const crimsonAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xe60026,
      roughness: 0.18,
      metalness: 0.80,
    });
    crimsonAccentMaterial.name = 'TslaCrimsonAccent';

    // Dark Carbon Fiber / Aero Splitter Material
    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x121316,
      roughness: 0.40,
      metalness: 0.60,
    });

    // Lightweight Low-Profile Bumper Composite
    const bumperMaterial = new THREE.MeshStandardMaterial({
      color: 0x16181c,
      roughness: 0.80,
      metalness: 0.10,
    });

    // Electric Cyan Neon Glow (#00E5FF)
    const neonCyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00e5ff,
      emissiveIntensity: 2.2,
      roughness: 0.10,
    });

    // Dark Titanium / Chrome
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.05,
      metalness: 0.98,
    });

    // Cyber Cockpit Glass (Light Cyan Tinted Polycarbonate)
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x44ddff,
      roughness: 0.05,
      metalness: 0.15,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });

    // Headlight Material (Hyper Ice-White LED with Cyan projector core)
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x88f5ff,
      emissiveIntensity: 3.5,
      roughness: 0.05,
    });

    // Taillight Material (Razor Full-Width Crimson LED)
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff002b,
      emissive: 0xff002b,
      emissiveIntensity: 3.2,
      roughness: 0.08,
    });

    // =========================================================================
    // 2. CHASSIS NODE
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Aerodynamic flat skateboard battery floorpan
    const chassisGeo = new THREE.BoxGeometry(width * 0.78, 0.18, length * 0.88);
    const chassisMesh = new THREE.Mesh(chassisGeo, carbonMaterial);
    chassisMesh.position.y = 0.18;
    chassisMesh.castShadow = true;
    chassis.add(chassisMesh);

    // Aero Side Skirts with Cyan Pinstripe
    const skirtGeo = new THREE.BoxGeometry(0.06, 0.04, length * 0.65);
    const skirtL = new THREE.Mesh(skirtGeo, neonCyanMaterial);
    skirtL.position.set(-width * 0.43, 0.14, 0);
    const skirtR = new THREE.Mesh(skirtGeo, neonCyanMaterial);
    skirtR.position.set(width * 0.43, 0.14, 0);
    chassis.add(skirtL, skirtR);

    // Electric Cyan Underglow PointLight
    const underglow = new THREE.PointLight(0x00e5ff, 2.0, 3.5);
    underglow.position.set(0, 0.12, 0);
    chassis.add(underglow);
    carRoot.add(chassis);

    // =========================================================================
    // 3. BUMPER NODE (Low-Profile Lightweight Composite with Cyan Neon Ring)
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Streamlined low-profile perimeter ring
    const bumperGeo = new THREE.CylinderGeometry(width * 0.52, width * 0.54, 0.22, 28);
    bumperGeo.scale(1.0, 1.0, length / width);
    const bumperMesh = new THREE.Mesh(bumperGeo, bumperMaterial);
    bumperMesh.position.y = 0.20;
    bumperMesh.castShadow = true;
    bumper.add(bumperMesh);

    // High-luminance Electric Cyan Neon Trim Ring
    const neonRingGeo = new THREE.CylinderGeometry(width * 0.525, width * 0.545, 0.05, 28);
    neonRingGeo.scale(1.0, 1.0, length / width);
    const neonRingMesh = new THREE.Mesh(neonRingGeo, neonCyanMaterial);
    neonRingMesh.position.y = 0.20;
    bumper.add(neonRingMesh);

    // Front Integrated Carbon Splitter
    const splitterGeo = new THREE.BoxGeometry(width * 0.72, 0.03, 0.22);
    const splitter = new THREE.Mesh(splitterGeo, carbonMaterial);
    splitter.position.set(0, 0.12, length * 0.46);
    bumper.add(splitter);

    carRoot.add(bumper);

    // =========================================================================
    // 4. BODY NODE (Streamlined White Shell + Crimson Accents + Tech 'T' Crest)
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // Main sculpted low-drag monocoque
    const monocoqueGeo = new THREE.BoxGeometry(width * 0.72, 0.32, length * 0.82);
    const monocoque = new THREE.Mesh(monocoqueGeo, whitePaintMaterial);
    monocoque.position.set(0, 0.36, 0);
    monocoque.castShadow = true;
    body.add(monocoque);

    // Aerodynamic Sloped Nose Hood
    const hoodGeo = new THREE.BoxGeometry(width * 0.64, 0.18, length * 0.42);
    const hood = new THREE.Mesh(hoodGeo, whitePaintMaterial);
    hood.position.set(0, 0.44, length * 0.24);
    hood.rotation.x = -0.12;
    hood.castShadow = true;
    body.add(hood);

    // Crimson Red Racing Center Livery Stripes
    const stripeGeo = new THREE.BoxGeometry(0.24, 0.02, length * 0.43);
    const stripe = new THREE.Mesh(stripeGeo, crimsonAccentMaterial);
    stripe.position.set(0, 0.54, length * 0.24);
    stripe.rotation.x = -0.12;
    body.add(stripe);

    // Flanking Cyan Pinstripes
    const pinGeo = new THREE.BoxGeometry(0.02, 0.022, length * 0.43);
    const pinL = new THREE.Mesh(pinGeo, neonCyanMaterial);
    pinL.position.set(-0.14, 0.54, length * 0.24);
    pinL.rotation.x = -0.12;
    const pinR = new THREE.Mesh(pinGeo, neonCyanMaterial);
    pinR.position.set(0.14, 0.54, length * 0.24);
    pinR.rotation.x = -0.12;
    body.add(pinL, pinR);

    // SIGNATURE TECH 'T' CREST ON HOOD NOSE
    const techCrestGroup = new THREE.Group();
    techCrestGroup.position.set(0, 0.51, length * 0.38);
    techCrestGroup.rotation.x = -0.12;

    // Horizontal 'T' Bar
    const tBarGeo = new THREE.BoxGeometry(0.18, 0.025, 0.04);
    const tBar = new THREE.Mesh(tBarGeo, chromeMaterial);
    techCrestGroup.add(tBar);

    // Vertical 'T' Stem (Tapered triangle)
    const tStemGeo = new THREE.BoxGeometry(0.04, 0.025, 0.12);
    const tStem = new THREE.Mesh(tStemGeo, chromeMaterial);
    tStem.position.set(0, 0, 0.06);
    techCrestGroup.add(tStem);

    // Glowing Cyan Core Underlay for 'T'
    const tGlowGeo = new THREE.BoxGeometry(0.19, 0.02, 0.03);
    const tGlow = new THREE.Mesh(tGlowGeo, neonCyanMaterial);
    tGlow.position.set(0, -0.005, 0);
    techCrestGroup.add(tGlow);

    body.add(techCrestGroup);

    // Sculpted Cyber Cockpit Canopy
    const canopyGeo = new THREE.BoxGeometry(width * 0.52, 0.26, 0.65);
    const canopy = new THREE.Mesh(canopyGeo, carbonMaterial);
    canopy.position.set(0, 0.52, -0.08);
    body.add(canopy);

    // Raked Digital Glass HUD Visor
    const visorGeo = new THREE.BoxGeometry(width * 0.50, 0.20, 0.04);
    const visor = new THREE.Mesh(visorGeo, glassMaterial);
    visor.position.set(0, 0.65, 0.18);
    visor.rotation.x = 0.45;
    body.add(visor);

    // High-Tech Yoke Steering Wheel (Tesla style open-top yoke)
    const yokeGroup = new THREE.Group();
    yokeGroup.position.set(0, 0.60, 0.08);
    yokeGroup.rotation.x = -0.35;

    const yokeBaseGeo = new THREE.BoxGeometry(0.24, 0.03, 0.04);
    const yokeBase = new THREE.Mesh(yokeBaseGeo, carbonMaterial);
    yokeGroup.add(yokeBase);

    const yokeGripGeo = new THREE.BoxGeometry(0.04, 0.12, 0.04);
    const gripL = new THREE.Mesh(yokeGripGeo, crimsonAccentMaterial);
    gripL.position.set(-0.11, 0.04, 0);
    const gripR = new THREE.Mesh(yokeGripGeo, crimsonAccentMaterial);
    gripR.position.set(0.11, 0.04, 0);
    yokeGroup.add(gripL, gripR);

    // Center Display Tablet
    const tabletGeo = new THREE.BoxGeometry(0.08, 0.06, 0.015);
    const tabletMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const tablet = new THREE.Mesh(tabletGeo, tabletMat);
    tablet.position.set(0, 0.02, 0.02);
    yokeGroup.add(tablet);
    body.add(yokeGroup);

    // Racing Bucket Seat
    const seatGeo = new THREE.BoxGeometry(0.48, 0.42, 0.42);
    const seat = new THREE.Mesh(seatGeo, carbonMaterial);
    seat.position.set(0, 0.52, -0.16);
    seat.rotation.x = -0.15;
    body.add(seat);

    // Integrated Aerodynamic Rear Ducktail Spoiler
    const ducktailGeo = new THREE.BoxGeometry(width * 0.68, 0.06, 0.22);
    const ducktail = new THREE.Mesh(ducktailGeo, whitePaintMaterial);
    ducktail.position.set(0, 0.68, -length * 0.34);
    ducktail.rotation.x = 0.12;
    body.add(ducktail);

    const ducktailLipGeo = new THREE.BoxGeometry(width * 0.68, 0.025, 0.04);
    const ducktailLip = new THREE.Mesh(ducktailLipGeo, neonCyanMaterial);
    ducktailLip.position.set(0, 0.72, -length * 0.35);
    body.add(ducktailLip);

    carRoot.add(body);

    // =========================================================================
    // 5. WHEELS NODE (Aero-Disc Turbofan Wheels with Cyan Lighting)
    // =========================================================================
    const wheelHalfWidth = 0.16;

    const makeWheel = (name: string, x: number, y: number, z: number): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(x, y, z);

      // Rotating sub-group (children[0]) spins around X via CarAnimation
      const wheelSpinner = new THREE.Group();
      wheelSpinner.name = 'WheelSpinner';

      // Low-profile slick tire
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelHalfWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.85, metalness: 0.05 });
      const tire = new THREE.Mesh(tireGeo, tireMat);
      tire.castShadow = true;
      wheelSpinner.add(tire);

      // Aero-Disc Flat Turbofan Wheel Face
      const isRightSide = x > 0;
      const faceOffset = isRightSide ? (wheelHalfWidth * 0.5 + 0.005) : -(wheelHalfWidth * 0.5 + 0.005);

      const aeroDiscGeo = new THREE.CircleGeometry(wheelRadius * 0.74, 24);
      aeroDiscGeo.rotateY(isRightSide ? Math.PI / 2 : -Math.PI / 2);
      const aeroDiscMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.25, metalness: 0.85 });
      const aeroDisc = new THREE.Mesh(aeroDiscGeo, aeroDiscMat);
      aeroDisc.position.x = faceOffset;
      wheelSpinner.add(aeroDisc);

      // Cyan Outer Rim Ring
      const lipRingGeo = new THREE.TorusGeometry(wheelRadius * 0.75, 0.012, 10, 24);
      lipRingGeo.rotateY(Math.PI / 2);
      const lipRing = new THREE.Mesh(lipRingGeo, neonCyanMaterial);
      lipRing.position.x = faceOffset;
      wheelSpinner.add(lipRing);

      // Center Crimson Hub Accent
      const hubGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.025, 16);
      hubGeo.rotateZ(Math.PI / 2);
      const hubCap = new THREE.Mesh(hubGeo, crimsonAccentMaterial);
      hubCap.position.x = faceOffset + (isRightSide ? 0.01 : -0.01);
      wheelSpinner.add(hubCap);

      wheelGroup.add(wheelSpinner); // children[0] is spinning assembly

      // Stationary Ceramic Brake Rotor & Crimson Caliper
      const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.02, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, chromeMaterial);
      rotor.position.x = isRightSide ? -0.02 : 0.02;

      const caliperGeo = new THREE.BoxGeometry(0.05, 0.11, 0.13);
      const caliper = new THREE.Mesh(caliperGeo, crimsonAccentMaterial);
      caliper.position.set(rotor.position.x, wheelRadius * 0.26, 0);

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
    // 6. ANTENNA & ELECTRIC CYAN CONTACT HEAD
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.60, -length * 0.36);

    // Aerodynamic Base Mount Fin
    const mountGeo = new THREE.BoxGeometry(0.06, 0.08, 0.14);
    const mount = new THREE.Mesh(mountGeo, carbonMaterial);
    antenna.add(mount);

    // Ultra-Slender Flexible Carbon Mast
    const mastHeight = 1.35;
    const mastGeo = new THREE.CylinderGeometry(0.005, 0.012, mastHeight, 12);
    mastGeo.translate(0, mastHeight * 0.5 + 0.08, 0);
    const mastMesh = new THREE.Mesh(mastGeo, chromeMaterial);
    antenna.add(mastMesh);

    // Electric Cyan Glowing Toroidal Contact Head
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.set(0, mastHeight + 0.08, 0);

    const ringGeo = new THREE.TorusGeometry(0.13, 0.024, 14, 24);
    const ringMesh = new THREE.Mesh(ringGeo, neonCyanMaterial);
    contactHead.add(ringMesh);

    // Inner Glowing Plasma Node
    const nodeGeo = new THREE.SphereGeometry(0.05, 12, 12);
    const nodeMesh = new THREE.Mesh(nodeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    contactHead.add(nodeMesh);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 7. MONEY DISPLAY (Rear Crisp Cyan Ticker showing "$200")
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.48, -length * 0.40);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020b12';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$200', 128, 64);
    ctx.shadowBlur = 0;

    const displayTex = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const screenGeo = new THREE.PlaneGeometry(0.44, 0.22);
    screenGeo.rotateY(Math.PI);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);

    const frameGeo = new THREE.BoxGeometry(0.50, 0.26, 0.04);
    const frameMesh = new THREE.Mesh(frameGeo, carbonMaterial);
    frameMesh.position.z = 0.02;

    moneyDisplay.add(screenMesh);
    moneyDisplay.add(frameMesh);
    carRoot.add(moneyDisplay);

    // =========================================================================
    // 8. HEADLIGHTS & TAILLIGHTS (Razor-Thin Cyber Lighting)
    // =========================================================================
    const makeHeadlight = (name: string, x: number): THREE.Group => {
      const hlGroup = new THREE.Group();
      hlGroup.name = name;
      hlGroup.position.set(x, 0.42, length * 0.40);

      const housingGeo = new THREE.BoxGeometry(0.22, 0.06, 0.06);
      const housing = new THREE.Mesh(housingGeo, carbonMaterial);
      hlGroup.add(housing);

      // Razor-thin blade LED
      const bladeGeo = new THREE.BoxGeometry(0.18, 0.03, 0.02);
      const blade = new THREE.Mesh(bladeGeo, headlightMaterial);
      blade.position.z = 0.025;
      hlGroup.add(blade);

      // Cyan eyebrow DRL
      const browGeo = new THREE.BoxGeometry(0.19, 0.015, 0.02);
      const brow = new THREE.Mesh(browGeo, neonCyanMaterial);
      brow.position.set(0, 0.022, 0.025);
      hlGroup.add(brow);

      return hlGroup;
    };

    const headlightL = makeHeadlight('Headlight_L', -width * 0.27);
    const headlightR = makeHeadlight('Headlight_R', width * 0.27);
    carRoot.add(headlightL, headlightR);

    // Razor-Thin Full-Width TailLight
    const makeTailLight = (name: string, x: number): THREE.Group => {
      const tlGroup = new THREE.Group();
      tlGroup.name = name;
      tlGroup.position.set(x, 0.46, -length * 0.39);

      const barGeo = new THREE.BoxGeometry(0.22, 0.035, 0.03);
      const bar = new THREE.Mesh(barGeo, taillightMaterial);
      tlGroup.add(bar);

      return tlGroup;
    };

    const taillightL = makeTailLight('TailLight_L', -width * 0.24);
    const taillightR = makeTailLight('TailLight_R', width * 0.24);
    carRoot.add(taillightL, taillightR);

    // =========================================================================
    // 9. VFX ANCHOR NODES & CYBER THRUST NOZZLES
    // =========================================================================
    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.22, -length * 0.42);

    // Sleek Dual Hexagonal Plasma Thruster Vents
    const thrusterGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.15, 6);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterL = new THREE.Mesh(thrusterGeo, chromeMaterial);
    thrusterL.position.x = -0.18;
    const thrusterR = new THREE.Mesh(thrusterGeo, chromeMaterial);
    thrusterR.position.x = 0.18;
    vfxBoost.add(thrusterL, thrusterR);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.set(0, mastHeight + 0.08, -length * 0.36);
    carRoot.add(vfxAntenna);

    const vfxImpact = new THREE.Group();
    vfxImpact.name = 'VFX_Impact';
    vfxImpact.position.set(0, 0.30, 0);
    carRoot.add(vfxImpact);

    const vfxCoin = new THREE.Group();
    vfxCoin.name = 'VFX_Coin';
    vfxCoin.position.set(0, 0.50, 0);
    carRoot.add(vfxCoin);

    const vfxSkid = new THREE.Group();
    vfxSkid.name = 'VFX_Skid';
    vfxSkid.position.set(0, 0.05, 0);
    carRoot.add(vfxSkid);

    return carRoot;
  }
}
