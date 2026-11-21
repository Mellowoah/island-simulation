// ---------- Layer 1: year-to-year rain (part of the atmosphere) ----------
// How wet each year is against an ordinary year: a log-normal year (sd 0.4; a drought, under 60% of normal rain,
// comes about one year in ten) times a slow 40-year wet/dry swing of +-20%. Fixed by the seed.
// Moved here from savanna.js on 19 Nov 2026 (it is climate, not plants), unchanged, so that layers depend only
// downhill (plants on weather, never weather on plants).
import { noise2, seedKey, STREAMS } from './sim.js';

export const CLIMATE = { yearSd: 0.4, swing: 0.2, swingYears: 40, drought: 0.6 };
const rainCache = new Map();
export function rainOf(seed, year) {
  const key = seed + ':' + year;
  if (rainCache.has(key)) return rainCache.get(key);
  const k = seedKey(seed),
    u = i => noise2(k, year + 1000, i, STREAMS.climate[0]);
  const z = (u(0) + u(1) + u(2) + u(3) + u(4) + u(5) - 3) * Math.SQRT2; // approx. normal, sd 1
  const phase = noise2(k, 0, 99, STREAMS.climate[0]) * 2 * Math.PI;
  // exp(sd z) averages exp(sd^2 / 2), so divide that out: an ordinary year is 1.
  const r = Math.max(
    0.15,
    Math.min(
      2.5,
      Math.exp(CLIMATE.yearSd * z - CLIMATE.yearSd ** 2 / 2) *
        (1 + CLIMATE.swing * Math.sin((2 * Math.PI * year) / CLIMATE.swingYears + phase)),
    ),
  );
  if (rainCache.size > 5000) rainCache.clear();
  rainCache.set(key, r);
  return r;
}
