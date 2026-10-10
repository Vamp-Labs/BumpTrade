/**
 * High-precision GameLoop with fixed physics timestep accumulator and render separation.
 * Conforms to Step 22 specification.
 */

export class GameLoop {
  private fixedStep: number;
  private maxSubSteps: number;
  private accumulator: number = 0;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private animationFrameId: number = 0;

  private onPhysicsTick: (dt: number) => void;
  private onRenderTick: (dt: number, alpha: number) => void;

  // Hit-stop effect (micro freeze-frame on critical impacts)
  private hitStopTimer: number = 0;
  private hitStopEnabled: boolean = true;

  constructor(
    onPhysicsTick: (dt: number) => void,
    onRenderTick: (dt: number, alpha: number) => void,
    fixedStep: number = 1 / 60,
    maxSubSteps: number = 5
  ) {
    this.onPhysicsTick = onPhysicsTick;
    this.onRenderTick = onRenderTick;
    this.fixedStep = fixedStep;
    this.maxSubSteps = maxSubSteps;

    this.tick = this.tick.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  public setHitStopEnabled(enabled: boolean): void {
    this.hitStopEnabled = enabled;
    if (!enabled) this.hitStopTimer = 0;
  }

  public triggerHitStop(durationSeconds: number): void {
    if (!this.hitStopEnabled) return;
    this.hitStopTimer = Math.max(this.hitStopTimer, durationSeconds);
  }

  private tick(currentTime: number): void {
    if (!this.isRunning) return;

    // Delta time in seconds
    let frameDelta = (currentTime - this.lastTime) * 0.001;
    this.lastTime = currentTime;

    // Cap excessive delta (e.g. tab switch) to prevent spiral of death
    if (frameDelta > 0.15) {
      frameDelta = 0.15;
    }

    // Process Hit Stop (freeze frame effect)
    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= frameDelta;
      // Skip physics step during hit-stop, but still re-render
      this.onRenderTick(frameDelta * 0.1, 1.0);
      this.animationFrameId = requestAnimationFrame(this.tick);
      return;
    }

    this.accumulator += frameDelta;

    // Fixed timestep physics loop
    let subSteps = 0;
    while (this.accumulator >= this.fixedStep && subSteps < this.maxSubSteps) {
      this.onPhysicsTick(this.fixedStep);
      this.accumulator -= this.fixedStep;
      subSteps++;
    }

    // Blend / interpolation alpha between physics frames
    const alpha = this.accumulator / this.fixedStep;

    // Visual rendering update
    this.onRenderTick(frameDelta, alpha);

    this.animationFrameId = requestAnimationFrame(this.tick);
  }
}
