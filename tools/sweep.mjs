// Sweep one register number across its range: node tools/sweep.mjs <rate> [islands] [years] [steps]
// Each value runs the same seeds (paired), so differences come from the number, not luck. Prints a table.
import { RATES } from '../dist/clock.js';
import { createWorld2, stepWorld, worldMetrics } from '../dist/world.js';
import { clockOf } from '../dist/clock.js';
const [k, islands = 3, years = 5, steps = 3] = [process.argv[2], ...process.argv.slice(3).map(Number)];
if (!RATES[k]) { console.log('register numbers:', Object.keys(RATES).join(', ')); process.exit(1); }
const r = RATES[k], vals = Array.from({ length: steps }, (_, i) => r.low + (r.high - r.low) * i / Math.max(1, steps - 1));
console.log(`| ${k} (${r.unit}) | alive (mean) | deaths: hunger+thirst | alarms |\n|---|---|---|---|`);
for (const v of vals) {
  r.value = v; let alive = 0, ht = 0, al = 0;
  for (let i = 1; i <= islands; i++) { const s = createWorld2(i); stepWorld(s, clockOf(s).year * years); const m = worldMetrics(s); alive += m.population; ht += (s.deaths.Starvation ?? 0) + (s.deaths.Thirst ?? 0); al += (s.alarms ?? []).length; }
  console.log(`| ${+v.toFixed(4)} | ${(alive / islands).toFixed(1)} | ${ht} | ${al} |`);
}
