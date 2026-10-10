import * as THREE from 'three';
import { CAR_CONFIG } from '../core/Config';
import { CarNodeBindings, CarPhysicsState, CarAnimationState } from './CarTypes';
import { PowerUpType } from '../pickups/PowerUpTypes';

interface SavedMaterialState {
  material: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  baseRoughness: number;
  baseMetalness: number;
  baseEmissive: THREE.Color;
  baseEmissiveIntensity: number;
}

export class CarVisual {
  public readonly bindings: CarNodeBindings;

  // Bumper Spring & Permanent Damage Mechanics
  private bumperTargetOffset: THREE.Vector3 = new THREE.Vector3();
  private bumperCurrentOffset: THREE.Vector3 = new THREE.Vector3();
  private bumperVelocity: THREE.Vector3 = new THREE.Vector3();
  private baseBumperLocalPos: THREE.Vector3 = new THREE.Vector3();
  private baseBumperScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);

  // Body & Antenna Base Transforms
  private baseBodyLocalPos: THREE.Vector3 = new THREE.Vector3();
  private baseBodyRotation: THREE.Euler = new THREE.Euler();
  private baseAntennaRotation: THREE.Euler = new THREE.Euler();
  private driverNode?: THREE.Object3D;
  private baseDriverRotation: THREE.Euler = new THREE.Euler();

  // Damage & Physical Deformation State
  private damageRatio: number = 0.0; // 0.0 (pristine) to 1.0 (wrecked)
  private permanentDentOffset: THREE.Vector3 = new THREE.Vector3();
  private dentRoll: number = 0;   // Sideways roll twist
  private dentPitch: number = 0;  // Forward/back crumple
  private dentYaw: number = 0;    // Skewed yaw angle

  // Material weathering cache
  private paintMaterials: SavedMaterialState[] = [];
  private underglowLight?: THREE.PointLight;
  private baseUnderglowIntensity: number = 1.8;

  // Bounty Visual Auras
  private bountyTier: 'NORMAL' | 'HOT' | 'BIG_BAG' | 'BOUNTY' = 'NORMAL';
  private bountyCrownGroup?: THREE.Group;

  // Active Body-Contour Power-Up Aura State ("mobilnya berlumur aura mengikuti shape mobilnya")
  private activePowerUpType: PowerUpType | null = null;
  private powerUpPulseTimer: number = 0;

  // Critical Bag & Elimination state
  private isCriticalBag: boolean = false;
  private isEliminated: boolean = false;

  public getBountyTier(): 'NORMAL' | 'HOT' | 'BIG_BAG' | 'BOUNTY' {
    return this.bountyTier;
  }

  public setCriticalBag(critical: boolean): void {
    this.isCriticalBag = critical;
  }

  public triggerEliminationShutdown(): void {
    this.isEliminated = true;
    this.isCriticalBag = false;
    this.damageRatio = 1.0;

    // Shut down lights
    if (this.bindings.headlightL) this.setEmissiveIntensity(this.bindings.headlightL, 0);
    if (this.bindings.headlightR) this.setEmissiveIntensity(this.bindings.headlightR, 0);
    if (this.bindings.tailLightL) this.setEmissiveIntensity(this.bindings.tailLightL, 0);
    if (this.bindings.tailLightR) this.setEmissiveIntensity(this.bindings.tailLightR, 0);
    if (this.underglowLight) this.underglowLight.intensity = 0;

    // Permanent crushed frame sag
    this.permanentDentOffset.set(0.12, -0.15, 0.08);
    this.dentPitch = 0.18;
    this.dentRoll = 0.22;
    this.dentYaw = 0.12;
    this.updateMaterialWeathering();
    this.updateMoneyDisplay(0, '#ff0033');
    this.setBountyTier('NORMAL');
  }

  constructor(bindings: CarNodeBindings) {
    this.bindings = bindings;

    if (this.bindings.bumper) {
      this.baseBumperLocalPos.copy(this.bindings.bumper.position);
      this.baseBumperScale.copy(this.bindings.bumper.scale);
    }

    if (this.bindings.body) {
      this.baseBodyLocalPos.copy(this.bindings.body.position);
      this.baseBodyRotation.copy(this.bindings.body.rotation);

      // Search for driver node
      this.bindings.body.traverse((child) => {
        if (child.name === 'Driver' || child.name.toLowerCase().includes('driver')) {
          this.driverNode = child;
          this.baseDriverRotation.copy(child.rotation);
        }
      });
    }

    if (this.bindings.antenna) {
      this.baseAntennaRotation.copy(this.bindings.antenna.rotation);
    }

    // Cache paint materials across vehicle to apply realistic scratches and soot
    this.cachePaintMaterials();

    // Cache underglow if present in chassis
    if (this.bindings.chassis) {
      this.bindings.chassis.traverse((child) => {
        if ((child as THREE.PointLight).isPointLight) {
          this.underglowLight = child as THREE.PointLight;
          this.baseUnderglowIntensity = this.underglowLight.intensity;
        }
      });
    }

    // Setup 3D Bounty Auras and Crown Halo
    this.setupBountyVisuals();
  }

  private setupBountyVisuals(): void {
    const root = this.bindings.root;
    if (!root) return;

    // BOUNTY TARGET: Radiant Crown Halo & Target Indicator (Floats suspended ABOVE antenna mast at Y = 2.05m)
    // Zero floor obstruction, 100% vehicle visibility!
    this.bountyCrownGroup = new THREE.Group();
    this.bountyCrownGroup.position.set(0, 2.05, 0);
    this.bountyCrownGroup.visible = false;

    // Crown Base Ring
    const crownRingGeo = new THREE.TorusGeometry(0.48, 0.045, 8, 24);
    crownRingGeo.rotateX(Math.PI / 2);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 1.8,
      metalness: 0.9,
      roughness: 0.1,
    });
    const crownRing = new THREE.Mesh(crownRingGeo, crownMat);
    this.bountyCrownGroup.add(crownRing);

    // 5 Crown Points (small upward golden cones)
    const coneGeo = new THREE.ConeGeometry(0.09, 0.22, 6);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const cone = new THREE.Mesh(coneGeo, crownMat);
      cone.position.set(Math.cos(angle) * 0.48, 0.11, Math.sin(angle) * 0.48);
      this.bountyCrownGroup.add(cone);
    }

    // Outer Radiant Aura Disc
    const radiantRingGeo = new THREE.RingGeometry(0.55, 0.78, 16);
    radiantRingGeo.rotateX(-Math.PI / 2);
    const radiantMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const radiantRing = new THREE.Mesh(radiantRingGeo, radiantMat);
    this.bountyCrownGroup.add(radiantRing);

    root.add(this.bountyCrownGroup);
  }

  private cachePaintMaterials(): void {
    const root = this.bindings.root;
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && mat.isMeshStandardMaterial && (mat.userData?.isPaint || (mat.metalness > 0.3 && !mat.emissiveIntensity))) {
          this.paintMaterials.push({
            material: mat,
            baseColor: mat.color.clone(),
            baseRoughness: mat.roughness,
            baseMetalness: mat.metalness,
            baseEmissive: mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000),
            baseEmissiveIntensity: mat.emissiveIntensity ?? 0,
          });
        }
      }
    });
  }

  /**
   * Activates or deactivates body-contour power-up aura ("mobilnya berlumur aura mengikuti shape mobilnya")
   */
  public setPowerUpAura(type: PowerUpType | null, active: boolean): void {
    if (active && type) {
      this.activePowerUpType = type;
    } else if (!active && this.activePowerUpType === type) {
      this.activePowerUpType = null;
      this.restoreDefaultMaterials();
    }
  }

  public restoreDefaultMaterials(): void {
    for (const item of this.paintMaterials) {
      item.material.emissive.copy(item.baseEmissive);
      item.material.emissiveIntensity = item.baseEmissiveIntensity;
    }
    if (this.underglowLight) {
      this.underglowLight.intensity = this.baseUnderglowIntensity;
    }
  }

  /**
   * Applies physical deformation and damage from collisions.
   * Compresses bumper, tilts frame, twists antenna, and degrades materials.
   */
  public applyDamage(damageRatio: number, localImpactDir?: THREE.Vector3, intensity: number = 0.5): void {
    this.damageRatio = THREE.MathUtils.clamp(damageRatio, 0.0, 1.0);

    if (localImpactDir && intensity > 0.05) {
      const dentForce = intensity * 0.16;
      // Permanent crumple displacement along impact vector opposite to normal
      this.permanentDentOffset.addScaledVector(localImpactDir.clone().normalize(), -dentForce);
      this.permanentDentOffset.clampLength(0, 0.32);

      // Crumple tilt angles
      const sideFactor = localImpactDir.x > 0 ? 1 : -1;
      this.dentRoll += sideFactor * intensity * 0.09;
      this.dentRoll = THREE.MathUtils.clamp(this.dentRoll, -0.22, 0.22);

      const fwdFactor = localImpactDir.z > 0 ? -1 : 1;
      this.dentPitch += fwdFactor * intensity * 0.08;
      this.dentPitch = THREE.MathUtils.clamp(this.dentPitch, -0.18, 0.18);

      this.dentYaw += (Math.random() - 0.5) * intensity * 0.18;
      this.dentYaw = THREE.MathUtils.clamp(this.dentYaw, -0.25, 0.25);
    }

    // Apply material weathering (scratches, scuffs, scorched paint)
    this.updateMaterialWeathering();
  }

  private updateMaterialWeathering(): void {
    const sootColor = new THREE.Color(0x1a1e24);
    for (const item of this.paintMaterials) {
      // Paint scuffs and loses clearcoat gloss
      item.material.roughness = THREE.MathUtils.lerp(item.baseRoughness, 0.76, this.damageRatio);
      // Metal scraped/primer exposed
      item.material.metalness = THREE.MathUtils.lerp(item.baseMetalness, 0.22, this.damageRatio);
      // Scorched soot darkening
      item.material.color.lerpColors(item.baseColor, sootColor, this.damageRatio * 0.65);
    }
  }

  /**
   * Triggers a visual bumper compression impulse from a collision event.
   */
  public triggerBumperCompression(localImpactDir: THREE.Vector3, intensity: number): void {
    if (!this.bindings.bumper) return;

    const compression = Math.min(intensity * CAR_CONFIG.maxBumperCompression, CAR_CONFIG.maxBumperCompression);
    this.bumperTargetOffset.copy(localImpactDir).normalize().multiplyScalar(-compression);
    this.bumperVelocity.copy(localImpactDir).normalize().multiplyScalar(-compression * 18.0);
  }

  /**
   * Updates visual transforms, spring physics, dynamic deformations, and lighting states.
   */
  public update(
    dt: number,
    physicsState: CarPhysicsState,
    animState: CarAnimationState,
    isBraking: boolean,
    isBoosting: boolean
  ): void {
    const root = this.bindings.root;

    // 1. Sync Root Transform with Physics Body
    root.position.copy(physicsState.position);
    root.quaternion.copy(physicsState.quaternion);

    // 2. Update Bumper Spring-Damper & Permanent Crumple
    if (this.bindings.bumper) {
      const k = CAR_CONFIG.bumperSpringStiffness;
      const c = CAR_CONFIG.bumperDamping;

      const fx = -k * this.bumperCurrentOffset.x - c * this.bumperVelocity.x;
      const fz = -k * this.bumperCurrentOffset.z - c * this.bumperVelocity.z;

      this.bumperVelocity.x += fx * dt;
      this.bumperVelocity.z += fz * dt;

      this.bumperCurrentOffset.x += this.bumperVelocity.x * dt;
      this.bumperCurrentOffset.z += this.bumperVelocity.z * dt;

      // Combine spring movement with permanent crash denting
      this.bindings.bumper.position.set(
        this.baseBumperLocalPos.x + this.permanentDentOffset.x + this.bumperCurrentOffset.x,
        this.baseBumperLocalPos.y + this.permanentDentOffset.y * 0.4,
        this.baseBumperLocalPos.z + this.permanentDentOffset.z + this.bumperCurrentOffset.z
      );

      // Crumpled bumper rotation
      this.bindings.bumper.rotation.set(
        this.dentPitch * 1.2,
        this.dentYaw * 1.1,
        this.dentRoll * 1.2
      );

      // Physical squashing of the bumper oval
      this.bindings.bumper.scale.set(
        this.baseBumperScale.x * (1.0 + Math.abs(this.permanentDentOffset.x) * 0.35),
        this.baseBumperScale.y * (1.0 - this.damageRatio * 0.16),
        this.baseBumperScale.z * (1.0 - Math.abs(this.permanentDentOffset.z) * 0.5)
      );

      animState.bumperOffset.copy(this.bumperCurrentOffset);
    }

    // 3. Body Sag, List, and Crumple Deformation
    if (this.bindings.body) {
      // Sagging frame / bent suspension
      this.bindings.body.position.set(
        this.baseBodyLocalPos.x + this.permanentDentOffset.x * 0.25,
        this.baseBodyLocalPos.y - this.damageRatio * 0.08,
        this.baseBodyLocalPos.z + this.permanentDentOffset.z * 0.25
      );

      // Damaged chassis list & rattle
      const engineRattle = this.damageRatio > 0.4 ? Math.sin(performance.now() * 0.025) * 0.012 * this.damageRatio : 0;
      this.bindings.body.rotation.set(
        this.baseBodyRotation.x + this.dentPitch * 0.65,
        this.baseBodyRotation.y + this.dentYaw * 0.45,
        this.baseBodyRotation.z + this.dentRoll * 0.75 + engineRattle
      );
    }

    // 4. Crooked Bent Antenna
    if (this.bindings.antenna) {
      this.bindings.antenna.rotation.set(
        this.baseAntennaRotation.x - this.damageRatio * 0.48 + this.dentPitch * 0.8,
        this.baseAntennaRotation.y,
        this.baseAntennaRotation.z + this.dentRoll * 1.6 + this.damageRatio * 0.32
      );

      if (this.bindings.contactHead) {
        this.bindings.contactHead.rotation.x = this.damageRatio * 0.6;
        this.bindings.contactHead.rotation.z = -this.damageRatio * 0.45;
      }
    }

    // 5. Driver Mascot Crooked Tilt
    if (this.driverNode) {
      this.driverNode.rotation.set(
        this.baseDriverRotation.x + this.dentPitch * 1.1,
        this.baseDriverRotation.y,
        this.baseDriverRotation.z + this.dentRoll * 1.5
      );
    }

    // 6. Update Lighting States with Electrical Damage Glitches & Elimination
    if (this.isEliminated) {
      if (this.bindings.tailLightL) this.setEmissiveIntensity(this.bindings.tailLightL, 0);
      if (this.bindings.tailLightR) this.setEmissiveIntensity(this.bindings.tailLightR, 0);
      if (this.bindings.headlightL) this.setEmissiveIntensity(this.bindings.headlightL, 0);
      if (this.bindings.headlightR) this.setEmissiveIntensity(this.bindings.headlightR, 0);
      if (this.underglowLight) this.underglowLight.intensity = 0;
    } else {
      if (this.bindings.tailLightL && this.bindings.tailLightR) {
        let brakeIntensity = isBraking ? 5.0 : (isBoosting ? 3.0 : 1.2);
        if (this.isCriticalBag) {
          // Warning red pulse on tail lights
          brakeIntensity = 2.0 + Math.sin(performance.now() * 0.015) * 1.8;
        }
        this.setEmissiveIntensity(this.bindings.tailLightL, brakeIntensity);
        this.setEmissiveIntensity(this.bindings.tailLightR, brakeIntensity);
      }

      // Headlights Damage State (Flickering / Smashed out / Critical Sputter)
      if (this.bindings.headlightL && this.bindings.headlightR) {
        const baseHeadlight = isBoosting ? 4.0 : 2.5;

        let leftIntensity = baseHeadlight;
        let rightIntensity = baseHeadlight;

        if (this.isCriticalBag) {
          // Both headlights glitch heavily in critical bag state
          leftIntensity = Math.random() > 0.4 ? baseHeadlight * (0.2 + Math.random() * 0.8) : 0.0;
          rightIntensity = Math.random() > 0.3 ? baseHeadlight * (0.3 + Math.random() * 0.7) : 0.0;
        } else if (this.damageRatio >= 0.70) {
          // Left headlight completely smashed and dead
          leftIntensity = 0.0;
          // Right headlight flickers with electrical glitches
          rightIntensity = Math.random() > 0.25 ? baseHeadlight * (0.4 + Math.random() * 0.6) : 0.0;
        } else if (this.damageRatio >= 0.35) {
          // Left headlight flickers intermittently
          leftIntensity = Math.random() > 0.15 ? baseHeadlight : baseHeadlight * 0.15;
        }

        this.setEmissiveIntensity(this.bindings.headlightL, leftIntensity);
        this.setEmissiveIntensity(this.bindings.headlightR, rightIntensity);
      }

      // Underglow Damage & Critical Bag Warning Pulse
      if (this.underglowLight) {
        if (this.isCriticalBag) {
          const alertPulse = 0.5 + Math.sin(performance.now() * 0.012) * 0.5;
          this.underglowLight.color.setHex(0xff0033);
          this.underglowLight.intensity = this.baseUnderglowIntensity * (0.6 + alertPulse * 1.4);
        } else if (this.damageRatio > 0.5) {
          const glitch = Math.random() > 0.18 ? (1.0 - this.damageRatio * 0.7) : 0.0;
          this.underglowLight.intensity = this.baseUnderglowIntensity * glitch;
        } else {
          this.underglowLight.intensity = this.baseUnderglowIntensity;
        }
      }
    }

    // 7. Update 3D Bounty Crown Halo (Suspended above antenna mast, 0 floor clutter)
    const time = performance.now() * 0.001;

    if (this.bountyCrownGroup && this.bountyCrownGroup.visible) {
      this.bountyCrownGroup.rotation.y += 2.4 * dt;
      this.bountyCrownGroup.position.y = 2.05 + Math.sin(time * 4.0) * 0.08;
      const pulse = 1.0 + Math.sin(time * 8.0) * 0.06;
      this.bountyCrownGroup.scale.set(pulse, pulse, pulse);
    }

    // 8. Body-Contour Power-Up Aura System ("mobilnya berlumur aura mengikuti shape mobilnya")
    if (this.activePowerUpType) {
      this.powerUpPulseTimer += dt;
      const pTime = this.powerUpPulseTimer;

      let auraColorHex = 0x00e5ff;
      let pulseIntensity = 0.55;

      if (this.activePowerUpType === 'TURBO') {
        auraColorHex = 0x00e5ff;
        pulseIntensity = 0.55 + Math.sin(pTime * 14.0) * 0.40;
      } else if (this.activePowerUpType === 'TITAN' || this.activePowerUpType === 'HEAVY_HIT') {
        auraColorHex = 0xff6600;
        pulseIntensity = 0.70 + Math.sin(pTime * 9.0) * 0.45;
      } else if (this.activePowerUpType === 'SHIELD') {
        auraColorHex = 0x00ff88;
        pulseIntensity = 0.60 + Math.sin(pTime * 7.5) * 0.35;
      } else if (this.activePowerUpType === 'CASH_MAGNET') {
        auraColorHex = 0xbd00ff;
        pulseIntensity = 0.55 + Math.sin(pTime * 10.0) * 0.35;
      }

      // Contour glow directly infused on the car body panels
      for (const item of this.paintMaterials) {
        item.material.emissive.setHex(auraColorHex);
        item.material.emissiveIntensity = pulseIntensity;
      }

      // Cast real colored lighting on the arena floor beneath the car without any flat decal discs
      if (this.underglowLight) {
        this.underglowLight.color.setHex(auraColorHex);
        this.underglowLight.intensity = this.baseUnderglowIntensity * (1.8 + pulseIntensity * 1.2);
      }
    } else if (this.bountyTier !== 'NORMAL') {
      // Subtle bounty shimmer directly on car body panels
      const bTime = performance.now() * 0.001;
      let bHex = 0x000000;
      let bIntensity = 0;
      if (this.bountyTier === 'BOUNTY') {
        bHex = 0xffd700;
        bIntensity = 0.32 + Math.sin(bTime * 6.0) * 0.20;
      } else if (this.bountyTier === 'BIG_BAG') {
        bHex = 0xffd700;
        bIntensity = 0.20 + Math.sin(bTime * 4.5) * 0.12;
      } else if (this.bountyTier === 'HOT') {
        bHex = 0xff6600;
        bIntensity = 0.16 + Math.sin(bTime * 4.0) * 0.10;
      }

      for (const item of this.paintMaterials) {
        item.material.emissive.setHex(bHex);
        item.material.emissiveIntensity = bIntensity;
      }
      if (this.underglowLight) {
        this.underglowLight.color.setHex(bHex);
        this.underglowLight.intensity = this.baseUnderglowIntensity * 1.5;
      }
    } else {
      // Return to clean factory paint
      for (const item of this.paintMaterials) {
        if (item.material.emissiveIntensity > item.baseEmissiveIntensity) {
          item.material.emissive.copy(item.baseEmissive);
          item.material.emissiveIntensity = item.baseEmissiveIntensity;
        }
      }
    }
  }

  public setBountyTier(tier: 'NORMAL' | 'HOT' | 'BIG_BAG' | 'BOUNTY'): void {
    this.bountyTier = tier;

    if (this.bountyCrownGroup) {
      this.bountyCrownGroup.visible = tier === 'BOUNTY';
    }
  }

  private setEmissiveIntensity(node: THREE.Object3D, intensity: number): void {
    node.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          mat.emissiveIntensity = intensity;
        }
      }
    });
  }

  /**
   * Restores vehicle to showroom factory-new condition.
   */
  public resetDamage(): void {
    this.damageRatio = 0.0;
    this.permanentDentOffset.set(0, 0, 0);
    this.dentRoll = 0;
    this.dentPitch = 0;
    this.dentYaw = 0;
    this.bumperCurrentOffset.set(0, 0, 0);
    this.bumperVelocity.set(0, 0, 0);

    if (this.bindings.bumper) {
      this.bindings.bumper.position.copy(this.baseBumperLocalPos);
      this.bindings.bumper.rotation.set(0, 0, 0);
      this.bindings.bumper.scale.copy(this.baseBumperScale);
    }

    if (this.bindings.body) {
      this.bindings.body.position.copy(this.baseBodyLocalPos);
      this.bindings.body.rotation.copy(this.baseBodyRotation);
    }

    if (this.bindings.antenna) {
      this.bindings.antenna.rotation.copy(this.baseAntennaRotation);
      if (this.bindings.contactHead) {
        this.bindings.contactHead.rotation.set(0, 0, 0);
      }
    }

    if (this.driverNode) {
      this.driverNode.rotation.copy(this.baseDriverRotation);
    }

    // Restore original factory paint materials
    for (const item of this.paintMaterials) {
      item.material.roughness = item.baseRoughness;
      item.material.metalness = item.baseMetalness;
      item.material.color.copy(item.baseColor);
      item.material.emissive.copy(item.baseEmissive);
      item.material.emissiveIntensity = item.baseEmissiveIntensity;
    }

    if (this.underglowLight) {
      this.underglowLight.intensity = this.baseUnderglowIntensity;
    }
  }

  /**
   * Updates dynamic rear MoneyDisplay LED scoreboard texture.
   */
  public updateMoneyDisplay(amount: number, textColor?: string): void {
    if (!this.bindings.moneyDisplay) return;

    this.bindings.moneyDisplay.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material as any;
        if (mat) {
          let cvs: HTMLCanvasElement | null = null;
          if (mat.map && mat.map.image && typeof mat.map.image.getContext === 'function') {
            cvs = mat.map.image as HTMLCanvasElement;
          } else {
            // Convert to a CanvasTexture if it was a loaded static image texture
            cvs = document.createElement('canvas');
            cvs.width = 512;
            cvs.height = 256;
            const canvasTex = new THREE.CanvasTexture(cvs);
            mat.map = canvasTex;
            if (mat.emissiveMap !== undefined) {
              mat.emissiveMap = canvasTex;
            }
          }

          if (cvs && typeof cvs.getContext === 'function') {
            const ctx = cvs.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#060a08';
              ctx.fillRect(0, 0, cvs.width, cvs.height);
              // Glowing neon border
              ctx.strokeStyle = '#00ff6a';
              ctx.lineWidth = 6;
              ctx.strokeRect(6, 6, cvs.width - 12, cvs.height - 12);
              // Cash value text
              ctx.fillStyle = textColor || '#00ff88';
              ctx.font = 'bold 84px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(`$${Math.max(0, Math.round(amount))}`, cvs.width / 2, cvs.height / 2);
              if (mat.map) mat.map.needsUpdate = true;
              if (mat.emissiveMap) mat.emissiveMap.needsUpdate = true;
              mat.needsUpdate = true;
            }
          }
        }
      }
    });
  }
}
