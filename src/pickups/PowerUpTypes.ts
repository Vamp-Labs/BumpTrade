export type PowerUpType = 'TURBO' | 'HEAVY_HIT' | 'CASH_MAGNET' | 'SHIELD' | 'TITAN';

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  icon: string;
  color: number;
  glowColor: string;
  duration: number; // in seconds
  description: string;
  badgeText: string;
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  TURBO: {
    type: 'TURBO',
    name: 'HYPER TURBO',
    icon: '⚡',
    color: 0x00e5ff,
    glowColor: '#00e5ff',
    duration: 7.0,
    description: '+50% SPEED & INSTANT BOOST REFILL',
    badgeText: '⚡ TURBO',
  },
  HEAVY_HIT: {
    type: 'HEAVY_HIT',
    name: 'TITAN RAM',
    icon: '🦏',
    color: 0xff6600,
    glowColor: '#ff6600',
    duration: 8.0,
    description: '1.75× SIZE, 2.5× MASS & 2× STEAL',
    badgeText: '🦏 TITAN RAM',
  },
  TITAN: {
    type: 'TITAN',
    name: 'TITAN RAM',
    icon: '🦏',
    color: 0xff6600,
    glowColor: '#ff6600',
    duration: 8.0,
    description: '1.75× SIZE, 2.5× MASS & 2× STEAL',
    badgeText: '🦏 TITAN RAM',
  },
  CASH_MAGNET: {
    type: 'CASH_MAGNET',
    name: 'BAG VORTEX',
    icon: '🧲',
    color: 0xbd00ff,
    glowColor: '#bd00ff',
    duration: 8.0,
    description: '3.5× CASH VORTEX GRAVITATIONAL SUCTION',
    badgeText: '🧲 MAGNET',
  },
  SHIELD: {
    type: 'SHIELD',
    name: 'KINETIC REFLECTOR',
    icon: '🛡',
    color: 0x00ff88,
    glowColor: '#00ff88',
    duration: 6.0,
    description: '100% LOSS IMMUNITY + 80% DEFLECTION',
    badgeText: '🛡 SHIELD',
  },
};

