// Price equation on the small world: node tools/price.mjs [islands=4] [years=10] [--from=1]
// Parents = adults alive after the first year (settled); offspring = their children born in the rest of the run.
// Prints, per trait, the change in mean between parents and offspring split into selection and transmission.
import { Worker, isMainThread, workerData, parentPort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createWorld2, stepWorld } from '../dist/world.js';
import { priceOfWorld } from '../dist/price.js';
if (isMainThread) {
  const args = process.argv.slice(2), [islands = 4, years = 10] = args.filter(a => !a.startsWith('--')).map(Number), from = +(args.find(a => a.startsWith('--from='))?.slice(7) ?? 1);
  const res = await Promise.all(Array.from({ length: islands }, (_, i) => new Promise((ok, no) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seed: from + i, years } }); w.on('message', ok); w.on('error', no); })));
  console.log(`# Price equation, ${islands} islands x ${years} years: change in mean trait, parents -> children (selection + transmission)\n`);
  console.log('trait            Δz̄ (mean ± sd over islands)   selection        transmission     check');
  const f = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length, sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, xs.length - 1)); return `${m >= 0 ? '+' : ''}${m.toFixed(4)} ± ${sd.toFixed(4)}`; };
  for (const k of Object.keys(res[0])) { const r = res.map(x => x[k]).filter(Boolean); console.log(`${k.padEnd(16)} ${f(r.map(x => x.dz)).padEnd(29)} ${f(r.map(x => x.selection)).padEnd(16)} ${f(r.map(x => x.transmission)).padEnd(16)} ${Math.max(...r.map(x => Math.abs(x.check))).toExponential(1)}`); }
} else { const s = createWorld2(workerData.seed), Y = 8760; stepWorld(s, Y); const t0 = s.tick; stepWorld(s, Y * (workerData.years - 1)); parentPort.postMessage(priceOfWorld(s, t0)); }
