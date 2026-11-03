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
import { Tutorial } from './tutorial.js';
import { resolveServer, apiBase, localServer, wakeServer } from './net.js';
import { MODES } from '../shared/config.js';
import { cleanName, cleanChat } from '../shared/filter.js';

const G = {
  state: 'loading',
  toggles: { autoFire: false, autoSpin: false, lock: false },
  arena: null,
  lobby: null,
  api: undefined,
};
window.__tanks = G; // handy for debugging
window.__tanks_input = Input;

function progress() { /* no loading screen */ }

// ------------------------------------------------------------------ server helpers
async function api() {
  if (G.api !== undefined) return G.api;
  const ws = await resolveServer();
  G.api = apiBase(ws);
  return G.api;
}
G.fetchRooms = async () => {
  const base = await api();
  if (!base) return [];
  try { return await (await fetch(new URL('api/rooms', base))).json(); } catch { return []; }
};
G.netLabel = () => {
  if (G.arena && G.arena.conn) return `Server ${G.arena.roomId}`;
  return 'Servers: Battle, Red VS Blue, 4 Teams';
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
  Input.touchMode = 'arena';
  G.arena = new Arena(G);
  G.hud.big('Joining...', 1200);
  await G.arena.start(m.id, roomId);
  if (G.tut) G.tut.enterArena();
};

G.toLobby = async (skipAd) => {
  if (G.arena) { G.arena.stop(); G.arena = null; }
  G.menus.close();
  G.state = 'lobby';
  G.hud.setMode('lobby');
  Input.touchMode = 'lobby';
  G.lobby = new Lobby(G);
  G.lobby.start();
  if (G.tut) G.tut.enterLobby();
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

// Free XP button (claimable every 3 minutes).
G.claimXp = () => {
  const left = profile.d.store.xpAdAt - Date.now();
  if (left > 0) { G.hud.toast(`Free XP ready in ${Math.ceil(left / 1000)}s`, 'red'); return; }
  const v = 1000; // free XP is always 1,000
  profile.d.store.xpAdAt = Date.now() + 180000;
  profile.addXp(v);
  G.hud.toast(`Received +${v.toLocaleString()} XP!`, 'green');
  Audio.reward();
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
  wakeServer(); // start waking the multiplayer server while the game loads
  await SDK.init();
  SDK.loadingStart();
  progress(30, 'Loading save...');
  profile.load();
  // Name = the signed-in CrazyGames username, otherwise "Guest" (not editable).
  const applyUser = (u) => {
    profile.d.name = u && u.username ? cleanName(u.username) : 'Guest';
    profile.save();
  };
  applyUser(await SDK.getUser());
  SDK.call((s) => s.user.addAuthListener((u) => { applyUser(u); if (G.hud) G.hud.refresh(); }));
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
  G.tut = new Tutorial(G);
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
  // no online server: boot the local servers now so they are already live (bots playing)
  if (!G.api) for (const m of Object.keys(MODES)) localServer(m);
  progress(100, 'Ready!');
  SDK.loadingStop();
  window.addEventListener('pointerdown', () => Audio.unlock(), { once: true });
  window.addEventListener('beforeunload', () => profile.saveNow());
  document.addEventListener('visibilitychange', () => { if (document.hidden) profile.saveNow(); });

  const room = SDK.getInviteParam('room');
  const mode = SDK.getInviteParam('mode');
  if (room || (SDK.instantMultiplayer && G.api)) G.play(MODES[mode] ? mode : 'ffa', room || undefined);
  else G.toLobby(true);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G.flip) {
      // smooth eased 180 turn: quick but with ease-in/out and a slight camera pull-back mid-turn
      const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
      const t0 = G.flip.t;
      G.flip.t = Math.min(1, t0 + dt / 0.26);
      G.camRig.yaw += (ease(G.flip.t) - ease(t0)) * (G.flip.to - G.flip.from); // additive, so mouse/touch still works
      G.camRig.bump = Math.sin(Math.PI * G.flip.t) * 0.1;
      if (G.flip.t >= 1) { G.flip = null; G.camRig.bump = 0; }
    }
    if (G.state === 'arena' && G.arena) G.arena.update(dt);
    else if (G.state === 'lobby' && G.lobby) G.lobby.update(dt);
    if (G.tut) G.tut.update(dt);
    G.render(dt);
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  progress(100, 'Something went wrong: ' + e.message);
});
