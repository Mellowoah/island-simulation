// One island for the layer gate: node tools/gate-run.mjs <seed> <years> '<config JSON>'
// Prints one line of JSON: alarms, water books, deaths by cause, people alive, and monthly patterns
// (mean max temperature of the world's air, share of seasonal water holes holding water, share of dark hours).
const ROOT = process.env.ROOT ?? new URL('..', import.meta.url).pathname;
const { createWorld2, stepWorld } = await import(ROOT + '/dist/world.js');
const { weatherLedger } = await import(ROOT + '/dist/weather.js');
const { isDark } = await import(ROOT + '/dist/sun.js');
const { clockOf } = await import(ROOT + '/dist/clock.js');

const [seed, years, cfg] = [+process.argv[2], +(process.argv[3] ?? 3), JSON.parse(process.argv[4] ?? '{}')];
const s = createWorld2(seed, cfg), C = clockOf(s);
const month = Array.from({ length: 12 }, () => ({ tmax: 0, holes: 0, dark: 0, n: 0 }));

function sampleDay(d) {
  const m = month[Math.floor((d % 365) / 30.42) % 12], seasonal = s.waters.filter(w => isFinite(w.level));
  let dark = 0;
  for (let h = 0; h < 24; h++) dark += isDark(C, s.tick + h) ? 1 : 0;
  m.tmax += s.weather.tmax;
  m.holes += seasonal.length ? seasonal.filter(w => w.active).length / seasonal.length : 1;
  m.dark += dark / 24;
  m.n++;
}

for (let d = 0; d < 365 * years; d++) {
  sampleDay(d);
  stepWorld(s, 24);
}
const avg = k => month.map(m => +(m[k] / m.n).toFixed(3));
const wl = weatherLedger(s);
console.log(JSON.stringify({
  seed, alive: s.people.filter(p => p.alive).length, alarms: s.alarms.length, deaths: s.deaths ?? {},
  books: { soil: wl.soilError, holes: wl.holeError, ground: wl.groundError ?? 0 },
  tmax: avg('tmax'), holes: avg('holes'), dark: avg('dark'),
}));
