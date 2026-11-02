// Shared constants used by the browser client AND the Node server.

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const SNAP_EVERY = 2; // online snapshots at 15 Hz

export const TEAM_COLORS = {
  0: 0x3d9df2, // FFA default (blue)
  1: 0x3d9df2, // blue
  2: 0xf0464f, // red
  3: 0x3fcf5a, // green
  4: 0xa64ef0, // purple
};
export const TEAM_NAMES = { 1: 'Blue', 2: 'Red', 3: 'Green', 4: 'Purple' };

export const MODES = {
  ffa: { id: 'ffa', name: 'Battle', half: 195, shapes: 420, maxHumans: 7, teams: 0, desc: 'Free for all' },
  teams: { id: 'teams', name: 'Red VS Blue', half: 205, shapes: 440, maxHumans: 7, teams: 2, desc: '2 teams' },
  four: { id: 'four', name: '4 Teams', half: 215, shapes: 470, maxHumans: 7, teams: 4, desc: '4 teams' },
};

// Shapes (the "farm" food). r = collision radius, dmg = contact damage per tick.
export const SHAPES = {
  cube: { idx: 0, r: 1.1, hp: 30, dmg: 6, xp: 60, gems: 0, color: 0xffd21f, sides: 4, h: 1.5, w: 60 },
  bcube: { idx: 1, r: 1.5, hp: 60, dmg: 7, xp: 150, gems: 0, color: 0x1fb0ff, sides: 4, h: 2.0, w: 22 },
  pent: { idx: 2, r: 2.2, hp: 150, dmg: 8, xp: 500, gems: 1, color: 0xff2d6b, sides: 5, h: 1.7, w: 12 },
  hex: { idx: 3, r: 3.0, hp: 500, dmg: 10, xp: 1500, gems: 4, color: 0x9b45ff, sides: 6, h: 1.9, w: 5 },
  alpha: { idx: 4, r: 6.0, hp: 4000, dmg: 12, xp: 7000, gems: 40, color: 0x24e6ff, sides: 6, h: 2.3, w: 0.35 },
};
export const SHAPE_LIST = ['cube', 'bcube', 'pent', 'hex', 'alpha'];

// The 8 upgradeable stats (order matches number keys 1-8).
export const STATS = [
  { key: 'dmg', name: 'Damage', color: '#f0323f', icon: '' },
  { key: 'pen', name: 'Bullet Health', color: '#f6c21a', icon: '' },
  { key: 'bspd', name: 'Bullet Speed', color: '#2b8ef5', icon: '' },
  { key: 'rel', name: 'Fire Rate', color: '#3fd34a', icon: '' },
  { key: 'mhp', name: 'Max Health', color: '#c03ae6', icon: '' },
  { key: 'regen', name: 'Health Regen', color: '#ee4ec2', icon: '' },
  { key: 'spd', name: 'Tank Speed', color: '#ff8a1c', icon: '' },
  { key: 'body', name: 'Body Damage', color: '#1fb3d8', icon: '' },
];
export const BASE_CAP = 8;
export const MAX_CAP = 15;

export const BULLET_KINDS = ['bullet', 'flame', 'freeze', 'rail', 'blast', 'split', 'orbit'];
export const FX = { POP: 0, BLAST: 1, HIT: 2, DEATH: 3, LEVEL: 4, RAIL: 5 };

// Movement response (per second). High = Roblox-like: near-instant start and stop, no ice-skating.
export const MOVE_ACCEL = 18;

// Servers: up to 7 players each; bots fill empty slots (never more than 6).
export const ROOM_SIZE = 7;
export const MAX_BOTS = 6;

export const SPAWN_SHIELD = 20; // seconds of spawn protection
export const COMBAT_TIME = 10; // seconds after being hit by a tank that you count as 'in combat'
