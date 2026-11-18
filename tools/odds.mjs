// Many islands, one question at a time: run N seeds for Y years and report odds, not single stories.
// Usage: node tools/odds.mjs <islands> <years> [firstSeed]   (uses all CPU cores)
// Every number comes with its Monte Carlo standard error; the binomial rule n = p(1-p)(1.96/e)^2 says how many islands
// a given precision needs (about 320 to pin a 30% chance to +-5%).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

if (!isMainThread) {
  const { createWorld2, stepWorld, worldMetrics, lifeTable } = await import('../dist/world.js');
  const { clockOf } = await import('../dist/clock.js');
  for (const seed of workerData.seeds) {
    const s = createWorld2(seed), Y = clockOf(s).year; let extinctYear = null, minPop = Infinity, splits = 0;
    for (let y = 1; y <= workerData.years; y++) { stepWorld(s, Y); const n = worldMetrics(s).population; minPop = Math.min(minPop, n); if (!n) { extinctYear = y; break; } }
    const m = worldMetrics(s);
    splits = s.events.filter(e => / split:/.test(e.text)).length;
    parentPort.postMessage({ seed, pop: m.population, extinctYear, minPop, deaths: m.deaths, births: m.births, everLived: m.everLived, generations: m.generations, bands: m.bands.length, alarms: m.alarms, unusual: s.unusual ?? 0, known: m.discoveredShare, life: lifeTable(s), splits });
  }
  process.exit(0);
}

const [N = 8, years = 30, first = 1] = process.argv.slice(2).map(Number);
const seeds = Array.from({ length: N }, (_, i) => first + i), cores = Math.max(1, Math.min(os.cpus().length, N));
const results = [];
await Promise.all(Array.from({ length: cores }, (_, c) => new Promise(res => {
  const w = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: seeds.filter((_, i) => i % cores === c), years } });
  w.on('message', r => { results.push(r); process.stderr.write(`island ${r.seed} done (${results.length}/${N})\n`); }); w.on('exit', res); w.on('error', e => { console.error(e); res(); });
})));
const p = k => results.filter(k).length / results.length, se = q => Math.sqrt(q * (1 - q) / results.length);
const pct = q => `${(q * 100).toFixed(0)}% (±${(se(q) * 196).toFixed(0)})`;
const q = (xs, f) => { const v = [...xs].sort((a, b) => a - b); return v[Math.min(v.length - 1, Math.floor(f * v.length))]; };
const pops = results.map(r => r.pop), allDeaths = {};
for (const r of results) for (const [k, v] of Object.entries(r.deaths)) allDeaths[k] = (allDeaths[k] ?? 0) + v;
const totD = Object.values(allDeaths).reduce((a, b) => a + b, 0);
// pooled life table: deaths and person-years in each age band across islands, against the Hadza Siler pattern
const life = results[0].life.map((row, i) => ({ ...row, years: results.reduce((n, r) => n + r.life[i].years, 0), deaths: results.reduce((n, r) => n + r.life[i].deaths, 0), modelled: results.reduce((n, r) => n + r.life[i].modelled, 0) }));
const out = [];
out.push(`# ${N} islands, ${years} years each (seeds ${first}-${first + N - 1})`, '');
out.push(`- People all gone by the end: ${pct(p(r => r.extinctYear !== null))}`);
out.push(`- People alive at the end: median ${q(pops, 0.5)}, middle half ${q(pops, 0.25)}-${q(pops, 0.75)}; lowest point on an island: median ${q(results.map(r => r.minPop), 0.5)}`);
out.push(`- Bands at the end: median ${q(results.map(r => r.bands), 0.5)}; islands where a band split at least once: ${pct(p(r => r.splits > 0))}`);
out.push(`- Generations reached: median ${q(results.map(r => r.generations), 0.5) + 1}; island known at the end: median ${(q(results.map(r => r.known), 0.5) * 100).toFixed(0)}%`);
out.push(`- Alarms (things that must never happen): ${results.reduce((n, r) => n + r.alarms, 0)} in all; unusual days (over 40 km walked): ${results.reduce((n, r) => n + r.unusual, 0)}`, '');
out.push('## How people died (all islands)', '', ...Object.entries(allDeaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v} (${(v / totD * 100).toFixed(0)}%)`), '');
out.push('Real hunter-gatherers (Gurven and Kaplan 2007, all groups): illness about 70%, accidents and violence about 20%, degenerative about 9%. Starvation is a small share.', '');
out.push('## Death rate by age against the measured pattern (Hadza Siler fit)', '', '| age | person-years | deaths | rate per year | measured | from the sim\'s own causes |', '|---|---|---|---|---|---|');
for (const r of life) out.push(`| ${r.from}-${r.to} | ${r.years.toFixed(0)} | ${r.deaths} | ${r.years ? (r.deaths / r.years).toFixed(3) : '-'} | ${r.siler.toFixed(3)} | ${r.deaths ? (r.modelled / r.deaths * 100).toFixed(0) + '%' : '-'} |`);
out.push('', 'If the sim\'s rate is well above the measured one at some age, people are being killed twice there (competing risks): the sim\'s own causes on top of a background rate that already includes them.');
console.log(out.join('\n'));
