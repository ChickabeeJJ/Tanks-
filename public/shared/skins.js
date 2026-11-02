// Cosmetic skins. Tanks are BLUE by default; skins are bought with gems.
// The client draws each pattern procedurally onto a canvas texture.
export const SKINS = [
  { id: 'default', name: 'Default', price: 0, base: '#3d9df2', pattern: 'plain' },
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
];
export const SKIN_MAP = Object.fromEntries(SKINS.map((s) => [s.id, s]));
export const SKIN_IDS = SKINS.map((s) => s.id);
