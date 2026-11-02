// Multiplayer server: serves the static game from /public and runs authoritative
// rooms over WebSocket (/ws). Bots automatically fill rooms when players are few.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World } from '../public/shared/world.js';
import { DT, MODES, SNAP_EVERY } from '../public/shared/config.js';
import { cleanName, cleanChat } from '../public/shared/filter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA = path.join(__dirname, 'data');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

// ------------------------------------------------------------------ leaderboards (lobby boards)
const boards = { kills: new Map(), level: new Map(), rank: new Map() };
try {
  const saved = JSON.parse(fs.readFileSync(path.join(DATA, 'leaderboards.json'), 'utf8'));
  for (const k of Object.keys(boards)) for (const [uid, name, v] of saved[k] || []) boards[k].set(uid, { name, v });
} catch { /* first run */ }

function submitBoard(kind, uid, name, v) {
  if (!uid || !Number.isFinite(v)) return;
  const cur = boards[kind].get(uid);
  if (!cur || v >= cur.v || cur.name !== name) boards[kind].set(uid, { name, v: Math.max(v, cur ? cur.v : 0) });
}
function topBoard(kind, n = 10) {
  return [...boards[kind].entries()].sort((a, b) => b[1].v - a[1].v).slice(0, n).map(([, e]) => [e.name, e.v]);
}
function saveBoards() {
  try {
    fs.mkdirSync(DATA, { recursive: true });
    const out = {};
    for (const k of Object.keys(boards)) {
      out[k] = [...boards[k].entries()].sort((a, b) => b[1].v - a[1].v).slice(0, 200).map(([uid, e]) => [uid, e.name, e.v]);
    }
    fs.writeFileSync(path.join(DATA, 'leaderboards.json'), JSON.stringify(out));
  } catch (e) { console.warn('could not save leaderboards', e.message); }
}
setInterval(saveBoards, 60_000).unref();

// ------------------------------------------------------------------ rooms
let roomSeq = 1;
const rooms = new Map();

class Room {
  constructor(mode) {
    this.id = `${mode}-${roomSeq++}`;
    this.mode = mode;
    this.world = new World(mode);
    this.clients = new Set();
    this.tickN = 0;
    this.emptySince = Date.now();
    rooms.set(this.id, this);
  }
  get humans() { return this.clients.size; }
  hasSpace() { return this.humans < MODES[this.mode].maxHumans; }
  join(client, msg) {
    const t = this.world.addTank({
      name: cleanName(msg.name), level: msg.level, xp: msg.xp, skin: msg.skin, owned: msg.owned, caps: msg.caps,
      xpMul: msg.xpMul, gemMul: msg.gemMul, uid: String(msg.uid || '').slice(0, 40),
    });
    client.room = this;
    client.tankId = t.id;
    client.cs = {};
    this.clients.add(client);
    submitBoard('level', t.uid, t.name, t.level);
    if (Number.isFinite(msg.rank)) submitBoard('rank', t.uid, t.name, msg.rank);
    if (Number.isFinite(msg.totalKills)) submitBoard('kills', t.uid, t.name, msg.totalKills);
    client.send({ t: 'welcome', id: t.id, room: this.id, mode: this.mode, half: this.world.half, teams: MODES[this.mode].teams });
  }
  leave(client) {
    if (!this.clients.delete(client)) return;
    const t = this.world.tanks.get(client.tankId);
    if (t) submitBoard('level', t.uid, t.name, t.level);
    this.world.removeTank(client.tankId);
    if (!this.clients.size) this.emptySince = Date.now();
  }
  step() {
    this.world.step();
    this.tickN++;
    if (this.tickN % SNAP_EVERY !== 0) return;
    for (const c of this.clients) {
      const snap = this.world.snapshotFor(c.tankId, c.cs);
      if (!snap) continue;
      if (snap.me.kd && c.totalKills !== undefined) {
        c.totalKills += snap.me.kd;
        const t = this.world.tanks.get(c.tankId);
        if (t) submitBoard('kills', t.uid, t.name, c.totalKills);
      }
      c.send({ t: 's', ...snap });
    }
  }
}

function findRoom(mode, roomId) {
  if (roomId && rooms.has(roomId)) {
    const r = rooms.get(roomId);
    if (r.hasSpace()) return r;
  }
  let best = null;
  for (const r of rooms.values()) {
    if (r.mode !== mode || !r.hasSpace()) continue;
    if (!best || r.humans > best.humans) best = r; // pack players together
  }
  return best || new Room(mode);
}

// Fixed-rate loop for every room.
let last = performance.now();
let acc = 0;
setInterval(() => {
  const now = performance.now();
  acc += (now - last) / 1000;
  last = now;
  let steps = 0;
  while (acc >= DT && steps++ < 5) {
    acc -= DT;
    for (const r of rooms.values()) r.step();
  }
  if (acc > 1) acc = 0;
  // close long-empty rooms
  for (const r of rooms.values()) {
    if (!r.clients.size && Date.now() - r.emptySince > 60_000) rooms.delete(r.id);
  }
}, 1000 / 60);

// ------------------------------------------------------------------ http
function sendJson(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/api/ping') return sendJson(res, 200, { ok: true, rooms: rooms.size });
  if (url.pathname === '/api/leaderboard') {
    return sendJson(res, 200, { kills: topBoard('kills'), level: topBoard('level'), rank: topBoard('rank') });
  }
  if (url.pathname === '/api/rooms') {
    return sendJson(res, 200, [...rooms.values()].map((r) => ({ id: r.id, mode: r.mode, players: r.humans, max: MODES[r.mode].maxHumans })));
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ------------------------------------------------------------------ websocket
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });

wss.on('connection', (ws) => {
  const client = {
    ws, room: null, tankId: null, cs: null, lastChat: 0, msgs: 0, totalKills: 0,
    send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
  };
  const rate = setInterval(() => { client.msgs = 0; }, 1000);

  ws.on('message', (raw) => {
    if (++client.msgs > 120) return; // flood guard
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const room = client.room;
    switch (m.t) {
      case 'join': {
        if (room) room.leave(client);
        const mode = MODES[m.mode] ? m.mode : 'ffa';
        client.totalKills = Number(m.totalKills) || 0;
        findRoom(mode, m.room).join(client, m);
        break;
      }
      case 'in': if (room) room.world.setInput(client.tankId, m); break;
      case 'stat': if (room) room.world.statUp(client.tankId, m.i | 0); break;
      case 'up': if (room) room.world.upgrade(client.tankId, String(m.id)); break;
      case 'respawn': if (room) room.world.respawn(client.tankId); break;
      case 'own': {
        // player bought a tank/skin while in game
        const t = room && room.world.tanks.get(client.tankId);
        if (t && Array.isArray(m.owned)) t.owned = m.owned.filter((x) => typeof x === 'string').slice(0, 200);
        break;
      }
      case 'chat': {
        const now = Date.now();
        if (!room || now - client.lastChat < 1500) return;
        const msg = cleanChat(m.m);
        if (!msg) return;
        client.lastChat = now;
        room.world.addChat(client.tankId, msg);
        break;
      }
      case 'leave': if (room) { room.leave(client); client.room = null; } break;
      case 'ping': client.send({ t: 'pong', c: m.c }); break;
    }
  });
  ws.on('close', () => {
    clearInterval(rate);
    if (client.room) client.room.leave(client);
  });
  ws.on('error', () => {});
});

server.listen(PORT, () => {
  console.log(`Tanks server running on http://localhost:${PORT}  (ws path /ws)`);
});

process.on('SIGINT', () => { saveBoards(); process.exit(0); });
process.on('SIGTERM', () => { saveBoards(); process.exit(0); });
