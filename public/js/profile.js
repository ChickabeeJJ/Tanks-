// Persistent player profile + all meta systems (quests, rank, wheel, chests, gifts, shops).
import { SDK } from './sdk.js';
import { addXp, xpForLevel } from '../shared/progression.js';
import { BASE_CAP, MAX_CAP } from '../shared/config.js';
import { TANKS } from '../shared/tanks.js';
import { SKIN_MAP } from '../shared/skins.js';

const KEY = 'tanks_save_v1';

export function dayId(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function weekId(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 1);
  return `${d.getFullYear()}w${Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7)}`;
}
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

function defaults() {
  return {
    v: 1, uid: uid(), name: '', level: 1, xp: 0, gems: 250,
    owned: [], skins: ['default'], skin: 'default',
    capUps: [0, 0, 0, 0, 0, 0, 0, 0], xpBoost: 0, gemBoost: 0,
    totalKills: 0, totalShapes: 0, totalPlay: 0, alphas: 0, deaths: 0, best: 0,
    wheel: { spins: 1, nextFree: 0, adDay: '', adSpins: 0 },
    chest: { freeAt: 0 },
    daily: { day: '', play: 0, kills: 0, shapes: 0, claimed: {} },
    weekly: { week: '', play: 0, kills: 0, shapes: 0, claimed: {} },
    unique: { claimed: {} },
    event: { shapes: 0, claimed: {} },
    rank: { idx: 1, pts: 0, day: '', play5: 0, playAcc: 0, kill: 0, ad: 0, invite: 0, tomorrow: 0, lastDay: '', streakReady: false },
    store: { starterDay: '', gemsAt: [0, 0, 0], xpAdAt: 0 },
    settings: { sfx: 0.7, quality: 'high', names: true, sens: 1, shadows: true },
  };
}

function merge(base, saved) {
  for (const k of Object.keys(saved || {})) {
    if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof saved[k] === 'object') merge(base[k], saved[k]);
    else base[k] = saved[k];
  }
  return base;
}

// ------------------------------------------------------------------ static tables
export const RANK_TIERS = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'];
export const RANK_COLORS = ['#d98a4a', '#c9d3e0', '#ffcf3a', '#7ff0e0', '#7fc4ff', '#ff7af0'];
export const rankTier = (idx) => RANK_TIERS[Math.min(RANK_TIERS.length - 1, Math.floor((idx - 1) / 5))];
export const rankNeed = (idx) => 175 + 15 * idx;
export const MAX_RANK = 30;

export const RANK_TASKS = [
  { id: 'tomorrow', label: 'Join Tomorrow', pts: 250, max: 1 },
  { id: 'play5', label: 'Play for 5 mins', pts: 15, max: 4 },
  { id: 'ad', label: 'Spin the Wheel', pts: 150, max: 1 },
  { id: 'invite', label: 'Invite a Friend', pts: 50, max: 1 },
  { id: 'kill', label: 'Get a Kill', pts: 20, max: 5 },
];

export const QUESTS = {
  daily: [
    { id: 'd_xp1', name: 'Daily XP 1', reqs: [{ k: 'd.play', n: 900, label: 'Play for 15 mins', time: true }, { k: 'd.kills', n: 5, label: 'Kill 5 tanks' }], reward: { xpLv: 1.1 } },
    { id: 'd_gems1', name: 'Daily Gems 1', after: 'd_xp1', reqs: [{ k: 'd.shapes', n: 150, label: 'Destroy 150 shapes' }], reward: { gems: 2500 } },
    { id: 'd_xp2', name: 'Daily XP 2', after: 'd_gems1', reqs: [{ k: 'd.play', n: 1800, label: 'Play for 30 mins', time: true }, { k: 'd.kills', n: 15, label: 'Kill 15 tanks' }], reward: { xpLv: 2 } },
  ],
  weekly: [
    { id: 'w_1', name: 'Weekly Grind', reqs: [{ k: 'w.play', n: 7200, label: 'Play for 2 hours', time: true }, { k: 'w.kills', n: 50, label: 'Kill 50 tanks' }, { k: 'w.shapes', n: 1500, label: 'Destroy 1,500 shapes' }], reward: { gems: 20000, xpLv: 4 } },
  ],
  unique: [
    { id: 'u_lv25', name: 'Rookie', reqs: [{ k: 'level', n: 25, label: 'Reach Level 25' }], reward: { gems: 2000 } },
    { id: 'u_kill25', name: 'Bombardier', reqs: [{ k: 'totalKills', n: 25, label: 'Kill 25 tanks' }], reward: { tank: 'blastlord' } },
    { id: 'u_lv60', name: 'Hyperfocus', reqs: [{ k: 'level', n: 60, label: 'Reach Level 60' }], reward: { tank: 'hiopticon' } },
    { id: 'u_alpha', name: 'Alpha Hunter', reqs: [{ k: 'alphas', n: 5, label: 'Destroy 5 Alpha shapes' }], reward: { gems: 10000 } },
    { id: 'u_lv150', name: 'Veteran', reqs: [{ k: 'level', n: 150, label: 'Reach Level 150' }], reward: { gems: 25000 } },
  ],
  event: [
    { id: 'e_frost', name: 'Snow Event', reqs: [{ k: 'e.shapes', n: 1000, label: 'Destroy 1,000 shapes' }], reward: { skin: 'frost' } },
  ],
};

// Playtime gifts (12, like the original). xpLv = fraction of the XP needed for your current level.
export const GIFTS = [
  { at: 60, r: { xpLv: 0.06 } }, { at: 150, r: { xpLv: 0.11 } }, { at: 240, r: { gems: 600 } }, { at: 360, r: { xpLv: 0.22 } },
  { at: 600, r: { gems: 1100 } }, { at: 900, r: { xpLv: 0.28 } }, { at: 1260, r: { xpLv: 0.54 } }, { at: 1680, r: { xpLv: 0.32 } },
  { at: 2160, r: { gems: 1800 } }, { at: 2640, r: { xpLv: 1.1 } }, { at: 3240, r: { gems: 3000 } }, { at: 3900, r: { xpLv: 5.4 }, mega: true },
];

export const WHEEL = [
  { id: 'xp1', label: 'XP', xpLv: 0.15, odds: 24, color: '#ffb020' },
  { id: 'gem1', label: 'Gems', gems: 2500, odds: 18, color: '#25b8f0' },
  { id: 'xp2', label: 'XP', xpLv: 0.4, odds: 16, color: '#36c95f' },
  { id: 'allspiker', label: 'Thornball', tank: 'allspiker', odds: 4, color: '#ff4f7a' },
  { id: 'gem2', label: 'Gems', gems: 7500, odds: 12, color: '#9b5cff' },
  { id: 'xp3', label: 'XP', xpLv: 0.85, odds: 14, color: '#ff7a2a' },
  { id: 'ultra', label: 'Colossus', tank: 'ultra', odds: 2, color: '#e8455c' },
  { id: 'gem3', label: 'Gems', gems: 15000, odds: 10, color: '#1fbfa6' },
];

export const CHESTS = [
  { id: 'frozen', name: 'Frost Chest', price: 5000, color: '#9fe6ff', dark: '#2a7fb0',
    drops: [['glacier', 45], ['aurora', 30], ['blizzard', 18], ['diamond', 6], ['nebula', 1]] },
  { id: 'lava', name: 'Molten Chest', price: 20000, color: '#ff8a2a', dark: '#a3360a',
    drops: [['ember', 45], ['magma', 30], ['inferno', 18], ['sunforge', 6], ['eclipse', 1]] },
];

export const STORE_GEMS = [
  { name: 'Stock of Gems', gems: 300, cd: 120 },
  { name: 'Pile of Gems', gems: 800, cd: 600 },
  { name: 'Bag of Gems', gems: 2000, cd: 1800 },
];

export const capPrice = (n) => Math.round(1500 * (n + 1) ** 2);
export const boostPrice = (n) => Math.round(5000 * (n + 1) ** 1.6);

// ------------------------------------------------------------------ profile object
const listeners = new Set();
let saveTimer = 0;

export const profile = {
  d: defaults(),
  session: { start: performance.now(), claimedGifts: new Set(), playSec: 0 },

  load() {
    // Read both the CrazyGames cloud save and the local mirror; keep whichever has more progress.
    const { cg, ls } = SDK.getItems(KEY);
    const parse = (t) => { try { return JSON.parse(t || 'null'); } catch { return null; } };
    const a = parse(cg), b = parse(ls);
    const score = (x) => (x ? (x.level || 1) * 1e9 + (x.xp || 0) + (x.savedAt || 0) / 1e13 : -1);
    const saved = score(a) >= score(b) ? a : b;
    this.d = merge(defaults(), saved || {});
    this.rollPeriods();
    // daily login: "Join Tomorrow" task becomes claimable on a new day
    const today = dayId();
    const r = this.d.rank;
    if (r.lastDay && r.lastDay !== today) r.streakReady = true;
    r.lastDay = today;
    this.save();
  },

  save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => this.saveNow(), 1500);
  },
  saveNow() {
    clearTimeout(saveTimer);
    this.d.savedAt = Date.now();
    SDK.setItem(KEY, JSON.stringify(this.d));
  },

  on(f) { listeners.add(f); return () => listeners.delete(f); },
  emit(what) { listeners.forEach((f) => f(what)); this.save(); },

  rollPeriods() {
    const d = this.d;
    const today = dayId(), week = weekId();
    if (d.daily.day !== today) d.daily = { day: today, play: 0, kills: 0, shapes: 0, claimed: {} };
    if (d.weekly.week !== week) d.weekly = { week, play: 0, kills: 0, shapes: 0, claimed: {} };
    if (d.rank.day !== today) Object.assign(d.rank, { day: today, play5: 0, kill: 0, ad: 0, invite: 0, tomorrow: 0, playAcc: d.rank.playAcc || 0 });
  },

  // ---------------- currencies
  get level() { return this.d.level; },
  get gems() { return this.d.gems; },
  addXp(amount) {
    const r = addXp(this.d.level, this.d.xp, Math.round(amount));
    this.d.level = r.level;
    this.d.xp = r.xp;
    this.emit('xp');
    if (r.gained) this.saveNow();
    return r.gained;
  },
  xpLv(k) { return Math.round(xpForLevel(this.d.level) * k); },
  setLevelXp(lv, xp) {
    if (lv !== this.d.level || xp !== this.d.xp) {
      const up = lv !== this.d.level;
      this.d.level = lv;
      this.d.xp = xp;
      this.emit('xp');
      if (up) this.saveNow();
    }
  },
  addGems(n) { this.d.gems += Math.round(n); this.emit('gems'); },
  spend(n) {
    if (this.d.gems < n) return false;
    this.d.gems -= n;
    this.emit('gems');
    return true;
  },

  // ---------------- ownership
  ownsTank(id) { return this.d.owned.includes(id); },
  giveTank(id) { if (!this.ownsTank(id) && TANKS[id]) { this.d.owned.push(id); this.emit('owned'); return true; } return false; },
  ownsSkin(id) { return this.d.skins.includes(id); },
  giveSkin(id) { if (!this.ownsSkin(id) && SKIN_MAP[id]) { this.d.skins.push(id); this.emit('skins'); return true; } return false; },
  equipSkin(id) { if (this.ownsSkin(id)) { this.d.skin = id; this.emit('skin'); } },
  caps() { return this.d.capUps.map((c) => Math.min(MAX_CAP, BASE_CAP + c)); },
  xpMul() { return 1 + 0.1 * this.d.xpBoost; },
  gemMul() { return 1 + 0.1 * this.d.gemBoost; },

  grant(r, why) {
    const out = [];
    if (r.gems) { this.addGems(r.gems); out.push(`+${r.gems.toLocaleString()} Gems`); }
    if (r.xpLv) { const v = this.xpLv(r.xpLv); this.addXp(v); out.push(`+${v.toLocaleString()} XP`); }
    if (r.xp) { this.addXp(r.xp); out.push(`+${r.xp.toLocaleString()} XP`); }
    if (r.spins) { this.d.wheel.spins += r.spins; out.push(`+${r.spins} Spin${r.spins > 1 ? 's' : ''}`); this.emit('wheel'); }
    if (r.tank) { this.giveTank(r.tank); out.push(`${TANKS[r.tank].name} tank!`); }
    if (r.skin) { this.giveSkin(r.skin); out.push(`${SKIN_MAP[r.skin].name} skin!`); }
    return out;
  },

  // ---------------- stats from the arena
  trackPlay(sec) {
    this.rollPeriods();
    const d = this.d;
    d.totalPlay += sec;
    d.daily.play += sec;
    d.weekly.play += sec;
    this.session.playSec += sec;
    d.rank.playAcc = (d.rank.playAcc || 0) + sec;
    while (d.rank.playAcc >= 300) {
      d.rank.playAcc -= 300;
      if (d.rank.play5 < 4) d.rank.play5++;
    }
    this.save();
  },
  trackKills(n) {
    this.rollPeriods();
    const d = this.d;
    d.totalKills += n; d.daily.kills += n; d.weekly.kills += n;
    d.rank.kill = Math.min(5, d.rank.kill + n);
    this.emit('quest');
  },
  trackShapes(n) {
    this.rollPeriods();
    const d = this.d;
    d.totalShapes += n; d.daily.shapes += n; d.weekly.shapes += n; d.event.shapes += n;
    this.save();
  },

  // ---------------- quests
  questValue(k) {
    const d = this.d;
    switch (k) {
      case 'd.play': return d.daily.play;
      case 'd.kills': return d.daily.kills;
      case 'd.shapes': return d.daily.shapes;
      case 'w.play': return d.weekly.play;
      case 'w.kills': return d.weekly.kills;
      case 'w.shapes': return d.weekly.shapes;
      case 'e.shapes': return d.event.shapes;
      case 'level': return d.level;
      case 'totalKills': return d.totalKills;
      case 'alphas': return d.alphas;
      default: return 0;
    }
  },
  questStore(cat) {
    return cat === 'daily' ? this.d.daily.claimed : cat === 'weekly' ? this.d.weekly.claimed : cat === 'unique' ? this.d.unique.claimed : this.d.event.claimed;
  },
  questState(cat, q) {
    const claimed = this.questStore(cat);
    if (claimed[q.id]) return 'claimed';
    if (q.after && !claimed[q.after]) return 'locked';
    return q.reqs.every((r) => this.questValue(r.k) >= r.n) ? 'ready' : 'progress';
  },
  claimQuest(cat, q) {
    if (this.questState(cat, q) !== 'ready') return null;
    this.questStore(cat)[q.id] = 1;
    const out = this.grant(q.reward);
    this.emit('quest');
    return out;
  },
  questsReady() {
    let n = 0;
    for (const cat of Object.keys(QUESTS)) for (const q of QUESTS[cat]) if (this.questState(cat, q) === 'ready') n++;
    return n;
  },

  // ---------------- rank
  rankTaskCount(id) {
    const r = this.d.rank;
    if (id === 'tomorrow') return r.streakReady ? 1 : 0;
    return r[id] || 0;
  },
  rankTaskClaimed(id) { return this.d.rank['c_' + id] === this.d.rank.day ? this.d.rank['n_' + id] || 0 : 0; },
  rankTaskAvailable(t) { return this.rankTaskCount(t.id) - this.rankTaskClaimed(t.id); },
  claimRankTask(t) {
    const avail = this.rankTaskAvailable(t);
    if (avail <= 0) return 0;
    const r = this.d.rank;
    if (r['c_' + t.id] !== r.day) { r['c_' + t.id] = r.day; r['n_' + t.id] = 0; }
    r['n_' + t.id] += avail;
    if (t.id === 'tomorrow') r.streakReady = false;
    r.pts += t.pts * avail;
    this.emit('rank');
    return t.pts * avail;
  },
  rankReady() {
    let n = 0;
    for (const t of RANK_TASKS) if (this.rankTaskAvailable(t) > 0) n++;
    if (this.d.rank.pts >= rankNeed(this.d.rank.idx) && this.d.rank.idx < MAX_RANK) n++;
    return n;
  },
  rankUp() {
    const r = this.d.rank;
    if (r.idx >= MAX_RANK || r.pts < rankNeed(r.idx)) return null;
    r.pts -= rankNeed(r.idx);
    r.idx++;
    const out = this.grant({ gems: 400 * r.idx, xpLv: 0.5 });
    this.emit('rank');
    return out;
  },

  // ---------------- gifts (playtime this session)
  giftElapsed() { return (performance.now() - this.session.start) / 1000; },
  giftsReady() { return GIFTS.filter((g, i) => !this.session.claimedGifts.has(i) && this.giftElapsed() >= g.at).length; },
  claimGift(i) {
    const g = GIFTS[i];
    if (!g || this.session.claimedGifts.has(i) || this.giftElapsed() < g.at) return null;
    this.session.claimedGifts.add(i);
    const out = this.grant(g.r);
    this.emit('gifts');
    return out;
  },

  // ---------------- wheel
  wheelFreeReady() { return Date.now() >= this.d.wheel.nextFree; },
  wheelSpins() {
    if (this.wheelFreeReady()) { this.d.wheel.spins++; this.d.wheel.nextFree = Date.now() + 4 * 3600e3; this.save(); }
    return this.d.wheel.spins;
  },
  spinWheel() {
    if (this.wheelSpins() <= 0) return null;
    this.d.wheel.spins--;
    this.d.rank.ad = 1; // rank task: spin the wheel
    const total = WHEEL.reduce((a, s) => a + s.odds, 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < WHEEL.length; i++) { r -= WHEEL[i].odds; if (r <= 0) { idx = i; break; } }
    const seg = WHEEL[idx];
    let out;
    if (seg.tank && this.ownsTank(seg.tank)) out = this.grant({ gems: 15000 });
    else out = this.grant({ gems: seg.gems, xpLv: seg.xpLv, tank: seg.tank });
    this.emit('wheel');
    return { idx, out };
  },

  // ---------------- chests
  openChest(chest, free) {
    if (free) {
      if (Date.now() < this.d.chest.freeAt) return null;
      this.d.chest.freeAt = Date.now() + 24 * 3600e3;
    } else if (!this.spend(chest.price)) return null;
    let r = Math.random() * 100, pick = chest.drops[0][0];
    for (const [id, p] of chest.drops) { r -= p; if (r <= 0) { pick = id; break; } }
    let dup = false, refund = 0;
    if (this.ownsSkin(pick)) { dup = true; refund = Math.round(chest.price * 0.5); this.addGems(refund); } else this.giveSkin(pick);
    this.emit('chest');
    return { skin: pick, dup, refund };
  },
};
