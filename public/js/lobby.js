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
  constructor(root, lobby, fromPortal) {
    this.root = root;
    this.lobby = lobby;
    const skin = Math.random() < 0.45 ? 'default' : SKIN_IDS[1 + Math.floor(Math.random() * (SKIN_IDS.length - 1))];
    this.model = buildTank(NPC_TANKS[Math.floor(Math.random() * NPC_TANKS.length)], skin);
    this.g = new THREE.Group();
    this.g.add(this.model.group);
    this.label = textSprite(botName(), { size: 38, height: 1.4 });
    this.label.position.y = this.model.R * 1.2 + 2.4;
    this.g.add(this.label);
    if (fromPortal) {
      // just came back from a match: step out of a portal
      const po = LOBBY.portals[Math.floor(Math.random() * LOBBY.portals.length)];
      this.x = po.x * 0.82; this.z = po.z - 6;
    } else {
      const p = freeLobbySpot();
      this.x = p.x; this.z = p.z;
    }
    this.vx = 0; this.vz = 0;
    this.aim = Math.random() * 6.28;
    this.head = this.aim;
    this.spawnT = 0;
    this.leaving = 0;
    this.g.scale.setScalar(0.01);
    root.add(this.g);
    this.next();
  }
  next() {
    const r = Math.random();
    this.wait = 0;
    if (r < 0.3) { const po = LOBBY.portals[Math.floor(Math.random() * LOBBY.portals.length)]; this.goal = { x: po.x, z: po.z - 1, kind: 'portal', id: po.id }; }
    else if (r < 0.58) {
      // stand on the near edge of a shop pad (like a player opening the shop), not on its prop
      const pad = LOBBY.pads[Math.floor(Math.random() * LOBBY.pads.length)];
      const d = Math.hypot(pad.x, pad.z) || 1, k = (LOBBY.padR * 0.55) / d;
      this.goal = { x: pad.x - pad.x * k + (Math.random() - 0.5) * 2, z: pad.z - pad.z * k + (Math.random() - 0.5) * 2, kind: 'pad', stay: 3 + Math.random() * 5 };
    } else if (r < 0.84) { const p = freeLobbySpot(); this.goal = { x: p.x, z: p.z, kind: 'wander' }; }
    else this.goal = { kind: 'afk', stay: 4 + Math.random() * 8 };
  }
  update(dt, others) {
    this.spawnT = Math.min(1, this.spawnT + dt * 2.5);
    let scale = this.spawnT;
    if (this.leaving) {
      this.leaving += dt;
      scale = Math.max(0.01, 1 - this.leaving * 2);
      if (this.leaving > 0.55) return false; // gone into the portal
    }
    const G = this.goal;
    let wx = 0, wz = 0, speed = 0;
    if (G.kind === 'afk' || this.wait > 0) {
      this.wait = this.wait > 0 ? this.wait - dt : 0;
      if (G.kind === 'afk') { G.stay -= dt; this.aim += dt * 0.6; if (G.stay <= 0) this.next(); }
      else if (this.wait <= 0) this.next();
    } else if (!this.leaving) {
      const dx = G.x - this.x, dz = G.z - this.z, d = Math.hypot(dx, dz);
      if (d < 1.4) {
        if (G.kind === 'portal') this.leaving = 0.001;
        else if (G.kind === 'pad') this.wait = G.stay;
        else this.next();
      } else {
        wx = dx / d; wz = dz / d;
        speed = 15 * Math.min(1, d / 5); // slow down on arrival
        // steer around obstacles: other portals, shop props, other tanks
        for (const o of obstaclesFor(this, others)) {
          const ox = this.x - o.x, oz = this.z - o.z, od = Math.hypot(ox, oz) || 0.01;
          const R = o.r + 3.5;
          if (od > R) continue;
          const push = (R - od) / R;
          wx += (ox / od) * push * 2.2;
          wz += (oz / od) * push * 2.2;
          // slide round it on the side the goal is on
          const side = Math.sign(-oz * dx + ox * dz) || 1;
          wx += (-oz / od) * side * push * 1.2;
          wz += (ox / od) * side * push * 1.2;
        }
        const m = Math.hypot(wx, wz) || 1;
        wx /= m; wz /= m;
      }
    }
    // smooth acceleration; slow down while turning sharply
    const turnDa = ((Math.atan2(wz, wx) - this.head + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (speed > 0) { this.head += Math.max(-dt * 7, Math.min(dt * 7, turnDa)); speed *= 0.45 + 0.55 * Math.max(0, Math.cos(turnDa)); }
    const k = Math.min(1, dt * 6);
    this.vx += (Math.cos(this.head) * speed - this.vx) * k;
    this.vz += (Math.sin(this.head) * speed - this.vz) * k;
    this.x += this.vx * dt; this.z += this.vz * dt;
    const H = LOBBY.half - 3;
    this.x = Math.max(-H, Math.min(H, this.x)); this.z = Math.max(-H, Math.min(H, this.z));
    // turret looks where it is going (with a little idle look-around)
    if (speed > 0.5) {
      const da = ((this.head - this.aim + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.aim += Math.max(-dt * 5, Math.min(dt * 5, da));
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

// obstacles an NPC should walk around (everything except the portal it is heading into)
function obstaclesFor(npc, others) {
  const list = [];
  for (const po of LOBBY.portals) if (!(npc.goal && npc.goal.id === po.id)) list.push({ x: po.x, z: po.z, r: po.big ? 7.5 : 6 });
  for (const pad of LOBBY.pads) list.push({ x: pad.x, z: pad.z, r: 2.6 });
  for (const o of others) if (o !== npc) list.push({ x: o.x, z: o.z, r: 2.2 });
  return list;
}
function freeLobbySpot() {
  for (let k = 0; k < 30; k++) {
    const x = (Math.random() * 2 - 1) * 30, z = (Math.random() * 2 - 1) * 24;
    const bad = LOBBY.portals.some((p) => Math.hypot(p.x - x, p.z - z) < 10) || LOBBY.pads.some((p) => Math.hypot(p.x - x, p.z - z) < 8);
    if (!bad) return { x, z };
  }
  return { x: 0, z: 0 };
}

export class Lobby {
  constructor(G) {
    this.G = G;
    this.inside = {};
    this.pos = { x: 0, z: 2, vx: 0, vz: 0 };
    this.aim = Math.PI / 2; // facing the battle portals
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
    G.camRig.yaw = Math.PI; // camera looks toward the portals (not the chest)
    this.aim = Math.PI / 2;
    G.camRig.snap(this.pos.x, this.pos.z);
  }

  makeTank() {
    if (this.tank) { this.env.root.remove(this.tank.group); disposeTank(this.tank); }
    this.tank = buildTank('default', profile.d.skin);
    this.env.root.add(this.tank.group);
  }

  setSkin() { this.makeTank(); }

  // there are always 2-3 other players hanging around the lobby
  updateNpcs(dt) {
    if (!this.npcs) {
      this.npcs = [];
      this.npcWant = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < this.npcWant; i++) this.npcs.push(new LobbyNpc(this.env.root, this, false));
      this.npcTimer = 3;
    }
    const others = [...this.npcs, { x: this.pos.x, z: this.pos.z }];
    this.npcs = this.npcs.filter((n) => { const alive = n.update(dt, others); if (!alive) n.dispose(); return alive; });
    this.npcTimer -= dt;
    if (this.npcs.length < 2 && this.npcTimer > 2.5) this.npcTimer = 1.5 + Math.random();
    if (this.npcTimer <= 0) {
      this.npcTimer = 5 + Math.random() * 8;
      this.npcWant = 2 + (Math.random() < 0.5 ? 1 : 0);
      if (this.npcs.length < this.npcWant) this.npcs.push(new LobbyNpc(this.env.root, this, true));
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
    if (wh) rig.zoom = Math.max(0.55, Math.min(3.2, rig.zoom * (wh > 0 ? 1.1 : 0.9)));
    const pinch = Input.consumePinch(); // mobile pinch: fingers apart = zoom in (closer camera)
    if (pinch !== 1) rig.zoom = Math.max(0.55, Math.min(3.2, rig.zoom / pinch));

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
      // enter only by driving through the arch's opening (not just near the portal)
      const sc = (po.big ? 1.35 : 1) * 1.5; // same scale as the 3D portal
      const nd = Math.hypot(po.x, po.z) || 1, nx = -po.x / nd, nz = -po.z / nd; // arch faces the lobby centre
      const rx = p.x - po.x, rz = p.z - po.z;
      const front = rx * nx + rz * nz; // distance in front of the arch plane
      const side = Math.abs(rx * -nz + rz * nx); // sideways from the arch centre
      const r = po.big ? 7.5 : 6; // used for the locked-portal push-back
      if (front < 0.9 && front > -4 && side < 3.3 * sc) {
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
