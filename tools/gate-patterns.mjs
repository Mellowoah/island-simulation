// The real-world pattern each layer must show in the running world before it can become real (tools/gate.mjs).
// Each takes the gate's island results and returns { ok, detail }.
import { CLIMATE } from '../dist/atmosphere.js';

export const TESTS = {
  sun: ['tests/sun.test.mjs'],
  air: ['tests/atmosphere.test.mjs'],
  water: ['tests/water.test.mjs'],
};

// Months in the gate's results run from November (the world starts on 1 November)
const calMonth = i => (i + 10) % 12;
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const byMonth = (rs, k) => rs[0][k].map((_, i) => mean(rs.map(r => r[k][i])));

export const PATTERNS = {
  // Lake Eyasi at 3.6 S: dark about 11-12 hours in every month
  sun(rs) {
    const d = byMonth(rs, 'dark').map(x => x * 24), ok = d.every(h => h > 10.5 && h < 12.5);
    return { ok, detail: `dark hours a day by month ${d.map(h => h.toFixed(1)).join(' ')}` };
  },
  // The world's air must sit on the measured climate: every month's mean max within 1 deg C
  air(rs) {
    const t = byMonth(rs, 'tmax'), off = t.map((x, i) => x - CLIMATE.tmax[calMonth(i)]);
    const ok = off.every(o => Math.abs(o) < 1);
    return { ok, detail: `mean max minus measured, by month: ${off.map(o => o.toFixed(2)).join(' ')}` };
  },
  // Water holes: widespread in the wet season, scarcer late in the dry (O'Connell et al., the Tli'ika area)
  water(rs) {
    const h = byMonth(rs, 'holes'), wet = mean([h[1], h[2], h[3], h[4], h[5], h[6]]), lateDry = mean([h[10], h[11]]);
    const ok = wet >= 0.7 && lateDry >= 0.15 && lateDry <= 0.75;
    return { ok, detail: `holes with water: wet season ${wet.toFixed(2)}, Sep-Oct ${lateDry.toFixed(2)} (want >= 0.7 and 0.15-0.75)` };
  },
};
