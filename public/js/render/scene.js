// Renderer, lights, follow camera and the two environments (arena + lobby).
import * as THREE from '../../vendor/three.module.min.js';
import { gridTexture, stripeTexture, skyTexture, textSprite, textCanvas } from './textures.js';
import { TEAM_COLORS } from '../../shared/config.js';
import { buildTank } from './models.js';
import { Post } from './post.js';
import { createSky } from './sky.js';

export function createRenderer(canvas, quality = 'high') {
  const high = quality === 'high';
  // MSAA happens in the post-processing buffer, so the canvas itself needs no antialias when post is on.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !high, powerPreference: 'high-performance' });
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? (touch ? 1.25 : 1.75) : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; // grading happens in post (keeps colours vivid)
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xc4e2ff, 240, 900); // long render distance

  // image-based lighting from the sky: soft reflections + natural fill
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.MeshBasicMaterial({ map: skyTexture(), color: 0x8a8a8a, side: THREE.BackSide })));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 32), new THREE.MeshBasicMaterial({ color: 0x80848a }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6;
  envScene.add(ground);
  const sunBlob = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 8), new THREE.MeshBasicMaterial({ color: 0xffe2b0 }));
  sunBlob.position.set(30, 26, 18);
  envScene.add(sunBlob);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;

  const hemi = new THREE.HemisphereLight(0xe3f1ff, 0xd9c7ae, 0.75); // cool sky, warm ground bounce
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(amb);
  const sun = new THREE.DirectionalLight(0xffe9cc, 2.35); // warm, lower "golden" sun for longer shadows
  sun.position.set(55, 48, 32);
  sun.castShadow = high;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  const sc = sun.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 0.45); // cool back light for silhouettes
  rim.position.set(-40, 30, -50);
  scene.add(rim);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.5, 2000);
  const ambience = createAmbience(scene);
  const post = high ? new Post(renderer, touch ? 0 : 4) : null;
  // cinematic skybox replaces the flat gradient background
  const sky = createSky(new THREE.Vector3(...SUN_OFFSET), !!post);
  scene.add(sky.mesh);
  scene.background = new THREE.Color(0xc4e2ff);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 60;
    camera.updateProjectionMatrix();
    if (post) post.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  function render(dt) {
    ambience.update(dt, camera);
    sky.update(dt, camera);
    if (post) post.render(scene, camera, dt);
    else renderer.render(scene, camera);
  }

  return { renderer, scene, camera, sun, hemi, resize, render };
}

export const SUN_OFFSET = [55, 48, 32];
export function placeSun(sun, x, z) {
  sun.position.set(x + SUN_OFFSET[0], SUN_OFFSET[1], z + SUN_OFFSET[2]);
  sun.target.position.set(x, 0, z);
}

// Ambience: drifting light motes around the camera (clouds live in the sky shader).
function softDot() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,248,230,.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function createAmbience(scene) {
  const N = 260, R = 45;
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * R;
    pos[i * 3 + 1] = 1 + Math.random() * 16;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * R;
    seed.push(Math.random() * 6.28);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(geo, new THREE.PointsMaterial({
    map: softDot(), size: 0.32, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff3d6, fog: true,
  }));
  motes.frustumCulled = false;
  scene.add(motes);
  let t = 0;
  const center = new THREE.Vector3();
  return {
    update(dt, camera) {
      t += dt;
      center.copy(camera.position);
      const p = geo.attributes.position.array;
      for (let i = 0; i < N; i++) {
        let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        y += dt * 0.35;
        x += Math.sin(t * 0.4 + seed[i]) * dt * 0.4;
        z += Math.cos(t * 0.3 + seed[i]) * dt * 0.4;
        if (y > 18) y = 3;
        // keep motes in a box around the camera (wrap)
        const dx = x - center.x, dz = z - center.z;
        if (dx > R) x -= 2 * R; else if (dx < -R) x += 2 * R;
        if (dz > R) z -= 2 * R; else if (dz < -R) z += 2 * R;
        p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
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
export function buildArena(half, mode, walls = []) {
  const root = new THREE.Group();
  const tex = gridTexture('#f6f9fd', '#e3ebf4', 4);
  const size = half * 2 + 16; // floor ends just past the outer walls (floating platform)
  const floorTex = tex.clone();
  floorTex.needsUpdate = true;
  floorTex.repeat.set(size / 16, size / 16);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(size, 8, size), new THREE.MeshStandardMaterial({ color: 0x9fb2c6, metalness: 0.55, roughness: 0.35 }));
  slab.position.y = -4.02;
  root.add(slab);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(size + 0.5, 0.6, size + 0.5), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }));
  rim.position.y = -1.4;
  root.add(rim);

  // cover walls inside the arena (same layout as the simulation)
  {
    const panelM = new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.6, emissive: 0xdfe9f4, emissiveIntensity: 0.25 });
    const baseM = new THREE.MeshStandardMaterial({ color: 0x8ea4bd, roughness: 0.35, metalness: 0.6 });
    const capM = new THREE.MeshStandardMaterial({ color: 0xb7c7d9, roughness: 0.3, metalness: 0.55 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0x8fe3ff });
    for (const [x0, z0, x1, z1] of walls) {
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const add = (geo, mat, y, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(cx, y, cz); m.castShadow = sh; m.receiveShadow = true; root.add(m); };
      add(new THREE.BoxGeometry(w + 0.6, 1.2, d + 0.6), baseM, 0.6);
      add(new THREE.BoxGeometry(w, 5.2, d), panelM, 3.2);
      add(new THREE.BoxGeometry(w + 0.8, 0.7, d + 0.8), capM, 6.1);
      add(new THREE.BoxGeometry(w + 0.85, 0.22, d + 0.85), glowM, 5.65, false);
    }
  }

  // pastel inner zone ring (center = richer shapes)
  const zone = new THREE.Mesh(new THREE.RingGeometry(half * 0.34, half * 0.36, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
  zone.rotation.x = -Math.PI / 2;
  zone.position.y = 0.02;
  root.add(zone);

  // walls with string lights
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xf9e9ef, roughness: 0.8 });
  const H = 6, T = 4;
  const outer = [
    [0, -half - T / 2, half * 2 + T * 2, T], [0, half + T / 2, half * 2 + T * 2, T],
    [-half - T / 2, 0, T, half * 2], [half + T / 2, 0, T, half * 2],
  ];
  for (const [x, z, w, d] of outer) {
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
  // wall decor: lamp posts with glowing heads, and drooping garlands of party bulbs between them
  {
    const SP = 26; // post spacing
    const postM = new THREE.MeshStandardMaterial({ color: 0x8ea4bd, metalness: 0.7, roughness: 0.3 });
    const capM = new THREE.MeshStandardMaterial({ color: 0x5f7590, metalness: 0.7, roughness: 0.35 });
    const lampM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.3, 1.6), toneMapped: false });
    const posts = [];
    for (let i = -half; i <= half + 0.1; i += SP) {
      posts.push([i, -half - T / 2], [i, half + T / 2]);
      if (Math.abs(i) < half - 1) posts.push([-half - T / 2, i], [half + T / 2, i]);
    }
    const n = posts.length;
    const postI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.32, 4.2, 8), postM, n);
    const headI = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.75, 0.45, 0.5, 6), capM, n);
    const lampI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 10, 8), lampM, n);
    const m4 = new THREE.Matrix4();
    posts.forEach(([x, z], k) => {
      m4.makeTranslation(x, H + 2.1, z); postI.setMatrixAt(k, m4);
      m4.makeTranslation(x, H + 4.5, z); headI.setMatrixAt(k, m4);
      m4.makeTranslation(x, H + 4.05, z); lampI.setMatrixAt(k, m4);
    });
    for (const m of [postI, headI, lampI]) { m.castShadow = m !== lampI; root.add(m); }
    // garlands: a sagging wire between neighbouring posts on each wall, bulbs hanging from it
    const wirePts = [];
    const bulbs = [];
    const sides = [
      (t) => [t, -half - T / 2], (t) => [t, half + T / 2], (t) => [-half - T / 2, t], (t) => [half + T / 2, t],
    ];
    for (const at of sides) {
      for (let i = -half; i < half - 0.1; i += SP) {
        const j = Math.min(half, i + SP);
        const segs = 12;
        for (let q = 0; q < segs; q++) {
          const t0 = q / segs, t1 = (q + 1) / segs;
          const y0 = H + 3.9 - Math.sin(t0 * Math.PI) * 1.6, y1 = H + 3.9 - Math.sin(t1 * Math.PI) * 1.6;
          const [x0, z0] = at(i + (j - i) * t0), [x1, z1] = at(i + (j - i) * t1);
          wirePts.push(x0, y0, z0, x1, y1, z1);
          if (q % 2 === 1) bulbs.push([x1, y1 - 0.35, z1]);
        }
      }
    }
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wirePts, 3));
    root.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x3a4658 })));
    const party = [new THREE.Color(3, 0.6, 1.0), new THREE.Color(2.8, 2.2, 0.4), new THREE.Color(0.4, 1.8, 3), new THREE.Color(0.6, 2.6, 0.9), new THREE.Color(2.0, 0.8, 3)];
    const bulbI = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), bulbs.length);
    bulbs.forEach(([x, y, z], k) => {
      m4.makeScale(1, 1.35, 1); m4.setPosition(x, y, z);
      bulbI.setMatrixAt(k, m4);
      bulbI.setColorAt(k, party[k % party.length]);
    });
    root.add(bulbI);
  }

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
    { id: 'skins', label: 'Skins Shop', x: -27, z: -12, color: 0x2ec8ff },
    { id: 'upgrades', label: 'Upgrades Shop', x: -27, z: 12, color: 0x2ec8ff },
    { id: 'chests', label: 'Chests', x: 0, z: -27, color: 0x6fe3ff, badge: 'New' },
    { id: 'tanks', label: 'Tanks Shop', x: 27, z: -12, color: 0x2ec8ff },
    { id: 'wheel', label: 'Wheel', x: 27, z: 12, color: 0xffd21f },
  ],
  portals: [
    { id: 'teams', label: 'Red VS Blue', sub: 'Teams', x: -23, z: 30, color: 0xff3048, color2: 0x2f9dff },
    { id: 'ffa', label: 'Battle', sub: 'Free for all', x: 0, z: 33, color: 0xff2d7a, color2: 0xff8fb8, big: true },
    { id: 'four', label: '4 Teams', sub: 'New!', x: 23, z: 30, color: 0xffcc1a, color2: 0x3ee06a },
  ],
};

function wheelTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const cols = ['#ffae00', '#00b4ff', '#22e05a', '#ff2d78', '#8f3cff', '#ff6a00', '#ff1f3d', '#00e0c0'];
  ctx.fillStyle = '#e09a00'; ctx.beginPath(); ctx.arc(128, 128, 128, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, 116, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); ctx.fill();
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
  const PLAT = (H + 4) * 2 + 10; // just past the walls
  tex.repeat.set(PLAT / 15, PLAT / 15);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(PLAT, PLAT), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  // the platform floats above the clouds: thick metal slab with a glowing rim
  const slab = new THREE.Mesh(new THREE.BoxGeometry(PLAT, 7, PLAT), new THREE.MeshStandardMaterial({ color: 0x9fb2c6, metalness: 0.55, roughness: 0.35 }));
  slab.position.y = -3.52;
  slab.receiveShadow = true;
  root.add(slab);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(PLAT * 0.42, PLAT * 0.12, 26, 6), new THREE.MeshStandardMaterial({ color: 0x8095ab, metalness: 0.5, roughness: 0.45 }));
  under.position.y = -20;
  root.add(under);
  const rimGlow = new THREE.Mesh(new THREE.BoxGeometry(PLAT + 0.4, 0.5, PLAT + 0.4), new THREE.MeshBasicMaterial({ color: 0x8fe3ff }));
  rimGlow.position.y = -1.2;
  root.add(rimGlow);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  // lobby walls: white panels on a metal base, metal pillars with glowing strips, capped top
  {
    const W = H + 4;
    const panelM = new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.6, metalness: 0.0, emissive: 0xdfe9f4, emissiveIntensity: 0.32 });
    const baseM = new THREE.MeshStandardMaterial({ color: 0x8ea4bd, roughness: 0.35, metalness: 0.6 });
    const capM = new THREE.MeshStandardMaterial({ color: 0xb7c7d9, roughness: 0.3, metalness: 0.55 });
    const pillarM = new THREE.MeshStandardMaterial({ color: 0xcfdae6, roughness: 0.28, metalness: 0.5 });
    const glowM = new THREE.MeshBasicMaterial({ color: 0x8fe3ff });
    const add = (geo, mat, x, y, z, ry = 0, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = shadow;
      m.receiveShadow = true;
      root.add(m);
      return m;
    };
    const L = W * 2;
    for (const [cx, cz, ry] of [[0, -W, 0], [0, W, Math.PI], [-W, 0, Math.PI / 2], [W, 0, -Math.PI / 2]]) {
      add(new THREE.BoxGeometry(L, 1.4, 3), baseM, cx, 0.7, cz, ry);
      add(new THREE.BoxGeometry(L, 8, 2), panelM, cx, 5, cz, ry);
      add(new THREE.BoxGeometry(L + 2, 0.9, 3.2), capM, cx, 9.4, cz, ry);
      // light line under the cap, facing inward
      const ln = add(new THREE.BoxGeometry(L, 0.25, 0.2), glowM, cx, 8.7, cz, ry, false);
      ln.translateZ(1.1);
      // pillars with vertical glow strips
      for (let k = -W + 8; k <= W - 8; k += 12) {
        const pl = add(new THREE.BoxGeometry(2.6, 10.6, 3.4), pillarM, cx, 5.3, cz, ry);
        pl.translateX(k);
        const gs = add(new THREE.BoxGeometry(0.45, 7.5, 0.2), glowM, cx, 5.4, cz, ry, false);
        gs.translateX(k);
        gs.translateZ(1.8);
      }
    }
    // corner towers
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      add(new THREE.BoxGeometry(5, 13, 5), capM, sx * W, 6.5, sz * W);
      add(new THREE.BoxGeometry(5.6, 0.8, 5.6), glowM, sx * W, 13.2, sz * W, 0, false);
    }
  }

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
      // angular chest: faceted body, prism lid, gold bands, glowing cut gem, crystal shards
      model = new THREE.Group();
      const iceM = new THREE.MeshStandardMaterial({ color: 0x8fd6ff, roughness: 0.25, metalness: 0.35, flatShading: true, emissive: 0x1f6fa8, emissiveIntensity: 0.25 });
      const iceD = new THREE.MeshStandardMaterial({ color: 0x4f9fd6, roughness: 0.3, metalness: 0.4, flatShading: true });
      const goldM = new THREE.MeshStandardMaterial({ color: 0xffc21a, roughness: 0.25, metalness: 0.75, flatShading: true, emissive: 0x6a3a00, emissiveIntensity: 0.25 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 2.0, 2.6), iceM);
      body.position.y = 1.15;
      const lower = new THREE.Mesh(new THREE.BoxGeometry(3.82, 0.7, 2.62), iceD);
      lower.position.y = 0.5;
      // prism lid: trapezoid cross-section extruded along x
      const prof = new THREE.Shape();
      prof.moveTo(-1.3, 0); prof.lineTo(1.3, 0); prof.lineTo(0.85, 0.95); prof.lineTo(-0.85, 0.95); prof.closePath();
      const lidGeo = new THREE.ExtrudeGeometry(prof, { depth: 3.8, bevelEnabled: false });
      lidGeo.rotateY(Math.PI / 2);
      lidGeo.translate(-1.9, 0, 0);
      const lid = new THREE.Mesh(lidGeo, iceM);
      lid.position.y = 2.15;
      model.add(body, lower, lid);
      const band = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), goldM); m.position.set(x, y, z); m.castShadow = true; model.add(m); };
      band(3.9, 0.22, 2.72, 0, 2.12, 0);      // lid seam
      band(3.9, 0.22, 2.72, 0, 0.18, 0);      // base trim
      band(0.5, 2.0, 2.72, 0, 1.15, 0);       // centre strap (body)
      for (const sx of [-1, 1]) band(0.22, 2.0, 2.72, sx * 1.86, 1.15, 0); // side straps
      const strapLid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 2.0), goldM);
      strapLid.position.set(0, 2.62, 0);
      model.add(strapLid);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) band(0.45, 0.45, 0.45, sx * 1.82, 2.0, sz * 1.24); // corner brackets
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 2.8), toneMapped: false }));
      gem.position.set(0, 1.55, 1.42);
      gem.scale.set(1, 1.3, 0.6);
      model.add(gem);
      const shardM = new THREE.MeshStandardMaterial({ color: 0xc8f2ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85, flatShading: true, emissive: 0x3fa8e0, emissiveIntensity: 0.4 });
      for (const [x, z, h, tilt] of [[-2.4, -0.6, 1.8, 0.3], [-2.2, 0.9, 1.1, -0.2], [2.4, -0.4, 2.1, -0.35], [2.3, 0.9, 1.2, 0.25], [-0.6, -1.6, 1.0, 0.4], [0.9, -1.6, 1.4, -0.3]]) {
        const sh = new THREE.Mesh(new THREE.ConeGeometry(0.32, h, 4), shardM);
        sh.position.set(x, h / 2, z);
        sh.rotation.z = tilt;
        sh.castShadow = true;
        model.add(sh);
      }
      model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      anim.push((t) => { model.position.y = 0.15 + Math.sin(t * 2) * 0.12; gem.rotation.y = t * 2; });
    } else if (p.id === 'wheel') {
      // vibrant, unlit wheel face + gold rim with chasing bulbs
      model = new THREE.Group();
      const face = new THREE.MeshBasicMaterial({ map: wheelTexture(), toneMapped: false });
      const rimM = new THREE.MeshStandardMaterial({ color: 0xffc21a, metalness: 0.7, roughness: 0.25, emissive: 0x8a5200, emissiveIntensity: 0.35 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.35, 48), [rimM, face, face]);
      disc.rotation.x = Math.PI / 2;
      disc.position.y = 3.9;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.22, 10, 48), rimM);
      rim.position.y = 3.9;
      const bulbs = [];
      for (let k = 0; k < 16; k++) {
        const bm = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
        const a = (k / 16) * Math.PI * 2;
        bm.position.set(Math.cos(a) * 2.9, 3.9 + Math.sin(a) * 2.9, 0.2);
        bulbs.push(bm);
        model.add(bm);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 16), rimM);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(0, 3.9, 0);
      const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.3, 0.4), toneMapped: false }));
      pointer.rotation.z = Math.PI;
      pointer.position.set(0, 7.0, 0.25);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.7, 3.2, 10), rimM);
      stand.position.y = 1.6;
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.35, 16), rimM);
      foot.position.y = 0.18;
      model.add(disc, rim, hub, pointer, stand, foot);
      const hot = new THREE.Color(3, 2.4, 0.8), cold = new THREE.Color(1.6, 0.4, 1.4);
      anim.push((t) => {
        disc.rotation.y = t * 1.5;
        const k0 = Math.floor(t * 8);
        bulbs.forEach((bm, k) => bm.material.color.copy((k + k0) % 2 ? hot : cold));
      });
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
      anim.push((t) => { model.rotation.y = Math.atan2(-p.x, -p.z) + Math.sin(t) * 0.3; });
    } else if (p.id === 'tanks') {
      const tk = buildTank('fourdouble', 'default');
      model = tk.group;
      anim.push((t) => { tk.rot.rotation.y = -t * 0.6; });
    }
    if (model) {
      model.scale.multiplyScalar(1.45);
      model.rotation.y = Math.atan2(-p.x, -p.z); // face the lobby centre
      g.add(model);
    }
    const label = textSprite(p.label, { size: 56, bg: 'rgba(110,122,140,0.85)', height: 2.8 });
    label.position.set(0, p.id === 'wheel' ? 12.6 : 9.5, 0); // wheel is tall: keep its label clear
    g.add(label);
    root.add(g);
  }

  // portals
  for (const p of LOBBY.portals) {
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.lookAt(0, 0, 0);
    const s = (p.big ? 1.35 : 1) * 1.5; // bigger portals
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
    const sub = textSprite(p.sub, { size: 40, height: 1.4 * 1.4, color: '#fff7a8' });
    sub.position.set(0, 5.6 * s + 0.3, 0);
    g.add(label, sub);
    anim.push((t) => { fill.material.opacity = 0.35 + Math.sin(t * 3 + p.x) * 0.12; });
    root.add(g);
  }

  return { root, anim, boards: {} };
}
