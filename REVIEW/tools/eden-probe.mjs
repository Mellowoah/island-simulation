const { createEden, edenStep, edenMetrics } = await import(process.argv[2] + '/dist/eden.js');
const { metrics, DAY } = await import(process.argv[2] + '/dist/sim.js');
const days = Number(process.argv[3] || 20);
for (let seed = 41; seed <= 60; seed++) {
  const s = createEden(seed); let preDeaths = 0;
  for (let t = 0; t < days * DAY; t++) { edenStep(s); if (s.eden.phase === 'guided' && s.creatures.some(c => !c.alive)) preDeaths++; }
  const m = edenMetrics(s), mm = metrics(s), l = s.ledger;
  const rec = Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - mm.food);
  const P = s.eden.deliberations.map(d => d.P);
  console.log(`seed ${seed}: ${m.phase === 'released' ? `fell day ${(m.fallTick / DAY).toFixed(1)} by ${s.creatures[m.firstEater].name}` : 'never fell'} | delib ${m.deliberations} P ${P.length ? Math.min(...P).toFixed(3) + '-' + Math.max(...P).toFixed(3) : '-'} | guided ${(m.guidedShare * 100).toFixed(0)}% | alive ${mm.alive} | fields ${m.fields} clothed ${m.clothed} tools ${m.tools} | ledgerErr ${rec.toExponential(1)} | preFallDeaths ${preDeaths}`);
}
