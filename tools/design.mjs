// A designed set of runs for sensitivity analysis and the emulator: a Latin hypercube over chosen register numbers,
// each drawn from its maximum-entropy prior (clock.js priorOf). Every number's range is cut into n equal-probability
// strata and each stratum is used exactly once (McKay, Beckman and Conover 1979), so n runs cover every range evenly.
// node tools/design.mjs <n> <rate,rate,...> [seed]   ->  JSON lines of settings
import { RATES, priorOf } from '../dist/clock.js';
import { noise2, seedKey } from '../dist/sim.js';
export function latinHypercube(n, keys, seed = 1) {
  const k = seedKey(seed), rows = Array.from({ length: n }, () => ({}));
  keys.forEach((name, j) => {
    const p = priorOf(name), order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const r = Math.floor(noise2(k, j, i, 9001) * (i + 1)); [order[i], order[r]] = [order[r], order[i]]; } // shuffle strata
    order.forEach((stratum, i) => { rows[i][name] = p.sample((stratum + noise2(k, j, i + n, 9002)) / n); });
  });
  return rows;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const [n, list, seed] = [+(process.argv[2] ?? 10), (process.argv[3] ?? 'dayKmMax,cookGain').split(','), +(process.argv[4] ?? 1)];
  for (const name of list) if (!RATES[name]) { console.error(`no register entry ${name}`); process.exit(1); }
  for (const row of latinHypercube(n, list, seed)) console.log(JSON.stringify(row));
}
