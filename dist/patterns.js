// Island: the real-world patterns the model is scored against (research plan, remedies 1-3), and how each is measured
// in a finished world. Each pattern: observed value z, its uncertainty (sd), source, and set:
//   calibration: may be looked at while fixing the model;
//   heldout: chosen before being looked at in the model; scored only at a release check (tools/score.mjs --release).
// Patterns already examined while fixing (child deaths, meat share, kills, day ranges) are calibration, honestly.
// Sources: Marlowe 2010 (The Hadza); Pontzer et al. 2012; Hawkes et al. 1997; Blurton Jones 2016 (Demography and
// Evolutionary Ecology of Hadza Hunter-Gatherers); Gurven and Kaplan 2007; the Hadza Siler fit already in the model.
// Values to be checked against the originals before the release check (marked in docs/ANOMALIES.md if they differ).
export const PATTERNS = [
  { id: 'dayKmF', set: 'calibration', z: 5.8, sd: 1.2, unit: 'km/day', what: "women's day range", src: 'Pontzer et al. 2012; Marlowe 2010' },
  { id: 'dayKmM', set: 'calibration', z: 11.4, sd: 2.5, unit: 'km/day', what: "men's day range", src: 'Pontzer et al. 2012; Marlowe 2010' },
  { id: 'gatherH', set: 'calibration', z: 4.0, sd: 1.0, unit: 'h/day', what: 'adult gathering hours', src: 'Hawkes et al. 1997 (women about 4 h)' },
  { id: 'q0', set: 'calibration', z: 0.21, sd: 0.04, unit: 'per year', what: 'infant death rate', src: 'Blurton Jones 2016; Siler fit' },
  { id: 'm1to5', set: 'calibration', z: 0.035, sd: 0.015, unit: 'per year', what: 'death rate age 1-5', src: 'Siler fit' },
  { id: 'm5to10', set: 'calibration', z: 0.011, sd: 0.006, unit: 'per year', what: 'death rate age 5-10', src: 'Siler fit' },
  { id: 'm20to40', set: 'calibration', z: 0.011, sd: 0.005, unit: 'per year', what: 'death rate age 20-40', src: 'Siler fit' },
  { id: 'illnessShare', set: 'calibration', z: 0.70, sd: 0.10, unit: 'share', what: 'deaths from illness', src: 'Gurven and Kaplan 2007' },
  { id: 'campSize', set: 'calibration', z: 29, sd: 8, unit: 'people', what: 'residential camp size', src: 'Marlowe 2010; Current Anthropology 2010 table 3 (29.3)' },
  { id: 'meatShare', set: 'calibration', z: 0.30, sd: 0.10, unit: 'share of kcal', what: 'meat in the diet', src: 'Marlowe 2010 (approx.)' },
  // held out: not looked at in the model before the release check
  { id: 'tfr', set: 'heldout', z: 6.2, sd: 1.0, unit: 'births per woman', what: 'total fertility', src: 'Blurton Jones 2016' },
  { id: 'ibi', set: 'heldout', z: 3.4, sd: 0.6, unit: 'years', what: 'interval between births', src: 'Marlowe 2010; Blurton Jones 2016' },
  { id: 'afb', set: 'heldout', z: 19, sd: 2, unit: 'years', what: "mothers' age at first birth", src: 'Marlowe 2010; Blurton Jones 2016' },
  { id: 'growth', set: 'heldout', z: 0.013, sd: 0.01, unit: 'per year', what: 'population growth rate', src: 'Blurton Jones 2016' },
  { id: 'campMoves', set: 'heldout', z: 7, sd: 3, unit: 'per band-year', what: 'camp moves', src: 'Current Anthropology 2010 table 3 (7)' },
];

// Measures of one finished world. `snap` is taken a year before the end (for day ranges and hours).
export function snapshot(s) { return { tick: s.tick, pop: s.people.filter(p => p.alive).length, per: new Map(s.people.filter(p => p.alive).map(p => [p.id, { tiles: p.tiles, gather: p.times.gather }])) }; }
export function islandStats(s, snap0, snapY, lifeTable, TILE_KM) {
  const year = 365 * 24, alive = s.people.filter(p => p.alive), out = {};
  const ad = alive.filter(p => p.body.age >= 18 && snapY.per.has(p.id)), days = (s.tick - snapY.tick) / 24;
  const km = g => g.length ? g.reduce((n, p) => n + p.tiles - snapY.per.get(p.id).tiles, 0) / g.length / days * TILE_KM : NaN;
  out.dayKmF = km(ad.filter(p => p.sex === 'F')); out.dayKmM = km(ad.filter(p => p.sex === 'M'));
  out.gatherH = ad.length ? ad.reduce((n, p) => n + p.times.gather - snapY.per.get(p.id).gather, 0) / ad.length / days : NaN;
  const lt = lifeTable(s), band = (a, b) => { const r = lt.filter(x => x.from >= a && x.to <= b); const y = r.reduce((n, x) => n + x.years, 0); return y ? r.reduce((n, x) => n + x.deaths, 0) / y : NaN; };
  out.q0 = band(0, 1); out.m1to5 = band(1, 5); out.m5to10 = band(5, 10); out.m20to40 = band(20, 40);
  const deaths = Object.values(s.deaths).reduce((a, b) => a + b, 0); out.illnessShare = deaths ? ((s.deaths.Illness ?? 0) + 0.5 * (s.deaths['Injury and illness'] ?? 0)) / deaths : NaN;
  const bands = s.bands.filter(b => !b.ended); out.campSize = bands.length ? alive.length / bands.length : NaN;
  const L = s.ledger, plant = L.consumed * 500; out.meatShare = (L.meatKcal ?? 0) / Math.max(1, plant + (L.meatKcal ?? 0));
  // fertility from every woman's years and births during the run
  const ageAt = (p, t) => (t - p.born) / year, births = new Map();
  for (const k of s.people) if (k.mother != null && k.born > 0) { const m = s.people[k.mother]; (births.get(m.id) ?? births.set(m.id, []).get(m.id)).push(ageAt(m, k.born)); }
  let wy = new Array(7).fill(0), wb = new Array(7).fill(0);
  for (const p of s.people) if (p.sex === 'F') {
    const a0 = Math.max(0, ageAt(p, Math.max(0, p.born))), a1 = ageAt(p, p.alive ? s.tick : p.death.t);
    for (let i = 0; i < 7; i++) { const lo = 15 + 5 * i, hi = lo + 5, ov = Math.min(hi, a1) - Math.max(lo, a0); if (ov > 0) wy[i] += ov; }
    for (const a of births.get(p.id) ?? []) { const i = Math.floor((a - 15) / 5); if (i >= 0 && i < 7) wb[i]++; }
  }
  out.tfr = wy.reduce((n, y, i) => n + (y ? 5 * wb[i] / y : 0), 0);
  const gaps = [], firsts = []; for (const [id, list] of births) { const m = s.people[id], sorted = list.sort((a, b) => a - b); for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]); if (ageAt(m, 0) < 12) firsts.push(sorted[0]); }
  out.ibi = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : NaN; out.afb = firsts.length ? firsts.reduce((a, b) => a + b, 0) / firsts.length : NaN;
  out.growth = snap0.pop && alive.length ? Math.log(alive.length / snap0.pop) / ((s.tick - snap0.tick) / year) : NaN;
  out.campMoves = (s.campMoves ?? 0) / Math.max(1, s.bands.length * (s.tick - snap0.tick) / year);
  return out;
}
// Cross-entropy of the observed patterns under the model (synthetic likelihood, Wood 2010): for each pattern, the
// islands' values give a predictive normal N(mean, sd_islands^2 + sd_observed^2); the score is the average of
// -log p(z) over patterns, in nats, with each pattern measured in units of its own uncertainty. Lower is better; the floor,
// a model that matches every pattern exactly with no spread of its own, is 0.5 log(2 pi) = 0.92 nats. Also returns each pattern's z-score. With few islands, sd_islands is itself uncertain:
// compare scores only on the same seeds and island counts.
export function crossEntropy(patterns, statsList) {
  const rows = [];
  for (const P of patterns) {
    const v = statsList.map(x => x[P.id]).filter(Number.isFinite); if (v.length < 2) { rows.push({ ...P, n: v.length, nll: NaN }); continue; }
    const mu = v.reduce((a, b) => a + b, 0) / v.length, sdS = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1)), sd = Math.sqrt(sdS ** 2 + P.sd ** 2);
    // in units of the pattern's own measurement uncertainty, so the score does not depend on km against m: -log p of
    // the standardised value z/sd_obs, i.e. the plain -log p minus log(sd_obs)
    rows.push({ ...P, n: v.length, mean: mu, sdSim: sdS, zscore: (P.z - mu) / sd, nll: 0.5 * Math.log(2 * Math.PI * sd * sd) + (P.z - mu) ** 2 / (2 * sd * sd) - Math.log(P.sd) });
  }
  const ok = rows.filter(r => Number.isFinite(r.nll));
  return { ce: ok.reduce((a, r) => a + r.nll, 0) / Math.max(1, ok.length), rows };
}
