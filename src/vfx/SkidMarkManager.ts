import * as THREE from 'three';

interface SkidPoint {
  leftPos: THREE.Vector3;
  rightPos: THREE.Vector3;
  opacity: number;
}

export class SkidMarkManager {
  private scene: THREE.Scene;
  private maxPoints = 400;
  private points: SkidPoint[] = [];

  private geometry: THREE.BufferGeometry;
  private material: THREE.MeshBasicMaterial;
  private mesh: THREE.Mesh;

  private positions: Float32Array;
  private colors: Float32Array;

  private lastEmitPosL: THREE.Vector3 = new THREE.Vector3();
  private lastEmitPosR: THREE.Vector3 = new THREE.Vector3();
  private isCurrentlyEmitting: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    const maxVertices = this.maxPoints * 4;
    this.positions = new Float32Array(maxVertices * 3);
    this.colors = new Float32Array(maxVertices * 4);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));

    // Index buffer for quad strips
    const indices: number[] = [];
    for (let i = 0; i < this.maxPoints - 1; i++) {
      const base = i * 4;
      // Left tire quad
      indices.push(base, base + 1, base + 4);
      indices.push(base + 1, base + 5, base + 4);
      // Right tire quad
      indices.push(base + 2, base + 3, base + 6);
      indices.push(base + 3, base + 7, base + 6);
    }
    this.geometry.setIndex(indices);

    this.material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1.0, // Prevent z-fighting with floor
      polygonOffsetUnits: -1.0,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.renderOrder = 2; // Above floor
    this.scene.add(this.mesh);
  }

  /**
   * Adds skid segment if car is drifting and has moved enough.
   */
  public addSkid(posL: THREE.Vector3, posR: THREE.Vector3, intensity: number): void {
    const groundY = 0.035;

    // Check minimum distance from last emitted point
    if (this.isCurrentlyEmitting) {
      const dist = posL.distanceTo(this.lastEmitPosL);
      if (dist < 0.25) return; // Too close
    }

    this.lastEmitPosL.copy(posL);
    this.lastEmitPosR.copy(posR);
    this.isCurrentlyEmitting = true;

    // Store points with ground elevation
    const pL = new THREE.Vector3(posL.x, groundY, posL.z);
    const pR = new THREE.Vector3(posR.x, groundY, posR.z);

    if (this.points.length >= this.maxPoints) {
      this.points.shift();
    }

    this.points.push({
      leftPos: pL,
      rightPos: pR,
      opacity: Math.min(intensity * 0.75, 0.75),
    });

    this.updateGeometry();
  }

  public endSkid(): void {
    this.isCurrentlyEmitting = false;
  }

  public update(dt: number): void {
    // Gradually fade oldest skid marks
    let changed = false;
    for (let i = 0; i < this.points.length; i++) {
      this.points[i].opacity -= dt * 0.025; // Fade over ~30s
      if (this.points[i].opacity < 0.01) {
        this.points.splice(i, 1);
        i--;
        changed = true;
      }
    }
    if (changed) {
      this.updateGeometry();
    }
  }

  private updateGeometry(): void {
    const halfWidth = 0.09;
    const count = this.points.length;
    let vIdx = 0;
    let cIdx = 0;

    for (let i = 0; i < count; i++) {
      const p = this.points[i];
      const alpha = p.opacity;

      // Left tire: two vertices
      this.positions[vIdx] = p.leftPos.x - halfWidth;
      this.positions[vIdx + 1] = p.leftPos.y;
      this.positions[vIdx + 2] = p.leftPos.z;

      this.positions[vIdx + 3] = p.leftPos.x + halfWidth;
      this.positions[vIdx + 4] = p.leftPos.y;
      this.positions[vIdx + 5] = p.leftPos.z;

      // Right tire: two vertices
      this.positions[vIdx + 6] = p.rightPos.x - halfWidth;
      this.positions[vIdx + 7] = p.rightPos.y;
      this.positions[vIdx + 8] = p.rightPos.z;

      this.positions[vIdx + 9] = p.rightPos.x + halfWidth;
      this.positions[vIdx + 10] = p.rightPos.y;
      this.positions[vIdx + 11] = p.rightPos.z;

      vIdx += 12;

      // Colors: deep rubber asphalt black
      for (let k = 0; k < 4; k++) {
        this.colors[cIdx] = 0.02;
        this.colors[cIdx + 1] = 0.03;
        this.colors[cIdx + 2] = 0.05;
        this.colors[cIdx + 3] = alpha;
        cIdx += 4;
      }
    }

    this.geometry.setDrawRange(0, Math.max(0, (count - 1) * 12));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  public dispose(): void {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
