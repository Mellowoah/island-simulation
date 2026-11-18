// Cross-entropy of the real-world patterns under the model: node tools/score.mjs [islands] [years] [--release]
// Without --release only the calibration set is scored (held-out patterns are not shown, so they are not tuned on).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
if (isMainThread) {
  const args = process.argv.slice(2), release = args.includes('--release'), [islands = 4, years = 10] = args.filter(a => !a.startsWith('--')).map(Number);
  const cfg = Object.fromEntries(args.filter(a => a.startsWith('--set=')).map(a => { const [k, v] = a.slice(6).split(':'); return [k, Number(v)]; })); // --set=choiceTemperature:0.1
  const { PATTERNS, crossEntropy } = await import('../dist/patterns.js');
  const seeds = Array.from({ length: islands }, (_, i) => i + 1), stats = [];
  await Promise.all(Array.from({ length: Math.min(islands, availableParallelism()) }, async () => {
    while (seeds.length) { const seed = seeds.shift(); stats.push(await new Promise((ok, no) => { const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seed, years, cfg } }); w.on('message', ok); w.on('error', no); })); process.stderr.write(`island ${seed} done\n`); }
  }));
  const set = PATTERNS.filter(p => release || p.set === 'calibration'), r = crossEntropy(set, stats);
  console.log(`# Cross-entropy, ${islands} islands x ${years} years (${release ? 'calibration and held-out' : 'calibration set only'})\n\nScore: ${r.ce.toFixed(3)} nats per pattern (lower is better)\n\n| pattern | set | real | model (mean, sd) | z | -log p |\n|---|---|---|---|---|---|`);
  for (const x of r.rows) console.log(`| ${x.what} | ${x.set} | ${x.z} | ${Number.isFinite(x.mean) ? x.mean.toFixed(3) + ', ' + x.sdSim.toFixed(3) : 'n/a'} | ${Number.isFinite(x.zscore) ? x.zscore.toFixed(2) : ''} | ${Number.isFinite(x.nll) ? x.nll.toFixed(2) : ''} |`);
} else {
  const { createWorld2, stepWorld, lifeTable } = await import('../dist/world.js');
  const { snapshot, islandStats } = await import('../dist/patterns.js');
  const T = await import('../dist/terrain.js');
  const s = createWorld2(workerData.seed, workerData.cfg ?? {}), Y = 8760; stepWorld(s, Y); const s0 = snapshot(s); stepWorld(s, Y * (workerData.years - 2)); const sY = snapshot(s); stepWorld(s, Y);
  parentPort.postMessage(islandStats(s, s0, sY, lifeTable, T.TILE_KM));
}
