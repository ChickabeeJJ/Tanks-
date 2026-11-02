// Arena: connects (online or offline), renders snapshots, predicts the local tank.
import * as THREE from '../vendor/three.module.min.js';
import { DT, SHAPE_LIST, SHAPES, MODES, FX, TEAM_COLORS, BULLET_KINDS } from '../shared/config.js';
import { getTank, derived, childrenOf, canUse, TANKS } from '../shared/tanks.js';
import { predictMove } from '../shared/world.js';
import { fmt, fmtFull } from '../shared/progression.js';
import { buildTank, disposeTank, setTankOpacity, shapeGeometry, shapeMaterial, Bar } from './render/models.js';
import { buildArena } from './render/scene.js';
import { textSprite, textCanvas } from './render/textures.js';
import { OnlineConn, OfflineConn, resolveServer } from './net.js';
import { Input } from './input.js';
import { profile } from './profile.js';
import { Audio } from './audio.js';
import { SDK } from './sdk.js';

const lerp = (a, b, t) => a + (b - a) * t;
function lerpAng(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

const BULLET_COLORS = { 0: 0x5cc8ff, 1: 0x5cc8ff, 2: 0xff5a6a, 3: 0x5fe07a, 4: 0xc07bff, 9: 0xff5a6a };
const K_FLAME = BULLET_KINDS.indexOf('flame');
const K_FREEZE = BULLET_KINDS.indexOf('freeze');
const K_RAIL = BULLET_KINDS.indexOf('rail');
const K_BLAST = BULLET_KINDS.indexOf('blast');
const K_ORBIT = BULLET_KINDS.indexOf('orbit');
const CONFETTI = [0xff3d6e, 0xffd23f, 0x3fb2f5, 0x5be37a, 0xb14cf0, 0xff9f1c, 0x3fe3f2];

export class Arena {
  constructor(G) {
    this.G = G;
    this.ready = false;
    this.info = new Map();
    this.views = new Map();
    this.snaps = [];
    this.hist = [];
    this.seq = 0;
    this.acc = 0;
    this.pred = { x: 0, z: 0, vx: 0, vz: 0 };
    this.visOff = { x: 0, z: 0 };
    this.prev = { x: 0, z: 0 };
    this.aim = 0;
    this.me = null;
    this.alive = false;
    this.offset = null;
    this.lastLB = null;
    this.hudT = 0;
    this.playT = 0;
    this.deaths = 0;
    this.lastAd = performance.now();
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
    this.tmpV = new THREE.Vector3();
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.col = new THREE.Color();
  }

  // ------------------------------------------------------------------ lifecycle
  async start(mode, roomId) {
    this.mode = mode;
    this.root = new THREE.Group();
    this.G.scene.add(this.root);
    const h = {
      onWelcome: (m) => this.onWelcome(m),
      onSnapshot: (s) => this.onSnap(s),
      onClose: () => this.onDisconnect(),
    };
    let conn = null;
    const url = await resolveServer();
    if (url) {
      const c = new OnlineConn(url, h);
      if (await c.connect()) conn = c;
    }
    if (this.stopped) { if (conn) conn.close(); return; }
    if (!conn) conn = new OfflineConn(h);
    this.conn = conn;
    const d = profile.d;
    conn.join({
      mode, room: roomId, name: d.name || 'Player', level: d.level, xp: d.xp, skin: d.skin, owned: d.owned,
      caps: profile.caps(), xpMul: profile.xpMul(), gemMul: profile.gemMul(), uid: d.uid, rank: d.rank.idx, totalKills: d.totalKills,
    });
  }

  get online() { return this.conn && this.conn.online; }

  onWelcome(m) {
    this.myId = m.id;
    this.roomId = m.room;
    this.half = m.half;
    this.teams = m.teams;
    this.modeDef = MODES[m.mode] || MODES.ffa;
    this.root.add(buildArena(this.half, this.modeDef));
    this.buildPools();
    this.ready = true;
    this.G.hud.toast(this.online ? `Joined ${this.modeDef.name}!` : `${this.modeDef.name} - playing with bots (offline)`, 'blue', 2600);
    if (this.online) SDK.showInviteButton({ room: this.roomId, mode: m.mode });
  }

  onDisconnect() {
    if (this.stopped) return;
    this.G.hud.toast('Disconnected from server', 'red', 3000);
    this.G.toLobby(true);
  }

  stop() {
    this.stopped = true;
    if (this.conn) this.conn.close();
    SDK.hideInviteButton();
    for (const v of this.views.values()) this.disposeView(v);
    this.views.clear();
    if (this.root) {
      this.G.scene.remove(this.root);
      this.root.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh || o.isSprite) {
          if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
          if (o.material && o.material.map && o.isSprite) o.material.map.dispose();
        }
      });
    }
    SDK.gameplayStop();
  }

  // ------------------------------------------------------------------ render pools
  buildPools() {
    this.shapeMeshes = SHAPE_LIST.map((type) => {
      const cap = type === 'cube' ? 700 : type === 'alpha' ? 40 : 400;
      const m = new THREE.InstancedMesh(shapeGeometry(type), shapeMaterial(type), cap);
      m.count = 0;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
      this.root.add(m);
      return m;
    });
    this.shapeBars = [];
    this.bulletMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }), 3000);
    this.bulletMesh.count = 0;
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.castShadow = true;
    this.root.add(this.bulletMesh);
    // particles (pops, confetti, deaths)
    this.parts = [];
    this.partMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), 1200);
    this.partMesh.count = 0;
    this.partMesh.frustumCulled = false;
    this.root.add(this.partMesh);
    this.blasts = [];
    // spawn shield ground decal (own tank)
    this.shieldDecal = new THREE.Mesh(new THREE.PlaneGeometry(9, 10), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
    this.shieldDecal.rotation.x = -Math.PI / 2;
    this.shieldDecal.position.y = 0.06;
    this.shieldDecal.visible = false;
    this.root.add(this.shieldDecal);
    this.shieldNum = -1;
  }

  // ------------------------------------------------------------------ snapshots
  onSnap(s) {
    if (!this.ready) return;
    const now = performance.now() / 1000;
    const target = s.time - now;
    if (this.offset === null || Math.abs(target - this.offset) > 0.5) this.offset = target;
    else this.offset += (target - this.offset) * 0.05;

    for (const id in s.info) this.info.set(+id, s.info[id]);
    const snap = { t: s.time, tk: new Map(), sh: s.sh, bl: s.bl };
    for (const t of s.tk) snap.tk.set(t[0], t);
    this.snaps.push(snap);
    if (this.snaps.length > 40) this.snaps.shift();

    // --- me
    const me = s.me;
    const wasAlive = this.alive;
    this.me = me;
    this.alive = !!me.a;
    if (this.alive && !wasAlive) {
      this.pred.x = me.x; this.pred.z = me.z; this.pred.vx = 0; this.pred.vz = 0;
      this.prev.x = me.x; this.prev.z = me.z;
      this.visOff.x = this.visOff.z = 0;
      this.hist.length = 0;
      this.G.camRig.snap(me.x, me.z);
      this.spawnPos = { x: me.x, z: me.z };
    } else if (this.alive) {
      let idx = -1;
      for (let i = 0; i < this.hist.length; i++) if (this.hist[i].seq === s.ack) { idx = i; break; }
      if (idx >= 0) {
        const hh = this.hist[idx];
        const ex = me.x - hh.x, ez = me.z - hh.z;
        this.hist.splice(0, idx + 1);
        if (Math.abs(ex) + Math.abs(ez) > 0.01) {
          if (Math.hypot(ex, ez) > 12) { this.visOff.x = this.visOff.z = 0; }
          else { this.visOff.x -= ex; this.visOff.z -= ez; }
          this.pred.x += ex; this.pred.z += ez;
          this.prev.x += ex; this.prev.z += ez;
          for (const e of this.hist) { e.x += ex; e.z += ez; }
        }
      }
    }

    profile.setLevelXp(me.lv, me.xp);
    if (me.gp) profile.addGems(me.gp);
    if (me.sd) profile.trackShapes(me.sd);
    if (me.kd) profile.trackKills(me.kd);
    for (const ev of me.ev) this.onEvent(ev);
    if (s.lb) { this.lastLB = s.lb; this.G.hud.renderLB(s.lb); }
    if (s.ch) for (const [n, m, team] of s.ch) this.G.hud.chatLine(n, m, this.teams ? '#' + TEAM_COLORS[team].toString(16).padStart(6, '0') : '#ffd84a');
    for (const f of s.fx) this.onFx(f);
  }

  onEvent(ev) {
    const hud = this.G.hud;
    switch (ev[0]) {
      case 'spawn':
        this.G.menus.close();
        SDK.gameplayStart();
        hud.big('');
        break;
      case 'xp': hud.toast(`Received +${fmtFull(ev[1])} XP!`, 'green'); break;
      case 'lvl': hud.toast(`Level Up! Level ${ev[1]}`, 'gold'); Audio.level(); this.refreshQ(); break;
      case 'up': hud.toast(`Upgraded to ${ev[1]}!`, 'green'); Audio.upgrade(); setTimeout(() => this.refreshQ(), 50); break;
      case 'cap': hud.toast('Upgrade cap reached!', 'red'); Audio.error(); break;
      case 'locked': hud.toast('That tank is locked!', 'red'); break;
      case 'kill': hud.toast(`You destroyed ${ev[1]}!`, 'gold'); Audio.kill(); SDK.happytime(); break;
      case 'alpha': profile.d.alphas++; profile.save(); break;
      case 'dead': {
        Audio.death();
        SDK.gameplayStop();
        this.deaths++;
        profile.d.deaths++;
        profile.d.best = Math.max(profile.d.best, ev[3]);
        this.G.hud.closeQ();
        this.G.hud.closeE();
        const info = { by: ev[1], byTank: ev[2], xp: ev[3], kills: ev[4], time: ev[5] };
        setTimeout(() => {
          if (this.stopped) return;
          this.G.menus.open('death', info, () => this.respawn(), () => this.G.toLobby());
        }, 900);
        break;
      }
    }
  }

  async respawn() {
    if (!this.stopped) this.conn.send({ t: 'respawn' });
  }

  // ------------------------------------------------------------------ actions
  upgradeList() {
    if (!this.me || !this.alive) return [];
    const lv = profile.level, owned = profile.d.owned;
    return childrenOf(this.me.tk).filter((d) => {
      if ((d.unlock.type === 'chest' || d.unlock.type === 'wheel') && !owned.includes(d.id)) return false;
      return true;
    }).map((def) => {
      const usable = canUse(def, lv, owned);
      let tag = '', tagCls = '';
      if (lv < def.level) { tag = `Lv ${def.level}`; tagCls = 'lvl'; }
      else if (!usable && def.unlock.type === 'gems') { tag = `${fmt(def.unlock.price)} 💎`; tagCls = 'gems'; }
      else if (!usable && def.unlock.type === 'quest') { tag = 'Quest 📋'; tagCls = 'quest'; }
      return { def, usable, tag, tagCls };
    }).sort((a, b) => (b.usable - a.usable) || (a.def.level - b.def.level));
  }

  refreshQ() { this.G.hud.renderQ(this.upgradeList()); }
  refreshE() { this.G.hud.renderE(this.me); }

  chooseUpgrade(id) {
    const def = TANKS[id];
    if (!def || !this.alive) return;
    const lv = profile.level;
    if (lv < def.level) { this.G.hud.toast(`Reach level ${def.level} to unlock!`, 'red'); Audio.error(); return; }
    if (canUse(def, lv, profile.d.owned)) { this.conn.send({ t: 'up', id }); return; }
    if (def.unlock.type === 'gems') {
      this.G.menus.open('confirm', `Buy <b>${def.name}</b> for 💎 ${fmtFull(def.unlock.price)}?<br><span class="muted">You keep it forever.</span>`, () => {
        if (!profile.spend(def.unlock.price)) { this.G.hud.toast('Not enough Gems!', 'red'); Audio.error(); return; }
        profile.giveTank(def.id);
        this.G.onOwnedChanged();
        this.conn.send({ t: 'up', id });
      });
    } else if (def.unlock.type === 'quest') {
      this.G.hud.toast('Complete its Unique quest to unlock!', 'red');
      this.G.menus.open('quests', 'unique');
    }
  }

  statUp(i) {
    if (!this.alive || !this.me) return;
    if (this.me.sp <= 0) { this.G.hud.toast('No upgrade points!', 'red'); return; }
    this.conn.send({ t: 'stat', i });
    Audio.click();
  }

  sendOwned() { if (this.conn) this.conn.send({ t: 'own', owned: profile.d.owned }); }
  chat(m) { if (this.conn) this.conn.send({ t: 'chat', m }); }

  // ------------------------------------------------------------------ fx
  burst(x, z, color, n, size = 0.5, speed = 10, up = 6, life = 0.7, y = 1) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 1100) this.parts.shift();
      const a = Math.random() * Math.PI * 2, sp = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x, y, z, vx: Math.cos(a) * sp, vy: up * (0.5 + Math.random()), vz: Math.sin(a) * sp,
        rx: Math.random() * 6, ry: Math.random() * 6, rs: (Math.random() - 0.5) * 12,
        s: size * (0.6 + Math.random() * 0.8), life, t: 0, color: Array.isArray(color) ? color[i % color.length] : color, g: 18,
      });
    }
  }

  onFx(f) {
    const [type, x, z, a] = f;
    if (type === FX.POP) {
      const s = SHAPES[SHAPE_LIST[a]];
      this.burst(x, z, s.color, a >= 3 ? 16 : 7, a >= 3 ? 0.9 : 0.45, a >= 3 ? 14 : 9);
      Audio.pop(a >= 3);
    } else if (type === FX.BLAST) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffb340, transparent: true, opacity: 0.6, depthWrite: false }));
      m.position.set(x, 1, z);
      this.root.add(m);
      this.blasts.push({ m, t: 0, R: a });
      Audio.boom();
    } else if (type === FX.DEATH) {
      this.burst(x, z, [TEAM_COLORS[a] || 0x3d9df2, 0x8fd3f7, 0xffffff], 26, 0.8, 16, 9, 1);
      Audio.boom();
    } else if (type === FX.LEVEL) {
      if (a === this.myId) {
        // big confetti shower around the camera target (like the original's upgrade effect)
        for (let i = 0; i < 70; i++) {
          if (this.parts.length > 1100) this.parts.shift();
          this.parts.push({
            x: x + (Math.random() - 0.5) * 40, y: 8 + Math.random() * 14, z: z + (Math.random() - 0.5) * 40,
            vx: (Math.random() - 0.5) * 3, vy: -2 - Math.random() * 3, vz: (Math.random() - 0.5) * 3,
            rx: Math.random() * 6, ry: Math.random() * 6, rs: (Math.random() - 0.5) * 5, s: 1.1 + Math.random() * 0.9,
            life: 2.2, t: 0, color: CONFETTI[i % CONFETTI.length], g: 2, flat: true,
          });
        }
      } else this.burst(x, z, CONFETTI, 16, 0.5, 8, 10, 1);
    }
  }

  updateFx(dt) {
    const pm = this.partMesh;
    let n = 0;
    const alive = [];
    for (const p of this.parts) {
      p.t += dt;
      if (p.t >= p.life) continue;
      alive.push(p);
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.s * 0.3 && !p.flat) { p.y = p.s * 0.3; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      p.rx += p.rs * dt; p.ry += p.rs * dt * 0.7;
      const k = 1 - Math.max(0, (p.t - p.life * 0.6) / (p.life * 0.4));
      const s = p.s * k;
      this.q.setFromEuler(new THREE.Euler(p.rx, p.ry, 0));
      this.m4.compose(this.tmpV.set(p.x, p.y, p.z), this.q, new THREE.Vector3(s, p.flat ? s * 0.12 : s, s));
      pm.setMatrixAt(n, this.m4);
      pm.setColorAt(n, this.col.setHex(p.color));
      n++;
    }
    this.parts = alive;
    pm.count = n;
    pm.instanceMatrix.needsUpdate = true;
    if (pm.instanceColor) pm.instanceColor.needsUpdate = true;
    this.blasts = this.blasts.filter((b) => {
      b.t += dt;
      const k = b.t / 0.4;
      if (k >= 1) { this.root.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); return false; }
      b.m.scale.setScalar(b.R * (0.3 + 0.7 * k));
      b.m.material.opacity = 0.6 * (1 - k);
      return true;
    });
  }

  // ------------------------------------------------------------------ tank views
  makeView(id, inf) {
    const [name, tankId, skin, team] = inf;
    const model = buildTank(tankId, skin, this.teams ? team : 0);
    const g = new THREE.Group();
    g.add(model.group);
    const isMe = id === this.myId;
    const hp = new Bar(4.2, 0.55, isMe ? 0x3aa8ff : this.teams && team === this.me?.team ? 0x3aa8ff : 0xff4d5e);
    this.root.add(hp.group);
    let label = null;
    if (!isMe) {
      label = textSprite(name, { size: 40, height: 1.5, color: this.teams ? '#' + TEAM_COLORS[team].toString(16).padStart(6, '0') : '#ffffff' });
      g.add(label);
    }
    const shield = new THREE.Mesh(new THREE.SphereGeometry(model.R * 1.55, 20, 14), new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.18, depthWrite: false }));
    shield.position.y = model.R * 0.4;
    shield.visible = false;
    g.add(shield);
    const shieldIcon = textSprite('🛡️', { size: 64, height: 2.4, stroke: false });
    shieldIcon.visible = false;
    this.root.add(shieldIcon);
    this.root.add(g);
    return { id, g, model, hp, label, shield, shieldIcon, tankId, skin, team, name, x: 0, z: 0, aim: 0, opacity: 1 };
  }

  disposeView(v) {
    this.root.remove(v.g);
    this.root.remove(v.hp.group);
    this.root.remove(v.shieldIcon);
    v.hp.dispose();
    disposeTank(v.model);
    if (v.label) { v.label.material.map.dispose(); v.label.material.dispose(); }
    v.shieldIcon.material.map.dispose();
  }

  rebuildModel(v, inf) {
    v.g.remove(v.model.group);
    disposeTank(v.model);
    v.model = buildTank(inf[1], inf[2], this.teams ? inf[3] : 0);
    v.g.add(v.model.group);
    v.tankId = inf[1];
    v.skin = inf[2];
    v.opacity = 1;
    v.shield.geometry.dispose();
    v.shield.geometry = new THREE.SphereGeometry(v.model.R * 1.55, 20, 14);
  }

  // ------------------------------------------------------------------ frame
  update(dt) {
    const G = this.G;
    if (this.conn) this.conn.update(dt);
    if (!this.ready) return;
    const rig = G.camRig;
    const sens = profile.d.settings.sens || 1;

    // camera control
    rig.yaw -= Input.consumeYaw() * 0.006 * sens;
    if (G.toggles.lock && Input.locked) rig.yaw -= Input.consumeLock() * 0.0028 * sens;
    else Input.consumeLock();
    const wh = Input.consumeWheel();
    if (wh) rig.zoom = Math.max(0.55, Math.min(1.8, rig.zoom * (wh > 0 ? 1.1 : 0.9)));

    const me = this.me;
    const d = me ? derived(me.tk, me.lv, me.st) : null;

    // aim
    const fw = rig.forward(), rt = rig.right();
    if (G.toggles.autoSpin) this.aim += dt * 2.6;
    else if (Input.joyAim.active && Input.joyAim.mag > 0.2) {
      const jx = Input.joyAim.x, jy = Input.joyAim.y;
      this.aim = Math.atan2(rt.z * jx - fw.z * jy, rt.x * jx - fw.x * jy);
    } else if (G.toggles.lock) {
      this.aim = Math.atan2(fw.z, fw.x);
    } else if (!Input.touch) {
      this.ray.setFromCamera({ x: Input.mouse.nx, y: Input.mouse.ny }, G.camera);
      if (this.ray.ray.intersectPlane(this.plane, this.tmpV)) {
        this.aim = Math.atan2(this.tmpV.z - this.renderZ(), this.tmpV.x - this.renderX());
      }
    }

    const ax = Input.moveAxes();
    let mx = fw.x * ax.f + rt.x * ax.r, mz = fw.z * ax.f + rt.z * ax.r;
    const mm = Math.hypot(mx, mz);
    if (mm > 1) { mx /= mm; mz /= mm; }
    const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    if (typing) { mx = 0; mz = 0; }
    const fire = !typing && !G.menus.isOpen && (G.toggles.autoFire || G.toggles.autoSpin || Input.firing());

    // fixed-rate input + prediction
    this.acc += Math.min(dt, 0.25);
    while (this.acc >= DT) {
      this.acc -= DT;
      this.seq++;
      this.prev.x = this.pred.x;
      this.prev.z = this.pred.z;
      if (this.alive && d) {
        predictMove(this.pred, mx, mz, d.speed * (me.slow ? 0.55 : 1), this.half, d.r, DT);
        this.hist.push({ seq: this.seq, x: this.pred.x, z: this.pred.z });
        if (this.hist.length > 90) this.hist.shift();
      }
      this.conn.send({ t: 'in', s: this.seq, mx: +mx.toFixed(3), mz: +mz.toFixed(3), a: +this.aim.toFixed(3), f: fire ? 1 : 0 });
      if (fire && this.alive && getTank(me.tk).barrels.length) Audio.shoot();
    }
    const decay = Math.exp(-dt * 10);
    this.visOff.x *= decay;
    this.visOff.z *= decay;

    // play time tracking
    if (this.alive) {
      this.playT += dt;
      if (this.playT >= 1) { this.playT -= 1; profile.trackPlay(1); }
    }

    this.renderWorld(dt);
    this.updateFx(dt);

    // camera follows
    const fov = d ? d.fov : 1;
    rig.update(dt, this.renderX(), this.renderZ(), fov);
    G.sun.position.set(rig.cur.x + 30, 70, rig.cur.z + 25);
    G.sun.target.position.set(rig.cur.x, 0, rig.cur.z);

    // HUD at 8 Hz
    this.hudT -= dt;
    if (this.hudT <= 0 && me) {
      this.hudT = 0.12;
      const opts = this.upgradeList();
      G.hud.renderQ(opts);
      G.hud.renderE(me);
      G.hud.setCombat(this.alive ? me.cb || 0 : 0);
    }
  }

  renderX() {
    if (!this.alive) return this.me ? this.me.x : 0;
    const a = this.acc / DT;
    return lerp(this.prev.x, this.pred.x, a) + this.visOff.x;
  }
  renderZ() {
    if (!this.alive) return this.me ? this.me.z : 0;
    const a = this.acc / DT;
    return lerp(this.prev.z, this.pred.z, a) + this.visOff.z;
  }

  renderWorld(dt) {
    const snaps = this.snaps;
    if (!snaps.length) return;
    const now = performance.now() / 1000;
    const delay = this.online ? 0.12 : 0.045;
    const rt = now + this.offset - delay;
    while (snaps.length > 2 && snaps[1].t <= rt) snaps.shift();
    const A = snaps[0];
    const B = snaps[1] || A;
    const span = B.t - A.t;
    const t = span > 0 ? Math.max(0, Math.min(1, (rt - A.t) / span)) : 1;
    const cam = this.G.camera;
    const fw = this.G.camRig.forward();
    const showNames = profile.d.settings.names;

    // --- tanks
    const seen = new Set();
    for (const [id, b] of B.tk) {
      const inf = this.info.get(id);
      if (!inf) continue;
      seen.add(id);
      let v = this.views.get(id);
      if (!v) { v = this.makeView(id, inf); this.views.set(id, v); }
      else if (v.tankId !== inf[1] || v.skin !== inf[2]) this.rebuildModel(v, inf);
      const a = A.tk.get(id) || b;
      let x, z, aim;
      if (id === this.myId && this.alive) { x = this.renderX(); z = this.renderZ(); aim = this.aim; }
      else { x = lerp(a[1], b[1], t); z = lerp(a[2], b[2], t); aim = lerpAng(a[3], b[3], t); }
      v.x = x; v.z = z;
      v.g.position.set(x, 0, z);
      v.model.rot.rotation.y = -aim;
      if (v.model.spikes) v.model.spikes.rotation.y += dt * (v.model.def.id === 'grinder' || v.model.def.id === 'megagrinder' ? 6 : 1.5);
      const flags = b[5];
      const shielded = !!(flags & 1);
      const stealth = !!(flags & 2);
      const op = stealth ? (id === this.myId || (this.teams && v.team === this.me.team) ? 0.35 : 0.12) : 1;
      if (op !== v.opacity) { setTankOpacity(v.model, op); v.opacity = op; }
      v.shield.visible = shielded;
      // hp bar below the tank (towards the camera), shield icon when protected
      const R = v.model.R;
      const bx = x - fw.x * (R + 1.6), bz = z - fw.z * (R + 1.6);
      v.hp.set(b[4] / 100);
      const showHp = !shielded && (id === this.myId || b[4] < 100);
      v.hp.group.visible = showHp && op > 0.2;
      v.hp.group.position.set(bx, 0.6, bz);
      v.hp.group.quaternion.copy(cam.quaternion);
      v.shieldIcon.visible = shielded;
      v.shieldIcon.position.set(bx, 1.2, bz);
      if (v.label) { v.label.visible = showNames && op > 0.5; v.label.position.set(0, R * 1.2 + 2.2, 0); }
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) { this.disposeView(v); this.views.delete(id); }
    }

    // spawn-shield ground decal for the local player
    if (this.me && this.alive && this.me.sh > 0 && this.spawnPos) {
      const n = Math.ceil(this.me.sh);
      if (n !== this.shieldNum) { this.shieldNum = n; this.drawShieldDecal(n); }
      this.shieldDecal.visible = true;
      this.shieldDecal.position.x = this.spawnPos.x;
      this.shieldDecal.position.z = this.spawnPos.z;
      this.shieldDecal.rotation.z = this.G.camRig.yaw;
    } else this.shieldDecal.visible = false;

    // --- shapes
    const counts = [0, 0, 0, 0, 0];
    const aSh = A.shMap || (A.shMap = new Map(A.sh.map((s) => [s[0], s])));
    let barN = 0;
    const cx = this.G.camRig.cur.x, cz = this.G.camRig.cur.z;
    for (const s of B.sh) {
      const a = aSh.get(s[0]) || s;
      const ti = s[1];
      const mesh = this.shapeMeshes[ti];
      if (counts[ti] >= mesh.instanceMatrix.count) continue;
      const x = lerp(a[2], s[2], t), z = lerp(a[3], s[3], t), rot = lerpAng(a[4], s[4], t);
      this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -rot);
      this.m4.compose(this.tmpV.set(x, 0, z), this.q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(counts[ti]++, this.m4);
      if (s[5] < 100 && barN < 40 && Math.abs(x - cx) < 70 && Math.abs(z - cz) < 70) {
        let bar = this.shapeBars[barN];
        if (!bar) { bar = new Bar(3, 0.45, 0x5fe07a); this.shapeBars.push(bar); this.root.add(bar.group); }
        bar.group.visible = true;
        bar.set(s[5] / 100);
        const def = SHAPES[SHAPE_LIST[ti]];
        bar.group.scale.setScalar(ti === 4 ? 2 : 1);
        bar.group.position.set(x, def.h + 1.4, z);
        bar.group.quaternion.copy(cam.quaternion);
        barN++;
      }
    }
    for (let i = barN; i < this.shapeBars.length; i++) this.shapeBars[i].group.visible = false;
    this.shapeMeshes.forEach((m, i) => { m.count = counts[i]; m.instanceMatrix.needsUpdate = true; });

    // --- bullets
    const aBl = A.blMap || (A.blMap = new Map(A.bl.map((b) => [b[0], b])));
    const bm = this.bulletMesh;
    let n = 0;
    const myTeam = this.me ? this.me.team : 0;
    for (const b of B.bl) {
      if (n >= 3000) break;
      const a = aBl.get(b[0]) || b;
      const x = lerp(a[1], b[1], t), z = lerp(a[2], b[2], t), r = b[3];
      const k = b[4];
      let color = BULLET_COLORS[b[5] === 0 && this.teams ? myTeam : b[5]] || 0x5cc8ff;
      if (k === K_FLAME) color = Math.random() < 0.5 ? 0xffa030 : 0xffd23f;
      else if (k === K_FREEZE) color = 0xe8fbff;
      else if (k === K_RAIL) color = 0x9ff4ff;
      else if (k === K_BLAST) color = b[5] === 0 ? 0xffb340 : 0xff7040;
      else if (k === K_ORBIT && b[5] === 0) color = 0x7fe0ff;
      this.m4.makeScale(r, r, r);
      this.m4.setPosition(x, Math.max(r, 0.9), z);
      bm.setMatrixAt(n, this.m4);
      bm.setColorAt(n, this.col.setHex(color));
      n++;
    }
    bm.count = n;
    bm.instanceMatrix.needsUpdate = true;
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
  }

  drawShieldDecal(n) {
    const c = document.createElement('canvas');
    c.width = 180; c.height = 200;
    const ctx = c.getContext('2d');
    ctx.translate(90, 100);
    ctx.beginPath();
    ctx.moveTo(0, -90); ctx.quadraticCurveTo(60, -70, 82, -66); ctx.quadraticCurveTo(84, 40, 0, 94); ctx.quadraticCurveTo(-84, 40, -82, -66); ctx.quadraticCurveTo(-60, -70, 0, -90);
    ctx.fillStyle = 'rgba(120,205,255,0.55)'; ctx.fill();
    ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(170,120,255,0.8)'; ctx.stroke();
    const tc = textCanvas(String(n), { size: 80, color: 'rgba(255,255,255,0.9)', strokeColor: 'rgba(80,150,220,0.6)' });
    ctx.drawImage(tc, -tc.width / 2, -tc.height / 2);
    const old = this.shieldDecal.material.map;
    this.shieldDecal.material.map = new THREE.CanvasTexture(c);
    this.shieldDecal.material.map.colorSpace = THREE.SRGBColorSpace;
    this.shieldDecal.material.needsUpdate = true;
    if (old) old.dispose();
  }
}
