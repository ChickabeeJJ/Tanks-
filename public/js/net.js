// Connection layer. OnlineConn talks to the Node server; OfflineConn runs the exact same
// World simulation locally with bots so the game always works (e.g. no server configured).
import { World } from '../shared/world.js';
import { DT } from '../shared/config.js';
import { cleanChat } from '../shared/filter.js';

function cfg() { return window.TANKS_CONFIG || {}; }

// Returns the websocket URL to try, or null if we should go straight to offline.
export async function resolveServer() {
  const c = cfg();
  if (c.offline) return null;
  if (c.server) return c.server;
  if (!location.protocol.startsWith('http')) return null;
  // Same-origin server (when the game is served by `npm start`)
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 1500);
    const r = await fetch('api/ping', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(to);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.ok) return null;
  } catch { return null; }
  const u = new URL('ws', location.href);
  u.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
}

export function apiBase(wsUrl) {
  if (!wsUrl) return null;
  const u = new URL(wsUrl);
  u.protocol = u.protocol === 'wss:' ? 'https:' : 'http:';
  u.pathname = u.pathname.replace(/ws\/?$/, '');
  return u.toString();
}

export class OnlineConn {
  constructor(url, h) {
    this.url = url;
    this.h = h;
    this.ws = null;
    this.online = true;
    this.rtt = 0;
  }
  connect(timeout = 4000) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      try { this.ws = new WebSocket(this.url); } catch { finish(false); return; }
      const to = setTimeout(() => { finish(false); try { this.ws.close(); } catch { /* */ } }, timeout);
      this.ws.onopen = () => { clearTimeout(to); finish(true); };
      this.ws.onerror = () => { clearTimeout(to); finish(false); };
      this.ws.onclose = () => { if (done && this.h.onClose) this.h.onClose(); finish(false); };
      this.ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        if (m.t === 's') this.h.onSnapshot(m);
        else if (m.t === 'welcome') this.h.onWelcome(m);
        else if (m.t === 'pong') this.rtt = performance.now() - m.c;
      };
    });
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  join(msg) { this.send({ t: 'join', ...msg }); }
  update() {
    const now = performance.now();
    if (!this.lastPing || now - this.lastPing > 2000) { this.lastPing = now; this.send({ t: 'ping', c: now }); }
  }
  close() { this.h.onClose = null; try { this.send({ t: 'leave' }); this.ws.close(); } catch { /* */ } }
}

// Local servers (used when no online server is reachable). Like real servers they are live:
// created once per mode, they keep running (bots keep playing) while you are in the lobby or dead.
const LOCAL = new Map();
let ticker = null, last = 0, acc = 0;
export function localServer(mode) {
  if (!LOCAL.has(mode)) LOCAL.set(mode, { world: new World(mode), listeners: new Set() });
  if (!ticker) {
    last = performance.now();
    ticker = setInterval(() => {
      const now = performance.now();
      acc += Math.min((now - last) / 1000, 0.5);
      last = now;
      let n = 0;
      while (acc >= DT && n++ < 8) {
        acc -= DT;
        for (const s of LOCAL.values()) {
          s.world.step();
          for (const f of s.listeners) f();
        }
      }
      if (acc > 1) acc = 0;
    }, 1000 / 60);
  }
  return LOCAL.get(mode);
}

export class OfflineConn {
  constructor(h) {
    this.h = h;
    this.online = false;
    this.rtt = 0;
  }
  join(msg) {
    const srv = localServer(msg.mode);
    this.srv = srv;
    this.world = srv.world;
    this.me = this.world.addTank(msg);
    this.cs = {};
    this.listener = () => {
      const s = this.world && this.world.snapshotFor(this.me.id, this.cs);
      if (s) this.h.onSnapshot(s);
    };
    srv.listeners.add(this.listener);
    this.h.onWelcome({ t: 'welcome', id: this.me.id, room: `${msg.mode}-1`, mode: msg.mode, half: this.world.half, teams: this.world.mode.teams });
  }
  send(o) {
    const w = this.world;
    if (!w) return;
    const id = this.me.id;
    switch (o.t) {
      case 'in': w.setInput(id, o); break;
      case 'stat': w.statUp(id, o.i); break;
      case 'up': w.upgrade(id, o.id); break;
      case 'respawn': w.respawn(id); break;
      case 'own': this.me.owned = o.owned.slice(); break;
      case 'chat': { const m = cleanChat(o.m); if (m) w.addChat(id, m); break; }
    }
  }
  update() { /* the shared local ticker drives the simulation */ }
  close() {
    if (this.srv) this.srv.listeners.delete(this.listener);
    if (this.world && this.me) this.world.leaveTank(this.me.id); // the server itself keeps running
    this.world = null;
  }
}
