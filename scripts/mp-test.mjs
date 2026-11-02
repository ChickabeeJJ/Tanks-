// Connects two fake players to a running server and checks they share a room.
import WebSocket from 'ws';
const url = process.argv[2] || 'ws://localhost:3000/ws';
const mk = (name) => new Promise((res) => {
  const ws = new WebSocket(url);
  const st = { ws, name, welcome: null, last: null };
  ws.on('open', () => ws.send(JSON.stringify({ t: 'join', mode: 'ffa', name, level: 50 })));
  ws.on('message', (d) => { const m = JSON.parse(d); if (m.t === 'welcome') { st.welcome = m; res(st); } if (m.t === 's') { st.last = m; if (m.lb) st.lb = m.lb; } });
});
const a = await mk('Alice');
const b = await mk('Bob');
await new Promise((r) => setTimeout(r, 2500));
console.log('rooms:', a.welcome.room, b.welcome.room);
const list = (a.lb || {}).list || [];
console.log('players in room:', list.length, 'humans:', list.filter((r) => !r[2]).map((r) => r[0]).join(','), 'bots:', list.filter((r) => r[2]).length);
a.ws.close(); b.ws.close();
process.exit(a.welcome.room === b.welcome.room ? 0 : 1);
