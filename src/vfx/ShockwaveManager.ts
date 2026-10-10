import * as THREE from 'three';

interface Shockwave {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  maxRadius: number;
  duration: number;
  age: number;
  color: THREE.Color;
}

export class ShockwaveManager {
  private scene: THREE.Scene;
  private shockwaves: Shockwave[] = [];
  private ringGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Normalized ring geometry (innerRadius: 0.85, outerRadius: 1.0)
    this.ringGeo = new THREE.RingGeometry(0.85, 1.0, 32);
    this.ringGeo.rotateX(-Math.PI / 2); // Flat on floor
  }

  /**
   * Spawns an expanding ground shockwave ring.
   */
  public spawnShockwave(
    position: THREE.Vector3,
    colorHex: number = 0x00e5ff,
    maxRadius: number = 2.4,
    duration: number = 0.28
  ): void {
    const color = new THREE.Color(colorHex);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(this.ringGeo, material);
    mesh.position.set(position.x, 0.05, position.z);
    mesh.scale.set(0.1, 1, 0.1);
    this.scene.add(mesh);

    this.shockwaves.push({
      mesh,
      material,
      maxRadius,
      duration,
      age: 0,
      color,
    });
  }

  public update(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.age += dt;

      const progress = sw.age / sw.duration;
      if (progress >= 1.0) {
        this.scene.remove(sw.mesh);
        sw.material.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }

      // Smooth ease-out expansion
      const ease = 1 - Math.pow(1 - progress, 3);
      const currentRadius = 0.2 + ease * sw.maxRadius;
      sw.mesh.scale.set(currentRadius, 1, currentRadius);

      // Fade opacity
      sw.material.opacity = (1 - progress) * 0.9;
    }
  }

  public dispose(): void {
    for (const sw of this.shockwaves) {
      this.scene.remove(sw.mesh);
      sw.material.dispose();
    }
    this.ringGeo.dispose();
  }
}
