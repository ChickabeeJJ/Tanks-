// Leaving while in combat must count as a kill for the attacker; leaving out of combat must not.
import { World } from '../public/shared/world.js';
import { DT, COMBAT_TIME } from '../public/shared/config.js';
const w = new World('ffa', { botTarget: 0 });
const a = w.addTank({ name: 'Attacker' });
const v = w.addTank({ name: 'Victim' });
a.shieldUntil = v.shieldUntil = 0;
w.damageTank(v, 5, a.id);
console.log('in combat:', w.inCombat(v));
const counted = w.leaveTank(v.id);
console.log('leave counted as kill:', counted, 'attacker kills:', a.kills);
const c = w.addTank({ name: 'Calm' });
c.shieldUntil = 0;
w.damageTank(c, 5, a.id);
for (let i = 0; i < (COMBAT_TIME + 1) / DT; i++) w.step();
const counted2 = w.leaveTank(c.id);
console.log('leave after combat timer counted:', counted2, 'attacker kills:', a.kills);
process.exit(counted && !counted2 && a.kills === 1 ? 0 : 1);
