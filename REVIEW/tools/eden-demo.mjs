const { createEden, edenStep, edenMetrics } = await import(process.argv[2] + '/dist/eden.js');
const { DAY, metrics } = await import(process.argv[2] + '/dist/sim.js');
const days = Number(process.argv[3] || 30), rows = [];
for (const seed of (process.argv[4]||"41,42,47,50,56").split(",").map(Number)) {
  const s = createEden(seed); let preFallDeaths = 0, t0 = performance.now();
  for (let t = 0; t < days * DAY; t++) { edenStep(s); if (s.eden.phase === 'guided' && s.creatures.some(c => !c.alive)) preFallDeaths++; }
  const m = edenMetrics(s), l = s.ledger, food = metrics(s).food;
  const iv = m.birthIntervals, mean = iv.length ? iv.reduce((a, b) => a + b, 0) / iv.length : NaN;
  const women = s.creatures.filter(c => c.eden.sex === 'F' && c.eden.mother === null);
  const perWoman = women.reduce((n, c) => n + c.eden.births.length, 0) / women.length;
  const ok = Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - food) < 1e-6;
  rows.push({ seed, phase: m.phase, fallDay: m.fallTick === null ? null : +(m.fallTick / DAY).toFixed(1), pop: m.population, births: m.births, deaths: m.deaths, children: m.children,
    meanInterval: +mean.toFixed(2), birthsPerFounderWoman: +perWoman.toFixed(2), cap: m.capReached, ledgerOk: ok, preFallDeaths, ms: Math.round(performance.now() - t0) });
}
console.table(rows);
