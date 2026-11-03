// 3D models: tanks (dome body + barrels), shapes, bars.
import * as THREE from '../../vendor/three.module.min.js';
import { getTank } from '../../shared/tanks.js';
import { SHAPES, SHAPE_LIST, TEAM_COLORS } from '../../shared/config.js';
import { skinTexture } from './textures.js';

const geo = {
  dome: new THREE.SphereGeometry(1, 32, 20),
  barrel: new THREE.CylinderGeometry(0.5, 0.5, 1, 18, 1),
  cap: new THREE.CircleGeometry(0.5, 18),
  spike: new THREE.ConeGeometry(0.35, 1, 8),
  ring: new THREE.RingGeometry(0.85, 1, 40),
  disc: new THREE.CircleGeometry(1, 32),
  plane: new THREE.PlaneGeometry(1, 1),
};
geo.barrel.rotateZ(-Math.PI / 2); // along +x
geo.spike.rotateZ(-Math.PI / 2);
geo.cap.rotateY(Math.PI / 2);
geo.ring.rotateX(-Math.PI / 2);
geo.disc.rotateX(-Math.PI / 2);

const mats = {
  barrel: new THREE.MeshStandardMaterial({ color: 0x7fd0ff, roughness: 0.45, emissive: 0x2a6f99, emissiveIntensity: 0.25 }),
  barrelRed: new THREE.MeshStandardMaterial({ color: 0xff9aa2, roughness: 0.55 }),
  barrelGreen: new THREE.MeshStandardMaterial({ color: 0x9ff0a8, roughness: 0.55 }),
  barrelPurple: new THREE.MeshStandardMaterial({ color: 0xd2a8ff, roughness: 0.55 }),
  freeze: new THREE.MeshStandardMaterial({ color: 0xf5fcff, roughness: 0.4 }),
  flame: new THREE.MeshStandardMaterial({ color: 0x7a7f8c, roughness: 0.6, metalness: 0.2 }),
  rail: new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.4, metalness: 0.4 }),
  cap: new THREE.MeshBasicMaterial({ color: 0x0b0f1a }),
  railCap: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.4, 3.0), toneMapped: false }),
  railRing: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.8, 2.6), toneMapped: false }),
  spike: new THREE.MeshStandardMaterial({ color: 0x55596a, roughness: 0.5, metalness: 0.3 }),
  shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
};
const teamBarrel = { 1: mats.barrel, 2: mats.barrelRed, 3: mats.barrelGreen, 4: mats.barrelPurple };

const skinMats = new Map();
function bodyMaterial(skinId) {
  if (skinMats.has(skinId)) return skinMats.get(skinId);
  const m = new THREE.MeshStandardMaterial({
    map: skinTexture(skinId), roughness: skinId === 'gold' ? 0.25 : 0.42, metalness: skinId === 'gold' ? 0.5 : 0.0,
    emissive: 0xffffff, emissiveMap: skinTexture(skinId), emissiveIntensity: 0.12,
  });
  skinMats.set(skinId, m);
  return m;
}

// Build a tank. Group origin is on the ground; +x is "forward".
export function buildTank(tankId, skinId = 'default', team = 0, opts = {}) {
  const def = getTank(tankId);
  const R = 2 * def.body.size;
  const g = new THREE.Group();
  const rot = new THREE.Group(); // rotates with aim
  g.add(rot);

  const body = new THREE.Mesh(geo.dome, opts.bodyColor != null
    ? new THREE.MeshStandardMaterial({ color: opts.bodyColor, roughness: 0.4, emissive: opts.bodyColor, emissiveIntensity: 0.12 })
    : bodyMaterial(skinId));
  body.scale.set(R, R * 0.82, R);
  body.position.y = R * 0.12;
  body.castShadow = true;
  rot.add(body);

  const by = R * 0.42;
  for (const b of def.barrels) {
    const mat = b.kind === 'freeze' ? mats.freeze : b.kind === 'flame' ? mats.flame : b.kind === 'rail' ? mats.rail : teamBarrel[team] || mats.barrel;
    const len = b.len * def.body.size, w = b.w * def.body.size, ox = b.ox * def.body.size;
    const start = R * 0.2;
    const L = Math.max(0.5, len - start);
    const piv = new THREE.Group();
    piv.rotation.y = -b.a;
    let m;
    if (b.cone) {
      const cg = new THREE.CylinderGeometry((w / 2) * b.cone, w * 0.42, 1, 18, 1);
      cg.rotateZ(-Math.PI / 2);
      m = new THREE.Mesh(cg, mat);
    } else m = new THREE.Mesh(geo.barrel, mat);
    m.scale.set(L, w, w);
    m.position.set(start + L / 2, by, ox);
    m.castShadow = true;
    piv.add(m);
    const cap = new THREE.Mesh(geo.cap, b.kind === 'rail' ? mats.railCap : mats.cap);
    if (b.kind === 'rail') {
      // neon coil rings along the rail barrel
      for (const f of [0.35, 0.6, 0.85]) {
        const ring = new THREE.Mesh(geo.barrel, mats.railRing);
        ring.scale.set(L * 0.06, w * 1.12, w * 1.12);
        ring.position.set(start + L * f, by, ox);
        piv.add(ring);
      }
    }
    const cw = w * (b.cone || 1) * 0.82;
    cap.scale.set(cw, cw, cw);
    cap.position.set(start + L + 0.01, by, ox);
    piv.add(cap);
    rot.add(piv);
  }

  let spikes = null;
  if (def.body.spikes) {
    spikes = new THREE.Group();
    const n = def.body.spikes === 1 ? 8 : def.body.spikes === 2 ? 12 : 16;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = new THREE.Mesh(geo.spike, mats.spike);
      const L = R * (def.body.spikes === 3 ? 0.75 : 0.6);
      s.scale.set(L, R * 0.55, R * 0.55);
      s.position.set(Math.cos(a) * (R * 0.85 + L / 2), R * 0.3, -Math.sin(a) * (R * 0.85 + L / 2));
      s.rotation.y = a;
      s.castShadow = true;
      spikes.add(s);
    }
    g.add(spikes);
  }

  if (!opts.noShadow) {
    const shadow = new THREE.Mesh(geo.disc, mats.shadow);
    shadow.scale.setScalar(R * 1.05);
    shadow.position.y = 0.03;
    g.add(shadow);
  }

  let ring = null;
  if (team) {
    ring = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.75, depthWrite: false }));
    ring.scale.setScalar(R * 1.35);
    ring.position.y = 0.06;
    g.add(ring);
  }

  return { group: g, rot, body, spikes, R, def };
}

export function setTankOpacity(model, a) {
  model.group.traverse((o) => {
    if (o.isMesh) {
      if (!o.userData.cloned) { o.material = o.material.clone(); o.userData.cloned = true; }
      o.material.transparent = a < 1;
      o.material.opacity = a;
    }
  });
}

export function disposeTank(model) {
  model.group.traverse((o) => {
    if (o.isMesh && o.userData.cloned) o.material.dispose();
    if (o.isMesh && o.geometry !== geo.barrel && !Object.values(geo).includes(o.geometry)) o.geometry.dispose();
  });
}

// ------------------------------------------------------------------ shapes
// Prism with slightly rounded vertical corners and softly bevelled top/bottom edges.
function roundedPrism(n, R, h, round, bev) {
  const pts = [];
  const a0 = n === 4 ? Math.PI / 4 : Math.PI / 2;
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * Math.PI * 2; pts.push(new THREE.Vector2(Math.cos(a) * (R - bev), Math.sin(a) * (R - bev))); }
  const side = pts[0].distanceTo(pts[1]);
  const rc = side * round;
  const shape = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const v = pts[i], pv = pts[(i + n - 1) % n], nv = pts[(i + 1) % n];
    const p1 = v.clone().add(pv.clone().sub(v).setLength(rc));
    const p2 = v.clone().add(nv.clone().sub(v).setLength(rc));
    if (i === 0) shape.moveTo(p1.x, p1.y); else shape.lineTo(p1.x, p1.y);
    shape.quadraticCurveTo(v.x, v.y, p2.x, p2.y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 3 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bev, 0);
  return g;
}

export function shapeGeometry(type) {
  const s = SHAPES[type];
  const h = type === 'cube' ? s.h * 0.9 : s.h;
  const R = s.sides === 4 ? s.r * 1.004 : s.r;
  const g = roundedPrism(s.sides, R, h, 0.14, Math.min(h, R) * 0.09);
  g.translate(0, 0.05, 0);
  return g;
}

export function shapeMaterial(type) {
  const c = new THREE.Color(SHAPES[type].color);
  return new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(0.22), roughness: 0.38, metalness: 0.0, flatShading: true });
}

export const SHAPE_TYPES = SHAPE_LIST;

// ------------------------------------------------------------------ billboard health bar
// Layers: dark frame, dark track, pale "damage trail", coloured fill, glossy highlight.
// On damage the fill drops quickly and the trail drains down to it after a short pause.
export class Bar {
  constructor(w, h, color) {
    this.group = new THREE.Group();
    this.w = w;
    this.h = h;
    const mk = (c, o, order) => {
      const m = new THREE.Mesh(geo.plane, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, depthTest: false }));
      m.renderOrder = order;
      this.group.add(m);
      return m;
    };
    const pad = Math.min(0.22, h * 0.4);
    this.frame = mk(0x1b2333, 0.9, 10);
    this.frame.scale.set(w + pad * 2, h + pad * 2, 1);
    this.track = mk(0x4a5468, 0.95, 11);
    this.track.scale.set(w, h, 1);
    this.trail = mk(0xfff1c9, 1, 12);
    this.fill = mk(color, 1, 13);
    this.shine = mk(0xffffff, 0.28, 14);
    this.shine.position.y = h * 0.22;
    this.target = 1;
    this.shown = 1;
    this.trailV = 1;
    this.hold = 0;
    this.layout();
  }
  place(mesh, v, hScale = 1) {
    v = Math.max(0.0001, v);
    mesh.scale.set(this.w * v, this.h * hScale, 1);
    mesh.position.x = -(this.w * (1 - v)) / 2;
  }
  layout() {
    this.place(this.trail, this.trailV);
    this.place(this.fill, this.shown);
    this.place(this.shine, this.shown, 0.32);
  }
  set(v) {
    v = Math.max(0, Math.min(1, v));
    if (v < this.target - 0.0001) this.hold = 0.28; // pause before the trail drains
    this.target = v;
  }
  snap(v) { this.target = this.shown = this.trailV = Math.max(0, Math.min(1, v)); this.layout(); }
  update(dt) {
    // fill: fast drop, smooth refill
    const k = this.target < this.shown ? 22 : 6;
    this.shown += (this.target - this.shown) * Math.min(1, k * dt);
    if (this.trailV < this.shown) this.trailV = this.shown;
    if (this.hold > 0) this.hold -= dt;
    else if (this.trailV > this.shown) this.trailV = Math.max(this.shown, this.trailV - dt * 0.9);
    this.layout();
  }
  get value() { return this.target; }
  color(c) { this.fill.material.color.setHex(c); }
  dispose() { for (const m of [this.frame, this.track, this.trail, this.fill, this.shine]) m.material.dispose(); }
}
