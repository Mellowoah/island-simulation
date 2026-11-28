// Island: the small world (Robert, 17 Nov: "a small little operable world that's similar to ours", "the size to be
// comparable to how people lived", "land that's discoverable that's blacked out until it's discovered").
//
// One world, made of the parts already tested: the real clock and the rate register (clock.js), one law of energy
// for every body (energy.js), the land with its seasons, rain, foods and waters (terrain.js, savanna.js).
// What is new here:
//   - People start as families of mixed ages, and each person is a little different (body, sleep, temperament),
//     drawn around the measured values. Children take after their parents, with variation.
//   - They choose by real trade-offs: food per hour of the trip after the cost of walking, what their household is
//     short of, how thirsty they and their young are, how tired, the hour of the day, and their own temperament.
//     Choices are probabilistic (bounded rationality), so no fixed script decides.
//   - A camp: food is carried home, shared within the household first and then with others in need, favouring
//     kin (Hamilton's rule, r x benefit > cost). In the evening people tell each other about places.
//   - The land is unknown until someone sees it. Each person knows only what they have seen or been told; the
//     world records who first saw each tile, and when.
//   - Deaths come from the body (starving, thirst, injury and illness from deprivation) and, for illness and old age
//     that the sim does not model in detail, from the measured hunter-gatherer age pattern (Siler model, Hadza fit,
//     Gurven and Kaplan 2007), at the share of deaths those causes make up (about 79%). Birth carries a 1.2% risk
//     to the mother (pre-industrial average).
// Nothing here is God, Eden or the deceiver. Those come later as layers on this same world.

import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { maxOf, minOf } from './numbers.js';
import { placesChanged } from './w-memo.js';
import {
  R,
  activeRates,
  clockOf,
  body,
  eatKcal,
  burnKcal,
  storedKcal,
  hourOf,
  isNight,
  sleepTime,
  REAL_MINUTES,
  SLEEP_UNTIL,
  dateOf,
} from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import { feelingsOn, fearDay, cueNow, safeHour } from './feelings.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { makeWeather, weatherDay } from './weather.js';
import { herdDay } from './learning.js';

import { sanity } from './w-checks.js';
import { H, SALT, W, WORLD_DEFAULTS, WORLD_VERSION, bandMembers, campOf, draw, event, living } from './w-core.js';
import { fireDay, fireHour } from './w-craft.js';
import { makeFood, stopGather, unload } from './w-food.js';
import { plantsDay } from './plants.js';
import { LAYERS } from './layers.js';
import { atCamp } from './w-mind.js';
import { act, walk } from './w-move.js';
import {
  adoptOrphans,
  attachIndex,
  births,
  die,
  drawFactors,
  drink,
  liveTick,
  monthly,
  newPerson,
  refreshCarers,
  setBody,
  silerCum,
  youngOf,
} from './w-people.js';
import { bandThin, evening, feedFromPool, maybeMoveCamp, share } from './w-social.js';
import { diseaseDay } from './disease.js';

export * from './w-core.js';
export * from './w-food.js';
export * from './w-people.js';
export * from './w-mind.js';
export * from './w-move.js';
export * from './w-meat.js';
export * from './w-craft.js';
export * from './w-social.js';
export * from './w-checks.js';

export function createWorld2(seed = 41, opts = {}) {
  T.useMap(opts.map ?? 'island'); // the map this world runs on (rule 15: the island unless asked)
  const cfg = { ...WORLD_DEFAULTS, ...opts };
  {
    const over = activeRates();
    if (Object.keys(over).length) cfg.rateOverrides = over;
  } // a run records any register overrides it ran with
  const s = {
    kind: 'world',
    mode: 'world',
    version: WORLD_VERSION,
    seed: seed >>> 0,
    rng: 2,
    tick: 0,
    clock: { min: cfg.clockMinutes ?? REAL_MINUTES },
    map: { id: opts.map ?? 'island' },
    config: cfg,
    people: [],
    households: [],
    events: [],
    births: 0,
    deaths: {},
    discovered: 0,
    ledger: { initial: 0, regenerated: 0, consumed: 0, decayed: 0, gifted: 0, withdrawn: 0, poolSpoiled: 0 },
  };
  const C = clockOf(s);
  s.patches = makeFood(s);
  s.ledger.initial = s.patches.reduce((n, p) => n + p.stock, 0);
  s.waters = T.waterSites().map(w => ({ ...w, active: true }));
  s.animals = N.makeAnimals();
  s.carcasses = [];
  s.wildfires = [];
  s.nextId = 1;
  s.ledger.meatKcal = 0;
  s.ledger.cookGain = 0;
  s.ledger.carcass = { made: 0, taken: 0, rotted: 0 };
  s.made = {};
  s.firsts = {};
  s.hunting = { trips: 0, tripHours: 0, attempts: 0, kills: {}, largeKills: 0, largeScavenged: 0, hurt: 0, byAge: {} };
  s.seenAt = new Int32Array(W * H).fill(-1);
  s.seenBy = new Int32Array(W * H).fill(-1); // person ids pass 32,767 in long runs
  attachIndex(s);
  // The camps: the first at the lake if there is one (it never dries); the others at lasting water as far as can be
  // from the camps already chosen (each band has its own country, as among foragers).
  const lasting = s.waters.filter(w => w.kind === 'lake' || w.kind === 'spring');
  s.bands = [];
  for (let bi = 0; bi < cfg.bands; bi++) {
    let w;
    if (!bi) {
      const lake = lasting.filter(x => x.kind === 'lake'),
        pick = lake.length ? lake : lasting;
      w = pick[Math.floor(draw(s, 0, SALT.setupCamp, 0) * pick.length)];
    } else
      w = lasting
        .map(x => ({
          x,
          d:
            minOf(s.bands.map(b => Math.abs(b.camp.x - x.x) + Math.abs(b.camp.y - x.y))) +
            draw(s, bi, SALT.setupCamp, x.x * 999 + x.y) * 4,
        }))
        .sort((a2, b2) => b2.d - a2.d)[0].x;
    s.bands.push({ id: bi, camp: { x: w.x, y: w.y, water: w.id, since: 0 } });
  }
  // Families: a couple each (mother 18-40, father 0-8 years older), with the children she would have had at about
  // 3.4-year spacing from about 19, each surviving with the real odds to their age; some have a grandparent.
  const year = C.year;
  let gid = 1000;
  for (let bi = 0; bi < cfg.bands; bi++)
    for (let f = 0; f < cfg.families; f++) {
      const h = bi * cfg.families + f;
      const hh = { id: s.households.length, members: [], pool: 0, band: bi };
      s.households.push(hh);
      const u = k => draw(s, h, SALT.setupKid, k);
      const ma = 18 + 22 * u(1),
        fa = ma + 8 * u(2);
      const mom = newPerson(s, { sex: 'F', born: -ma * year, household: hh.id, ...drawFactors(s, gid++) });
      const dad = newPerson(s, { sex: 'M', born: -fa * year, household: hh.id, ...drawFactors(s, gid++) });
      mom.partner = dad.id;
      dad.partner = mom.id;
      for (let k = 0, at = 19 + 2 * u(3); at < ma - 0.3; at += 3.4 * (0.85 + 0.3 * u(10 + k)), k++) {
        const age = ma - at,
          surv = Math.exp(-silerCum(cfg.siler, age) * cfg.illnessShare);
        if (u(30 + k) > surv) continue;
        const kid = newPerson(s, {
          sex: u(50 + k) < cfg.maleRatio ? 'M' : 'F',
          born: -age * year,
          mother: mom.id,
          father: dad.id,
          household: hh.id,
          ...drawFactors(s, gid++, [mom, dad]),
        });
        mom.births.push(kid.born);
        mom.young.push(kid.id);
        dad.young.push(kid.id);
      }
      if (u(70) < 0.35)
        newPerson(s, {
          sex: u(71) < 0.6 ? 'F' : 'M',
          born: -(ma + 22 + 8 * u(72)) * year,
          household: hh.id,
          ...drawFactors(s, gid++),
        });
    }
  // Each band knows the land and the places within a few km of its own camp, and that its camp's water lasts.
  const kr = cfg.campRadiusKm / T.TILE_KM;
  for (const p of s.people) {
    const c = campOf(s, p);
    p.x = c.x;
    p.y = c.y;
    for (let y = Math.max(0, Math.floor(c.y - kr)); y <= Math.min(H - 1, Math.ceil(c.y + kr)); y++)
      for (let x = Math.max(0, Math.floor(c.x - kr)); x <= Math.min(W - 1, Math.ceil(c.x + kr)); x++)
        if (Math.hypot(x - c.x, y - c.y) <= kr) {
          const i = y * W + x;
          p.seen[i] = 1;
          if (s.seenAt[i] < 0) {
            s.seenAt[i] = 0;
            s.seenBy[i] = -1;
            s.discovered++;
          }
        }
    for (const q of s.patches)
      if (Math.hypot(q.x - c.x, q.y - c.y) <= kr) p.places[q.id] = { exp: q.stock, t: 0, u: q.stock, n: 1 };
    placesChanged(p);
    for (const w of s.waters)
      if (Math.hypot(w.x - c.x, w.y - c.y) <= kr) p.waters[w.id] = { active: w.active, t: 0, dryOk: w.id === c.water };
    p.seenN = p.seen.reduce((n, v) => n + v, 0);
    p.foundN = Object.keys(p.places).length; // what they know at the start counts as their own looks
  }
  // Arriving with know-how: about half the grown-ups of 25 and over know how to knap flint, point a stick, make fire
  // and cook (practised skill), and carry a flake, a stick and dry grass; some a spear. Children learn by being shown.
  if (cfg.startKnowledge === 'basic')
    for (const p of s.people)
      if (p.body.age >= 25 && draw(s, p.id, SALT.setupKnow, 0) < 0.5) {
        for (const k of ['make:strike:cobble+flint', 'make:cut:flake+stick', 'make:rub:stick+stick', 'cook'])
          practise(s, p, k, 40);
        p.items = ['flake', 'stick', 'tinder', ...(draw(s, p.id, SALT.setupSpear, 0) < 0.5 ? ['spear'] : [])];
      }
  makeWeather(s);
  refreshCarers(s);
  event(
    s,
    `The island begins. ${s.people.length} people in ${cfg.bands} bands of ${cfg.families} families, each camped at its own water. Everything beyond a few km of each camp is unknown.`,
  );
  return s;
}
// Spatial index of food patches (not saved).
// ---------- the step ----------
export function stepWorld(s, n = 1) {
  T.useMap(s.map?.id ?? 'island');
  const C = clockOf(s),
    day = Math.round(C.day),
    month = Math.round(C.month);
  if (!s.patchIndex) attachIndex(s);
  if (!s.patchById) {
    Object.defineProperty(s, 'patchById', {
      enumerable: false,
      configurable: true,
      value: new Map(s.patches.map(q => [q.id, q])),
    });
    Object.defineProperty(s, 'waterById', {
      enumerable: false,
      configurable: true,
      value: new Map(s.waters.map(w => [w.id, w])),
    });
    refreshCarers(s);
  }
  for (let z = 0; z < n; z++) {
    s.tick++;
    if (s.weather && s.tick % day === 0) {
      weatherDay(s); // the day's sky first: everything below reads it
      if ((s.config?.layers?.plants ?? LAYERS.plants.status) === 'real') plantsDay(s); // then the plants (Layer 4)
    }
    landStep(s, 1);
    if (s.tick % day === 0) {
      for (const p of living(s)) {
        setBody(s, p);
        forget(s, p);
      }
      refreshCarers(s);
      N.animalDay(s);
      herdDay(s);
      N.wildfireDay(s);
      fireDay(s);
      const ids = new Set(s.carcasses.map(c => c.id));
      for (const p of living(s)) for (const id in p.carcasses) if (!ids.has(+id)) delete p.carcasses[id];
    }
    const alive = [...living(s)];
    for (const p of alive) {
      const carer = s.carer.get(p.id);
      liveTick(s, p, carer && carer.id === p.mother ? carer : null);
      if (feelingsOn(s) && p.body.age >= 1 && p.step?.k !== 'sleep' && atCamp(s, p)) {
        const d = cueNow(s, p, 'dark');
        if (d > 0) safeHour(s, p, 'dark', d * R('campDarkTransfer') * clockOf(s).hours);
      } // awake in the dark at camp, unharmed
      if (carer) {
        p.x = carer.x;
        p.y = carer.y;
        p.step = null;
        p.plan = [];
        continue;
      }
      // interruptions: thirst that has become urgent, or night falling far from camp
      const young = youngOf(s, p),
        felt = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst);
      if (felt >= 70 && p.step?.k !== 'drink' && !p.plan.some(x => x.k === 'drink')) {
        stopGather(s, p);
        p.plan = [];
        p.step = null;
      }
      if (sleepTime(C, s.tick) && p.step && !['sleep', 'walk', 'unload'].includes(p.step.k)) {
        stopGather(s, p);
        p.plan = [];
        p.step = null;
      }
      act(s, p);
      if (atCamp(s, p)) {
        if (p.carry > 0) unload(s, p);
        const h = s.households[p.household];
        if (h && (p.hunger > 25 || young.length)) feedFromPool(s, h);
      }
      const w = s.waterById.get(campOf(s, p).water);
      if (atCamp(s, p) && w.active && p.thirst > 15) {
        drink(p);
        for (const k of young) drink(k);
      }
    }
    for (const p of alive) {
      if (!p.alive) continue;
      if (p.hunger >= 100 && p.reserve <= 0) die(s, p, 'Starvation');
      else if (p.deficit >= p.body.waterDeath) die(s, p, 'Thirst');
      else if (p.health <= 0) die(s, p, 'Injury and illness');
    }
    fireHour(s);
    {
      const hr = hourOf(C, s.tick);
      if (hr === 19) evening(s);
      else if (hr === 10 || hr === 13 || hr === 16) share(s);
    }
    if (s.tick % day === 0 && s.config.disease?.pneumococcus) diseaseDay(s);
    if (s.tick % day === 0) {
      // how far grown people have had to walk lately (a ten-day average): long days mean the food near camp is used up
      for (const b of s.bands) {
        if (b.ended) continue;
        const ad = bandMembers(s, b).filter(p => p.body.age >= 18);
        const km =
          (ad.reduce((n, p) => n + p.tiles - (p.tilesAtDay ?? p.tiles), 0) / Math.max(1, ad.length)) * T.TILE_KM; // each person's own walking since yesterday
        b.dayKm = b.dayKm === undefined ? km : b.dayKm + (km - b.dayKm) / 10;
        if (
          !s.waterById.get(b.camp.water).active ||
          (s.tick % (7 * day) === 0 && (bandThin(s, b) || (b.tripKm ?? 0) > 6))
        )
          maybeMoveCamp(s, b, true);
      }
      sanity(s);
      for (const p of living(s)) {
        p.tilesAtDay = p.tiles;
        p.dayK = null;
        if (feelingsOn(s)) fearDay(p);
      }
      if (s.diag?.track)
        for (const p of living(s)) {
          const tr = (s.diag.track[p.id] ??= []);
          tr.push({
            r: +(p.reserve / p.body.fatMax).toFixed(2),
            got: Math.round(p.gotKcal ?? 0),
            g: +p.times.gather.toFixed(1),
            c: +p.times.camp.toFixed(1),
            w: +p.times.walk.toFixed(1),
            h: Math.round(p.health),
            y: youngOf(s, p).length,
            ch: p.decision?.chose,
            pool: Math.round(s.households[p.household]?.pool ?? 0),
            hh: (s.households[p.household]?.members ?? [])
              .filter(i => s.people[i].alive)
              .map(i => Math.round(s.people[i].body.age))
              .join('/'),
          });
          if (tr.length > 40) tr.shift();
        }
      adoptOrphans(s);
    }
    if (s.tick % month === 0) monthly(s);
    births(s);
  }
  return s;
}
