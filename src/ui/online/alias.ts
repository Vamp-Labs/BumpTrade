const ADJECTIVES = [
  'BOLD', 'SWIFT', 'LUCKY', 'SALTY', 'NEON', 'TURBO', 'CHILL', 'SHARP',
  'WILD', 'GOLDEN', 'ROGUE', 'COSMIC', 'RAPID', 'STEADY', 'MIGHTY', 'CRAFTY',
];
const ANIMALS = [
  'BULL', 'BEAR', 'APE', 'WHALE', 'DOGE', 'SHARK', 'HODLER', 'TRADER',
  'FALCON', 'WOLF', 'TIGER', 'DRAGON', 'PANDA', 'FOX', 'HAWK', 'COBRA',
];

export function aliasFor(address: string): string {
  const hex = address.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(hex)) return address;
  const adjective = ADJECTIVES[parseInt(hex.slice(0, 2), 16) % ADJECTIVES.length];
  const animal = ANIMALS[parseInt(hex.slice(2, 4), 16) % ANIMALS.length];
  return `${adjective} ${animal} ${hex.slice(-4).toUpperCase()}`;
}
