import * as THREE from 'three';
import { GOLD_WHALE_CONFIG } from './VehicleTypes';

/**
 * Procedural Gold Whale 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the Gold Type luxury chaos gambler / glass cannon vehicle:
 * 1. Silhouette: Extravagant, aggressive wide-body luxury hyper bumper car.
 * 2. Dimensions: L 2.7m × W 2.0m × H 1.40m.
 * 3. Color & Materials: Ultra-luxurious mirror 24K gold chrome shell (#FFD700) with twill gloss black
 *    carbon fiber trim and warm brilliant amber/gold (#FFAA00 / #FFD700) neon halo.
 * 4. Distinctive Features:
 *    - Signature Golden Diamond Crest on hood.
 *    - DUAL gold-plated antenna masts with brilliant glowing amber diamond contact heads.
 *    - Ultra-luxury quilted gold cockpit with VIP champagne cooler prop.
 *    - Multi-spoke custom forged gold rims with glowing amber neon lip lighting.
 * 5. Dynamic Money Display: "$500" glittering golden scoreboard display.
 * 6. Full CarNodeBindings compliance with wheelSpinner grouping.
 */
export class GoldWhaleModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = GOLD_WHALE_CONFIG.dimensions.length;
    const width = GOLD_WHALE_CONFIG.dimensions.width;
    const wheelRadius = GOLD_WHALE_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED PBR MATERIALS
    // =========================================================================
    // Mirror 24K Polished Gold Chrome
    const goldChromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      roughness: 0.05,
      metalness: 0.98,
    });
    goldChromeMaterial.name = 'GoldChromePaint';
    goldChromeMaterial.userData = { isPaint: true };

    // Deep Satin 18K Yellow Gold
    const satinGoldMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfb000,
      roughness: 0.22,
      metalness: 0.90,
    });
    satinGoldMaterial.name = 'SatinGoldPaint';
    satinGoldMaterial.userData = { isPaint: true };

    // High-Gloss Deep Twill Carbon Fiber
    const carbonMaterial = new THREE.MeshStandardMaterial({
      color: 0x111216,
      roughness: 0.35,
      metalness: 0.60,
    });

    // Heavy Gilded Bumper Rubber Composite
    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: 0x101012,
      roughness: 0.88,
      metalness: 0.06,
    });

    // Brilliant Amber / Warm Golden Neon Glow (#FFAA00 / #FFCC00)
    const neonAmberMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff9900,
      emissiveIntensity: 2.5,
      roughness: 0.08,
    });

    // Diamond Crystal White / Pale Gold Glow
    const diamondGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff4cc,
      emissive: 0xffea88,
      emissiveIntensity: 3.2,
      roughness: 0.05,
    });

    // Quilted Gold / Cognac Leather Interior
    const quiltedLeatherMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a5214,
      roughness: 0.50,
      metalness: 0.20,
    });

    // Dark Platinum Chrome Trim
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f8fc,
      roughness: 0.04,
      metalness: 0.99,
    });

    // Crystalline Jewel Headlights
    const jewelHeadlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffe688,
      emissiveIntensity: 3.6,
      roughness: 0.04,
    });

    // Taillight Material (Ruby Gold LED)
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1a3c,
      emissive: 0xff0033,
      emissiveIntensity: 3.0,
      roughness: 0.08,
    });

    // =========================================================================
    // 2. CHASSIS NODE
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Carbon fiber floorpan with gilded perimeter brackets
    const chassisGeo = new THREE.BoxGeometry(width * 0.82, 0.22, length * 0.88);
    const chassisMesh = new THREE.Mesh(chassisGeo, carbonMaterial);
    chassisMesh.position.y = 0.21;
    chassisMesh.castShadow = true;
    chassis.add(chassisMesh);

    // Gold Plated Lower Diffuser
    const diffuserGeo = new THREE.BoxGeometry(width * 0.76, 0.06, 0.35);
    const diffuser = new THREE.Mesh(diffuserGeo, goldChromeMaterial);
    diffuser.position.set(0, 0.14, -length * 0.40);
    chassis.add(diffuser);

    // Warm Golden Underglow PointLight
    const underglow = new THREE.PointLight(0xffaa00, 2.4, 3.8);
    underglow.position.set(0, 0.12, 0);
    chassis.add(underglow);
    carRoot.add(chassis);

    // =========================================================================
    // 3. BUMPER NODE (Heavy Gilded Bumper with Golden Neon Halo)
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Heavy Bumper Ring
    const bumperGeo = new THREE.CylinderGeometry(width * 0.53, width * 0.56, 0.26, 28);
    bumperGeo.scale(1.0, 1.0, length / width);
    const bumperMesh = new THREE.Mesh(bumperGeo, rubberMaterial);
    bumperMesh.position.y = 0.22;
    bumperMesh.castShadow = true;
    bumper.add(bumperMesh);

    // Gilded Top Edge Collar Trim
    const goldCollarGeo = new THREE.CylinderGeometry(width * 0.535, width * 0.555, 0.04, 28);
    goldCollarGeo.scale(1.0, 1.0, length / width);
    const goldCollar = new THREE.Mesh(goldCollarGeo, goldChromeMaterial);
    goldCollar.position.y = 0.34;
    bumper.add(goldCollar);

    // Brilliant Amber / Gold Neon Perimeter Halo
    const neonHaloGeo = new THREE.CylinderGeometry(width * 0.54, width * 0.57, 0.06, 28);
    neonHaloGeo.scale(1.0, 1.0, length / width);
    const neonHalo = new THREE.Mesh(neonHaloGeo, neonAmberMaterial);
    neonHalo.position.y = 0.22;
    bumper.add(neonHalo);

    // Gold Plated Front Impact Fangs
    for (let side of [-1, 1]) {
      const fangGeo = new THREE.BoxGeometry(0.12, 0.24, 0.16);
      const fang = new THREE.Mesh(fangGeo, goldChromeMaterial);
      fang.position.set(side * (width * 0.28), 0.24, length * 0.46);
      fang.rotation.y = side * 0.22;
      bumper.add(fang);
    }

    carRoot.add(bumper);

    // =========================================================================
    // 4. BODY NODE (24K Gold Mirror Shell + Diamond Crest + Luxury Cockpit)
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // Main 24K Gold Monocoque
    const hullGeo = new THREE.BoxGeometry(width * 0.74, 0.36, length * 0.82);
    const hull = new THREE.Mesh(hullGeo, goldChromeMaterial);
    hull.position.set(0, 0.40, 0);
    hull.castShadow = true;
    body.add(hull);

    // Wide Flared Luxury Fenders
    const fenderGeo = new THREE.BoxGeometry(width * 0.86, 0.28, length * 0.76);
    const fenders = new THREE.Mesh(fenderGeo, satinGoldMaterial);
    fenders.position.set(0, 0.42, 0);
    fenders.castShadow = true;
    body.add(fenders);

    // Sculpted Power Hood
    const hoodGeo = new THREE.BoxGeometry(width * 0.66, 0.22, length * 0.40);
    const hood = new THREE.Mesh(hoodGeo, goldChromeMaterial);
    hood.position.set(0, 0.52, length * 0.23);
    hood.rotation.x = -0.08;
    hood.castShadow = true;
    body.add(hood);

    // Black Carbon Center Hood Strip
    const carbonStripeGeo = new THREE.BoxGeometry(width * 0.28, 0.04, length * 0.38);
    const carbonStripe = new THREE.Mesh(carbonStripeGeo, carbonMaterial);
    carbonStripe.position.set(0, 0.62, length * 0.23);
    carbonStripe.rotation.x = -0.08;
    body.add(carbonStripe);

    // Dual Gilded Hood Heat Extractors
    for (let side of [-1, 1]) {
      const louverGeo = new THREE.BoxGeometry(0.12, 0.02, 0.16);
      const louver = new THREE.Mesh(louverGeo, carbonMaterial);
      louver.position.set(side * (width * 0.22), 0.61, length * 0.22);
      louver.rotation.x = 0.15;
      body.add(louver);
    }

    // SIGNATURE GOLDEN DIAMOND CREST ON HOOD
    const diamondCrestGroup = new THREE.Group();
    diamondCrestGroup.position.set(0, 0.67, length * 0.26);
    diamondCrestGroup.rotation.x = -0.08;

    // Diamond Octahedron Facet
    const diamondGeo = new THREE.OctahedronGeometry(0.12, 0);
    diamondGeo.scale(1.2, 0.7, 1.2);
    const diamondMesh = new THREE.Mesh(diamondGeo, diamondGlowMaterial);
    diamondCrestGroup.add(diamondMesh);

    // Gold Plated Framing Ring
    const framingRingGeo = new THREE.TorusGeometry(0.16, 0.018, 12, 24);
    framingRingGeo.rotateX(Math.PI / 2);
    const framingRing = new THREE.Mesh(framingRingGeo, goldChromeMaterial);
    diamondCrestGroup.add(framingRing);

    body.add(diamondCrestGroup);

    // ULTRA-LUXURY COCKPIT
    const cockpitGeo = new THREE.BoxGeometry(width * 0.52, 0.26, 0.70);
    const cockpit = new THREE.Mesh(cockpitGeo, carbonMaterial);
    cockpit.position.set(0, 0.52, -0.06);
    body.add(cockpit);

    // Quilted Gold Leather Racing Bucket Seat
    const seatGeo = new THREE.BoxGeometry(0.50, 0.44, 0.42);
    const seat = new THREE.Mesh(seatGeo, quiltedLeatherMaterial);
    seat.position.set(0, 0.56, -0.16);
    seat.rotation.x = -0.16;
    body.add(seat);

    // Seat Gold Diamond Quilt Headrest
    const headrestGeo = new THREE.BoxGeometry(0.28, 0.20, 0.12);
    const headrest = new THREE.Mesh(headrestGeo, quiltedLeatherMaterial);
    headrest.position.set(0, 0.86, -0.25);
    headrest.rotation.x = -0.16;
    body.add(headrest);

    // Gold-Plated Sport Steering Wheel
    const wheelYokeGeo = new THREE.TorusGeometry(0.11, 0.016, 12, 24);
    const wheelYoke = new THREE.Mesh(wheelYokeGeo, goldChromeMaterial);
    wheelYoke.position.set(0, 0.68, 0.12);
    wheelYoke.rotation.x = -0.42;
    body.add(wheelYoke);

    // VIP Champagne Bucket / Ice Cooler Prop in Center Console
    const coolerGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.12, 14);
    const cooler = new THREE.Mesh(coolerGeo, goldChromeMaterial);
    cooler.position.set(0.18, 0.56, 0.06);
    body.add(cooler);

    const bottleGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.14, 10);
    const bottleMat = new THREE.MeshStandardMaterial({ color: 0x113311, roughness: 0.1, metalness: 0.4 });
    const bottle = new THREE.Mesh(bottleGeo, bottleMat);
    bottle.position.set(0.18, 0.64, 0.06);
    bottle.rotation.z = 0.18;
    body.add(bottle);

    // Dual Gilded Roll Hoops behind headrest
    for (let side of [-1, 1]) {
      const hoopGeo = new THREE.TorusGeometry(0.13, 0.022, 12, 18, Math.PI);
      hoopGeo.rotateZ(Math.PI);
      const hoop = new THREE.Mesh(hoopGeo, goldChromeMaterial);
      hoop.position.set(side * 0.16, 0.96, -0.32);
      body.add(hoop);
    }

    // High-Downforce 24K Gold & Carbon Rear Wing
    const wingGeo = new THREE.BoxGeometry(width * 0.74, 0.045, 0.28);
    const wing = new THREE.Mesh(wingGeo, goldChromeMaterial);
    wing.position.set(0, 0.92, -length * 0.36);
    wing.castShadow = true;
    body.add(wing);

    // Carbon Wing Endplates with Golden Trim
    for (let side of [-1, 1]) {
      const endplateGeo = new THREE.BoxGeometry(0.035, 0.18, 0.34);
      const endplate = new THREE.Mesh(endplateGeo, carbonMaterial);
      endplate.position.set(side * (width * 0.375), 0.92, -length * 0.36);
      body.add(endplate);

      const endplateTrimGeo = new THREE.BoxGeometry(0.04, 0.02, 0.34);
      const endplateTrim = new THREE.Mesh(endplateTrimGeo, neonAmberMaterial);
      endplateTrim.position.set(side * (width * 0.375), 1.01, -length * 0.36);
      body.add(endplateTrim);
    }

    // Wing Struts
    const strutGeo = new THREE.BoxGeometry(0.04, 0.28, 0.07);
    strutGeo.rotateX(0.12);
    const strutL = new THREE.Mesh(strutGeo, goldChromeMaterial);
    strutL.position.set(-width * 0.24, 0.78, -length * 0.35);
    const strutR = new THREE.Mesh(strutGeo, goldChromeMaterial);
    strutR.position.set(width * 0.24, 0.78, -length * 0.35);
    body.add(strutL, strutR);

    carRoot.add(body);

    // =========================================================================
    // 5. WHEELS NODE (24K Gold Forged Multi-Spoke Rims)
    // =========================================================================
    const wheelHalfWidth = 0.19;

    const makeWheel = (name: string, x: number, y: number, z: number): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(x, y, z);

      // Rotating sub-group (children[0]) spins around X via CarAnimation
      const wheelSpinner = new THREE.Group();
      wheelSpinner.name = 'WheelSpinner';

      // Low-profile high-performance tire
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelHalfWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, rubberMaterial);
      tire.castShadow = true;
      wheelSpinner.add(tire);

      // Forged 24K Gold Rim Barrel
      const rimGeo = new THREE.CylinderGeometry(wheelRadius * 0.70, wheelRadius * 0.70, wheelHalfWidth + 0.01, 20);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, goldChromeMaterial);
      wheelSpinner.add(rim);

      // Amber Neon Outer Lip Ring
      const isRightSide = x > 0;
      const faceOffset = isRightSide ? (wheelHalfWidth * 0.5 + 0.005) : -(wheelHalfWidth * 0.5 + 0.005);

      const lipRingGeo = new THREE.TorusGeometry(wheelRadius * 0.71, 0.014, 10, 24);
      lipRingGeo.rotateY(Math.PI / 2);
      const lipRing = new THREE.Mesh(lipRingGeo, neonAmberMaterial);
      lipRing.position.x = faceOffset;
      wheelSpinner.add(lipRing);

      // Center Diamond Crest Hubcap
      const hubGeo = new THREE.OctahedronGeometry(0.05, 0);
      hubGeo.scale(1.0, 0.4, 1.0);
      hubGeo.rotateZ(Math.PI / 2);
      const hubCap = new THREE.Mesh(hubGeo, diamondGlowMaterial);
      hubCap.position.x = faceOffset + (isRightSide ? 0.01 : -0.01);
      wheelSpinner.add(hubCap);

      wheelGroup.add(wheelSpinner); // children[0] is spinning assembly

      // Stationary Ceramic Brake Rotor & Gold Caliper
      const rotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.02, 16);
      rotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(rotorGeo, chromeMaterial);
      rotor.position.x = isRightSide ? -0.02 : 0.02;

      const caliperGeo = new THREE.BoxGeometry(0.06, 0.12, 0.14);
      const caliper = new THREE.Mesh(caliperGeo, goldChromeMaterial);
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
    // 6. ANTENNA & DUAL GOLD-PLATED MASTS WITH DIAMOND HEADS (PRD Sec 106)
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.64, -length * 0.36);

    // Dual Gilded Mounting Base Plinth
    const plinthGeo = new THREE.BoxGeometry(0.56, 0.06, 0.12);
    const plinth = new THREE.Mesh(plinthGeo, goldChromeMaterial);
    antenna.add(plinth);

    const mastHeight = 1.45;
    const mastGeo = new THREE.CylinderGeometry(0.007, 0.015, mastHeight, 12);
    mastGeo.translate(0, mastHeight * 0.5 + 0.06, 0);

    // Left Gilded Mast
    const mastL = new THREE.Mesh(mastGeo, goldChromeMaterial);
    mastL.position.x = -0.18;
    antenna.add(mastL);

    // Right Gilded Mast
    const mastR = new THREE.Mesh(mastGeo, goldChromeMaterial);
    mastR.position.x = 0.18;
    antenna.add(mastR);

    // ContactHead group containing DUAL glowing diamond heads
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.set(0, mastHeight + 0.06, 0);

    const diamondHeadGeo = new THREE.OctahedronGeometry(0.12, 0);
    diamondHeadGeo.scale(1.0, 1.3, 1.0);

    // Left Diamond Head
    const headL = new THREE.Mesh(diamondHeadGeo, diamondGlowMaterial);
    headL.position.x = -0.18;
    contactHead.add(headL);

    const headHaloL = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.02, 10, 20),
      neonAmberMaterial
    );
    headHaloL.position.x = -0.18;
    contactHead.add(headHaloL);

    // Right Diamond Head
    const headR = new THREE.Mesh(diamondHeadGeo, diamondGlowMaterial);
    headR.position.x = 0.18;
    contactHead.add(headR);

    const headHaloR = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.02, 10, 20),
      neonAmberMaterial
    );
    headHaloR.position.x = 0.18;
    contactHead.add(headHaloR);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 7. MONEY DISPLAY (Rear Glittering Gold LED showing "$500")
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.52, -length * 0.40);

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#100a02';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 8;
    ctx.strokeRect(6, 6, 244, 116);
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$500', 128, 64);
    ctx.shadowBlur = 0;

    const displayTex = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const screenGeo = new THREE.PlaneGeometry(0.48, 0.24);
    screenGeo.rotateY(Math.PI);
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);

    const frameGeo = new THREE.BoxGeometry(0.54, 0.28, 0.05);
    const frameMesh = new THREE.Mesh(frameGeo, goldChromeMaterial);
    frameMesh.position.z = 0.025;

    moneyDisplay.add(screenMesh);
    moneyDisplay.add(frameMesh);
    carRoot.add(moneyDisplay);

    // =========================================================================
    // 8. HEADLIGHTS & TAILLIGHTS (Crystalline Jewel Lights)
    // =========================================================================
    const makeHeadlight = (name: string, x: number): THREE.Group => {
      const hlGroup = new THREE.Group();
      hlGroup.name = name;
      hlGroup.position.set(x, 0.45, length * 0.41);

      const housingGeo = new THREE.BoxGeometry(0.24, 0.12, 0.08);
      const housing = new THREE.Mesh(housingGeo, goldChromeMaterial);
      hlGroup.add(housing);

      // Crystalline cut diamond core
      const jewelGeo = new THREE.OctahedronGeometry(0.045, 0);
      const j1 = new THREE.Mesh(jewelGeo, jewelHeadlightMaterial);
      j1.position.set(-0.05, 0, 0.035);
      const j2 = new THREE.Mesh(jewelGeo, jewelHeadlightMaterial);
      j2.position.set(0.05, 0, 0.035);
      hlGroup.add(j1, j2);

      // Amber brow
      const browGeo = new THREE.BoxGeometry(0.20, 0.02, 0.03);
      const brow = new THREE.Mesh(browGeo, neonAmberMaterial);
      brow.position.set(0, 0.045, 0.03);
      hlGroup.add(brow);

      return hlGroup;
    };

    const headlightL = makeHeadlight('Headlight_L', -width * 0.29);
    const headlightR = makeHeadlight('Headlight_R', width * 0.29);
    carRoot.add(headlightL, headlightR);

    // Full-width Ruby & Gold LED Taillights
    const makeTailLight = (name: string, x: number): THREE.Group => {
      const tlGroup = new THREE.Group();
      tlGroup.name = name;
      tlGroup.position.set(x, 0.50, -length * 0.395);

      const barGeo = new THREE.BoxGeometry(0.24, 0.07, 0.04);
      const bar = new THREE.Mesh(barGeo, taillightMaterial);
      tlGroup.add(bar);

      return tlGroup;
    };

    const taillightL = makeTailLight('TailLight_L', -width * 0.27);
    const taillightR = makeTailLight('TailLight_R', width * 0.27);
    carRoot.add(taillightL, taillightR);

    // =========================================================================
    // 9. VFX ANCHOR NODES & OVERSIZED GILDED EXHAUSTS
    // =========================================================================
    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.24, -length * 0.43);

    // Oversized gold exhaust bells with amber interior glow
    const bellGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.18, 16);
    bellGeo.rotateX(Math.PI / 2);
    const exhaustL = new THREE.Mesh(bellGeo, goldChromeMaterial);
    exhaustL.position.x = -0.24;
    const exhaustR = new THREE.Mesh(bellGeo, goldChromeMaterial);
    exhaustR.position.x = 0.24;
    vfxBoost.add(exhaustL, exhaustR);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.set(0, mastHeight + 0.06, -length * 0.36);
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
