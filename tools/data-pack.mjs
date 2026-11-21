// Writes the data pack for outside review: every setting, and what each run produced.
// Usage: node tools/data-pack.mjs <variant> <outDir>   (one variant per process; see REVIEW/data-pack/README.md)
import { writeFileSync } from 'node:fs';
import { DEFAULTS, STREAMS } from '../dist/frozen/sim.js';
import { EDEN_DEFAULTS } from '../dist/frozen/eden.js';
import { LAB_DEFAULTS } from '../dist/frozen/lab.js';
import { runToEnd } from '../dist/frozen/lab16-run.js';
import { summarizeEden, summarizeLab } from '../dist/frozen/lab16-report.js';
import { normalizeSetup, HELP } from '../dist/frozen/lab16-setup.js';

export const SEEDS = Array.from({ length: 20 }, (_, i) => 61 + i), YEARS = 20, LAB_DAYS = 10;
export const VARIANTS = {
  base: { world: 'eden' }, guidance50: { world: 'eden', guidance: 0.5 }, guidance0: { world: 'eden', guidance: 0 }, help: { world: 'eden', help: true },
  wayback: { world: 'eden', restoration: true }, wayback_demons3: { world: 'eden', restoration: true, tempters: 3 }, demons3: { world: 'eden', tempters: 3 },
  lab_base: { world: 'lab' }, lab_scarce: { world: 'lab', food: 15, regrowth: 0.0075 }, lab_scarce_notalk: { world: 'lab', food: 15, regrowth: 0.0075, talk: false }, lab_scarce_lies25: { world: 'lab', food: 15, regrowth: 0.0075, falseInfo: 0.25 },
};
const [, , variant, out] = process.argv;
if (variant === 'params') {
  writeFileSync(`${out}/parameters.json`, JSON.stringify({ seeds: SEEDS, edenYears: YEARS, labDays: LAB_DAYS, variants: VARIANTS, help: HELP, sim: DEFAULTS, eden: EDEN_DEFAULTS, lab: LAB_DEFAULTS, randomStreams: STREAMS, defaultSetup: { eden: normalizeSetup({ world: 'eden' }), lab: normalizeSetup({ world: 'lab' }) } }, null, 2));
} else {
  const v = VARIANTS[variant], isLab = v.world === 'lab', rows = [], choices = [];
  const r3 = n => n === null || n === undefined ? '' : typeof n === 'number' ? Math.round(n * 1000) / 1000 : n;
  for (const seed of SEEDS) {
    const run = runToEnd({ ...v, seed, runDays: isLab ? LAB_DAYS : YEARS });
    if (isLab) { const m = summarizeLab(run); rows.push([variant, seed, m.population, m.deaths, m.trustStart, m.trustEnd, m.trustSpread, m.knowledge, m.sent, m.accepted, m.falseSent, m.verifiedFalse, m.verifiedTrue, m.food, m.hardStart, m.hardEnd, m.barEnd, m.overEnd].map(r3).join(',')); continue; }
    const m = summarizeEden(run), R = m.restored ?? {}, D = m.deathCauses;
    rows.push([variant, seed, m.fell ? 1 : 0, m.fallYear, m.firstEater ?? '', m.hearings, m.meanChance, m.minChance, m.maxChance, m.guidedShare, m.overrides, m.decisions, m.cohortSize, m.cohortByYear[1], m.cohortByYear[3], m.cohortEnd, m.population, m.births, m.deaths, D['Sustained food deprivation'] ?? 0, D['Thirst'] ?? 0, D['Injury and illness'] ?? 0,
      m.ownLater, m.gifted, m.giftEaten, m.fields, m.clothed, m.tools, m.habitAfter, m.hardGuided, m.hardReleased, m.overGuided, m.overReleased, m.hardEnd, m.barEnd, m.overEnd, R.calls, R.returned, R.left, R.bread, R.whispers, R.living, R.ledShare, R.deathsRestored, m.hardRestored, m.hardOthers].map(r3).join(','));
    for (const d of run.world.eden.deliberations) choices.push([variant, seed, 'tree', d.tick, d.id, r3(d.food), r3(d.eye), r3(d.wisdom), r3(d.warning), '', r3(d.U), d.P, d.draw, d.ate ? 1 : 0].join(','));
    for (const a of run.world.eden.restored?.answers ?? []) choices.push([variant, seed, a.kind, a.tick, a.id, r3(a.kind === 'call' ? a.need : a.food), '', r3(a.kind === 'call' ? a.doubt : a.wisdom), r3(a.kind === 'call' ? a.word : a.warning), '', r3(a.U), a.P, a.draw, a.yes ? 1 : 0].join(','));
  }
  writeFileSync(`${out}/part-${variant}.csv`, rows.join('\n') + '\n');
  if (choices.length) writeFileSync(`${out}/choices-${variant}.csv`, choices.join('\n') + '\n');
}
