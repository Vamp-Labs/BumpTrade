import * as THREE from 'three';
import { HOOD_BEAR_CONFIG } from './VehicleTypes';

/**
 * Procedural Hood Bear 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the heavy brawler archetype vehicle from BUMP.TRADE:
 * 1. Silhouette: Wide, muscular brawler body with flared heavy fenders and power hood.
 * 2. Dimensions: L 2.7m × W 2.0m × H 1.40m with heavy-tread wheels.
 * 3. Color & Materials: Deep crimson red metallic paint with dark charcoal accents,
 *    dual-tier rubber bumper with glowing crimson neon perimeter ring.
 * 4. Crest & Mascot: Glowing Bear Face/Claw emblem on hood, Bear mascot with sunglasses & round ears.
 * 5. Dynamic Money Display: "$120" dynamic cash readout in glowing red LED font.
 * 6. Contact Head: Reinforced dark titanium mast with glowing ruby red circular contact head.
 * 7. Full CarNodeBindings compliance with wheelSpinner grouping for smooth wheel rotation.
 */
export class HoodBearModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = HOOD_BEAR_CONFIG.dimensions.length;
    const width = HOOD_BEAR_CONFIG.dimensions.width;
    const wheelRadius = HOOD_BEAR_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED MATERIALS
    // =========================================================================
    // Deep Crimson Metallic Paint
    const paintMaterial = new THREE.MeshStandardMaterial({
      color: 0x820c15,
      roughness: 0.16,
      metalness: 0.88,
    });
    paintMaterial.name = 'BearPaint';
    paintMaterial.userData = { isPaint: true };

    // Dark Charcoal / Matte Composite
    const darkCharcoalMaterial = new THREE.MeshStandardMaterial({
      color: 0x141518,
      roughness: 0.55,
      metalness: 0.45,
    });

    // Heavy Industrial Dual-Tier Rubber Bumper
    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f1012,
      roughness: 0.90,
      metalness: 0.04,
    });

    // Neon Glow Crimson Red
    const neonRedMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      emissive: 0xff0044,
      emissiveIntensity: 2.2,
      roughness: 0.10,
    });

    // Fiery Orange/Amber Accent Glow
    const fieryAmberMaterial = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff3300,
      emissiveIntensity: 2.5,
      roughness: 0.12,
    });

    // Dark Gunmetal / Titanium
    const gunmetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x22252a,
      roughness: 0.35,
      metalness: 0.92,
    });

    // Chrome Trim
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4f8,
      roughness: 0.06,
      metalness: 0.98,
    });

    // Headlight Material (Fiery Orange/Red projector glow)
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa44,
      emissive: 0xff4400,
      emissiveIntensity: 3.2,
      roughness: 0.08,
    });

    // Taillight Material (Intense Ruby Red LED)
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff002b,
      emissiveIntensity: 3.4,
      roughness: 0.10,
    });

    // Bear Mascot Fur (Authentic Dark Grizzly Charcoal-Brown)
    const bearFurMaterial = new THREE.MeshStandardMaterial({
      color: 0x24140b,
      roughness: 0.85,
      metalness: 0.02,
    });

    // Snout / Inner Ear (Lighter Grizzly Accent Brown)
    const snoutMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a2012,
      roughness: 0.75,
      metalness: 0.02,
    });

    // =========================================================================
    // 2. CHASSIS NODE
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Heavy reinforced floorpan
    const chassisBaseGeo = new THREE.BoxGeometry(width * 0.82, 0.24, length * 0.88);
    const chassisMesh = new THREE.Mesh(chassisBaseGeo, gunmetalMaterial);
    chassisMesh.position.y = 0.22;
    chassisMesh.castShadow = true;
    chassis.add(chassisMesh);

    // Lateral chassis skid plates
    const skidPlateGeo = new THREE.BoxGeometry(width * 0.86, 0.06, length * 0.60);
    const skidPlate = new THREE.Mesh(skidPlateGeo, darkCharcoalMaterial);
    skidPlate.position.set(0, 0.12, 0);
    chassis.add(skidPlate);

    // Deep Crimson Underglow PointLight
    const underglow = new THREE.PointLight(0xff0044, 2.2, 3.6);
    underglow.position.set(0, 0.12, 0);
    chassis.add(underglow);
    carRoot.add(chassis);

    // =========================================================================
    // 3. BUMPER NODE (Heavy Dual-Tier Reinforced Impact Collar)
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Lower Primary Tier Rubber Ring
    const lowerBumperGeo = new THREE.CylinderGeometry(width * 0.54, width * 0.57, 0.22, 28);
    lowerBumperGeo.scale(1.0, 1.0, length / width);
    const lowerBumper = new THREE.Mesh(lowerBumperGeo, rubberMaterial);
    lowerBumper.position.y = 0.20;
    lowerBumper.castShadow = true;
    bumper.add(lowerBumper);

    // Upper Heavy Impact Cushion Tier
    const upperBumperGeo = new THREE.CylinderGeometry(width * 0.52, width * 0.54, 0.16, 28);
    upperBumperGeo.scale(1.0, 1.0, length / width);
    const upperBumper = new THREE.Mesh(upperBumperGeo, rubberMaterial);
    upperBumper.position.y = 0.35;
    upperBumper.castShadow = true;
    bumper.add(upperBumper);

    // Glowing Crimson Neon Perimeter Channel
    const neonTrimGeo = new THREE.CylinderGeometry(width * 0.545, width * 0.575, 0.06, 28);
    neonTrimGeo.scale(1.0, 1.0, length / width);
    const neonTrim = new THREE.Mesh(neonTrimGeo, neonRedMaterial);
    neonTrim.position.y = 0.24;
    bumper.add(neonTrim);

    // Heavy Front Ramming Guard Teeth / Vertical Bumper Blocks
    for (let i = -2; i <= 2; i++) {
      const ramBlockGeo = new THREE.BoxGeometry(0.14, 0.30, 0.18);
      const ramBlock = new THREE.Mesh(ramBlockGeo, gunmetalMaterial);
      const angle = (i * 0.22);
      const rx = Math.sin(angle) * (width * 0.52);
      const rz = Math.cos(angle) * (length * 0.49);
      ramBlock.position.set(rx, 0.27, rz);
      ramBlock.rotation.y = angle;
      bumper.add(ramBlock);
    }

    carRoot.add(bumper);

    // =========================================================================
    // 4. BODY NODE (Bulky Muscular Shell with Bear Face Hood Crest)
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // Main Cockpit Tub & Lower Body
    const mainHullGeo = new THREE.BoxGeometry(width * 0.74, 0.36, length * 0.82);
    const mainHull = new THREE.Mesh(mainHullGeo, paintMaterial);
    mainHull.position.set(0, 0.38, 0);
    mainHull.castShadow = true;
    body.add(mainHull);

    // Aggressive Flared Fenders (Wide Brawler Stance)
    const fenderGeo = new THREE.BoxGeometry(width * 0.86, 0.28, length * 0.76);
    const fenders = new THREE.Mesh(fenderGeo, paintMaterial);
    fenders.position.set(0, 0.42, 0);
    fenders.castShadow = true;
    body.add(fenders);

    // Bulging Power Hood with Angled Nose
    const hoodGeo = new THREE.BoxGeometry(width * 0.68, 0.24, length * 0.38);
    const hood = new THREE.Mesh(hoodGeo, paintMaterial);
    hood.position.set(0, 0.54, length * 0.22);
    hood.rotation.x = -0.06;
    hood.castShadow = true;
    body.add(hood);

    // Matte Carbon Hood Center Stripe & Power Bulge
    const bulgeGeo = new THREE.BoxGeometry(width * 0.36, 0.08, length * 0.36);
    const bulge = new THREE.Mesh(bulgeGeo, darkCharcoalMaterial);
    bulge.position.set(0, 0.64, length * 0.22);
    body.add(bulge);

    // Dual Hood Heat Extractor Louvers
    const louverGeo = new THREE.BoxGeometry(0.18, 0.02, 0.05);
    for (let side of [-1, 1]) {
      for (let z = 0; z < 3; z++) {
        const louver = new THREE.Mesh(louverGeo, gunmetalMaterial);
        louver.position.set(side * 0.24, 0.62, length * 0.20 + (z * 0.07));
        louver.rotation.x = 0.25;
        body.add(louver);
      }
    }

    // SIGNATURE BEAR CREST ON HOOD (Embossed Medallion & Bear Face Outline)
    const crestGroup = new THREE.Group();
    crestGroup.position.set(0, 0.685, length * 0.25);
    crestGroup.rotation.x = -0.06;

    // Crest Base Plaque
    const plaqueGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.02, 20);
    const plaque = new THREE.Mesh(plaqueGeo, darkCharcoalMaterial);
    crestGroup.add(plaque);

    // Bear Face Outer Glow Ring
    const crestRingGeo = new THREE.TorusGeometry(0.14, 0.015, 12, 24);
    crestRingGeo.rotateX(Math.PI / 2);
    const crestRing = new THREE.Mesh(crestRingGeo, neonRedMaterial);
    crestGroup.add(crestRing);

    // Stylized Bear Ears on Crest
    const crestEarGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.025, 12);
    const crestEarL = new THREE.Mesh(crestEarGeo, fieryAmberMaterial);
    crestEarL.position.set(-0.11, 0.01, -0.09);
    const crestEarR = new THREE.Mesh(crestEarGeo, fieryAmberMaterial);
    crestEarR.position.set(0.11, 0.01, -0.09);
    crestGroup.add(crestEarL, crestEarR);

    // Stylized Bear Snout on Crest
    const crestSnoutGeo = new THREE.BoxGeometry(0.10, 0.03, 0.08);
    const crestSnout = new THREE.Mesh(crestSnoutGeo, fieryAmberMaterial);
    crestSnout.position.set(0, 0.01, 0.04);
    crestGroup.add(crestSnout);

    body.add(crestGroup);

    // Heavy Roll Cage with Bear-Ear Earplates
    const rollBarGeo = new THREE.CylinderGeometry(0.03, 0.03, width * 0.62, 12);
    rollBarGeo.rotateZ(Math.PI / 2);
    const rollBar = new THREE.Mesh(rollBarGeo, gunmetalMaterial);
    rollBar.position.set(0, 1.05, -length * 0.18);
    body.add(rollBar);

    const rollPillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.48, 12);
    const rollPillarL = new THREE.Mesh(rollPillarGeo, gunmetalMaterial);
    rollPillarL.position.set(-width * 0.28, 0.82, -length * 0.18);
    const rollPillarR = new THREE.Mesh(rollPillarGeo, gunmetalMaterial);
    rollPillarR.position.set(width * 0.28, 0.82, -length * 0.18);
    body.add(rollPillarL, rollPillarR);

    // Bear Ear Roll Cage Earplates
    const earPlateGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.03, 16);
    earPlateGeo.rotateZ(Math.PI / 2);
    const earPlateL = new THREE.Mesh(earPlateGeo, paintMaterial);
    earPlateL.position.set(-width * 0.32, 1.15, -length * 0.18);
    const earPlateR = new THREE.Mesh(earPlateGeo, paintMaterial);
    earPlateR.position.set(width * 0.32, 1.15, -length * 0.18);
    body.add(earPlateL, earPlateR);

    // Rear Heavy Spoiler
    const spoilerGeo = new THREE.BoxGeometry(width * 0.72, 0.07, 0.28);
    const spoiler = new THREE.Mesh(spoilerGeo, darkCharcoalMaterial);
    spoiler.position.set(0, 0.94, -length * 0.36);
    spoiler.castShadow = true;
    body.add(spoiler);

    const spoilerEndGeo = new THREE.BoxGeometry(0.04, 0.18, 0.32);
    const spoilerEndL = new THREE.Mesh(spoilerEndGeo, neonRedMaterial);
    spoilerEndL.position.set(-width * 0.36, 0.96, -length * 0.36);
    const spoilerEndR = new THREE.Mesh(spoilerEndGeo, neonRedMaterial);
    spoilerEndR.position.set(width * 0.36, 0.96, -length * 0.36);
    body.add(spoilerEndL, spoilerEndR);

    // Struts
    const strutGeo = new THREE.BoxGeometry(0.05, 0.30, 0.08);
    const strutL = new THREE.Mesh(strutGeo, chromeMaterial);
    strutL.position.set(-width * 0.24, 0.78, -length * 0.35);
    const strutR = new THREE.Mesh(strutGeo, chromeMaterial);
    strutR.position.set(width * 0.24, 0.78, -length * 0.35);
    body.add(strutL, strutR);

    // BEAR MASCOT DRIVER NODE
    const driverGroup = new THREE.Group();
    driverGroup.name = 'Driver';

    // Bear Torso & Leather Vest
    const torsoGeo = new THREE.BoxGeometry(0.48, 0.40, 0.34);
    const torso = new THREE.Mesh(torsoGeo, darkCharcoalMaterial);
    torso.position.set(0, 0.68, -0.05);
    driverGroup.add(torso);

    // Large Round Bear Head
    const headGeo = new THREE.SphereGeometry(0.32, 18, 16);
    headGeo.scale(1.12, 1.0, 1.05);
    const headMesh = new THREE.Mesh(headGeo, bearFurMaterial);
    headMesh.position.set(0, 0.98, -0.04);
    headMesh.castShadow = true;
    driverGroup.add(headMesh);

    // Round Bear Ears
    const earGeo = new THREE.SphereGeometry(0.12, 14, 14);
    earGeo.scale(1.0, 1.0, 0.45);
    const earL = new THREE.Mesh(earGeo, bearFurMaterial);
    earL.position.set(-0.30, 1.24, -0.04);
    const earR = new THREE.Mesh(earGeo, bearFurMaterial);
    earR.position.set(0.30, 1.24, -0.04);
    driverGroup.add(earL, earR);

    // Inner Ears
    const innerEarGeo = new THREE.SphereGeometry(0.07, 10, 10);
    innerEarGeo.scale(1.0, 1.0, 0.3);
    const innerEarL = new THREE.Mesh(innerEarGeo, snoutMaterial);
    innerEarL.position.set(-0.30, 1.24, -0.02);
    const innerEarR = new THREE.Mesh(innerEarGeo, snoutMaterial);
    innerEarR.position.set(0.30, 1.24, -0.02);
    driverGroup.add(innerEarL, innerEarR);

    // Bear Snout
    const snoutGeo = new THREE.SphereGeometry(0.15, 14, 14);
    snoutGeo.scale(1.15, 0.85, 1.25);
    const snoutMesh = new THREE.Mesh(snoutGeo, snoutMaterial);
    snoutMesh.position.set(0, 0.90, 0.22);
    driverGroup.add(snoutMesh);

    // Black Leather Nose
    const noseGeo = new THREE.SphereGeometry(0.05, 10, 10);
    const noseMesh = new THREE.Mesh(noseGeo, rubberMaterial);
    noseMesh.position.set(0, 0.96, 0.38);
    driverGroup.add(noseMesh);

    // Biker Sunglasses with Red Lens Glow
    const glassesFrameGeo = new THREE.BoxGeometry(0.44, 0.12, 0.06);
    const glassesFrame = new THREE.Mesh(glassesFrameGeo, darkCharcoalMaterial);
    glassesFrame.position.set(0, 1.05, 0.24);
    driverGroup.add(glassesFrame);

    const lensGeo = new THREE.PlaneGeometry(0.16, 0.08);
    const lensMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const lensL = new THREE.Mesh(lensGeo, lensMat);
    lensL.position.set(-0.11, 1.05, 0.275);
    const lensR = new THREE.Mesh(lensGeo, lensMat);
    lensR.position.set(0.11, 1.05, 0.275);
    driverGroup.add(lensL, lensR);

    body.add(driverGroup);
    carRoot.add(body);

    // =========================================================================
    // 5. WHEELS NODE (Heavy-Tread Oversized Brawler Wheels)
    // =========================================================================
    const wheelHalfWidth = 0.20;

    const makeWheel = (name: string, x: number, y: number, z: number): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(x, y, z);

      // Rotating sub-group (children[0]) spins around X via CarAnimation
      const wheelSpinner = new THREE.Group();
      wheelSpinner.name = 'WheelSpinner';

      // Heavy Tread Tire
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelHalfWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, rubberMaterial);
      tire.castShadow = true;
      wheelSpinner.add(tire);

      // Deep Dish Dark Alloy Rim
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.68, wheelRadius * 0.68, wheelHalfWidth + 0.01, 18);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, gunmetalMaterial);
      wheelSpinner.add(rim);

      // Crimson Neon Outer Lip Ring
      const isRightSide = x > 0;
      const faceOffset = isRightSide ? (wheelHalfWidth * 0.5 + 0.005) : -(wheelHalfWidth * 0.5 + 0.005);

      const lipRingGeo = new THREE.TorusGeometry(wheelRadius * 0.69, 0.016, 10, 20);
      lipRingGeo.rotateY(Math.PI / 2);
      const lipRing = new THREE.Mesh(lipRingGeo, neonRedMaterial);
      lipRing.position.x = faceOffset;
      wheelSpinner.add(lipRing);

      // Center Bear Claw Hubcap
      const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12);
      hubGeo.rotateZ(Math.PI / 2);
      const hubCap = new THREE.Mesh(hubGeo, chromeMaterial);
      hubCap.position.x = faceOffset + (isRightSide ? 0.01 : -0.01);
      wheelSpinner.add(hubCap);

      wheelGroup.add(wheelSpinner); // children[0] is the spinning assembly

      // Stationary Brake Rotor & Red Caliper (children[1] & children[2])
      const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.50, wheelRadius * 0.50, 0.02, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, chromeMaterial);
      rotor.position.x = isRightSide ? -0.02 : 0.02;

      const caliperGeo = new THREE.BoxGeometry(0.06, 0.12, 0.14);
      const caliperMat = new THREE.MeshStandardMaterial({ color: 0xaa0022, roughness: 0.3, metalness: 0.7 });
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(rotor.position.x, wheelRadius * 0.28, 0);

      wheelGroup.add(rotor);
      wheelGroup.add(caliper);

      return wheelGroup;
    };

    const wheelPosX = width * 0.45;
    const wheelPosZ = length * 0.32;
    const wheelPosY = wheelRadius;

    carRoot.add(
      makeWheel('Wheel_FL', -wheelPosX, wheelPosY, wheelPosZ),
      makeWheel('Wheel_FR', wheelPosX, wheelPosY, wheelPosZ),
      makeWheel('Wheel_RL', -wheelPosX, wheelPosY, -wheelPosZ),
      makeWheel('Wheel_RR', wheelPosX, wheelPosY, -wheelPosZ)
    );

    // =========================================================================
    // 6. ANTENNA & RUBY RED CONTACT HEAD
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.64, -length * 0.38);

    // Reinforced Base Mounting Turret
    const turretGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.05, 16);
    const turret = new THREE.Mesh(turretGeo, gunmetalMaterial);
    antenna.add(turret);

    const bootGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.08, 12);
    const boot = new THREE.Mesh(bootGeo, rubberMaterial);
    boot.position.y = 0.06;
    antenna.add(boot);

    // Thick Reinforced Titanium Mast (Proportionally Lowered Z ~ 1.55m)
    const mastHeight = 0.85;
    const mastGeo = new THREE.CylinderGeometry(0.012, 0.024, mastHeight, 14);
    mastGeo.translate(0, mastHeight * 0.5 + 0.10, 0);
    const mastMesh = new THREE.Mesh(mastGeo, gunmetalMaterial);
    antenna.add(mastMesh);

    // Ruby Red Glowing Toroidal Contact Head
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.set(0, mastHeight + 0.10, 0);

    const contactRingGeo = new THREE.TorusGeometry(0.16, 0.032, 14, 24);
    const contactRingMesh = new THREE.Mesh(contactRingGeo, neonRedMaterial);
    contactHead.add(contactRingMesh);

    // Inner Glowing Core Orb
    const contactCoreGeo = new THREE.SphereGeometry(0.06, 14, 14);
    const contactCore = new THREE.Mesh(contactCoreGeo, fieryAmberMaterial);
    contactHead.add(contactCore);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 7. MONEY DISPLAY (Rear LED screen showing "$120" in bright red)
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.52, -length * 0.405);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#140407';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ff0044';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 74px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$120', 128, 64);
    ctx.shadowBlur = 0;

    const displayTex = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const screenGeo = new THREE.PlaneGeometry(0.48, 0.24);
    screenGeo.rotateY(Math.PI);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);

    const frameGeo = new THREE.BoxGeometry(0.54, 0.28, 0.05);
    const frameMesh = new THREE.Mesh(frameGeo, darkCharcoalMaterial);
    frameMesh.position.z = 0.025;

    moneyDisplay.add(screenMesh);
    moneyDisplay.add(frameMesh);
    carRoot.add(moneyDisplay);

    // =========================================================================
    // 8. HEADLIGHTS & TAILLIGHTS
    // =========================================================================
    const makeHeadlight = (name: string, x: number): THREE.Group => {
      const hlGroup = new THREE.Group();
      hlGroup.name = name;
      hlGroup.position.set(x, 0.46, length * 0.41);

      const housingGeo = new THREE.BoxGeometry(0.24, 0.12, 0.08);
      const housing = new THREE.Mesh(housingGeo, darkCharcoalMaterial);
      hlGroup.add(housing);

      const lensGeo = new THREE.BoxGeometry(0.20, 0.08, 0.04);
      const lens = new THREE.Mesh(lensGeo, headlightMaterial);
      lens.position.z = 0.03;
      hlGroup.add(lens);

      return hlGroup;
    };

    const headlightL = makeHeadlight('Headlight_L', -width * 0.29);
    const headlightR = makeHeadlight('Headlight_R', width * 0.29);
    carRoot.add(headlightL, headlightR);

    const makeTailLight = (name: string, x: number): THREE.Group => {
      const tlGroup = new THREE.Group();
      tlGroup.name = name;
      tlGroup.position.set(x, 0.50, -length * 0.395);

      const housingGeo = new THREE.BoxGeometry(0.24, 0.10, 0.04);
      const housing = new THREE.Mesh(housingGeo, darkCharcoalMaterial);
      tlGroup.add(housing);

      const ledBarGeo = new THREE.BoxGeometry(0.20, 0.06, 0.03);
      const ledBar = new THREE.Mesh(ledBarGeo, taillightMaterial);
      ledBar.position.z = -0.015;
      tlGroup.add(ledBar);

      return tlGroup;
    };

    const taillightL = makeTailLight('TailLight_L', -width * 0.28);
    const taillightR = makeTailLight('TailLight_R', width * 0.28);
    carRoot.add(taillightL, taillightR);

    // =========================================================================
    // 9. VFX ANCHOR NODES & HEAVY QUAD EXHAUSTS
    // =========================================================================
    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.26, -length * 0.43);

    // Heavy Quad Square Exhaust Tips
    const tipGeo = new THREE.BoxGeometry(0.09, 0.09, 0.16);
    const tipL1 = new THREE.Mesh(tipGeo, chromeMaterial);
    tipL1.position.x = -0.28;
    const tipL2 = new THREE.Mesh(tipGeo, chromeMaterial);
    tipL2.position.x = -0.16;
    const tipR1 = new THREE.Mesh(tipGeo, chromeMaterial);
    tipR1.position.x = 0.16;
    const tipR2 = new THREE.Mesh(tipGeo, chromeMaterial);
    tipR2.position.x = 0.28;
    vfxBoost.add(tipL1, tipL2, tipR1, tipR2);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.set(0, mastHeight + 0.10, -length * 0.38);
    carRoot.add(vfxAntenna);

    const vfxImpact = new THREE.Group();
    vfxImpact.name = 'VFX_Impact';
    vfxImpact.position.set(0, 0.35, 0);
    carRoot.add(vfxImpact);

    const vfxCoin = new THREE.Group();
    vfxCoin.name = 'VFX_Coin';
    vfxCoin.position.set(0, 0.60, 0);
    carRoot.add(vfxCoin);

    const vfxSkid = new THREE.Group();
    vfxSkid.name = 'VFX_Skid';
    vfxSkid.position.set(0, 0.05, 0);
    carRoot.add(vfxSkid);

    return carRoot;
  }
}
