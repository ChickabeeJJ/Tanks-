// Cosmetic skins. Tanks are BLUE by default; skins are bought with gems.
// The client draws each pattern procedurally onto a canvas texture.
export const SKINS = [
  { id: 'default', name: 'Default', price: 0, base: '#2a9dff', pattern: 'plain' },
  { id: 'crimson', name: 'Crimson', price: 1500, base: '#e8384a', pattern: 'plain' },
  { id: 'lime', name: 'Lime', price: 1500, base: '#59d14a', pattern: 'plain' },
  { id: 'grape', name: 'Grape', price: 1500, base: '#9d4ef0', pattern: 'plain' },
  { id: 'tiger', name: 'Tiger', price: 4000, base: '#f7a23b', alt: '#fff4e2', pattern: 'zigzag' },
  { id: 'zebra', name: 'Zebra', price: 4000, base: '#f4f4f4', alt: '#222222', pattern: 'stripes' },
  { id: 'camo', name: 'Camo', price: 6000, base: '#5c7a3a', alt: '#3c5226', alt2: '#8ea05a', pattern: 'blobs' },
  { id: 'polka', name: 'Polka', price: 6000, base: '#ff7ac3', alt: '#ffffff', pattern: 'dots' },
  { id: 'checker', name: 'Checker', price: 8000, base: '#ffffff', alt: '#2b2b2b', pattern: 'checker' },
  { id: 'tabby', name: 'Tabby Cat', price: 12000, base: '#9a9690', alt: '#5a5650', pattern: 'tabby' },
  { id: 'lava', name: 'Lava', price: 15000, base: '#3a1010', alt: '#ff6a1a', pattern: 'cracks' },
  { id: 'ice', name: 'Ice', price: 15000, base: '#bfeeff', alt: '#ffffff', pattern: 'cracks' },
  { id: 'galaxy', name: 'Galaxy', price: 25000, base: '#1b1240', alt: '#ffffff', pattern: 'stars' },
  { id: 'rainbow', name: 'Rainbow', price: 30000, base: '#ff0000', pattern: 'rainbow' },
  { id: 'gold', name: 'Gold', price: 50000, base: '#ffcf3a', alt: '#fff3b0', pattern: 'shine' },
  { id: 'frost', name: 'Frost (Event)', price: -1, base: '#7fd7ff', alt: '#ffffff', pattern: 'snow' },
  // Chest-exclusive skins (price -2). Frozen Chest:
  { id: 'glacier', name: 'Glacier', price: -2, rarity: 'common', base: '#9fdcff', alt: '#ffffff', pattern: 'cracks' },
  { id: 'aurora', name: 'Aurora', price: -2, rarity: 'rare', base: '#1b2a5c', alt: '#3cf0b0', alt2: '#a05cff', pattern: 'aurora' },
  { id: 'blizzard', name: 'Blizzard', price: -2, rarity: 'epic', base: '#2456c9', alt: '#ffffff', pattern: 'snow' },
  { id: 'diamond', name: 'Diamond', price: -2, rarity: 'legendary', base: '#5fe3ff', alt: '#e9fdff', pattern: 'shine' },
  { id: 'nebula', name: 'Nebula', price: -2, rarity: 'mythic', base: '#2a0f4f', alt: '#ff8ff0', pattern: 'stars' },
  // Lava Chest:
  { id: 'ember', name: 'Ember', price: -2, rarity: 'common', base: '#5a1a10', alt: '#ff8a2a', pattern: 'cracks' },
  { id: 'magma', name: 'Magma', price: -2, rarity: 'rare', base: '#d63a12', alt: '#ff9d1c', alt2: '#7a1508', pattern: 'blobs' },
  { id: 'inferno', name: 'Inferno', price: -2, rarity: 'epic', base: '#ff3b1c', alt: '#ffd21f', pattern: 'zigzag' },
  { id: 'sunforge', name: 'Sunforge', price: -2, rarity: 'legendary', base: '#ff9a1c', alt: '#fff2a8', pattern: 'shine' },
  { id: 'eclipse', name: 'Eclipse', price: -2, rarity: 'mythic', base: '#120a1c', alt: '#ffb340', pattern: 'aurora', alt2: '#ff3b1c' },
];
export const RARITY = {
  common: { name: 'Common', color: '#9fb3c8', dark: '#5b6d80' },
  rare: { name: 'Rare', color: '#3aa9ff', dark: '#105e9e' },
  epic: { name: 'Epic', color: '#b14cf0', dark: '#5f1d8c' },
  legendary: { name: 'Legendary', color: '#ffb31a', dark: '#9a5a00' },
  mythic: { name: 'Mythic', color: '#ff3b6b', dark: '#8c0f2c' },
};
export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const SKIN_IDS = SKINS.map((s) => s.id);
