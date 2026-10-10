import * as THREE from 'three';
import { HeroCar } from '../vehicles/HeroCar';
import { CollisionEvent } from '../collision/CollisionTypes';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export class DebugRenderer {
  private isVisible: boolean = false;

  // DOM Elements for Debug Overlay
  private overlayEl: HTMLElement | null;
  private fpsEl: HTMLElement | null;
  private posEl: HTMLElement | null;
  private fwdVelEl: HTMLElement | null;
  private latVelEl: HTMLElement | null;
  private driftEl: HTMLElement | null;
  private stateEl: HTMLElement | null;
  private antennaEl: HTMLElement | null;
  private bumperEl: HTMLElement | null;
  private colTierEl: HTMLElement | null;
  private colForceEl: HTMLElement | null;

  // FPS calculation
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;

  private lastCollision?: CollisionEvent;

  constructor(_scene?: THREE.Scene, _physicsWorld?: PhysicsWorld) {
    // Grab DOM handles for F1 / ` debug overlay only
    this.overlayEl = document.getElementById('debug-overlay');
    this.fpsEl = document.getElementById('dbg-fps');
    this.posEl = document.getElementById('dbg-pos');
    this.fwdVelEl = document.getElementById('dbg-fwd-vel');
    this.latVelEl = document.getElementById('dbg-lat-vel');
    this.driftEl = document.getElementById('dbg-drift');
    this.stateEl = document.getElementById('dbg-state');
    this.antennaEl = document.getElementById('dbg-antenna');
    this.bumperEl = document.getElementById('dbg-bumper');
    this.colTierEl = document.getElementById('dbg-collision-tier');
    this.colForceEl = document.getElementById('dbg-collision-force');
  }

  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.overlayEl) {
      if (this.isVisible) this.overlayEl.classList.remove('hidden');
      else this.overlayEl.classList.add('hidden');
    }
  }

  public showImpact(event: CollisionEvent): void {
    this.lastCollision = event;
    if (this.colTierEl) this.colTierEl.innerText = `${event.tier} (${(event.intensity * 100).toFixed(0)}%)`;
    if (this.colForceEl) this.colForceEl.innerText = `${event.impactForce.toFixed(0)} N`;
  }

  public update(playerCar: HeroCar, _opponentCar?: HeroCar, _aiMode: string = 'COMBAT'): void {
    // 1. Calculate FPS
    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;
      if (this.fpsEl) this.fpsEl.innerText = `${this.currentFps} FPS`;
    }

    if (!this.isVisible) return;

    // 2. Update Detailed Debug Overlay
    const phys = playerCar.controller.getPhysicsState();
    const anim = playerCar.controller.getAnimationState();
    const state = playerCar.controller.getState();

    if (this.posEl) {
      this.posEl.innerText = `${phys.position.x.toFixed(1)}, ${phys.position.y.toFixed(1)}, ${phys.position.z.toFixed(1)}`;
    }
    if (this.fwdVelEl) this.fwdVelEl.innerText = `${phys.forwardSpeed.toFixed(2)} m/s`;
    if (this.latVelEl) this.latVelEl.innerText = `${phys.lateralSpeed.toFixed(2)} m/s`;
    if (this.driftEl) this.driftEl.innerText = `${phys.driftRatio.toFixed(2)} ${phys.isDrifting ? 'DRIFT!' : ''}`;
    if (this.stateEl) this.stateEl.innerText = state;
    if (this.antennaEl) this.antennaEl.innerText = anim.antennaEnergy.toFixed(2);
    if (this.bumperEl) this.bumperEl.innerText = `${anim.bumperOffset.length().toFixed(3)}m`;
    if (this.lastCollision) {
      if (this.colTierEl) this.colTierEl.innerText = `${this.lastCollision.tier} (${(this.lastCollision.intensity * 100).toFixed(0)}%)`;
      if (this.colForceEl) this.colForceEl.innerText = `${this.lastCollision.impactForce.toFixed(0)} N`;
    }
  }
}
