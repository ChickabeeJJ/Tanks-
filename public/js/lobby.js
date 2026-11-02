// Lobby hub: drive around, step on pads to open shops, drive into portals to play.
import * as THREE from '../vendor/three.module.min.js';
import { buildLobby, LOBBY, boardCanvas } from './render/scene.js';
import { buildTank, disposeTank } from './render/models.js';
import { Input } from './input.js';
import { profile } from './profile.js';
import { MODES } from '../shared/config.js';
import { botName } from '../shared/names.js';
import { Audio } from './audio.js';

function seeded(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export class Lobby {
  constructor(G) {
    this.G = G;
    this.inside = {};
    this.pos = { x: 0, z: 6, vx: 0, vz: 0 };
    this.aim = -Math.PI / 2;
    this.ray = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.9);
    this.v = new THREE.Vector3();
    this.t = 0;
  }

  start() {
    const G = this.G;
    this.env = buildLobby(profile.d.skin);
    G.scene.add(this.env.root);
    this.makeTank();
    G.camRig.yaw = 0;
    G.camRig.snap(this.pos.x, this.pos.z);
    this.loadBoards();
  }

  makeTank() {
    if (this.tank) { this.env.root.remove(this.tank.group); disposeTank(this.tank); }
    this.tank = buildTank('default', profile.d.skin);
    this.env.root.add(this.tank.group);
  }

  setSkin() { this.makeTank(); }

  async loadBoards() {
    const data = await this.G.fetchBoards();
    const d = profile.d;
    const me = d.name || 'You';
    let boards = data;
    if (!boards) {
      // offline: local leaderboard against the arena bots
      const rnd = seeded(1234);
      const mk = (scale) => Array.from({ length: 12 }, () => [botName(rnd), Math.floor((0.2 + rnd()) * scale)]);
      boards = { kills: mk(400), level: mk(300), rank: mk(20) };
    }
    const put = (rows, v) => {
      rows = rows.filter((r) => r[0] !== me);
      rows.push([me, v]);
      return rows.sort((a, b) => b[1] - a[1]);
    };
    const all = { kills: put(boards.kills, d.totalKills), level: put(boards.level, d.level), rank: put(boards.rank, d.rank.idx) };
    if (!this.env) return;
    for (const [k, b] of Object.entries(this.env.boards)) {
      const c = boardCanvas(b.label, all[k], k === 'kills' ? '#2fa8ff' : k === 'rank' ? '#2fa8ff' : '#2fc0ff');
      b.tex.image = c;
      b.tex.needsUpdate = true;
    }
  }

  stop() {
    if (!this.env) return;
    this.G.scene.remove(this.env.root);
    this.env.root.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh) { o.geometry.dispose(); }
      if (o.isSprite) { o.material.map.dispose(); o.material.dispose(); }
    });
    this.env = null;
  }

  update(dt) {
    const G = this.G;
    if (!this.env) return;
    this.t += dt;
    const rig = G.camRig;
    const sens = profile.d.settings.sens || 1;
    rig.yaw -= Input.consumeYaw() * 0.006 * sens;
    if (G.toggles.lock && Input.locked) rig.yaw -= Input.consumeLock() * 0.0028 * sens;
    else Input.consumeLock();
    const wh = Input.consumeWheel();
    if (wh) rig.zoom = Math.max(0.55, Math.min(1.8, rig.zoom * (wh > 0 ? 1.1 : 0.9)));

    const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    const fw = rig.forward(), rt = rig.right();
    const ax = typing || G.menus.isOpen ? { f: 0, r: 0 } : Input.moveAxes();
    let mx = fw.x * ax.f + rt.x * ax.r, mz = fw.z * ax.f + rt.z * ax.r;
    const m = Math.hypot(mx, mz);
    if (m > 1) { mx /= m; mz /= m; }
    const p = this.pos;
    const sp = 20;
    const k = Math.min(1, 7 * dt);
    p.vx += (mx * sp - p.vx) * k;
    p.vz += (mz * sp - p.vz) * k;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const H = LOBBY.half - 2;
    p.x = Math.max(-H, Math.min(H, p.x));
    p.z = Math.max(-H, Math.min(H + 4, p.z));

    // aim at mouse (or movement direction)
    if (G.toggles.lock) this.aim = Math.atan2(fw.z, fw.x);
    else if (!Input.touch) {
      this.ray.setFromCamera({ x: Input.mouse.nx, y: Input.mouse.ny }, G.camera);
      if (this.ray.ray.intersectPlane(this.plane, this.v)) this.aim = Math.atan2(this.v.z - p.z, this.v.x - p.x);
    } else if (m > 0.1) this.aim = Math.atan2(mz, mx);
    if (G.toggles.autoSpin) this.aim += dt * 2.6;

    this.tank.group.position.set(p.x, 0, p.z);
    this.tank.rot.rotation.y = -this.aim;

    // pads
    for (const pad of LOBBY.pads) {
      const inside = Math.hypot(pad.x - p.x, pad.z - p.z) < 4.4;
      if (inside && !this.inside[pad.id] && !G.menus.isOpen) { Audio.click(); G.menus.open(pad.id); }
      this.inside[pad.id] = inside;
    }
    // portals
    for (const po of LOBBY.portals) {
      const r = po.big ? 5 : 4;
      if (Math.hypot(po.x - p.x, po.z - p.z) < r) {
        const mode = MODES[po.id];
        if (mode.minLevel && profile.level < mode.minLevel) {
          if (!this.inside[po.id]) G.hud.toast(`Reach Level ${mode.minLevel} to enter ${mode.name}!`, 'red');
          this.inside[po.id] = true;
          const dx = p.x - po.x, dz = p.z - po.z, d = Math.hypot(dx, dz) || 1;
          p.x = po.x + (dx / d) * r; p.z = po.z + (dz / d) * r;
          continue;
        }
        G.play(po.id);
        return;
      }
      this.inside[po.id] = false;
    }

    for (const f of this.env.anim) f(this.t);
    rig.update(dt, p.x, p.z, 1);
    G.sun.position.set(rig.cur.x + 30, 70, rig.cur.z + 25);
    G.sun.target.position.set(rig.cur.x, 0, rig.cur.z);
  }
}
