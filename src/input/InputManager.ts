/**
 * Abstracted Input Manager for BUMP.TRADE.
 * Decouples input collection (keyboard, gamepad, touch, AI) from vehicle mechanics.
 */

export interface VehicleInput {
  throttle: number; // -1.0 (reverse) to 1.0 (accelerate)
  steer: number; // -1.0 (steer left) to 1.0 (steer right)
  brake: boolean;
  boost: boolean;
  handbrake: boolean;
}

export class InputManager {
  private keysDown: Set<string> = new Set();
  private onResetCallback?: () => void;
  private onToggleAICallback?: () => void;
  private onToggleDebugCallback?: () => void;
  private onToggleCameraCallback?: () => void;
  private onCycleVehicleCallback?: () => void;
  private onCycleOpponentCallback?: () => void;

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.attach();
  }

  private attach(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const code = e.code;
    this.keysDown.add(code);

    // Prevent default scrolling for game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
      e.preventDefault();
    }

    if (code === 'KeyR' && this.onResetCallback) {
      this.onResetCallback();
    }

    if (code === 'KeyT' && this.onToggleAICallback) {
      this.onToggleAICallback();
    }

    if (code === 'KeyC' && this.onToggleCameraCallback) {
      this.onToggleCameraCallback();
    }

    if (code === 'KeyV' && this.onCycleVehicleCallback) {
      this.onCycleVehicleCallback();
    }

    if (code === 'KeyB' && this.onCycleOpponentCallback) {
      this.onCycleOpponentCallback();
    }

    if ((code === 'F1' || code === 'Backquote') && this.onToggleDebugCallback) {
      e.preventDefault();
      this.onToggleDebugCallback();
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  public onReset(cb: () => void): void {
    this.onResetCallback = cb;
  }

  public onToggleAI(cb: () => void): void {
    this.onToggleAICallback = cb;
  }

  public onToggleDebug(cb: () => void): void {
    this.onToggleDebugCallback = cb;
  }

  public onToggleCamera(cb: () => void): void {
    this.onToggleCameraCallback = cb;
  }

  public onCycleVehicle(cb: () => void): void {
    this.onCycleVehicleCallback = cb;
  }

  public onCycleOpponent(cb: () => void): void {
    this.onCycleOpponentCallback = cb;
  }

  /**
   * Samples current input state and returns normalized vehicle inputs.
   */
  public sampleInput(): VehicleInput {
    let throttle = 0;
    let steer = 0;

    // Throttle: W / Up = forward (+1), S / Down = reverse (-1)
    const forward = this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp');
    const backward = this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown');
    if (forward && !backward) throttle = 1.0;
    else if (backward && !forward) throttle = -1.0;

    // Steering: A / Left = -1 (left), D / Right = +1 (right)
    const left = this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft');
    const right = this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight');
    if (left && !right) steer = -1.0;
    else if (right && !left) steer = 1.0;

    const boost = this.keysDown.has('Space');
    const brake = backward && forward; // or explicit brake if moving forward and pressing S
    const handbrake = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight');

    return {
      throttle,
      steer,
      brake,
      boost,
      handbrake,
    };
  }

  public isKeyDown(code: string): boolean {
    return this.keysDown.has(code);
  }
}
