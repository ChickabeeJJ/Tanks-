// Boot + glue between systems.
import { SDK } from './sdk.js';
import { profile } from './profile.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { createRenderer, CameraRig } from './render/scene.js';
import { createHUD } from './ui/hud.js';
import { createMenus } from './ui/menus.js';
import { Arena } from './game.js';
import { Lobby } from './lobby.js';
import { resolveServer, apiBase } from './net.js';
import { MODES } from '../shared/config.js';
import { cleanName, cleanChat } from '../shared/filter.js';

const G = {
  state: 'loading',
  toggles: { autoFire: false, autoSpin: false, lock: false },
  arena: null,
  lobby: null,
  api: undefined,
  lastAd: performance.now(),
};
window.__tanks = G; // handy for debugging

function progress(p, text) {
  const bar = document.querySelector('#loading .bar div');
  if (bar) bar.style.width = p + '%';
  const t = document.querySelector('#loading p');
  if (t && text) t.textContent = text;
}

// ------------------------------------------------------------------ server helpers
async function api() {
  if (G.api !== undefined) return G.api;
  const ws = await resolveServer();
  G.api = apiBase(ws);
  return G.api;
}
G.fetchBoards = async () => {
  const base = await api();
  if (!base) return null;
  try { return await (await fetch(new URL('api/leaderboard', base))).json(); } catch { return null; }
};
G.fetchRooms = async () => {
  const base = await api();
  if (!base) return [];
  try { return await (await fetch(new URL('api/rooms', base))).json(); } catch { return []; }
};
G.netLabel = () => {
  if (G.arena && G.arena.conn) return G.arena.online ? `Online · server ${G.arena.roomId}` : 'Offline · playing with bots';
  return G.api ? 'Online servers available' : 'Offline mode · bots fill every match';
};

// ------------------------------------------------------------------ state changes
G.play = async (mode, roomId) => {
  const m = MODES[mode] || MODES.ffa;
  if (m.minLevel && profile.level < m.minLevel) { G.hud.toast(`Reach Level ${m.minLevel} to play ${m.name}!`, 'red'); return; }
  if (G.state === 'arena') G.arena.stop();
  if (G.lobby) { G.lobby.stop(); G.lobby = null; }
  G.menus.close();
  G.state = 'arena';
  G.hud.setMode('arena');
  G.arena = new Arena(G);
  G.hud.big('Joining...', 1200);
  await G.arena.start(m.id, roomId);
};

G.toLobby = async (skipAd) => {
  if (G.arena) { G.arena.stop(); G.arena = null; }
  G.menus.close();
  if (!skipAd && performance.now() - G.lastAd > 120000) {
    G.lastAd = performance.now();
    await SDK.ad('midgame');
  }
  G.state = 'lobby';
  G.hud.setMode('lobby');
  G.lobby = new Lobby(G);
  G.lobby.start();
  SDK.gameplayStop();
};

// ------------------------------------------------------------------ actions
// In-match "Lobby" button. Leaving while in combat counts as a kill for whoever was fighting you.
G.leaveMatch = () => {
  const a = G.arena;
  if (!a) return;
  if (a.me && a.alive && a.me.cb > 0) {
    G.menus.open('confirm', '<b>You are in combat!</b><br>If you leave now it counts as a kill for your enemy.<br>Leave anyway?', () => G.toLobby());
    return;
  }
  G.toLobby();
};

G.rewarded = async () => {
  const ok = await SDK.ad('rewarded');
  if (ok) {
    if (!profile.d.rank.ad) { profile.d.rank.ad = 1; profile.save(); }
    G.lastAd = performance.now();
  } else G.hud.toast('Ad not available right now, try again later', 'red');
  return ok;
};

G.adXp = async () => {
  const left = profile.d.store.xpAdAt - Date.now();
  if (left > 0) { G.hud.toast(`XP reward ready in ${Math.ceil(left / 1000)}s`, 'red'); return; }
  if (await G.rewarded()) {
    const v = profile.xpLv(0.25);
    profile.d.store.xpAdAt = Date.now() + 180000;
    profile.addXp(v);
    G.hud.toast(`Received +${v.toLocaleString()} XP!`, 'green');
    Audio.reward();
  }
};

G.invite = async () => {
  const params = G.arena && G.arena.online ? { room: G.arena.roomId, mode: G.arena.mode } : { mode: G.arena ? G.arena.mode : 'ffa' };
  const link = SDK.inviteLink(params);
  try { await navigator.clipboard.writeText(link); G.hud.toast('Invite link copied!', 'blue'); } catch { G.hud.toast('Share this page link with your friends!', 'blue'); }
  if (!profile.d.rank.invite) { profile.d.rank.invite = 1; profile.save(); }
};

G.sendChat = (msg) => {
  msg = cleanChat(msg);
  if (!msg) return;
  if (G.arena && G.arena.conn) G.arena.chat(msg);
  else G.hud.chatLine(profile.d.name, msg);
};

G.onSkinChanged = () => {
  if (G.lobby) G.lobby.setSkin();
  if (G.arena) G.hud.toast('New skin shows next time you join a match', 'blue');
};
G.onOwnedChanged = () => { if (G.arena) G.arena.sendOwned(); };

G.toggle = (name) => {
  const t = G.toggles;
  if (name === 'flip') { G.flip = { from: G.camRig.yaw, to: G.camRig.yaw + Math.PI, t: 0 }; return; }
  t[name] = !t[name];
  if (name === 'lock') { if (t.lock) Input.requestLock(); else Input.exitLock(); }
  G.hud.toast(`${{ autoFire: 'Auto Fire', autoSpin: 'Auto Spin', lock: 'Shift Lock' }[name]}: ${t[name] ? 'ON' : 'OFF'}`, t[name] ? 'green' : 'red', 1200);
  G.hud.setToggles(t);
};

// ------------------------------------------------------------------ keys
function onKey(code) {
  Audio.unlock();
  const typing = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (typing) return;
  if (code === 'Escape') { G.menus.close(); G.hud.closeQ(); G.hud.closeE(); return; }
  if (code === 'Enter' || code === 'Slash') { G.hud.openChat(); return; }
  if (code === 'ShiftLeft' || code === 'ShiftRight') { G.toggle('lock'); return; }
  if (code === 'KeyF') return G.toggle('autoFire');
  if (code === 'KeyR') return G.toggle('autoSpin');
  if (code === 'KeyC') return G.toggle('flip');
  if (code === 'KeyX') return G.menus.isOpen ? G.menus.close() : G.menus.open('index');
  if (code === 'KeyG') return G.menus.isOpen ? G.menus.close() : G.menus.open('gifts');
  if (G.menus.isOpen) return;
  if (code === 'KeyQ') return G.hud.toggleQ();
  if (code === 'KeyE') return G.hud.toggleE();
  const m = /^Digit([1-8])$/.exec(code) || /^Numpad([1-8])$/.exec(code);
  if (m && G.arena) G.arena.statUp(+m[1] - 1);
}

// ------------------------------------------------------------------ boot
async function boot() {
  progress(10, 'Starting...');
  await SDK.init();
  SDK.loadingStart();
  progress(30, 'Loading save...');
  profile.load();
  if (!profile.d.name) {
    const u = await SDK.getUser();
    profile.d.name = cleanName(u && u.username ? u.username : 'Guest' + Math.floor(1000 + Math.random() * 9000));
    profile.save();
  }
  Audio.setVolume(profile.d.settings.sfx);
  progress(55, 'Building world...');
  const canvas = document.getElementById('c');
  Object.assign(G, createRenderer(canvas, profile.d.settings.quality));
  G.camRig = new CameraRig(G.camera);
  Input.init(canvas);
  Input.onKey = onKey;
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && G.toggles.lock) { G.toggles.lock = false; G.hud.setToggles(G.toggles); }
  });
  G.hud = createHUD(G);
  G.menus = createMenus(G);
  let refreshQueued = false;
  profile.on((what) => {
    if (what === 'owned') G.onOwnedChanged();
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => { refreshQueued = false; G.hud.refresh(); }, 100);
  });
  setInterval(() => G.hud.refresh(), 1000);
  G.hud.refresh();
  progress(80, 'Finding servers...');
  await api();
  progress(100, 'Ready!');
  SDK.loadingStop();
  document.getElementById('loading').remove();
  window.addEventListener('pointerdown', () => Audio.unlock(), { once: true });
  window.addEventListener('beforeunload', () => profile.saveNow());
  document.addEventListener('visibilitychange', () => { if (document.hidden) profile.saveNow(); });

  const room = SDK.getInviteParam('room');
  const mode = SDK.getInviteParam('mode');
  if (room || (SDK.instantMultiplayer && G.api)) G.play(MODES[mode] ? mode : 'ffa', room || undefined);
  else G.toLobby(true);
  G.hud.chatLine('', 'Welcome! Drive into a portal to play. Shift toggles camera lock, R auto-spins.');

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G.flip) {
      G.flip.t = Math.min(1, G.flip.t + dt / 0.25);
      G.camRig.yaw = G.flip.from + (G.flip.to - G.flip.from) * G.flip.t;
      if (G.flip.t >= 1) G.flip = null;
    }
    if (G.state === 'arena' && G.arena) G.arena.update(dt);
    else if (G.state === 'lobby' && G.lobby) G.lobby.update(dt);
    G.renderer.render(G.scene, G.camera);
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  progress(100, 'Something went wrong: ' + e.message);
});
