// Regenerates the experiment summary from results/*.json (run `npm run experiment` first).
// Paired differences vs the baseline branch, same seed and condition, with t intervals (df = n-1).
// Usage: node REVIEW/tools/summarize.mjs > REVIEW/logs/experiment-summary.txt
import fs from 'node:fs';
const T = { 19: 2.093, 4: 2.776 };
const ci = d => { const n = d.length, m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)), h = (T[n - 1] ?? 1.96) * sd / Math.sqrt(n); return { m, h, text: `${m >= 0 ? '+' : ''}${m.toFixed(2)} ± ${h.toFixed(2)}${Math.abs(m) > h ? ' *' : ''}` }; };
let intervals = 0, excluding = 0;
for (const f of fs.readdirSync('results').filter(f => f.endsWith('.json') && f !== 'summary.json').sort()) {
  const r = JSON.parse(fs.readFileSync('results/' + f)), by = (b, c) => r.rows.filter(x => x.branch === b && x.condition === c);
  console.log(`\n## ${f.replace('.json', '')} (${r.seeds.length} seeds ${r.seeds[0]}–${r.seeds.at(-1)}, plan v${r.plan.version}) — alive at end, paired vs baseline branch (t interval; * excludes 0)`);
  for (const cond of Object.keys(r.plan.failures ?? { 'berry-failure': 'a' })) {
    const base = by('baseline', cond).map(x => x.after.alive); let line = `  ${cond}: baseline ${(base.reduce((a, b) => a + b, 0) / base.length).toFixed(2)}`;
    for (const [b, c, label] of [['provision', cond, 'provision'], ['provision', 'withdrawn+' + cond, 'provision-withdrawn'], ['access', cond, 'access'], ['information', cond, 'information'], ['ration', cond, 'ration']]) {
      const a = by(b, c).map(x => x.after.alive); if (!a.length) continue;
      const k = ci(a.map((v, i) => v - base[i])); intervals++; if (Math.abs(k.m) > k.h) excluding++; line += ` | ${label} ${k.text}`;
    }
    console.log(line);
  }
  const nat = (x, perSurvivor) => { let n = 0; x.after.individuals.forEach((a, i) => { const b = x.before.individuals[i]; n += (a.consumed - b.consumed) - (a.giftConsumed - b.giftConsumed); }); return n / (perSurvivor ? Math.max(1, x.after.alive) : x.after.individuals.length); };
  const b0 = by('baseline', 'unchanged');
  for (const [b, c, label] of [['provision', 'withdrawn', 'provision, pile withdrawn'], ['ration', 'unchanged', 'ration'], ['access', 'unchanged', 'access'], ['information', 'unchanged', 'information']]) {
    const v = by(b, c); if (!v.length) continue;
    console.log(`  dependency (natural food eaten after help stops, vs baseline) ${label}: per survivor ${ci(v.map((x, i) => nat(x, true) - nat(b0[i], true))).text}; per creature, dead as 0: ${ci(v.map((x, i) => nat(x, false) - nat(b0[i], false))).text}`);
  }
}
console.log(`\n${intervals} survival intervals reported; ${excluding} exclude 0. With this many comparisons about ${(intervals * 0.05).toFixed(1)} would exclude 0 by chance alone, and the pre-registered rule was set after these runs. Treat every starred result as a hypothesis until re-run on fresh seeds.`);
