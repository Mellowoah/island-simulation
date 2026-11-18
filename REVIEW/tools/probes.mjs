// Reviewer probes. Usage: node probes.mjs <path-to-dist>
import path from 'node:path';
const dist = path.resolve(process.argv[2]);
const sim = await import(path.join(dist, 'sim.js'));
const exp = await import(path.join(dist, 'experiment.js'));
const { createWorld, step, command, serialize, deserialize, path: route, land, W, H } = sim;
const out = (k, v) => console.log(k.padEnd(48), typeof v === 'string' ? v : JSON.stringify(v));

// P1 Knowledge: hidden patch-b stock must not change any decision before anyone knows b.
for (const seed of [41, 42, 43, 7, 99]) {
  const a = createWorld(seed), b = createWorld(seed); b.patches[1].stock = 0; b.ledger.initial = 120;
  let t = 0, same = true;
  while (t < 20000) {
    step(a); step(b); t++;
    if (a.creatures.some(c => c.known.b) || b.creatures.some(c => c.known.b)) break;
    for (let i = 0; i < 24; i++) if (JSON.stringify(a.creatures[i].decision) !== JSON.stringify(b.creatures[i].decision) || a.creatures[i].x !== b.creatures[i].x || a.creatures[i].y !== b.creatures[i].y) same = false;
    if (!same) break;
  }
  out(`P1 seed ${seed} identical until first b-knowledge`, `${same} (tick ${t})`);
}

// P2 Inspector: recorded selection equals executed action, and is argmax for scored policy unless emergency.
{
  let checked = 0, bad = 0, emergency = 0;
  const s = createWorld(41);
  for (let t = 0; t < 6000; t++) {
    const before = s.creatures.map(c => c.decision);
    step(s);
    s.creatures.forEach((c, i) => {
      const d = c.decision; if (!d || d === before[i] || d.tick !== s.tick) return; checked++;
      const max = Math.max(...d.options.map(o => o.score));
      const sel = d.options.find(o => o.type === d.selected && (o.patch ?? null) === d.patch);
      if (d.emergency) emergency++;
      else if (!sel || sel.score !== max) bad++;
      if (c.action && c.action.type !== d.selected && !(d.selected === 'explore' && c.action === null)) bad++;
    });
  }
  out('P2 decisions checked / mismatches / emergencies', [checked, bad, emergency]);
}

// P3 Accounting & bounds over long runs, incl. gifts and failure.
{
  const s = createWorld(77); let worst = 0, boundsOk = true;
  for (let t = 0; t < 20000; t++) {
    if (t % 500 === 0) command(s, { type: 'food', x: 13, y: 13, amount: 40 });
    if (t === 8000) command(s, { type: 'failure' });
    step(s);
    const l = s.ledger, stock = s.patches.reduce((n, p) => n + p.stock, 0);
    worst = Math.max(worst, Math.abs(l.initial + l.regenerated + l.gifted - l.consumed - stock));
    if (s.patches.some(p => p.stock < 0 || p.stock > p.capacity) || s.creatures.some(c => c.hunger < 0 || c.hunger > 100 || c.energy < 0 || c.energy > 100)) boundsOk = false;
  }
  out('P3 max ledger error / bounds ok', [worst, boundsOk]);
}

// P4 Path validity: random pairs, routes are adjacent land steps ending at target; bridge only shortens.
{
  let bad = 0, n = 0, longer = 0;
  const lands = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (land(x, y, false)) lands.push([x, y]);
  for (let i = 0; i < 3000; i++) {
    const [x, y] = lands[(i * 7919) % lands.length], [tx, ty] = lands[(i * 104729 + 13) % lands.length];
    for (const br of [false, true]) {
      const r = route(x, y, tx, ty, br); n++;
      let px = x, py = y;
      for (const [qx, qy] of r) { if (Math.abs(qx - px) + Math.abs(qy - py) !== 1 || !land(qx, qy, br)) bad++; px = qx; py = qy; }
      if ((x !== tx || y !== ty) && (px !== tx || py !== ty)) bad++;
    }
    if (route(x, y, tx, ty, true).length > route(x, y, tx, ty, false).length) longer++;
  }
  out('P4 routes checked / invalid / bridge-longer', [n, bad, longer]);
}

// P5 Reproducibility of experiment rows (one seed, twice).
{
  const r1 = JSON.stringify(exp.runSeed(45)), r2 = JSON.stringify(exp.runSeed(45));
  out('P5 runSeed(45) identical twice', r1 === r2);
}

// P6 Save validation gaps that later crash the renderer.
{
  const tryLoad = (mut) => { const e = JSON.parse(serialize(createWorld(41))); mut(e.world); try { deserialize(JSON.stringify(e)); return 'ACCEPTED'; } catch (x) { return 'rejected'; } };
  out('P6a dead creature with death:null', tryLoad(w => { w.creatures[3].alive = false; w.creatures[3].death = null; }));
  out('P6b decision.hunger is a string', tryLoad(w => { w.creatures[0].decision = { tick: 0, hunger: 'x', energy: 1, selected: 'rest', patch: null, options: [] }; }));
  out('P6c decision.tick is a string', tryLoad(w => { w.creatures[0].decision = { tick: 'x', hunger: 1, energy: 1, selected: 'rest', patch: null, options: [] }; }));
  out('P6d option.type is an object', tryLoad(w => { w.creatures[0].decision = { tick: 0, hunger: 1, energy: 1, selected: 'rest', patch: null, options: [{ type: {}, score: 1, reason: 'r' }] }; }));
}

// P7 Crossing interrupts gathering already under way at a patch.
{
  const s = createWorld(41); let c;
  for (let t = 0; t < 5000 && !c; t++) { step(s); c = s.creatures.find(c => c.alive && c.action?.type === 'gather' && c.action.route.length === 0 && c.action.left > 2); }
  const left = c.action.left; command(s, { type: 'bridge' });
  out('P7 gather in progress survives crossing', c.action ? `yes (left ${left})` : `NO: cancelled with ${left} ticks left`);
}

// P8 Reveal overwrites an observed estimate.
{
  const s = createWorld(41); let c;
  for (let t = 0; t < 30000 && !c; t++) { step(s); c = s.creatures.find(c => c.alive && c.known.b && Math.abs(c.known.b.expected - 60) > 5); }
  if (c) { const was = c.known.b.expected; command(s, { type: 'reveal', id: c.id }); out('P8 reveal to creature already knowing b', `expected ${was.toFixed(1)} -> ${c.known.b.expected}`); }
  else out('P8 reveal overwrite', 'no creature found knowing b');
}

// P9 Manifest drift: PLAN values not used by schedule()/failure.
{
  exp.PLAN.provision.x = 20; exp.PLAN.provision.y = 10;
  const s = createWorld(41); exp.schedule(s, 'provision');
  const g = s.patches.find(p => p.gift);
  out('P9 PLAN.provision moved to (20,10); gift placed at', `${g.x},${g.y}`);
  exp.PLAN.provision.x = 13; exp.PLAN.provision.y = 13;
}

// P10 Sprite distinctness as drawn in app.js: palette id%6, ear id%3.
{
  const looks = new Set(Array.from({ length: 24 }, (_, id) => `${id % 6}/${id % 3}`));
  out('P10 distinct sprite looks (pristine formula)', looks.size);
}
