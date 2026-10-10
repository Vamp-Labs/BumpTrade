import * as THREE from 'three';
import { CarNodeBindings, CarPhysicsState } from './CarTypes';
import { PowerUpType } from '../pickups/PowerUpTypes';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class CarVFX {
  private scene: THREE.Scene;
  private bindings: CarNodeBindings;
  private isBoosting: boolean = false;
  private activePowerUpType: PowerUpType | null = null;

  // Particle pool for performance
  private particles: Particle[] = [];
  private particleGeometry: THREE.BufferGeometry;
  private particleMaterial: THREE.PointsMaterial;
  private particlePoints: THREE.Points;
  private maxParticles = 600;

  // Pre-allocated attribute buffers
  private positions: Float32Array;
  private colors: Float32Array;

  // Boost thruster meshes
  private boostCones: THREE.Mesh[] = [];

  // Elimination wreck state
  private isWrecked: boolean = false;

  constructor(scene: THREE.Scene, bindings: CarNodeBindings) {
    this.scene = scene;
    this.bindings = bindings;

    // Setup points particle system
    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);

    this.particleGeometry = new THREE.BufferGeometry();
    this.particleGeometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.particleGeometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial);
    this.scene.add(this.particlePoints);

    // Setup Boost Thruster Visuals on VFX_Boost node
    this.setupBoostMeshes();
  }

  private setupBoostMeshes(): void {
    if (!this.bindings.vfxBoost) return;

    const coneGeo = new THREE.ConeGeometry(0.12, 0.75, 12);
    coneGeo.rotateX(-Math.PI / 2); // Point backward (-Z)
    coneGeo.translate(0, 0, -0.38);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
    });

    const coneL = new THREE.Mesh(coneGeo, flameMat);
    coneL.position.x = -0.22;
    const coneR = new THREE.Mesh(coneGeo, flameMat);
    coneR.position.x = 0.22;

    this.bindings.vfxBoost.add(coneL, coneR);
    this.boostCones.push(coneL, coneR);
  }

  public playBoost(): void {
    this.isBoosting = true;
    for (const cone of this.boostCones) {
      (cone.material as THREE.MeshBasicMaterial).opacity = 0.9;
    }
  }

  public stopBoost(): void {
    this.isBoosting = false;
    for (const cone of this.boostCones) {
      (cone.material as THREE.MeshBasicMaterial).opacity = 0.0;
    }
  }

  public setPowerUpType(type: PowerUpType | null): void {
    this.activePowerUpType = type;
    if (type === 'TURBO') {
      this.playBoost();
    }
  }

  public playImpactSpark(position: THREE.Vector3, intensity: number, normal?: THREE.Vector3): void {
    const count = Math.floor(20 + intensity * 45);
    const norm = normal ? normal.clone().normalize() : new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;

      const speed = 5.0 + Math.random() * 11.0 * intensity;
      // Directional cone burst along contact normal + random dispersion
      const spread = 0.65;
      const velocity = new THREE.Vector3(
        norm.x + (Math.random() - 0.5) * spread * 2.0,
        Math.max(0.2, norm.y + Math.random() * spread + 0.3),
        norm.z + (Math.random() - 0.5) * spread * 2.0
      ).normalize().multiplyScalar(speed);

      // Gold to neon cyan/magenta electric sparks
      const color = intensity > 0.6
        ? (Math.random() > 0.35 ? new THREE.Color(1.0, 0.15, 0.35) : new THREE.Color(1.0, 0.9, 0.2)) // Critical red/gold
        : (Math.random() > 0.4 ? new THREE.Color(1.0, 0.85, 0.15) : new THREE.Color(0.2, 0.9, 1.0)); // Warm gold/cyan

      this.particles.push({
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25,
          (Math.random() - 0.5) * 0.25
        )),
        velocity,
        color,
        size: 0.3 + Math.random() * 0.25,
        alpha: 1.0,
        life: 0,
        maxLife: 0.22 + Math.random() * 0.32,
      });
    }
  }

  public playImpactFlash(position: THREE.Vector3, intensity: number, normal?: THREE.Vector3): void {
    // 1. Instant spherical volumetric flash
    const flashRadius = 0.4 + intensity * 1.0;
    const flashGeo = new THREE.SphereGeometry(flashRadius, 10, 10);
    const flashColor = intensity > 0.6 ? 0xff0055 : 0x00ffff;
    const flashMat = new THREE.MeshBasicMaterial({
      color: flashColor,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const flashMesh = new THREE.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(position);
    this.scene.add(flashMesh);

    // 2. Directional contact flash ring/disc aligned with contact normal
    let discMesh: THREE.Mesh | undefined;
    if (normal) {
      const discGeo = new THREE.RingGeometry(0.05, flashRadius * 1.35, 16);
      const discMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.position.copy(position);
      discMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
      this.scene.add(discMesh);
    }

    // Fade and destroy
    let t = 0;
    const interval = setInterval(() => {
      t += 0.035;
      flashMesh.scale.multiplyScalar(1.22);
      flashMat.opacity -= 0.18;

      if (discMesh) {
        discMesh.scale.multiplyScalar(1.18);
        (discMesh.material as THREE.MeshBasicMaterial).opacity -= 0.18;
      }

      if (flashMat.opacity <= 0 || t > 0.25) {
        clearInterval(interval);
        this.scene.remove(flashMesh);
        flashGeo.dispose();
        flashMat.dispose();

        if (discMesh) {
          this.scene.remove(discMesh);
          discMesh.geometry.dispose();
          (discMesh.material as THREE.Material).dispose();
        }
      }
    }, 16);
  }

  public playTireSkid(position: THREE.Vector3, intensity: number): void {
    if (this.particles.length >= this.maxParticles) return;
    this.particles.push({
      position: position.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        Math.random() * 0.6 + 0.2,
        (Math.random() - 0.5) * 0.4
      ),
      color: new THREE.Color(0.6, 0.7, 0.8),
      size: 0.3 + intensity * 0.2,
      alpha: 0.5,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.3,
    });
  }

  private emitDamageSmokeAndSparks(physicsState: CarPhysicsState, damageRatio: number): void {
    // Engine bay location at front hood
    const hoodPos = physicsState.position.clone()
      .addScaledVector(physicsState.forward, 0.75)
      .add(new THREE.Vector3(0, 0.45, 0));

    // Rate of emission scales with damage
    const spawnChance = damageRatio > 0.75 ? 0.95 : (damageRatio > 0.5 ? 0.65 : 0.35);
    if (Math.random() > spawnChance) return;

    // Darker smoke as damage increases: from light grey (0.55) to pitch black (0.06)
    const smokeTone = Math.max(0.06, 0.55 - damageRatio * 0.5);
    const smokeColor = new THREE.Color(smokeTone, smokeTone, smokeTone * 1.05);

    const smokeVel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.8,
      1.6 + Math.random() * 2.0 * damageRatio,
      (Math.random() - 0.5) * 0.8
    ).addScaledVector(physicsState.velocity, 0.15);

    this.particles.push({
      position: hoodPos.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.35,
        Math.random() * 0.2,
        (Math.random() - 0.5) * 0.35
      )),
      velocity: smokeVel,
      color: smokeColor,
      size: 0.35 + damageRatio * 0.35 + Math.random() * 0.2,
      alpha: 0.75,
      life: 0,
      maxLife: 0.45 + damageRatio * 0.4,
    });

    // High damage emits fiery embers / electrical sparks
    if (damageRatio > 0.6 && Math.random() < 0.45) {
      const sparkColor = Math.random() > 0.4
        ? new THREE.Color(1.0, 0.45, 0.05) // Burning orange
        : new THREE.Color(1.0, 0.9, 0.2);  // Electric yellow

      this.particles.push({
        position: hoodPos.clone(),
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 3.5,
          2.5 + Math.random() * 3.0,
          (Math.random() - 0.5) * 3.5
        ),
        color: sparkColor,
        size: 0.22 + Math.random() * 0.15,
        alpha: 1.0,
        life: 0,
        maxLife: 0.3 + Math.random() * 0.25,
      });
    }
  }

  public triggerExplosionWreck(position: THREE.Vector3): void {
    this.isWrecked = true;
    this.stopBoost();

    // 1. Violent detonation flash & sparks burst
    this.playImpactFlash(position, 1.0);
    this.playImpactSpark(position, 1.0, new THREE.Vector3(0, 1, 0));

    // 2. Extra radial fire explosion debris
    for (let i = 0; i < 40; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 8.0;
      const vel = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 5.0,
        Math.sin(angle) * speed
      );
      const color = Math.random() > 0.5
        ? new THREE.Color(1.0, 0.2, 0.05)
        : new THREE.Color(1.0, 0.8, 0.1);

      this.particles.push({
        position: position.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.8,
          0.3,
          (Math.random() - 0.5) * 0.8
        )),
        velocity: vel,
        color,
        size: 0.4 + Math.random() * 0.3,
        alpha: 1.0,
        life: 0,
        maxLife: 0.5 + Math.random() * 0.4,
      });
    }
  }

  public update(dt: number, physicsState: CarPhysicsState, damageRatio: number = 0): void {
    // Continuous dense dark smoke if wrecked
    if (this.isWrecked) {
      if (this.particles.length < this.maxParticles - 10 && Math.random() < 0.9) {
        const hoodPos = physicsState.position.clone().add(new THREE.Vector3(0, 0.5, 0));
        const smokeVel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          2.2 + Math.random() * 2.0,
          (Math.random() - 0.5) * 0.6
        );
        this.particles.push({
          position: hoodPos.add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            Math.random() * 0.2,
            (Math.random() - 0.5) * 0.4
          )),
          velocity: smokeVel,
          color: new THREE.Color(0.04, 0.04, 0.05), // Pitch-black burnt smoke
          size: 0.65 + Math.random() * 0.35,
          alpha: 0.95,
          life: 0,
          maxLife: 0.75 + Math.random() * 0.5,
        });

        // Dying electrical sputter spark
        if (Math.random() < 0.2) {
          this.particles.push({
            position: hoodPos.clone(),
            velocity: new THREE.Vector3(
              (Math.random() - 0.5) * 2.5,
              1.5 + Math.random() * 2.0,
              (Math.random() - 0.5) * 2.5
            ),
            color: new THREE.Color(1.0, 0.4, 0.1),
            size: 0.2,
            alpha: 1.0,
            life: 0,
            maxLife: 0.2,
          });
        }
      }
    }

    // 1. Boost Jet Flame Animation
    if (this.isBoosting && this.boostCones.length > 0) {
      const flicker = 0.8 + Math.random() * 0.4;
      for (const cone of this.boostCones) {
        cone.scale.set(flicker, flicker, 0.9 + Math.random() * 0.6);
        (cone.material as THREE.MeshBasicMaterial).opacity = 0.85;
      }

      // Spawn boost trail particles
      if (this.bindings.vfxBoost && this.particles.length < this.maxParticles - 10) {
        const worldExhaustPos = new THREE.Vector3();
        this.bindings.vfxBoost.getWorldPosition(worldExhaustPos);
        const fwd = physicsState.forward;

        for (let i = 0; i < 3; i++) {
          this.particles.push({
            position: worldExhaustPos.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 0.4,
              (Math.random() - 0.5) * 0.2,
              (Math.random() - 0.5) * 0.2
            )),
            velocity: fwd.clone().multiplyScalar(-10.0 - Math.random() * 6.0),
            color: Math.random() > 0.5 ? new THREE.Color(0x00e5ff) : new THREE.Color(0x00ff88),
            size: 0.35 + Math.random() * 0.25,
            alpha: 1.0,
            life: 0,
            maxLife: 0.22,
          });
        }
      }
    }

    // Trailing Power-Up Particle VFX (Streams strictly BEHIND the vehicle, leaving car 100% visible)
    if (this.activePowerUpType && this.particles.length < this.maxParticles - 10) {
      const worldPos = physicsState.position;
      const fwd = physicsState.forward;
      const rearPos = worldPos.clone().sub(fwd.clone().multiplyScalar(1.2)).add(new THREE.Vector3(0, 0.25, 0));

      if (this.activePowerUpType === 'TITAN' || this.activePowerUpType === 'HEAVY_HIT') {
        // Heavy golden ground embers and shockwave dust behind rear tires
        for (let i = 0; i < 2; i++) {
          this.particles.push({
            position: rearPos.clone().add(new THREE.Vector3(
              (Math.random() - 0.5) * 1.4,
              Math.random() * 0.2,
              (Math.random() - 0.5) * 0.4
            )),
            velocity: fwd.clone().multiplyScalar(-5.0 - Math.random() * 4.0).add(new THREE.Vector3(
              (Math.random() - 0.5) * 2.0,
              0.8 + Math.random() * 1.2,
              0
            )),
            color: Math.random() > 0.4 ? new THREE.Color(0xff8800) : new THREE.Color(0xffd700),
            size: 0.45 + Math.random() * 0.35,
            alpha: 0.9,
            life: 0,
            maxLife: 0.35 + Math.random() * 0.25,
          });
        }
      } else if (this.activePowerUpType === 'CASH_MAGNET') {
        // Violet magnetic vortex wisps trailing into the rear
        this.particles.push({
          position: rearPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.8,
            0.2 + Math.random() * 0.5,
            (Math.random() - 0.5) * 1.2
          )),
          velocity: fwd.clone().multiplyScalar(2.0 + Math.random() * 3.0),
          color: new THREE.Color(0xbd00ff),
          size: 0.3 + Math.random() * 0.2,
          alpha: 0.85,
          life: 0,
          maxLife: 0.3,
        });
      } else if (this.activePowerUpType === 'SHIELD' && Math.random() < 0.25) {
        // Emerald deflection crackles along bumper edge
        this.particles.push({
          position: worldPos.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 1.8,
            0.15 + Math.random() * 0.4,
            (Math.random() - 0.5) * 2.2
          )),
          velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 1.5, (Math.random() - 0.5) * 1.5),
          color: new THREE.Color(0x00ff88),
          size: 0.22,
          alpha: 1.0,
          life: 0,
          maxLife: 0.18,
        });
      }
    }

    // 2. Drift Tire Smoke Emission
    if (physicsState.isDrifting && this.particles.length < this.maxParticles - 5) {
      const rearLeft = new THREE.Vector3(-0.8, 0.1, -0.9).applyQuaternion(physicsState.quaternion).add(physicsState.position);
      const rearRight = new THREE.Vector3(0.8, 0.1, -0.9).applyQuaternion(physicsState.quaternion).add(physicsState.position);
      this.playTireSkid(rearLeft, physicsState.driftRatio);
      this.playTireSkid(rearRight, physicsState.driftRatio);
    }

    // 3. Engine Bay Damage Smoke & Sparks
    if (damageRatio > 0.25 && !this.isWrecked && this.particles.length < this.maxParticles - 8) {
      this.emitDamageSmokeAndSparks(physicsState, damageRatio);
    }

    // 4. Update active particles in buffer
    let activeCount = 0;
    const posArr = this.positions;
    const colArr = this.colors;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration on particles
      p.position.addScaledVector(p.velocity, dt);
      p.velocity.y -= 3.5 * dt; // Light gravity on sparks

      const fade = 1.0 - (p.life / p.maxLife);
      const idx = activeCount * 3;

      posArr[idx] = p.position.x;
      posArr[idx + 1] = p.position.y;
      posArr[idx + 2] = p.position.z;

      colArr[idx] = p.color.r * fade;
      colArr[idx + 1] = p.color.g * fade;
      colArr[idx + 2] = p.color.b * fade;

      activeCount++;
    }

    // Zero out unused points
    for (let i = activeCount; i < this.maxParticles; i++) {
      const idx = i * 3;
      posArr[idx] = 0;
      posArr[idx + 1] = -9999;
      posArr[idx + 2] = 0;
    }

    this.particleGeometry.attributes.position.needsUpdate = true;
    this.particleGeometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.particlePoints);
    this.particleGeometry.dispose();
    this.particleMaterial.dispose();
  }
}
