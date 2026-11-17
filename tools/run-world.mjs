// Long runs of the small world without a screen. Usage: node tools/run-world.mjs <years> <seed> [seed ...] > out.csv
// One row per seed per year. Measures only; it never changes the world.
import { createWorld2, stepWorld, worldMetrics } from '../dist/world.js';
import { rainOf } from '../dist/savanna.js';
import { clockOf } from '../dist/clock.js';
const [years = 100, ...seeds] = process.argv.slice(2).map(Number);
console.log('seed,year,rain,population,adults,children,households,generations,ever_lived,births,deaths_total,starvation,thirst,injury_illness,illness,old_age,childbirth,known_share,mean_fat,cap_reached,seconds');
for (const seed of seeds.length ? seeds : [41]) {
  const s = createWorld2(seed), Y = clockOf(s).year, t0 = Date.now();
  for (let y = 1; y <= years; y++) {
    stepWorld(s, Y); const m = worldMetrics(s), d = m.deaths, tot = Object.values(d).reduce((a, b) => a + b, 0);
    console.log([seed, y, rainOf(seed, y - 1).toFixed(2), m.population, m.adults, m.children, m.households, m.generations, m.everLived, m.births, tot, d.Starvation ?? 0, d.Thirst ?? 0, d['Injury and illness'] ?? 0, d.Illness ?? 0, d['Old age'] ?? 0, d.Childbirth ?? 0, m.discoveredShare.toFixed(3), m.meanFat.toFixed(2), m.capReached, ((Date.now() - t0) / 1000).toFixed(0)].join(','));
    if (!m.population) break;
  }
}
