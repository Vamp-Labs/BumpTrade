import * as THREE from 'three';
import { CAR_CONFIG } from '../core/Config';
import { CarTextureGenerator } from '../textures/CarTextureGenerator';

/**
 * Procedural Hood Bull 3D Model Builder (Corrective PRD Implementation).
 * 
 * Implements the comprehensive BUMP.TRADE Hood Bull specifications from docs/update prd.md:
 * 1. Target Silhouette: Rounded compact amusement bumper-car body with sports-car cues.
 * 2. Real Volumetric Curvature: Sloped compound-curved hood, sculpted side shoulders,
 *    and flared circular wheel arches (eliminating the "flat box on wheels" silhouette).
 * 3. Mechanically Integrated Bumper: Thick wrap-around impact rubber with front, side, and rear
 *    chassis mounting brackets, diagonal tubular struts, and rubber compression bushings.
 * 4. Amusement Bumper-Car Cockpit: Deep cockpit tub, racing bucket seat with roll hoops,
 *    futuristic dashboard with digital telemetry HUD, sport steering yoke, and raked
 *    dark polycarbonate canopy/windshield (driver mascot omitted per Section 40).
 * 5. Aggressive Front Fascia: Sunk projector headlights with amber DRL brows, honeycomb grille,
 *    carbon front splitter, and embossed gold Bull Mascot emblem.
 * 6. Rear Transom & Embedded Money Display: Digital "$85" screen recessed into a dark metal housing,
 *    C-shaped Ruby Red LED taillights, and dual chrome exhaust nozzles in a carbon diffuser.
 * 7. Proportional Antenna: Mechanical mounting turret with flex boot, slender tapered chrome mast,
 *    and compact toroidal contact head with controlled neon electrical halo.
 * 8. Full Node Rigging Compliance: Retains all CarNodeBindings hooks for CarVisual damage deformation,
 *    CarPhysics collision handling, and CarAnimation wheel spinning.
 */
export class HoodBullModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    // Baseline dimensions from CAR_CONFIG (matching PRD Section 4)
    const length = CAR_CONFIG.dimensions.length; // 2.6 m
    const width = CAR_CONFIG.dimensions.width;   // 1.9 m
    const wheelRadius = CAR_CONFIG.dimensions.wheelRadius; // 0.28 m

    // =========================================================================
    // 1. PROCEDURAL PBR TEXTURES & ADVANCED MATERIAL SYSTEM
    // =========================================================================
    const bodyPBR = CarTextureGenerator.generateBodyPBR(2048);
    const bumperPBR = CarTextureGenerator.generateBumperPBR(1024, 256);
    const carbonPBR = CarTextureGenerator.generateCarbonFiberPBR(512);
    const wheelPBR = CarTextureGenerator.generateWheelPBR(512);

    // 01 BODY_PAINT: Metallic Emerald Green (#00B84B) with micro-flakes & racing livery
    const bodyPaintMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: bodyPBR.albedoMap,
      normalMap: bodyPBR.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughnessMap: bodyPBR.roughnessMap,
      roughness: 1.0,
      metalnessMap: bodyPBR.metalnessMap,
      metalness: 1.0,
      emissiveMap: bodyPBR.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.9,
    });
    bodyPaintMaterial.name = 'BodyPaint';
    bodyPaintMaterial.userData = { isPaint: true };

    // Solid Emerald Green Metallic for sculpted curved body parts without atlas distortion
    const solidPaintMaterial = new THREE.MeshStandardMaterial({
      color: 0x00b84b,
      roughness: 0.18,
      metalness: 0.90,
    });
    solidPaintMaterial.name = 'SolidBodyPaint';
    solidPaintMaterial.userData = { isPaint: true };

    // 02 RUBBER: Heavy-duty bumper with horizontal impact ribs & high roughness
    const rubberBumperMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: bumperPBR.albedoMap,
      normalMap: bumperPBR.normalMap,
      normalScale: new THREE.Vector2(2.2, 2.2),
      roughnessMap: bumperPBR.roughnessMap,
      roughness: 1.0,
      metalnessMap: bumperPBR.metalnessMap,
      metalness: 1.0,
      emissiveMap: bumperPBR.emissiveMap,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 1.8,
    });

    const matteRubberMaterial = new THREE.MeshStandardMaterial({
      color: 0x141618,
      roughness: 0.88,
      metalness: 0.02,
    });

    // 03 CARBON_FIBER: Twill weave composite for splitter, scoop, diffuser & rear wing
    const carbonFiberMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: carbonPBR.albedoMap,
      normalMap: carbonPBR.normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      roughnessMap: carbonPBR.roughnessMap,
      roughness: 1.0,
      metalnessMap: carbonPBR.metalnessMap,
      metalness: 1.0,
    });

    // 04 DARK_METAL: Chassis floorpan, suspension mounts, bumper brackets, seat frame
    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x12161a,
      roughness: 0.52,
      metalness: 0.82,
    });

    // 05 CHROME: Polished mirror metal for antenna mast, struts, wheel rims, and exhaust
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf4f8fc,
      roughness: 0.05,
      metalness: 0.98,
    });

    // 06 GLASS: Dark tinted polycarbonate for raked windscreen and headlight lenses
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0x5599bb,
      roughness: 0.04,
      metalness: 0.15,
      transparent: true,
      opacity: 0.40,
      depthWrite: false,
    });

    // 07 GOLD_ACCENT: Polished jewelry gold for Bull Mascot emblems and hubcaps
    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffc820,
      roughness: 0.14,
      metalness: 0.95,
    });

    // 08 EMISSIVE_GREEN: Controlled neon accent lighting (#00FF6A)
    const neonGreenMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff6a,
      emissive: 0x00ff6a,
      emissiveIntensity: 0.95,
      roughness: 0.12,
    });

    // Dedicated subtle LED piping for bumper lower lip
    const neonLipMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff6a,
      emissive: 0x00ff6a,
      emissiveIntensity: 0.85,
      roughness: 0.1,
    });

    // 09 PROJECTOR_HEADLIGHT: Electric Yellow (#FFD600) projector core
    const projectorCoreMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffd600,
      emissiveIntensity: 2.8,
      roughness: 0.05,
    });

    // 10 DRL_BROW: Amber LED eyebrow strip (#FFB800)
    const drlBrowMaterial = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffb800,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });

    // 11 TAILLIGHT: Danger Ruby Red (#FF2E2E) segmented LED lightbars
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0033,
      emissive: 0xff1a3c,
      emissiveIntensity: 2.6,
      roughness: 0.1,
    });

    // WHEEL PBR MATERIALS
    const tireMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wheelPBR.tireAlbedo,
      normalMap: wheelPBR.tireNormal,
      normalScale: new THREE.Vector2(2.5, 2.5),
      roughnessMap: wheelPBR.tireRoughness,
      roughness: 1.0,
      metalness: 0.04,
    });

    const rimFaceMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: wheelPBR.rimAlbedo,
      normalMap: wheelPBR.rimNormal,
      normalScale: new THREE.Vector2(1.6, 1.6),
      roughnessMap: wheelPBR.rimRoughness,
      roughness: 1.0,
      metalnessMap: wheelPBR.rimMetalness,
      metalness: 1.0,
      emissiveMap: wheelPBR.rimEmissive,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 2.2,
    });

    // =========================================================================
    // 2. CHASSIS NODE (Structural Floorpan, Diffuser & Underglow)
    // =========================================================================
    const chassis = new THREE.Group();
    chassis.name = 'Chassis';

    // Main Structural Belly Pan / Floorpan
    const chassisFloorGeo = new THREE.BoxGeometry(width * 0.76, 0.14, length * 0.88);
    const chassisFloorMesh = new THREE.Mesh(chassisFloorGeo, darkMetalMaterial);
    chassisFloorMesh.position.y = 0.16;
    chassisFloorMesh.castShadow = true;
    chassis.add(chassisFloorMesh);

    // Front Aerodynamic Carbon Undertray / Splitter
    const frontSplitterGeo = new THREE.CylinderGeometry(width * 0.48, width * 0.52, 0.04, 24, 1, false, 0, Math.PI);
    frontSplitterGeo.scale(1.0, 1.0, 0.65);
    const frontSplitter = new THREE.Mesh(frontSplitterGeo, carbonFiberMaterial);
    frontSplitter.position.set(0, 0.11, length * 0.42);
    chassis.add(frontSplitter);

    // Rear Carbon Diffuser with 4 Vertical Aerodynamic Strakes
    const rearDiffuserGeo = new THREE.BoxGeometry(width * 0.74, 0.08, 0.42);
    const rearDiffuserMesh = new THREE.Mesh(rearDiffuserGeo, carbonFiberMaterial);
    rearDiffuserMesh.position.set(0, 0.14, -length * 0.42);
    rearDiffuserMesh.rotation.x = -0.15; // Upswept kickup angle
    chassis.add(rearDiffuserMesh);

    for (let i = -1.5; i <= 1.5; i += 1.0) {
      const finGeo = new THREE.BoxGeometry(0.02, 0.09, 0.38);
      const finMesh = new THREE.Mesh(finGeo, carbonFiberMaterial);
      finMesh.position.set(i * 0.16, 0.12, -length * 0.42);
      finMesh.rotation.x = -0.15;
      chassis.add(finMesh);
    }

    // Subtle Arcade Underglow Point Light (Controlled intensity)
    const underglow = new THREE.PointLight(0x00ff88, 0.45, 2.0);
    underglow.position.set(0, 0.1, 0);
    chassis.add(underglow);

    carRoot.add(chassis);

    // =========================================================================
    // 3. BUMPER NODE (Mechanically Integrated with Mounting Structure)
    // =========================================================================
    const bumper = new THREE.Group();
    bumper.name = 'Bumper';

    // Outer Heavy Impact Wrap-Around Rubber Ring (Elliptical contour)
    const bumperRadiusX = width * 0.53;
    const bumperRadiusZ = length * 0.53;
    const bumperGeo = new THREE.CylinderGeometry(bumperRadiusX, bumperRadiusX * 1.02, 0.30, 36);
    bumperGeo.scale(1.0, 1.0, bumperRadiusZ / bumperRadiusX);
    const bumperMesh = new THREE.Mesh(bumperGeo, rubberBumperMaterial);
    bumperMesh.position.y = 0.22;
    bumperMesh.castShadow = true;
    bumper.add(bumperMesh);

    // Lower Aerodynamic Neon Green Accent Lip
    const neonLipGeo = new THREE.CylinderGeometry(bumperRadiusX * 1.01, bumperRadiusX * 1.03, 0.05, 36);
    neonLipGeo.scale(1.0, 1.0, bumperRadiusZ / bumperRadiusX);
    const neonLipMesh = new THREE.Mesh(neonLipGeo, neonLipMaterial);
    neonLipMesh.position.y = 0.075;
    bumper.add(neonLipMesh);

    // MECHANICAL MOUNTING STRUCTURE (Connects bumper to chassis)
    // Front Heavy Cast Mounting Horn
    const frontMountGeo = new THREE.BoxGeometry(0.32, 0.14, 0.28);
    const frontMount = new THREE.Mesh(frontMountGeo, darkMetalMaterial);
    frontMount.position.set(0, 0.21, length * 0.46);
    bumper.add(frontMount);

    // Front Diagonal Support Struts (Left & Right tubular stays)
    const strutGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.42, 12);
    strutGeo.rotateZ(Math.PI / 2);

    const frontStrutL = new THREE.Mesh(strutGeo, chromeMaterial);
    frontStrutL.position.set(-width * 0.32, 0.21, length * 0.44);
    frontStrutL.rotation.y = 0.55;
    const frontStrutR = new THREE.Mesh(strutGeo, chromeMaterial);
    frontStrutR.position.set(width * 0.32, 0.21, length * 0.44);
    frontStrutR.rotation.y = -0.55;
    bumper.add(frontStrutL, frontStrutR);

    // Rear Impact Transom Mount
    const rearMountGeo = new THREE.BoxGeometry(0.38, 0.14, 0.28);
    const rearMount = new THREE.Mesh(rearMountGeo, darkMetalMaterial);
    rearMount.position.set(0, 0.21, -length * 0.46);
    bumper.add(rearMount);

    // Rear Diagonal Support Struts
    const rearStrutL = new THREE.Mesh(strutGeo, chromeMaterial);
    rearStrutL.position.set(-width * 0.32, 0.21, -length * 0.44);
    rearStrutL.rotation.y = -0.55;
    const rearStrutR = new THREE.Mesh(strutGeo, chromeMaterial);
    rearStrutR.position.set(width * 0.32, 0.21, -length * 0.44);
    rearStrutR.rotation.y = 0.55;
    bumper.add(rearStrutL, rearStrutR);

    // Lateral Outrigger Brackets connecting chassis sills to bumper sides
    const outriggerGeo = new THREE.BoxGeometry(0.24, 0.08, 0.22);
    const outriggerL = new THREE.Mesh(outriggerGeo, darkMetalMaterial);
    outriggerL.position.set(-width * 0.44, 0.20, 0);
    const outriggerR = new THREE.Mesh(outriggerGeo, darkMetalMaterial);
    outriggerR.position.set(width * 0.44, 0.20, 0);
    bumper.add(outriggerL, outriggerR);

    // Rubber Compression Bushings at mounting hardpoints
    const bushingGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.16, 12);
    bushingGeo.rotateZ(Math.PI / 2);
    const bushingFL = new THREE.Mesh(bushingGeo, matteRubberMaterial);
    bushingFL.position.set(-width * 0.42, 0.21, length * 0.38);
    const bushingFR = new THREE.Mesh(bushingGeo, matteRubberMaterial);
    bushingFR.position.set(width * 0.42, 0.21, length * 0.38);
    const bushingRL = new THREE.Mesh(bushingGeo, matteRubberMaterial);
    bushingRL.position.set(-width * 0.42, 0.21, -length * 0.38);
    const bushingRR = new THREE.Mesh(bushingGeo, matteRubberMaterial);
    bushingRR.position.set(width * 0.42, 0.21, -length * 0.38);
    bumper.add(bushingFL, bushingFR, bushingRL, bushingRR);

    carRoot.add(bumper);

    // =========================================================================
    // 4. BODY NODE (Curved Hull, Flared Fender Arches & Cockpit Cabin)
    // =========================================================================
    const body = new THREE.Group();
    body.name = 'Body';

    // A. CENTRAL LOWER TUB & WAISTLINE
    const lowerTubGeo = new THREE.BoxGeometry(width * 0.70, 0.22, length * 0.74);
    const lowerTubMesh = new THREE.Mesh(lowerTubGeo, solidPaintMaterial);
    lowerTubMesh.position.set(0, 0.31, 0);
    lowerTubMesh.castShadow = true;
    body.add(lowerTubMesh);

    // Carbon Fiber Rocker Side Skirts
    const skirtGeo = new THREE.BoxGeometry(0.08, 0.05, length * 0.52);
    const skirtL = new THREE.Mesh(skirtGeo, carbonFiberMaterial);
    skirtL.position.set(-width * 0.43, 0.21, 0);
    const skirtR = new THREE.Mesh(skirtGeo, carbonFiberMaterial);
    skirtR.position.set(width * 0.43, 0.21, 0);
    body.add(skirtL, skirtR);

    // B. SLOPED SCULPTED HOOD (Compound-curved front volume)
    // Textured Hood Surface with Racing Livery, Golden Bull Emblem & $85
    const hoodGeo = this.createRemappedBox(
      width * 0.64,
      0.24,
      length * 0.38,
      {
        right:  [0.72, 0.35, 0.95, 0.70],
        left:   [0.05, 0.35, 0.28, 0.70],
        top:    [0.32, 0.10, 0.68, 0.88], // Racing stripes, Gold Bull Head, $85
        bottom: [0.00, 0.00, 0.10, 0.10],
        front:  [0.34, 0.04, 0.66, 0.17],
        back:   [0.34, 0.02, 0.66, 0.14],
      }
    );
    const hoodMesh = new THREE.Mesh(hoodGeo, bodyPaintMaterial);
    hoodMesh.position.set(0, 0.48, length * 0.18);
    hoodMesh.rotation.x = 0.12; // Aerodynamic forward rake
    hoodMesh.castShadow = true;
    body.add(hoodMesh);

    // Aerodynamic Central Hood Scoop / Air Intake Bulge
    const scoopGeo = new THREE.BoxGeometry(width * 0.24, 0.065, 0.40);
    const scoopMesh = new THREE.Mesh(scoopGeo, carbonFiberMaterial);
    scoopMesh.position.set(0, 0.62, length * 0.18);
    scoopMesh.rotation.x = 0.14;
    scoopMesh.castShadow = true;
    body.add(scoopMesh);

    // Twin Hood Heat Extractor Vent Recesses
    const ventGeo = new THREE.BoxGeometry(0.12, 0.015, 0.24);
    const ventL = new THREE.Mesh(ventGeo, darkMetalMaterial);
    ventL.position.set(-width * 0.20, 0.59, length * 0.16);
    ventL.rotation.set(0.14, 0, -0.08);
    const ventR = new THREE.Mesh(ventGeo, darkMetalMaterial);
    ventR.position.set(width * 0.20, 0.59, length * 0.16);
    ventR.rotation.set(0.14, 0, 0.08);
    body.add(ventL, ventR);

    // C. FRONT NOSE FASCIA & LOWER GRILLE
    const noseFasciaGeo = new THREE.BoxGeometry(width * 0.62, 0.20, 0.20);
    const noseFascia = new THREE.Mesh(noseFasciaGeo, solidPaintMaterial);
    noseFascia.position.set(0, 0.40, length * 0.36);
    noseFascia.castShadow = true;
    body.add(noseFascia);

    // Recessed Lower Honeycomb Radiator Grille
    const grilleGeo = new THREE.BoxGeometry(width * 0.36, 0.10, 0.04);
    const grilleMesh = new THREE.Mesh(grilleGeo, darkMetalMaterial);
    grilleMesh.position.set(0, 0.34, length * 0.45);
    body.add(grilleMesh);

    // Gold Bull Mascot Nose Medallion
    const emblemGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.015, 16);
    emblemGeo.rotateX(Math.PI / 2);
    const emblemMesh = new THREE.Mesh(emblemGeo, goldMaterial);
    emblemMesh.position.set(0, 0.44, length * 0.46);
    body.add(emblemMesh);

    // D. FLARED WHEEL ARCHES & FENDERS (Eliminates "box on wheels")
    const wheelArchRadius = wheelRadius * 1.22; // 0.34 m
    const wheelArchDepth = 0.14;

    const createFenderArch = (x: number, z: number, isFront: boolean): THREE.Group => {
      const fenderGroup = new THREE.Group();
      fenderGroup.position.set(x, wheelRadius + 0.02, z);

      // 1. Curved Torus Arch Lip wrapping over wheel (90° to 270° arc)
      const archLipGeo = new THREE.TorusGeometry(wheelArchRadius, 0.035, 14, 24, Math.PI * 0.94);
      archLipGeo.rotateY(x > 0 ? Math.PI / 2 : -Math.PI / 2);
      archLipGeo.rotateZ(Math.PI * 0.03);
      const archLipMesh = new THREE.Mesh(archLipGeo, solidPaintMaterial);
      archLipMesh.castShadow = true;
      fenderGroup.add(archLipMesh);

      // 2. Flared Shoulder Crown (Volumetric muscle panel above wheel, wider for rear haunches)
      const crownWidth = wheelArchDepth * (isFront ? 1.0 : 1.28);
      const crownGeo = new THREE.BoxGeometry(crownWidth, 0.14, wheelArchRadius * 1.6);
      const crownMesh = new THREE.Mesh(crownGeo, solidPaintMaterial);
      crownMesh.position.set(x > 0 ? -0.04 : 0.04, wheelArchRadius * 0.65, 0);
      crownMesh.rotation.z = x > 0 ? -0.22 : 0.22;
      crownMesh.castShadow = true;
      fenderGroup.add(crownMesh);

      // 3. Inner Dark Wheel Well Shield
      const linerGeo = new THREE.CylinderGeometry(wheelArchRadius * 0.96, wheelArchRadius * 0.96, wheelArchDepth, 16, 1, true, 0, Math.PI);
      linerGeo.rotateZ(Math.PI / 2);
      const linerMesh = new THREE.Mesh(linerGeo, darkMetalMaterial);
      linerMesh.position.x = x > 0 ? -0.05 : 0.05;
      fenderGroup.add(linerMesh);

      return fenderGroup;
    };

    const wheelOffsetZ = length * 0.32; // 0.83 m
    const wheelOffsetX = width * 0.42;  // 0.80 m

    const fenderFL = createFenderArch(-wheelOffsetX, wheelOffsetZ, true);
    const fenderFR = createFenderArch(wheelOffsetX, wheelOffsetZ, true);
    const fenderRL = createFenderArch(-wheelOffsetX, -wheelOffsetZ, false);
    const fenderRR = createFenderArch(wheelOffsetX, -wheelOffsetZ, false);
    body.add(fenderFL, fenderFR, fenderRL, fenderRR);

    // E. COCKPIT INTERIOR & CABIN (Section 6, 7 & Section 40: No Mascot Driver)
    const cockpitGroup = new THREE.Group();
    cockpitGroup.name = 'Cockpit';

    // Recessed Cockpit Floor Tub
    const cockpitFloorGeo = new THREE.BoxGeometry(width * 0.48, 0.12, 0.82);
    const cockpitFloor = new THREE.Mesh(cockpitFloorGeo, darkMetalMaterial);
    cockpitFloor.position.set(0, 0.38, -0.06);
    cockpitGroup.add(cockpitFloor);

    // Ergonomic Racing Bucket Seat
    const seatBaseGeo = new THREE.BoxGeometry(0.56, 0.14, 0.44);
    const seatBase = new THREE.Mesh(seatBaseGeo, darkMetalMaterial);
    seatBase.position.set(0, 0.44, -0.12);
    cockpitGroup.add(seatBase);

    // High Seat Back with Shoulder Bolsters (Tilted 12° back)
    const seatBackGeo = new THREE.BoxGeometry(0.52, 0.48, 0.12);
    const seatBack = new THREE.Mesh(seatBackGeo, darkMetalMaterial);
    seatBack.position.set(0, 0.68, -0.32);
    seatBack.rotation.x = -0.21;
    seatBack.castShadow = true;
    cockpitGroup.add(seatBack);

    // Seat Headrest
    const headrestGeo = new THREE.BoxGeometry(0.30, 0.18, 0.10);
    const headrest = new THREE.Mesh(headrestGeo, darkMetalMaterial);
    headrest.position.set(0, 0.94, -0.39);
    headrest.rotation.x = -0.21;
    cockpitGroup.add(headrest);

    // Chrome Roll Hoops behind headrest (Amusement Bumper Car Safety)
    const rollHoopGeo = new THREE.TorusGeometry(0.14, 0.022, 12, 18, Math.PI);
    rollHoopGeo.rotateZ(Math.PI);
    const rollHoopL = new THREE.Mesh(rollHoopGeo, chromeMaterial);
    rollHoopL.position.set(-0.16, 0.96, -0.44);
    const rollHoopR = new THREE.Mesh(rollHoopGeo, chromeMaterial);
    rollHoopR.position.set(0.16, 0.96, -0.44);
    cockpitGroup.add(rollHoopL, rollHoopR);

    // Molded Dashboard Console
    const dashGeo = new THREE.BoxGeometry(width * 0.46, 0.16, 0.22);
    const dashboard = new THREE.Mesh(dashGeo, darkMetalMaterial);
    dashboard.position.set(0, 0.58, 0.16);
    dashboard.rotation.x = -0.18;
    cockpitGroup.add(dashboard);

    // Digital Telemetry Instrument HUD
    const hudGeo = new THREE.PlaneGeometry(0.18, 0.07);
    hudGeo.rotateX(-0.55);
    const hudMat = new THREE.MeshStandardMaterial({
      color: 0x00ffcc,
      emissive: 0x00ffcc,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });
    const hudDisplay = new THREE.Mesh(hudGeo, hudMat);
    hudDisplay.position.set(0, 0.64, 0.15);
    cockpitGroup.add(hudDisplay);

    // Sports Steering Yoke
    const yokeColGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.24, 12);
    yokeColGeo.rotateX(Math.PI / 4);
    const yokeCol = new THREE.Mesh(yokeColGeo, chromeMaterial);
    yokeCol.position.set(0, 0.54, 0.06);
    cockpitGroup.add(yokeCol);

    const yokeWheelGeo = new THREE.TorusGeometry(0.11, 0.016, 10, 16);
    yokeWheelGeo.rotateX(-Math.PI / 4);
    const yokeWheel = new THREE.Mesh(yokeWheelGeo, neonGreenMaterial);
    yokeWheel.position.set(0, 0.62, -0.02);
    cockpitGroup.add(yokeWheel);

    body.add(cockpitGroup);

    // F. WINDSHIELD / CANOPY (Curved, Raked Polycarbonate Glass)
    const windscreenGeo = new THREE.CylinderGeometry(
      width * 0.32,
      width * 0.35,
      0.26,
      20,
      1,
      true,
      -Math.PI * 0.44,
      Math.PI * 0.88
    );
    windscreenGeo.rotateX(0.24); // Raked aerodynamic angle
    const windscreen = new THREE.Mesh(windscreenGeo, glassMaterial);
    windscreen.position.set(0, 0.72, 0.16);
    body.add(windscreen);

    // Windscreen Carbon A-Pillar Trim
    const aPillarGeo = new THREE.BoxGeometry(0.025, 0.26, 0.035);
    aPillarGeo.rotateX(0.24);
    const aPillarL = new THREE.Mesh(aPillarGeo, carbonFiberMaterial);
    aPillarL.position.set(-width * 0.30, 0.72, 0.15);
    aPillarL.rotation.y = 0.42;
    const aPillarR = new THREE.Mesh(aPillarGeo, carbonFiberMaterial);
    aPillarR.position.set(width * 0.30, 0.72, 0.15);
    aPillarR.rotation.y = -0.42;
    body.add(aPillarL, aPillarR);

    // G. ELEVATED REAR DECK & SPEEDSTER FAIRINGS
    const rearDeckGeo = new THREE.BoxGeometry(width * 0.64, 0.28, length * 0.34);
    const rearDeckMesh = new THREE.Mesh(rearDeckGeo, solidPaintMaterial);
    rearDeckMesh.position.set(0, 0.50, -length * 0.22);
    rearDeckMesh.castShadow = true;
    body.add(rearDeckMesh);

    // Speedster Fairings (Twin aerodynamic humps behind cockpit)
    const fairingGeo = new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    fairingGeo.scale(1.0, 0.8, 2.2);
    const fairingL = new THREE.Mesh(fairingGeo, solidPaintMaterial);
    fairingL.position.set(-0.24, 0.64, -length * 0.20);
    const fairingR = new THREE.Mesh(fairingGeo, solidPaintMaterial);
    fairingR.position.set(0.24, 0.64, -length * 0.20);
    body.add(fairingL, fairingR);

    // High-Downforce Twill Carbon Fiber Rear Wing
    const wingGeo = new THREE.BoxGeometry(width * 0.70, 0.045, 0.26);
    const rearWing = new THREE.Mesh(wingGeo, carbonFiberMaterial);
    rearWing.position.set(0, 0.88, -length * 0.36);
    rearWing.castShadow = true;
    body.add(rearWing);

    // Wing Endplates with Neon Green Edge Trim
    const endplateGeo = new THREE.BoxGeometry(0.03, 0.16, 0.32);
    const endplateL = new THREE.Mesh(endplateGeo, carbonFiberMaterial);
    endplateL.position.set(-width * 0.355, 0.88, -length * 0.36);
    const endplateR = new THREE.Mesh(endplateGeo, carbonFiberMaterial);
    endplateR.position.set(width * 0.355, 0.88, -length * 0.36);

    const endTrimGeo = new THREE.BoxGeometry(0.035, 0.025, 0.33);
    const endTrimL = new THREE.Mesh(endTrimGeo, neonGreenMaterial);
    endTrimL.position.set(-width * 0.355, 0.95, -length * 0.36);
    const endTrimR = new THREE.Mesh(endTrimGeo, neonGreenMaterial);
    endTrimR.position.set(width * 0.355, 0.95, -length * 0.36);
    body.add(endplateL, endplateR, endTrimL, endTrimR);

    // Polished Chrome Spoiler Struts
    const pylonGeo = new THREE.BoxGeometry(0.035, 0.28, 0.06);
    pylonGeo.rotateX(0.15);
    const pylonL = new THREE.Mesh(pylonGeo, chromeMaterial);
    pylonL.position.set(-width * 0.22, 0.74, -length * 0.35);
    const pylonR = new THREE.Mesh(pylonGeo, chromeMaterial);
    pylonR.position.set(width * 0.22, 0.74, -length * 0.35);
    body.add(pylonL, pylonR);

    carRoot.add(body);

    // =========================================================================
    // 5. WHEELS NODE (Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR)
    // =========================================================================
    const wheelHalfWidth = 0.17;

    const makeWheel = (name: string, x: number, y: number, z: number): THREE.Group => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(x, y, z);

      // Rotating sub-group (children[0]): spins smoothly around X via CarAnimation
      const wheelSpinner = new THREE.Group();
      wheelSpinner.name = 'WheelSpinner';

      // 1. Treaded Tire Cylinder
      const tireGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelHalfWidth, 24);
      tireGeo.rotateZ(Math.PI / 2);
      const tire = new THREE.Mesh(tireGeo, tireMaterial);
      tire.castShadow = true;
      wheelSpinner.add(tire);

      // 2. 5-Spoke Chrome Alloy Wheel Face (Visible on outer side)
      const isRightSide = x > 0;
      const faceOffset = isRightSide ? (wheelHalfWidth * 0.5 + 0.005) : -(wheelHalfWidth * 0.5 + 0.005);

      const rimFaceGeo = new THREE.CircleGeometry(wheelRadius * 0.72, 24);
      rimFaceGeo.rotateY(isRightSide ? Math.PI / 2 : -Math.PI / 2);
      const rimFace = new THREE.Mesh(rimFaceGeo, rimFaceMaterial);
      rimFace.position.x = faceOffset;
      wheelSpinner.add(rimFace);

      // 3. Glowing Neon Green Rim Ring
      const lipRingGeo = new THREE.TorusGeometry(wheelRadius * 0.73, 0.015, 12, 24);
      lipRingGeo.rotateY(Math.PI / 2);
      const lipRing = new THREE.Mesh(lipRingGeo, neonGreenMaterial);
      lipRing.position.x = faceOffset;
      wheelSpinner.add(lipRing);

      // 4. Center Gold Bull Logo Hubcap
      const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16);
      hubGeo.rotateZ(Math.PI / 2);
      const hubCap = new THREE.Mesh(hubGeo, goldMaterial);
      hubCap.position.x = faceOffset + (isRightSide ? 0.01 : -0.01);
      wheelSpinner.add(hubCap);

      wheelGroup.add(wheelSpinner); // children[0] is the spinning assembly

      // 5. Stationary Ventilated Brake Rotor Disc & Caliper (children[1], stays upright)
      const brakeRotorGeo = new THREE.CylinderGeometry(wheelRadius * 0.52, wheelRadius * 0.52, 0.02, 16);
      brakeRotorGeo.rotateZ(Math.PI / 2);
      const rotor = new THREE.Mesh(brakeRotorGeo, chromeMaterial);
      rotor.position.x = isRightSide ? -0.02 : 0.02;

      const caliperGeo = new THREE.BoxGeometry(0.06, 0.11, 0.14);
      const caliperMat = new THREE.MeshStandardMaterial({ color: 0xff1e40, roughness: 0.2, metalness: 0.8 });
      const caliper = new THREE.Mesh(caliperGeo, caliperMat);
      caliper.position.set(rotor.position.x, wheelRadius * 0.28, 0);

      wheelGroup.add(rotor);
      wheelGroup.add(caliper);

      return wheelGroup;
    };

    const wheelPosX = width * 0.42;
    const wheelPosZ = length * 0.32;
    const wheelPosY = wheelRadius;

    const wheelFL = makeWheel('Wheel_FL', -wheelPosX, wheelPosY, wheelPosZ);
    const wheelFR = makeWheel('Wheel_FR', wheelPosX, wheelPosY, wheelPosZ);
    const wheelRL = makeWheel('Wheel_RL', -wheelPosX, wheelPosY, -wheelPosZ);
    const wheelRR = makeWheel('Wheel_RR', wheelPosX, wheelPosY, -wheelPosZ);

    carRoot.add(wheelFL, wheelFR, wheelRL, wheelRR);

    // =========================================================================
    // 6. ANTENNA NODE (Mechanical Turret Mount & Compact Contact Head)
    // =========================================================================
    const antenna = new THREE.Group();
    antenna.name = 'Antenna';
    antenna.position.set(0, 0.64, -length * 0.36);

    // Mechanical Base Mount Turret on Rear Deck (PRD Section 15)
    const baseTurretGeo = new THREE.CylinderGeometry(0.075, 0.09, 0.045, 16);
    const baseTurret = new THREE.Mesh(baseTurretGeo, darkMetalMaterial);
    antenna.add(baseTurret);

    const lockCollarGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.03, 16);
    const lockCollar = new THREE.Mesh(lockCollarGeo, chromeMaterial);
    lockCollar.position.y = 0.035;
    antenna.add(lockCollar);

    // Flexible Spiral Rubber Boot at mast root
    const flexBootGeo = new THREE.CylinderGeometry(0.022, 0.042, 0.065, 12);
    const flexBoot = new THREE.Mesh(flexBootGeo, matteRubberMaterial);
    flexBoot.position.y = 0.075;
    antenna.add(flexBoot);

    // Slender Tapered Chrome Antenna Mast (PRD Section 13 - Controlled proportion)
    const mastHeight = 1.40;
    const mastGeo = new THREE.CylinderGeometry(0.006, 0.014, mastHeight, 12);
    mastGeo.translate(0, mastHeight * 0.5 + 0.10, 0); // Pivot at mounting base
    const mastMesh = new THREE.Mesh(mastGeo, chromeMaterial);
    antenna.add(mastMesh);

    // Compact Toroidal Contact Head (PRD Section 14 - Reduced radius, controlled glow)
    const contactHead = new THREE.Group();
    contactHead.name = 'ContactHead';
    contactHead.position.set(0, mastHeight + 0.10, 0);

    const contactRingGeo = new THREE.TorusGeometry(0.125, 0.022, 14, 24);
    const contactRingMesh = new THREE.Mesh(contactRingGeo, neonGreenMaterial);
    contactHead.add(contactRingMesh);

    // Chrome Center Hub
    const contactHubGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14);
    const contactHub = new THREE.Mesh(contactHubGeo, chromeMaterial);
    contactHead.add(contactHub);

    // Inner Electrical Spark Core
    const sparkCoreGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const sparkCoreMesh = new THREE.Mesh(
      sparkCoreGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    contactHead.add(sparkCoreMesh);

    antenna.add(contactHead);
    carRoot.add(antenna);

    // =========================================================================
    // 7. MONEY DISPLAY (Rear Transom Embedded Screen showing "$85")
    // =========================================================================
    const moneyDisplay = new THREE.Group();
    moneyDisplay.name = 'MoneyDisplay';
    moneyDisplay.position.set(0, 0.50, -length * 0.385);

    // Runtime Dynamic Canvas Screen
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#020b05';
    ctx.fillRect(0, 0, 256, 128);
    // Sharp neon border frame
    ctx.strokeStyle = '#00ff6a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 244, 116);
    // Glowing $85 cash text
    ctx.shadowColor = '#00ff6a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 76px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$85', 128, 64);
    ctx.shadowBlur = 0;

    const displayTex = new THREE.CanvasTexture(canvas);
    const screenMat = new THREE.MeshBasicMaterial({ map: displayTex });
    const screenGeo = new THREE.PlaneGeometry(0.46, 0.22);
    screenGeo.rotateY(Math.PI); // Face backwards
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);

    // Beveled Metal Enclosure Bezel
    const frameGeo = new THREE.BoxGeometry(0.52, 0.26, 0.05);
    const frameMesh = new THREE.Mesh(frameGeo, darkMetalMaterial);
    frameMesh.position.z = 0.025;

    moneyDisplay.add(screenMesh);
    moneyDisplay.add(frameMesh);
    carRoot.add(moneyDisplay);

    // =========================================================================
    // 8. HEADLIGHTS (Recessed Projector Bowls, Amber DRL & Glass Lenses)
    // =========================================================================
    const makeHeadlight = (name: string, x: number): THREE.Group => {
      const hlGroup = new THREE.Group();
      hlGroup.name = name;
      hlGroup.position.set(x, 0.44, length * 0.39);

      // Angled Recessed Housing Bucket
      const housingGeo = new THREE.BoxGeometry(0.24, 0.13, 0.10);
      const housing = new THREE.Mesh(housingGeo, darkMetalMaterial);
      hlGroup.add(housing);

      // Dual Projector Bowls & Lenses
      const projLensGeo = new THREE.SphereGeometry(0.042, 14, 14);
      const proj1 = new THREE.Mesh(projLensGeo, projectorCoreMaterial);
      proj1.position.set(-0.055, -0.01, 0.04);
      const proj2 = new THREE.Mesh(projLensGeo, projectorCoreMaterial);
      proj2.position.set(0.055, -0.01, 0.04);
      hlGroup.add(proj1, proj2);

      // Amber DRL Brow Strip along top edge
      const drlGeo = new THREE.BoxGeometry(0.22, 0.022, 0.05);
      const drl = new THREE.Mesh(drlGeo, drlBrowMaterial);
      drl.position.set(0, 0.046, 0.04);
      hlGroup.add(drl);

      // Transparent Polycarbonate Aerodynamic Lens
      const outerLensGeo = new THREE.PlaneGeometry(0.23, 0.12);
      const outerLens = new THREE.Mesh(outerLensGeo, glassMaterial);
      outerLens.position.z = 0.055;
      hlGroup.add(outerLens);

      return hlGroup;
    };

    const headlightL = makeHeadlight('Headlight_L', -width * 0.26);
    const headlightR = makeHeadlight('Headlight_R', width * 0.26);
    carRoot.add(headlightL, headlightR);

    // =========================================================================
    // 9. TAILLIGHTS (Ruby Red LED Lightbars flush with Rear Quarters)
    // =========================================================================
    const makeTailLight = (name: string, x: number): THREE.Group => {
      const tlGroup = new THREE.Group();
      tlGroup.name = name;
      tlGroup.position.set(x, 0.48, -length * 0.385);

      const housingGeo = new THREE.BoxGeometry(0.22, 0.10, 0.04);
      const housing = new THREE.Mesh(housingGeo, darkMetalMaterial);
      tlGroup.add(housing);

      // C-shaped Ruby Red LED Lightbar
      const ledBarGeo = new THREE.BoxGeometry(0.18, 0.065, 0.03);
      const ledBar = new THREE.Mesh(ledBarGeo, taillightMaterial);
      ledBar.position.z = -0.015;
      tlGroup.add(ledBar);

      return tlGroup;
    };

    const taillightL = makeTailLight('TailLight_L', -width * 0.25);
    const taillightR = makeTailLight('TailLight_R', width * 0.25);
    carRoot.add(taillightL, taillightR);

    // =========================================================================
    // 10. VFX ANCHOR NODES & DUAL EXHAUST
    // =========================================================================
    const vfxBoost = new THREE.Group();
    vfxBoost.name = 'VFX_Boost';
    vfxBoost.position.set(0, 0.22, -length * 0.42);

    // Dual Polished Chrome Exhaust Nozzles integrated in rear diffuser
    const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.18, 14);
    exhaustGeo.rotateX(Math.PI / 2);
    const nozzleL = new THREE.Mesh(exhaustGeo, chromeMaterial);
    nozzleL.position.x = -0.22;
    const nozzleR = new THREE.Mesh(exhaustGeo, chromeMaterial);
    nozzleR.position.x = 0.22;
    vfxBoost.add(nozzleL, nozzleR);
    carRoot.add(vfxBoost);

    const vfxAntenna = new THREE.Group();
    vfxAntenna.name = 'VFX_Antenna';
    vfxAntenna.position.set(0, 1.40 + 0.10 + 0.64, -length * 0.36);
    carRoot.add(vfxAntenna);

    const vfxImpact = new THREE.Group();
    vfxImpact.name = 'VFX_Impact';
    vfxImpact.position.set(0, 0.28, 0);
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

  /**
   * Helper that creates a BoxGeometry with individual face UV remapping into specific atlas sub-rectangles.
   */
  private static createRemappedBox(
    w: number,
    h: number,
    d: number,
    faceUVs: {
      right?: [number, number, number, number];
      left?: [number, number, number, number];
      top?: [number, number, number, number];
      bottom?: [number, number, number, number];
      front?: [number, number, number, number];
      back?: [number, number, number, number];
    }
  ): THREE.BoxGeometry {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uvAttr = geo.attributes.uv as THREE.BufferAttribute;
    const faces = [faceUVs.right, faceUVs.left, faceUVs.top, faceUVs.bottom, faceUVs.front, faceUVs.back];

    for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
      const rect = faces[faceIdx];
      if (!rect) continue;
      const [uMin, vMin, uMax, vMax] = rect;
      const baseVert = faceIdx * 4;

      for (let i = 0; i < 4; i++) {
        const vertIdx = baseVert + i;
        const uOrig = uvAttr.getX(vertIdx);
        const vOrig = uvAttr.getY(vertIdx);

        const uNew = uMin + uOrig * (uMax - uMin);
        const vNew = vMin + vOrig * (vMax - vMin);

        uvAttr.setXY(vertIdx, uNew, vNew);
      }
    }
    uvAttr.needsUpdate = true;
    return geo;
  }
}
