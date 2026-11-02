// Headless smoke test for the shared simulation.
import { World } from '../public/shared/world.js';
import { TANK_LIST, getTank } from '../public/shared/tanks.js';
import { MODES } from '../public/shared/config.js';

let failures = 0;
for (const mode of Object.keys(MODES)) {
  const w = new World(mode);
  const me = w.addTank({ name: 'Tester', level: 120, owned: TANK_LIST.map((t) => t.id) });
  const cs = {};
  const t0 = performance.now();
  let bytes = 0, snaps = 0, kills = 0, xp = 0;
  const ticks = 30 * 120;
  for (let i = 0; i < ticks; i++) {
    w.setInput(me.id, { mx: Math.cos(i / 50), mz: Math.sin(i / 70), a: i / 10, f: 1, s: i });
    if (i % 90 === 0) for (let k = 0; k < 8; k++) w.statUp(me.id, k);
    if (i % 300 === 0) {
      const opts = TANK_LIST.filter((d) => d.parent === me.tankId);
      if (opts.length) w.upgrade(me.id, opts[i % opts.length].id);
    }
    if (!me.alive) w.respawn(me.id);
    w.step();
    if (i % 2 === 0) {
      const s = w.snapshotFor(me.id, cs);
      bytes += JSON.stringify(s).length; snaps++;
      kills += s.me.kd; xp += s.me.xd;
    }
  }
  const ms = performance.now() - t0;
  // sanity
  for (const t of w.tanks.values()) {
    if (!Number.isFinite(t.x) || !Number.isFinite(t.z) || !Number.isFinite(t.hp)) { console.error('NaN tank', mode, t.name); failures++; }
  }
  for (const b of w.bullets.values()) if (!Number.isFinite(b.x)) { console.error('NaN bullet', mode); failures++; break; }
  const botKills = [...w.tanks.values()].reduce((a, t) => a + t.kills, 0);
  console.log(`${mode.padEnd(6)} ${ticks} ticks in ${ms.toFixed(0)}ms (${(ms / ticks).toFixed(2)}ms/tick) tanks=${w.tanks.size} shapes=${w.shapes.size} bullets=${w.bullets.size} avgSnap=${(bytes / snaps / 1024).toFixed(1)}KB myXp=${xp} myKills=${kills} lv=${me.level} tank=${getTank(me.tankId).name} liveKillsOnBoard=${botKills}`);
}
if (failures) { console.error('FAIL'); process.exit(1); }
console.log('OK');
