import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CarNodeBindings } from '../vehicles/CarTypes';
import { VehicleType } from '../vehicles/VehicleTypes';
import { HoodBullModelBuilder } from '../vehicles/HoodBullModelBuilder';
import { HoodBearModelBuilder } from '../vehicles/HoodBearModelBuilder';
import { TslaRacerModelBuilder } from '../vehicles/TslaRacerModelBuilder';
import { NvdaAiModelBuilder } from '../vehicles/NvdaAiModelBuilder';
import { GoldWhaleModelBuilder } from '../vehicles/GoldWhaleModelBuilder';
import { GmeApeModelBuilder } from '../vehicles/GmeApeModelBuilder';
import { DogeKartModelBuilder } from '../vehicles/DogeKartModelBuilder';

export class AssetManager {
  private static instance: AssetManager;
  private gltfLoader: GLTFLoader;
  private cachedModels: Map<string, THREE.Object3D> = new Map();

  private constructor() {
    this.gltfLoader = new GLTFLoader();
  }

  public static get(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  public async loadHeroVehicle(url?: string): Promise<THREE.Object3D> {
    return this.loadVehicle('hood_bull', url);
  }

  public async loadVehicle(type: VehicleType = 'hood_bull', url?: string): Promise<THREE.Object3D> {
    const key = url || `${type}_default`;

    if (this.cachedModels.has(key)) {
      return this.cloneWithMaterials(this.cachedModels.get(key)!);
    }

    if (url) {
      try {
        const gltf = await this.gltfLoader.loadAsync(url);
        const model = gltf.scene;
        model.name = 'CarRoot';
        this.cachedModels.set(key, model);
        return this.cloneWithMaterials(model);
      } catch (err) {
        console.warn(`[AssetManager] Could not load GLB from ${url}. Falling back to procedural ${type} model.`, err);
      }
    } else {
      // Check if a dedicated Blender GLB model exists for this vehicle type
      try {
        const gltf = await this.gltfLoader.loadAsync(`/models/${type}.glb`);
        const model = gltf.scene;
        model.name = 'CarRoot';
        this.cachedModels.set(key, model);
        return this.cloneWithMaterials(model);
      } catch (err) {
        console.warn(`[AssetManager] Could not load GLB for ${type}. Falling back to procedural model.`, err);
      }
    }

    // High quality procedural vehicle assets for all 5 archetypes
    let model: THREE.Object3D;
    switch (type) {
      case 'hood_bear':
        model = HoodBearModelBuilder.build();
        break;
      case 'tsla_racer':
        model = TslaRacerModelBuilder.build();
        break;
      case 'nvda_ai':
        model = NvdaAiModelBuilder.build();
        break;
      case 'gold_whale':
        model = GoldWhaleModelBuilder.build();
        break;
      case 'gme_ape':
        model = GmeApeModelBuilder.build();
        break;
      case 'doge_kart':
        model = DogeKartModelBuilder.build();
        break;
      case 'hood_bull':
      default:
        model = HoodBullModelBuilder.build();
        break;
    }

    this.cachedModels.set(key, model);
    return this.cloneWithMaterials(model);
  }

  private cloneWithMaterials(source: THREE.Object3D): THREE.Object3D {
    const clone = source.clone(true);
    clone.traverse((node) => {
      if ((node as THREE.Mesh).isMesh) {
        const mesh = node as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    return clone;
  }

  /**
   * Robust node-binding layer.
   * Caches critical node references once during initialization.
   * Degrades gracefully if optional nodes are missing.
   */
  public bindCarNodes(root: THREE.Object3D): CarNodeBindings {
    const nodeMap = new Map<string, THREE.Object3D>();

    // Index all descendants by normalized lowercase name and exact name
    root.traverse((node) => {
      nodeMap.set(node.name, node);
      nodeMap.set(node.name.toLowerCase().replace(/[-_]/g, ''), node);
    });

    const findNode = (name: string): THREE.Object3D | undefined => {
      if (nodeMap.has(name)) return nodeMap.get(name);
      const normalized = name.toLowerCase().replace(/[-_]/g, '');
      if (nodeMap.has(normalized)) return nodeMap.get(normalized);
      for (const [key, node] of nodeMap.entries()) {
        if (key.toLowerCase().includes(normalized)) return node;
      }
      return undefined;
    };

    const bindings: CarNodeBindings = {
      root,
      chassis: findNode('Chassis'),
      body: findNode('Body'),
      bumper: findNode('Bumper'),
      wheelFL: findNode('Wheel_FL'),
      wheelFR: findNode('Wheel_FR'),
      wheelRL: findNode('Wheel_RL'),
      wheelRR: findNode('Wheel_RR'),
      antenna: findNode('Antenna'),
      contactHead: findNode('ContactHead'),
      moneyDisplay: findNode('MoneyDisplay'),
      headlightL: findNode('Headlight_L'),
      headlightR: findNode('Headlight_R'),
      tailLightL: findNode('TailLight_L'),
      tailLightR: findNode('TailLight_R'),
      vfxImpact: findNode('VFX_Impact'),
      vfxBoost: findNode('VFX_Boost'),
      vfxAntenna: findNode('VFX_Antenna'),
      vfxCoin: findNode('VFX_Coin'),
      vfxSkid: findNode('VFX_Skid'),
      driver: findNode('Driver'),
    };

    // Diagnostic validation log (non-breaking)
    const required = ['bumper', 'body'];
    for (const req of required) {
      if (!(bindings as any)[req]) {
        console.warn(`[AssetManager] Warning: Core node '${req}' not found in model hierarchy. Vehicle will continue with fallback.`);
      }
    }

    // Fallback chassis node to root if not explicitly defined
    if (!bindings.chassis) {
      bindings.chassis = bindings.root;
    }

    // Initialize MoneyDisplay dynamic canvas texture if not already present
    if (bindings.moneyDisplay) {
      bindings.moneyDisplay.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as any;
          if (!mat || !mat.map || !(mat.map as THREE.CanvasTexture).image) {
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#060a08';
              ctx.fillRect(0, 0, 256, 128);
              ctx.fillStyle = '#00ff88';
              ctx.font = 'bold 72px monospace';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('$85', 128, 64);
            }
            const displayTex = new THREE.CanvasTexture(canvas);
            mesh.material = new THREE.MeshBasicMaterial({ map: displayTex });
          }
        }
      });
    }

    // Ensure an underglow PointLight exists in chassis for reflections and power-up glow
    let hasUnderglow = false;
    bindings.chassis.traverse((child) => {
      if ((child as THREE.PointLight).isPointLight) hasUnderglow = true;
    });
    if (!hasUnderglow) {
      const underglow = new THREE.PointLight(0x00ff6a, 1.8, 3.2, 1.2);
      underglow.position.set(0, 0.12, 0);
      underglow.name = 'ChassisUnderglowLight';
      bindings.chassis.add(underglow);
    }

    return bindings;
  }
}
