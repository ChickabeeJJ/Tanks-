// Fast-paced store trailer cut from real gameplay (needs Playwright + Chromium + ffmpeg, and `npm start`).
//   node scripts/make-trailer.cjs landscape   -> store-assets/trailer-landscape.mp4 (1920x1080)
//   node scripts/make-trailer.cjs portrait    -> store-assets/trailer-portrait.mp4  (1080x1620)
// Options: --title "Tank Rumble"  --url http://localhost:3000/
// Structure: cold open -> title card -> 6 captioned feature clips (~2 s each) -> end card with PLAY NOW.
// Everything in the page (rendering, the in-browser server, timers, CSS animations) runs on a virtual
// clock that only moves 1/30 s per captured frame, so the result is a smooth 30 fps however slow the machine is.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PORTRAIT = process.argv[2] === 'portrait';
const URL0 = arg('--url', 'http://localhost:3000/');
const TITLE = arg('--title', 'Tank Rumble');
const OUT = path.join(__dirname, '..', 'store-assets');
const FPS = 30;
const W = PORTRAIT ? 720 : 1280, H = PORTRAIT ? 1080 : 720;

const SAVE = { level: 60, xp: 0, gems: 200000, tutorialDone: true, skin: 'default', owned: [], settings: { quality: 'high', names: true, sfx: 0 } };

// ------------------------------------------------------------------ virtual clock (injected before the game loads)
const VCLOCK = () => {
  const rSI = window.setInterval.bind(window), rCI = window.clearInterval.bind(window);
  const realNow = performance.now.bind(performance);
  const off = Date.now() - realNow();
  const c = { t: realNow(), cbs: [], timers: new Map(), id: 1 };
  window.__vc = c;
  performance.now = () => c.t;
  Date.now = () => Math.round(off + c.t);
  window.requestAnimationFrame = (cb) => { c.cbs.push(cb); return c.cbs.length; };
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (fn, ms = 0, ...a) => { const id = c.id++; c.timers.set(id, { at: c.t + Math.max(0, +ms || 0), fn, a, every: 0 }); return id; };
  window.setInterval = (fn, ms = 0, ...a) => { const id = c.id++; const every = Math.max(1, +ms || 1); c.timers.set(id, { at: c.t + every, fn, a, every }); return id; };
  window.clearTimeout = window.clearInterval = (id) => { c.timers.delete(id); };
  const anims = new WeakMap();
  window.__vstep = (ms, draw = true) => {
    const end = c.t + ms;
    for (let guard = 0; guard < 20000; guard++) {
      let nid = null, nt = Infinity;
      for (const [id, tm] of c.timers) if (tm.at < nt) { nt = tm.at; nid = id; }
      if (nid === null || nt > end) break;
      const tm = c.timers.get(nid);
      c.t = Math.max(c.t, nt);
      if (tm.every) tm.at += tm.every; else c.timers.delete(nid);
      try { if (typeof tm.fn === 'function') tm.fn(...tm.a); } catch (e) { console.error(e); }
    }
    c.t = end;
    // CSS / Web animations follow the virtual clock too
    for (const an of document.getAnimations()) {
      let st = anims.get(an);
      if (st === undefined) { st = c.t - (an.currentTime || 0); anims.set(an, st); try { an.pause(); } catch (e) { /* */ } }
      try { an.currentTime = c.t - st; } catch (e) { /* */ }
    }
    const G = window.__tanks;
    const realRender = G && G.render;
    if (!draw && G) G.render = () => {}; // advancing without capturing: skip the expensive draw
    const list = c.cbs; c.cbs = [];
    for (const f of list) { try { f(c.t); } catch (e) { console.error(e); } }
    if (!draw && G) G.render = realRender;
  };
  window.__vpump = rSI(() => window.__vstep(16), 16);
  window.__vstop = () => rCI(window.__vpump);
};

// ------------------------------------------------------------------ overlay (captions, title, end card)
const OVERLAY_CSS = (title) => `
  #tr { position: fixed; inset: 0; z-index: 999; pointer-events: none; font-family: Fredoka, 'Arial Rounded MT Bold', sans-serif; }
  #tr .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(8,16,40,.35), rgba(8,16,40,.78)); opacity: 0; }
  #tr .cap { position: absolute; left: 0; bottom: ${PORTRAIT ? '24%' : '17%'}; opacity: 0; }
  #tr .cap .b1 { display: inline-block; background: #ffd21f; color: #16233f; font-weight: 700; font-style: italic; text-transform: uppercase;
    font-size: ${PORTRAIT ? 44 : 40}px; letter-spacing: 1px; padding: 4px 26px 2px 34px; transform: skewX(-10deg); box-shadow: 0 5px 0 rgba(0,0,0,.25); }
  #tr .cap .b1 span { display: inline-block; transform: skewX(10deg); }
  #tr .cap .b2 { display: inline-block; margin: 8px 0 0 30px; background: #16233f; color: #fff; font-weight: 700; text-transform: uppercase;
    font-size: ${PORTRAIT ? 22 : 19}px; letter-spacing: 2px; padding: 5px 14px; transform: skewX(-10deg); }
  #tr .cap .b2 span { display: inline-block; transform: skewX(10deg); }
  #tr .ttl { position: absolute; left: 0; right: 0; top: ${PORTRAIT ? '34%' : '28%'}; display: flex; flex-direction: column; align-items: center; opacity: 0; }
  #tr .ttl .t1 { color: #fff; font-weight: 700; font-size: ${PORTRAIT ? 104 : 116}px; line-height: 1; letter-spacing: 3px; text-transform: uppercase;
    text-shadow: 0 6px 0 rgba(0,0,0,.35), 0 0 30px rgba(0,0,0,.25); }
  #tr .ttl .t2 { margin-top: 10px; background: #ffd21f; color: #16233f; font-weight: 700; font-style: italic; text-transform: uppercase;
    font-size: ${PORTRAIT ? 90 : 96}px; line-height: 1; padding: 6px 30px 4px; transform: skewX(-10deg); box-shadow: 0 7px 0 rgba(0,0,0,.3); }
  #tr .ttl .t2 span { display: inline-block; transform: skewX(10deg); }
  #tr .ttl .play { margin-top: 34px; color: #fff; font-weight: 700; font-size: ${PORTRAIT ? 34 : 32}px; letter-spacing: 4px; padding: 8px 26px;
    border: 4px solid #fff; border-radius: 6px; opacity: 0; background: rgba(22,35,63,.35); }
  #tr .flash { position: absolute; inset: 0; background: #fff; opacity: 0; }
  .tut, #toasts, #touch { display: none !important; }`;

function overlayHtml(title) {
  const words = title.split(' ');
  const a = words.length > 1 ? words.slice(0, -1).join(' ') : title;
  const b = words.length > 1 ? words[words.length - 1] : '';
  return `<div class="dim"></div>
    <div class="cap"><div class="b1"><span class="c1"></span></div><br><div class="b2"><span class="c2"></span></div></div>
    <div class="ttl"><div class="t1">${a}</div>${b ? `<div class="t2"><span>${b}</span></div>` : ''}<div class="play">PLAY NOW</div></div>
    <div class="flash"></div>`;
}

const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

// ------------------------------------------------------------------ in-page helpers
const PAGE_HELPERS = () => {
  const T = window.__trailer = {};
  const G = () => window.__tanks;
  T.world = () => G().arena.conn.world;
  T.me = () => T.world().tanks.get(G().arena.conn.me.id);
  T.setTank = (t, id) => { const w = T.world(); t.tankId = id; t.cd = []; w.recalc(t); t.infoVer++; };
  T.tough = (t) => { t.d.maxHp = 1e7; t.hp = 1e7; t.shieldUntil = 0; };
  T.levelFx = (t) => { const w = T.world(); w.fx.push({ tick: w.tick, d: [4, t.x, t.z, t.id] }); };
  T.center = { x: 0, z: -14 };
  // a lively fight around the player; bots keep fighting near the centre
  T.stage = (myTank, cast) => {
    const w = T.world(), me = T.me();
    T.setTank(me, myTank); T.tough(me);
    me.x = 0; me.z = 8; G().arena.pred.x = 0; G().arena.pred.z = 8;
    for (const s of w.shapes.values()) if ((s.type === 'hex' || s.type === 'alpha') && Math.hypot(s.x, s.z) < 160) { const a = Math.atan2(s.z, s.x); s.x = Math.cos(a) * 170; s.z = Math.abs(Math.sin(a)) * 170; }
    const bots = [...w.tanks.values()].filter((t) => t !== me && t.isBot);
    const skins = ['crimson', 'lime', 'grape', 'tiger', 'galaxy', 'gold', 'camo', 'polka'];
    bots.forEach((t, k) => {
      const a = (k / bots.length) * Math.PI * 2;
      t.x = T.center.x + Math.cos(a) * 12; t.z = T.center.z + Math.sin(a) * 10;
      if (!w.mode.teams) t.skin = skins[k % skins.length];
      t.level = 60 + k * 9;
      try { T.setTank(t, cast[k % cast.length]); } catch (e) { /* */ }
      T.tough(t);
    });
    let n = 0;
    for (const s of w.shapes.values()) {
      if (n >= 22 || (s.type !== 'cube' && s.type !== 'bcube' && s.type !== 'pent')) continue;
      const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 20;
      s.x = T.center.x + Math.cos(a) * r; s.z = T.center.z + Math.sin(a) * r; n++;
    }
    G().toggles.autoFire = true; G().toggles.autoSpin = false;
  };
  // per-frame: circle-strafe around the fight with the camera locked on it
  T.drive = (t, R = 22, zoom) => {
    const g = G(), I = window.__tanks_input, A = g.arena, c = T.center;
    const px = A.pred.x, pz = A.pred.z, dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz) || 1;
    const want = Math.atan2(-dx, -dz);
    const dy = ((want - g.camRig.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    g.camRig.yaw += dy * 0.15;
    if (zoom) g.camRig.zoom += (zoom - g.camRig.zoom) * 0.1;
    I.keys.add('KeyD');
    if (d > R + 2) { I.keys.add('KeyW'); I.keys.delete('KeyS'); } else if (d < R - 2) { I.keys.add('KeyS'); I.keys.delete('KeyW'); } else { I.keys.delete('KeyW'); I.keys.delete('KeyS'); }
    I.mouse.nx = Math.sin(t * 1.1) * 0.1; I.mouse.ny = 0.22;
    const w = T.world();
    for (const o of w.tanks.values()) {
      if (!o.isBot || !o.alive) continue;
      o.hp = Math.max(o.hp, o.d.maxHp * 0.5);
      const ox = c.x - o.x, oz = c.z - o.z, od = Math.hypot(ox, oz);
      if (od > 16) { o.x += (ox / od) * 0.4; o.z += (oz / od) * 0.4; }
    }
  };
  T.stopKeys = () => { const I = window.__tanks_input; ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => I.keys.delete(k)); };
};

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.route('**/sdk.crazygames.com/**', (r) => r.abort());
  await page.route(new URL('config.js', URL0).href, (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TANKS_CONFIG = { offline: true };' }));
  await page.addInitScript((s) => localStorage.setItem('tanks_save_v1', JSON.stringify(s)), SAVE);
  await page.addInitScript(VCLOCK);
  await page.goto(URL0);
  await page.waitForFunction(() => window.__tanks && window.__tanks.state === 'lobby');
  await page.evaluate(PAGE_HELPERS);
  await page.addStyleTag({ content: OVERLAY_CSS(TITLE) });
  await page.evaluate((html) => { const d = document.createElement('div'); d.id = 'tr'; d.innerHTML = html; document.body.appendChild(d); }, overlayHtml(TITLE));
  await page.evaluate(() => window.__vstop()); // from here on, time only moves when we say so

  const frames = path.join(OUT, PORTRAIT ? 'tr-frames-p' : 'tr-frames-l');
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  let F = 0;
  const step = (draw = true) => page.evaluate((d) => window.__vstep(1000 / 30, d), draw);
  const advance = async (sec) => { for (let i = 0; i < sec * FPS; i++) await step(false); }; // off-camera time
  const until = async (fn) => { for (let i = 0; i < 900; i++) { if (await page.evaluate(fn)) return; await step(false); } throw new Error('timeout: ' + fn); };
  const ui = (o) => page.evaluate((o) => {
    const r = document.getElementById('tr');
    const set = (sel, css) => Object.assign(r.querySelector(sel).style, css);
    set('.dim', { opacity: o.dim || 0 });
    set('.flash', { opacity: o.flash || 0 });
    set('.cap', { opacity: o.cap ? 1 : 0, transform: `translateX(${o.capX || 0}px)` });
    if (o.c1 != null) { r.querySelector('.c1').textContent = o.c1; r.querySelector('.c2').textContent = o.c2 || ''; r.querySelector('.b2').style.display = o.c2 ? 'inline-block' : 'none'; }
    set('.ttl', { opacity: o.ttl || 0, transform: `scale(${o.ttlS || 1})` });
    set('.play', { opacity: o.play || 0 });
  }, o);
  const shot = async () => { await page.screenshot({ path: path.join(frames, String(F++).padStart(4, '0') + '.png') }); if (F % 60 === 0) console.log('frame', F); };
  // one clip: n frames, per-frame page action + overlay state
  const clip = async (n, perFrame, overlay) => {
    for (let f = 0; f < n; f++) {
      if (perFrame) await page.evaluate(perFrame.fn, [f, f / FPS, ...(perFrame.args || [])]);
      await ui(overlay ? overlay(f, n) : {});
      await step(true);
      await shot();
    }
  };
  // caption that slides in from the left, with a quick white flash on the cut
  const caption = (c1, c2) => (f) => ({ cap: 1, capX: -500 * (1 - ease(f / 7)), c1, c2, flash: f < 2 ? 0.35 - f * 0.17 : 0 });

  // ---------------------------------------------------------------- battle (free for all)
  await page.evaluate(() => window.__tanks.play('ffa'));
  await until(() => !!(window.__tanks.arena && window.__tanks.arena.alive));
  await page.evaluate(() => { window.__trailer.stage('fiveway', ['hitman', 'double', 'grinder', 'spammer', 'flame', 'scout', 'side']); window.__tanks.camRig.zoom = 0.7; window.__tanks.camRig.pitch = 0.58; });
  await advance(1.2);
  const drive = (R, zoom) => ({ fn: ([f, t, R, zoom]) => window.__trailer.drive(t, R, zoom), args: [R, zoom] });
  // A: cold open
  await clip(54, drive(20, 0.7), (f) => ({ flash: f < 3 ? 0.6 - f * 0.2 : 0 }));
  // B: title card over the action
  await clip(36, drive(20, 0.75), (f) => ({ dim: 0.85 * ease(f / 6), ttl: ease(f / 6), ttlS: 1.25 - 0.25 * ease(f / 7) }));
  // C: evolution - the tank changes every few frames with the level-up burst
  const evo = ['triple', 'hitman', 'spammer', 'grinder', 'sixway', 'doubleflame', 'eightway'];
  await clip(66, { fn: ([f, t, list]) => { const T = window.__trailer; T.drive(t, 16, 0.55); if (f % 10 === 0) { const me = T.me(); T.setTank(me, list[(f / 10) % list.length]); T.tough(me); T.levelFx(me); } }, args: [evo] }, caption('50+ tanks', 'evolve your way'));
  // D: railgun, then flamethrower
  await clip(66, { fn: ([f, t]) => { const T = window.__trailer, me = T.me(); T.drive(t, 18, 0.7); if (f === 0) { T.setTank(me, 'railgun'); T.tough(me); } if (f === 36) { T.setTank(me, 'doubleflame'); T.tough(me); me.stats[1] = 8; T.world().recalc(me); T.tough(me); } if (f < 36 && f % 12 === 0) me.cd = []; } }, caption('Wild weapons', 'railguns · flamethrowers'));
  // F: smash shapes - a ring of shapes and an eight-barrel spin
  await page.evaluate(() => {
    const T = window.__trailer, w = T.world(), me = T.me();
    T.setTank(me, 'eightway'); T.tough(me);
    let n = 0;
    for (const s of w.shapes.values()) { if (n >= 34 || s.type === 'hex' || s.type === 'alpha') continue; const a = (n / 34) * Math.PI * 2, r = 10 + (n % 3) * 4; s.x = me.x + Math.cos(a) * r; s.z = me.z + Math.sin(a) * r; s.hp = Math.min(s.hp, 25); n++; }
    window.__tanks.toggles.autoSpin = true; T.stopKeys();
  });
  await clip(54, { fn: ([f]) => { const g = window.__tanks; g.camRig.yaw += 0.01; g.camRig.zoom += (0.62 - g.camRig.zoom) * 0.15; } }, caption('Smash shapes', 'level up fast'));
  await page.evaluate(() => { window.__tanks.toggles.autoSpin = false; });

  // ---------------------------------------------------------------- team battle
  await page.evaluate(() => window.__tanks.toLobby());
  await advance(0.5);
  await page.evaluate(() => window.__tanks.play('teams'));
  await until(() => !!(window.__tanks.arena && window.__tanks.arena.alive));
  await page.evaluate(() => { window.__trailer.stage('triple', ['double', 'hitman', 'spammer', 'side', 'triple', 'scout']); window.__tanks.camRig.zoom = 0.72; });
  await advance(1);
  await clip(60, drive(20, 0.72), caption('Team battles', 'red vs blue · 4 teams'));

  // ---------------------------------------------------------------- lobby: chests + hub
  await page.evaluate(() => window.__tanks.toLobby());
  await advance(1);
  await page.evaluate(() => { window.__trailer.stopKeys(); window.__tanks.menus.open('chests'); });
  await advance(0.3);
  await page.evaluate(() => { const b = document.querySelector('.chest-card [data-open]'); if (b) b.click(); });
  await clip(40, null, caption('Open chests', 'collect rare skins'));
  await advance(3.4);
  await clip(38, null, () => ({ cap: 1, c1: 'Open chests', c2: 'collect rare skins' }));
  await page.evaluate(() => window.__tanks.menus.close());
  await advance(0.3);
  // lobby drive-around with the other players
  await page.evaluate(() => { const L = window.__tanks.lobby; L.pos.x = 0; L.pos.z = 0; L.pos.vx = 0; L.pos.vz = 0; window.__tanks.camRig.yaw = Math.PI * 0.55; });
  // the camera sweeps round the hub while the player stays put (driving could enter a portal)
  await clip(54, { fn: ([f, t]) => { const g = window.__tanks; g.camRig.yaw += 0.02; g.camRig.zoom += (1.15 - g.camRig.zoom) * 0.05; } }, caption('Live lobby', 'quests · wheel · shops'));
  await page.evaluate(() => window.__trailer.stopKeys());
  // I: end card
  await clip(84, { fn: ([f]) => { window.__tanks.camRig.yaw += 0.006; } }, (f) => ({ dim: 0.85 * ease(f / 8), ttl: ease(f / 8), ttlS: 1.2 - 0.2 * ease(f / 9), play: f > 14 ? ease((f - 14) / 8) * (0.75 + 0.25 * Math.sin(f / 4)) : 0 }));

  const out = path.join(OUT, PORTRAIT ? 'trailer-portrait.mp4' : 'trailer-landscape.mp4');
  const size = PORTRAIT ? '1080:1620' : '1920:1080';
  execSync(`ffmpeg -loglevel error -y -framerate ${FPS} -i "${frames}/%04d.png" -vf "scale=${size}:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 19 -movflags +faststart -an "${out}"`);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('wrote', out, F, 'frames', (F / FPS).toFixed(1) + 's');
  await browser.close();
})();
