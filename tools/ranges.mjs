// Run each named assumption at its register low and high (and the base), several islands each, and print one
// JSON line per run: node tools/ranges.mjs <years> <seeds,comma> <name,name,...>  (runs in parallel, 2 at a time)
import { RATES } from '../dist/clock.js';
import { execFile } from 'node:child_process';
const [years, seeds, names] = [process.argv[2], process.argv[3].split(','), process.argv[4].split(',')];
const jobs = [];
for (const seed of seeds) jobs.push({ name: 'base', end: 'base', value: null, seed });
for (const n of names)
  for (const end of ['low', 'high'])
    for (const seed of seeds) jobs.push({ name: n, end, value: RATES[n][end], seed });
const run = j =>
  new Promise(res =>
    execFile('node', ['tools/gate-run.mjs', j.seed, years, '{}', JSON.stringify(j.value == null ? {} : { [j.name]: j.value })],
      { maxBuffer: 1 << 26 }, (err, out) => res({ ...j, out: err ? { error: String(err).slice(0, 200) } : JSON.parse(out) })));
let k = 0;
const worker = async () => { while (k < jobs.length) { const r = await run(jobs[k++]); console.log(JSON.stringify(r)); } };
await Promise.all([worker(), worker()]);
