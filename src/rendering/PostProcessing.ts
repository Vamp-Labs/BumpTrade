import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export interface PostProcessingConfig {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
}

export const DEFAULT_POST_CONFIG: PostProcessingConfig = {
  bloomStrength: 0.18,    // Subdued, clean cyber glow (not blinding)
  bloomRadius: 0.22,      // Crisp, tight halo dispersion
  bloomThreshold: 0.92,   // Only intensely luminous accents bloom
};

export class PostProcessingManager {
  public readonly composer: EffectComposer;
  public readonly renderPass: RenderPass;
  public readonly bloomPass: UnrealBloomPass;
  public readonly outputPass: OutputPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: PostProcessingConfig = DEFAULT_POST_CONFIG
  ) {
    const size = new THREE.Vector2();
    renderer.getSize(size);

    this.composer = new EffectComposer(renderer);

    // 1. Scene Render Pass
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // 2. Unreal Bloom Pass (High-tech cyber neon glow)
    this.bloomPass = new UnrealBloomPass(
      size,
      config.bloomStrength,
      config.bloomRadius,
      config.bloomThreshold
    );
    this.composer.addPass(this.bloomPass);

    // 3. Output Pass (Color space & ACES Filmic tone mapping output)
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  public setBloomStrength(strength: number): void {
    this.bloomPass.strength = strength;
  }

  public setBloomThreshold(threshold: number): void {
    this.bloomPass.threshold = threshold;
  }

  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
  }

  public render(): void {
    this.composer.render();
  }

  public dispose(): void {
    this.composer.dispose();
  }
}
