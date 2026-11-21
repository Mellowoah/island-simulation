// Island Lab batch test: the same choices on many seeds, compared pair by pair.
// Pure arithmetic on run summaries. It runs nothing itself and changes no world.

// Two-sided 95% t values by degrees of freedom (n - 1).
const T95 = [
  null,
  12.706,
  4.303,
  3.182,
  2.776,
  2.571,
  2.447,
  2.365,
  2.306,
  2.262,
  2.228,
  2.201,
  2.179,
  2.16,
  2.145,
  2.131,
  2.12,
  2.11,
  2.101,
  2.093,
  2.086,
  2.08,
  2.074,
  2.069,
  2.064,
  2.06,
  2.056,
  2.052,
  2.048,
  2.045,
  2.042,
];
export const t95 = df => (df < 1 ? null : T95[Math.min(df, 30)]);
const r1 = n => Math.round(n * 10) / 10;

export function batchSeeds(seed, n) {
  return Array.from({ length: n }, (_, i) => ((seed - 1 + i) % 999999) + 1);
}

// Paired differences (a - b, one per seed). Seeds where either side has no value are left out and counted.
export function paired(pairs) {
  const d = pairs
    .filter(([a, b]) => a != null && b != null && Number.isFinite(a) && Number.isFinite(b))
    .map(([a, b]) => a - b);
  const n = d.length,
    skipped = pairs.length - n;
  if (!n)
    return { n, skipped, mean: null, sd: null, lo: null, hi: null, up: 0, down: 0, same: 0, meanA: null, meanB: null };
  const ok = pairs.filter(([a, b]) => a != null && b != null && Number.isFinite(a) && Number.isFinite(b));
  const mean = d.reduce((x, y) => x + y, 0) / n;
  const sd = n > 1 ? Math.sqrt(d.reduce((x, y) => x + (y - mean) ** 2, 0) / (n - 1)) : null;
  const half = n > 1 ? (t95(n - 1) * sd) / Math.sqrt(n) : null;
  return {
    n,
    skipped,
    mean,
    sd,
    lo: half === null ? null : mean - half,
    hi: half === null ? null : mean + half,
    up: d.filter(x => x > 1e-9).length,
    down: d.filter(x => x < -1e-9).length,
    same: d.filter(x => Math.abs(x) <= 1e-9).length,
    meanA: ok.reduce((x, p) => x + p[0], 0) / n,
    meanB: ok.reduce((x, p) => x + p[1], 0) / n,
  };
}

// 'held': the whole 95% range is on the predicted side. 'against': the whole range is on the other side.
// 'unclear': the range includes zero, or there are too few seeds to say.
export function batchVerdict(st, higherIsBetter) {
  if (st.n < 3 || st.lo === null) return 'unclear';
  if (st.lo > 0) return higherIsBetter ? 'held' : 'against';
  if (st.hi < 0) return higherIsBetter ? 'against' : 'held';
  return 'unclear';
}

const row = (id, text, aLabel, bLabel, unit, higherIsBetter, pairs, note = null) => {
  const st = paired(pairs);
  return {
    id,
    text,
    aLabel,
    bLabel,
    unit,
    higherIsBetter,
    ...st,
    verdict: higherIsBetter === null ? 'measured' : batchVerdict(st, higherIsBetter),
    note,
  };
};

// rows: [{ seed, main, g, h }] — summaries of the chosen world, its guidance twin and its help twin.
export function batchEden(rows) {
  const more = r => (r.main.guidance >= r.g.guidance ? r.main : r.g),
    less = r => (r.main.guidance >= r.g.guidance ? r.g : r.main);
  const on = r => (r.main.help ? r.main : r.h),
    off = r => (r.main.help ? r.h : r.main);
  const pc = x => `guided ${Math.round(x * 100)}% of the time`;
  const gA = pc(more(rows[0]).guidance),
    gB = pc(less(rows[0]).guidance);
  const surv = r => {
    const k = Math.min(more(r).survivalYears, less(r).survivalYears);
    return k >= 1 ? [more(r).cohortByYear[k], less(r).cohortByYear[k]] : [null, null];
  };
  const way = rows[0].r
    ? [
        row(
          'Way back·lives',
          'Creatures alive at the end, with a way back vs without (measured only).',
          'way back',
          'no way back',
          ' alive',
          null,
          rows.map(r => [r.main.population, r.r.population]),
        ),
        row(
          'Way back·deaths',
          'Deaths over the run, with a way back vs without (measured only).',
          'way back',
          'no way back',
          ' deaths',
          null,
          rows.map(r => [r.main.deaths, r.r.deaths]),
          'The restored are fed by rule, so fewer deaths from want among them is built in. Deaths among the rest are not.',
        ),
        row(
          'Way back·turned',
          'Share of the living who are restored at the end (measured only; the other world has none by definition).',
          'way back',
          'no way back',
          '%',
          null,
          rows.map(r => [r.main.population ? (r.main.restored.living / r.main.population) * 100 : null, 0]),
        ),
      ]
    : [];
  const dem = rows[0].d
    ? [
        row(
          'Demons·turned',
          'Share of the living who are restored at the end, with demons vs without (measured only).',
          'with demons',
          'no demons',
          '%',
          null,
          rows.map(r => [
            r.main.population ? ((r.main.restored?.living ?? 0) / r.main.population) * 100 : null,
            r.d.population ? ((r.d.restored?.living ?? 0) / r.d.population) * 100 : null,
          ]),
        ),
        row(
          'Demons·lives',
          'Creatures alive at the end, with demons vs without (measured only).',
          'with demons',
          'no demons',
          ' alive',
          null,
          rows.map(r => [r.main.population, r.d.population]),
        ),
      ]
    : [];
  return [
    ...way,
    ...dem,
    row(
      'P1',
      'Creatures guided more are less likely to eat when the deceiver speaks.',
      gA,
      gB,
      '%',
      false,
      rows.map(r => [more(r).meanChance, less(r).meanChance]),
      'Average chance of eating each time the deceiver spoke.',
    ),
    row(
      'P2',
      'Populations guided more before the fall survive the first years after release better.',
      gA,
      gB,
      '%',
      true,
      rows.map(surv),
      'Share of those alive at the fall who were still alive up to 3 years later. Seeds where either world never fell are left out.',
    ),
    row(
      'P5',
      'Help builds later ability to get food.',
      'with help',
      'without help',
      ' food',
      true,
      rows.map(r => [on(r).ownLater, off(r).ownLater]),
      'Food gathered from the island itself in the second half of the run, per creature per year.',
    ),
    row(
      'Fall',
      'When the fall came (no prediction; measured only).',
      gA,
      gB,
      ' years',
      null,
      rows.map(r => [more(r).fallYear, less(r).fallYear]),
      'Year of the first eating. Seeds where either world never fell are left out.',
    ),
    row(
      'Bar·help',
      'Moving bar: share of creatures above their own bar at the end (no prediction; measured only).',
      'with help',
      'without help',
      '%',
      null,
      rows.map(r => [on(r).overEnd, off(r).overEnd]),
      "The bar is each creature's own recent average hardship. This asks whether help leaves fewer creatures feeling worse off than they are used to.",
    ),
    row(
      'Bar·guidance',
      'Moving bar: actual hardship at the end (no prediction; measured only).',
      gA,
      gB,
      ' pts',
      null,
      rows.map(r => [more(r).hardEnd, less(r).hardEnd]),
      'Average hardship of the living at the end, 0 to 100.',
    ),
  ];
}

// rows: [{ seed, main, talk, lies }] — the chosen Lab island, the same island with telling flipped, and (if lies were on) with no lies.
export function batchLab(rows) {
  const on = r => (r.main.talk ? r.main : r.talk),
    off = r => (r.main.talk ? r.talk : r.main);
  const out = [
    row(
      'Telling·lives',
      'Creatures alive at the end, when they can tell each other things vs when they cannot (measured only).',
      'telling on',
      'telling off',
      ' alive',
      null,
      rows.map(r => [on(r).population, off(r).population]),
    ),
    row(
      'Telling·knowledge',
      'Share of real food sources each creature knows (measured only).',
      'telling on',
      'telling off',
      '%',
      null,
      rows.map(r => [on(r).knowledge, off(r).knowledge]),
    ),
    row(
      'Telling·bar',
      'Moving bar: actual hardship at the end (measured only).',
      'telling on',
      'telling off',
      ' pts',
      null,
      rows.map(r => [on(r).hardEnd, off(r).hardEnd]),
    ),
  ];
  if (rows[0].lies)
    out.push(
      row(
        'Lies·trust',
        'Average trust at the end, with your level of false information vs none (measured only).',
        'with lies',
        'no lies',
        ' pts',
        null,
        rows.map(r => [r.main.trustEnd, r.lies.trustEnd]),
      ),
      row(
        'Lies·lives',
        'Creatures alive at the end, with your level of false information vs none (measured only).',
        'with lies',
        'no lies',
        ' alive',
        null,
        rows.map(r => [r.main.population, r.lies.population]),
      ),
    );
  return out;
}

const word = v => ({ held: 'HELD', against: 'WENT THE OTHER WAY', unclear: 'NOT CLEAR', measured: 'MEASURED' })[v];
const sign = n => (n > 0 ? '+' : '') + r1(n);
const dUnit = u => (u === '%' ? ' percentage points' : u);
export function batchLine(x) {
  if (!x.n) return 'No seed gave a value for both worlds, so there is nothing to compare.';
  const range = x.lo === null ? '' : `; likely range ${sign(x.lo)} to ${sign(x.hi)}`;
  return `${x.aLabel}: ${r1(x.meanA)}${x.unit}. ${x.bLabel}: ${r1(x.meanB)}${x.unit}. Average gap ${sign(x.mean)}${dUnit(x.unit)}${range}. Higher in ${x.up} of ${x.n} islands, lower in ${x.down}, equal in ${x.same}${x.skipped ? ` (${x.skipped} left out)` : ''}.`;
}
export const BATCH_METHOD =
  'Each island is run twice with the same seed, differing in one choice only, and the gap is taken island by island. Dead creatures stay in the counts. "Likely range" is a 95% range for the average gap (paired t). A prediction is HELD only if the whole range is on the predicted side, WENT THE OTHER WAY if the whole range is on the other side, and NOT CLEAR if the range includes zero. Several lines are checked at once, so one clear line among many can still be luck.';

export function batchMarkdown(b) {
  const L = [`## Batch test: ${b.seeds.length} islands (seeds ${b.seeds[0]} to ${b.seeds.at(-1)})`, ''];
  for (const x of b.rows)
    L.push(`### ${x.id}: ${word(x.verdict)}`, '', x.text, '', batchLine(x), '', ...(x.note ? [`_${x.note}_`, ''] : []));
  L.push(BATCH_METHOD, '');
  return L.join('\n');
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function batchHTML(b) {
  const color = v =>
    v === 'held' ? '#7fd88f' : v === 'against' ? '#ff9a8a' : v === 'measured' ? '#9fd4ff' : '#e9d38f';
  return (
    `<h2>Batch test: ${b.seeds.length} islands (seeds ${b.seeds[0]} to ${b.seeds.at(-1)})</h2>` +
    b.rows
      .map(
        x =>
          `<section class="pred"><h3>${esc(x.id)} <span class="v" style="color:${color(x.verdict)}">${word(x.verdict)}</span></h3><p>${esc(x.text)}</p><p>${esc(batchLine(x))}</p>${x.note ? `<p class="m">${esc(x.note)}</p>` : ''}</section>`,
      )
      .join('\n') +
    `<p class="m">${esc(BATCH_METHOD)}</p>`
  );
}
