import * as THREE from 'three';
import { VOID_CONFIG } from '../core/Config';
import { HeroCar } from '../vehicles/HeroCar';
import { EventBus } from '../core/EventBus';

export class MarginVoidPits {
  public readonly group: THREE.Group = new THREE.Group();

  private pitLights: THREE.PointLight[] = [];
  private hazardBarMaterials: THREE.MeshStandardMaterial[] = [];
  private animTime: number = 0;

  constructor() {
    this.buildLiquidationPits();
  }

  private createCautionStripeTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // High contrast black and hazard yellow diagonal stripes
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(0, 0, 512, 64);

    ctx.fillStyle = '#11141c';
    const stripeWidth = 32;
    for (let x = -64; x < 576; x += stripeWidth * 2) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + stripeWidth, 0);
      ctx.lineTo(x + stripeWidth + 64, 64);
      ctx.lineTo(x + 64, 64);
      ctx.closePath();
      ctx.fill();
    }

    // Top and bottom thin safety red border lines
    ctx.fillStyle = '#ff0044';
    ctx.fillRect(0, 0, 512, 4);
    ctx.fillRect(0, 60, 512, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(16, 1);
    tex.needsUpdate = true;
    return tex;
  }

  private createMarginVoidSignTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, 512, 128);

    // Hazard border
    ctx.strokeStyle = '#ff0033';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 500, 116);

    // Glowing red text
    ctx.textAlign = 'center';
    ctx.font = '900 48px monospace';
    ctx.fillStyle = '#ff1744';
    ctx.fillText('MARGIN VOID', 256, 58);

    ctx.font = '700 20px monospace';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('⚠ 100% LIQUIDATION PIT ⚠', 256, 96);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  private buildLiquidationPits(): void {
    const r = VOID_CONFIG.radius; // 3.8m
    const d = VOID_CONFIG.depth; // 6.0m

    const cautionTex = this.createCautionStripeTexture();
    const cautionMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.3,
      map: cautionTex,
      side: THREE.DoubleSide,
    });

    const pitWallMat = new THREE.MeshStandardMaterial({
      color: 0x121722,
      roughness: 0.7,
      metalness: 0.6,
      side: THREE.DoubleSide, // Visible from inside the pit
    });

    const redRimMat = new THREE.MeshStandardMaterial({
      color: 0xff0044,
      emissive: 0xff0033,
      emissiveIntensity: 2.8,
      roughness: 0.2,
    });

    const abyssMat = new THREE.MeshStandardMaterial({
      color: 0x05070c,
      emissive: 0xff0022,
      emissiveIntensity: 1.2,
      roughness: 0.9,
    });

    const signTex = this.createMarginVoidSignTexture();
    const signMat = new THREE.MeshBasicMaterial({
      map: signTex,
      side: THREE.DoubleSide,
    });

    for (const loc of VOID_CONFIG.locations) {
      const pitGroup = new THREE.Group();
      pitGroup.position.set(loc.x, 0, loc.z);

      // 1. HOLLOW Outer Lip Raised Ring with Caution Stripes (Hollow, open center!)
      const ringLipGeo = new THREE.RingGeometry(r, r + 0.55, 36);
      ringLipGeo.rotateX(-Math.PI / 2);
      const ringLip = new THREE.Mesh(ringLipGeo, cautionMat);
      ringLip.position.y = 0.08;
      ringLip.receiveShadow = true;
      pitGroup.add(ringLip);

      // Sloped outer skirt collar (beveled down to floor)
      const skirtGeo = new THREE.CylinderGeometry(r + 0.55, r + 0.75, 0.08, 36, 1, true);
      const skirt = new THREE.Mesh(skirtGeo, pitWallMat);
      skirt.position.y = 0.04;
      pitGroup.add(skirt);

      // 2. Glowing Red Inner Lip Ring
      const ringGeo = new THREE.TorusGeometry(r + 0.04, 0.07, 12, 36);
      ringGeo.rotateX(Math.PI / 2);
      const ringMesh = new THREE.Mesh(ringGeo, redRimMat);
      ringMesh.position.y = 0.12;
      pitGroup.add(ringMesh);

      // 3. Recessed Pit Wall Cylinder descending 6m down (openEnded = true)
      const wallGeo = new THREE.CylinderGeometry(r, r * 0.92, d, 36, 4, true);
      const wallMesh = new THREE.Mesh(wallGeo, pitWallMat);
      wallMesh.position.y = -d * 0.5;
      pitGroup.add(wallMesh);

      // 4. Vertical Red Hazard Light Bars (8 bars evenly spaced around the inner wall)
      const barCount = 8;
      const hazardBarMat = new THREE.MeshStandardMaterial({
        color: 0xff0033,
        emissive: 0xff0033,
        emissiveIntensity: 3.5,
        roughness: 0.2,
      });
      this.hazardBarMaterials.push(hazardBarMat);

      for (let i = 0; i < barCount; i++) {
        const angle = (i / barCount) * Math.PI * 2;
        const barR = r * 0.94;
        const bx = Math.cos(angle) * barR;
        const bz = Math.sin(angle) * barR;

        // Metal conduit backing
        const backingGeo = new THREE.BoxGeometry(0.14, d * 0.75, 0.06);
        const backing = new THREE.Mesh(backingGeo, pitWallMat);
        backing.position.set(bx, -d * 0.45, bz);
        backing.rotation.y = -angle + Math.PI / 2;
        pitGroup.add(backing);

        // Glowing red LED tube
        const tubeGeo = new THREE.CylinderGeometry(0.04, 0.04, d * 0.72, 8);
        const tube = new THREE.Mesh(tubeGeo, hazardBarMat);
        tube.position.set(bx * 0.97, -d * 0.45, bz * 0.97);
        pitGroup.add(tube);
      }

      // 5. Illuminated 3D "MARGIN VOID" Signboard on Pit Wall (Facing center of arena)
      const toCenterAngle = Math.atan2(-loc.z, -loc.x);
      const signAngle = toCenterAngle + Math.PI; // On the outer wall facing inwards
      const signX = Math.cos(signAngle) * (r * 0.88);
      const signZ = Math.sin(signAngle) * (r * 0.88);

      const signGeo = new THREE.PlaneGeometry(3.2, 0.85);
      const signMesh = new THREE.Mesh(signGeo, signMat);
      signMesh.position.set(signX, -1.8, signZ);
      signMesh.rotation.y = -signAngle + Math.PI / 2;
      pitGroup.add(signMesh);

      // 6. Deep Abyss Floor Plane with Red Underglow
      const floorGeo = new THREE.CircleGeometry(r * 0.9, 24);
      floorGeo.rotateX(-Math.PI / 2);
      const abyssMesh = new THREE.Mesh(floorGeo, abyssMat);
      abyssMesh.position.y = -d + 0.15;
      pitGroup.add(abyssMesh);

      // 7. Pulsing Red Hazard PointLight
      const pitLight = new THREE.PointLight(0xff0033, 4.2, 12.0);
      pitLight.position.set(0, -2.2, 0);
      pitGroup.add(pitLight);
      this.pitLights.push(pitLight);

      this.group.add(pitGroup);
    }
  }

  public update(dt: number): void {
    this.animTime += dt;
    // Ominous hazard pulsing (sine wave)
    const pulse = 1.0 + Math.sin(this.animTime * 3.5) * 0.35;
    for (const light of this.pitLights) {
      light.intensity = 4.2 * pulse;
    }
    for (const mat of this.hazardBarMaterials) {
      mat.emissiveIntensity = 3.5 * pulse;
    }
  }

  /**
   * Checks if any vehicle has entered the Margin Void liquidation pit zones.
   */
  public checkVoidHazards(cars: HeroCar[]): void {
    for (const car of cars) {
      if (car.controller.isEliminated()) continue;
      const pos = car.controller.getPhysicsState().position;

      for (const loc of VOID_CONFIG.locations) {
        const dx = pos.x - loc.x;
        const dz = pos.z - loc.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < VOID_CONFIG.radius * VOID_CONFIG.radius) {
          // Inside Margin Void!
          if (pos.y < VOID_CONFIG.triggerY) {
            // Trigger liquidation sequence!
            const respawnX = loc.x > 0 ? 6.0 : -6.0;
            const respawnZ = loc.z > 0 ? 6.0 : -6.0;
            car.controller.triggerFall(new THREE.Vector3(respawnX, 0.4, respawnZ));

            EventBus.get().emit('vehicle_liquidated', {
              carId: car.id,
              pitLocation: loc,
            });
            break;
          }
        }
      }
    }
  }
}
