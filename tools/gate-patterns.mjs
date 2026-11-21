// The real-world pattern each layer must show in the running world before it can become real (tools/gate.mjs).
// Each takes the gate's island results and returns { ok, detail }.
import { CLIMATE } from '../dist/atmosphere.js';

export const TESTS = {
  sun: ['tests/sun.test.mjs'],
  air: ['tests/atmosphere.test.mjs'],
  water: ['tests/water.test.mjs'],
  terrain: ['tests/land.test.mjs'],
  plants: ['tests/plants.test.mjs'],
  animals: ['tests/fauna.test.mjs'],
};

// Months in the gate's results run from November (the world starts on 1 November)
const calMonth = i => (i + 10) % 12;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const byMonth = (rs, k) => rs[0][k].map((_, i) => mean(rs.map(r => r[k][i])));

export const PATTERNS = {
  // Lake Eyasi at 3.6 S: dark about 11-12 hours in every month
  sun(rs) {
    const d = byMonth(rs, 'dark').map(x => x * 24),
      ok = d.every(h => h > 10.5 && h < 12.5);
    return { ok, detail: `dark hours a day by month ${d.map(h => h.toFixed(1)).join(' ')}` };
  },
  // The world's air must sit on the measured climate: every month's mean max within 1 deg C
  air(rs) {
    const off = k => byMonth(rs, k).map((x, i) => x - CLIMATE[k][calMonth(i)]);
    const hi = off('tmax'),
      lo = off('tmin'),
      ok = [...hi, ...lo].every(o => Math.abs(o) < 1);
    const show = a => a.map(o => o.toFixed(2)).join(' ');
    return { ok, detail: `mean max minus measured, by month: ${show(hi)}; mean min: ${show(lo)}` };
  },
  // Water holes: widespread in the wet season, scarcer late in the dry (O'Connell et al., the Tli'ika area)
  // Layer 3: in the late dry season, river and stream pools with small catchments are dry more often than those
  // with large ones, and the seasonal holes still follow the water layer's pattern
  terrain(rs) {
    const small = mean(rs.map(r => r.lateBySize.small)),
      large = mean(rs.map(r => r.lateBySize.large));
    const w = PATTERNS.water(rs),
      ok = small < large && w.ok;
    return {
      ok,
      detail: `river and stream pools wet in Sep-Oct: small catchments ${small.toFixed(2)}, large ${large.toFixed(2)}; ${w.detail}`,
    };
  },
  // Layer 4: grass grown from transpired water against Deshmukh (1984), measured across East and southern Africa:
  // peak herb biomass (g/m2) = 0.8488 x rain (mm) - 19.58. Peak standing grass within 25% of it on average, the
  // year's growth at least the peak (peak standing crop underestimates production), and green grass gone late in
  // the dry season (Sep-Oct under a fifth of the wet season's)
  plants(rs) {
    const ys = rs.flatMap(r => r.plantYears),
      desh = y => 0.8488 * y.rain - 19.58;
    const peak = mean(ys.map(y => y.peak / desh(y))),
      grown = mean(ys.map(y => y.grown / desh(y)));
    const g = byMonth(rs, 'green'),
      wet = mean(g.slice(1, 7)),
      late = mean([g[10], g[11]]);
    const ok = peak > 0.75 && peak < 1.25 && grown >= peak && late < 0.2 * wet;
    return {
      ok,
      detail: `peak standing / Deshmukh ${peak.toFixed(2)}, growth / Deshmukh ${grown.toFixed(2)}, green Sep-Oct ${late.toFixed(0)} against wet season ${wet.toFixed(0)} g/m2`,
    };
  },
  // Layer 5: the herds eat a share of the grass that grew within what native large herbivores eat (1% in desert
  // grassland to about 64% in mesic grassland; Joern and Raynor 2018), and their live mass lies within the range
  // across African parks (10^2-10^4 kg/km2; Fritz and Duncan 1994)
  animals(rs) {
    const ys = rs.flatMap(r => r.plantYears),
      share = mean(ys.map(y => y.eaten / y.grown));
    const bio = mean(ys.map(y => y.herbivoreKgKm2)),
      ok = share >= 0.01 && share <= 0.64 && bio >= 100 && bio <= 10000;
    return {
      ok,
      detail: `herds ate ${(100 * share).toFixed(1)}% of the grass grown; herbivores ${bio.toFixed(0)} kg/km2`,
    };
  },
  water(rs) {
    const h = byMonth(rs, 'holes'),
      wet = mean([h[1], h[2], h[3], h[4], h[5], h[6]]),
      lateDry = mean([h[10], h[11]]);
    const ok = wet >= 0.7 && lateDry >= 0.15 && lateDry <= 0.75;
    return {
      ok,
      detail: `holes with water: wet season ${wet.toFixed(2)}, Sep-Oct ${lateDry.toFixed(2)} (want >= 0.7 and 0.15-0.75)`,
    };
  },
};
