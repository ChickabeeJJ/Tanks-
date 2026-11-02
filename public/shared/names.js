// Bot display names (bots are always flagged as bots in the player list).
const A = ['Tank', 'Blast', 'Pixel', 'Turbo', 'Frost', 'Shadow', 'Rocket', 'Cosmic', 'Lucky', 'Mega', 'Ninja', 'Neon',
  'Storm', 'Bubble', 'Captain', 'Silent', 'Hyper', 'Spicy', 'Crimson', 'Golden', 'Atomic', 'Sneaky', 'Dizzy', 'Iron'];
const B = ['Wolf', 'Fox', 'Panda', 'Gamer', 'Cannon', 'Shark', 'Tiger', 'Bean', 'Duck', 'Knight', 'Hawk', 'Dragon',
  'Taco', 'Noodle', 'Comet', 'Viper', 'Bear', 'Moose', 'Otter', 'Byte', 'Blaster', 'Sniper', 'Potato', 'Raccoon'];

export function botName(rng = Math.random) {
  const a = A[Math.floor(rng() * A.length)];
  const b = B[Math.floor(rng() * B.length)];
  const style = rng();
  if (style < 0.35) return a + b + Math.floor(rng() * 999);
  if (style < 0.6) return a.toLowerCase() + '_' + b.toLowerCase();
  if (style < 0.8) return a + b;
  return b + 'x' + Math.floor(rng() * 99);
}

export function botLevel(rng = Math.random) {
  const r = rng();
  if (r < 0.35) return 1 + Math.floor(rng() * 20);
  if (r < 0.65) return 15 + Math.floor(rng() * 30);
  if (r < 0.85) return 40 + Math.floor(rng() * 80);
  return 110 + Math.floor(rng() * 380);
}
