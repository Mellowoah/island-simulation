// Eden world: a separate scenario built on the island core. See docs/EDEN-DESIGN.md.
// Phases: guided (Creator's warning at birth, Creator leads choices that fall outside what is best,
// no death) -> released (first creature to eat from the tree; everyone released at once).
import { W, DAY, clamp, land, path, createWorld, observe, decide, event, noise2, seedKey } from './sim.js';

export const EDEN_VERSION = 1;
export const EDEN_DEFAULTS = {
  tree: [13, 12],          // "in the midst of the garden"; next to where creatures begin
  curiosityMin: 0.2, curiosityMax: 0.9,
  beauty: 0.5,             // "pleasing to the eye"
  wFood: 1, wEye: 0.6, wWisdom: 1.2, wWarn: 3, temperature: 0.5,
  credenceStep: 0.15,      // how much each hearing of the serpent's claim raises credence
  hungerGuide: 30, energyGuide: 30, wanderLimit: 10,
  cursedRegen: 0.5, exposureCost: 0.02,
  cultivateWork: 120, workCost: 0.05, growTicks: 2 * DAY, fieldRegen: 0.06, fieldCapacity: 60,
  craftWork: 180, toolBonus: 1, toolSpeed: 0.7,
  cultivateWeight: 10, clothingWeight: 9, toolWeight: 4, scarcityRef: 60,
  judgeRate: 0.5, biasCap: 6,
};
const WARNING = 'The Creator: eat freely from the garden, but not from the tree of the knowledge of good and evil. Eating from it brings death.';
const CLAIM = 'The serpent: you will not die. Your eyes will be opened, and you will know good and evil.';
const draw = (s, id, salt) => noise2(seedKey(s.seed), s.tick, id, salt);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function createEden(seed = 41, overrides = {}, edenOverrides = {}) {
  const s = createWorld(seed, overrides);
  const cfg = { ...EDEN_DEFAULTS, ...edenOverrides };
  const [tx, ty] = cfg.tree;
  if (!land(tx, ty, false)) throw Error('The tree must stand on land');
  s.mode = 'eden';
  s.eden = { version: EDEN_VERSION, phase: 'guided', tree: { x: tx, y: ty }, config: cfg, fallTick: null, firstEater: null,
    decisions: 0, overrides: 0, serpentSpoke: null, deliberations: [] };
  const k = seedKey(s.seed);
  for (const c of s.creatures) {
    c.times.work = 0;
    c.eden = { curiosity: cfg.curiosityMin + noise2(k, 0, c.id, 7) * (cfg.curiosityMax - cfg.curiosityMin),
      instruction: { source: 'Creator', text: WARNING, tick: 0 }, warning: 1, hearings: 0, credence: 0, lastSerpent: null,
      clothed: false, tool: false, bias: { rest: 0, explore: 0, gather: 0, cultivate: 0, craft: 0 }, judged: 0, guided: 0 };
    event(s, 'Warned by the Creator: do not eat from the tree.', c);
  }
  event(s, 'Eden begins. Each creature is warned not to eat from the tree. The Creator guides them.');
  return s;
}

// The Creator's view: knows true stocks. Returns a replacement action only when the creature's
// own choice falls outside what is best for it; otherwise null (the choice stands as its own).
function creatorBest(s, c) {
  const cfg = s.eden.config, own = c.action;
  if (c.energy < cfg.energyGuide && own.type !== 'rest')
    return { type: 'rest', patch: null, action: { type: 'rest', left: 28 }, reason: 'Tired: the Creator leads it to rest.' };
  if (c.hunger >= cfg.hungerGuide) {
    const target = own.type === 'gather' ? s.patches.find(p => p.id === own.patch) : null;
    if (target && target.stock >= 4) return null;
    let best = null;
    for (const p of s.patches) {
      if (p.stock < 4) continue;
      const r = path(c.x, c.y, p.x, p.y, s.bridge);
      if (!r.length && (c.x !== p.x || c.y !== p.y)) continue;
      if (!best || r.length < best.r.length) best = { p, r };
    }
    if (best) return { type: 'gather', patch: best.p.id, action: { type: 'gather', patch: best.p.id, route: best.r, left: Math.max(4, Math.round(14 - 8 * (c.skills[best.p.id] ?? 0))) },
      reason: `Hungry: the Creator leads it to ${best.p.name}, where there is food.` };
    return null;
  }
  if (own.type === 'explore' && own.route.length) {
    const [ex, ey] = own.route[own.route.length - 1];
    const food = s.patches.filter(p => p.stock > 0);
    const near = food.reduce((b, p) => Math.min(b, Math.abs(p.x - ex) + Math.abs(p.y - ey)), Infinity);
    if (food.length && near > cfg.wanderLimit) {
      // Lead it to a real exploration destination within reach of food (prefer ground it has not seen).
      const p = food.reduce((b, p) => dist(p, c) < dist(b, c) ? p : b), L = cfg.wanderLimit;
      let goal = null, score = -Infinity;
      for (let i = 0; i < 18; i++) {
        const x = p.x + Math.round((draw(s, c.id, 50 + i) * 2 - 1) * L), y = p.y + Math.round((draw(s, c.id, 70 + i) * 2 - 1) * L);
        if (!land(x, y, s.bridge) || Math.abs(x - p.x) + Math.abs(y - p.y) > L) continue;
        const v = (c.visited[y * W + x] ? 0 : 30) - Math.abs(c.x - x) - Math.abs(c.y - y);
        if (v > score) { score = v; goal = [x, y]; }
      }
      if (!goal) return null;
      return { type: 'explore', patch: null, action: { type: 'explore', route: path(c.x, c.y, goal[0], goal[1], s.bridge) },
        reason: `Curiosity was taking it ${near} tiles from any food: the Creator leads its exploring to ground within reach of ${p.name}.` };
    }
  }
  return null;
}

function scarcity(s, c) {
  const known = Object.values(c.known).reduce((n, k) => n + k.expected, 0);
  return 1 - Math.min(1, known / s.eden.config.scarcityRef);
}

function edenDecide(s, c) {
  decide(s, c); // the creature's own scored choice (same rules as the main island)
  const E = s.eden, cfg = E.config, d = c.decision;
  if (E.phase === 'guided') {
    E.decisions++;
    const best = creatorBest(s, c);
    if (best) {
      E.overrides++; c.eden.guided++;
      d.guided = { intended: d.selected, intendedPatch: d.patch, to: best.type, patch: best.patch, reason: best.reason };
      c.action = best.action;
    }
  } else {
    // Released: own choice, with own learned judgements and the means to produce.
    const opts = d.options.map(o => ({ ...o, score: o.score + (c.eden.bias[o.type] ?? 0) }));
    const here = !s.patches.some(p => p.x === c.x && p.y === c.y) && !(c.x === E.tree.x && c.y === E.tree.y);
    const ownsField = s.patches.some(p => p.field && p.owner === c.id);
    if (here && !ownsField && c.energy > 40) opts.push({ type: 'cultivate', score: cfg.cultivateWeight * scarcity(s, c) * (c.energy / 100) + c.eden.bias.cultivate, reason: `Food I know of feels scarce (${Math.round(scarcity(s, c) * 100)}%). Till the ground here.` });
    if (!c.eden.clothed) opts.push({ type: 'craft', item: 'clothing', score: cfg.clothingWeight * (1 - c.energy / 100) + 2 + c.eden.bias.craft, reason: 'Exposed: make clothing.' });
    else if (!c.eden.tool && c.energy > 50) opts.push({ type: 'craft', item: 'tool', score: cfg.toolWeight + c.eden.bias.craft, reason: 'Make a tool to work and gather better.' });
    const choice = c.energy < 10 ? opts[0] : [...opts].sort((a, b) => b.score - a.score)[0];
    d.options = opts; d.selected = choice.type; d.patch = choice.patch ?? null; d.item = choice.item ?? null; d.own = true;
    if (choice.type === 'cultivate') c.action = { type: 'cultivate', route: [], left: Math.round(cfg.cultivateWork * (c.eden.tool ? cfg.toolSpeed : 1)) };
    else if (choice.type === 'craft') c.action = { type: 'craft', item: choice.item, route: [], left: cfg.craftWork };
    else if (choice.type === 'rest') c.action = { type: 'rest', left: 28 };
    else if (choice.type === 'gather' && !(c.action?.type === 'gather' && c.action.patch === choice.patch)) {
      const p = s.patches.find(p => p.id === choice.patch);
      c.action = { type: 'gather', patch: p.id, route: path(c.x, c.y, p.x, p.y, s.bridge), left: Math.max(4, Math.round(14 - 8 * (c.skills[p.id] ?? 0))) };
    } else if (choice.type === 'explore' && c.action?.type !== 'explore') {
      const x = 2 + Math.floor(draw(s, c.id, 31) * 32), y = 2 + Math.floor(draw(s, c.id, 32) * 22);
      c.action = { type: 'explore', route: land(x, y, s.bridge) ? path(c.x, c.y, x, y, s.bridge) : [] };
    }
  }
  c.action.start = { hunger: c.hunger, energy: c.energy };
}

function judge(s, c, type, extra = '') {
  if (s.eden.phase !== 'released' || !c.action?.start) return;
  const st = c.action.start, good = c.hunger < st.hunger - 0.5 || c.energy > st.energy + 1;
  const cfg = s.eden.config, key = type in c.eden.bias ? type : 'explore';
  c.eden.bias[key] = clamp(c.eden.bias[key] + (good ? 1 : -1) * cfg.judgeRate, -cfg.biasCap, cfg.biasCap);
  c.eden.judged++;
  event(s, `Judged ${type}${extra} ${good ? 'good' : 'bad'}.`, c);
}

function fall(s, c) {
  const E = s.eden;
  E.phase = 'released'; E.fallTick = s.tick; E.firstEater = c.id;
  event(s, `${c.name} ate from the tree. The Creator releases everyone to their own devices.`);
  for (const o of s.creatures) if (o.alive) event(s, o === c ? 'I ate from the tree. My eyes are opened.' : `${c.name} ate. The Creator no longer leads us.`, o);
}

function serpent(s, c) {
  const E = s.eden, cfg = E.config, e = c.eden;
  if (E.phase !== 'guided' || dist(c, E.tree) > 1 || (e.lastSerpent !== null && s.tick - e.lastSerpent < DAY)) return;
  e.hearings++; e.lastSerpent = s.tick; e.credence = 1 - (1 - cfg.credenceStep) ** e.hearings;
  E.serpentSpoke = { tick: s.tick, id: c.id };
  event(s, 'The serpent spoke from the tree: "You will not die." (a claim, not verified)', c);
  const food = c.hunger / 100, eye = cfg.beauty, wisdom = e.curiosity * e.credence, warning = e.warning;
  const U = cfg.wFood * food + cfg.wEye * eye + cfg.wWisdom * wisdom - cfg.wWarn * warning;
  const P = 1 / (1 + Math.exp(-U / cfg.temperature)), r = draw(s, c.id, 77), ate = r < P;
  E.deliberations.push({ tick: s.tick, id: c.id, food, eye, wisdom, warning, U, P, draw: r, ate });
  if (E.deliberations.length > 500) E.deliberations.shift();
  c.decision = { ...(c.decision ?? {}), tick: s.tick, hunger: c.hunger, energy: c.energy, selected: ate ? 'eat' : 'refrain', patch: null,
    tree: { food, eye, wisdom, warning, U, P, draw: r }, options: [
      { type: 'eat', score: U, reason: `Good for food ${food.toFixed(2)} · pleasing ${eye.toFixed(2)} · wisdom ${wisdom.toFixed(2)} (curiosity ${e.curiosity.toFixed(2)} × belief in claim ${e.credence.toFixed(2)})` },
      { type: 'refrain', score: 0, reason: `Remembered warning ${warning.toFixed(2)} × ${cfg.wWarn}. Chance of eating ${(P * 100).toFixed(1)}%.` }] };
  event(s, ate ? 'I took the fruit and ate.' : `I refused (chance was ${(P * 100).toFixed(1)}%).`, c);
  if (ate) fall(s, c);
}

export function edenStep(s, n = 1) {
  for (let z = 0; z < n; z++) {
    s.tick++;
    const E = s.eden, cfg = E.config, released = () => E.phase === 'released';
    for (const p of s.patches) {
      if (p.field && s.tick < p.readyTick) continue;
      const rate = p.regen * (released() && !p.gift && !p.field ? cfg.cursedRegen : 1);
      const add = Math.max(0, Math.min(rate, p.capacity - p.stock));
      p.stock += add; s.ledger.regenerated += add;
    }
    const order = s.creatures.filter(c => c.alive).sort((a, b) => draw(s, a.id, 99) - draw(s, b.id, 99));
    for (const c of order) observe(s, c);
    for (const c of order) if (!c.action || (c.energy < 5 && c.action.type !== 'rest')) edenDecide(s, c);
    for (const c of order) serpent(s, c);
    for (const c of order) {
      const a = c.action;
      c.hunger = clamp(c.hunger + s.config.hungerRate);
      if (released() && !c.eden.clothed) c.energy = clamp(c.energy - cfg.exposureCost);
      if (a.type === 'rest') {
        c.times.rest++; c.energy = clamp(c.energy + s.config.restGain);
        if (--a.left <= 0) { judge(s, c, 'rest'); c.action = null; }
      } else if (a.route.length) {
        c.times[a.type === 'explore' ? 'explore' : 'travel']++;
        if (s.tick % s.config.moveEvery === 0) { [c.x, c.y] = a.route.shift(); c.energy = clamp(c.energy - s.config.moveCost); }
        if (!a.route.length && a.type === 'explore') { judge(s, c, 'explore'); c.action = null; }
      } else if (a.type === 'explore') { c.action = null; }
      else if (a.type === 'gather') {
        c.times.gather++;
        if (--a.left <= 0) {
          const p = s.patches.find(p => p.id === a.patch), take = Math.min(p.stock, 4 + (c.eden.tool ? cfg.toolBonus : 0));
          p.stock -= take; s.ledger.consumed += take; c.consumed += take; if (p.gift) c.giftConsumed += take;
          c.hunger = clamp(c.hunger - take * 4); c.energy = clamp(c.energy + take * 2);
          if (take > 0 && !p.gift) c.skills[p.id] = Math.min(1, (c.skills[p.id] ?? 0) + s.config.learning * take / 4);
          c.known[p.id] = { expected: p.stock, last: s.tick };
          event(s, take ? `Ate ${take.toFixed(1)} from ${p.name}.` : `Found ${p.name} empty.`, c);
          judge(s, c, 'gather', ` at ${p.name}`); c.action = null;
        }
      } else { // cultivate or craft: work in place
        c.times.work++; c.energy = clamp(c.energy - cfg.workCost);
        if (--a.left <= 0) {
          if (a.type === 'cultivate' && !s.patches.some(p => p.x === c.x && p.y === c.y) && !s.patches.some(p => p.field && p.owner === c.id)) {
            const p = { id: 'f' + s.patches.length, name: `${c.name}'s field`, x: c.x, y: c.y, stock: 0, capacity: cfg.fieldCapacity, regen: cfg.fieldRegen, gift: false, field: true, readyTick: s.tick + cfg.growTicks, owner: c.id };
            s.patches.push(p); c.known[p.id] = { expected: 0, last: s.tick };
            event(s, `${c.name} tilled a field. It will bear food in ${Math.round(cfg.growTicks / DAY)} days.`);
          } else if (a.type === 'craft') { c.eden[a.item === 'tool' ? 'tool' : 'clothed'] = true; event(s, `Made ${a.item === 'tool' ? 'a tool' : 'clothing'}.`, c); }
          judge(s, c, a.type); c.action = null;
        }
      }
      if (released()) {
        c.starving = c.hunger >= 99 ? c.starving + 1 : 0;
        if (c.starving >= s.config.starveTicks) { c.alive = false; c.death = { tick: s.tick, cause: 'Sustained food deprivation' }; c.action = null; event(s, `${c.name} died from sustained food deprivation.`); }
      } else c.starving = 0;
    }
  }
  return s;
}

export function edenMetrics(s) {
  const E = s.eden, alive = s.creatures.filter(c => c.alive);
  return { phase: E.phase, fallTick: E.fallTick, firstEater: E.firstEater, decisions: E.decisions, overrides: E.overrides,
    guidedShare: E.decisions ? E.overrides / E.decisions : 0, deliberations: E.deliberations.length,
    fields: s.patches.filter(p => p.field).length, clothed: alive.filter(c => c.eden.clothed).length, tools: alive.filter(c => c.eden.tool).length };
}
