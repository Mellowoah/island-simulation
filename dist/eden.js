// Eden world: a separate scenario built on the island core. See docs/EDEN-DESIGN.md.
// Phases: guided (Creator's warning at birth, Creator leads choices that fall outside what is best,
// no death) -> released (first creature to eat from the tree; everyone released at once).
import { W, DAY, clamp, land, path, createWorld, decide, event, noise2, seedKey, STREAMS } from './sim.js';

export const EDEN_VERSION = 2;
export const EDEN_DEFAULTS = {
  tree: [13, 12],          // "in the midst of the garden"; next to where creatures begin
  curiosityMin: 0.2, curiosityMax: 0.9,
  beauty: 0.5,             // "pleasing to the eye"
  wFood: 1, wEye: 0.6, wWisdom: 1.2, wWarn: 3, temperature: 0.5,
  credenceStep: 0.15,      // how much each hearing of the serpent's claim raises credence
  hungerGuide: 30, energyGuide: 30, wanderLimit: 10,
  cursedRegen: 0.5, exposureCost: 0.02,
  cultivateWork: 120, workCost: 0.05, growTicks: Math.round(0.5 * DAY), // first harvest after half a year
  fieldRegen: 0.015, fieldCapacity: 60, // ~22 food/day: about 1.2x one adult's need (18/day), by the sweat of the brow, not abundance
  craftWork: 180, toolBonus: 1, toolSpeed: 0.7,
  cultivateWeight: 10, clothingWeight: 9, toolWeight: 4, scarcityRef: 60,
  judgeRate: 0.5, biasCap: 6,
  // Reproduction. Time scale: 1 simulated day = 1 year (so a 20-day run is ~20 years).
  startAge: 18, menarche: 15, menopause: 40, maleMaturity: 15,
  fecundability: 0.2,       // chance of conception per month with a partner nearby (couples: 0.15-0.25)
  gestation: 0.75,          // years (9 months)
  postpartum: 1.8,          // years of lactational infertility -> ~3-year birth interval with waiting time
  weanAge: 5,               // years: children younger than this stay with their mother and share her food
  childHunger: 0.5,         // a dependent child's hunger rises at half the adult rate
  mateRadius: 4, fedHunger: 40, fedEnergy: 40,
  birthCost: 15,            // energy, after release only ("in pain you shall bring forth children", Gen 3:16)
  maleRatio: 0.512,         // probability a birth is male (~105 boys per 100 girls)
  heritability: 0.4,        // curiosity: child = mean + h2 x (midparent - mean) + noise
  populationCap: 96,        // technical limit for phone performance; conception stops at the cap (reported)
  // Step 1: senses and needs. "A river went out of Eden to water the garden" (Gen 2:10).
  springs: [['River of Eden', 11, 14], ['East spring', 25, 9], ['South-east spring', 24, 19]],
  thirstRate: 0.4,          // per minute; with thirstDeathTicks, death by thirst comes ~7x sooner than by hunger
  thirstDeathTicks: 40,     //   (rule of thumb: ~3 days without water vs ~3 weeks without food)
  thirstWeight: 1.1, thirstGuide: 30,
  senseFloor: 0.25,         // sight never falls below a quarter of normal
  senseHungerSpan: 50, senseThirstSpan: 50, senseEnergySpan: 40, senseHealthSpan: 50,
  injuryChance: 0.002, injuryDamage: 15, // per step on the ground, after release only
  illnessRate: 0.05,        // health lost per minute while starving or parched (hunger or thirst >= 80), after release only
  restHeal: 0.15, baseHeal: 0.01, healthRestWeight: 0.3, healthGuide: 30,
  urgentThirst: 60, urgentHunger: 70, // a released creature breaks off what it is doing when a need becomes urgent (if it knows where to go)
  // One of many worlds: the biblical reading of what follows the fall (all off by default = original behaviour).
  restoration: false,       // after the fall the Creator calls each creature once a year; those who turn back are guided, fed and kept from want
  fallAgain: true,          // a restored creature can be drawn away again by a tempter (traditions differ; this is a setting)
  tempters: 0,              // demons: separate beings directed by the deceiver. They can only whisper; they cannot touch or force anyone
  wReturnNeed: 1, wReturnWord: 1, returnBar: 2.2, // the creature's own weighing of the call: its need, the word it heard, its belief in the deceiver's claim
  provideAt: 79,            // the Creator gives bread or water to a restored creature before want can harm it (hunger or thirst at this level)
  guidanceRate: 1,          // Island Lab setup input: share of months in which the Creator steps in for a creature. 1 = original behaviour (always).
  serpentSilentYears: 0,    // Island Lab setup input (guidance length): the serpent stays silent for this many years. 0 = original behaviour.
};
const YEAR = DAY;
const SYL = ['ka','lo','mi','ne','ra','su','te','vi','ze','do','an','el','or','ul','ya','be'];
const age = (s, c) => (s.tick - c.eden.born) / YEAR;
// A young child stays with its mother (or, if she has died, its father) and shares their food.
const carer = (s, c) => { if (c.eden.mother === null || age(s, c) >= s.eden.config.weanAge) return null; const m = s.creatures[c.eden.mother], f = s.creatures[c.eden.father]; return m?.alive ? m : f?.alive ? f : null; };
const dependent = (s, c) => carer(s, c) !== null;
const WARNING = 'The Creator: eat freely from the garden, but not from the tree of the knowledge of good and evil. Eating from it brings death.';
const CLAIM = 'The serpent: you will not die. Your eyes will be opened, and you will know good and evil.';
// Salts come from STREAMS in sim.js. Do not pass a raw number: ranges must not overlap.
const draw = (s, id, salt) => noise2(seedKey(s.seed), s.tick, id, salt);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function createEden(seed = 41, overrides = {}, edenOverrides = {}) {
  const s = createWorld(seed, overrides);
  const cfg = { ...EDEN_DEFAULTS, ...edenOverrides };
  const [tx, ty] = cfg.tree;
  if (!land(tx, ty, false)) throw Error('The tree must stand on land');
  s.mode = 'eden';
  s.eden = { version: EDEN_VERSION, births: 0, capReached: 0, phase: 'guided', tree: { x: tx, y: ty }, config: cfg, fallTick: null, firstEater: null,
    decisions: 0, overrides: 0, serpentSpoke: null, deliberations: [], deaths: {},
    springs: cfg.springs.map(([name, x, y], i) => { if (!land(x, y, false)) throw Error('A spring must be on land'); return { id: 'w' + i, name, x, y }; }) };
  const k = seedKey(s.seed);
  for (const c of s.creatures) {
    c.times.work = 0;
    c.eden = { curiosity: cfg.curiosityMin + noise2(k, 0, c.id, STREAMS.birthCuriosity[0]) * (cfg.curiosityMax - cfg.curiosityMin),
      instruction: { source: 'Creator', text: WARNING, tick: 0 }, warning: 1, hearings: 0, credence: 0, lastSerpent: null,
      clothed: false, tool: false, bias: { rest: 0, explore: 0, gather: 0, cultivate: 0, craft: 0, drink: 0 }, judged: 0, guided: 0,
      sex: c.id % 2 ? 'M' : 'F', born: -cfg.startAge * YEAR, mother: null, father: null, pregnant: null, births: [], children: [],
      thirst: 0, parched: 0, health: 100, water: {}, sight: s.config.perception, work: { clothing: 0, tool: 0, cultivate: 0 } };
    event(s, 'Warned by the Creator: do not eat from the tree.', c);
  }
  event(s, 'Eden begins. Each creature is warned not to eat from the tree. The Creator guides them.');
  return s;
}

// The Creator's view: knows true stocks and every spring BY DESIGN (omniscient). Creatures never do. Returns a replacement action only when the creature's
// own choice falls outside what is best for it; otherwise null (the choice stands as its own).
function creatorBest(s, c) {
  const cfg = s.eden.config, own = c.action, n = needs(s, c);
  if (n.thirst || n.tired || n.hungry) {
    if (serving(s, c, own, n)) return null; // its own choice already meets a real need: it stands
    if (n.thirst) {
      const b = nearestWater(s, c, false);
      if (b) return { type: 'drink', patch: null, action: { type: 'drink', spring: b.w.id, route: b.r, left: 3 }, reason: `Thirsty: the Creator leads it to ${b.w.name}.` };
    }
    if (n.tired) return { type: 'rest', patch: null, action: { type: 'rest', left: 28 }, reason: 'Tired: the Creator leads it to rest.' };
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
      for (let i = 0; i <= STREAMS.guideX[1] - STREAMS.guideX[0]; i++) {
        const x = p.x + Math.round((draw(s, c.id, STREAMS.guideX[0] + i) * 2 - 1) * L), y = p.y + Math.round((draw(s, c.id, STREAMS.guideY[0] + i) * 2 - 1) * L);
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

// Sight depends on condition: starving, parched, exhausted or hurt creatures see less.
export function senseRadius(s, c) {
  const e = c.eden, cfg = s.eden.config;
  const f = Math.min(1, (100 - c.hunger) / cfg.senseHungerSpan, (100 - e.thirst) / cfg.senseThirstSpan, c.energy / cfg.senseEnergySpan, e.health / cfg.senseHealthSpan);
  return Math.max(1, Math.round(s.config.perception * Math.max(cfg.senseFloor, f)));
}

function edenObserve(s, c) {
  const r = c.eden.sight = senseRadius(s, c);
  c.visited[c.y * W + c.x] = true;
  for (const p of s.patches) if (Math.abs(p.x - c.x) + Math.abs(p.y - c.y) <= r) {
    if (!c.known[p.id]) event(s, `Discovered ${p.name}.`, c);
    const k = c.known[p.id], a = s.config.expectationRate;
    c.known[p.id] = { expected: k ? k.expected * (1 - a) + p.stock * a : p.stock, last: s.tick };
  }
  for (const w of s.eden.springs) if (!c.eden.water[w.id] && Math.abs(w.x - c.x) + Math.abs(w.y - c.y) <= r) { c.eden.water[w.id] = true; event(s, `Found water: ${w.name}.`, c); }
}

// A pressing need interrupts the current action. While guided, the Creator steps in as soon as a need
// crosses its guidance line; once released, a creature breaks off only when the need is urgent and it knows
// where to meet it.
// Needs above the Creator's guidance lines, and whether an action meets one of them.
function needs(s, c) { const cfg = s.eden.config; return { thirst: c.eden.thirst >= cfg.thirstGuide, tired: c.energy < cfg.energyGuide || c.eden.health < cfg.healthGuide, hungry: c.hunger >= cfg.hungerGuide }; }
// Creator only, and only while guided. Live stock is allowed here because the Creator is omniscient.
// A creature's own interrupt (pressing, once released) must not call this.
function serving(s, c, a, n) {
  if (a.type === 'drink') return n.thirst;
  if (a.type === 'rest') return n.tired;
  if (a.type === 'gather') return n.hungry && (s.patches.find(p => p.id === a.patch)?.stock ?? 0) >= 4;
  return false;
}

// Whether the Creator steps in for this creature this month. Always true at the default rate of 1 (no draw is made).
const MONTH = 120;
export const led = (s, c) => { const r = s.eden.config.guidanceRate ?? 1; return r >= 1 || noise2(seedKey(s.seed), Math.floor(s.tick / MONTH), c.id, STREAMS.guidanceLapse[0]) < r; };

function pressing(s, c) {
  const a = c.action, cfg = s.eden.config, e = c.eden;
  if (!a) return false;
  if ((s.eden.phase === 'guided' && led(s, c)) || e.covered) { const n = needs(s, c); return (n.thirst || n.tired || n.hungry) && !serving(s, c, a, n); }
  // Released: remembered water and remembered food only. Live stock is hidden until observe() writes it,
  // the same rule as decide() on the main island.
  if (e.thirst >= cfg.urgentThirst && a.type !== 'drink' && Object.keys(e.water).length) return true;
  if (c.hunger >= cfg.urgentHunger && a.type !== 'gather' && a.type !== 'drink' && Object.keys(c.known).some(k => c.known[k].expected >= 4)) return true;
  return false;
}

function nearestWater(s, c, knownOnly) {
  let best = null;
  for (const w of s.eden.springs) {
    if (knownOnly && !c.eden.water[w.id]) continue;
    const r = path(c.x, c.y, w.x, w.y, s.bridge);
    if (!r.length && (c.x !== w.x || c.y !== w.y)) continue;
    if (!best || r.length < best.r.length) best = { w, r };
  }
  return best;
}

function scarcity(s, c) {
  const known = Object.values(c.known).reduce((n, k) => n + k.expected, 0);
  return 1 - Math.min(1, known / s.eden.config.scarcityRef);
}

function edenDecide(s, c) {
  decide(s, c); // the creature's own scored options (same rules as the main island)
  const E = s.eden, cfg = E.config, d = c.decision, released = E.phase === 'released', e = c.eden;
  // Its own choice, from its own needs (and, once released, its own learned judgements).
  const opts = d.options.map(o => ({ ...o, score: o.score + (released ? (e.bias[o.type] ?? 0) : 0) }));
  const rest = opts.find(o => o.type === 'rest');
  if (rest && e.health < 100) { rest.score += (100 - e.health) * cfg.healthRestWeight; rest.reason += ` Health ${Math.round(e.health)}.`; }
  const water = nearestWater(s, c, true);
  if (water) opts.push({ type: 'drink', spring: water.w.id, score: (e.thirst - 8) * cfg.thirstWeight - water.r.length * 0.35 + (released ? e.bias.drink : 0), reason: `Thirst ${Math.round(e.thirst)} · ${water.w.name} ${water.r.length} tiles away` });
  if (released) {
    const here = !s.patches.some(p => p.x === c.x && p.y === c.y) && !(c.x === E.tree.x && c.y === E.tree.y);
    const ownsField = s.patches.some(p => p.field && p.owner === c.id);
    if (here && !ownsField && c.energy > 40) opts.push({ type: 'cultivate', score: cfg.cultivateWeight * scarcity(s, c) * (c.energy / 100) + e.bias.cultivate, reason: `Food I know of feels scarce (${Math.round(scarcity(s, c) * 100)}%). Till the ground here.` });
    if (!e.clothed) opts.push({ type: 'craft', item: 'clothing', score: cfg.clothingWeight * (1 - c.energy / 100) + 2 + e.bias.craft, reason: `Exposed: make clothing${e.work.clothing ? ` (${Math.round(100 * e.work.clothing / cfg.craftWork)}% done)` : ''}.` });
    else if (!e.tool && c.energy > 50) opts.push({ type: 'craft', item: 'tool', score: cfg.toolWeight + e.bias.craft, reason: 'Make a tool to work and gather better.' });
  }
  const choice = c.energy < 10 ? opts[0] : [...opts].sort((a, b) => b.score - a.score)[0];
  d.options = opts; d.selected = choice.type; d.patch = choice.patch ?? null; d.item = choice.item ?? null; d.spring = choice.spring ?? null;
  d.sight = e.sight; d.thirst = e.thirst; d.health = e.health;
  if (choice.type === 'cultivate') c.action = { type: 'cultivate', route: [], left: Math.max(1, Math.round(cfg.cultivateWork * (e.tool ? cfg.toolSpeed : 1)) - e.work.cultivate) };
  else if (choice.type === 'craft') c.action = { type: 'craft', item: choice.item, route: [], left: Math.max(1, cfg.craftWork - e.work[choice.item]) };
  else if (choice.type === 'drink') c.action = { type: 'drink', spring: water.w.id, route: water.r, left: 3 };
  else if (choice.type === 'rest') c.action = { type: 'rest', left: 28 };
  else if (choice.type === 'gather' && !(c.action?.type === 'gather' && c.action.patch === choice.patch)) {
    const p = s.patches.find(p => p.id === choice.patch);
    c.action = { type: 'gather', patch: p.id, route: path(c.x, c.y, p.x, p.y, s.bridge), left: Math.max(4, Math.round(14 - 8 * (c.skills[p.id] ?? 0))) };
  } else if (choice.type === 'explore' && c.action?.type !== 'explore') {
    const x = 2 + Math.floor(draw(s, c.id, STREAMS.exploreTarget[0]) * 32), y = 2 + Math.floor(draw(s, c.id, STREAMS.exploreTarget[0] + 1) * 22);
    c.action = { type: 'explore', route: land(x, y, s.bridge) ? path(c.x, c.y, x, y, s.bridge) : [] };
  }
  if (released && e.covered) { // restored: the Creator leads again, as before the fall
    E.restored.choices++;
    const best = creatorBest(s, c);
    if (best) { E.restored.led++; d.guided = { intended: d.selected, intendedPatch: d.patch, to: best.type, patch: best.patch, reason: best.reason }; c.action = best.action; }
  } else if (!released) {
    E.decisions++;
    const best = led(s, c) ? creatorBest(s, c) : null;
    if (best) {
      E.overrides++; e.guided++;
      d.guided = { intended: d.selected, intendedPatch: d.patch, to: best.type, patch: best.patch, reason: best.reason };
      c.action = best.action;
    }
  } else d.own = true;
  c.action.start = { hunger: c.hunger, energy: c.energy, thirst: e.thirst, health: e.health };
}

function judge(s, c, type, extra = '') {
  if (s.eden.phase !== 'released' || !c.action?.start) return;
  const st = c.action.start, good = c.hunger < st.hunger - 0.5 || c.energy > st.energy + 1 || c.eden.thirst < (st.thirst ?? 0) - 1 || c.eden.health > (st.health ?? 100) + 1;
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

// ---- After the fall: the call to turn back, and the deceiver's tempters (both off by default) ----
// Biblical reading used here: everyone is released by the first eating; the Creator then calls each one, and
// each answers for itself; those who turn back live in the same fallen world but are led, fed and kept from want.
// The deceiver cannot force anyone. His demons are separate beings that seek out creatures and whisper the same lie.
const logistic = (U, t) => 1 / (1 + Math.exp(-U / t));
function afterFall(s, order) {
  const E = s.eden, cfg = E.config;
  E.restored ??= { calls: 0, returned: 0, left: 0, bread: 0, whispers: 0, choices: 0, led: 0, answers: [] };
  const note = a => { E.restored.answers.push(a); if (E.restored.answers.length > 500) E.restored.answers.shift(); };
  if (cfg.restoration) for (const c of order) {
    const e = c.eden;
    if (!c.alive || e.covered || dependent(s, c) || (s.tick + c.id * 53) % YEAR !== 0) continue;
    const need = Math.max(c.hunger, e.thirst, 100 - e.health) / 100, word = 0.5 + 0.5 * e.warning, doubt = e.curiosity * e.credence;
    const U = cfg.wReturnNeed * need + cfg.wReturnWord * word - cfg.wWisdom * doubt - cfg.returnBar;
    const P = logistic(U, cfg.temperature), r = draw(s, c.id, STREAMS.returnChoice[0]), yes = r < P;
    E.restored.calls++; note({ tick: s.tick, id: c.id, kind: 'call', need, word, doubt, U, P, draw: r, yes });
    if (yes) { e.covered = true; e.coveredAt = s.tick; e.warning = 1; E.restored.returned++; event(s, `The Creator called. I turned back (chance was ${(P * 100).toFixed(1)}%). He leads me again.`, c); }
  }
  if (!cfg.tempters) return;
  E.tempters ??= Array.from({ length: cfg.tempters }, (_, i) => ({ id: i, x: E.tree.x, y: E.tree.y, target: null }));
  const free = c => c.alive && !dependent(s, c) && (c.eden.lastSerpent === null || s.tick - c.eden.lastSerpent >= DAY);
  for (const t of E.tempters) {
    let c = t.target === null ? null : s.creatures[t.target];
    if (!c || !free(c)) {
      // The deceiver's direction: go first for those who turned back (if they can be drawn away), otherwise for anyone.
      const taken = new Set(E.tempters.filter(o => o !== t && o.target !== null).map(o => o.target));
      const pool = order.filter(o => free(o) && !taken.has(o.id));
      const prize = cfg.fallAgain ? pool.filter(o => o.eden.covered) : [];
      const from = prize.length ? prize : pool.filter(o => !o.eden.covered);
      c = from.sort((a, b) => dist(a, t) - dist(b, t) || a.id - b.id)[0] ?? null;
      t.target = c ? c.id : null;
    }
    if (!c) continue;
    if (dist(c, t) > 1) { if (s.tick % s.config.moveEvery === 0) { t.x += Math.sign(c.x - t.x); t.y += Math.sign(c.y - t.y); } continue; }
    const e = c.eden;
    e.hearings++; e.lastSerpent = s.tick; e.credence = 1 - (1 - cfg.credenceStep) ** e.hearings; E.restored.whispers++; t.target = null;
    if (!e.covered) { event(s, 'A whisper: "You will not die. You need no one." (a claim, not verified)', c); continue; }
    if (!cfg.fallAgain) { event(s, 'A whisper came. It has no hold on me now.', c); continue; }
    // The same weighing as at the tree: its want and its belief in the claim, against the word it holds.
    const food = c.hunger / 100, wisdom = e.curiosity * e.credence;
    const U = cfg.wFood * food + cfg.wWisdom * wisdom - cfg.wWarn * e.warning;
    const P = logistic(U, cfg.temperature), r = draw(s, c.id, STREAMS.leaveChoice[0]), left = r < P;
    note({ tick: s.tick, id: c.id, kind: 'whisper', food, wisdom, warning: e.warning, U, P, draw: r, yes: left });
    if (left) { e.covered = false; E.restored.left++; event(s, `A whisper came and I went my own way again (chance was ${(P * 100).toFixed(1)}%).`, c); }
    else event(s, `A whisper came. I held to the Creator (chance of leaving was ${(P * 100).toFixed(1)}%).`, c);
  }
}

function serpent(s, c) {
  const E = s.eden, cfg = E.config, e = c.eden;
  if (E.phase !== 'guided' || s.tick < (cfg.serpentSilentYears ?? 0) * YEAR || dependent(s, c) || dist(c, E.tree) > 1 || (e.lastSerpent !== null && s.tick - e.lastSerpent < DAY)) return;
  e.hearings++; e.lastSerpent = s.tick; e.credence = 1 - (1 - cfg.credenceStep) ** e.hearings;
  E.serpentSpoke = { tick: s.tick, id: c.id };
  event(s, 'The serpent spoke from the tree: "You will not die." (a claim, not verified)', c);
  const food = c.hunger / 100, eye = cfg.beauty, wisdom = e.curiosity * e.credence, warning = e.warning;
  const U = cfg.wFood * food + cfg.wEye * eye + cfg.wWisdom * wisdom - cfg.wWarn * warning;
  const P = 1 / (1 + Math.exp(-U / cfg.temperature)), r = draw(s, c.id, STREAMS.treeChoice[0]), ate = r < P;
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
    const order = s.creatures.filter(c => c.alive).sort((a, b) => draw(s, a.id, STREAMS.order[0]) - draw(s, b.id, STREAMS.order[0]));
    for (const c of order) edenObserve(s, c);
    for (const c of order) if (!dependent(s, c) && (!c.action || (c.energy < 5 && c.action.type !== 'rest') || pressing(s, c))) edenDecide(s, c);
    for (const c of order) serpent(s, c);
    if (E.phase === 'released' && (cfg.restoration || cfg.tempters)) afterFall(s, order);
    for (const c of order) {
      if (dependent(s, c)) {
        const m = carer(s, c);
        c.x = m.x; c.y = m.y; c.action = null; c.times.rest++;
        c.hunger = clamp(c.hunger + s.config.hungerRate * cfg.childHunger);
        c.eden.thirst = clamp(c.eden.thirst + cfg.thirstRate * cfg.childHunger);
      } else {
      if (!c.action) edenDecide(s, c); // a child just weaned, or an orphan
      const a = c.action;
      c.hunger = clamp(c.hunger + s.config.hungerRate);
      c.eden.thirst = clamp(c.eden.thirst + cfg.thirstRate);
      if (released() && !c.eden.clothed) c.energy = clamp(c.energy - cfg.exposureCost);
      if (a.type === 'rest') {
        c.times.rest++; c.energy = clamp(c.energy + s.config.restGain);
        if (--a.left <= 0) { judge(s, c, 'rest'); c.action = null; }
      } else if (a.route.length) {
        c.times[a.type === 'explore' ? 'explore' : 'travel']++;
        if (s.tick % s.config.moveEvery === 0) {
          [c.x, c.y] = a.route.shift(); c.energy = clamp(c.energy - s.config.moveCost * (1 + (100 - c.eden.health) / 100));
          if (released() && draw(s, c.id, STREAMS.injury[0]) < cfg.injuryChance) { c.eden.health = clamp(c.eden.health - cfg.injuryDamage); event(s, 'Fell and was hurt.', c); }
        }
        if (!a.route.length && a.type === 'explore') { judge(s, c, 'explore'); c.action = null; }
      } else if (a.type === 'explore') { c.action = null; }
      else if (a.type === 'drink') {
        if (--a.left <= 0) {
          c.eden.thirst = 0;
          for (const k of c.eden.children.map(i => s.creatures[i]).filter(k => k.alive && dependent(s, k))) k.eden.thirst = 0;
          const w = s.eden.springs.find(w => w.id === a.spring); c.eden.water[w.id] = true;
          event(s, `Drank at ${w.name}.`, c); judge(s, c, 'drink'); c.action = null;
        }
      } else if (a.type === 'gather') {
        c.times.gather++;
        if (--a.left <= 0) {
          const p = s.patches.find(p => p.id === a.patch), take = Math.min(p.stock, 4 + (c.eden.tool ? cfg.toolBonus : 0));
          p.stock -= take; s.ledger.consumed += take; c.consumed += take; if (p.gift) c.giftConsumed += take;
          const kids = c.eden.children.map(i => s.creatures[i]).filter(k => k.alive && dependent(s, k)), share = take / (1 + kids.length);
          c.hunger = clamp(c.hunger - share * 4); c.energy = clamp(c.energy + share * 2);
          for (const k of kids) { k.hunger = clamp(k.hunger - share * 4); k.energy = clamp(k.energy + share * 2); k.consumed += share; }
          c.consumed -= take - share;
          if (take > 0 && !p.gift) c.skills[p.id] = Math.min(1, (c.skills[p.id] ?? 0) + s.config.learning * take / 4);
          c.known[p.id] = { expected: p.stock, last: s.tick };
          event(s, take ? `Ate ${take.toFixed(1)} from ${p.name}.` : `Found ${p.name} empty.`, c);
          judge(s, c, 'gather', ` at ${p.name}`); c.action = null;
        }
      } else { // cultivate or craft: work in place
        c.times.work++; c.energy = clamp(c.energy - cfg.workCost); c.eden.work[a.type === 'craft' ? a.item : 'cultivate']++; // progress is kept if interrupted
        if (--a.left <= 0) {
          c.eden.work[a.type === 'craft' ? a.item : 'cultivate'] = 0;
          if (a.type === 'cultivate' && !s.patches.some(p => p.x === c.x && p.y === c.y) && !s.patches.some(p => p.field && p.owner === c.id)) {
            const p = { id: 'f' + s.patches.length, name: `${c.name}'s field`, x: c.x, y: c.y, stock: 0, capacity: cfg.fieldCapacity, regen: cfg.fieldRegen, gift: false, field: true, readyTick: s.tick + cfg.growTicks, owner: c.id };
            s.patches.push(p); c.known[p.id] = { expected: 0, last: s.tick };
            event(s, `${c.name} tilled a field. It will bear food in about ${(cfg.growTicks / DAY * 12).toFixed(0)} months.`);
          } else if (a.type === 'craft') { c.eden[a.item === 'tool' ? 'tool' : 'clothed'] = true; event(s, `Made ${a.item === 'tool' ? 'a tool' : 'clothing'}.`, c); }
          judge(s, c, a.type); c.action = null;
        }
      }
      }
      health(s, c, released());
      if (c.eden.covered) { // provision: fed and given water before want can harm
        if (c.hunger >= cfg.provideAt) { c.hunger = cfg.hungerGuide; E.restored.bread++; }
        if (c.eden.thirst >= cfg.provideAt) { c.eden.thirst = cfg.thirstGuide; E.restored.bread++; }
      }
      if (released()) {
        c.starving = c.hunger >= 99 ? c.starving + 1 : 0;
        c.eden.parched = c.eden.thirst >= 99 ? c.eden.parched + 1 : 0;
        const cause = c.starving >= s.config.starveTicks ? 'Sustained food deprivation' : c.eden.parched >= cfg.thirstDeathTicks ? 'Thirst' : c.eden.health <= 0 ? 'Injury and illness' : null;
        if (cause) { c.alive = false; c.death = { tick: s.tick, cause, ...(c.eden.covered ? { covered: true } : {}) }; c.action = null; s.eden.deaths[cause] = (s.eden.deaths[cause] ?? 0) + 1; event(s, `${c.name} died: ${cause.toLowerCase()}.`); }
      } else { c.starving = 0; c.eden.parched = 0; }
    }
    reproduce(s, order);
    for (const c of s.creatures) if (c.alive && dependent(s, c)) { const m = carer(s, c); c.x = m.x; c.y = m.y; } // children move with their carer
  }
  return s;
}

// Health: harm only after release (no injury or illness in the garden before the fall).
function health(s, c, released) {
  const e = c.eden, cfg = s.eden.config;
  if (!released) { e.health = 100; return; }
  if (c.hunger >= 80 || e.thirst >= 80) e.health = clamp(e.health - cfg.illnessRate);
  else if (c.action?.type === 'rest') e.health = clamp(e.health + cfg.restHeal);
  else if (c.hunger < 50 && e.thirst < 50) e.health = clamp(e.health + cfg.baseHeal);
}

function adultFed(s, c) { const cfg = s.eden.config; return c.alive && !dependent(s, c) && c.hunger < cfg.fedHunger && c.energy > cfg.fedEnergy && c.eden.thirst < cfg.fedHunger; }

// Fertility from demographic figures: conception hazard per tick so that P(conceive in one month) = fecundability.
function reproduce(s, order) {
  const E = s.eden, cfg = E.config, hazard = 1 - (1 - cfg.fecundability) ** (1 / (YEAR / 12));
  const born = [];
  for (const c of order) {
    const e = c.eden;
    if (e.pregnant && s.tick >= e.pregnant.due) {
      const f = s.creatures[e.pregnant.father]; e.pregnant = null;
      if (!c.alive) continue;
      born.push({ mother: c, father: f });
    }
    if (!c.alive || e.sex !== 'F' || e.pregnant || !adultFed(s, c)) continue;
    const a = age(s, c);
    if (a < cfg.menarche || a >= cfg.menopause) continue;
    if (e.births.length && s.tick - e.births.at(-1) < cfg.postpartum * YEAR) continue;
    if (s.creatures.filter(x => x.alive).length + s.creatures.filter(x => x.alive && x.eden.pregnant).length + born.length >= cfg.populationCap) { E.capReached++; continue; }
    const mates = order.filter(m => m.eden.sex === 'M' && adultFed(s, m) && age(s, m) >= cfg.maleMaturity && dist(m, c) <= cfg.mateRadius);
    if (!mates.length) continue;
    if (draw(s, c.id, STREAMS.conception[0]) < hazard) {
      const m = mates[Math.floor(draw(s, c.id, STREAMS.conception[0] + 1) * mates.length)];
      e.pregnant = { due: s.tick + Math.round(cfg.gestation * YEAR), father: m.id, since: s.tick };
      event(s, `Conceived a child with ${m.name}.`, c);
    }
  }
  for (const { mother, father } of born) birth(s, mother, father);
}

function birth(s, m, f) {
  const E = s.eden, cfg = E.config, id = s.creatures.length, k = seedKey(s.seed);
  const r = i => noise2(k, s.tick, id, STREAMS.newborn[0] + i - 1);
  const name = (SYL[Math.floor(r(1) * 16)] + SYL[Math.floor(r(2) * 16)]).replace(/^./, x => x.toUpperCase());
  const mean = (cfg.curiosityMin + cfg.curiosityMax) / 2, mid = (m.eden.curiosity + f.eden.curiosity) / 2;
  const noise = (r(3) + r(4) + r(5) - 1.5) * 0.2; // approx. normal, sd ~0.1
  const curiosity = clamp(mean + cfg.heritability * (mid - mean) + noise, cfg.curiosityMin, cfg.curiosityMax);
  const fallen = E.phase === 'released';
  const c = { id, name, x: m.x, y: m.y, alive: true, hunger: 20, energy: 80, starving: 0, known: {}, skills: { a: 0, b: 0 }, visited: {},
    action: null, decision: null, memories: [], consumed: 0, giftConsumed: 0, times: { travel: 0, gather: 0, rest: 0, explore: 0, work: 0 }, death: null,
    eden: { curiosity, instruction: fallen ? null : { source: 'Creator', text: WARNING, tick: s.tick }, warning: fallen ? 0 : 1, hearings: 0, credence: 0, lastSerpent: null,
      clothed: false, tool: false, bias: { rest: 0, explore: 0, gather: 0, cultivate: 0, craft: 0, drink: 0 }, judged: 0, guided: 0,
      sex: r(6) < cfg.maleRatio ? 'M' : 'F', born: s.tick, mother: m.id, father: f.id, pregnant: null, births: [], children: [],
      thirst: 0, parched: 0, health: 100, water: { ...m.eden.water }, sight: s.config.perception, work: { clothing: 0, tool: 0, cultivate: 0 } } };
  s.creatures.push(c); E.births++;
  m.eden.births.push(s.tick); m.eden.children.push(id); f.eden.children.push(id);
  if (fallen) m.energy = clamp(m.energy - cfg.birthCost);
  event(s, `${m.name} gave birth to ${name} (${c.eden.sex === 'M' ? 'a son' : 'a daughter'}), with ${f.name}.${fallen ? '' : ' The Creator warns the child too.'}`);
  if (!fallen) event(s, 'Warned by the Creator: do not eat from the tree.', c);
}

export function edenMetrics(s) {
  const E = s.eden, alive = s.creatures.filter(c => c.alive);
  return { phase: E.phase, fallTick: E.fallTick, firstEater: E.firstEater, decisions: E.decisions, overrides: E.overrides,
    guidedShare: E.decisions ? E.overrides / E.decisions : 0, deliberations: E.deliberations.length,
    population: alive.length, births: E.births, deaths: s.creatures.filter(c => !c.alive).length, children: alive.filter(c => age(s, c) < E.config.menarche).length,
    birthIntervals: s.creatures.flatMap(c => c.eden.births.slice(1).map((t, i) => (t - c.eden.births[i]) / YEAR)), capReached: E.capReached,
    deathCauses: { ...E.deaths }, meanSight: alive.length ? alive.reduce((n, c) => n + c.eden.sight, 0) / alive.length : 0,
    ...(E.restored ? { restored: { calls: E.restored.calls, returned: E.restored.returned, left: E.restored.left, bread: E.restored.bread, whispers: E.restored.whispers,
      living: alive.filter(c => c.eden.covered).length, ledShare: E.restored.choices ? E.restored.led / E.restored.choices : 0,
      deathsRestored: s.creatures.filter(c => !c.alive && c.death?.covered).length } } : {}),
    fields: s.patches.filter(p => p.field).length, clothed: alive.filter(c => c.eden.clothed).length, tools: alive.filter(c => c.eden.tool).length };
}
