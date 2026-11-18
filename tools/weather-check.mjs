// Weather statistics over many years (no people needed): wet-day share by month, annual totals, droughts, and when
// each kind of water hole runs dry. node tools/weather-check.mjs [years] [seed]
import { makeWeather, weatherDay, WET_SHARE_BY_MONTH, expectedAnnual, weatherLedger } from '../dist/weather.js';
import { makeClock } from '../dist/clock.js';
import * as T from '../dist/terrain.js';
const years = +(process.argv[2] ?? 200), seed = +(process.argv[3] ?? 1);
const s = { seed, tick: 0, clock: { min: 60 }, waters: T.waterSites().map(w => ({ ...w })) };
const { clockOf } = await import('../dist/clock.js'); const C = clockOf(s);
makeWeather(s);
const M = Object.keys(WET_SHARE_BY_MONTH), wet = new Array(12).fill(0), days = new Array(12).fill(0), annual = [], dryMonths = {};
let yr = 0;
for (let d = 0; d < years * 365; d++) {
  s.tick = d * C.day; weatherDay(s);
  const mi = Math.floor((d % 365) / 365 * 12); days[mi]++; if (s.weather.wet) wet[mi]++; yr += s.weather.rain;
  if (d % 365 === 364) { annual.push(yr); yr = 0; }
  for (const w of s.waters) if (isFinite(w.level)) { const k = w.kind; (dryMonths[k] ??= new Array(12).fill(0)); if (!w.active) dryMonths[k][mi]++; }
}
const mean = annual.reduce((a, b) => a + b, 0) / annual.length, sd = Math.sqrt(annual.reduce((a, b) => a + (b - mean) ** 2, 0) / annual.length);
console.log(`years ${years}: annual rain mean ${mean.toFixed(0)} mm (expected ${expectedAnnual().toFixed(0)}), sd ${sd.toFixed(0)}, CV ${(sd / mean).toFixed(2)}; years under 60% of mean: ${(100 * annual.filter(a => a < 0.6 * mean).length / annual.length).toFixed(1)}%`);
console.log('wet-day share by month (sim / target):', M.map((m, i) => `${m} ${(wet[i] / days[i]).toFixed(2)}/${WET_SHARE_BY_MONTH[m]}`).join('  '));
const counts = {}; for (const w of s.waters) if (isFinite(w.level)) counts[w.kind] = (counts[w.kind] ?? 0) + 1;
for (const [k, a] of Object.entries(dryMonths)) console.log(`share of days dry, ${k}:`, M.map((m, i) => `${m} ${(a[i] / (days[i] * counts[k])).toFixed(2)}`).join(' '));
console.log('water books (should be ~0):', JSON.stringify(weatherLedger(s), (k, v) => typeof v === 'number' ? +v.toExponential(2) : v));
