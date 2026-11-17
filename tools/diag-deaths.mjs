// Context of every death: where, when, with whom, how fed was the band. Prints a JSON array.
import { createWorld2, stepWorld } from '../dist/world.js';
import { clockOf } from '../dist/clock.js';
import { rainOf } from '../dist/savanna.js';
const seed = +(process.argv[2] ?? 1), years = +(process.argv[3] ?? 10);
const s = createWorld2(seed); s.diag = { routes: [], long: [], deaths: [] };
stepWorld(s, clockOf(s).year * years);
for (const d of s.diag.deaths) d.rain = +rainOf(s.seed ?? seed, d.year).toFixed?.(2) || rainOf(s.seed ?? seed, d.year);
console.log(JSON.stringify(s.diag.deaths));
