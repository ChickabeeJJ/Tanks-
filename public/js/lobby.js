// Lobby hub: drive around, step on pads to open shops, drive into portals to play.
import * as THREE from '../vendor/three.module.min.js';
import { placeSun } from './render/scene.js';
import { buildLobby, LOBBY } from './render/scene.js';
import { buildTank, disposeTank } from './render/models.js';
import { Input } from './input.js';
import { profile } from './profile.js';
import { MODES } from '../shared/config.js';
import { Audio } from './audio.js';
import { textSprite } from './render/textures.js';
import { botName } from '../shared/names.js';
import { SKIN_IDS } from '../shared/skins.js';

// ------------------------------------------------------------------ lobby NPCs
// 1-2 other "players" hang around the lobby: walk into a battle portal, visit a shop pad,
// wander, or just sit AFK. Purely visual (client-side).
const NPC_TANKS = ['default', 'default', 'default', 'double', 'scout', 'spammer', 'side', 'triway', 'hitman', 'grinder', 'flame'];
class LobbyNpc {
  constructor(root) {
    this.root = root;
    const skin = Math.random() < 0.45 ? 'default' : SKIN_IDS[1 + Math.floor(Math.random() * (SKIN_IDS.length - 1))];
    this.model = buildTank(NPC_TANKS[Math.floor(Math.random() * NPC_TANKS.length)], skin);
    this.g = new THREE.Group();
    this.g.add(this.model.group);
    this.label = textSprite(botName(), { size: 38, height: 1.4 });
    this.label.position.y = this.model.R * 1.2 + 2.4;
    this.g.add(this.label);
    const a = Math.random() * Math.PI * 2;
    this.x = Math.cos(a) * 6; this.z = Math.sin(a) * 6;
    this.aim = Math.random() * 6.28;
    this.spawnT = 0;
    this.leaving = 0;
    this.g.scale.setScalar(0.01);
    root.add(this.g);
    this.next();
  }
  next() {
    const r = Math.random();
    this.wait = 0;
    if (r < 0.35) { const po = LOBBY.portals[Math.floor(Math.random() * LOBBY.portals.length)]; this.goal = { x: po.x, z: po.z, kind: 'portal' }; }
    else if (r < 0.6) { const pad = LOBBY.pads[Math.floor(Math.random() * LOBBY.pads.length)]; this.goal = { x: pad.x + (Math.random() - 0.5) * 3, z: pad.z + (Math.random() - 0.5) * 3, kind: 'pad', stay: 3 + Math.random() * 5 }; }
    else if (r < 0.82) { this.goal = { x: (Math.random() * 2 - 1) * 30, z: (Math.random() * 2 - 1) * 26, kind: 'wander' }; }
    else this.goal = { kind: 'afk', stay: 5 + Math.random() * 9 };
  }
  update(dt, t) {
    this.spawnT = Math.min(1, this.spawnT + dt * 2.5);
    let scale = this.spawnT;
    if (this.leaving) {
      this.leaving += dt;
      scale = Math.max(0.01, 1 - this.leaving * 2);
      if (this.leaving > 0.55) return false; // gone into the portal
    }
    const G = this.goal;
    if (G.kind === 'afk' || this.wait > 0) {
      this.wait = this.wait > 0 ? this.wait - dt : 0;
      if (G.kind === 'afk') { G.stay -= dt; this.aim += dt * 0.6; if (G.stay <= 0) this.next(); }
      else if (this.wait <= 0) this.next();
    } else if (!this.leaving) {
      const dx = G.x - this.x, dz = G.z - this.z, d = Math.hypot(dx, dz);
      if (d < 1.2) {
        if (G.kind === 'portal') this.leaving = 0.001;
        else if (G.kind === 'pad') this.wait = G.stay;
        else this.next();
      } else {
        const sp = 15 * Math.min(1, d / 3);
        this.x += (dx / d) * sp * dt;
        this.z += (dz / d) * sp * dt;
        const want = Math.atan2(dz, dx);
        let da = ((want - this.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        this.aim += Math.max(-dt * 6, Math.min(dt * 6, da));
      }
    }
    this.g.position.set(this.x, 0, this.z);
    this.g.scale.setScalar(scale);
    this.model.rot.rotation.y = -this.aim;
    return true;
  }
  dispose() {
    this.root.remove(this.g);
    disposeTank(this.model);
    this.label.material.map.dispose();
    this.label.material.dispose();
  }
}

export class Lobby {
  constructor(G) {
    this.G = G;
    this.inside = {};
    this.pos = { x: 0, z: 2, vx: 0, vz: 0 };
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
  }

  makeTank() {
    if (this.tank) { this.env.root.remove(this.tank.group); disposeTank(this.tank); }
    this.tank = buildTank('default', profile.d.skin);
    this.env.root.add(this.tank.group);
  }

  setSkin() { this.makeTank(); }

  updateNpcs(dt) {
    if (!this.npcs) { this.npcs = []; this.npcTimer = 2 + Math.random() * 3; this.npcWant = 1 + (Math.random() < 0.5 ? 1 : 0); }
    this.npcs = this.npcs.filter((n) => { const alive = n.update(dt, this.t); if (!alive) n.dispose(); return alive; });
    this.npcTimer -= dt;
    if (this.npcTimer <= 0) {
      this.npcTimer = 6 + Math.random() * 10;
      this.npcWant = 1 + (Math.random() < 0.5 ? 1 : 0);
      if (this.npcs.length < this.npcWant) this.npcs.push(new LobbyNpc(this.env.root));
    }
  }

  stop() {
    if (this.npcs) { this.npcs.forEach((n) => n.dispose()); this.npcs = []; }
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
    rig.pitch = Math.max(0.22, Math.min(1.2, rig.pitch + Input.consumePitch() * 0.004 * sens)); // tilt up/down
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
    const k = Math.min(1, 18 * dt);
    p.vx += (mx * sp - p.vx) * k;
    p.vz += (mz * sp - p.vz) * k;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    const H = LOBBY.half - 2;
    p.x = Math.max(-H, Math.min(H, p.x));
    p.z = Math.max(-H, Math.min(H, p.z));

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
      const inside = Math.hypot(pad.x - p.x, pad.z - p.z) < LOBBY.padR;
      if (inside && !this.inside[pad.id] && !G.menus.isOpen) { Audio.click(); G.menus.open(pad.id); }
      this.inside[pad.id] = inside;
    }
    // portals
    for (const po of LOBBY.portals) {
      const r = po.big ? 7.5 : 6; // bigger portals
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
    this.updateNpcs(dt);
    rig.update(dt, p.x, p.z, 1);
    placeSun(G.sun, rig.cur.x, rig.cur.z);
  }
}
