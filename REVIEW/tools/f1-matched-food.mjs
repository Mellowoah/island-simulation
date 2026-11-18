// Grok F1 test (review analysis only; does not change the game or PLAN).
// Provision branch, 20 seeds. After 10 days, berry regrowth fails for 5 days (as in the pilot).
// Arms:
//   pile      — 0.1.3 default: 40 food every 4 h at (13,13); leftovers stay.
//   noPile    — same deliveries, but the leftover pile is removed at day 10 (real withdrawal).
//   ration    — the same 2,400 food handed out as an untracked ration (spread over the living,
//               lowering hunger directly; no pile, no gift patch) during days 0-10.
//   baseline  — no help.
// Reports alive at day 15 (paired vs baseline, mean ± 95% CI) and dead-inclusive median hunger.
import path from 'node:path';
const dist = path.resolve(process.argv[2] ?? 'dist');
const { createWorld, step, command, metrics, DAY, clamp } = await import(dist + '/sim.js');
const P = { amount: 40, every: 240, x: 13, y: 13 }, TRAIN = 10 * DAY, FOLLOW = 5 * DAY;
function run(seed, arm) {
  const s = createWorld(seed);
  for (let i = 0; i < TRAIN; i++) {
    if (s.tick % P.every === 0) {
      if (arm === 'pile' || arm === 'noPile') command(s, { type: 'food', x: P.x, y: P.y, amount: P.amount });
      if (arm === 'ration') { const alive = s.creatures.filter(c => c.alive); for (const c of alive) c.hunger = clamp(c.hunger - P.amount * 4 / alive.length); }
    }
    step(s);
  }
  if (arm === 'noPile') for (const p of s.patches) if (p.gift) p.stock = 0;
  command(s, { type: 'failure', patch: 'a' });
  for (let i = 0; i < FOLLOW; i++) step(s);
  const m = metrics(s);
  return { alive: m.alive, hungerAll: m.medianHungerAll };
}
const arms = ['baseline', 'pile', 'noPile', 'ration'], seeds = Array.from({ length: 20 }, (_, i) => 41 + i), res = {};
for (const a of arms) res[a] = seeds.map(sd => run(sd, a));
const ci = d => { const n = d.length, m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)); return `${m >= 0 ? '+' : ''}${m.toFixed(2)} ± ${(1.96 * sd / Math.sqrt(n)).toFixed(2)}`; };
for (const a of arms) {
  const al = res[a].map(r => r.alive), mean = al.reduce((x, y) => x + y, 0) / al.length;
  const diff = a === 'baseline' ? '—' : ci(al.map((v, i) => v - res.baseline[i].alive));
  const h = res[a].map(r => r.hungerAll).sort((x, y) => x - y);
  console.log(`${a.padEnd(9)} alive ${mean.toFixed(2)} (${Math.min(...al)}–${Math.max(...al)})  paired vs baseline ${diff}  median hunger incl. dead ${((h[9] + h[10]) / 2).toFixed(1)}`);
}
