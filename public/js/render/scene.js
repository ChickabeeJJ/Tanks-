// Renderer, lights, follow camera and the two environments (arena + lobby).
import * as THREE from '../../vendor/three.module.min.js';
import { gridTexture, stripeTexture, skyTexture, textSprite, textCanvas } from './textures.js';
import { TEAM_COLORS } from '../../shared/config.js';
import { buildTank } from './models.js';

export function createRenderer(canvas, quality = 'high') {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Roblox-style look: no filmic tone mapping (it washes out colour), bright sun + sky fill.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = quality === 'high';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xe4f3ff, 150, 380);

  const hemi = new THREE.HemisphereLight(0xffffff, 0xbfd4ee, 1.05);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.75);
  sun.position.set(30, 70, 25);
  sun.castShadow = quality === 'high';
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  const sc = sun.shadow.camera;
  sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 220;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 600);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep horizontal view reasonable on portrait phones
    camera.fov = w < h ? 75 : 60;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  return { renderer, scene, camera, sun, hemi, resize };
}

// Third-person orbit camera (Roblox style). yaw 0 = looking toward -z.
export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0;
    this.pitch = 0.6;
    this.dist = 30;
    this.zoom = 1;
    this.target = new THREE.Vector3();
    this.cur = new THREE.Vector3();
    this.flipT = 0;
  }
  forward() { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  right() { return { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) }; }
  snap(x, z) { this.target.set(x, 0, z); this.cur.copy(this.target); }
  update(dt, x, z, fov = 1) {
    this.target.set(x, 0, z);
    this.cur.lerp(this.target, 1 - Math.exp(-dt * 14));
    const d = this.dist * this.zoom * (0.85 + 0.15 * fov) * fov;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.camera.position.set(this.cur.x + Math.sin(this.yaw) * cp * d, sp * d + 1, this.cur.z + Math.cos(this.yaw) * cp * d);
    this.camera.lookAt(this.cur.x, 2.5, this.cur.z);
  }
}

// ------------------------------------------------------------------ arena
export function buildArena(half, mode) {
  const root = new THREE.Group();
  const tex = gridTexture('#f6f9fd', '#e3ebf4', 4);
  const size = half * 2 + 500;
  const floorTex = tex.clone();
  floorTex.needsUpdate = true;
  floorTex.repeat.set(size / 16, size / 16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // pastel inner zone ring (center = richer shapes)
  const zone = new THREE.Mesh(new THREE.RingGeometry(half * 0.34, half * 0.36, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.02;
  root.add(zone);

  // walls with string lights
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf9e9ef, roughness: 0.8 });
  const H = 6, T = 4;
  const walls = [
    [0, -half - T / 2, half * 2 + T * 2, T], [0, half + T / 2, half * 2 + T * 2, T],
    [-half - T / 2, 0, T, half * 2], [half + T / 2, 0, T, half * 2],
  ];
  for (const [x, z, w, d] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    m.position.set(x, H / 2, z);
    m.receiveShadow = true;
    m.castShadow = true;
    root.add(m);
  }
  // corner towers
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xfbf1f4, roughness: 0.85 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 14), towerMat);
    t.position.set(sx * (half + 6), 11, sz * (half + 6));
    t.castShadow = true;
    root.add(t);
  }
  // fairy lights on top of the walls (instanced)
  const bulbs = [];
  const colors = [0xff5c7a, 0xffd23f, 0x3fb2f5, 0x5be37a, 0xb76bf0];
  for (let i = -half; i <= half; i += 6) {
    bulbs.push([i, -half - T / 2], [i, half + T / 2], [-half - T / 2, i], [half + T / 2, i]);
  }
  const bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial(), bulbs.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  bulbs.forEach(([x, z], i) => {
    m4.makeTranslation(x, H + 0.6 + Math.sin(i) * 0.15, z);
    bulb.setMatrixAt(i, m4);
    bulb.setColorAt(i, col.setHex(colors[i % colors.length]));
  });
  root.add(bulb);

  // team bases
  if (mode.teams) {
    const rects = mode.teams === 2
      ? [[1, -half, -half, -half + 30, half], [2, half - 30, -half, half, half]]
      : [[1, -half, -half, -half + 40, -half + 40], [2, half - 40, half - 40, half, half], [3, -half, half - 40, -half + 40, half], [4, half - 40, -half, half, -half + 40]];
    for (const [team, x0, z0, x1, z1] of rects) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ color: TEAM_COLORS[team], transparent: true, opacity: 0.2, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set((x0 + x1) / 2, 0.04, (z0 + z1) / 2);
      root.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(x1 - x0, 0.1, z1 - z0)), new THREE.LineBasicMaterial({ color: TEAM_COLORS[team] }));
      edge.position.set((x0 + x1) / 2, 0.1, (z0 + z1) / 2);
      root.add(edge);
    }
  }
  return root;
}

// ------------------------------------------------------------------ lobby
export const LOBBY = {
  half: 40,
  padR: 6.4,
  pads: [
    { id: 'chests', label: 'Chests', x: -11, z: -24, color: 0x6fe3ff, badge: 'New' },
    { id: 'wheel', label: 'Wheel', x: 11, z: -24, color: 0xffd21f },
    { id: 'skins', label: 'Skins Shop', x: -26, z: -9, color: 0x2ec8ff },
    { id: 'upgrades', label: 'Upgrades Shop', x: -26, z: 7, color: 0x2ec8ff },
    { id: 'tanks', label: 'Tanks Shop', x: -26, z: 23, color: 0x2ec8ff },
  ],
  portals: [
    { id: 'teams', label: 'Red VS Blue', sub: 'Teams', x: -15, z: 30, color: 0xff3048, color2: 0x2f9dff },
    { id: 'ffa', label: 'Spawn', sub: 'Free for all', x: 0, z: 33, color: 0xff2d7a, color2: 0xff8fb8, big: true },
    { id: 'four', label: '4 Teams', sub: 'New!', x: 15, z: 30, color: 0xffcc1a, color2: 0x3ee06a },
  ],
  boards: [
    { id: 'kills', label: 'Kills', x: 35, z: -18, ry: -Math.PI / 2 },
    { id: 'rank', label: 'Rank', x: 35, z: 0, ry: -Math.PI / 2 },
    { id: 'level', label: 'Level', x: 35, z: 18, ry: -Math.PI / 2 },
  ],
};

function wheelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const cols = ['#ff9f1c', '#2ec4f1', '#3bd16f', '#ff3d6e', '#b14cf0', '#ffd23f'];
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 126, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(128, 128, 30, 0, Math.PI * 2); ctx.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function boardCanvas(title, rows, accent = '#2fb3ff') {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 640;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = accent; ctx.fillRect(0, 0, 512, 110);
  const tc = textCanvas(title, { size: 64 });
  ctx.drawImage(tc, 256 - tc.width / 2, 55 - tc.height / 2);
  ctx.font = '700 30px Fredoka, "Trebuchet MS", sans-serif';
  rows.slice(0, 10).forEach((r, i) => {
    const y = 150 + i * 50;
    ctx.fillStyle = i % 2 ? '#eef6ff' : '#ffffff';
    ctx.fillRect(10, y - 30, 492, 46);
    ctx.fillStyle = i === 0 ? '#e0a200' : i === 1 ? '#8c9aab' : i === 2 ? '#c46a2b' : '#4a5a70';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}. ${String(r[0]).slice(0, 16)}`, 24, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#2a7fd0';
    ctx.fillText(String(r[1]), 490, y);
  });
  return c;
}

export function buildLobby(skinId) {
  const root = new THREE.Group();
  const H = LOBBY.half;
  const tex = gridTexture('#f7fafd', '#edf2f8', 2).clone();
  tex.needsUpdate = true;
  tex.repeat.set(40, 40);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // striped back walls
  const st = stripeTexture('#8fd0ff', '#ffffff').clone();
  st.needsUpdate = true;
  st.repeat.set(10, 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: st, roughness: 0.9 });
  for (const [x, z, ry] of [[0, -H - 6, 0], [0, H + 14, Math.PI], [-H - 6, 0, Math.PI / 2], [H + 6, 0, -Math.PI / 2]]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(H * 2 + 40, 26), wallMat);
    w.position.set(x, 13, z);
    w.rotation.y = ry;
    root.add(w);
  }

  // confetti on the floor
  const N = 240;
  const conf = new THREE.InstancedMesh(new THREE.CircleGeometry(0.45, 5), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
  const pal = [0xff6fa0, 0x5cc4ff, 0xb37bff, 0xff9fc4, 0x7fdcff];
  for (let i = 0; i < N; i++) {
    e.set(-Math.PI / 2, 0, Math.random() * 6);
    q.setFromEuler(e);
    m4.compose(new THREE.Vector3((Math.random() * 2 - 1) * H, 0.03, (Math.random() * 2 - 1) * H), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.6 + Math.random() * 0.8));
    conf.setMatrixAt(i, m4);
    conf.setColorAt(i, col.setHex(pal[i % pal.length]));
  }
  root.add(conf);

  const anim = [];
  const PR = LOBBY.padR;
  const ringGeo = new THREE.TorusGeometry(PR, 0.5, 12, 64);
  ringGeo.rotateX(Math.PI / 2);

  for (const p of LOBBY.pads) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: p.color }));
    ring.position.y = 0.2;
    g.add(ring);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(PR, 48), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.18, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.05;
    g.add(glow);
    let model;
    if (p.id === 'chests') {
      model = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2, 2.6), new THREE.MeshStandardMaterial({ color: 0xbfeeff, roughness: 0.3 }));
      base.position.y = 1.2;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 3.6, 16, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe6f9ff, roughness: 0.3 }));
      lid.rotation.z = Math.PI / 2;
      lid.position.y = 2.2;
      const lock = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.2), new THREE.MeshStandardMaterial({ color: 0x8fb8d0 }));
      lock.position.set(0, 2.1, 1.35);
      model.add(base, lid, lock);
      anim.push((t) => { model.position.y = Math.sin(t * 2) * 0.25; });
    } else if (p.id === 'wheel') {
      model = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.4, 36), [new THREE.MeshStandardMaterial({ color: 0xffffff }), new THREE.MeshStandardMaterial({ map: wheelTexture() }), new THREE.MeshStandardMaterial({ map: wheelTexture() })]);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 3.6;
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, 3, 10), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      stand.position.y = 1.5;
      model.add(disc, stand);
      anim.push((t) => { disc.rotation.y = t * 1.5; });
    } else if (p.id === 'skins') {
      const tk = buildTank('scout', 'tiger');
      model = tk.group;
      model.scale.setScalar(1.2);
      anim.push((t) => { tk.rot.rotation.y = t * 0.6; });
    } else if (p.id === 'upgrades') {
      model = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.8), new THREE.MeshStandardMaterial({ color: i < 3 ? 0x8fe6ff : 0xeaf6ff }));
        seg.position.set(-2.6 + i * 1.3, 2.2, 0);
        model.add(seg);
      }
      anim.push((t) => { model.rotation.y = Math.sin(t) * 0.3; });
    } else if (p.id === 'tanks') {
      const tk = buildTank('fourdouble', 'default');
      model = tk.group;
      anim.push((t) => { tk.rot.rotation.y = -t * 0.6; });
    }
    if (model) { model.scale.multiplyScalar(1.45); g.add(model); }
    const label = textSprite(p.label, { size: 56, bg: 'rgba(110,122,140,0.85)', height: 2.8 });
    label.position.set(0, 9.5, 0);
    g.add(label);
    root.add(g);
  }

  // portals
  for (const p of LOBBY.portals) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.lookAt(0, 0, 0);
    const s = p.big ? 1.35 : 1;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(4.6 * s, 0.9 * s, 12, 32, Math.PI), new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.4 }));
    arch.castShadow = true;
    const arch2 = new THREE.Mesh(new THREE.TorusGeometry(3.7 * s, 0.35 * s, 8, 32, Math.PI), new THREE.MeshStandardMaterial({ color: p.color2, roughness: 0.4 }));
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.8 * s, 1, 1.8 * s), new THREE.MeshStandardMaterial({ color: p.color }));
      leg.position.set(side * 4.6 * s, 0.5, 0);
      g.add(leg);
    }
    const fill = new THREE.Mesh(new THREE.CircleGeometry(3.7 * s, 32, 0, Math.PI), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
    g.add(arch, arch2, fill);
    const label = textSprite(p.label, { size: 56, height: 2.2 * s });
    label.position.set(0, 7.2 * s, 0);
    const sub = textSprite(p.sub, { size: 40, height: 1.4, color: '#fff7a8' });
    sub.position.set(0, 5.6 * s + 0.3, 0);
    g.add(label, sub);
    anim.push((t) => { fill.material.opacity = 0.35 + Math.sin(t * 3 + p.x) * 0.12; });
    root.add(g);
  }

  // leaderboards
  const boards = {};
  for (const b of LOBBY.boards) {
    const c = boardCanvas(b.label, []);
    const tx = new THREE.CanvasTexture(c);
    tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.BoxGeometry(12, 15, 0.8), [
      new THREE.MeshStandardMaterial({ color: 0xd9e4ef }), new THREE.MeshStandardMaterial({ color: 0xd9e4ef }),
      new THREE.MeshStandardMaterial({ color: 0xd9e4ef }), new THREE.MeshStandardMaterial({ color: 0xd9e4ef }),
      new THREE.MeshStandardMaterial({ map: tx }), new THREE.MeshStandardMaterial({ color: 0xd9e4ef }),
    ]);
    m.position.set(b.x, 9, b.z);
    m.rotation.y = b.ry;
    m.castShadow = true;
    const post = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 1.5), new THREE.MeshStandardMaterial({ color: 0x3fb2f5 }));
    post.position.set(b.x, 1, b.z);
    post.rotation.y = b.ry;
    root.add(m, post);
    boards[b.id] = { tex: tx, canvas: c, label: b.label };
  }

  // the "4 Teams" update board (like the in-game event card)
  const upd = textSprite('4 Teams mode is here!', { size: 44, bg: 'rgba(40,46,60,0.88)', height: 2 });
  upd.position.set(24, 6, -28);
  root.add(upd);

  return { root, anim, boards };
}
