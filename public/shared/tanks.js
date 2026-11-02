// Tank class tree. Every tank is data: a list of barrels + body modifiers.
// Barrel fields: a = angle offset (rad), ox = sideways offset, len = length from
// tank centre, w = width, delay = reload phase (0..1), dmg/pen/spd/rel/life = multipliers,
// spread = random angle, bs = bullet size, kind = bullet type, pellets = bullets per shot,
// cone = >0 widens barrel tip (machine-gun look), recoil = recoil multiplier.

const PI = Math.PI;

function b(o = {}) {
  return Object.assign({
    a: 0, ox: 0, len: 3.4, w: 1.0, delay: 0, dmg: 1, pen: 1, spd: 1, rel: 1,
    spread: 0.04, bs: 1, kind: 'bullet', recoil: 1, life: 1, cone: 0, pellets: 1, maxOrb: 0,
  }, o);
}

const LIST = [];
function T(id, name, cls, tier, level, parent, barrels, extra = {}) {
  const def = {
    id, name, cls, tier, level, parent, barrels,
    body: Object.assign({ speed: 1, hp: 1, bodyDmg: 1, size: 1, spikes: 0, regen: 1 }, extra.body || {}),
    unlock: extra.unlock || { type: 'level' },
    fov: extra.fov || 1,
    special: extra.special || null,
    desc: extra.desc || '',
  };
  LIST.push(def);
  return def;
}

const dirs = (n, o = {}) => Array.from({ length: n }, (_, i) => b(Object.assign({ a: (i * 2 * PI) / n, delay: (i % 2) * 0.5 }, o)));

// ---------- Tier 0 ----------
T('default', 'Default', 'Shooter', 0, 0, null, [b()], { desc: 'The classic tank.' });

// ---------- Tier 1 (Lv 15) ----------
T('double', 'Double', 'Shooter', 1, 15, 'default',
  [b({ ox: -0.5, w: 0.8, dmg: 0.7 }), b({ ox: 0.5, w: 0.8, dmg: 0.7, delay: 0.5 })], { desc: 'Two barrels side by side.' });
T('scout', 'Scout', 'Sniper', 1, 15, 'default',
  [b({ len: 4.4, w: 0.8, spd: 1.5, dmg: 1.5, pen: 1.2, rel: 1.5, life: 1.45, spread: 0.01 })], { fov: 1.15, desc: 'Long range sniper.' });
T('spammer', 'Gatling', 'Spammer', 1, 15, 'default',
  [b({ len: 3.2, w: 1.0, cone: 1.5, rel: 0.5, dmg: 0.6, pen: 0.8, spread: 0.25, bs: 0.9 })], { desc: 'Fires very fast, inaccurate.' });
T('side', 'Flanker', 'Shooter', 1, 15, 'default',
  [b(), b({ a: PI / 2, len: 3.0, w: 0.8, dmg: 0.7, delay: 0.5 }), b({ a: -PI / 2, len: 3.0, w: 0.8, dmg: 0.7, delay: 0.5 })], { desc: 'Covers your sides.' });
T('grinder', 'Sawblade', 'Melee', 1, 15, 'default', [],
  { body: { speed: 1.12, hp: 1.25, bodyDmg: 2.4, spikes: 1 }, desc: 'Ram everything.' });
T('freezer', 'Cryo', 'Special', 1, 15, 'default',
  [b({ kind: 'freeze', w: 1.1, dmg: 0.8, rel: 1.1 })], { desc: 'Bullets slow enemies.' });
T('flame', 'Flame', 'Flame', 1, 15, 'default',
  [b({ kind: 'flame', len: 3.0, w: 1.2, cone: 1.3, rel: 0.1, dmg: 0.22, pen: 3, spd: 0.55, life: 0.45, spread: 0.3, bs: 1.1, recoil: 0.1 })],
  { desc: 'Short range flamethrower.' });
T('railgun', 'Railgun', 'Sniper', 1, 15, 'default',
  [b({ kind: 'rail', len: 5.0, w: 1.05, rel: 2.3, dmg: 6.5, pen: 6, spd: 2.5, life: 0.85, bs: 0.75, spread: 0, recoil: 3.5 })],
  { fov: 1.25, unlock: { type: 'gems', price: 60000 }, desc: 'Fires a long neon beam that pierces everything in its path.' });
T('blastlord', 'Bombardier', 'Special', 1, 15, 'default',
  [b({ kind: 'blast', len: 3.2, w: 1.7, rel: 2.0, dmg: 2.0, pen: 2, spd: 0.75, bs: 1.6, recoil: 3 })],
  { unlock: { type: 'quest', quest: 'u_kill25' }, desc: 'Explosive shells.' });

// ---------- Specials from chests & the wheel (Lv 1, branch off Default) ----------
T('delta', 'Arrowhead', 'Special', 1, 1, 'default',
  [b({ len: 3.7, dmg: 1.1 }), b({ a: PI - 0.5, len: 3.0, w: 0.8, dmg: 0.5, recoil: 2.2, delay: 0.5 }), b({ a: PI + 0.5, len: 3.0, w: 0.8, dmg: 0.5, recoil: 2.2, delay: 0.5 })],
  { unlock: { type: 'gems', price: 8000 }, body: { speed: 1.1 }, desc: 'Fast boosters.' });
T('recursive', 'Splitter', 'Special', 1, 1, 'default',
  [b({ kind: 'split', w: 1.2, rel: 1.4, dmg: 1.0, pen: 1.2 })], { unlock: { type: 'gems', price: 12000 }, desc: 'Bullets split.' });
T('ultraspiker', 'Bramble', 'Melee', 1, 1, 'default', [],
  { unlock: { type: 'gems', price: 18000 }, body: { speed: 1.12, hp: 1.5, bodyDmg: 3.2, spikes: 2 }, desc: 'Brutal rammer.' });
T('prime', 'Paragon', 'Special', 1, 1, 'default',
  [b({ len: 3.9, w: 1.3, dmg: 2.2, pen: 2, rel: 1.15 }), b({ a: 0.6, len: 2.9, w: 0.7, dmg: 0.6, delay: 0.5 }), b({ a: -0.6, len: 2.9, w: 0.7, dmg: 0.6, delay: 0.5 })],
  { unlock: { type: 'gems', price: 22000 }, body: { hp: 1.2 }, desc: 'Heavy hitter.' });
T('phantom', 'Phantom', 'Special', 1, 1, 'default',
  [b({ len: 4.6, w: 0.85, spd: 1.7, dmg: 2.0, pen: 1.5, rel: 1.6, life: 1.4, spread: 0.01 })],
  { unlock: { type: 'gems', price: 35000 }, special: 'stealth', fov: 1.25, desc: 'Turns invisible when still.' });
T('allspiker', 'Thornball', 'Melee', 1, 1, 'default', [],
  { unlock: { type: 'wheel' }, body: { speed: 1.18, hp: 1.4, bodyDmg: 3.0, spikes: 3 }, desc: 'Wheel exclusive [PERM].' });
T('ultra', 'Colossus', 'Special', 1, 1, 'default', dirs(4, { w: 1.3, dmg: 1.1, rel: 1.2 }),
  { unlock: { type: 'wheel' }, body: { size: 1.3, hp: 1.6, speed: 0.9, bodyDmg: 1.6, spikes: 1 }, desc: 'Wheel exclusive [PERM]. Huge.' });

// ---------- Tier 2 (Lv 30) ----------
T('triway', 'Tri-Shot', 'Shooter', 2, 30, 'double',
  [b({ a: -0.4, w: 0.85, dmg: 0.75, delay: 0.5 }), b({ dmg: 0.75 }), b({ a: 0.4, w: 0.85, dmg: 0.75, delay: 0.5 })]);
T('doubleside', 'Twin Flank', 'Shooter', 2, 30, 'double',
  [b({ ox: -0.5, w: 0.8, dmg: 0.7 }), b({ ox: 0.5, w: 0.8, dmg: 0.7, delay: 0.5 }), b({ a: PI / 2, len: 3.0, w: 0.8, dmg: 0.7, delay: 0.25 }), b({ a: -PI / 2, len: 3.0, w: 0.8, dmg: 0.7, delay: 0.75 })]);
T('fourdouble', 'Twin Cross', 'Shooter', 2, 30, 'double',
  [0, 1, 2, 3].flatMap((i) => [b({ a: (i * PI) / 2, ox: -0.45, w: 0.75, dmg: 0.55 }), b({ a: (i * PI) / 2, ox: 0.45, w: 0.75, dmg: 0.55, delay: 0.5 })]),
  { unlock: { type: 'gems', price: 5000 } });
T('hybrid', 'Hybrid', 'Shooter', 2, 30, 'double',
  [b({ ox: -0.5, w: 0.8, dmg: 0.75 }), b({ ox: 0.5, w: 0.8, dmg: 0.75, delay: 0.5 }), b({ a: PI, kind: 'blast', w: 1.4, len: 3.0, rel: 2.2, dmg: 1.2, spd: 0.7, bs: 1.3, recoil: 2 })]);
T('opticon', 'Focus', 'Shooter', 2, 30, 'double',
  [b({ len: 3.8, dmg: 0.8 }), b({ ox: -0.75, a: 0.08, len: 3.2, w: 0.8, dmg: 0.6, delay: 0.5 }), b({ ox: 0.75, a: -0.08, len: 3.2, w: 0.8, dmg: 0.6, delay: 0.5 })],
  { unlock: { type: 'gems', price: 10000 } });
T('hitman', 'Hitman', 'Sniper', 2, 30, 'scout',
  [b({ len: 4.9, w: 0.8, spd: 1.7, dmg: 2.0, pen: 1.6, rel: 1.7, life: 1.5, spread: 0.005 })], { fov: 1.25 });
T('hunter', 'Hunter', 'Sniper', 2, 30, 'scout',
  [b({ len: 4.6, w: 0.75, dmg: 1.1, spd: 1.6, rel: 1.3, life: 1.4, spread: 0.01 }), b({ len: 3.9, w: 1.05, dmg: 1.1, spd: 1.6, rel: 1.3, life: 1.4, delay: 0.25, spread: 0.01 })],
  { fov: 1.2, unlock: { type: 'gems', price: 8000 } });
T('buckshot', 'Buckshot', 'Spammer', 2, 30, 'spammer',
  [b({ len: 3.2, w: 1.3, cone: 1.4, rel: 1.4, pellets: 5, spread: 0.35, dmg: 0.6, bs: 0.75, recoil: 2.5 })]);
T('burst', 'Burst', 'Spammer', 2, 30, 'spammer',
  [b({ len: 3.4, w: 1.0, rel: 1.5, pellets: 3, spread: 0.02, dmg: 0.85, burst: 1 })], { unlock: { type: 'gems', price: 6000 } });
T('fourway', 'Fourway', 'Shooter', 2, 30, 'side', dirs(4, { dmg: 0.75 }));
T('sidetriple', 'Tri Flank', 'Shooter', 2, 30, 'side',
  [b({ a: -0.35, w: 0.8, dmg: 0.7, delay: 0.5 }), b({ dmg: 0.75 }), b({ a: 0.35, w: 0.8, dmg: 0.7, delay: 0.5 }), b({ a: PI / 2, len: 3.0, w: 0.8, dmg: 0.65 }), b({ a: -PI / 2, len: 3.0, w: 0.8, dmg: 0.65 })]);
T('sidespiker', 'Spike Flank', 'Melee', 2, 30, 'side',
  [b({ a: PI / 2, len: 3.0, w: 0.9, dmg: 0.8 }), b({ a: -PI / 2, len: 3.0, w: 0.9, dmg: 0.8, delay: 0.5 })],
  { body: { bodyDmg: 1.9, spikes: 1, speed: 1.08 }, unlock: { type: 'gems', price: 12000 } });
T('spiker', 'Spiker', 'Melee', 2, 30, 'grinder', [], { body: { speed: 1.12, hp: 1.35, bodyDmg: 3.0, spikes: 2 } });
T('plower', 'Bulldozer', 'Melee', 2, 30, 'grinder', [], { body: { speed: 1.3, hp: 1.2, bodyDmg: 2.6, spikes: 1 } });
T('fortress', 'Fortress', 'Melee', 2, 30, 'grinder', [b({ len: 3.2, w: 1.4, dmg: 1.0, rel: 1.4 })],
  { body: { speed: 0.82, hp: 2.2, bodyDmg: 2.4, size: 1.35, spikes: 1 }, unlock: { type: 'gems', price: 15000 } });
T('breaker', 'Breaker', 'Special', 2, 30, 'freezer',
  [b({ kind: 'freeze', w: 1.3, cone: 1.2, rel: 1.4, pellets: 4, spread: 0.3, dmg: 0.65, bs: 0.8 })]);
T('doubleflame', 'Double Flame', 'Flame', 2, 30, 'flame',
  [-0.5, 0.5].map((ox) => b({ ox, kind: 'flame', len: 3.0, w: 1.0, cone: 1.3, rel: 0.1, dmg: 0.2, pen: 3, spd: 0.55, life: 0.45, spread: 0.3, bs: 1.0, recoil: 0.1 })));
T('thunder', 'Thunder', 'Sniper', 2, 30, 'railgun',
  [b({ kind: 'rail', ox: -0.5, len: 5.0, w: 0.85, rel: 2.4, dmg: 4.5, pen: 6, spd: 2.5, life: 0.85, bs: 0.75, spread: 0 }),
    b({ kind: 'rail', ox: 0.5, len: 5.0, w: 0.85, rel: 2.4, dmg: 4.5, pen: 6, spd: 2.5, life: 0.85, bs: 0.75, spread: 0, delay: 0.5 })], { fov: 1.3 });
T('apex', 'Apex', 'Special', 2, 30, 'blastlord',
  [b({ kind: 'blast', len: 3.4, w: 1.9, rel: 2.1, dmg: 2.6, pen: 2.4, spd: 0.75, bs: 1.9, recoil: 3 })]);

// ---------- Tier 3 (Lv 42) ----------
T('triple', 'Triple', 'Shooter', 3, 42, 'triway',
  [b({ ox: -0.75, len: 3.1, w: 0.75, dmg: 0.65, delay: 0.5 }), b({ len: 3.6, w: 0.75, dmg: 0.65 }), b({ ox: 0.75, len: 3.1, w: 0.75, dmg: 0.65, delay: 0.5 })]);
T('fiveway', 'Penta Shot', 'Shooter', 3, 42, 'triway',
  [-0.7, -0.35, 0, 0.35, 0.7].map((a, i) => b({ a, w: 0.75, dmg: 0.6, delay: (i % 2) * 0.5, len: i === 2 ? 3.5 : 3.2 })));
T('tridouble', 'Twin Tri', 'Shooter', 3, 42, 'doubleside',
  [0, 1, 2].flatMap((i) => [b({ a: (i * 2 * PI) / 3, ox: -0.45, w: 0.75, dmg: 0.6 }), b({ a: (i * 2 * PI) / 3, ox: 0.45, w: 0.75, dmg: 0.6, delay: 0.5 })]));
T('sixway', 'Hexa', 'Shooter', 3, 42, 'fourdouble', dirs(6, { w: 0.85, dmg: 0.7 }), { unlock: { type: 'gems', price: 15000 } });
T('hiopticon', 'Hyperfocus', 'Shooter', 3, 42, 'opticon',
  [b({ len: 3.9, dmg: 0.8 }), ...[-1, 1].flatMap((s) => [b({ ox: 0.7 * s, a: -0.07 * s, len: 3.4, w: 0.75, dmg: 0.6, delay: 0.33 }), b({ ox: 1.3 * s, a: -0.12 * s, len: 3.0, w: 0.7, dmg: 0.55, delay: 0.66 })])],
  { unlock: { type: 'quest', quest: 'u_lv60' } });
T('orbitronjr', 'Satellite', 'Special', 3, 42, 'hybrid',
  [b({ kind: 'orbit', len: 2.8, w: 1.0, rel: 0.7, dmg: 0.9, pen: 3, maxOrb: 6, life: 7 }), b({ len: 3.4, w: 0.9, dmg: 0.8 })],
  { unlock: { type: 'gems', price: 20000 } });
T('ace', 'Ace', 'Sniper', 3, 42, 'hitman',
  [b({ len: 5.3, w: 0.85, spd: 1.9, dmg: 2.6, pen: 1.9, rel: 1.9, life: 1.55, spread: 0.003 })], { fov: 1.35 });
T('shadow', 'Shadow', 'Sniper', 3, 42, 'hitman',
  [b({ len: 4.9, w: 0.8, spd: 1.7, dmg: 2.1, pen: 1.6, rel: 1.75, life: 1.5, spread: 0.005 })], { fov: 1.3, special: 'stealth' });
T('birdshot', 'Birdshot', 'Spammer', 3, 42, 'buckshot',
  [b({ len: 3.3, w: 1.5, cone: 1.4, rel: 1.5, pellets: 8, spread: 0.42, dmg: 0.55, bs: 0.7, recoil: 3 })]);
T('scatter', 'Scatter', 'Spammer', 3, 42, 'buckshot',
  [-0.3, 0.3].map((a, i) => b({ a, len: 3.2, w: 1.2, cone: 1.3, rel: 1.4, pellets: 4, spread: 0.3, dmg: 0.55, bs: 0.7, delay: i * 0.5 })),
  { unlock: { type: 'gems', price: 9000 } });
T('eightway', 'Octo', 'Shooter', 3, 42, 'fourway', dirs(8, { w: 0.8, dmg: 0.62 }));
T('eater', 'Eater', 'Melee', 3, 42, 'spiker', [], { body: { speed: 1.15, hp: 1.4, bodyDmg: 3.1, spikes: 2 }, special: 'lifesteal' });
T('powerhouse', 'Juggernaut', 'Melee', 3, 42, 'spiker', [],
  { body: { speed: 0.98, hp: 1.7, bodyDmg: 4.0, size: 1.2, spikes: 2 }, unlock: { type: 'gems', price: 14000 } });
T('glacier', 'Permafrost', 'Special', 3, 42, 'breaker',
  [b({ kind: 'freeze', w: 1.6, len: 3.4, rel: 1.6, dmg: 1.6, pen: 2.5, bs: 1.5, spd: 0.8 })]);

// ---------- Mid tiers (Lv 60 / 80) ----------
T('godfather', 'Warlord', 'Shooter', 3, 60, 'triple',
  [b({ len: 4.0, w: 1.45, dmg: 1.6, pen: 1.8, rel: 1.15 }), b({ ox: -1.0, len: 3.3, w: 0.8, dmg: 0.6, delay: 0.5 }), b({ ox: 1.0, len: 3.3, w: 0.8, dmg: 0.6, delay: 0.5 }),
    b({ a: 0.55, len: 3.0, w: 0.75, dmg: 0.55, delay: 0.25 }), b({ a: -0.55, len: 3.0, w: 0.75, dmg: 0.55, delay: 0.75 })],
  { body: { hp: 1.15 }, desc: 'A heavy main cannon with a crew of escorts.' });
T('siren', 'Banshee', 'Spammer', 3, 80, 'birdshot',
  [b({ kind: 'freeze', len: 3.2, w: 1.7, cone: 1.5, rel: 1.6, pellets: 9, spread: 0.65, dmg: 0.5, bs: 0.6, spd: 1.15, life: 0.8, recoil: 2 })],
  { desc: 'Blasts a wide sonic wave that slows enemies.' });

// ---------- Tier 4 (Lv 110) ----------
T('phoenix', 'Phoenix', 'Flame', 4, 110, 'fiveway',
  [...[-0.45, 0, 0.45].map((a) => b({ a, kind: 'flame', len: 3.0, w: 0.9, cone: 1.3, rel: 0.1, dmg: 0.17, pen: 3, spd: 0.55, life: 0.45, spread: 0.25, bs: 0.9, recoil: 0.1 })),
    b({ a: PI / 2, len: 3.0, w: 0.8, dmg: 0.8 }), b({ a: -PI / 2, len: 3.0, w: 0.8, dmg: 0.8, delay: 0.5 })],
  { unlock: { type: 'gems', price: 30000 } });
T('orbitronsr', 'Constellation', 'Special', 4, 110, 'orbitronjr',
  [b({ kind: 'orbit', len: 2.8, w: 1.1, rel: 0.45, dmg: 1.0, pen: 3.5, maxOrb: 12, life: 8 }), b({ len: 3.6, w: 1.0, dmg: 1.0 }), b({ a: PI, len: 3.0, w: 0.9, dmg: 0.8, delay: 0.5 })],
  { unlock: { type: 'gems', price: 40000 } });
T('striker', 'Striker', 'Sniper', 4, 110, 'ace',
  [b({ kind: 'rail', len: 5.8, w: 1.1, rel: 2.0, dmg: 7.5, pen: 7, spd: 2.6, life: 0.9, bs: 0.8, spread: 0 })],
  { fov: 1.45, unlock: { type: 'gems', price: 35000 } });
T('blastking', 'Demolisher', 'Special', 4, 110, 'apex',
  [-0.5, 0.5].map((ox, i) => b({ ox, kind: 'blast', len: 3.4, w: 1.5, rel: 2.0, dmg: 2.2, pen: 2.2, spd: 0.8, bs: 1.6, recoil: 2, delay: i * 0.5 })));
T('megagrinder', 'Mega Saw', 'Melee', 4, 110, 'powerhouse', [],
  { body: { speed: 1.05, hp: 2.0, bodyDmg: 4.6, size: 1.3, spikes: 3 } });

export const TANKS = Object.fromEntries(LIST.map((t) => [t.id, t]));
export const TANK_LIST = LIST;

export function getTank(id) {
  return TANKS[id] || TANKS.default;
}

export function childrenOf(id) {
  return LIST.filter((t) => t.parent === id);
}

// Does a player (level + owned list) have access to this tank?
export function canUse(def, level, owned) {
  if (level < def.level) return false;
  if (def.unlock.type === 'level') return true;
  return owned.includes(def.id);
}

// Options to show in the Q menu for the current tank.
export function upgradeOptions(currentId, level, owned) {
  return childrenOf(currentId).filter((d) => {
    if ((d.unlock.type === 'chest' || d.unlock.type === 'wheel') && !owned.includes(d.id)) return false;
    return level >= d.level;
  });
}

export function pathTo(id) {
  const path = [];
  let d = TANKS[id];
  while (d) { path.unshift(d.id); d = d.parent ? TANKS[d.parent] : null; }
  return path;
}

// Derived combat stats for a tank instance.
export function derived(tankId, level, stats) {
  const def = getTank(tankId);
  const L = Math.min(level, 45);
  const s = stats;
  return {
    r: 2.0 * def.body.size,
    maxHp: Math.round((100 + 4 * L + 28 * s[4]) * def.body.hp),
    regen: (0.006 + 0.0045 * s[5]) * def.body.regen,
    speed: 17 * (1 + 0.055 * s[6]) * def.body.speed * (1 - L * 0.003),
    bodyDps: 40 * (1 + 0.45 * s[7]) * def.body.bodyDmg,
    bodyRes: 6 * (1 + 0.35 * s[7]) * Math.max(1, def.body.bodyDmg * 0.8),
    dmgMul: 1 + 0.16 * s[0],
    penMul: 1 + 0.4 * s[1],
    bspdMul: 1 + 0.07 * s[2],
    relMul: Math.max(0.35, 1 - 0.06 * s[3]),
    fov: def.fov,
  };
}
