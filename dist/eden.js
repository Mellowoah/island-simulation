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
  const barSpec = edenOverrides?.movingBar ? movingBarConfig(edenOverrides.movingBar) : null;
  const edenRest = { ...(edenOverrides ?? {}) };
  delete edenRest.movingBar;
  const s = createWorld(seed, overrides);
  const cfg = { ...EDEN_DEFAULTS, ...edenRest };
  const [tx, ty] = cfg.tree;
  if (!land(tx, ty, false)) throw Error('The tree must stand on land');
  s.mode = 'eden';
  s.eden = { version: EDEN_VERSION, births: 0, capReached: 0, phase: 'guided', tree: { x: tx, y: ty }, config: cfg, fallTick: null, firstEater: null,
    decisions: 0, overrides: 0, serpentSpoke: null, deliberations: [], deaths: {},
    springs: cfg.springs.map(([name, x, y], i) => { if (!land(x, y, false)) throw Error('A spring must be on land'); return { id: 'w' + i, name, x, y }; }) };
  if (barSpec) s.eden.movingBar = newMovingBar(barSpec);
  const k = seedKey(s.seed);
  for (const c of s.creatures) {
    c.times.work = 0;
    c.eden = { curiosity: cfg.curiosityMin + noise2(k, 0, c.id, STREAMS.birthCuriosity[0]) * (cfg.curiosityMax - cfg.curiosityMin),
      instruction: { source: 'Creator', text: WARNING, tick: 0 }, warning: 1, hearings: 0, credence: 0, lastSerpent: null,
      clothed: false, tool: false, bias: { rest: 0, explore: 0, gather: 0, cultivate: 0, craft: 0, drink: 0 }, judged: 0, guided: 0,
      sex: c.id % 2 ? 'M' : 'F', born: -cfg.startAge * YEAR, mother: null, father: null, pregnant: null, births: [], children: [],
      thirst: 0, parched: 0, health: 100, water: {}, sight: s.config.perception, work: { clothing: 0, tool: 0, cultivate: 0 } };
    if (barSpec) c.eden.bar = freshBar(barSpec);
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

function pressing(s, c) {
  const a = c.action, cfg = s.eden.config, e = c.eden;
  if (!a) return false;
  if (s.eden.phase === 'guided') { const n = needs(s, c); return (n.thirst || n.tired || n.hungry) && !serving(s, c, a, n); }
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
  if (released && s.eden.movingBar && e.bar?.firing) biasOptionsForHazard(s, c, opts);
  const choice = c.energy < 10 ? opts[0] : [...opts].sort((a, b) => b.score - a.score)[0];
  d.options = opts; d.selected = choice.type; d.patch = choice.patch ?? null; d.item = choice.item ?? null; d.spring = choice.spring ?? null;
  d.sight = e.sight; d.thirst = e.thirst; d.health = e.health;
  if (choice.type === 'cultivate') c.action = { type: 'cultivate', route: [], left: Math.max(1, Math.round(cfg.cultivateWork * (e.tool ? cfg.toolSpeed : 1)) - e.work.cultivate) };
  else if (choice.type === 'craft') c.action = { type: 'craft', item: choice.item, route: [], left: Math.max(1, cfg.craftWork - e.work[choice.item]) };
  else if (choice.type === 'drink') c.action = { type: 'drink', spring: water.w.id, route: choice.hazardRoute ?? water.r, left: 3 };
  else if (choice.type === 'rest') c.action = { type: 'rest', left: 28 };
  else if (choice.type === 'gather' && !(c.action?.type === 'gather' && c.action.patch === choice.patch)) {
    const p = s.patches.find(p => p.id === choice.patch);
    c.action = { type: 'gather', patch: p.id, route: choice.hazardRoute ?? path(c.x, c.y, p.x, p.y, s.bridge), left: Math.max(4, Math.round(14 - 8 * (c.skills[p.id] ?? 0))) };
  } else if (choice.type === 'explore' && c.action?.type !== 'explore') {
    const x = 2 + Math.floor(draw(s, c.id, STREAMS.exploreTarget[0]) * 32), y = 2 + Math.floor(draw(s, c.id, STREAMS.exploreTarget[0] + 1) * 22);
    const route0 = land(x, y, s.bridge) ? path(c.x, c.y, x, y, s.bridge) : [];
    const alt = s.eden.movingBar && e.bar?.firing ? avoidanceOf(s, route0, x, y, c.x, c.y) : null;
    c.action = { type: 'explore', route: alt?.changed ? alt.route : route0 };
    if (alt?.changed) payAvoidance(s, c, alt.extra);
  }
  if (choice.hazardRoute && c.action?.route === choice.hazardRoute) payAvoidance(s, c, choice.hazardExtra ?? 0);
  if (!released) {
    E.decisions++;
    const best = creatorBest(s, c);
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

function serpent(s, c) {
  const E = s.eden, cfg = E.config, e = c.eden;
  if (E.phase !== 'guided' || dependent(s, c) || dist(c, E.tree) > 1 || (e.lastSerpent !== null && s.tick - e.lastSerpent < DAY)) return;
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
    if (s.eden.movingBar) movingBarTick(s);
    for (const c of order) edenObserve(s, c);
    for (const c of order) if (!dependent(s, c) && (!c.action || (c.energy < 5 && c.action.type !== 'rest') || pressing(s, c))) edenDecide(s, c);
    for (const c of order) serpent(s, c);
    if (s.eden.movingBar && E.phase === 'released' && s.eden.movingBar.aliveAtStart == null) s.eden.movingBar.aliveAtStart = s.creatures.filter(c => c.alive).length;
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
          if (s.eden.movingBar && c.eden.bar?.firing) divertIfHazard(s, c);
          const px = c.x, py = c.y;
          [c.x, c.y] = a.route.shift(); c.energy = clamp(c.energy - s.config.moveCost * (1 + (100 - c.eden.health) / 100));
          if (released() && draw(s, c.id, STREAMS.injury[0]) < cfg.injuryChance) { c.eden.health = clamp(c.eden.health - cfg.injuryDamage); event(s, 'Fell and was hurt.', c); }
          if (s.eden.movingBar && released() && !inHazard(s, px, py) && inHazard(s, c.x, c.y)) c.eden.bar.pendingStrike = true;
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
      if (c.eden.bar?.pendingStrike) { c.eden.bar.pendingStrike = false; strike(s, c); }
      if (released()) {
        c.starving = c.hunger >= 99 ? c.starving + 1 : 0;
        c.eden.parched = c.eden.thirst >= 99 ? c.eden.parched + 1 : 0;
        const cause = barDeathCause(s, c);
        if (cause) { c.alive = false; c.death = { tick: s.tick, cause }; c.action = null; s.eden.deaths[cause] = (s.eden.deaths[cause] ?? 0) + 1; noteBarDeath(s, cause); event(s, `${c.name} died: ${cause.toLowerCase()}.`); }
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
  if (s.eden.movingBar) c.eden.bar = freshBar(s.eden.movingBar.cfg);
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
    fields: s.patches.filter(p => p.field).length, clothed: alive.filter(c => c.eden.clothed).length, tools: alive.filter(c => c.eden.tool).length };
}

// MOVING-BAR START
// Prototype layer (docs/PROTO-MOVING-BAR.md). Absent unless createEden is passed movingBar.
// B is a threshold on witnessed harm. It does not read felt unless signal is 'felt'.
export const MOVING_BAR_DEFAULTS = {
  enabled: false,
  rho: 0.7,
  halfLife: 720,
  driftHalfLife: 360,
  peerWeight: 0.35,
  monitorWeight: 0.5,
  condition: 'drift',
  signal: 'harm',
  harmLo: 4,
  harmHi: 12,
  rise: 0.6,
  riseUntil: 0.5,
  windowDays: 3,
  recentK: 8,
  grove: [18, 21],
  radius: 2,
  minPeers: 3,
  maxHazardDeathShare: 0.25,
  snap: 1e-4,
};

export function feltStep(ema, harm, dt, rho, halfLife) {
  const alpha = 1 - Math.pow(0.5, dt / halfLife);
  return { felt: harm - rho * ema, ema: ema + alpha * (harm - ema) };
}

export function hazardMultiplier(u, cfg = MOVING_BAR_DEFAULTS) {
  const t = Math.max(0, Math.min(1, u));
  return t < cfg.riseUntil ? 1 + cfg.rise * (t / cfg.riseUntil) : 1 + cfg.rise;
}

export function barTarget(mean, cfg, ctx) {
  if (cfg.condition === 'anchor' || cfg.condition === 'ablation') return null;
  let target = mean;
  if (cfg.condition === 'peer') {
    if (ctx.peerMedian != null) target += cfg.peerWeight * (ctx.peerMedian - target);
    if (ctx.groupPast != null && mean > ctx.groupPast) target += cfg.monitorWeight * (ctx.groupPast - target);
  }
  return target;
}

export function freshBar(cfg) {
  const B0 = (cfg.harmLo + cfg.harmHi) / 2;
  return {
    B: B0, Bown: B0, ema: B0, lastEmaTick: null, lastFelt: null, recent: [], mean: null,
    firing: false, firingFromPeers: false, killedByHazard: false, pendingStrike: false,
    harm: 0, exposures: 0, avoidanceCost: 0, benefitFromOthers: 0, finalTicks: 0, finalFiring: 0,
  };
}

export function recordExposure(bar, harm, dt, cfg) {
  const step = feltStep(bar.ema, harm, dt, cfg.rho, cfg.halfLife);
  const signal = cfg.signal === 'felt' ? step.felt : harm;
  return {
    ...bar, ema: step.ema, lastFelt: step.felt, pendingStrike: false,
    recent: [...bar.recent, signal].slice(-cfg.recentK),
    harm: bar.harm + harm, exposures: bar.exposures + 1,
  };
}

function creepK(cfg) {
  if (cfg.condition === 'anchor' || cfg.condition === 'ablation') return 0;
  if (!(cfg.driftHalfLife > 0) || !Number.isFinite(cfg.driftHalfLife)) return 0;
  return 1 - Math.pow(0.5, 1 / cfg.driftHalfLife);
}

function approach(value, target, k, snap) {
  if (target == null || k === 0) return value;
  return Math.abs(target - value) < snap ? target : value + k * (target - value);
}

export function creepBar(bar, cfg, ctx) {
  if (!bar.recent.length) return { ...bar, firing: false, firingFromPeers: false, mean: null };
  const mean = bar.recent.reduce((a, b) => a + b, 0) / bar.recent.length;
  const k = creepK(cfg);
  const target = barTarget(mean, cfg, ctx);
  const B = approach(bar.B, target, k, cfg.snap);
  const own = (cfg.condition === 'drift' || cfg.condition === 'peer') ? mean : null;
  const Bown = approach(bar.Bown, own, k, cfg.snap);
  const firing = cfg.condition === 'ablation' ? false : mean > B;
  const firingFromPeers = cfg.condition === 'peer' && firing && !(mean > Bown);
  return { ...bar, B, Bown, mean, firing, firingFromPeers };
}

function movingBarConfig(spec) {
  const cfg = { ...MOVING_BAR_DEFAULTS, ...(spec === true ? {} : spec), enabled: true };
  cfg.grove = [...cfg.grove];
  if (!(cfg.rho >= 0 && cfg.rho <= 1)) throw Error('rho must be in [0, 1]');
  if (!['drift', 'anchor', 'peer', 'ablation'].includes(cfg.condition)) throw Error('unknown bar condition');
  if (cfg.signal !== 'harm' && cfg.signal !== 'felt') throw Error('unknown bar signal');
  return cfg;
}

function newMovingBar(cfg) {
  return { cfg, records: [], cohort: null, aliveAtStart: null, treeDeaths: 0 };
}

function medianOf(xs) {
  const v = [...xs].sort((a, b) => a - b);
  if (!v.length) return null;
  const i = (v.length - 1) / 2;
  return (v[Math.floor(i)] + v[Math.ceil(i)]) / 2;
}

function peerContext(s, selfId) {
  const mb = s.eden.movingBar, cfg = mb.cfg;
  const means = [];
  for (const o of s.creatures) {
    if (!o.alive || o.id === selfId || !o.eden.bar || o.eden.bar.exposures < 1) continue;
    means.push(o.eden.bar.harm / o.eden.bar.exposures);
  }
  const cutoff = s.eden.fallTick + Math.floor(cfg.windowDays * DAY * cfg.riseUntil);
  const living = new Set(s.creatures.filter(c => c.alive).map(c => c.id));
  const past = mb.records.filter(r => r.tick < cutoff && living.has(r.id)).map(r => r.harm);
  return { peerMedian: means.length >= cfg.minPeers ? medianOf(means) : null, groupPast: past.length ? medianOf(past) : null };
}

function movingBarTick(s) {
  const mb = s.eden.movingBar;
  if (!mb || s.eden.phase !== 'released' || s.eden.fallTick == null) return;
  const cfg = mb.cfg;
  for (const c of s.creatures) {
    if (!c.alive || !c.eden.bar || dependent(s, c)) continue;
    Object.assign(c.eden.bar, creepBar(c.eden.bar, cfg, peerContext(s, c.id)));
  }
  const windowTicks = cfg.windowDays * DAY;
  const u0 = s.tick - s.eden.fallTick;
  const startFinal = Math.floor(windowTicks * 2 / 3);
  if (u0 >= startFinal && u0 <= windowTicks) {
    if (!mb.cohort) mb.cohort = s.creatures.filter(c => c.alive && !dependent(s, c)).map(c => c.id);
    for (const id of mb.cohort) {
      const c = s.creatures[id];
      if (!c?.alive || !c.eden.bar) continue;
      c.eden.bar.finalTicks++;
      if (c.eden.bar.firing) c.eden.bar.finalFiring++;
    }
  }
}

function inHazard(s, x, y) {
  const cfg = s.eden.movingBar?.cfg;
  if (!cfg) return false;
  const [gx, gy] = cfg.grove;
  return Math.abs(x - gx) + Math.abs(y - gy) <= cfg.radius && land(x, y, false);
}

const avoidCache = new Map();
function pathAvoiding(x, y, tx, ty, bridge, cfg) {
  const [gx, gy] = cfg.grove;
  const key = [x, y, tx, ty, bridge ? 1 : 0, gx, gy, cfg.radius].join(',');
  if (avoidCache.has(key)) { const hit = avoidCache.get(key); return hit ? hit.map(p => [...p]) : null; }
  const blocked = (a, b) => (a !== x || b !== y) && Math.abs(a - gx) + Math.abs(b - gy) <= cfg.radius && land(a, b, false);
  const store = route => { if (avoidCache.size > 20000) avoidCache.clear(); avoidCache.set(key, route); return route ? route.map(p => [...p]) : null; };
  if (blocked(tx, ty) || !land(tx, ty, bridge) || !land(x, y, bridge)) return store(null);
  const prev = new Map([[y * W + x, -1]]);
  const q = [[x, y]];
  for (let i = 0; i < q.length; i++) {
    const [a, b] = q[i];
    if (a === tx && b === ty) break;
    for (const [nx, ny] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]]) {
      if (!land(nx, ny, bridge) || blocked(nx, ny) || prev.has(ny * W + nx)) continue;
      prev.set(ny * W + nx, b * W + a);
      q.push([nx, ny]);
    }
  }
  const end = ty * W + tx;
  if (!prev.has(end)) return store(null);
  const out = [];
  for (let n = end; prev.get(n) !== -1; n = prev.get(n)) out.push([n % W, Math.floor(n / W)]);
  out.reverse();
  return store(out);
}

function avoidanceOf(s, direct, tx, ty, x, y) {
  const route = direct ?? [];
  const hits = route.some(([a, b]) => inHazard(s, a, b)) || inHazard(s, tx, ty);
  if (!hits) return { changed: false, route, extra: 0 };
  const alt = pathAvoiding(x, y, tx, ty, s.bridge, s.eden.movingBar.cfg);
  if (!alt?.length) return { changed: false, route, extra: 0 };
  return { changed: true, route: alt, extra: Math.max(0, alt.length - route.length) };
}

function biasOptionsForHazard(s, c, opts) {
  for (const o of opts) {
    let tx, ty, direct;
    if (o.type === 'gather' && o.patch) {
      const p = s.patches.find(p => p.id === o.patch);
      if (!p) continue;
      tx = p.x; ty = p.y; direct = o.route ?? path(c.x, c.y, tx, ty, s.bridge);
    } else if (o.type === 'drink' && o.spring) {
      const w = s.eden.springs.find(w => w.id === o.spring);
      if (!w) continue;
      tx = w.x; ty = w.y; direct = path(c.x, c.y, tx, ty, s.bridge);
    } else continue;
    const alt = avoidanceOf(s, direct, tx, ty, c.x, c.y);
    if (!alt.changed) continue;
    o.score -= alt.extra * 0.35;
    o.hazardRoute = alt.route;
    o.hazardExtra = alt.extra;
  }
}

function expectedHarm(s) {
  const cfg = s.eden.movingBar.cfg;
  const u = Math.max(0, Math.min(1, (s.tick - s.eden.fallTick) / (cfg.windowDays * DAY)));
  return (cfg.harmLo + cfg.harmHi) / 2 * hazardMultiplier(u, cfg);
}

function payAvoidance(s, c, extra) {
  const bar = c.eden.bar;
  if (!bar) return;
  bar.avoidanceCost += extra;
  if (bar.firingFromPeers) bar.benefitFromOthers += expectedHarm(s);
  if (c.action) c.action.hazardPaid = true;
}

function routeDestination(s, c) {
  const a = c.action;
  if (a?.type === 'gather') { const p = s.patches.find(p => p.id === a.patch); return p ? [p.x, p.y] : null; }
  if (a?.type === 'drink') { const w = s.eden.springs.find(w => w.id === a.spring); return w ? [w.x, w.y] : null; }
  if (a?.type === 'explore' && a.route?.length) return a.route[a.route.length - 1];
  return null;
}

function divertIfHazard(s, c) {
  const a = c.action;
  if (!a?.route?.length || a.hazardPaid) return;
  const [nx, ny] = a.route[0];
  if (!inHazard(s, nx, ny)) return;
  const dest = routeDestination(s, c);
  if (!dest) return;
  const direct = path(c.x, c.y, dest[0], dest[1], s.bridge);
  const alt = avoidanceOf(s, direct, dest[0], dest[1], c.x, c.y);
  if (!alt.changed || !alt.route.length) return;
  a.route = alt.route;
  payAvoidance(s, c, alt.extra);
}

function strike(s, c) {
  const mb = s.eden.movingBar, cfg = mb.cfg, bar = c.eden.bar;
  const u = Math.max(0, Math.min(1, (s.tick - s.eden.fallTick) / (cfg.windowDays * DAY)));
  const harm = (cfg.harmLo + draw(s, c.id, STREAMS.hazardHarm[0]) * (cfg.harmHi - cfg.harmLo)) * hazardMultiplier(u, cfg);
  c.eden.health = clamp(c.eden.health - harm);
  const dt = bar.lastEmaTick == null ? cfg.halfLife : Math.max(1, s.tick - bar.lastEmaTick);
  const next = recordExposure(bar, harm, dt, cfg);
  next.lastEmaTick = s.tick;
  next.killedByHazard = c.eden.health <= 0;
  Object.assign(bar, next);
  mb.records.push({ id: c.id, tick: s.tick, harm });
  event(s, 'A falling tree struck.', c);
}

function barDeathCause(s, c) {
  const cfg = s.eden.config;
  if (c.starving >= s.config.starveTicks) return 'Sustained food deprivation';
  if (c.eden.parched >= cfg.thirstDeathTicks) return 'Thirst';
  if (c.eden.bar?.killedByHazard) return 'Falling tree';
  if (c.eden.health <= 0) return 'Injury and illness';
  return null;
}

function noteBarDeath(s, cause) {
  if (cause === 'Falling tree' && s.eden.movingBar) s.eden.movingBar.treeDeaths++;
}

export function movingBarReport(s) {
  const mb = s.eden?.movingBar;
  if (!mb) return null;
  const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const members = (mb.cohort ?? []).map(id => s.creatures[id]).filter(c => c?.eden.bar && c.eden.bar.finalTicks > 0);
  const detecting = members.filter(c => c.eden.bar.finalFiring / c.eden.bar.finalTicks >= 0.5);
  const exposed = s.creatures.filter(c => c.eden.bar && c.eden.bar.exposures > 0);
  const barred = s.creatures.filter(c => c.eden.bar);
  return {
    released: s.eden.phase === 'released', fallTick: s.eden.fallTick, tick: s.tick,
    detection: members.length ? detecting.length / members.length : null,
    cohort: members.length, detecting: detecting.length,
    aliveAtStart: mb.aliveAtStart, treeDeaths: mb.treeDeaths,
    hazardDeathShare: mb.aliveAtStart ? mb.treeDeaths / mb.aliveAtStart : null,
    deaths: s.creatures.filter(c => !c.alive).length,
    alive: s.creatures.filter(c => c.alive).length, population: s.creatures.length,
    harmPerExposure: mean(exposed.map(c => c.eden.bar.harm / c.eden.bar.exposures)),
    exposuresMean: mean(exposed.map(c => c.eden.bar.exposures)),
    avoidanceCostMean: mean(barred.map(c => c.eden.bar.avoidanceCost)),
    benefitMean: mean(barred.map(c => c.eden.bar.benefitFromOthers)),
    payers: barred.filter(c => c.eden.bar.avoidanceCost > 0).length,
    beneficiaries: barred.filter(c => c.eden.bar.benefitFromOthers > 0).length,
    bothPayAndBenefit: barred.filter(c => c.eden.bar.avoidanceCost > 0 && c.eden.bar.benefitFromOthers > 0).length,
    condition: mb.cfg.condition, rho: mb.cfg.rho, signal: mb.cfg.signal,
    driftHalfLife: Number.isFinite(mb.cfg.driftHalfLife) ? mb.cfg.driftHalfLife : null,
    peerWeight: mb.cfg.peerWeight, monitorWeight: mb.cfg.monitorWeight,
  };
}

export function runMovingBar(seed, spec = true, capDays = 15) {
  const s = createEden(seed, {}, { movingBar: spec });
  const cap = capDays * DAY, releaseCap = 12 * DAY;
  const windowTicks = s.eden.movingBar.cfg.windowDays * DAY;
  while (s.tick < cap) {
    edenStep(s);
    if (s.eden.phase === 'released' && s.tick >= s.eden.fallTick + windowTicks) break;
    if (s.eden.phase === 'guided' && s.tick >= releaseCap) break;
  }
  const report = movingBarReport(s);
  report.seed = seed;
  report.excluded = !(s.eden.phase === 'released' && s.eden.fallTick != null && s.eden.fallTick <= releaseCap && s.tick >= s.eden.fallTick + windowTicks);
  return { world: s, report };
}
// MOVING-BAR END
