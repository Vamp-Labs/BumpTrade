import * as THREE from 'three';

export type CollisionTier = 'LIGHT' | 'HEAVY' | 'PERFECT' | 'CRITICAL';

export type SkillMomentType =
  | 'PERFECT_BUMP'
  | 'COUNTER_CRASH'
  | 'BANK_SHOT'
  | 'WALL_SLAM'
  | 'DRIFT_BUMP'
  | 'BOOST_CRASH'
  | 'DOUBLE_IMPACT'
  | 'CHAIN_BUMP'
  | 'REVENGE'
  | 'PINNED'
  | 'CLOSE_CALL';

export interface CollisionEvent {
  attackerId: string;
  victimId: string;
  position: THREE.Vector3;
  normal: THREE.Vector3; // Points from attacker toward victim
  relativeVelocity: THREE.Vector3;
  impactSpeed: number; // In m/s
  impactForce: number; // In Newtons (approximate)
  intensity: number; // Normalized 0.0 to 1.0
  tier: CollisionTier;
  timestamp: number;
  comboCount?: number;
  comboMultiplier?: number;
  skillMoments?: SkillMomentType[];
  stolenCash?: number;
  angleQuality?: 'BAD' | 'GOOD' | 'PERFECT';
  speedMultiplier?: number;
  isHeadOn?: boolean;
  isWall?: boolean;
  isVictimDead?: boolean;
  isAttackerDead?: boolean;
}

export interface SkillMomentEvent {
  type: SkillMomentType;
  attackerId: string;
  victimId?: string;
  stolenCash?: number;
  position?: THREE.Vector3;
  title: string;
  subtitle: string;
  comboCount?: number;
  comboMultiplier?: number;
}

export interface ImpactJuiceHooks {
  playImpactSpark?: (position: THREE.Vector3, intensity: number) => void;
  playImpactFlash?: (position: THREE.Vector3, intensity: number) => void;
  playTireSkid?: (position: THREE.Vector3, intensity: number) => void;
  playImpactSound?: (position: THREE.Vector3, intensity: number) => void;
  cameraShake?: (intensity: number, normal?: THREE.Vector3) => void;
  cameraPunch?: (direction: THREE.Vector3, magnitude: number) => void;
  hitStop?: (duration: number) => void;
}
