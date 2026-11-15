// 20 fresh seeds for the moving-bar prototype. Reads nothing from results.
// Pre-registration: docs/PROTO-MOVING-BAR.md. Do not edit defaults after seeing this output.
// Usage: node REVIEW/tools/moving-bar-experiment.mjs
import fs from 'node:fs';
import { runMovingBar } from '../../dist/eden.js';

const SEEDS = Array.from({ length: 20 }, (_, i) => 61 + i);
const T = { 1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228, 11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086, 21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 29: 2.045 };

const ARMS = [
  ['drift', { condition: 'drift', rho: 0.7 }],
  ['anchor', { condition: 'anchor', rho: 0.7 }],
  ['peer', { condition: 'peer', rho: 0.7 }],
  ['ablation', { condition: 'ablation', rho: 0.7 }],
  ['drift-rho0', { condition: 'drift', rho: 0 }],
  ['drift-rho05', { condition: 'drift', rho: 0.5 }],
  ['drift-rho1', { condition: 'drift', rho: 1 }],
  ['anchor-rho0', { condition: 'anchor', rho: 0 }],
  ['anchor-rho05', { condition: 'anchor', rho: 0.5 }],
  ['anchor-rho1', { condition: 'anchor', rho: 1 }],
  ['peer-rho0', { condition: 'peer', rho: 0 }],
  ['peer-rho05', { condition: 'peer', rho: 0.5 }],
  ['peer-rho1', { condition: 'peer', rho: 1 }],
  ['drift-nodrift', { condition: 'drift', rho: 0.7, driftHalfLife: Infinity }],
  ['peer-nomonitor', { condition: 'peer', rho: 0.7, monitorWeight: 0 }],
  ['felt-rho0', { condition: 'anchor', rho: 0, signal: 'felt' }],
  ['felt-rho1', { condition: 'anchor', rho: 1, signal: 'felt' }],
];

const ci = ds => {
  const n = ds.length;
  if (n < 2) return { n, m: null, h: null, excludes: false, text: `n=${n}` };
  const m = ds.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(ds.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1));
  const h = (T[n - 1] ?? 1.96) * sd / Math.sqrt(n);
  const excludes = Math.abs(m) > h;
  const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(4);
  return { n, m, sd, h, lo: m - h, hi: m + h, excludes, text: `${fmt(m)} ± ${h.toFixed(4)}${excludes ? ' *' : ''}` };
};

const rows = [];
const t0 = Date.now();
let done = 0;
for (const seed of SEEDS) {
  const falls = {};
  for (const [arm, spec] of ARMS) {
    const started = Date.now();
    const { report } = runMovingBar(seed, spec);
    falls[arm] = report.fallTick;
    rows.push({ arm, spec: { ...spec, driftHalfLife: spec.driftHalfLife === Infinity ? null : (spec.driftHalfLife ?? 360) }, ms: Date.now() - started, ...report });
    done++;
    if (done % 20 === 0) console.error(`… ${done}/${SEEDS.length * ARMS.length}  seed ${seed} ${arm}  ${(Date.now() - t0) / 1000 | 0}s`);
  }
  const fallSet = new Set(Object.values(falls));
  if (fallSet.size !== 1) console.error(`FALL MISMATCH seed ${seed}: ${JSON.stringify(falls)}`);
}

const by = arm => rows.filter(r => r.arm === arm && !r.excluded);
const pair = (a, b, field) => {
  const A = new Map(by(a).map(r => [r.seed, r]));
  const ds = [];
  for (const r of by(b)) if (A.has(r.seed) && r[field] != null && A.get(r.seed)[field] != null) ds.push(A.get(r.seed)[field] - r[field]);
  return ci(ds);
};
const meanOf = (arm, field) => {
  const xs = by(arm).map(r => r[field]).filter(v => v != null);
  return { n: xs.length, m: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null };
};

const summary = {
  version: '0.4.0-proto',
  seeds: SEEDS,
  arms: ARMS.map(([arm, spec]) => arm),
  excluded: rows.filter(r => r.excluded).map(r => ({ seed: r.seed, arm: r.arm, fallTick: r.fallTick, tick: r.tick })),
  detection: Object.fromEntries(ARMS.map(([arm]) => [arm, meanOf(arm, 'detection')])),
  contrasts: {
    'P-a drift − anchor': pair('drift', 'anchor', 'detection'),
    'P-b peer − drift': pair('peer', 'drift', 'detection'),
    'P-c drift rho1 − rho0': pair('drift-rho1', 'drift-rho0', 'detection'),
    'check anchor rho1 − rho0': pair('anchor-rho1', 'anchor-rho0', 'detection'),
    'check peer rho1 − rho0': pair('peer-rho1', 'peer-rho0', 'detection'),
    'P-a region nodrift − anchor': pair('drift-nodrift', 'anchor', 'detection'),
    'P-b region nomonitor − drift': pair('peer-nomonitor', 'drift', 'detection'),
    'P-c region felt rho1 − rho0': pair('felt-rho1', 'felt-rho0', 'detection'),
  },
  secondary: {},
};
for (const field of ['deaths', 'hazardDeathShare', 'harmPerExposure', 'avoidanceCostMean', 'benefitMean', 'treeDeaths', 'exposuresMean', 'payers', 'beneficiaries']) {
  summary.secondary[field] = {
    means: Object.fromEntries(['drift', 'anchor', 'peer', 'ablation'].map(arm => [arm, meanOf(arm, field)])),
    'drift − anchor': pair('drift', 'anchor', field),
    'peer − drift': pair('peer', 'drift', field),
    'anchor − ablation': pair('anchor', 'ablation', field),
  };
}

fs.mkdirSync('REVIEW/results', { recursive: true });
fs.writeFileSync('REVIEW/results/moving-bar-v040.json', JSON.stringify({ summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
console.error(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s, rows ${rows.length}, excluded ${summary.excluded.length}`);
