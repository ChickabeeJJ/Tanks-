// Renders the CrazyGames store assets from real gameplay (needs Playwright + Chromium, and ffmpeg for videos).
//   node scripts/make-assets.cjs covers            -> store-assets/cover-landscape.png (1920x1080), cover-portrait.png (800x1200), cover-square.png (800x800)
//   node scripts/make-assets.cjs video-landscape   -> store-assets/preview-landscape.mp4 (1920x1080, 18s)
//   node scripts/make-assets.cjs video-portrait    -> store-assets/preview-portrait.mp4 (1080x1620, 18s)
// Options: --url http://localhost:3000/  --title "Tank Rumble"
// The game server (npm start) must be running. Time is virtualised (page.clock), so the videos are
// smooth 30 fps no matter how slow the machine renders.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MODE = process.argv[2] || 'covers';
const URL0 = arg('--url', 'http://localhost:3000/');
const TITLE = arg('--title', 'Tank Rumble');
const OUT = path.join(__dirname, '..', 'store-assets');
fs.mkdirSync(OUT, { recursive: true });

const SAVE = { level: 120, xp: 0, gems: 50000, tutorialDone: true, skin: 'default', owned: [], settings: { quality: 'high', names: true, sfx: 0 } };

async function open(browser, w, h, dsf) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  await page.route('**/sdk.crazygames.com/**', (r) => r.abort());
  // stage the scene on a local (in-browser) server so the script can arrange tanks and shapes
  await page.route(new URL('config.js', URL0).href, (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.TANKS_CONFIG = { offline: true };' }));
  await page.addInitScript((s) => localStorage.setItem('tanks_save_v1', JSON.stringify(s)), SAVE);
  return page;
}

// Puts the player in a lively spot. With o.pose the bots are frozen into a composed battle
// (fixed positions and aim, all firing); otherwise their AI keeps playing (videos).
async function stage(page, opts = {}) {
  await page.evaluate((o) => {
    const G = window.__tanks;
    const w = G.arena.conn.world;
    const me = w.tanks.get(G.arena.conn.me.id);
    const setTank = (t, id) => { t.tankId = id; w.recalc(t); t.infoVer++; };
    const tough = (t) => { t.d.maxHp = 1e7; t.hp = 1e7; t.shieldUntil = 0; };
    setTank(me, o.myTank || 'triway');
    tough(me);
    me.x = 0; me.z = 0;
    // big shapes out of the way
    for (const s of w.shapes.values()) if ((s.type === 'hex' || s.type === 'alpha') && Math.hypot(s.x, s.z) < 80) { s.x += Math.sign(s.x || 1) * 90; s.z += Math.sign(s.z || 1) * 90; }
    const bots = [...w.tanks.values()].filter((t) => t !== me && t.isBot);
    // [x, z, tank, skin, aim target x, z]
    const P = o.pose || [
      [-12, -13, 'hitman', 'crimson', 12, -12], [12, -12, 'spammer', 'tiger', -12, -13],
      [-20, -2, 'double', 'lime', -24, -22], [20, -1, 'side', 'grape', 26, -18],
      [1, -27, 'sixway', 'galaxy', 1, -8], [-28, -20, 'scout', 'gold', -10, -30],
    ];
    bots.forEach((t, k) => {
      const p = P[k % P.length];
      t.x = p[0]; t.z = p[1]; t.skin = p[3]; t.level = 50 + k * 11;
      try { setTank(t, p[2]); } catch (e) { /* keep */ }
      tough(t);
      const aim = Math.atan2(p[5] - p[1], p[4] - p[0]);
      t.aim = aim;
      if (o.freeze) t.bot = { next: 1e12, mx: 0, mz: 0, aimT: aim, fire: true, strafe: 1, strafeT: 1e12, wx: 0, wz: 0, build: [0, 1, 2, 3], skill: 1, upT: 1e12, chkT: 1e12, lx: t.x, lz: t.z, unstuck: 0 };
    });
    // nothing big right in front of the camera (it sits behind the player, +z)
    for (const s of w.shapes.values()) if (s.z > -6 && s.z < 40 && Math.abs(s.x) < 45) { s.z -= 60; }
    window.__tanks_input.mouse.nx = 0; window.__tanks_input.mouse.ny = 0.3; // aim straight ahead
    // a field of shapes in front of the player
    let n = 0;
    for (const s of w.shapes.values()) {
      if (n >= 18 || (s.type !== 'cube' && s.type !== 'bcube' && s.type !== 'pent')) continue;
      const col = n % 6, row = Math.floor(n / 6);
      s.x = -16 + col * 6.5 + (row % 2) * 3; s.z = -16 - row * 7 - (col % 2) * 2;
      n++;
    }
    G.toggles.autoFire = true;
    G.camRig.pitch = o.pitch ?? 0.62;
    G.camRig.zoom = o.zoom ?? 0.8;
    if (o.yaw != null) G.camRig.yaw = o.yaw;
  }, opts);
}

const hideUi = (page) => page.addStyleTag({ content: '#ui, .tut, #touch { display: none !important; }' });

function logoCss(size) {
  const o = Math.max(3, Math.round(size * 0.055));
  const ring = [];
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push(`${(Math.cos(a) * o).toFixed(1)}px ${(Math.sin(a) * o).toFixed(1)}px 0 #0f2a4d`); }
  return `
  .cg-logo { position: fixed; left: 0; right: 0; z-index: 99; display: flex; flex-direction: column; align-items: center; pointer-events: none; font-family: Fredoka, 'Arial Rounded MT Bold', sans-serif; }
  .cg-logo .t { font-weight: 700; font-size: ${size}px; line-height: 1.05; letter-spacing: 1px; color: #ffe04a; transform: rotate(-3deg);
    text-shadow: ${ring.join(', ')}, 0 ${o * 2}px 0 #0f2a4d, 0 ${o * 3}px ${o * 3}px rgba(0,0,0,.35); }
  .cg-logo .t2 { color: #5fd8ff; }`;
}

async function addLogo(page, size, top, stacked) {
  const words = TITLE.split(' ');
  const a = words.slice(0, Math.ceil(words.length / 2)).join(' '), b = words.slice(Math.ceil(words.length / 2)).join(' ');
  await page.addStyleTag({ content: logoCss(size) });
  await page.evaluate(([a, b, top, stacked]) => {
    const d = document.createElement('div');
    d.className = 'cg-logo';
    d.style.top = top;
    d.innerHTML = stacked ? `<div class="t">${a}</div><div class="t t2">${b}</div>` : `<div class="t">${a} <span class="t2">${b}</span></div>`;
    document.body.appendChild(d);
  }, [a, b, top, stacked]);
}

async function bootArena(page, mode = 'ffa') {
  await page.goto(URL0);
  await page.waitForFunction(() => window.__tanks && window.__tanks.state === 'lobby', null, { timeout: 120000 });
  await page.evaluate((m) => window.__tanks.play(m), mode);
  await page.waitForFunction(() => window.__tanks.arena && window.__tanks.arena.me && window.__tanks.arena.alive, null, { timeout: 120000 });
}

async function covers(browser) {
  const specs = [
    { name: 'cover-landscape.png', w: 1280, h: 720, dsf: 1.5, logo: 104, top: '5%', stacked: false, zoom: 0.6, pitch: 0.55 },
    { name: 'cover-portrait.png', w: 600, h: 900, dsf: 4 / 3, logo: 92, top: '4%', stacked: true, zoom: 0.7, pitch: 0.7 },
    { name: 'cover-square.png', w: 600, h: 600, dsf: 4 / 3, logo: 70, top: '4%', stacked: false, zoom: 0.65, pitch: 0.62 },
  ];
  for (const s of specs) {
    const page = await open(browser, s.w, s.h, s.dsf);
    await bootArena(page);
    await stage(page, { zoom: s.zoom, pitch: s.pitch, yaw: 0, freeze: true });
    await hideUi(page);
    await page.waitForTimeout(900); // bullets in the air
    await addLogo(page, s.logo, s.top, s.stacked);
    await page.screenshot({ path: path.join(OUT, s.name) });
    console.log('wrote', s.name);
    await page.close();
  }
}

async function video(browser, portrait) {
  const W = portrait ? 720 : 1280, H = portrait ? 1080 : 720, DSF = 1.5;
  const page = await open(browser, W, H, DSF);
  await page.clock.install();
  // boot with virtual time: advance the fake clock until each step is ready
  const until = async (fn) => {
    for (let i = 0; i < 600; i++) { if (await page.evaluate(fn)) return; await page.clock.runFor(100); }
    throw new Error('timed out waiting for ' + fn);
  };
  await page.goto(URL0, { waitUntil: 'domcontentloaded' });
  await until(() => !!(window.__tanks && window.__tanks.state === 'lobby'));
  await page.evaluate(() => window.__tanks.play('ffa'));
  await until(() => !!(window.__tanks.arena && window.__tanks.arena.alive));
  await stage(page, { zoom: portrait ? 0.95 : 0.8, pitch: 0.62, yaw: 0.3 });
  await page.addStyleTag({ content: '.tut, #touch, #toasts { display: none !important; }' });
  await page.clock.runFor(1500);
  const frames = path.join(OUT, portrait ? 'frames-p' : 'frames-l');
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const FPS = 30, SEC = 18;
  for (let f = 0; f < FPS * SEC; f++) {
    const t = f / FPS;
    await page.evaluate(([t]) => {
      const G = window.__tanks, I = window.__tanks_input;
      // drive forward while slowly circling; aim a bit ahead of the tank
      I.keys.add('KeyW');
      if (t > 6 && t < 9) I.keys.add('KeyD'); else I.keys.delete('KeyD');
      G.camRig.yaw += 0.0035;
      I.mouse.nx = Math.sin(t * 0.9) * 0.25; I.mouse.ny = 0.12 + Math.cos(t * 0.7) * 0.1;
      // show an evolution moment
      if (Math.abs(t - 10) < 0.02) { const w = G.arena.conn.world, me = w.tanks.get(G.arena.conn.me.id); me.tankId = 'fiveway'; w.recalc(me); me.d.maxHp = 1e7; me.hp = 1e7; me.infoVer++; w.fx.push({ tick: w.tick, d: [4, me.x, me.z, me.id] }); }
    }, [t]);
    await page.clock.runFor(1000 / FPS);
    await page.screenshot({ path: path.join(frames, String(f).padStart(4, '0') + '.png') });
    if (f % 60 === 0) console.log(`frame ${f}/${FPS * SEC}`);
  }
  const out = path.join(OUT, portrait ? 'preview-portrait.mp4' : 'preview-landscape.mp4');
  const size = portrait ? '1080:1620' : '1920:1080';
  execSync(`ffmpeg -loglevel error -y -framerate ${FPS} -i "${frames}/%04d.png" -vf "scale=${size}:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 20 -movflags +faststart -an "${out}"`);
  fs.rmSync(frames, { recursive: true, force: true });
  console.log('wrote', out);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  try {
    if (MODE === 'covers') await covers(browser);
    else if (MODE === 'video-landscape') await video(browser, false);
    else if (MODE === 'video-portrait') await video(browser, true);
    else console.log('unknown mode', MODE);
  } finally { await browser.close(); }
})();
