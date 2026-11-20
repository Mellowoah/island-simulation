// What is real and what is a stand-in, and which real layers feed each stand-in. Printed on every save.
import { LAYERS, standIns } from '../dist/layers.js';

const real = Object.entries(LAYERS).filter(([, L]) => L.status === 'real' && L.rank >= 0 && L.rank <= 6);
console.log(`Real layers: ${real.map(([n]) => n).join(', ')}`);
for (const s of standIns()) console.log(`Stand-in ${s.name}${s.fedBy.length ? ` (fed by real ${s.fedBy.join(', ')})` : ''}: ${s.note}`);
for (const [n, L] of Object.entries(LAYERS)) if (L.provisional) console.log(`Provisional in ${n} (fitted, to be replaced): ${L.provisional.join(', ')}`);
