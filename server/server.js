// Multiplayer server: serves the static game from /public and runs authoritative
// rooms over WebSocket (/ws). Bots automatically fill rooms when players are few.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { World } from '../public/shared/world.js';
import { DT, MODES, SNAP_EVERY, PARTY_MAX, partyCap } from '../public/shared/config.js';
import { cleanName, cleanChat } from '../public/shared/filter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

// ------------------------------------------------------------------ rooms
let roomSeq = 1;
const rooms = new Map();

class Room {
  constructor(mode) {
    this.id = `${mode}-${roomSeq++}`;
    this.mode = mode;
    this.world = new World(mode, { viewR: 170 }); // online: tanks map-wide, shapes/bullets within 170 (bandwidth)
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
      xpMul: msg.xpMul, gemMul: msg.gemMul, uid: String(msg.uid || '').slice(0, 40), team: msg.team | 0,
    });
    client.room = this;
    client.tankId = t.id;
    client.cs = {};
    this.clients.add(client);
    client.send({ t: 'welcome', id: t.id, room: this.id, mode: this.mode, half: this.world.half, teams: MODES[this.mode].teams });
  }
  leave(client) {
    if (!this.clients.delete(client)) return;
    this.world.leaveTank(client.tankId); // leaving mid-fight gives the attacker the kill
    if (!this.clients.size) this.emptySince = Date.now();
  }
  step() {
    this.world.step();
    this.tickN++;
    if (this.tickN % SNAP_EVERY !== 0) return;
    for (const c of this.clients) {
      const snap = this.world.snapshotFor(c.tankId, c.cs);
      if (!snap) continue;
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

// ------------------------------------------------------------------ parties
// A party is a group of friends (code like 'K7QPM') that queues together: the leader picks a mode and
// starts, and every member is sent to the same server (and the same team in team modes).
const parties = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
let partySeq = 1;
function newCode() {
  for (;;) {
    let c = '';
    for (let i = 0; i < 5; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    if (!parties.has(c)) return c;
  }
}
function partyState(p) {
  return { code: p.code, leader: p.leader, mode: p.mode, max: PARTY_MAX,
    members: [...p.members.values()].map((m) => ({ id: m.pid, name: m.name, level: m.level, skin: m.skin })) };
}
function partyBroadcast(p) {
  const st = partyState(p);
  for (const m of p.members.values()) m.send({ t: 'party', ...st, you: m.pid });
}
function setProfile(client, m) {
  client.name = cleanName(m.name) || 'Guest';
  client.level = Math.max(1, Math.min(9999, m.level | 0));
  client.skin = String(m.skin || 'default').slice(0, 24);
}
function partyLeave(client, reason) {
  const p = client.party && parties.get(client.party);
  client.party = null;
  if (!p) return;
  p.members.delete(client.pid);
  if (reason) client.send({ t: 'p_left', reason });
  if (!p.members.size) { parties.delete(p.code); return; }
  if (p.leader === client.pid) p.leader = p.members.keys().next().value; // next member leads
  partyBroadcast(p);
}
// a server (and team) with room for the whole party
function placeParty(mode, n) {
  const md = MODES[mode];
  const fit = (r) => {
    if (r.mode !== mode || r.humans + n > md.maxHumans) return null;
    if (!md.teams) return { room: r, team: 0 };
    const humans = new Array(md.teams + 1).fill(0);
    for (const c of r.clients) { const t = r.world.tanks.get(c.tankId); if (t) humans[t.team]++; }
    let best = 0;
    for (let k = 1; k <= md.teams; k++) if (humans[k] + n <= partyCap(mode) && (!best || humans[k] < humans[best])) best = k;
    return best ? { room: r, team: best } : null;
  };
  let pick = null;
  for (const r of rooms.values()) { const f = fit(r); if (f && (!pick || r.humans > pick.room.humans)) pick = f; }
  if (!pick) { const r = new Room(mode); pick = fit(r) || { room: r, team: md.teams ? 1 : 0 }; }
  return pick;
}
function partyMsg(client, m) {
  switch (m.t) {
    case 'p_create': {
      partyLeave(client);
      setProfile(client, m);
      const p = { code: newCode(), leader: client.pid, mode: 'ffa', members: new Map() };
      p.members.set(client.pid, client);
      parties.set(p.code, p);
      client.party = p.code;
      partyBroadcast(p);
      break;
    }
    case 'p_join': {
      const code = String(m.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
      const p = parties.get(code);
      if (!p) return client.send({ t: 'p_err', msg: 'No party with that code.' });
      if (client.party === code) return partyBroadcast(p);
      if (p.members.size >= PARTY_MAX) return client.send({ t: 'p_err', msg: `That party is full (${PARTY_MAX} players).` });
      partyLeave(client);
      setProfile(client, m);
      p.members.set(client.pid, client);
      client.party = code;
      partyBroadcast(p);
      break;
    }
    case 'p_profile': {
      setProfile(client, m);
      const p = client.party && parties.get(client.party);
      if (p) partyBroadcast(p);
      break;
    }
    case 'p_leave': partyLeave(client); break;
    case 'p_mode': {
      const p = client.party && parties.get(client.party);
      if (!p || p.leader !== client.pid || !MODES[m.mode]) return;
      p.mode = m.mode;
      partyBroadcast(p);
      break;
    }
    case 'p_kick': {
      const p = client.party && parties.get(client.party);
      if (!p || p.leader !== client.pid) return;
      const target = p.members.get(m.id | 0);
      if (target && target !== client) partyLeave(target, 'You were removed from the party.');
      break;
    }
    case 'p_start': {
      const p = client.party && parties.get(client.party);
      if (!p || p.leader !== client.pid) return;
      const cap = partyCap(p.mode), n = p.members.size;
      if (n > cap) return client.send({ t: 'p_err', msg: `Party of ${n} is too big for ${MODES[p.mode].name} (max ${cap}).` });
      const { room, team } = placeParty(p.mode, n);
      for (const mem of p.members.values()) mem.send({ t: 'p_go', mode: p.mode, room: room.id, team });
      break;
    }
  }
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
  // Servers are live: the first server of each mode always runs (bots keep playing).
  // Extra servers created when others filled up close after 2 empty minutes.
  for (const r of rooms.values()) {
    if (r.clients.size || Date.now() - r.emptySince < 120_000) continue;
    let others = 0;
    for (const o of rooms.values()) if (o !== r && o.mode === r.mode) others++;
    if (others > 0) rooms.delete(r.id);
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
    ws, room: null, tankId: null, cs: null, lastChat: 0, msgs: 0, pid: partySeq++, party: null, name: 'Guest', level: 1, skin: 'default',
    send(o) { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
  };
  const rate = setInterval(() => { client.msgs = 0; }, 1000);

  ws.on('message', (raw) => {
    if (++client.msgs > 120) return; // flood guard
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const room = client.room;
    if (typeof m.t === 'string' && m.t.startsWith('p_')) return partyMsg(client, m);
    switch (m.t) {
      case 'join': {
        if (room) room.leave(client);
        const mode = MODES[m.mode] ? m.mode : 'ffa';
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
    partyLeave(client);
    if (client.room) client.room.leave(client);
  });
  ws.on('error', () => {});
});

// one always-on server per mode
for (const mode of Object.keys(MODES)) new Room(mode);

server.listen(PORT, () => {
  console.log(`Tanks server running on http://localhost:${PORT}  (ws path /ws)`);
});

