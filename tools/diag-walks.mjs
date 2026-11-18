// Who walks over 40 km in a day, and are their routes planned over land they have never seen?
import { createWorld2, stepWorld } from '../dist/world.js';
import { clockOf } from '../dist/clock.js';
const seed = +(process.argv[2] ?? 1), years = +(process.argv[3] ?? 10);
const s = createWorld2(seed); s.diag = { routes: [], long: [] };
stepWorld(s, clockOf(s).year * years);
const R = s.diag.routes, L = s.diag.long;
const sum = (a, f) => a.reduce((n, x) => n + f(x), 0);
const byKind = {}; for (const r of R) { const k = (r.explore ? 'explore' : r.k) ?? '?'; (byKind[k] ??= { n: 0, tiles: 0, unseen: 0, anyUnseen: 0 }); const b = byKind[k]; b.n++; b.tiles += r.len; b.unseen += r.unseen; if (r.unseen > 0) b.anyUnseen++; }
console.log(`seed ${seed}, ${years} years: ${R.length} routes, ${L.length} days over 40 km`);
for (const [k, b] of Object.entries(byKind)) console.log(`  ${k}: ${b.n} routes, ${(100 * b.unseen / Math.max(1, b.tiles)).toFixed(1)}% of tiles unseen, ${(100 * b.anyUnseen / b.n).toFixed(1)}% of routes cross unseen land`);
const per = {}; for (const l of L) per[l.id] = (per[l.id] ?? 0) + 1;
const counts = Object.values(per).sort((a, b) => b - a);
console.log(`  long days by person: ${counts.length} people; most by one person ${counts[0] ?? 0}; people with 3+: ${counts.filter(c => c >= 3).length}`);
// for long days: share of that day's routes over unseen land
const key = l => `${l.id}:${l.day}`, longSet = new Set(L.map(key));
const lr = R.filter(r => longSet.has(key(r)) || longSet.has(`${r.id}:${r.day + 1}`));
console.log(`  routes on long days: ${lr.length}, unseen share ${(100 * sum(lr, r => r.unseen) / Math.max(1, sum(lr, r => r.len))).toFixed(1)}%, kinds ${JSON.stringify(lr.filter(r => r.unseen > 0).reduce((o, r) => (o[r.explore ? 'explore' : r.k] = (o[r.explore ? 'explore' : r.k] ?? 0) + 1, o), {}))}`);
console.log(`  long-day km: median ${L.map(l => l.km).sort((a, b) => a - b)[L.length >> 1]?.toFixed(1)}, ages ${L.map(l => Math.round(l.age)).sort((a, b) => a - b).join(',').slice(0, 200)}`);
const agg = {}; for (const l of L) for (const [k, v] of Object.entries(l.k ?? {})) agg[k] = (agg[k] ?? 0) + v;
console.log('  tiles on long days by purpose:', JSON.stringify(agg), ' (tiles not in routes = hunting stalks)');
for (const l of L.slice(0, 5)) console.log('   ', l.km.toFixed(0), 'km', JSON.stringify(l.k));
