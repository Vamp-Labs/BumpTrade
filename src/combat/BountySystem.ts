import { HeroCar } from '../vehicles/HeroCar';
import { EventBus } from '../core/EventBus';

export type BountyTier = 'NORMAL' | 'HOT' | 'BIG_BAG' | 'BOUNTY';

export interface BountyInfo {
  tier: BountyTier;
  label: string;
  badge: string;
  colorHex: number;
  colorCss: string;
}

export class BountySystem {
  private static instance: BountySystem;
  private previousTiers: Map<string, BountyTier> = new Map();

  private constructor() {}

  public static get(): BountySystem {
    if (!BountySystem.instance) {
      BountySystem.instance = new BountySystem();
    }
    return BountySystem.instance;
  }

  public getTier(balance: number, isRichest: boolean = false): BountyTier {
    if (balance >= 250 && isRichest) return 'BOUNTY';
    if (balance >= 500) return 'BOUNTY';
    if (balance >= 250) return 'BIG_BAG';
    if (balance >= 100) return 'HOT';
    return 'NORMAL';
  }

  public getBountyInfo(tier: BountyTier): BountyInfo {
    switch (tier) {
      case 'BOUNTY':
        return {
          tier: 'BOUNTY',
          label: 'BOUNTY TARGET',
          badge: '👑 BOUNTY TARGET 🎯',
          colorHex: 0xffd700,
          colorCss: '#ffd700',
        };
      case 'BIG_BAG':
        return {
          tier: 'BIG_BAG',
          label: 'BIG BAG',
          badge: '💰 BIG BAG',
          colorHex: 0xffaa00,
          colorCss: '#ffaa00',
        };
      case 'HOT':
        return {
          tier: 'HOT',
          label: 'HOT',
          badge: '🔥 HOT',
          colorHex: 0xff6600,
          colorCss: '#ff6600',
        };
      default:
        return {
          tier: 'NORMAL',
          label: 'NORMAL',
          badge: '',
          colorHex: 0x00f5a0,
          colorCss: '#00f5a0',
        };
    }
  }

  /**
   * Evaluates all cars and emits events if any car transitions to a higher tier.
   * Dynamically awards #1 crown to richest surviving car.
   */
  public update(allCars: HeroCar[]): void {
    const aliveCars = allCars.filter(c => !c.controller.isEliminated());
    let richestCar: HeroCar | null = null;
    let maxBal = -1;

    for (const c of aliveCars) {
      const b = c.controller.getBalance();
      if (b > maxBal) {
        maxBal = b;
        richestCar = c;
      }
    }

    for (const car of allCars) {
      if (car.controller.isEliminated()) {
        car.controller.visual.setBountyTier('NORMAL');
        continue;
      }

      const balance = car.controller.getBalance();
      const isRichest = richestCar !== null && car.id === richestCar.id && balance >= 250;
      const currentTier = this.getTier(balance, isRichest);
      car.controller.visual.setBountyTier(currentTier);

      const prevTier = this.previousTiers.get(car.id) || 'NORMAL';

      if (currentTier !== prevTier) {
        this.previousTiers.set(car.id, currentTier);

        EventBus.get().emit('bounty_tier_changed', {
          carId: car.id,
          carName: car.config.displayName,
          isPlayer: car.id === 'player_car',
          oldTier: prevTier,
          newTier: currentTier,
          balance,
          info: this.getBountyInfo(currentTier),
        });
      }
    }
  }

  /**
   * Finds the single richest surviving vehicle in the arena.
   */
  public getRichestVehicle(allCars: HeroCar[]): { car: HeroCar; balance: number; tier: BountyTier } | null {
    const aliveCars = allCars.filter(c => !c.controller.isEliminated());
    if (aliveCars.length === 0) return null;

    let richest = aliveCars[0];
    let maxBalance = richest.controller.getBalance();

    for (let i = 1; i < aliveCars.length; i++) {
      const bal = aliveCars[i].controller.getBalance();
      if (bal > maxBalance) {
        maxBalance = bal;
        richest = aliveCars[i];
      }
    }

    return {
      car: richest,
      balance: maxBalance,
      tier: this.getTier(maxBalance, true),
    };
  }

  /**
   * Selects best target for an AI vehicle, weighting towards high bounty / rich targets.
   * Strictly filters out eliminated wreck vehicles.
   */
  public getBestTargetForAI(selfCar: HeroCar, allCandidateCars: HeroCar[]): HeroCar {
    const aliveCandidates = allCandidateCars.filter(c => !c.controller.isEliminated() && c.id !== selfCar.id);
    if (aliveCandidates.length === 0) return selfCar;

    let bestCar = aliveCandidates[0];
    let highestScore = -Infinity;

    const selfPos = selfCar.controller.getPhysicsState().position;

    for (const candidate of aliveCandidates) {
      const candPos = candidate.controller.getPhysicsState().position;
      const distance = selfPos.distanceTo(candPos);
      const balance = candidate.controller.getBalance();
      const tier = this.getTier(balance, candidate.controller.visual.getBountyTier() === 'BOUNTY');

      // Bounty weighting factor (BOUNTY gets 3.5x aggression)
      let bountyMultiplier = 1.0;
      if (tier === 'BOUNTY') bountyMultiplier = 3.5;
      else if (tier === 'BIG_BAG') bountyMultiplier = 2.2;
      else if (tier === 'HOT') bountyMultiplier = 1.5;

      // Higher score for richer and closer targets
      const score = (balance * 0.4 + 40) * bountyMultiplier / (distance + 4.0);

      if (score > highestScore) {
        highestScore = score;
        bestCar = candidate;
      }
    }

    return bestCar;
  }

  public reset(): void {
    this.previousTiers.clear();
  }
}
