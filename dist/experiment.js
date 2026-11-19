import { createWorld, step, command, metrics, serialize, deserialize, DAY } from './sim.js';
export const PLAN = {
  version: 5,
  preregistered: {
    primary:
      'Alive at the end of follow-up after a disturbance, paired with the baseline branch on the same seed and condition. An effect is claimed only if the 95% interval of the paired difference over 20 seeds excludes 0.',
    secondary: [
      'Median hunger with each death counted as 100',
      'Known sources and skill with each death counted as 0',
      'Sustained recovery (holds to the end of follow-up)',
    ],
    dependency:
      'Natural (non-gift) food eaten during follow-up after help stops, paired with baseline unchanged; reported per survivor and per creature with the dead counted as 0',
    setBefore: '2026-11-15 13:40 UTC, before any run under this rule',
  },
  branches: ['baseline', 'provision', 'access', 'information', 'ration'],
  failures: { 'berry-failure': 'a', 'root-failure': 'b' },
  withdrawal: true,
  recovery: 'matched-control, median hunger with each death counted as 100',
  seeds: Array.from({ length: 20 }, (_, i) => 41 + i),
  trainingDays: 10,
  followupDays: 10,
  provision: { amount: 40, every: 240, x: 13, y: 13 },
  access: { tick: 0 },
  information: { tick: 0, patch: 'b' },
  recipient: 0,
  failedSource: 'a',
};
export function schedule(s, branch, cont = false) {
  const P = PLAN.provision;
  if (branch === 'provision' && (s.tick < PLAN.trainingDays * DAY || cont) && s.tick % P.every === 0)
    command(s, { type: 'food', x: P.x, y: P.y, amount: P.amount });
  if (branch === 'ration' && s.tick < PLAN.trainingDays * DAY && s.tick % P.every === 0)
    command(s, { type: 'ration', amount: P.amount });
  if (branch === 'access' && s.tick === PLAN.access.tick) command(s, { type: 'bridge' });
  if (branch === 'information' && s.tick === PLAN.information.tick)
    command(s, { type: 'reveal', id: PLAN.recipient, patch: PLAN.information.patch });
  step(s);
}
export function runSeed(seed, config = {}, snapshots = false, progress = () => {}) {
  const rows = [],
    train = PLAN.trainingDays * DAY;
  for (const branch of PLAN.branches) {
    const s = createWorld(seed, config);
    for (let i = 0; i < train; i++) schedule(s, branch);
    const before = metrics(s),
      snapshot = serialize(s),
      controlMax = {};
    const fails = Object.keys(PLAN.failures),
      conds = [
        'unchanged',
        ...fails,
        ...(branch === 'provision' && PLAN.withdrawal ? ['withdrawn', ...fails.map(x => 'withdrawn+' + x)] : []),
        ...(branch === 'provision' ? ['continued-provision', 'continued-provision+berry-failure'] : []),
      ];
    for (const condition of conds) {
      const f = deserialize(snapshot);
      if (condition.startsWith('withdrawn')) command(f, { type: 'withdraw' });
      const fk = fails.find(x => condition.endsWith(x));
      if (fk) command(f, { type: 'failure', patch: PLAN.failures[fk] });
      const disturbed = condition.includes('failure'),
        control = condition.startsWith('withdrawn')
          ? 'withdrawn'
          : condition.startsWith('continued')
            ? 'continued-provision'
            : 'unchanged',
        band = disturbed ? controlMax[control] : null;
      let recovery = null,
        recoveryAlive = null,
        worsened = false,
        maxMed = -Infinity;
      for (let i = 0; i < PLAN.followupDays * DAY; i++) {
        schedule(f, branch, condition.startsWith('continued'));
        if (f.tick % 60 === 0) {
          const m = metrics(f);
          maxMed = Math.max(maxMed, m.medianHungerAll);
          if (!disturbed) continue;
          if (m.medianHungerAll > band) worsened = true;
          if (worsened && recovery === null && m.medianHungerAll <= before.medianHungerAll) {
            recovery = f.tick - train;
            recoveryAlive = m.alive;
          }
        }
      }
      if (!disturbed) controlMax[condition] = maxMed;
      const after = metrics(f),
        sustained = recovery !== null && after.medianHungerAll <= before.medianHungerAll;
      const row = {
        seed,
        branch,
        condition,
        before,
        after,
        controlCondition: disturbed ? control : null,
        controlMaxMedianHunger: band,
        recoveryMinutes: recovery,
        recoveryAlive,
        recoverySustained: disturbed ? sustained : null,
        recoveryNote: !disturbed
          ? 'Not applicable (no disturbance)'
          : sustained
            ? 'Recovered; at or below its day-10 level at the final sample'
            : recovery !== null
              ? 'Recovered temporarily, then worsened'
              : worsened
                ? 'Not recovered'
                : 'No worsening beyond matched control',
      };
      if (snapshots) row.snapshot = serialize(f);
      rows.push(row);
      progress({ seed, branch, condition });
    }
  }
  return rows;
}
export function aggregate(rows) {
  const groups = {};
  for (const r of rows) (groups[r.branch + ' / ' + r.condition] ??= []).push(r);
  return Object.entries(groups).map(([key, rs]) => {
    const h = rs.filter(r => r.after.medianHunger !== null);
    return {
      key,
      runs: rs.length,
      aliveMean: rs.reduce((a, r) => a + r.after.alive, 0) / rs.length,
      aliveMin: Math.min(...rs.map(r => r.after.alive)),
      aliveMax: Math.max(...rs.map(r => r.after.alive)),
      hungerMean: h.length ? h.reduce((a, r) => a + r.after.medianHunger, 0) / h.length : null,
      hungerAllMean: rs.reduce((a, r) => a + r.after.medianHungerAll, 0) / rs.length,
      knownMean: rs.reduce((a, r) => a + r.after.knownSources, 0) / rs.length,
      knownAllMean: rs.reduce((a, r) => a + r.after.knownSourcesAll, 0) / rs.length,
      skillAllMean: rs.reduce((a, r) => a + r.after.skillAll, 0) / rs.length,
      deathsMean: rs.reduce((a, r) => a + r.after.deaths, 0) / rs.length,
      giftedMean: rs.reduce((a, r) => a + r.after.gifted, 0) / rs.length,
      giftLeftAtBranchMean: rs.reduce((a, r) => a + r.before.giftRemaining, 0) / rs.length,
      disturbed: rs[0].condition.includes('failure'),
      recovered: rs.filter(r => r.recoverySustained).length,
      recoveredTemporarily: rs.filter(r => r.recoveryMinutes !== null && !r.recoverySustained).length,
    };
  });
}
