// Island lab core (docs/LAB-PLAN.md). Autonomous creatures acting on local knowledge, needs, memory,
// trust and utility scores. No global information, no scripts, no crafting, no inventories.
// The classic island (sim.js) and Eden (eden.js) are untouched by this module.
import { noise2, seedKey, clamp } from './sim.js';

export const LAB_VERSION = 1;
export const LAB_DEFAULTS = {
  // Terrain 'M': a larger, marshmallow-shaped island (rounded rectangle) split by a river with two fords.
  width: 72,
  height: 44,
  cornerRadius: 12,
  margin: 3,
  riverX: 36,
  crossings: [14, 30],
  // Experiment variables (the only things a trial may change)
  population: 24,
  foodSources: 12,
  foodQuantity: 60,
  foodRegrowth: 0.03,
  communicationRadius: 2,
  trustGainRate: 10,
  trustLossRate: 20,
  memoryLength: 1440,
  curiosityAverage: 50,
  riskAverage: 50,
  falseInformationRate: 0,
  mapVisibility: 4,
  crossingAvailability: 1,
  communication: true,
  // Fixed rules
  hungerRate: 0.05,
  moveEvery: 4,
  moveCost: 0.12,
  restGain: 0.55,
  eatAmount: 4,
  starveTicks: 300,
  dangerZones: 3,
  dangerRadius: 2,
  dangerChance: 0.05,
  dangerEnergy: 12,
  dangerSafety: 30,
  safetyRecover: 0.05,
  socialDecay: 0.02,
  socialGain: 1.5,
  traitSpread: 40,
  startTrust: 50,
  hopConfidence: 0.9,
  staleConfidence: 20,
  sampleEvery: 60,
  messageInterval: 30, // a creature can pass on one item per 30 minutes (assumption; without it rumours multiply every tick)
};
// One random stream per use; none may overlap (tests/lab.test.mjs).
export const LAB_STREAMS = {
  terrain: [400, 419],
  traits: [420, 425],
  start: [426, 427],
  order: [430, 430],
  explore: [431, 432],
  danger: [433, 433],
  accept: [434, 434],
  falsify: [435, 437],
  pick: [438, 438],
};
export const ACTIONS = ['eat', 'findFood', 'rest', 'explore', 'socialize', 'share', 'investigate', 'avoidDanger'];

const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const rnd = (s, id, stream, tick = s.tick) => noise2(s.key, tick, id, stream);

export function isLand(s, x, y) {
  const c = s.config;
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return false;
  const hw = c.width / 2 - c.margin,
    hh = c.height / 2 - c.margin,
    r = c.cornerRadius;
  const dx = Math.max(Math.abs(x + 0.5 - c.width / 2) - (hw - r), 0),
    dy = Math.max(Math.abs(y + 0.5 - c.height / 2) - (hh - r), 0);
  if (dx * dx + dy * dy > r * r) return false;
  if (x === c.riverX) return s.crossingsOpen.includes(y);
  return true;
}

function route(s, x, y, tx, ty) {
  const W = s.config.width,
    key = `${x},${y},${tx},${ty},${s.crossingsOpen.length}`;
  if (s.routes.has(key)) return s.routes.get(key).map(p => [...p]);
  const q = [[x, y]],
    prev = new Map([[y * W + x, -1]]);
  for (let i = 0; i < q.length; i++) {
    const [a, b] = q[i];
    if (a === tx && b === ty) break;
    for (const [nx, ny] of [
      [a + 1, b],
      [a - 1, b],
      [a, b + 1],
      [a, b - 1],
    ])
      if (isLand(s, nx, ny) && !prev.has(ny * W + nx)) {
        prev.set(ny * W + nx, b * W + a);
        q.push([nx, ny]);
      }
  }
  const out = [],
    end = ty * W + tx;
  if (prev.has(end)) for (let n = end; prev.get(n) !== -1; n = prev.get(n)) out.push([n % W, Math.floor(n / W)]);
  out.reverse();
  if (s.routes.size > 30000) s.routes.clear();
  s.routes.set(key, out);
  return out.map(p => [...p]);
}

export function createLab(seed = 41, overrides = {}) {
  const config = { ...LAB_DEFAULTS, ...overrides };
  const s = {
    mode: 'lab',
    version: LAB_VERSION,
    seed: seed >>> 0,
    key: seedKey(seed >>> 0),
    tick: 0,
    config,
    sources: [],
    dangers: [],
    creatures: [],
    crossingsOpen: config.crossings.slice(0, config.crossingAvailability),
    events: [],
    samples: [],
    messages: [],
    ledger: { initial: 0, regrown: 0, eaten: 0, provided: 0 },
    stats: { sent: 0, accepted: 0, falseSent: 0, verifiedTrue: 0, verifiedFalse: 0 },
  };
  Object.defineProperty(s, 'routes', { value: new Map(), enumerable: false });
  // Place food sources and danger zones on land, spread apart, from the seed.
  const place = (n, stream, minGap, taken, balance = false) => {
    const out = [];
    for (let i = 0, tries = 0; out.length < n && tries < 4000; tries++, i++) {
      const x = Math.floor(noise2(s.key, i, stream, 400) * config.width),
        y = Math.floor(noise2(s.key, i, stream, 401) * config.height);
      if (!isLand(s, x, y) || x === config.riverX) continue;
      if (balance && x < config.riverX !== (out.length % 2 === 0)) continue; // alternate sides of the river so neither half is favoured
      if ([...out, ...taken].some(o => Math.abs(o.x - x) + Math.abs(o.y - y) < minGap)) continue;
      out.push({ x, y });
    }
    return out;
  };
  const start = { x: Math.floor(config.width * 0.25), y: Math.floor(config.height / 2) };
  s.sources = place(config.foodSources, 1, 8, [start], true).map((p, i) => ({
    id: 'f' + i,
    type: i % 3 === 2 ? 'garden' : 'food',
    ...p,
    stock: config.foodQuantity * (i % 3 === 2 ? 1.5 : 1),
    capacity: config.foodQuantity * (i % 3 === 2 ? 1.5 : 1),
    regrow: config.foodRegrowth * (i % 3 === 2 ? 0.6 : 1),
  }));
  s.dangers = place(config.dangerZones, 2, 10, [start, ...s.sources]).map((p, i) => ({ id: 'd' + i, ...p }));
  s.ledger.initial = s.sources.reduce((n, p) => n + p.stock, 0);
  const trait = (id, k, mean) =>
    clamp(Math.round(mean + (noise2(s.key, 0, id, 420 + k) - 0.5) * 2 * config.traitSpread));
  for (let id = 0; id < config.population; id++) {
    let x,
      y,
      t = 0;
    do {
      x = start.x + Math.floor((noise2(s.key, t, id, 426) - 0.5) * 12);
      y = start.y + Math.floor((noise2(s.key, t, id, 427) - 0.5) * 12);
      t++;
    } while (!isLand(s, x, y));
    s.creatures.push({
      id,
      name: 'C' + String(id + 1).padStart(2, '0'),
      x,
      y,
      alive: true,
      death: null,
      needs: { hunger: 20, energy: 80, safety: 80, social: 60 },
      traits: {
        curiosity: trait(id, 0, config.curiosityAverage),
        risk: trait(id, 1, config.riskAverage),
        trustfulness: trait(id, 2, 50),
        persistence: trait(id, 3, 50),
        social: trait(id, 4, 50),
      },
      knowledge: [],
      trust: {},
      told: {},
      visited: {},
      action: null,
      decision: null,
      recent: [],
      starving: 0,
      travelled: 0,
      eaten: 0,
      scoreSum: 0,
      decisions: 0,
    });
  }
  note(
    s,
    `Lab world created: ${config.population} creatures, ${s.sources.length} food sources, ${s.dangers.length} danger zones.`,
  );
  return s;
}

function note(s, text, c) {
  s.events.unshift({ tick: s.tick, text, id: c?.id ?? null });
  if (s.events.length > 80) s.events.pop();
}

// ---- Knowledge: local and individual. Items come only from observation, communication or the player. ----
function findItem(c, type, x, y) {
  return c.knowledge.find(
    k =>
      k.x === x &&
      k.y === y &&
      (k.type === type || (type === 'food' && k.type === 'garden') || (type === 'garden' && k.type === 'food')),
  );
}
export function confidence(s, k) {
  // old information becomes less reliable
  return k.confidence * Math.pow(0.5, (s.tick - k.tick) / s.config.memoryLength);
}
function learn(s, c, item) {
  const old = findItem(c, item.type, item.x, item.y);
  if (old) {
    if (item.source === 'self' || item.confidence > confidence(s, old)) Object.assign(old, item);
    return old;
  }
  c.knowledge.push(item);
  return item;
}
function observe(s, c) {
  const r = s.config.mapVisibility;
  c.visited[c.y * s.config.width + c.x] = true;
  // Checking what it was told: standing within sight of a told location settles it, and trust follows the outcome.
  for (const k of c.knowledge) {
    if (k.verified || dist(k, c) > r) continue;
    const real =
      k.type === 'danger'
        ? s.dangers.some(d => d.x === k.x && d.y === k.y)
        : k.type === 'crossing'
          ? s.crossingsOpen.includes(k.y) && k.x === s.config.riverX
          : s.sources.some(p => p.x === k.x && p.y === k.y);
    const teller = k.chain[k.chain.length - 2];
    if (real) {
      k.verified = true;
      s.stats.verifiedTrue++;
      if (teller !== undefined && k.source !== 'player')
        c.trust[teller] = clamp((c.trust[teller] ?? s.config.startTrust) + s.config.trustGainRate);
    } else {
      k.false = true;
      s.stats.verifiedFalse++;
      if (teller !== undefined && k.source !== 'player')
        c.trust[teller] = clamp((c.trust[teller] ?? s.config.startTrust) - s.config.trustLossRate);
      note(s, `Found nothing where ${k.source} said there was ${k.type}.`, c);
    }
  }
  c.knowledge = c.knowledge.filter(k => !k.false);
  for (const p of s.sources)
    if (dist(p, c) <= r)
      learn(s, c, {
        type: p.type,
        x: p.x,
        y: p.y,
        confidence: p.stock >= s.config.eatAmount ? 100 : s.config.staleConfidence,
        source: 'self',
        chain: [c.id],
        tick: s.tick,
        verified: true,
        stock: p.stock,
      });
  for (const d of s.dangers)
    if (dist(d, c) <= r)
      learn(s, c, {
        type: 'danger',
        x: d.x,
        y: d.y,
        confidence: 100,
        source: 'self',
        chain: [c.id],
        tick: s.tick,
        verified: true,
      });
  for (const y of s.crossingsOpen)
    if (Math.abs(s.config.riverX - c.x) + Math.abs(y - c.y) <= r)
      learn(s, c, {
        type: 'crossing',
        x: s.config.riverX,
        y,
        confidence: 100,
        source: 'self',
        chain: [c.id],
        tick: s.tick,
        verified: true,
      });
}

// ---- Decisions: every tick each action gets a visible score; the highest becomes the active action. ----
function score(s, c) {
  const n = c.needs,
    t = c.traits,
    cfg = s.config,
    out = [];
  const add = (type, value, reason, target = null) =>
    out.push({ type, score: Math.round(clamp(value) * 10) / 10, reason, target });
  const here = s.sources.find(p => p.x === c.x && p.y === c.y);
  if (here && here.stock >= 1) add('eat', n.hunger * 1.1, `Hunger ${Math.round(n.hunger)} · food here`);
  let best = null;
  for (const k of c.knowledge) {
    if (k.type !== 'food' && k.type !== 'garden') continue;
    const conf = confidence(s, k),
      teller = k.chain[k.chain.length - 2];
    const trust =
      k.source === 'self' || k.source === 'player' || teller === undefined ? 100 : (c.trust[teller] ?? cfg.startTrust);
    const d = dist(k, c),
      v = n.hunger * 0.9 * (0.3 + (0.7 * conf * trust) / 10000) - d * 0.3; // hunger, scaled by how far the place can be believed, less the walk
    if (!best || v > best.v) best = { v, k, conf, trust, d };
  }
  if (best && !(here && here.stock >= 1 && best.d === 0))
    add(
      'findFood',
      best.v,
      `Hunger ${Math.round(n.hunger)} · known ${best.k.type} confidence ${Math.round(best.conf)}% · trust in source ${Math.round(best.trust)} · distance ${best.d}`,
      { x: best.k.x, y: best.k.y },
    );
  add('rest', (100 - n.energy) * 0.9, `Energy ${Math.round(n.energy)}`);
  add(
    'explore',
    t.curiosity * 0.5 + (c.knowledge.length < 3 ? 15 : 0) - n.hunger * 0.2 - (100 - n.energy) * 0.2,
    `Curiosity ${t.curiosity} · knows ${c.knowledge.length} places`,
  );
  const near = s.creatures
    .filter(o => o.alive && o !== c && dist(o, c) <= cfg.mapVisibility)
    .sort((a, b) => dist(a, c) - dist(b, c) || a.id - b.id);
  if (near.length)
    add(
      'socialize',
      (100 - n.social) * 0.6 * (t.social / 50),
      `Social ${Math.round(n.social)} · social preference ${t.social} · ${near[0].name} nearby`,
      { id: near[0].id },
    );
  if (cfg.communication) {
    const listener = near.find(
      o =>
        dist(o, c) <= cfg.communicationRadius &&
        c.knowledge.some(k => k.type !== 'crossing' && !(c.told[o.id] ?? []).includes(k.type + k.x + ',' + k.y)),
    );
    if (listener && s.tick - (c.lastTold ?? -Infinity) >= cfg.messageInterval)
      add(
        'share',
        25 + t.social * 0.3 + (c.trust[listener.id] ?? cfg.startTrust) * 0.1,
        `${listener.name} within ${cfg.communicationRadius} tiles · has something not yet told`,
        { id: listener.id },
      );
  }
  const told = c.knowledge
    .filter(k => !k.verified && k.type !== 'danger')
    .map(k => {
      const teller = k.chain[k.chain.length - 2],
        trust = k.source === 'player' ? 100 : (c.trust[teller] ?? cfg.startTrust);
      return { k, trust, v: confidence(s, k) * (trust / 100) * 0.6 + t.curiosity * 0.25 - dist(k, c) * 0.3 };
    })
    .sort((a, b) => b.v - a.v)[0];
  if (told)
    add(
      'investigate',
      told.v,
      `Told of ${told.k.type} by ${told.k.source} · trust ${Math.round(told.trust)} · curiosity ${t.curiosity} · distance ${dist(told.k, c)}`,
      { x: told.k.x, y: told.k.y },
    );
  const danger = c.knowledge
    .filter(k => k.type === 'danger' && dist(k, c) <= cfg.dangerRadius + 1)
    .sort((a, b) => dist(a, c) - dist(b, c))[0];
  if (danger)
    add(
      'avoidDanger',
      (100 - n.safety) * 0.8 + (100 - t.risk) * 0.4,
      `Safety ${Math.round(n.safety)} · risk tolerance ${t.risk} · known danger ${dist(danger, c)} tiles away`,
      { x: danger.x, y: danger.y },
    );
  return out;
}

function decide(s, c) {
  const options = score(s, c),
    cur = c.action?.type;
  // Persistence: the action already under way gets a visible bonus, so creatures do not flip every tick.
  for (const o of options)
    if (o.type === cur && c.action.left !== 0) {
      o.bonus = Math.round(c.traits.persistence * 0.15 * 10) / 10;
      o.total = o.score + o.bonus;
    } else o.total = o.score;
  const chosen = [...options].sort((a, b) => b.total - a.total || ACTIONS.indexOf(a.type) - ACTIONS.indexOf(b.type))[0];
  c.decision = {
    tick: s.tick,
    needs: { ...c.needs },
    options,
    chosen: chosen.type,
    total: chosen.total,
    reason: chosen.reason,
  };
  c.scoreSum += chosen.total;
  c.decisions++;
  const fixedGoal = chosen.type === 'explore' || chosen.type === 'avoidDanger'; // these pick their own goal when started
  if (
    chosen.type !== cur ||
    c.action.left === 0 ||
    (!fixedGoal && chosen.target && JSON.stringify(chosen.target) !== JSON.stringify(c.action.target))
  ) {
    c.recent.unshift({ tick: s.tick, action: chosen.type, score: chosen.total });
    if (c.recent.length > 8) c.recent.pop();
    c.action = { type: chosen.type, target: chosen.target, route: null, left: chosen.type === 'rest' ? 20 : null };
    if (chosen.type === 'explore') {
      let goal = null,
        bestV = -Infinity;
      for (let i = 0; i < 12; i++) {
        const x = Math.floor(rnd(s, c.id, 431, s.tick + i) * s.config.width),
          y = Math.floor(rnd(s, c.id, 432, s.tick + i) * s.config.height);
        if (!isLand(s, x, y)) continue;
        const v = (c.visited[y * s.config.width + x] ? 0 : 30) - (Math.abs(x - c.x) + Math.abs(y - c.y)) * 0.5;
        if (v > bestV) {
          bestV = v;
          goal = { x, y };
        }
      }
      c.action.target = goal ?? { x: c.x, y: c.y };
    }
    if (chosen.type === 'avoidDanger') {
      const d = chosen.target,
        sx = Math.sign(c.x - d.x) || 1,
        sy = Math.sign(c.y - d.y) || 1;
      let g = { x: c.x, y: c.y };
      for (const [a, b] of [
        [sx * 4, sy * 4],
        [sx * 4, 0],
        [0, sy * 4],
        [-sx * 4, sy * 4],
      ])
        if (isLand(s, c.x + a, c.y + b) && c.x + a !== s.config.riverX) {
          g = { x: c.x + a, y: c.y + b };
          break;
        }
      c.action.target = g;
    }
  }
}

function moveToward(s, c, tx, ty) {
  const a = c.action;
  if (!a.route) a.route = route(s, c.x, c.y, tx, ty);
  if (!a.route.length) return true;
  if (s.tick % s.config.moveEvery === 0) {
    [c.x, c.y] = a.route.shift();
    c.travelled++;
    c.needs.energy = clamp(c.needs.energy - s.config.moveCost);
  }
  return a.route.length === 0;
}

function share(s, c, o) {
  const cfg = s.config,
    key = k => k.type + k.x + ',' + k.y,
    told = (c.told[o.id] ??= []);
  const k = c.knowledge
    .filter(k => k.type !== 'crossing' && !told.includes(key(k)))
    .sort((a, b) => confidence(s, b) - confidence(s, a))[0];
  if (!k) return;
  told.push(key(k));
  s.stats.sent++;
  c.lastTold = s.tick;
  let x = k.x,
    y = k.y,
    isFalse = k.truth === false;
  if (rnd(s, c.id, 435) < cfg.falseInformationRate) {
    // optional experiment: some messages become inaccurate in transfer
    for (let i = 0; i < 20; i++) {
      const fx = Math.floor(rnd(s, c.id, 436, s.tick + i) * cfg.width),
        fy = Math.floor(rnd(s, c.id, 437, s.tick + i) * cfg.height);
      if (isLand(s, fx, fy) && !s.sources.some(p => p.x === fx && p.y === fy)) {
        x = fx;
        y = fy;
        isFalse = true;
        break;
      }
    }
  }
  if (isFalse) s.stats.falseSent++;
  const trust = o.trust[c.id] ?? (o.trust[c.id] = clamp(cfg.startTrust + (o.traits.trustfulness - 50) * 0.4));
  const accepted = rnd(s, o.id, 434) < trust / 100; // low-trust information is often ignored
  s.messages.push({
    tick: s.tick,
    from: c.id,
    to: o.id,
    type: k.type,
    x,
    y,
    accepted,
    false: isFalse,
    origin: k.chain[0],
  });
  if (s.messages.length > 400) s.messages.shift();
  if (!accepted || findItem(o, k.type, x, y)?.verified) return;
  s.stats.accepted++;
  learn(s, o, {
    type: k.type,
    x,
    y,
    confidence: confidence(s, k) * cfg.hopConfidence,
    source: c.name,
    chain: [...k.chain, o.id],
    tick: s.tick,
    verified: false,
    truth: isFalse ? false : undefined,
  });
  note(
    s,
    `${c.name} told ${o.name} about ${k.type} (first found by ${s.creatures[k.chain[0]]?.name ?? 'the player'}).`,
    o,
  );
}

export function labStep(s, n = 1) {
  const cfg = s.config;
  for (let z = 0; z < n; z++) {
    s.tick++;
    for (const p of s.sources) {
      const add = Math.max(0, Math.min(p.regrow, p.capacity - p.stock));
      p.stock += add;
      s.ledger.regrown += add;
    }
    const order = s.creatures.filter(c => c.alive).sort((a, b) => rnd(s, a.id, 430) - rnd(s, b.id, 430));
    for (const c of order) observe(s, c);
    for (const c of order) decide(s, c);
    for (const c of order) {
      const a = c.action,
        nd = c.needs;
      nd.hunger = clamp(nd.hunger + cfg.hungerRate);
      nd.social = clamp(nd.social - cfg.socialDecay);
      if (a.type === 'eat') {
        const p = s.sources.find(p => p.x === c.x && p.y === c.y),
          take = p ? Math.min(p.stock, cfg.eatAmount, nd.hunger / 4) : 0;
        if (take > 0 && s.tick % 4 === 0) {
          p.stock -= take;
          s.ledger.eaten += take;
          c.eaten += take;
          nd.hunger = clamp(nd.hunger - take * 4);
          nd.energy = clamp(nd.energy + take);
        }
      } else if (a.type === 'rest') {
        nd.energy = clamp(nd.energy + cfg.restGain);
        if (a.left > 0) a.left--;
      } else if (
        a.type === 'findFood' ||
        a.type === 'investigate' ||
        a.type === 'explore' ||
        a.type === 'avoidDanger'
      ) {
        if (moveToward(s, c, a.target.x, a.target.y) && a.type !== 'findFood') a.left = 0;
      } else if (a.type === 'socialize' || a.type === 'share') {
        const o = s.creatures[a.target.id];
        if (!o?.alive) a.left = 0;
        else if (dist(o, c) > (a.type === 'share' ? cfg.communicationRadius : 1)) {
          a.route = null;
          moveToward(s, c, o.x, o.y);
        } else if (a.type === 'share') {
          share(s, c, o);
          nd.social = clamp(nd.social + cfg.socialGain);
          a.left = 0;
        } else {
          nd.social = clamp(nd.social + cfg.socialGain);
          o.needs.social = clamp(o.needs.social + cfg.socialGain / 2);
        }
      }
      // Danger zones: stable, placed, avoidable. Harm costs energy and safety; safety recovers away from danger and near others.
      const inDanger = s.dangers.some(d => dist(d, c) <= cfg.dangerRadius);
      if (inDanger && rnd(s, c.id, 433) < cfg.dangerChance) {
        nd.energy = clamp(nd.energy - cfg.dangerEnergy);
        nd.safety = clamp(nd.safety - cfg.dangerSafety);
        note(s, 'Hurt in a danger zone.', c);
      } else if (!inDanger)
        nd.safety = clamp(
          nd.safety + cfg.safetyRecover * (s.creatures.some(o => o.alive && o !== c && dist(o, c) <= 2) ? 2 : 1),
        );
      c.starving = nd.hunger >= 99 ? c.starving + 1 : 0;
      if (c.starving >= cfg.starveTicks || nd.energy <= 0) {
        c.alive = false;
        c.death = { tick: s.tick, cause: nd.energy <= 0 ? 'Exhaustion' : 'Starvation' };
        c.action = null;
        note(s, `${c.name} died: ${c.death.cause.toLowerCase()}.`);
      }
    }
    if (s.tick % cfg.sampleEvery === 0) s.samples.push(labMetrics(s));
  }
  return s;
}

// ---- Player interventions: knowledge, environment and conditions only. Never direct control. ----
export function labCommand(s, cmd) {
  if (cmd.type === 'revealFood') {
    const c = s.creatures[cmd.id],
      p = s.sources.find(p => p.id === cmd.source) ?? s.sources.find(p => !findItem(c, p.type, p.x, p.y));
    if (!c?.alive || !p) throw Error('Nothing to reveal');
    learn(s, c, {
      type: p.type,
      x: p.x,
      y: p.y,
      confidence: 100,
      source: 'player',
      chain: [c.id],
      tick: s.tick,
      verified: false,
    });
    note(s, `The player revealed ${p.type} to ${c.name} only.`, c);
  } else if (cmd.type === 'openCrossing') {
    const next = s.config.crossings.find(y => !s.crossingsOpen.includes(y));
    if (next === undefined) throw Error('All crossings are open');
    s.crossingsOpen.push(next);
    s.routes.clear();
    for (const c of s.creatures) if (c.action) c.action.route = null;
    note(s, 'A crossing was opened.');
  } else if (cmd.type === 'boostTrust') {
    const by = cmd.amount ?? 20;
    for (const c of s.creatures)
      for (const o of s.creatures) if (o !== c) c.trust[o.id] = clamp((c.trust[o.id] ?? s.config.startTrust) + by);
    note(s, `Trust between all creatures raised by ${by}.`);
  } else if (cmd.type === 'provideFood') {
    const p = s.sources.find(p => p.id === cmd.source);
    if (!p) throw Error('Unknown source');
    const add = Math.min(cmd.amount ?? 40, p.capacity - p.stock);
    p.stock += add;
    s.ledger.provided += add;
    note(s, `The player added ${add.toFixed(0)} food at a source.`);
  } else throw Error('Unknown command');
  return s;
}

export function labMetrics(s) {
  const alive = s.creatures.filter(c => c.alive),
    all = s.creatures,
    mean = (xs, f) => (xs.length ? xs.reduce((n, c) => n + f(c), 0) / xs.length : null);
  const real = c =>
    c.knowledge.filter(
      k => (k.type === 'food' || k.type === 'garden') && s.sources.some(p => p.x === k.x && p.y === k.y),
    ).length;
  const trusts = alive.flatMap(c => Object.values(c.trust));
  const tMean = trusts.length ? trusts.reduce((a, b) => a + b, 0) / trusts.length : s.config.startTrust;
  return {
    tick: s.tick,
    alive: alive.length,
    deaths: all.length - alive.length,
    hunger: mean(alive, c => c.needs.hunger),
    energy: mean(alive, c => c.needs.energy),
    safety: mean(alive, c => c.needs.safety),
    social: mean(alive, c => c.needs.social),
    hungerAll: mean(all, c => (c.alive ? c.needs.hunger : 100)), // deaths stay visible in every average
    knowledgeSpread: mean(all, c => (c.alive ? real(c) / s.sources.length : 0)), // average share of real food sources each creature knows (dead = 0)
    foodDiscovery: s.sources.filter(p => alive.some(c => findItem(c, p.type, p.x, p.y))).length / s.sources.length,
    trustMean: tMean,
    trustSpread: trusts.length ? Math.sqrt(trusts.reduce((n, t) => n + (t - tMean) ** 2, 0) / trusts.length) : 0,
    travel: mean(all, c => c.travelled),
    utility: mean(all, c => (c.decisions ? c.scoreSum / c.decisions : 0)),
    survivalTime: mean(all, c => (c.alive ? s.tick : c.death.tick)),
    messages: { ...s.stats },
    food: s.sources.reduce((n, p) => n + p.stock, 0),
  };
}

// Snapshot and restore only. Does not change how a world steps.
export const LAB_SAVE_FORMAT = 'island-lab-save';
export function serializeLab(s, ui = {}) {
  return JSON.stringify({ format: LAB_SAVE_FORMAT, version: LAB_VERSION, world: s, ui });
}
export function deserializeLab(text) {
  if (typeof text !== 'string' || !text) throw Error('Invalid save');
  if (text.length > 5000000) throw Error('Save too large');
  let e;
  try {
    e = JSON.parse(text);
  } catch {
    throw Error('Invalid save');
  }
  if (e?.format !== LAB_SAVE_FORMAT || e.version !== LAB_VERSION) throw Error('Incompatible save');
  const s = e.world;
  if (!s || s.mode !== 'lab' || s.version !== LAB_VERSION) throw Error('Incompatible save');
  if (!Number.isInteger(s.seed) || !Number.isInteger(s.tick) || s.tick < 0 || s.tick > 1e9) throw Error('Invalid save');
  if (
    !s.config ||
    typeof s.config !== 'object' ||
    !Array.isArray(s.creatures) ||
    !Array.isArray(s.sources) ||
    !Array.isArray(s.dangers) ||
    !Array.isArray(s.crossingsOpen) ||
    !Array.isArray(s.events)
  )
    throw Error('Invalid save');
  if (!Array.isArray(s.messages) || !Array.isArray(s.samples) || !s.ledger || !s.stats) throw Error('Invalid save');
  if (s.creatures.length < 1 || s.creatures.length > 200 || s.sources.length < 1 || s.sources.length > 200)
    throw Error('Invalid save');
  s.config = { ...LAB_DEFAULTS, ...s.config };
  if (!Number.isInteger(s.config.width) || !Number.isInteger(s.config.height)) throw Error('Invalid save');
  for (const [i, c] of s.creatures.entries()) {
    if (
      c.id !== i ||
      typeof c.name !== 'string' ||
      c.name.length > 40 ||
      !Number.isInteger(c.x) ||
      !Number.isInteger(c.y) ||
      typeof c.alive !== 'boolean'
    )
      throw Error('Invalid save');
    if (
      !c.needs ||
      !c.traits ||
      !Array.isArray(c.knowledge) ||
      typeof c.trust !== 'object' ||
      c.trust == null ||
      !Array.isArray(c.recent)
    )
      throw Error('Invalid save');
  }
  s.key = seedKey(s.seed >>> 0);
  Object.defineProperty(s, 'routes', { value: new Map(), enumerable: false });
  const uiIn = e.ui && typeof e.ui === 'object' ? e.ui : {};
  const speed = [1, 4, 16].includes(uiIn.speed) ? uiIn.speed : 1;
  const selected =
    Number.isInteger(uiIn.selected) && uiIn.selected >= 0 && uiIn.selected < s.creatures.length ? uiIn.selected : 0;
  const seed = Number.isInteger(uiIn.seed) ? uiIn.seed : s.seed;
  return { world: s, ui: { seed, selected, paused: !!uiIn.paused, speed } };
}

export function runTrial(seed, config = {}, interventions = [], ticks = 4320) {
  const s = createLab(seed, config),
    plan = [...interventions].sort((a, b) => a.tick - b.tick);
  for (let t = 0; t < ticks; t++) {
    while (plan.length && plan[0].tick <= s.tick) labCommand(s, plan.shift().command);
    labStep(s);
  }
  return { seed, config: s.config, interventions, final: labMetrics(s), samples: s.samples };
}
