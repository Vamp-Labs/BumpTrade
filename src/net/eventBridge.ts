import * as THREE from 'three';
import type { CollisionEvent, CollisionTier, SkillMomentType } from '../collision/CollisionTypes';
import { EventBus } from '../core/EventBus';
import type { HeroCar } from '../vehicles/HeroCar';
import { Skill } from '@bump/shared';
import { MarketEventKind, type BumpTier, type ServerEvent } from './protocol';

export interface ArenaVisualHooks {
  fire(): void;
  surge(): void;
  crash(): void;
  flash(): void;
}

export interface BridgeHost {
  localWallet: string;
  findCar(wallet: string): HeroCar | undefined;
  carId(wallet: string): string;
  visuals: ArenaVisualHooks;
}

type BumpEvent = Extract<ServerEvent, { t: 'bump' }>;
type EliminateEvent = Extract<ServerEvent, { t: 'eliminate' }>;
type MarketEvent = Extract<ServerEvent, { t: 'marketEvent' }>;

const TIER_MAP: Record<BumpTier, CollisionTier> = {
  LIGHT: 'LIGHT',
  HEAVY: 'HEAVY',
  PERFECT: 'PERFECT',
  CRITICAL: 'CRITICAL',
};

const INTENSITY: Record<BumpTier, number> = {
  LIGHT: 0.35,
  HEAVY: 0.8,
  PERFECT: 0.9,
  CRITICAL: 1,
};

const SKILL_BITS: ReadonlyArray<readonly [number, SkillMomentType]> = [
  [Skill.BANK, 'BANK_SHOT'],
  [Skill.DRIFT, 'DRIFT_BUMP'],
  [Skill.BOOST, 'BOOST_CRASH'],
  [Skill.DOUBLE, 'DOUBLE_IMPACT'],
  [Skill.REVENGE, 'REVENGE'],
];

function skillsFromMask(mask: number): SkillMomentType[] {
  const skills: SkillMomentType[] = [];
  for (const [bit, skill] of SKILL_BITS) {
    if (mask & bit) skills.push(skill);
  }
  return skills;
}

export class EventBridge {
  constructor(private readonly host: BridgeHost) {}

  public bump(event: BumpEvent): void {
    const bus = EventBus.get();
    const position = new THREE.Vector3(event.x, 0.4, event.z);
    const normal = new THREE.Vector3(event.nx, 0, event.nz);
    const isWall = event.kind === 'wall';
    const victim = this.host.findCar(event.victim);
    const attacker = isWall ? undefined : this.host.findCar(event.attacker);
    const collision: CollisionEvent = {
      attackerId: isWall ? 'wall' : this.host.carId(event.attacker),
      victimId: this.host.carId(event.victim),
      position,
      normal,
      relativeVelocity: new THREE.Vector3(),
      impactSpeed: 0,
      impactForce: 0,
      intensity: INTENSITY[event.tier],
      tier: TIER_MAP[event.tier],
      timestamp: performance.now(),
      stolenCash: event.amount,
      skillMoments: skillsFromMask(event.skills),
      isWall,
      isHeadOn: (event.skills & Skill.HEAD_ON) !== 0,
    };
    victim?.controller.handleCollision(collision, false);
    attacker?.controller.handleCollision(collision, true);
    bus.emit('collision', collision);
    if (event.amount > 0) {
      bus.emit('money_scatter', { position, amount: event.amount, normal });
    }
  }

  public eliminate(event: EliminateEvent): void {
    const car = this.host.findCar(event.car);
    if (!car) return;
    const at = car.controller.getPhysicsState().position;
    car.controller.eliminate();
    if (event.cause === 'voidPit') {
      EventBus.get().emit('vehicle_liquidated', {
        carId: this.host.carId(event.car),
        pitLocation: { x: at.x, z: at.z },
      });
    }
  }

  public marketEvent(event: MarketEvent): void {
    const bus = EventBus.get();
    bus.emit('arena_event', { type: 'market', title: event.title, subtitle: 'MARKET EVENT ACTIVE' });
    bus.emit('market_event_telegraph', {
      secondsLeft: 0,
      eventName: event.title,
      subtitle: 'MARKET EVENT ACTIVE',
      isFinal: true,
    });
    switch (event.kind) {
      case MarketEventKind.DOUBLE_STEAL_SURGE:
        this.host.visuals.surge();
        break;
      case MarketEventKind.MARKET_CRASH:
        this.host.visuals.crash();
        break;
      case MarketEventKind.MARKET_FLASH:
        this.host.visuals.flash();
        break;
      case MarketEventKind.FIRE_BURST:
      case MarketEventKind.FINAL_20:
        this.host.visuals.fire();
        break;
      default:
        break;
    }
  }
}
