import { CAR_CONFIG } from '../core/Config';

export class BoostController {
  private fuel: number = 1.0; // 0.0 to 1.0
  private isBoosting: boolean = false;
  private duration: number = CAR_CONFIG.boostDuration;
  private rechargeRate: number = CAR_CONFIG.boostRechargeRate;
  private multiplier: number = CAR_CONFIG.boostMultiplier;

  public update(dt: number, wantBoost: boolean): void {
    if (wantBoost && this.fuel > 0.02) {
      this.isBoosting = true;
      this.fuel = Math.max(0, this.fuel - (dt / this.duration));
      if (this.fuel <= 0) {
        this.isBoosting = false;
      }
    } else {
      this.isBoosting = false;
      this.fuel = Math.min(1.0, this.fuel + dt * this.rechargeRate);
    }
  }

  public isActive(): boolean {
    return this.isBoosting;
  }

  public getFuel(): number {
    return this.fuel;
  }

  public getMultiplier(): number {
    return this.isBoosting ? this.multiplier : 1.0;
  }

  public refill(): void {
    this.fuel = 1.0;
    this.isBoosting = false;
  }
}
