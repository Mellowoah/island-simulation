// Quick balance check: one island, N years: alive, alarms, books, deaths. node tools/quick.mjs <seed> <years> [config JSON]; ROOT=<path> to run another copy
const ROOT = process.env.ROOT ?? '/home/claude/island-simulation'; // ROOT=<other copy> runs that copy's code
const { createWorld2, stepWorld, worldMetrics } = await import(ROOT + '/dist/world.js');
const { weatherLedger } = await import(ROOT + '/dist/weather.js');
const seed = +process.argv[2], years = +(process.argv[3] ?? 5); const s = createWorld2(seed); stepWorld(s, 8760 * years);
const L = s.ledger, held = s.people.reduce((n, p) => n + p.carry, 0) + s.households.reduce((n, h) => n + h.pool, 0) + (s.lostCarry ?? 0);
const kerr = L.consumed * 500 + (L.meatKcal ?? 0) + (L.cookGain ?? 0) - ((s.energyLedger?.eaten ?? 0) - (L.milkKcal ?? 0)) - held - L.poolSpoiled;
console.log(`seed ${seed} ${years}y: alive ${s.people.filter(p => p.alive).length}, alarms ${(s.alarms ?? []).length}, long days ${s.unusual ?? 0}, kcal book ${kerr.toExponential(1)}, water ${JSON.stringify(weatherLedger(s), (k, v) => typeof v === 'number' ? +v.toExponential(1) : v)}, deaths ${JSON.stringify(s.deaths)}`);
