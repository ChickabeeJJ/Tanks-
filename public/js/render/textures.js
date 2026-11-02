// Procedural canvas textures: skins, floor grid, signs, tank icons.
import * as THREE from '../../vendor/three.module.min.js';
import { SKIN_MAP } from '../../shared/skins.js';
import { getTank } from '../../shared/tanks.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function shadeHex(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c * k)));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => f(c).toString(16).padStart(2, '0')).join('');
}

function seeded(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// ------------------------------------------------------------------ skins
function drawSkin(ctx, w, h, skin) {
  const rnd = seeded(skin.id.split('').reduce((a, c) => a + c.charCodeAt(0) * 31, 7));
  ctx.fillStyle = skin.base;
  ctx.fillRect(0, 0, w, h);
  switch (skin.pattern) {
    case 'zigzag': {
      ctx.strokeStyle = skin.alt;
      ctx.lineWidth = 7;
      for (let y = -10; y < h + 20; y += 22) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + ((x / 16) % 2 ? 8 : -8));
        ctx.stroke();
      }
      break;
    }
    case 'stripes': {
      ctx.fillStyle = skin.alt;
      for (let x = 0; x < w; x += 26) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + 18 * (rnd() - 0.5) * 2, h / 2, x + 6, h);
        ctx.lineTo(x + 16, h);
        ctx.quadraticCurveTo(x + 10 + 18 * (rnd() - 0.5), h / 2, x + 12, 0);
        ctx.fill();
      }
      break;
    }
    case 'blobs': {
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = rnd() < 0.5 ? skin.alt : skin.alt2;
        ctx.beginPath();
        ctx.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 18, 4 + rnd() * 10, rnd() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'dots': {
      ctx.fillStyle = skin.alt;
      for (let y = 8; y < h; y += 20) for (let x = (y / 20) % 2 ? 18 : 8; x < w; x += 22) {
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'checker': {
      ctx.fillStyle = skin.alt;
      const s = 16;
      for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) if (((x + y) / s) % 2 === 0) ctx.fillRect(x, y, s, s);
      break;
    }
    case 'tabby': {
      // grey tabby fur with dark stripes + a cute face on the front
      for (let i = 0; i < 4000; i++) {
        ctx.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '40,40,40'},0.08)`;
        ctx.fillRect(rnd() * w, rnd() * h, 2, 4);
      }
      ctx.strokeStyle = skin.alt;
      ctx.lineWidth = 5;
      for (let x = 0; x < w; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, h * 0.25, x - 8, h * 0.4, x + 4, h * 0.6); ctx.stroke();
      }
      const fx = w * 0.5, fy = h * 0.42; // u=0.5 faces local +x (forward)
      ctx.fillStyle = '#e8e4dc';
      ctx.beginPath(); ctx.ellipse(fx, fy + 10, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d1d1d';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(fx + s * 14, fy - 4, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = '#e88a9a';
      ctx.beginPath(); ctx.moveTo(fx - 4, fy + 4); ctx.lineTo(fx + 4, fy + 4); ctx.lineTo(fx, fy + 8); ctx.fill();
      ctx.strokeStyle = '#1d1d1d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(fx - 4, fy + 10, 4, 0, Math.PI); ctx.arc(fx + 4, fy + 10, 4, 0, Math.PI); ctx.stroke();
      break;
    }
    case 'cracks': {
      ctx.strokeStyle = skin.alt;
      ctx.lineWidth = 3;
      ctx.shadowColor = skin.alt;
      ctx.shadowBlur = 8;
      for (let i = 0; i < 26; i++) {
        let x = rnd() * w, y = rnd() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 30; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case 'stars': {
      const g = ctx.createLinearGradient(0, 0, w, h);
      const sb = skin.base || '#141040';
      g.addColorStop(0, shadeHex(sb, 1.6)); g.addColorStop(0.5, sb); g.addColorStop(1, skin.alt && skin.id !== 'galaxy' ? shadeHex(skin.alt, 0.45) : '#5a1a6e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 160; i++) {
        ctx.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`;
        const s = rnd() < 0.1 ? 3 : 1.5;
        ctx.fillRect(rnd() * w, rnd() * h, s, s);
      }
      break;
    }
    case 'rainbow': {
      for (let y = 0; y < h; y++) {
        ctx.fillStyle = `hsl(${(y / h) * 360},90%,58%)`;
        ctx.fillRect(0, y, w, 1);
      }
      break;
    }
    case 'shine': {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      const hi = skin.alt || '#fff3b0', mid = skin.base || '#ffcf3a';
      g.addColorStop(0, hi); g.addColorStop(0.35, mid); g.addColorStop(0.7, shadeHex(mid, 0.78)); g.addColorStop(1, mid);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 6; i++) { const x = (i / 6) * w + 10; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 14, 0); ctx.lineTo(x - 20, h); ctx.lineTo(x - 34, h); ctx.fill(); }
      break;
    }
    case 'aurora': {
      for (let i = 0; i < 5; i++) {
        const y0 = (h * (i + 0.5)) / 5;
        const g = ctx.createLinearGradient(0, y0 - 18, 0, y0 + 18);
        const c = i % 2 ? skin.alt2 || skin.alt : skin.alt;
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y0 - 16 + Math.sin(x / 22 + i) * 9);
        for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, y0 + 16 + Math.sin(x / 22 + i) * 9);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (let i = 0; i < 40; i++) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillRect(rnd() * w, rnd() * h, 1.5, 1.5); }
      break;
    }
    case 'snow': {
      ctx.fillStyle = skin.alt;
      for (let i = 0; i < 90; i++) {
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    default: {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.6, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }
}

export function skinTexture(skinId) {
  const key = 'skin:' + skinId;
  if (cache.has(key)) return cache.get(key);
  const skin = SKIN_MAP[skinId] || SKIN_MAP.default;
  const c = canvas(256, 128);
  drawSkin(c.getContext('2d'), 256, 128, skin);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

export function skinPreview(skinId, size = 96) {
  const key = 'skinprev:' + skinId + size;
  if (cache.has(key)) return cache.get(key);
  const skin = SKIN_MAP[skinId] || SKIN_MAP.default;
  const tmp = canvas(256, 128);
  drawSkin(tmp.getContext('2d'), 256, 128, skin);
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  ctx.save();
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(tmp, 128 - 64, 0, 128, 128, 0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.35, size * 0.3, 2, size / 2, size / 2, size * 0.45);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2); ctx.stroke();
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}

// ------------------------------------------------------------------ environment textures
export function gridTexture(base = '#f4f8fc', line = '#dfe8f2', cells = 4) {
  const key = `grid:${base}${line}${cells}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(256, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const s = 256 / cells;
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    if ((x + y) % 2) { ctx.fillStyle = 'rgba(200,215,232,0.18)'; ctx.fillRect(x * s, y * s, s, s); }
  }
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(256, i * s); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  cache.set(key, tex);
  return tex;
}

export function stripeTexture(a = '#bfe3ff', b = '#ffffff') {
  const key = 'stripe' + a + b;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = b; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = a;
  for (let i = -128; i < 256; i += 48) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 24, 0); ctx.lineTo(i + 24 + 128, 128); ctx.lineTo(i + 128, 128); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

export function skyTexture() {
  if (cache.has('sky')) return cache.get('sky');
  const c = canvas(4, 256);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2f9dff');
  g.addColorStop(0.35, '#7cc4ff');
  g.addColorStop(0.55, '#d4ecff');
  g.addColorStop(0.7, '#eef8ff');
  g.addColorStop(1, '#ffffff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('sky', tex);
  return tex;
}

// ------------------------------------------------------------------ text sprites
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function textCanvas(text, o = {}) {
  const size = o.size || 48;
  const font = `700 ${size}px Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", sans-serif`;
  const m = canvas(8, 8).getContext('2d');
  m.font = font;
  const tw = Math.ceil(m.measureText(text).width);
  const pad = o.bg ? size * 0.5 : size * 0.15;
  const c = canvas(tw + pad * 2, Math.ceil(size * (o.bg ? 1.6 : 1.35)));
  const ctx = c.getContext('2d');
  if (o.bg) {
    ctx.fillStyle = o.bg;
    roundRect(ctx, 2, 2, c.width - 4, c.height - 4, size * 0.35);
    ctx.fill();
  }
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (o.stroke !== false) {
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = o.strokeColor || 'rgba(20,30,50,0.85)';
    ctx.strokeText(text, c.width / 2, c.height / 2 + size * 0.04);
  }
  ctx.fillStyle = o.color || '#ffffff';
  ctx.fillText(text, c.width / 2, c.height / 2 + size * 0.04);
  return c;
}

export function textSprite(text, o = {}) {
  const c = textCanvas(text, o);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: o.depthTest !== false });
  const s = new THREE.Sprite(mat);
  const h = o.height || 2;
  s.scale.set((h * c.width) / c.height, h, 1);
  s.renderOrder = o.renderOrder || 5;
  return s;
}

// ------------------------------------------------------------------ tank icons (2D, like the original's cards)
export function tankIcon(tankId, size = 96, body = '#ee2b3b') {
  const key = `icon:${tankId}:${size}:${body}`;
  if (cache.has(key)) return cache.get(key);
  const def = getTank(tankId);
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const sc = (size / 2) / (Math.max(4.2, ...def.barrels.map((b) => b.len + 0.5)) * def.body.size);
  const R = 2 * def.body.size * sc;
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-Math.PI / 4);
  // spikes
  if (def.body.spikes) {
    const n = def.body.spikes === 1 ? 8 : def.body.spikes === 2 ? 12 : 16;
    ctx.fillStyle = '#4a4a55';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.2) * R * 0.9, Math.sin(a - 0.2) * R * 0.9);
      ctx.lineTo(Math.cos(a) * R * 1.45, Math.sin(a) * R * 1.45);
      ctx.lineTo(Math.cos(a + 0.2) * R * 0.9, Math.sin(a + 0.2) * R * 0.9);
      ctx.fill();
    }
  }
  for (const b of def.barrels) {
    ctx.save();
    ctx.rotate(b.a);
    const len = b.len * def.body.size * sc, w = b.w * def.body.size * sc, ox = b.ox * def.body.size * sc;
    ctx.fillStyle = b.kind === 'freeze' ? '#f2fbff' : b.kind === 'flame' ? '#7a7f8c' : b.kind === 'rail' ? '#2a2f3a' : '#8fd3f7';
    ctx.strokeStyle = '#2b5f86';
    ctx.lineWidth = Math.max(1.5, size / 48);
    ctx.beginPath();
    if (b.cone) {
      ctx.moveTo(0, ox - w * 0.4); ctx.lineTo(len, ox - w * 0.5 * b.cone); ctx.lineTo(len, ox + w * 0.5 * b.cone); ctx.lineTo(0, ox + w * 0.4);
    } else {
      ctx.rect(0, ox - w / 2, len, w);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
  g.addColorStop(0, '#ff6b78');
  g.addColorStop(1, body);
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(80,0,10,0.5)';
  ctx.lineWidth = Math.max(1.5, size / 48);
  ctx.beginPath();
  if (def.id === 'grinder') {
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
    ctx.closePath();
  } else ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const url = c.toDataURL();
  cache.set(key, url);
  return url;
}
