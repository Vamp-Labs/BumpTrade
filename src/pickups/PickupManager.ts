import * as THREE from 'three';
import { PICKUP_CONFIG } from '../core/Config';
import { HeroCar } from '../vehicles/HeroCar';
import { EventBus } from '../core/EventBus';
import { SoundManager } from '../audio/SoundManager';

export interface PickupItem {
  mesh: THREE.Object3D;
  value: number;
  type: 'coin' | 'silver' | 'dollar' | 'bundle' | 'bill';
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  isSettled: boolean;
  age: number;
  rotSpeed: number;
  rotAxis: THREE.Vector3;
  // Absorption curve properties
  isAbsorbing?: boolean;
  absorbTarget?: HeroCar;
  absorbStartPos?: THREE.Vector3;
  absorbControlPos?: THREE.Vector3;
  absorbProgress?: number;
  absorbDuration?: number;
}

export class PickupManager {
  private scene: THREE.Scene;
  private pickups: PickupItem[] = [];

  // Geometries and materials
  private coinGeo: THREE.CylinderGeometry;
  private bundleGeo: THREE.BoxGeometry;
  private billGeo: THREE.BoxGeometry;

  private goldMat: THREE.MeshStandardMaterial;
  private silverMat: THREE.MeshStandardMaterial;
  private dollarMat: THREE.MeshStandardMaterial;
  private cashMat: THREE.MeshStandardMaterial;
  private billMat: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Coin geometry (disc)
    this.coinGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.05, 16);
    this.coinGeo.rotateX(Math.PI / 2);

    // Cash bundle geometry
    this.bundleGeo = new THREE.BoxGeometry(0.38, 0.12, 0.24);

    // Cash bill geometry (thin fluttering bill)
    this.billGeo = new THREE.BoxGeometry(0.52, 0.012, 0.26);

    // Bill texture generated via Canvas
    const billTexture = this.generateBillTexture();

    // Materials
    this.goldMat = new THREE.MeshStandardMaterial({
      color: 0xffb800,
      metalness: 0.95,
      roughness: 0.18,
      emissive: 0xffaa00,
      emissiveIntensity: 0.6,
    });

    this.silverMat = new THREE.MeshStandardMaterial({
      color: 0xe0e6ed,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x88bbff,
      emissiveIntensity: 0.4,
    });

    this.dollarMat = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x00ff88,
      emissiveIntensity: 0.8,
    });

    this.cashMat = new THREE.MeshStandardMaterial({
      color: 0x1a8c42,
      metalness: 0.2,
      roughness: 0.6,
      emissive: 0x00ff66,
      emissiveIntensity: 0.4,
    });

    this.billMat = new THREE.MeshStandardMaterial({
      map: billTexture,
      color: 0x00ff88,
      emissive: 0x00aa55,
      emissiveIntensity: 0.45,
      roughness: 0.4,
      metalness: 0.15,
    });
  }

  private generateBillTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // Background dark green
      ctx.fillStyle = '#082a17';
      ctx.fillRect(0, 0, 256, 128);

      // Neon green double border
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 6;
      ctx.strokeRect(6, 6, 244, 116);
      ctx.lineWidth = 2;
      ctx.strokeRect(14, 14, 228, 100);

      // Corner numerals
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('$100', 20, 36);
      ctx.fillText('$100', 188, 108);

      // Central crest circle
      ctx.beginPath();
      ctx.arc(128, 64, 38, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Big center dollar sign
      ctx.font = 'bold 52px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 128, 64);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Spawns scattering physical cash bills and coins from a vehicle collision.
   * Bursts outward with directional momentum from the impact normal.
   */
  public spawnScatter(position: THREE.Vector3, totalAmount: number, impactNormal?: THREE.Vector3): void {
    if (totalAmount <= 0) return;
    SoundManager.get().playCashScatter();

    // Partition totalAmount into integer parts whose sum strictly equals totalAmount
    const itemCount = Math.min(Math.max(Math.floor(totalAmount / 4), 1), Math.min(totalAmount, 10));
    const baseValue = Math.floor(totalAmount / itemCount);
    let remainder = totalAmount % itemCount;

    const norm = impactNormal ? impactNormal.clone().normalize() : new THREE.Vector3(0, 0, 0);

    for (let i = 0; i < itemCount; i++) {
      const itemValue = baseValue + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;

      // Radial spread around impact normal
      const angle = (i / itemCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
      const speed = PICKUP_CONFIG.scatterMinSpeed + Math.random() * (PICKUP_CONFIG.scatterMaxSpeed - PICKUP_CONFIG.scatterMinSpeed);

      // Directional momentum outward from impact point
      const directionalBias = 4.5;
      const vx = Math.cos(angle) * (speed * 0.7) + norm.x * directionalBias;
      const vz = Math.sin(angle) * (speed * 0.7) + norm.z * directionalBias;
      const vy = 5.0 + Math.random() * 4.5; // Upward explosive pop

      // Determine item type: high-value uses bundles or fluttering bills
      let type: 'coin' | 'silver' | 'dollar' | 'bundle' | 'bill';
      if (itemValue >= 25) {
        type = 'bundle';
      } else if (i % 2 === 0 || itemValue >= 12) {
        type = 'bill'; // Physical cash bills
      } else if (itemValue >= 6) {
        type = 'dollar';
      } else {
        type = 'coin';
      }

      this.createPickupItem(
        type,
        itemValue,
        position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.45, (Math.random() - 0.5) * 0.3)),
        new THREE.Vector3(vx, vy, vz),
        false
      );
    }
  }

  /**
   * Spawns a stationary spinning pickup at arena coordinates.
   * STRICT ZERO-SUM ECONOMY (Rule #1 & #29): Disallowed in competitive matches.
   */
  public spawnArenaPickup(_x: number, _z: number, _value: number = 10): void {
    // Strictly no unbacked cash spawning per Rule #1 & #29
  }

  private createPickupItem(
    type: 'coin' | 'silver' | 'dollar' | 'bundle' | 'bill',
    value: number,
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    isSettled: boolean = false
  ): void {
    let mesh: THREE.Mesh;
    if (type === 'bundle') {
      mesh = new THREE.Mesh(this.bundleGeo, this.cashMat);
    } else if (type === 'bill') {
      mesh = new THREE.Mesh(this.billGeo, this.billMat);
    } else if (type === 'dollar') {
      mesh = new THREE.Mesh(this.coinGeo, this.dollarMat);
    } else if (type === 'silver') {
      mesh = new THREE.Mesh(this.coinGeo, this.silverMat);
    } else {
      mesh = new THREE.Mesh(this.coinGeo, this.goldMat);
    }

    mesh.position.copy(pos);
    mesh.castShadow = true;
    this.scene.add(mesh);

    // Random tumble axis for fluttering bills
    const rotAxis = new THREE.Vector3(
      type === 'bill' ? (Math.random() - 0.5) : 0,
      1.0,
      type === 'bill' ? (Math.random() - 0.5) : 0
    ).normalize();

    this.pickups.push({
      mesh,
      value,
      type,
      position: pos,
      velocity: vel,
      isSettled,
      age: 0,
      rotSpeed: type === 'bill' ? 5.5 + Math.random() * 3.0 : 3.5 + Math.random() * 2.0,
      rotAxis,
    });
  }

  public update(dt: number, cars: HeroCar[]): void {
    const targetY = PICKUP_CONFIG.coinHoverHeight;
    const gravity = 18.0;

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;

      // 1. Handle Smooth Absorption Curve toward Vehicle
      if (p.isAbsorbing && p.absorbTarget && p.absorbStartPos && p.absorbControlPos) {
        p.absorbProgress = (p.absorbProgress ?? 0) + dt / (p.absorbDuration ?? 0.18);
        const t = Math.min(1.0, p.absorbProgress);

        const targetCarPos = p.absorbTarget.controller.getPhysicsState().position.clone().add(new THREE.Vector3(0, 0.45, 0));

        // Smooth quadratic bezier curve
        // B(t) = (1-t)^2 * P0 + 2(1-t)t * PControl + t^2 * PTarget
        const oneMinusT = 1.0 - t;
        const p0 = p.absorbStartPos;
        const p1 = p.absorbControlPos;
        const p2 = targetCarPos;

        p.position.set(
          oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
          oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
          oneMinusT * oneMinusT * p0.z + 2 * oneMinusT * t * p1.z + t * t * p2.z
        );

        p.mesh.position.copy(p.position);

        // Rapid spin and shrink into vehicle
        p.mesh.rotation.y += 18.0 * dt;
        const shrinkScale = Math.max(0.1, 1.0 - t * 0.85);
        p.mesh.scale.setScalar(shrinkScale);

        if (t >= 1.0) {
          // Completed visual absorption: play chime, sparkle glow, and remove particle
          // (Balance was already transferred zero-sum at moment of impact)
          SoundManager.get().playCashPickup(p.value);

          EventBus.get().emit('money_collected', {
            carId: p.absorbTarget.id,
            amount: p.value,
            position: p.position.clone(),
          });

          this.playPickupGlow(targetCarPos);

          this.scene.remove(p.mesh);
          this.pickups.splice(i, 1);
        }
        continue;
      }

      // Despawn old uncollected pickups
      if (p.age > PICKUP_CONFIG.lifetime) {
        this.scene.remove(p.mesh);
        this.pickups.splice(i, 1);
        continue;
      }

      // Ballistic motion for scattered items
      if (!p.isSettled) {
        p.position.x += p.velocity.x * dt;
        p.position.z += p.velocity.z * dt;
        p.position.y += p.velocity.y * dt;
        p.velocity.y -= gravity * dt;

        // Ground bounce & air friction
        if (p.position.y <= targetY) {
          p.position.y = targetY;
          p.velocity.y = -p.velocity.y * 0.42; // Damped bounce
          p.velocity.x *= 0.62;
          p.velocity.z *= 0.62;

          if (Math.abs(p.velocity.y) < 0.5) {
            p.isSettled = true;
            p.velocity.set(0, 0, 0);
          }
        }

        // Tumble rotation in flight
        if (p.type === 'bill') {
          p.mesh.rotateOnAxis(p.rotAxis, p.rotSpeed * dt * 1.6);
        } else {
          p.mesh.rotation.y += p.rotSpeed * dt;
        }
      } else {
        // Subtle floating bob
        p.position.y = targetY + Math.sin(p.age * 4.0) * 0.05;
        p.mesh.rotation.y += p.rotSpeed * dt;
      }

      p.mesh.position.copy(p.position);

      // Check proximity with vehicles
      for (const car of cars) {
        const carPos = car.controller.getPhysicsState().position;
        const dist = carPos.distanceTo(p.position);

        // Magnetic Attraction (multiplied by CASH_MAGNET power-up: 3x distance & higher pull speed)
        const magnetMult = car.controller.getMagnetRadiusMultiplier();
        const effectiveMagnetDist = PICKUP_CONFIG.magnetDistance * magnetMult;

        if (dist < effectiveMagnetDist && p.isSettled) {
          const pullDir = new THREE.Vector3().subVectors(carPos, p.position).normalize();
          const pullSpeed = (1.0 - dist / effectiveMagnetDist) * (15.0 * magnetMult);
          p.position.addScaledVector(pullDir, pullSpeed * dt);
        }

        // Start Smooth Absorption Curve when touching pickup radius
        if (dist < PICKUP_CONFIG.pickupRadius) {
          p.isAbsorbing = true;
          p.absorbTarget = car;
          p.absorbStartPos = p.position.clone();
          p.absorbControlPos = p.position.clone().add(new THREE.Vector3(0, 1.2 + Math.random() * 0.6, 0));
          p.absorbProgress = 0;
          p.absorbDuration = 0.18; // 180ms smooth suction curve
          break;
        }
      }
    }
  }

  private playPickupGlow(position: THREE.Vector3): void {
    const flashGeo = new THREE.SphereGeometry(0.38, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0x00ff88,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flash = new THREE.Mesh(flashGeo, flashMat);
    flash.position.copy(position);
    this.scene.add(flash);

    let t = 0;
    const interval = setInterval(() => {
      t += 0.035;
      flash.scale.multiplyScalar(1.22);
      flashMat.opacity -= 0.16;
      if (flashMat.opacity <= 0 || t > 0.25) {
        clearInterval(interval);
        this.scene.remove(flash);
        flashGeo.dispose();
        flashMat.dispose();
      }
    }, 16);
  }

  public getPickupCount(): number {
    return this.pickups.length;
  }
}
