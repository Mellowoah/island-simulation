// Small canvas line charts for Island Lab. No dependencies. Reads samples only.
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

// series: [{ label, color, values: [number|null] }], xs: [number] (same length), opts: { yMax, unit, xLabel, marks: [{ x, label }] }
export function drawLineChart(g, w, h, xs, series, opts = {}) {
  if (!g) return null;
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const all = series.flatMap(s => s.values).filter(v => v !== null && Number.isFinite(v));
  const yMax = opts.yMax ?? niceMax(Math.max(1, ...all));
  const x0 = xs[0] ?? 0, x1 = Math.max(xs.at(-1) ?? 1, x0 + 1e-9);
  const X = x => pad.l + (x - x0) / (x1 - x0) * (w - pad.l - pad.r), Y = y => h - pad.b - Math.min(1, Math.max(0, y / yMax)) * (h - pad.t - pad.b);
  g.setTransform?.(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#101a2e'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2c3d63'; g.lineWidth = 1; g.font = '10px monospace'; g.fillStyle = '#a9b4cf';
  for (let i = 0; i <= 4; i++) { const y = Y(yMax * i / 4); g.beginPath(); g.moveTo(pad.l, Math.round(y) + 0.5); g.lineTo(w - pad.r, Math.round(y) + 0.5); g.stroke(); g.fillText(fmtTick(yMax * i / 4), 2, y + 3); }
  const xt = opts.xTicks ?? 5;
  for (let i = 0; i <= xt; i++) { const xv = x0 + (x1 - x0) * i / xt; g.fillText(fmtTick(xv), Math.min(w - 22, X(xv) - 6), h - 6); }
  for (const m of opts.marks ?? []) {
    if (m.x < x0 || m.x > x1) continue;
    g.strokeStyle = '#ffd84a'; g.setLineDash?.([3, 3]); g.beginPath(); g.moveTo(Math.round(X(m.x)) + 0.5, pad.t); g.lineTo(Math.round(X(m.x)) + 0.5, h - pad.b); g.stroke(); g.setLineDash?.([]);
    g.fillStyle = '#ffd84a'; g.fillText(m.label, Math.min(w - 60, X(m.x) + 3), pad.t + 10);
  }
  for (const s of series) {
    g.strokeStyle = s.color; g.lineWidth = 2; g.beginPath(); let pen = false;
    s.values.forEach((v, i) => { if (v === null || !Number.isFinite(v)) { pen = false; return; } const x = X(xs[i]), y = Y(v); if (pen) g.lineTo(x, y); else { g.moveTo(x, y); pen = true; } });
    g.stroke();
  }
  return { yMax, x0, x1 };
}
const fmtTick = v => Math.abs(v) >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Number.isInteger(v) ? String(v) : v.toFixed(1);

// Chart definitions. Each has a plain-English caption so a non-scientist can read it.
export function chartSpecs(kind, rows, meta = {}) {
  const per = kind === 'eden' ? 'year' : 'day';
  const xs = rows.map(r => r.t / 1440);
  const fall = meta.fallTick != null ? [{ x: meta.fallTick / 1440, label: 'fall' }] : [];
  const helpStop = meta.helpStop != null ? [{ x: meta.helpStop / 1440, label: 'help stops' }] : [];
  const col = (k) => rows.map(r => r[k] ?? null);
  if (kind === 'lab') return [
    { id: 'pop', title: 'Population', caption: 'How many creatures are alive.', xs, series: [{ label: 'alive', color: '#7fd88f', values: col('pop') }], opts: { xLabel: per } },
    { id: 'trust', title: 'Average trust', caption: 'How much creatures trust each other on average (0 to 100). It falls when what they were told turns out false.', xs, series: [{ label: 'trust', color: '#7fc4ff', values: col('trust') }], opts: { yMax: 100 } },
    { id: 'food', title: 'Food on the island', caption: 'Total food waiting in bushes and gardens.', xs, series: [{ label: 'food', color: '#ffb36b', values: col('food') }], opts: {} },
    { id: 'deceiver', title: 'False messages', caption: 'Running count of messages passed on (white) and how many were false (red). The Lab island has no deceiver at a tree.', xs, series: [{ label: 'sent', color: '#f2efe2', values: col('sent') }, { label: 'false', color: '#ff7a7a', values: col('falseSent') }], opts: {} },
    { id: 'survival', title: 'Survival after release', caption: 'Not shown: the Lab island has no release. Use the Eden test.', xs, series: [], opts: {}, empty: true },
    { id: 'differ', title: 'How much they differ', caption: 'How spread out trust is between creatures (higher = they differ more).', xs, series: [{ label: 'trust spread', color: '#d9a6ff', values: col('spread') }], opts: {} },
    { id: 'bar', title: 'The moving bar', caption: 'Average hardship (orange, 0 to 100), the creatures\' own bar (white: what each is used to), and the share above their own bar (red, %). Measure only; creatures do not act on it.', xs, series: [{ label: 'hardship', color: '#ffb36b', values: col('hard') }, { label: 'their bar', color: '#f2efe2', values: col('bar') }, { label: '% above bar', color: '#ff7a7a', values: col('over') }], opts: { yMax: 100 } },
  ];
  return [
    { id: 'pop', title: 'Population', caption: 'Creatures alive each year. Before the fall no one dies; after it, deaths begin.', xs, series: [{ label: 'alive', color: '#7fd88f', values: col('pop') }], opts: { marks: [...fall, ...helpStop] } },
    { id: 'trust', title: 'Belief in the deceiver', caption: 'Average belief in the deceiver\'s claim, 0 to 100. Eden has no trust score between creatures; this is the closest thing: how far the deceiver\'s doubt has taken hold.', xs, series: [{ label: 'belief', color: '#7fc4ff', values: col('belief') }], opts: { yMax: 100, marks: fall } },
    { id: 'food', title: 'Food on the island', caption: 'Total food waiting in the groves, fields and any food you left.', xs, series: [{ label: 'food', color: '#ffb36b', values: col('food') }], opts: { marks: [...fall, ...helpStop] } },
    { id: 'deceiver', title: 'When the deceiver spoke', caption: 'Running count of times the deceiver spoke (white) and of anyone eating (red; at most one, because the first eating releases everyone).', xs, series: [{ label: 'spoke', color: '#f2efe2', values: col('hearings') }, { label: 'ate', color: '#ff7a7a', values: col('ate') }], opts: { marks: fall } },
    { id: 'survival', title: 'Survival after release', caption: 'Of the creatures alive at the fall, the share still alive (%). Starts at 100 at the fall.', xs, series: [{ label: 'still alive', color: '#ffe680', values: col('cohort') }], opts: { yMax: 100, marks: fall } },
    { id: 'differ', title: 'How much they differ', caption: 'How different their own habits are (purple) and how spread out their curiosity is (green), 0 to 100. Habits only start forming after release.', xs, series: [{ label: 'habits', color: '#d9a6ff', values: col('habit') }, { label: 'curiosity', color: '#9fe6a0', values: col('curiosity') }], opts: { marks: fall } },
    { id: 'bar', title: 'The moving bar', caption: 'Average hardship (orange, 0 to 100), the creatures\' own bar (white: what each is used to), and the share above their own bar (red, %). Measure only; creatures do not act on it.', xs, series: [{ label: 'hardship', color: '#ffb36b', values: col('hard') }, { label: 'their bar', color: '#f2efe2', values: col('bar') }, { label: '% above bar', color: '#ff7a7a', values: col('over') }], opts: { yMax: 100, marks: [...fall, ...helpStop] } },
  ];
}
