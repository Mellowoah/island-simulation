// The real-world pattern each layer must show in the running world before it can become real (tools/gate.mjs).
// Each takes the gate's island results and returns { ok, detail }.
import { CLIMATE } from '../dist/atmosphere.js';

export const TESTS = {
  sun: ['tests/sun.test.mjs'],
  air: ['tests/atmosphere.test.mjs'],
  water: ['tests/water.test.mjs'],
  terrain: ['tests/land.test.mjs'],
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
