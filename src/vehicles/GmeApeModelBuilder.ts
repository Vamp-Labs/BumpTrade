import * as THREE from 'three';
import { GME_APE_CONFIG } from './VehicleTypes';

/**
 * Procedural GME Ape 3D Model Builder (Canonical PRD Implementation).
 * 
 * Implements the Meme Muscle / Berserker vehicle:
 * 1. Silhouette: Wide-body aggressive American muscle fastback with ducktail spoiler.
 * 2. Dimensions: L 2.72m × W 2.06m × H 1.40m.
 * 3. Color & Materials: Satin Midnight Charcoal (#1C1E26) with dual wide crimson racing stripes (#FF1E42),
 *    Diamond Cyan pinstripes (#00F0FF), and chrome blower trim.
 * 4. Distinctive Features:
 *    - Exposed V8 Supercharger Blower protruding through the hood cutout with triple anodized red butterfly scoops.
 *    - Dual rear Rocket Thruster Afterburners ("To The Moon!").
 *    - Charismatic Diamond Hands Gorilla mascot driver with iconic WSB/Roaring Kitty red headband and aviators.
 *    - Heavy-duty spring antenna mast with glowing diamond crystal / moon orb contact head (Z = 1.42m).
 *    - Deep-dish 5-spoke chrome muscle mag wheels with wide rear drag tires.
 * 5. Dynamic Money Display: "$420" dynamic digital cash readout.
 * 6. Full CarNodeBindings compliance.
 */
export class GmeApeModelBuilder {
  public static build(): THREE.Group {
    const carRoot = new THREE.Group();
    carRoot.name = 'CarRoot';

    const length = GME_APE_CONFIG.dimensions.length;
    const width = GME_APE_CONFIG.dimensions.width;
    const wheelRadius = GME_APE_CONFIG.dimensions.wheelRadius;

    // =========================================================================
    // 1. ADVANCED PBR MATERIALS
    // =========================================================================
    // Satin Midnight Charcoal Body Paint
    const musclePaintMaterial = new THREE.MeshStandardMaterial({
      color: 0x1c1e26,
      roughness: 0.24,
      metalness: 0.84,
    });
    musclePaintMaterial.name = 'MuscleCharcoalPaint';
    musclePaintMaterial.userData = { isPaint: true };

    // Hot Crimson Racing Stripe
    const crimsonStripeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      roughness: 0.20,
      metalness: 0.70,
    });
    crimsonStripeMaterial.name = 'CrimsonStripe';
    crimsonStripeMaterial.userData = { isPaint: true };

    // Diamond Cyan Neon Accent
    const diamondCyanMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00d9ff,
      emissiveIntensity: 2.8,
      roughness: 0.12,
      metalness: 0.20,
    });

    // Polished Blower Chrome
    const chromeMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0f4fa,
      roughness: 0.04,
      metalness: 0.98,
    });

    // Dark Structural Chassis Metal
    const darkMetalMaterial = new THREE.MeshStandardMaterial({
      color: 0x121418,
      roughness: 0.45,
      metalness: 0.85,
    });

    // Heavy Bumper Rubber
    const rubberMaterial = new THREE.MeshStandardMaterial({
      color: 0x14161a,
      roughness: 0.88,
      metalness: 0.05,
    });

    // Gorilla Driver Hide
    const apeSkinMaterial = new THREE.MeshStandardMaterial({
      color: 0x181a1f,
      roughness: 0.75,
      metalness: 0.05,
    });

    // WSB Red Headband
    const headbandMaterial = new THREE.MeshStandardMaterial({
      color: 0xff1e42,
      emissive: 0xff1e42,
      emissiveIntensity: 1.2,
      roughness: 0.40,
    });

    // Headlight Lens Material
    const headlightMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 4.0,
      roughness: 0.05,
    });

    const amberHaloMaterial = new THREE.MeshStandardMaterial({
      color: 0xffa000,
      emissive: 0xff8800,
      emissiveIntensity: 3.0,
      roughness: 0.10,
    });

    // Taillight Ruby Material
    const taillightMaterial = new THREE.MeshStandardMaterial({
      color: 0xff002b,
      emissive: 0xff002b,
      emissiveIntensity: 3.8,
      roughness: 0.10,
    });

    // =========================================================================
    // 2. CHASSIS (CarNodeBindings.chassis)
    // =========================================================================
    const chassisGroup = new THREE.Group();
    chassisGroup.name = 'Chassis';
    carRoot.add(chassisGroup);

    const chassisGeo = new THREE.BoxGeometry(width * 0.88, 0.14, length * 0.92);
    const chassisMesh = new THREE.Mesh(chassisGeo, darkMetalMaterial);
    chassisMesh.position.y = 0.15;
    chassisGroup.add(chassisMesh);

    // =========================================================================
    // 3. BODY (CarNodeBindings.body)
    // =========================================================================
    const bodyGroup = new THREE.Group();
    bodyGroup.name = 'Body';
    carRoot.add(bodyGroup);

    // Main Muscle Car Slab
    const mainBodyGeo = new THREE.BoxGeometry(width * 0.96, 0.38, length * 0.96);
    const mainBodyMesh = new THREE.Mesh(mainBodyGeo, musclePaintMaterial);
    mainBodyMesh.position.y = 0.38;
    bodyGroup.add(mainBodyMesh);

    // Dual Crimson Racing Stripes
    const stripeLGeo = new THREE.BoxGeometry(width * 0.18, 0.02, length * 0.97);
    const stripeLMesh = new THREE.Mesh(stripeLGeo, crimsonStripeMaterial);
    stripeLMesh.position.set(-width * 0.18, 0.58, 0);
    bodyGroup.add(stripeLMesh);

    const stripeRGeo = new THREE.BoxGeometry(width * 0.18, 0.02, length * 0.97);
    const stripeRMesh = new THREE.Mesh(stripeRGeo, crimsonStripeMaterial);
    stripeRMesh.position.set(width * 0.18, 0.58, 0);
    bodyGroup.add(stripeRMesh);

    // Rear Ducktail Kick Spoiler
    const spoilerGeo = new THREE.BoxGeometry(width * 0.92, 0.12, 0.26);
    const spoilerMesh = new THREE.Mesh(spoilerGeo, musclePaintMaterial);
    spoilerMesh.position.set(0, 0.62, length * 0.44);
    spoilerMesh.rotation.x = -0.22;
    bodyGroup.add(spoilerMesh);

    // =========================================================================
    // 4. EXPOSED V8 SUPERCHARGER BLOWER & SCOOP
    // =========================================================================
    const blowerGroup = new THREE.Group();
    blowerGroup.name = 'SuperchargerBlower';
    blowerGroup.position.set(0, 0.58, -length * 0.16);
    bodyGroup.add(blowerGroup);

    // Aluminum Blower Case
    const bCaseGeo = new THREE.BoxGeometry(0.36, 0.18, 0.46);
    const bCaseMesh = new THREE.Mesh(bCaseGeo, chromeMaterial);
    blowerGroup.add(bCaseMesh);

    // Bug-Catcher Forward Air Scoop
    const scoopGeo = new THREE.BoxGeometry(0.38, 0.14, 0.36);
    const scoopMesh = new THREE.Mesh(scoopGeo, chromeMaterial);
    scoopMesh.position.set(0, 0.14, -0.04);
    blowerGroup.add(scoopMesh);

    // Triple Anodized Red Butterflies
    for (let i = -1; i <= 1; i++) {
      const bfGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.015, 16);
      bfGeo.rotateX(Math.PI * 0.4);
      const bfMesh = new THREE.Mesh(bfGeo, crimsonStripeMaterial);
      bfMesh.position.set(i * 0.10, 0.14, -0.22);
      blowerGroup.add(bfMesh);
    }

    // =========================================================================
    // 5. BUMPER (CarNodeBindings.bumper)
    // =========================================================================
    const bumperGroup = new THREE.Group();
    bumperGroup.name = 'Bumper';
    carRoot.add(bumperGroup);

    const bOuterGeo = new THREE.BoxGeometry(width * 1.08, 0.16, length * 1.04);
    const bOuterMesh = new THREE.Mesh(bOuterGeo, rubberMaterial);
    bOuterMesh.position.y = 0.24;
    bumperGroup.add(bOuterMesh);

    const bNeonGeo = new THREE.BoxGeometry(width * 1.09, 0.03, length * 1.05);
    const bNeonMesh = new THREE.Mesh(bNeonGeo, crimsonStripeMaterial);
    bNeonMesh.position.y = 0.19;
    bumperGroup.add(bNeonMesh);

    // =========================================================================
    // 6. LIGHTING (CarNodeBindings.headlightL/R, tailLightL/R)
    // =========================================================================
    // Quad Halo Headlights
    const hlL = new THREE.Group();
    hlL.name = 'Headlight_L';
    for (const offset of [-0.52, -0.70]) {
      const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), headlightMaterial);
      pMesh.rotation.x = Math.PI / 2;
      pMesh.position.set(offset, 0.42, -length * 0.48);
      hlL.add(pMesh);
      const hMesh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 16), amberHaloMaterial);
      hMesh.position.set(offset, 0.42, -length * 0.485);
      hlL.add(hMesh);
    }
    bodyGroup.add(hlL);

    const hlR = new THREE.Group();
    hlR.name = 'Headlight_R';
    for (const offset of [0.52, 0.70]) {
      const pMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), headlightMaterial);
      pMesh.rotation.x = Math.PI / 2;
      pMesh.position.set(offset, 0.42, -length * 0.48);
      hlR.add(pMesh);
      const hMesh = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.008, 8, 16), amberHaloMaterial);
      hMesh.position.set(offset, 0.42, -length * 0.485);
      hlR.add(hMesh);
    }
    bodyGroup.add(hlR);

    // Retro Triple-Slot Taillights
    const tlL = new THREE.Group();
    tlL.name = 'TailLight_L';
    for (let i = 0; i < 3; i++) {
      const sMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.02), taillightMaterial);
      sMesh.position.set(-0.52 - i * 0.06, 0.48, length * 0.48);
      tlL.add(sMesh);
    }
    bodyGroup.add(tlL);

    const tlR = new THREE.Group();
    tlR.name = 'TailLight_R';
    for (let i = 0; i < 3; i++) {
      const sMesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.02), taillightMaterial);
      sMesh.position.set(0.52 + i * 0.06, 0.48, length * 0.48);
      tlR.add(sMesh);
    }
    bodyGroup.add(tlR);

    // =========================================================================
    // 7. ROCKET THRUSTERS ("TO THE MOON!")
    // =========================================================================
    for (const rx of [-0.28, 0.28]) {
      const rkGeo = new THREE.CylinderGeometry(0.06, 0.09, 0.18, 16);
      rkGeo.rotateX(Math.PI / 2);
      const rkMesh = new THREE.Mesh(rkGeo, darkMetalMaterial);
      rkMesh.position.set(rx, 0.32, length * 0.46);
      bodyGroup.add(rkMesh);

      const flameGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.04, 16);
      flameGeo.rotateX(Math.PI / 2);
      const flameMesh = new THREE.Mesh(flameGeo, diamondCyanMaterial);
      flameMesh.position.set(rx, 0.32, length * 0.52);
      bodyGroup.add(flameMesh);
    }

    // =========================================================================
    // 8. DRIVER MASCOT (CarNodeBindings.driver) — GORILLA WITH RED HEADBAND
    // =========================================================================
    const driverGroup = new THREE.Group();
    driverGroup.name = 'Driver';
    driverGroup.position.set(0, 0.52, 0.08);
    carRoot.add(driverGroup);

    // Gorilla Head
    const headGeo = new THREE.BoxGeometry(0.34, 0.32, 0.32);
    const headMesh = new THREE.Mesh(headGeo, apeSkinMaterial);
    headMesh.position.set(0, 0.26, 0);
    driverGroup.add(headMesh);

    // Brow Ridge
    const browGeo = new THREE.BoxGeometry(0.32, 0.10, 0.10);
    const browMesh = new THREE.Mesh(browGeo, apeSkinMaterial);
    browMesh.position.set(0, 0.35, -0.12);
    driverGroup.add(browMesh);

    // WSB Red Headband
    const hbGeo = new THREE.BoxGeometry(0.36, 0.07, 0.34);
    const hbMesh = new THREE.Mesh(hbGeo, headbandMaterial);
    hbMesh.position.set(0, 0.36, 0);
    driverGroup.add(hbMesh);

    // Headband Fluttering Ribbons
    const ribbonGeo = new THREE.BoxGeometry(0.04, 0.22, 0.05);
    const ribbonMesh = new THREE.Mesh(ribbonGeo, headbandMaterial);
    ribbonMesh.position.set(-0.20, 0.38, 0.22);
    ribbonMesh.rotation.set(-0.35, 0, -0.45);
    driverGroup.add(ribbonMesh);

    // Dark Aviator Sunglasses
    const sgGeo = new THREE.BoxGeometry(0.24, 0.065, 0.03);
    const sgMesh = new THREE.Mesh(sgGeo, new THREE.MeshStandardMaterial({ color: 0x010101, roughness: 0.05, metalness: 0.9 }));
    sgMesh.position.set(0, 0.28, -0.17);
    driverGroup.add(sgMesh);

    // =========================================================================
    // 9. MONEY DISPLAY (CarNodeBindings.moneyDisplay)
    // =========================================================================
    const moneyDisplayGroup = new THREE.Group();
    moneyDisplayGroup.name = 'MoneyDisplay';
    bodyGroup.add(moneyDisplayGroup);

    const mdFMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.04), crimsonStripeMaterial);
    mdFMesh.position.set(0, 0.32, -length * 0.49);
    moneyDisplayGroup.add(mdFMesh);

    const mdRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.04), crimsonStripeMaterial);
    mdRMesh.position.set(0, 0.42, length * 0.49);
    moneyDisplayGroup.add(mdRMesh);

    // =========================================================================
    // 10. ANTENNA & CONTACT HEAD (CarNodeBindings.antenna, contactHead)
    // =========================================================================
    const antennaGroup = new THREE.Group();
    antennaGroup.name = 'Antenna';
    antennaGroup.position.set(0, 0.58, length * 0.22);
    carRoot.add(antennaGroup);

    const mastGeo = new THREE.CylinderGeometry(0.018, 0.024, 0.54, 12);
    const mastMesh = new THREE.Mesh(mastGeo, darkMetalMaterial);
    mastMesh.position.y = 0.27;
    antennaGroup.add(mastMesh);

    const contactHeadGroup = new THREE.Group();
    contactHeadGroup.name = 'ContactHead';
    contactHeadGroup.position.set(0, 0.84, 0); // World Z = 0.58 + 0.84 = 1.42m
    antennaGroup.add(contactHeadGroup);

    // Glowing Diamond Hands Crystal
    const diamondGeo = new THREE.OctahedronGeometry(0.09, 0);
    const diamondMesh = new THREE.Mesh(diamondGeo, diamondCyanMaterial);
    contactHeadGroup.add(diamondMesh);

    // Orbital Saturn Ring
    const saturnGeo = new THREE.TorusGeometry(0.13, 0.012, 8, 24);
    saturnGeo.rotateX(Math.PI * 0.35);
    const saturnMesh = new THREE.Mesh(saturnGeo, chromeMaterial);
    contactHeadGroup.add(saturnMesh);

    // =========================================================================
    // 11. WHEELS (Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR)
    // =========================================================================
    const track = width * 0.48;
    const wheelbase = length * 0.28;

    const createWheel = (name: string, x: number, z: number): THREE.Group => {
      const wGroup = new THREE.Group();
      wGroup.name = name;
      wGroup.position.set(x, wheelRadius, z);

      const signX = x < 0 ? -1 : 1;
      const tGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.23, 24);
      tGeo.rotateZ(Math.PI / 2);
      const tMesh = new THREE.Mesh(tGeo, rubberMaterial);
      wGroup.add(tMesh);

      // Chrome Mag Rim
      const rGeo = new THREE.CylinderGeometry(wheelRadius * 0.72, wheelRadius * 0.72, 0.24, 20);
      rGeo.rotateZ(Math.PI / 2);
      const rMesh = new THREE.Mesh(rGeo, chromeMaterial);
      wGroup.add(rMesh);

      // Red Caliper
      const calGeo = new THREE.BoxGeometry(0.05, 0.10, 0.08);
      const calMesh = new THREE.Mesh(calGeo, crimsonStripeMaterial);
      calMesh.position.set(-signX * 0.04, wheelRadius * 0.35, 0);
      wGroup.add(calMesh);

      carRoot.add(wGroup);
      return wGroup;
    };

    createWheel('Wheel_FL', -track, -wheelbase);
    createWheel('Wheel_FR',  track, -wheelbase);
    createWheel('Wheel_RL', -track,  wheelbase);
    createWheel('Wheel_RR',  track,  wheelbase);

    return carRoot;
  }
}
