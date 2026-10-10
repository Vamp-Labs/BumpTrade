import * as THREE from 'three';
import { DOGE_KART_CONFIG } from './VehicleTypes';

/**
 * Procedural Doge Kart 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the Crypto-Meme Dune Buggy / Drift Kart:
 * 1. Silhouette: Open-chassis tubular exo-skeleton Baja buggy with high ground clearance.
 * 2. Dimensions: L 2.45m × W 1.84m × H 1.45m.
 * 3. Color & Materials: Warm Shiba Orange (#F59E0B) with Cream White belly panels (#FEF3C7),
 *    powder-coated Gold/Amber tubular roll cage (#FFAA00), and vibrant yellow suspension coils.
 * 4. Distinctive Features:
 *    - Exposed long-travel coilover suspension with bright neon yellow springs.
 *    - 12-point tubular exo-skeleton roll cage with roof cross-bracing.
 *    - Roof-mounted 4-pod rally LED auxiliary light bar.
 *    - High-mounted twin round yellow rally spotlights with amber stone guards.
 *    - Sculpted Shiba Inu mascot driver with perked ears and 8-bit pixelated "Deal With It" shades.
 *    - Dual upward-raked megaphone chrome blast exhausts.
 *    - Flexible whip antenna with 3D golden Dogecoin ('Ð') medallion contact head (Z = 1.45m).
 *    - Aggressive knobby off-road tires with gold powder-coated beadlock rings.
 * 5. Dynamic Money Display: "$69" digital cash readout.
 * 6. Full CarNodeBindings compliance.
 */
export class DogeKartModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = DOGE_KART_CONFIG.dimensions.length;
    const width = DOGE_KART_CONFIG.dimensions.width;
    const wheelRadius = DOGE_KART_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED PBR MATERIALS
    // =========================================================================
    const dogePaintMaterial = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.28,
      metalness: 0.72,
    });
    dogePaintMaterial.name = 'DogeOrangePaint';
    dogePaintMaterial.userData = { isPaint: true };

    const creamAccentMaterial = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      roughness: 0.22,
      metalness: 0.25,
    });
    creamAccentMaterial.name = 'CreamAccent';
    creamAccentMaterial.userData = { isPaint: true };

    const amberGoldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 3.2,
      roughness: 0.12,
      metalness: 0.40,
    });

    const goldMedallionMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.12,
      metalness: 0.98,
    });

    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4fa,
      roughness: 0.04,
      metalness: 0.98,
    });

    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.44,
      metalness: 0.88,
    });

    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.88,
      metalness: 0.05,
    });

    const rallyYellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe033,
      emissive: 0xffc800,
      emissiveIntensity: 4.2,
      roughness: 0.08,
      metalness: 0.10,
    });

    const springYellowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe600,
      roughness: 0.25,
      metalness: 0.35,
    });

    const tailLightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1e32,
      emissive: 0xff0020,
      emissiveIntensity: 3.5,
      roughness: 0.10,
      metalness: 0.10,
    });

    const dogeFurMaterial = new THREE.MeshStandardMaterial({
      color: 0xeba828,
      roughness: 0.75,
      metalness: 0.02,
    });

    const dogeMuzzleMaterial = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      roughness: 0.65,
      metalness: 0.02,
    });

    const sunglassesMaterial = new THREE.MeshStandardMaterial({
      color: 0x080808,
      roughness: 0.04,
      metalness: 0.95,
    });

    // =========================================================================
    // 2. CHASSIS GROUP & SUSPENSION
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Lower skid plate / floor pan
    const floorGeo = new THREE.BoxGeometry(width * 0.72, 0.08, length * 0.82);
    const floorMesh = new THREE.Mesh(floorGeo, darkMetalMaterial);
    floorMesh.position.y = 0.18;
    floorMesh.castShadow = true;
    floorMesh.receiveShadow = true;
    chassis.add(floorMesh);

    // Battery pack / center console box
    const battGeo = new THREE.BoxGeometry(0.38, 0.22, 0.72);
    const battMesh = new THREE.Mesh(battGeo, darkMetalMaterial);
    battMesh.position.set(0, 0.28, 0.08);
    chassis.add(battMesh);

    // 4 Exposed Long-Travel Coilovers with Yellow Springs
    const trackHalf = width * 0.44;
    const wbHalf = length * 0.30;
    const suspPositions = [
      { x: -trackHalf, z: -wbHalf },
      { x:  trackHalf, z: -wbHalf },
      { x: -trackHalf, z:  wbHalf },
      { x:  trackHalf, z:  wbHalf },
    ];

    suspPositions.forEach((pos) => {
      const signX = pos.x > 0 ? 1 : -1;
      const sGroup = new THREE.Group();
      sGroup.position.set(pos.x * 0.65, 0.34, pos.z);

      // Damper cylinder
      const shaftGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.28, 12);
      const shaftMesh = new THREE.Mesh(shaftGeo, chromeMaterial);
      shaftMesh.rotation.z = signX * 0.32;
      sGroup.add(shaftMesh);

      // Yellow outer coil spring
      const springGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.22, 16);
      const springMesh = new THREE.Mesh(springGeo, springYellowMaterial);
      springMesh.rotation.z = signX * 0.32;
      sGroup.add(springMesh);

      chassis.add(sGroup);
    });

    carRoot.add(chassis);

    // =========================================================================
    // 3. BODY GROUP
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // Sloping Buggy Nose Cowl
    const noseGeo = new THREE.BoxGeometry(width * 0.64, 0.16, 0.82);
    const noseMesh = new THREE.Mesh(noseGeo, dogePaintMaterial);
    noseMesh.position.set(0, 0.36, -0.62);
    noseMesh.rotation.x = 0.12;
    noseMesh.castShadow = true;
    body.add(noseMesh);

    // Center Cream White Hood Scoop
    const scoopGeo = new THREE.BoxGeometry(0.32, 0.06, 0.68);
    const scoopMesh = new THREE.Mesh(scoopGeo, creamAccentMaterial);
    scoopMesh.position.set(0, 0.45, -0.62);
    scoopMesh.rotation.x = 0.12;
    body.add(scoopMesh);

    // Side Intake Pods
    for (const side of [-1, 1]) {
      const podGeo = new THREE.BoxGeometry(0.24, 0.22, 0.88);
      const podMesh = new THREE.Mesh(podGeo, dogePaintMaterial);
      podMesh.position.set(side * (width * 0.36), 0.34, 0.05);
      body.add(podMesh);

      // Cream pinstripe bar
      const stripGeo = new THREE.BoxGeometry(0.04, 0.06, 0.80);
      const stripMesh = new THREE.Mesh(stripGeo, creamAccentMaterial);
      stripMesh.position.set(side * (width * 0.46), 0.38, 0.05);
      body.add(stripMesh);
    }

    // Rear Mid-Engine Deck & Radiator Shroud
    const deckGeo = new THREE.BoxGeometry(width * 0.68, 0.24, 0.68);
    const deckMesh = new THREE.Mesh(deckGeo, darkMetalMaterial);
    deckMesh.position.set(0, 0.40, 0.68);
    body.add(deckMesh);

    // Rear Ducktail Kick Lip
    const ducktailGeo = new THREE.BoxGeometry(width * 0.70, 0.08, 0.18);
    const ducktailMesh = new THREE.Mesh(ducktailGeo, dogePaintMaterial);
    ducktailMesh.position.set(0, 0.54, 0.98);
    ducktailMesh.rotation.x = 0.18;
    body.add(ducktailMesh);

    // =========================================================================
    // 4. TUBULAR EXO-SKELETON ROLL CAGE & ROOF LIGHT BAR
    // =========================================================================
    const rollCage = new THREE.Group();
    rollCage.name = 'RollCage';

    const cageRadius = 0.024;
    // Main A-Pillars (Cowl to Roof)
    for (const side of [-1, 1]) {
      // Front A-pillar tube
      const aGeo = new THREE.CylinderGeometry(cageRadius, cageRadius, 0.82, 12);
      const aMesh = new THREE.Mesh(aGeo, amberGoldMaterial);
      aMesh.position.set(side * 0.38, 0.78, -0.22);
      aMesh.rotation.x = 0.38;
      aMesh.rotation.z = -side * 0.12;
      rollCage.add(aMesh);

      // Main B-pillar vertical roll hoop
      const bGeo = new THREE.CylinderGeometry(cageRadius, cageRadius, 0.74, 12);
      const bMesh = new THREE.Mesh(bGeo, amberGoldMaterial);
      bMesh.position.set(side * 0.36, 0.80, 0.32);
      rollCage.add(bMesh);

      // Rear C-pillar down-bars
      const cGeo = new THREE.CylinderGeometry(cageRadius, cageRadius, 0.78, 12);
      const cMesh = new THREE.Mesh(cGeo, amberGoldMaterial);
      cMesh.position.set(side * 0.38, 0.76, 0.72);
      cMesh.rotation.x = -0.48;
      rollCage.add(cMesh);
    }

    // Roof lateral cross-bars
    const rBarFGeo = new THREE.CylinderGeometry(cageRadius, cageRadius, 0.72, 12);
    const rBarFMesh = new THREE.Mesh(rBarFGeo, amberGoldMaterial);
    rBarFMesh.rotation.z = Math.PI / 2;
    rBarFMesh.position.set(0, 1.14, -0.04);
    rollCage.add(rBarFMesh);

    const rBarRGeo = new THREE.CylinderGeometry(cageRadius, cageRadius, 0.72, 12);
    const rBarRMesh = new THREE.Mesh(rBarRGeo, amberGoldMaterial);
    rBarRMesh.rotation.z = Math.PI / 2;
    rBarRMesh.position.set(0, 1.16, 0.32);
    rollCage.add(rBarRMesh);

    // Roof Light Bar: 4 Auxiliary Mini LED Pods
    for (const px of [-0.24, -0.08, 0.08, 0.24]) {
      const podBox = new THREE.BoxGeometry(0.08, 0.07, 0.06);
      const podMesh = new THREE.Mesh(podBox, darkMetalMaterial);
      podMesh.position.set(px, 1.22, -0.04);
      rollCage.add(podMesh);

      const podLens = new THREE.BoxGeometry(0.06, 0.05, 0.015);
      const podLensMesh = new THREE.Mesh(podLens, rallyYellowMaterial);
      podLensMesh.position.set(px, 1.22, -0.075);
      rollCage.add(podLensMesh);
    }

    body.add(rollCage);

    // =========================================================================
    // 5. RALLY SPOTLIGHT HEADLIGHTS (Headlight_L & Headlight_R)
    // =========================================================================
    const createRallySpot = (name: string, posX: number): THREE.Group => {
      const g = new THREE.Group();
      g.name = name;
      g.position.set(posX, 0.50, -1.02);

      // Deep Bucket Housing
      const bktGeo = new THREE.CylinderGeometry(0.092, 0.078, 0.10, 24);
      const bktMesh = new THREE.Mesh(bktGeo, darkMetalMaterial);
      bktMesh.rotation.x = Math.PI / 2;
      g.add(bktMesh);

      // High-output Yellow Rally Lens
      const lensGeo = new THREE.CylinderGeometry(0.084, 0.084, 0.015, 24);
      const lensMesh = new THREE.Mesh(lensGeo, rallyYellowMaterial);
      lensMesh.rotation.x = Math.PI / 2;
      lensMesh.position.z = -0.05;
      g.add(lensMesh);

      // Amber Stone Guard Cross
      const sgHGeo = new THREE.BoxGeometry(0.16, 0.012, 0.01);
      const sgHMesh = new THREE.Mesh(sgHGeo, amberGoldMaterial);
      sgHMesh.position.z = -0.058;
      g.add(sgHMesh);

      const sgVGeo = new THREE.BoxGeometry(0.012, 0.16, 0.01);
      const sgVMesh = new THREE.Mesh(sgVGeo, amberGoldMaterial);
      sgVMesh.position.z = -0.058;
      g.add(sgVMesh);

      return g;
    };

    body.add(createRallySpot('Headlight_L', -0.24));
    body.add(createRallySpot('Headlight_R',  0.24));

    // =========================================================================
    // 6. TAILLIGHTS
    // =========================================================================
    const createTailLight = (name: string, posX: number): THREE.Mesh => {
      const tlGeo = new THREE.BoxGeometry(0.14, 0.06, 0.05);
      const tlMesh = new THREE.Mesh(tlGeo, tailLightMaterial);
      tlMesh.name = name;
      tlMesh.position.set(posX, 0.46, 1.05);
      return tlMesh;
    };
    body.add(createTailLight('TailLight_L', -0.36));
    body.add(createTailLight('TailLight_R',  0.36));

    // =========================================================================
    // 7. DUAL MEGAPHONE BLAST EXHAUSTS
    // =========================================================================
    for (const side of [-1, 1]) {
      const exhGeo = new THREE.CylinderGeometry(0.075, 0.040, 0.28, 16);
      const exhMesh = new THREE.Mesh(exhGeo, chromeMaterial);
      exhMesh.position.set(side * 0.20, 0.58, 0.98);
      exhMesh.rotation.x = -Math.PI / 3.2;
      exhMesh.rotation.z = -side * 0.12;
      body.add(exhMesh);
    }

    // =========================================================================
    // 8. SHIBA INU MASCOT DRIVER (Perked Ears + Deal-With-It 8-Bit Shades)
    // =========================================================================
    const driver = new THREE.Group();
    driver.name = 'Driver';
    driver.position.set(0, 0.52, 0.04);

    // Shiba Head (Tan Fur)
    const headGeo = new THREE.BoxGeometry(0.28, 0.30, 0.26);
    const headMesh = new THREE.Mesh(headGeo, dogeFurMaterial);
    headMesh.position.y = 0.34;
    driver.add(headMesh);

    // Shiba Snout & Muzzle (Cream White)
    const snoutGeo = new THREE.BoxGeometry(0.18, 0.14, 0.14);
    const snoutMesh = new THREE.Mesh(snoutGeo, dogeMuzzleMaterial);
    snoutMesh.position.set(0, 0.28, -0.16);
    driver.add(snoutMesh);

    // Black Button Nose
    const dNoseGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
    const dNoseMesh = new THREE.Mesh(dNoseGeo, darkMetalMaterial);
    dNoseMesh.position.set(0, 0.33, -0.24);
    driver.add(dNoseMesh);

    // Triangular Perked Ears
    for (const side of [-1, 1]) {
      const earGeo = new THREE.ConeGeometry(0.08, 0.16, 4);
      const earMesh = new THREE.Mesh(earGeo, dogeFurMaterial);
      earMesh.position.set(side * 0.12, 0.52, 0.02);
      earMesh.rotation.z = -side * 0.35;
      earMesh.rotation.x = -0.15;
      driver.add(earMesh);

      // Inner Cream Ear
      const inEarGeo = new THREE.ConeGeometry(0.05, 0.12, 4);
      const inEarMesh = new THREE.Mesh(inEarGeo, dogeMuzzleMaterial);
      inEarMesh.position.set(side * 0.12, 0.52, -0.015);
      inEarMesh.rotation.z = -side * 0.35;
      inEarMesh.rotation.x = -0.15;
      driver.add(inEarMesh);
    }

    // 8-Bit Pixelated "Deal With It" Shades
    const shadesGeo = new THREE.BoxGeometry(0.30, 0.06, 0.04);
    const shadesMesh = new THREE.Mesh(shadesGeo, sunglassesMaterial);
    shadesMesh.position.set(0, 0.38, -0.14);
    driver.add(shadesMesh);
    // Lower pixel stair steps
    for (const side of [-1, 1]) {
      const stepGeo = new THREE.BoxGeometry(0.08, 0.03, 0.04);
      const stepMesh = new THREE.Mesh(stepGeo, sunglassesMaterial);
      stepMesh.position.set(side * 0.08, 0.34, -0.14);
      driver.add(stepMesh);
    }

    // Torso in Off-Road Harness
    const torsoGeo = new THREE.BoxGeometry(0.34, 0.28, 0.26);
    const torsoMesh = new THREE.Mesh(torsoGeo, darkMetalMaterial);
    torsoMesh.position.y = 0.10;
    driver.add(torsoMesh);

    // Off-Road Sport Steering Wheel
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(0, 0.30, -0.24);
    wheelGroup.rotation.x = 0.45;
    const rimTorus = new THREE.TorusGeometry(0.12, 0.016, 12, 24);
    const rimMesh = new THREE.Mesh(rimTorus, darkMetalMaterial);
    wheelGroup.add(rimMesh);
    const spokeGeo = new THREE.CylinderGeometry(0.010, 0.010, 0.22, 8);
    const spokeMesh = new THREE.Mesh(spokeGeo, amberGoldMaterial);
    wheelGroup.add(spokeMesh);
    driver.add(wheelGroup);

    body.add(driver);

    // =========================================================================
    // 9. MONEY DISPLAY ($69 Dynamic Canvas Readout)
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.46, -0.80);
    moneyDisplay.rotation.x = -0.35;

    const mdFrameGeo = new THREE.BoxGeometry(0.34, 0.18, 0.04);
    const mdFrame = new THREE.Mesh(mdFrameGeo, darkMetalMaterial);
    moneyDisplay.add(mdFrame);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#060a08';
      ctx.fillRect(0, 0, 256, 128);
      ctx.fillStyle = '#ffaa00';
      ctx.strokeStyle = '#ffd000';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 244, 116);
      ctx.font = 'bold 74px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$69', 128, 64);
    }
    const displayTex = new THREE.CanvasTexture(canvas);
    const mdScreenGeo = new THREE.PlaneGeometry(0.30, 0.14);
    const mdScreenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const mdScreen = new THREE.Mesh(mdScreenGeo, mdScreenMat);
    mdScreen.position.z = 0.022;
    moneyDisplay.add(mdScreen);

    body.add(moneyDisplay);
    carRoot.add(body);

    // =========================================================================
    // 10. BUMPER COLLAR & FRONT BRUSH GUARD
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Wraparound Rubber Impact Ring
    const bumperGeo = new THREE.BoxGeometry(width * 0.96, 0.14, length * 0.96);
    const bumperMesh = new THREE.Mesh(bumperGeo, rubberMaterial);
    bumperMesh.position.y = 0.24;
    bumper.add(bumperMesh);

    // Tubular Front Bull-Bar Brush Guard
    const guardBarGeo = new THREE.CylinderGeometry(0.028, 0.028, width * 0.76, 16);
    const guardBarMesh = new THREE.Mesh(guardBarGeo, amberGoldMaterial);
    guardBarMesh.rotation.z = Math.PI / 2;
    guardBarMesh.position.set(0, 0.38, -length * 0.48);
    bumper.add(guardBarMesh);

    // Amber Neon Trim Channel
    const neonGeo = new THREE.BoxGeometry(width * 0.98, 0.025, length * 0.98);
    const neonMesh = new THREE.Mesh(neonGeo, amberGoldMaterial);
    neonMesh.position.y = 0.24;
    bumper.add(neonMesh);

    carRoot.add(bumper);

    // =========================================================================
    // 11. ANTENNA & GOLDEN DOGECOIN ('Ð') MEDALLION CONTACT HEAD
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.40, 0.65);

    // Flexible Carbon Whip Spring Mast
    const mastGeo = new THREE.CylinderGeometry(0.010, 0.016, 0.65, 12);
    const mastMesh = new THREE.Mesh(mastGeo, darkMetalMaterial);
    mastMesh.position.y = 0.38;
    antenna.add(mastMesh);

    // Spring Base
    const sBaseGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.08, 16);
    const sBaseMesh = new THREE.Mesh(sBaseGeo, chromeMaterial);
    sBaseMesh.position.y = 0.04;
    antenna.add(sBaseMesh);

    // ContactHead: 3D Golden Dogecoin ('Ð') Medallion (Z = 1.45m)
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.y = 0.72; // 0.40 + 0.38 + 0.34 ~= 1.12 + carY ~= 1.45m

    // Coin Disc (radius 0.12m, thickness 0.024m)
    const coinGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.024, 24);
    const coinMesh = new THREE.Mesh(coinGeo, goldMedallionMaterial);
    coinMesh.rotation.x = Math.PI / 2;
    contactHead.add(coinMesh);

    // Outer Glowing Amber Neon Ring
    const neonRingGeo = new THREE.TorusGeometry(0.132, 0.014, 12, 24);
    const neonRingMesh = new THREE.Mesh(neonRingGeo, amberGoldMaterial);
    contactHead.add(neonRingMesh);

    // Raised 'Ð' Relief Crossbar
    const dBarGeo = new THREE.BoxGeometry(0.12, 0.035, 0.032);
    const dBarMesh = new THREE.Mesh(dBarGeo, goldMedallionMaterial);
    contactHead.add(dBarMesh);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 12. 4 WHEELS (Knobby Off-Road Tires + Gold Beadlock Rims)
    // =========================================================================
    const createDogeWheel = (name: string, isFront: boolean): THREE.Group => {
      const wGroup = new THREE.Group();
      wGroup.name = name;

      const r = isFront ? wheelRadius * 0.94 : wheelRadius * 1.12;
      const w = isFront ? 0.22 : 0.28;

      // Knobby Rubber Tire
      const tireGeo = new THREE.CylinderGeometry(r, r, w, 24);
      const tireMesh = new THREE.Mesh(tireGeo, rubberMaterial);
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.castShadow = true;
      wGroup.add(tireMesh);

      // Gold Beadlock Rim Outer Ring
      const rimGeo = new THREE.CylinderGeometry(r * 0.75, r * 0.75, w * 1.02, 20);
      const rimMesh = new THREE.Mesh(rimGeo, amberGoldMaterial);
      rimMesh.rotation.z = Math.PI / 2;
      wGroup.add(rimMesh);

      // Dark Graphite Wheel Core
      const coreGeo = new THREE.CylinderGeometry(r * 0.60, r * 0.60, w * 1.04, 16);
      const coreMesh = new THREE.Mesh(coreGeo, darkMetalMaterial);
      coreMesh.rotation.z = Math.PI / 2;
      wGroup.add(coreMesh);

      // Chrome Center Lug Cap
      const capGeo = new THREE.CylinderGeometry(0.045, 0.045, w * 1.08, 12);
      const capMesh = new THREE.Mesh(capGeo, chromeMaterial);
      capMesh.rotation.z = Math.PI / 2;
      wGroup.add(capMesh);

      return wGroup;
    };

    const wY = wheelRadius;
    const wFL = createDogeWheel('Wheel_FL', true);
    wFL.position.set(-trackHalf, wY, -wbHalf);
    carRoot.add(wFL);

    const wFR = createDogeWheel('Wheel_FR', true);
    wFR.position.set( trackHalf, wY, -wbHalf);
    carRoot.add(wFR);

    const wRL = createDogeWheel('Wheel_RL', false);
    wRL.position.set(-trackHalf, wY * 1.1,  wbHalf);
    carRoot.add(wRL);

    const wRR = createDogeWheel('Wheel_RR', false);
    wRR.position.set( trackHalf, wY * 1.1,  wbHalf);
    carRoot.add(wRR);

    // =========================================================================
    // 13. VFX ATTACHMENT NODES
    // =========================================================================
    const vfxImpact = new THREE.Group();
    vfxImpact.name = 'VFX_Impact';
    vfxImpact.position.set(0, 0.28, -length * 0.48);
    carRoot.add(vfxImpact);

    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.45, length * 0.50);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.copy(contactHead.position);
    antenna.add(vfxAntenna);

    const vfxCoin = new THREE.Group();
    vfxCoin.name = 'VFX_Coin';
    vfxCoin.position.set(0, 0.85, 0);
    carRoot.add(vfxCoin);

    const vfxSkid = new THREE.Group();
    vfxSkid.name = 'VFX_Skid';
    vfxSkid.position.set(0, 0.05, 0);
    carRoot.add(vfxSkid);

    return carRoot;
  }
}
