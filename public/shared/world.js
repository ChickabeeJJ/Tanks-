// Authoritative game simulation. Runs on the Node server (multiplayer) and in the
// browser (offline fallback). Pure JS, no DOM / Node APIs.
import { DT, MODES, SHAPES, SHAPE_LIST, BASE_CAP, MAX_CAP, BULLET_KINDS, FX, SPAWN_SHIELD, COMBAT_TIME } from './config.js';
import { TANKS, getTank, derived, canUse, upgradeOptions } from './tanks.js';
import { addXp, statPointsForLevel, MAX_LEVEL } from './progression.js';
import { botName, botLevel } from './names.js';
import { SKIN_IDS } from './skins.js';

const TAU = Math.PI * 2;
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const rand = Math.random;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// Distance from point to segment (px,pz)-(x,z) squared.
function segDist2(ax, az, bx, bz, cx, cz) {
  const abx = bx - ax, abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((cx - ax) * abx + (cz - az) * abz) / len2 : 1;
  t = clamp(t, 0, 1);
  const x = ax + abx * t - cx, z = az + abz * t - cz;
  return x * x + z * z;
}

class Grid {
  constructor(cell = 12) { this.cell = cell; this.map = new Map(); this.q = 0; }
  clear() { for (const a of this.map.values()) a.length = 0; }
  insert(e) {
    const c = this.cell;
    const x0 = Math.floor((e.x - e.r) / c), x1 = Math.floor((e.x + e.r) / c);
    const z0 = Math.floor((e.z - e.r) / c), z1 = Math.floor((e.z + e.r) / c);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const k = (x + 2048) * 4096 + (z + 2048);
      let a = this.map.get(k);
      if (!a) { a = []; this.map.set(k, a); }
      a.push(e);
    }
  }
  query(x, z, r, out) {
    out.length = 0;
    const q = ++this.q;
    const c = this.cell;
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.map.get((i + 2048) * 4096 + (j + 2048));
      if (!a) continue;
      for (const e of a) { if (e._q !== q) { e._q = q; out.push(e); } }
    }
    return out;
  }
}

const BOT_BUILDS = [
  [0, 3, 1, 2, 0, 3, 1, 2, 6, 4, 5], // glass cannon
  [4, 5, 7, 6, 4, 5, 7, 6, 0, 3], // tanky rammer
  [3, 0, 2, 1, 6, 4, 3, 0, 2, 1, 5], // balanced shooter
  [2, 0, 1, 3, 2, 0, 1, 3, 6, 4], // sniper
];
const MELEE_BUILD = [7, 4, 6, 5, 7, 4, 6, 5, 3, 0];

export class World {
  constructor(modeId = 'ffa', opts = {}) {
    this.modeId = MODES[modeId] ? modeId : 'ffa';
    this.mode = MODES[this.modeId];
    this.half = this.mode.half;
    this.tick = 0;
    this.time = 0;
    this.nid = 1;
    this.tanks = new Map();
    this.bullets = new Map();
    this.shapes = new Map();
    this.fx = [];
    this.chatLog = [];
    this.chatId = 0;
    this.grid = new Grid(12);
    this.tmp = [];
    this.botTarget = opts.botTarget ?? this.mode.botTarget;
    this.humans = 0;
    for (let i = 0; i < this.mode.shapes; i++) this.spawnShape(true);
    for (let i = 0; i < this.botTarget - 1; i++) this.addBot();
  }

  id() { return this.nid++; }

  // ------------------------------------------------------------------ teams / bases
  baseRect(team) {
    const h = this.half;
    if (this.mode.teams === 2) {
      const s = 30;
      if (team === 1) return [-h, -h, -h + s, h];
      if (team === 2) return [h - s, -h, h, h];
    } else if (this.mode.teams === 4) {
      const s = 40;
      if (team === 1) return [-h, -h, -h + s, -h + s];
      if (team === 2) return [h - s, h - s, h, h];
      if (team === 3) return [-h, h - s, -h + s, h];
      if (team === 4) return [h - s, -h, h, -h + s];
    }
    return null;
  }

  inRect(x, z, r) { return r && x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3]; }

  enemyBaseAt(x, z, team) {
    if (!this.mode.teams) return false;
    for (let k = 1; k <= this.mode.teams; k++) {
      if (k !== team && this.inRect(x, z, this.baseRect(k))) return true;
    }
    return false;
  }

  anyBaseAt(x, z, pad = 0) {
    if (!this.mode.teams) return false;
    for (let k = 1; k <= this.mode.teams; k++) {
      const r = this.baseRect(k);
      if (r && x >= r[0] - pad && x <= r[2] + pad && z >= r[1] - pad && z <= r[3] + pad) return true;
    }
    return false;
  }

  assignTeam() {
    const n = this.mode.teams;
    if (!n) return 0;
    const counts = new Array(n + 1).fill(0);
    for (const t of this.tanks.values()) if (t.team) counts[t.team]++;
    let best = 1;
    for (let k = 2; k <= n; k++) if (counts[k] < counts[best]) best = k;
    return best;
  }

  // ------------------------------------------------------------------ shapes
  pickShapeType(d01) {
    let total = 0;
    const ws = SHAPE_LIST.map((k) => {
      const s = SHAPES[k];
      let w = s.w;
      if (k === 'cube') w *= 0.6 + d01;
      if (k === 'pent') w *= 0.5 + 2 * (1 - d01);
      if (k === 'hex') w *= 0.3 + 3 * (1 - d01) * (1 - d01);
      if (k === 'alpha') w *= (this.mode.alphaBoost || 1) * (d01 < 0.35 ? 3 : 0.25);
      total += w;
      return w;
    });
    let r = rand() * total;
    for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return SHAPE_LIST[i]; }
    return 'cube';
  }

  spawnShape(initial) {
    const h = this.half - 8;
    let x = 0, z = 0, ok = false;
    for (let tries = 0; tries < 12 && !ok; tries++) {
      x = (rand() * 2 - 1) * h;
      z = (rand() * 2 - 1) * h;
      ok = !this.anyBaseAt(x, z, 6);
      if (ok && !initial) {
        for (const t of this.tanks.values()) {
          if (t.alive && Math.abs(t.x - x) < 22 && Math.abs(t.z - z) < 22) { ok = false; break; }
        }
      }
    }
    if (!ok) return;
    const d01 = Math.min(1, Math.hypot(x, z) / this.half);
    const type = this.pickShapeType(d01);
    const s = SHAPES[type];
    const id = this.id();
    this.shapes.set(id, {
      id, kind: 'shape', type, ti: s.idx, x, z, vx: 0, vz: 0, r: s.r, hp: s.hp, maxHp: s.hp,
      rot: rand() * TAU, rs: 0, dmg: s.dmg, mass: s.r * s.r, dir: rand() * TAU,
    });
  }

  // ------------------------------------------------------------------ tanks
  addTank(o = {}) {
    const id = this.id();
    const owned = Array.isArray(o.owned) ? o.owned.filter((x) => TANKS[x]) : [];
    const caps = Array.from({ length: 8 }, (_, i) => clamp(Math.floor((o.caps && o.caps[i]) || BASE_CAP), BASE_CAP, MAX_CAP));
    const t = {
      id, kind: 'tank', name: String(o.name || 'Player').slice(0, 20), isBot: !!o.isBot, uid: o.uid || null,
      level: clamp(Math.floor(o.level || 1), 1, MAX_LEVEL), xp: Math.max(0, Math.floor(o.xp || 0)),
      skin: SKIN_IDS.includes(o.skin) ? o.skin : 'default', owned, caps,
      xpMul: clamp(o.xpMul || 1, 1, 2), gemMul: clamp(o.gemMul || 1, 1, 2),
      team: this.assignTeam(), tankId: 'default', stats: [0, 0, 0, 0, 0, 0, 0, 0], spent: 0,
      x: 0, z: 0, vx: 0, vz: 0, aim: 0, r: 2, hp: 100, d: null, alive: false,
      input: { mx: 0, mz: 0, aim: 0, fire: false }, seq: 0, cd: [], orbs: 0, orbSeq: 0,
      shieldUntil: 0, lastDmg: 0, slowUntil: 0, combatUntil: 0, kills: 0, score: 0, sessionXp: 0,
      ev: [], infoVer: 1, deathTime: 0, stillT: 0, stealth: false,
      gemPend: 0, xpPend: 0, shapePend: 0, killPend: 0, lastHitBy: null,
    };
    this.tanks.set(id, t);
    if (!t.isBot) this.humans++;
    this.recalc(t);
    this.spawn(t);
    return t;
  }

  inCombat(t) {
    return t.alive && t.combatUntil > this.time && this.tanks.has(t.lastHitBy);
  }

  // A player leaves the match. Leaving while in combat counts as a kill for the attacker.
  leaveTank(id) {
    const t = this.tanks.get(id);
    if (!t) return false;
    let counted = false;
    if (this.inCombat(t)) {
      this.killTank(t, t.lastHitBy, 'Left while in combat');
      counted = true;
    }
    this.removeTank(id);
    return counted;
  }

  removeTank(id) {
    const t = this.tanks.get(id);
    if (!t) return;
    this.tanks.delete(id);
    if (!t.isBot) this.humans--;
  }

  recalc(t) {
    const ratio = t.d ? t.hp / t.d.maxHp : 1;
    t.d = derived(t.tankId, t.level, t.stats);
    t.r = t.d.r;
    t.hp = clamp(ratio * t.d.maxHp, 0, t.d.maxHp);
  }

  spawnPoint(t) {
    const rect = this.baseRect(t.team);
    if (rect) {
      return [rect[0] + 6 + rand() * (rect[2] - rect[0] - 12), rect[1] + 6 + rand() * (rect[3] - rect[1] - 12)];
    }
    let best = [0, 0], bestD = -1;
    const h = this.half - 15;
    for (let i = 0; i < 14; i++) {
      const x = (rand() * 2 - 1) * h, z = (rand() * 2 - 1) * h;
      let md = 1e9;
      for (const o of this.tanks.values()) {
        if (o === t || !o.alive) continue;
        md = Math.min(md, (o.x - x) ** 2 + (o.z - z) ** 2);
      }
      if (md > bestD) { bestD = md; best = [x, z]; }
    }
    return best;
  }

  spawn(t) {
    const [x, z] = this.spawnPoint(t);
    t.x = x; t.z = z; t.vx = 0; t.vz = 0;
    t.tankId = 'default';
    t.stats = [0, 0, 0, 0, 0, 0, 0, 0];
    t.spent = 0;
    t.d = null;
    this.recalc(t);
    t.hp = t.d.maxHp;
    t.alive = true;
    t.shieldUntil = this.time + SPAWN_SHIELD;
    t.cd = [];
    t.orbs = 0;
    t.stillT = 0;
    t.stealth = false;
    t.slowUntil = 0;
    t.lastDmg = this.time;
    t.combatUntil = 0;
    t.lastHitBy = null;
    t.spawnTime = this.time;
    t.infoVer++;
    t.ev.push(['spawn']);
    if (t.isBot) this.initBotBrain(t);
  }

  setInput(id, inp) {
    const t = this.tanks.get(id);
    if (!t || !inp) return;
    let mx = Number(inp.mx) || 0, mz = Number(inp.mz) || 0;
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    t.input.mx = mx;
    t.input.mz = mz;
    const a = Number(inp.a);
    if (Number.isFinite(a)) t.input.aim = a;
    t.input.fire = !!inp.f;
    if (Number.isFinite(inp.s)) t.seq = inp.s;
  }

  statUp(id, i) {
    const t = this.tanks.get(id);
    if (!t || !t.alive || !(i >= 0 && i < 8)) return false;
    if (t.spent >= statPointsForLevel(t.level)) return false;
    if (t.stats[i] >= t.caps[i]) { t.ev.push(['cap']); return false; }
    t.stats[i]++;
    t.spent++;
    this.recalc(t);
    return true;
  }

  upgrade(id, tankId) {
    const t = this.tanks.get(id);
    const def = TANKS[tankId];
    if (!t || !t.alive || !def || def.parent !== t.tankId) return false;
    if (!upgradeOptions(t.tankId, t.level, t.owned).includes(def)) return false;
    if (!canUse(def, t.level, t.owned)) { t.ev.push(['locked', def.id]); return false; }
    t.tankId = def.id;
    t.cd = [];
    this.recalc(t);
    t.infoVer++;
    t.ev.push(['up', def.name]);
    this.fx.push({ tick: this.tick, d: [FX.LEVEL, r1(t.x), r1(t.z), t.id] });
    return true;
  }

  respawn(id) {
    const t = this.tanks.get(id);
    if (t && !t.alive) this.spawn(t);
  }

  addChat(id, msg) {
    const t = this.tanks.get(id);
    if (!t) return;
    this.chatLog.push({ id: ++this.chatId, n: t.name, m: msg, team: t.team });
    if (this.chatLog.length > 50) this.chatLog.shift();
  }

  // ------------------------------------------------------------------ rewards
  grantXp(t, amount) {
    if (!t) return;
    amount = Math.round(amount * (t.xpMul || 1));
    const r = addXp(t.level, t.xp, amount);
    t.xp = r.xp;
    t.sessionXp += amount;
    t.score += amount;
    t.xpPend += amount;
    if (amount >= 1000) t.ev.push(['xp', amount]);
    if (r.gained) {
      t.level = r.level;
      this.recalc(t);
      t.infoVer++;
      t.ev.push(['lvl', t.level]);
    }
  }

  grantGems(t, n) {
    if (!t || n <= 0) return;
    t.gemPend += Math.round(n * (t.gemMul || 1) * (this.mode.gemMul || 1));
  }

  killShape(s, killerId) {
    this.shapes.delete(s.id);
    s.hp = 0;
    this.fx.push({ tick: this.tick, d: [FX.POP, r1(s.x), r1(s.z), s.ti] });
    const k = this.tanks.get(killerId);
    if (k) {
      const def = SHAPES[s.type];
      this.grantXp(k, def.xp);
      if (def.gems) this.grantGems(k, def.gems === 1 ? (rand() < 0.5 ? 1 : 0) : def.gems);
      k.shapePend++;
      if (s.type === 'alpha') k.ev.push(['alpha']);
    }
  }

  killTank(t, killerId, cause) {
    if (!t.alive) return;
    t.alive = false;
    t.hp = 0;
    t.deathTime = this.time;
    const k = killerId != null ? this.tanks.get(killerId) : null;
    const byName = k && k !== t ? k.name : cause || 'a Shape';
    const byTank = k && k !== t ? getTank(k.tankId).name : '';
    t.ev.push(['dead', byName, byTank, t.sessionXp, t.kills, Math.round(this.time - t.spawnTime)]);
    this.fx.push({ tick: this.tick, d: [FX.DEATH, r1(t.x), r1(t.z), t.team] });
    if (k && k !== t) {
      k.kills++;
      k.killPend++;
      this.grantXp(k, 1200 + 25 * Math.min(t.level, 400) + Math.min(t.sessionXp * 0.1, 20000));
      this.grantGems(k, 25);
      k.ev.push(['kill', t.name]);
    }
    t.sessionXp = 0;
    t.kills = 0;
    t.score = 0;
  }

  damageTank(t, amount, byId) {
    if (!t.alive || amount <= 0) return;
    t.hp -= amount;
    t.lastDmg = this.time;
    if (byId != null && byId !== t.id && this.tanks.has(byId)) {
      t.lastHitBy = byId;
      t.combatUntil = this.time + COMBAT_TIME;
    }
    if (t.hp <= 0) this.killTank(t, byId);
  }

  // ------------------------------------------------------------------ shooting
  fireTank(t) {
    const def = getTank(t.tankId);
    const firing = t.input.fire;
    let fired = false;
    for (let i = 0; i < def.barrels.length; i++) {
      const b = def.barrels[i];
      const R = 0.6 * b.rel * t.d.relMul;
      if (t.cd[i] === undefined) t.cd[i] = b.delay * R;
      if (b.kind === 'orbit') {
        t.cd[i] -= DT;
        if (t.cd[i] <= 0) {
          t.cd[i] += R;
          if (t.orbs < b.maxOrb) this.spawnOrb(t, b);
        }
        continue;
      }
      if (firing) {
        t.cd[i] -= DT;
        let guard = 0;
        while (t.cd[i] <= 0 && guard++ < 3) {
          this.shoot(t, b);
          t.cd[i] += R;
          fired = true;
        }
      } else {
        t.cd[i] = Math.max(t.cd[i] - DT, b.delay * R);
      }
    }
    if (fired) t.stillT = 0;
  }

  makeBullet(t, b, x, z, a, spd) {
    const size = getTank(t.tankId).body.size;
    const id = this.id();
    const bl = {
      id, kind: 'bullet', k: b.kind, ki: BULLET_KINDS.indexOf(b.kind), owner: t.id, team: t.team,
      x, z, px: x, pz: z, vx: Math.cos(a) * spd, vz: Math.sin(a) * spd,
      r: 0.5 * b.w * b.bs * size * 0.95, r0: 0, dmg: 9 * b.dmg * t.d.dmgMul, hp: 9 * b.pen * t.d.penMul,
      life: 1.4 * b.life, age: 0, gen: 0, shielded: t.shieldUntil > this.time, ang: 0, bs: b.bs,
    };
    bl.r0 = bl.r;
    this.bullets.set(id, bl);
    return bl;
  }

  shoot(t, b) {
    const size = getTank(t.tankId).body.size;
    const base = t.aim + b.a;
    const ca = Math.cos(base), sa = Math.sin(base);
    const len = b.len * size, ox = b.ox * size;
    const n = b.pellets || 1;
    for (let k = 0; k < n; k++) {
      let x = t.x + ca * len - sa * ox;
      let z = t.z + sa * len + ca * ox;
      if (b.burst) { x -= ca * k * 1.6; z -= sa * k * 1.6; }
      const a = base + (rand() - 0.5) * 2 * b.spread;
      let spd = 42 * b.spd * t.d.bspdMul;
      if (n > 1 && !b.burst) spd *= 0.85 + rand() * 0.3;
      this.makeBullet(t, b, x, z, a, spd);
    }
    const imp = 0.55 * b.recoil * b.w * (n > 1 ? 1.4 : 1);
    t.vx -= ca * imp;
    t.vz -= sa * imp;
  }

  spawnOrb(t, b) {
    const bl = this.makeBullet(t, b, t.x, t.z, 0, 0);
    bl.ang = t.aim + (t.orbSeq++ * TAU) / b.maxOrb;
    t.orbs++;
  }

  explode(bl) {
    const R = 3 + bl.r * 3.2;
    const dmg = bl.dmg * 2.2;
    this.fx.push({ tick: this.tick, d: [FX.BLAST, r1(bl.x), r1(bl.z), r1(R)] });
    const near = this.grid.query(bl.x, bl.z, R + 6, this.tmp).slice();
    for (const e of near) {
      if (e.kind === 'bullet') continue;
      const d = Math.hypot(e.x - bl.x, e.z - bl.z);
      if (d > R + e.r) continue;
      if (e.kind === 'shape') {
        if (e.hp <= 0) continue;
        e.hp -= dmg;
        if (e.hp <= 0) this.killShape(e, bl.owner);
      } else if (e.kind === 'tank') {
        if (!e.alive || e.id === bl.owner) continue;
        if (this.mode.teams && e.team === bl.team) continue;
        if (e.shieldUntil > this.time || bl.shielded) continue;
        this.damageTank(e, dmg, bl.owner);
      }
    }
  }

  // ------------------------------------------------------------------ main step
  step() {
    this.tick++;
    this.time += DT;
    const now = this.time;
    if (this.tick % 30 === 0) this.manageBots();

    // --- tanks
    for (const t of this.tanks.values()) {
      if (!t.alive) {
        if (t.isBot && now - t.deathTime > 3 + (t.id % 4)) this.spawn(t);
        continue;
      }
      if (t.isBot) this.botThink(t);
      const slow = now < t.slowUntil ? 0.55 : 1;
      const sp = t.d.speed * slow;
      const k = Math.min(1, 7 * DT);
      t.vx += (t.input.mx * sp - t.vx) * k;
      t.vz += (t.input.mz * sp - t.vz) * k;
      t.x += t.vx * DT;
      t.z += t.vz * DT;
      const lim = this.half - t.r;
      if (t.x < -lim) { t.x = -lim; t.vx = 0; }
      if (t.x > lim) { t.x = lim; t.vx = 0; }
      if (t.z < -lim) { t.z = -lim; t.vz = 0; }
      if (t.z > lim) { t.z = lim; t.vz = 0; }
      t.aim = t.input.aim;
      // regen (+ hyper regen after 25s without damage)
      if (t.hp < t.d.maxHp) {
        let rg = t.d.regen;
        if (now - t.lastDmg > 25) rg += 0.08;
        else if (now - t.lastDmg < 3) rg *= 0.3;
        t.hp = Math.min(t.d.maxHp, t.hp + t.d.maxHp * rg * DT);
      }
      this.fireTank(t);
      // stealth
      if (Math.abs(t.input.mx) + Math.abs(t.input.mz) > 0.1) t.stillT = 0;
      else t.stillT += DT;
      t.stealth = getTank(t.tankId).special === 'stealth' && t.stillT > 1.5;
      // enemy base
      if (this.mode.teams && this.enemyBaseAt(t.x, t.z, t.team)) {
        t.hp -= 150 * DT;
        t.lastDmg = now;
        if (t.hp <= 0) this.killTank(t, null, 'the Base');
      }
    }

    // --- bullets
    for (const bl of this.bullets.values()) {
      bl.age += DT;
      bl.px = bl.x;
      bl.pz = bl.z;
      if (bl.k === 'orbit') {
        const o = this.tanks.get(bl.owner);
        if (!o || !o.alive) { bl.hp = 0; continue; }
        bl.ang += 2.6 * DT;
        const R = o.r + 3.2;
        const nx = o.x + Math.cos(bl.ang) * R, nz = o.z + Math.sin(bl.ang) * R;
        bl.vx = (nx - bl.x) / DT;
        bl.vz = (nz - bl.z) / DT;
        bl.x = nx;
        bl.z = nz;
        bl.shielded = o.shieldUntil > now;
      } else {
        bl.x += bl.vx * DT;
        bl.z += bl.vz * DT;
      }
      if (bl.k === 'flame') {
        bl.r = bl.r0 * (1 + bl.age * 2.4);
        bl.vx *= 0.95;
        bl.vz *= 0.95;
      }
      if (bl.k === 'split' && bl.gen < 2 && bl.age > 0.33) {
        const a = Math.atan2(bl.vz, bl.vx), spd = Math.hypot(bl.vx, bl.vz);
        for (const da of [-0.45, 0, 0.45]) {
          const id = this.id();
          const c = Object.assign({}, bl, {
            id, vx: Math.cos(a + da) * spd, vz: Math.sin(a + da) * spd, r: bl.r * 0.75, r0: bl.r * 0.75,
            dmg: bl.dmg * 0.6, hp: bl.hp * 0.7, age: 0, life: bl.life * 0.6, gen: bl.gen + 1, _q: 0,
          });
          this.bullets.set(id, c);
        }
        bl.hp = 0;
        bl.silent = true;
        continue;
      }
      if (bl.age > bl.life) bl.hp = 0;
      if (Math.abs(bl.x) > this.half || Math.abs(bl.z) > this.half) bl.hp = 0;
      if (this.mode.teams && bl.k !== 'orbit' && this.enemyBaseAt(bl.x, bl.z, bl.team)) bl.hp = 0;
    }

    // shapes are anchored: they never move or spin

    this.collide();

    // --- cleanup bullets
    for (const bl of this.bullets.values()) {
      if (bl.hp <= 0) {
        if (bl.k === 'blast' && !bl.silent) this.explode(bl);
        if (bl.k === 'orbit') {
          const o = this.tanks.get(bl.owner);
          if (o) o.orbs = Math.max(0, o.orbs - 1);
        }
        this.bullets.delete(bl.id);
      }
    }

    // --- refill shapes
    let n = 0;
    while (this.shapes.size < this.mode.shapes && n++ < 3) this.spawnShape(false);

    if (this.fx.length && this.fx[0].tick < this.tick - 60) {
      this.fx = this.fx.filter((f) => f.tick >= this.tick - 60);
    }
  }

  collide() {
    const g = this.grid;
    g.clear();
    for (const s of this.shapes.values()) g.insert(s);
    for (const t of this.tanks.values()) if (t.alive) g.insert(t);
    for (const b of this.bullets.values()) if (b.hp > 0) g.insert(b);
    const now = this.time;
    const out = this.tmp;
    const teams = this.mode.teams;

    // bullets
    for (const bl of this.bullets.values()) {
      if (bl.hp <= 0) continue;
      const mx = (bl.x + bl.px) / 2, mz = (bl.z + bl.pz) / 2;
      const segHalf = Math.hypot(bl.x - bl.px, bl.z - bl.pz) / 2;
      g.query(mx, mz, bl.r + segHalf + 7, out);
      for (let i = 0; i < out.length && bl.hp > 0; i++) {
        const e = out[i];
        if (e === bl) continue;
        if (e.kind === 'shape') {
          if (e.hp <= 0) continue;
          const rr = e.r + bl.r;
          if (segDist2(bl.px, bl.pz, bl.x, bl.z, e.x, e.z) > rr * rr) continue;
          e.hp -= bl.dmg;
          bl.hp -= e.dmg;
          if (e.hp <= 0) this.killShape(e, bl.owner);
        } else if (e.kind === 'tank') {
          if (!e.alive || e.id === bl.owner) continue;
          if (teams && e.team === bl.team) continue;
          const rr = e.r + bl.r;
          if (segDist2(bl.px, bl.pz, bl.x, bl.z, e.x, e.z) > rr * rr) continue;
          if (e.shieldUntil > now || bl.shielded) { bl.hp = 0; continue; }
          this.damageTank(e, bl.dmg, bl.owner);
          bl.hp -= e.d.bodyRes;
          const sp = Math.hypot(bl.vx, bl.vz) || 1;
          if (bl.k !== 'flame') { e.vx += (bl.vx / sp) * 1.2 * bl.r; e.vz += (bl.vz / sp) * 1.2 * bl.r; }
          if (bl.k === 'freeze') e.slowUntil = now + 1.6;
        } else if (e.kind === 'bullet') {
          if (e.id < bl.id || e.hp <= 0 || e.owner === bl.owner) continue;
          if (teams && e.team === bl.team) continue;
          if (bl.k === 'flame' || e.k === 'flame') continue;
          const rr = e.r + bl.r;
          const dx = e.x - bl.x, dz = e.z - bl.z;
          if (dx * dx + dz * dz > rr * rr) continue;
          const a = bl.dmg, b = e.dmg;
          bl.hp -= b;
          e.hp -= a;
        }
      }
    }

    // tanks vs shapes / tanks
    for (const t of this.tanks.values()) {
      if (!t.alive) continue;
      g.query(t.x, t.z, t.r + 7, out);
      const tShield = t.shieldUntil > now;
      const lifesteal = getTank(t.tankId).special === 'lifesteal';
      for (let i = 0; i < out.length; i++) {
        const e = out[i];
        if (e === t || e.kind === 'bullet') continue;
        const dx = e.x - t.x, dz = e.z - t.z;
        const rr = e.r + t.r;
        const d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2) || 0.01;
        const nx = dx / d, nz = dz / d, pen = rr - d;
        if (e.kind === 'shape') {
          if (e.hp <= 0) continue;
          t.x -= nx * pen;
          t.z -= nz * pen;
          const vn = t.vx * nx + t.vz * nz;
          if (vn > 0) { t.vx -= nx * vn; t.vz -= nz * vn; }
          const dealt = t.d.bodyDps * DT;
          e.hp -= dealt;
          if (lifesteal) t.hp = Math.min(t.d.maxHp, t.hp + dealt * 0.25);
          if (!tShield) { t.hp -= e.dmg * 3 * DT; t.lastDmg = now; }
          if (e.hp <= 0) this.killShape(e, t.id);
          if (t.hp <= 0) { this.killTank(t, null, 'a Shape'); break; }
        } else if (e.kind === 'tank') {
          if (e.id < t.id || !e.alive) continue;
          t.x -= nx * pen * 0.5; t.z -= nz * pen * 0.5;
          e.x += nx * pen * 0.5; e.z += nz * pen * 0.5;
          t.vx -= nx * 3; t.vz -= nz * 3; e.vx += nx * 3; e.vz += nz * 3;
          if (teams && e.team === t.team) continue;
          if (tShield || e.shieldUntil > now) continue;
          const dt1 = t.d.bodyDps * DT, dt2 = e.d.bodyDps * DT;
          if (lifesteal) t.hp = Math.min(t.d.maxHp, t.hp + dt1 * 0.25);
          if (getTank(e.tankId).special === 'lifesteal') e.hp = Math.min(e.d.maxHp, e.hp + dt2 * 0.25);
          this.damageTank(e, dt1, t.id);
          this.damageTank(t, dt2, e.id);
          if (!t.alive) break;
        }
      }
    }

  }

  // ------------------------------------------------------------------ bots
  manageBots() {
    let bots = 0;
    for (const t of this.tanks.values()) if (t.isBot) bots++;
    const want = Math.max(0, this.botTarget - this.humans);
    if (bots < want) this.addBot();
    else if (bots > want) {
      let victim = null;
      for (const t of this.tanks.values()) {
        if (!t.isBot) continue;
        if (!t.alive) { victim = t; break; }
        if (!victim) victim = t;
      }
      if (victim) this.removeTank(victim.id);
    }
  }

  addBot() {
    const level = botLevel();
    const owned = [];
    for (const d of Object.values(TANKS)) {
      if (d.unlock.type !== 'level' && rand() < 0.25) owned.push(d.id);
    }
    const skin = rand() < 0.55 ? 'default' : SKIN_IDS[1 + Math.floor(rand() * (SKIN_IDS.length - 2))];
    return this.addTank({ name: botName(), level, isBot: true, skin, owned, caps: new Array(8).fill(BASE_CAP + (level > 200 ? 2 : 0)) });
  }

  initBotBrain(t) {
    t.bot = {
      next: 0, mx: 0, mz: 0, aimT: rand() * TAU, fire: false, strafe: rand() < 0.5 ? 1 : -1, strafeT: 0,
      wx: (rand() * 2 - 1) * this.half * 0.7, wz: (rand() * 2 - 1) * this.half * 0.7,
      build: BOT_BUILDS[Math.floor(rand() * BOT_BUILDS.length)], skill: 0.45 + rand() * 0.5,
      upT: this.time + 1 + rand() * 4, target: null,
    };
  }

  botThink(t) {
    const b = t.bot;
    if (!b) { this.initBotBrain(t); return; }
    const now = this.time;
    // smooth aim toward target angle (limited turn rate)
    const turn = 7 * DT;
    const da = angDiff(t.input.aim, b.aimT);
    t.input.aim += clamp(da, -turn, turn);
    t.input.mx = b.mx;
    t.input.mz = b.mz;
    t.input.fire = b.fire && Math.abs(da) < 0.5;
    if (now < b.next) return;
    b.next = now + 0.2 + rand() * 0.12;

    const def = getTank(t.tankId);
    const melee = def.barrels.length === 0 || def.cls === 'Melee';

    // spend stat points
    const total = statPointsForLevel(t.level);
    let guard = 0;
    while (t.spent < total && guard++ < 20) {
      const order = melee ? MELEE_BUILD : b.build;
      const i = order.find((k) => t.stats[k] < t.caps[k]);
      if (i === undefined) break;
      if (!this.statUp(t.id, i)) break;
    }
    // upgrade tank now and then
    if (now > b.upT) {
      b.upT = now + 2 + rand() * 6;
      const opts = upgradeOptions(t.tankId, t.level, t.owned).filter((d) => canUse(d, t.level, t.owned));
      if (opts.length) this.upgrade(t.id, opts[Math.floor(rand() * opts.length)].id);
    }

    // perception
    const view = 55 * t.d.fov;
    let enemy = null, ed = 1e9;
    for (const o of this.tanks.values()) {
      if (o === t || !o.alive) continue;
      if (this.mode.teams && o.team === t.team) continue;
      const d = Math.hypot(o.x - t.x, o.z - t.z);
      if (d > view || (o.stealth && d > 10)) continue;
      if (o.shieldUntil > now && d > 12) continue;
      if (this.mode.teams && this.enemyBaseAt(o.x, o.z, t.team)) continue;
      if (d < ed) { ed = d; enemy = o; }
    }
    let shape = null, best = 0;
    this.grid.query(t.x, t.z, 45, this.tmp);
    for (const s of this.tmp) {
      if (s.kind !== 'shape' || s.hp <= 0) continue;
      if (this.mode.teams && this.enemyBaseAt(s.x, s.z, t.team)) continue;
      const d = Math.hypot(s.x - t.x, s.z - t.z);
      const sc = SHAPES[s.type].xp / (d + 12) / (s.type === 'alpha' && t.level < 40 ? 4 : 1);
      if (sc > best) { best = sc; shape = s; }
    }
    const hpR = t.hp / t.d.maxHp;
    let tx = b.wx, tz = b.wz, desired = 0, aimX = null, aimZ = null, fire = false, flee = false;
    if (now > b.strafeT) { b.strafe *= -1; b.strafeT = now + 1.2 + rand() * 2; }

    const myShield = t.shieldUntil > now;
    if (enemy && hpR < 0.3 && !melee) {
      flee = true;
      tx = t.x - (enemy.x - t.x); tz = t.z - (enemy.z - t.z);
      aimX = enemy.x; aimZ = enemy.z; fire = true;
    } else if (enemy && !myShield && (hpR > 0.45 || ed < 18)) {
      const bspd = 42 * t.d.bspdMul;
      const lead = (ed / bspd) * b.skill;
      aimX = enemy.x + enemy.vx * lead; aimZ = enemy.z + enemy.vz * lead;
      tx = enemy.x; tz = enemy.z;
      desired = melee ? 0 : def.cls === 'Sniper' ? 38 : def.cls === 'Flame' ? 8 : 22;
      fire = true;
    } else if (shape) {
      aimX = shape.x; aimZ = shape.z; tx = shape.x; tz = shape.z;
      desired = melee ? 0 : def.cls === 'Flame' ? 6 : 12 + shape.r;
      fire = true;
    } else if (Math.hypot(b.wx - t.x, b.wz - t.z) < 10) {
      b.wx = (rand() * 2 - 1) * this.half * 0.75;
      b.wz = (rand() * 2 - 1) * this.half * 0.75;
    }

    let dx = tx - t.x, dz = tz - t.z;
    const dist = Math.hypot(dx, dz) || 1;
    dx /= dist; dz /= dist;
    let mx = 0, mz = 0;
    if (flee) { mx = dx; mz = dz; }
    else if (dist > desired + 3) { mx = dx; mz = dz; }
    else if (dist < desired - 3) { mx = -dx; mz = -dz; }
    if (aimX !== null && !flee && desired > 0) { mx += -dz * b.strafe * 0.6; mz += dx * b.strafe * 0.6; }
    // walls + enemy bases
    const h = this.half;
    if (t.x < -h + 12) mx += 1;
    if (t.x > h - 12) mx -= 1;
    if (t.z < -h + 12) mz += 1;
    if (t.z > h - 12) mz -= 1;
    if (this.mode.teams) {
      const ahead = this.enemyBaseAt(t.x + mx * 14, t.z + mz * 14, t.team);
      if (ahead) { mx = -mx; mz = -mz; }
    }
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    b.mx = mx; b.mz = mz;
    if (aimX !== null) {
      b.aimT = Math.atan2(aimZ - t.z, aimX - t.x) + (rand() - 0.5) * 0.15 * (1.1 - b.skill);
    } else {
      b.aimT += 0.4;
    }
    b.fire = fire && def.barrels.length > 0;
  }

  // ------------------------------------------------------------------ snapshots
  leaderboard(viewerId) {
    const all = [...this.tanks.values()].sort((a, b) => b.level - a.level || b.score - a.score);
    const rows = all.slice(0, 10).map((t) => [t.name, t.level, t.id === viewerId ? 1 : 0, t.isBot ? 1 : 0, t.team, t.kills]);
    const idx = all.findIndex((t) => t.id === viewerId);
    return { rows, you: idx + 1, n: all.length, list: all.map((t) => [t.name, t.level, t.isBot ? 1 : 0, t.team, t.kills, t.id === viewerId ? 1 : 0]) };
  }

  snapshotFor(viewerId, cs) {
    const v = this.tanks.get(viewerId);
    if (!v) return null;
    if (!cs.info) { cs.info = new Map(); cs.fxTick = this.tick - 1; cs.chatId = this.chatId; }
    const R = 72 * (v.d.fov || 1) + 10;
    const cx = v.x, cz = v.z;
    const now = this.time;
    const tk = [], sh = [], bl = [], fx = [];
    const info = {};
    for (const t of this.tanks.values()) {
      if (!t.alive) continue;
      if (t !== v) {
        if (Math.abs(t.x - cx) > R || Math.abs(t.z - cz) > R) continue;
        if (t.stealth && (!this.mode.teams || t.team !== v.team) && Math.hypot(t.x - cx, t.z - cz) > 12) continue;
      }
      const flags = (t.shieldUntil > now ? 1 : 0) | (t.stealth ? 2 : 0) | (t.slowUntil > now ? 4 : 0);
      tk.push([t.id, r1(t.x), r1(t.z), r2(t.aim), Math.ceil((100 * t.hp) / t.d.maxHp), flags]);
      if (cs.info.get(t.id) !== t.infoVer) {
        info[t.id] = [t.name, t.tankId, t.skin, t.team, t.level, t.isBot ? 1 : 0];
        cs.info.set(t.id, t.infoVer);
      }
    }
    for (const s of this.shapes.values()) {
      if (Math.abs(s.x - cx) > R || Math.abs(s.z - cz) > R) continue;
      sh.push([s.id, s.ti, r1(s.x), r1(s.z), r2(s.rot), Math.ceil((100 * s.hp) / s.maxHp)]);
    }
    const teams = this.mode.teams;
    for (const b of this.bullets.values()) {
      if (b.hp <= 0 && b.k !== 'blast') continue;
      if (Math.abs(b.x - cx) > R || Math.abs(b.z - cz) > R) continue;
      bl.push([b.id, r1(b.x), r1(b.z), r2(b.r), b.ki, b.owner === viewerId ? 0 : teams ? b.team : 9]);
    }
    for (const f of this.fx) {
      if (f.tick <= cs.fxTick) continue;
      if (Math.abs(f.d[1] - cx) > R || Math.abs(f.d[2] - cz) > R) continue;
      fx.push(f.d);
    }
    cs.fxTick = this.tick;
    const me = {
      a: v.alive ? 1 : 0, hp: Math.ceil(v.hp), mhp: v.d.maxHp, lv: v.level, xp: Math.floor(v.xp),
      sp: statPointsForLevel(v.level) - v.spent, st: v.stats, cp: v.caps, tk: v.tankId,
      sh: Math.max(0, r1(v.shieldUntil - now)), k: v.kills, sx: v.sessionXp, x: r2(v.x), z: r2(v.z),
      team: v.team, cb: this.inCombat(v) ? r1(v.combatUntil - now) : 0, gp: v.gemPend, xd: v.xpPend, sd: v.shapePend, kd: v.killPend, ev: v.ev, slow: v.slowUntil > now ? 1 : 0,
    };
    v.gemPend = 0; v.xpPend = 0; v.shapePend = 0; v.killPend = 0; v.ev = [];
    const snap = { time: r2(now), ack: v.seq, you: v.id, tk, info, sh, bl, fx, me };
    if (cs.lbTick === undefined || this.tick - cs.lbTick >= 15) {
      snap.lb = this.leaderboard(viewerId);
      cs.lbTick = this.tick;
    }
    if (this.chatId > cs.chatId) {
      snap.ch = this.chatLog.filter((c) => c.id > cs.chatId).map((c) => [c.n, c.m, c.team]);
      cs.chatId = this.chatId;
    }
    return snap;
  }
}

// Shared movement integrator used by client-side prediction (mirrors World.step).
export function predictMove(p, mx, mz, speed, half, r, dt) {
  const k = Math.min(1, 7 * dt);
  p.vx += (mx * speed - p.vx) * k;
  p.vz += (mz * speed - p.vz) * k;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  const lim = half - r;
  if (p.x < -lim) { p.x = -lim; p.vx = 0; }
  if (p.x > lim) { p.x = lim; p.vx = 0; }
  if (p.z < -lim) { p.z = -lim; p.vz = 0; }
  if (p.z > lim) { p.z = lim; p.vz = 0; }
}
