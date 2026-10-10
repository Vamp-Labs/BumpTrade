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
  if (/^[0-9a-f]{40}$/.test(hex)) {
    const adjective = ADJECTIVES[parseInt(hex.slice(0, 2), 16) % ADJECTIVES.length];
    const animal = ANIMALS[parseInt(hex.slice(2, 4), 16) % ANIMALS.length];
    return `${adjective} ${animal} ${hex.slice(-4).toUpperCase()}`;
  }
  if (address.length < 8) return address;
  let h = 0;
  for (let i = 0; i < address.length; i++) h = (h * 31 + address.charCodeAt(i)) >>> 0;
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const animal = ANIMALS[(h >>> 8) % ANIMALS.length];
  return `${adjective} ${animal} ${address.slice(-4).toUpperCase()}`;
}
