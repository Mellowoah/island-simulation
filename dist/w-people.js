// Island small world: people.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { H, SALT, W, ageOf, bandMembers, bandOf, campOf, changed, clamp, draw, event, gauss, homes, living, nameOf, note } from './w-core.js';
import { walk } from './w-move.js';
import { bandLife, gave, kinTo, maybeMoveCamp, related, share } from './w-social.js';

// ---------- bodies ----------
export function setBody(s, p) {
  const C = clockOf(s), B = body(s), a = Math.max(0, ageOf(s, p)), f = p.f;
  const m = EN.massOf(a, p.sex) * f.mass, base = EN.baseKcalDay(a, p.sex, m) * f.bmr, hpk = 100 / (base * B.hungerFullDays);
  if (p.body && p.body.hpk !== hpk) { const store = (100 - p.hunger) / p.body.hpk, h = 100 - store * hpk; if (h < 0) { p.reserve += -h / hpk; p.hunger = 0; } else p.hunger = Math.min(100, h); }
  const st = lifeStage(a);
  p.body = { age: a, mass: m, base, baseTick: base / 24 * C.hours, hpk, fatMax: m * EN.fatShare(a, p.sex) * f.fat * EN.LAW.fatKcalPerKg,
    cotTile: EN.cotPerKg(m) * T.TILE_KM, tilesTick: EN.speedKmH(m) * f.speed / T.TILE_KM * C.hours,
    kmh: EN.speedKmH(m) * f.speed, sleepH: a >= 18 ? f.sleep : st.sleepHours, waterAt: B.thirstAtShare * m * 1000, waterDeath: B.dehydrationDeathShare * m * 1000,
    carryKcal: Math.max(0, 4000 * Math.min(1, m / 46)) };
  if (p.reserve === undefined) p.reserve = p.body.fatMax * 0.8;
  // a growing or ageing body whose fat store gets smaller burns the difference (booked as burned)
  if (p.reserve > p.body.fatMax) { const ex = p.reserve - p.body.fatMax; p.reserve = p.body.fatMax; (s.energyLedger ??= { eaten: 0, burned: 0, heat: 0, unabsorbed: 0 }).burned += ex; }
}
export const loseWater = (s, p, kcal) => { p.deficit += kcal * body(s).waterMlPerKcal; p.thirst = Math.min(100, p.deficit / p.body.waterAt * 100); };
export const drink = p => { p.deficit = 0; p.thirst = 0; };

// The person a young child goes with: mother, else father, else an adult of its household.
export function carerOf(s, p) {
  if (p.body.age >= 5) return null;
  const m = s.people[p.mother], f = s.people[p.father];
  if (m?.alive) return m; if (f?.alive) return f;
  const h = s.households[p.household]; return h ? h.members.map(i => s.people[i]).find(q => q.alive && q.body.age >= 14) ?? null : null;
}
// 0 while body fat is above 40% of its most, rising to 1 as it runs out (for oneself or a child in one's care)
export function survivalDrive(p, young = []) {
  const F = R('survivalFat'), d = q => Math.max(0, Math.min(1, (F - (q.reserve ?? 0) / q.body.fatMax) / F));
  return young.reduce((m, k) => Math.max(m, d(k)), d(p));
}
// the young a person is looking after now: their own, or a child of kin whose parents have died
export const youngOf = (s, p) => (s.youngBy?.get(p.id) ?? []).filter(k => k.alive && s.carer.get(k.id) === p);

export function liveTick(s, p, mother) {
  const C = clockOf(s), B = body(s), b = p.body;
  let kcal = b.baseTick;
  if (p.pregnant) { const g = s.config.gestation * C.year, tri = Math.floor((1 - (p.pregnant.due - s.tick) / g) * 3); kcal += EN.pregnancyKcal(tri) / 24 * C.hours; }
  let own = kcal;
  if (mother && !(mother.hunger >= 100 && mother.reserve <= 0)) {
    const milk = EN.milkShare(b.age);
    if (milk > 0) {
      const room = Math.max(0, b.fatMax - p.reserve) / B.fatStoreEff, extra = Math.min(room, kcal * 0.25) * milk;
      burnKcal(s, mother, (kcal * milk + extra) / EN.LAW.milkEfficiency); loseWater(s, mother, kcal * milk + extra);
      if (extra > 0) { eatKcal(s, p, extra); s.ledger.milkKcal = (s.ledger.milkKcal ?? 0) + extra; } // eaten as milk, not from the land
      own = kcal * (1 - milk);
    }
  }
  burnKcal(s, p, own); loseWater(s, p, own);
  const asleep = p.step?.k === 'sleep' || p.step?.k === 'rest';
  if (asleep) p.energy = clamp(p.energy + B.restGainTick);
  else if (!s.carer.get(p.id)) p.energy = clamp(p.energy - B.wakeDrainTick(b.sleepH));
  // health: deprivation harms, rest and ordinary life heal (clock.js PAIR health)
  if (p.hunger >= 80 || p.thirst >= 80) p.health = clamp(p.health - B.illnessTick);
  else p.health = clamp(p.health + (asleep ? B.restHealTick : B.baseHealTick));
}

// ---------- people and families at the start ----------
export function newPerson(s, { sex, born, mother = null, father = null, household = null, f, mind }) {
  const id = s.people.length;
  const gen = mother === null ? 0 : 1 + Math.max(s.people[mother]?.gen ?? 0, s.people[father]?.gen ?? 0);
  const p = { id, name: nameOf(s, id), gen, sex, born, mother, father, partner: null, household, alive: true, death: null,
    x: 0, y: 0, hunger: 20, reserve: undefined, energy: 80, health: 100, deficit: 0, thirst: 0,
    f, mind, skills: {}, places: {}, waters: {}, seen: new Uint8Array(W * H), plan: [], step: null, carry: 0, items: [], hunt: { kcal: 0, hours: 0 }, carcasses: {},
    times: { sleep: 0, rest: 0, walk: 0, gather: 0, explore: 0, camp: 0, drink: 0, hunt: 0 }, tiles: 0,
    pregnant: null, births: [], young: [], memories: [] };
  s.people.push(p); changed(s); setBody(s, p);
  if (household !== null) s.households[household].members.push(id);
  return p;
}
export const MIND_KEYS = ['curiosity', 'caution', 'care', 'social', 'ambition']; // ambition: the wish to do well in others' eyes (success)
export function drawFactors(s, id, parents = null) {
  const g = (k, sd) => gauss(s, id, SALT.setupWho, k) * sd;
  const h = s.config.heritability, mix = (k, own) => parents ? 1 + h * ((parents[0].f[k] + parents[1].f[k]) / 2 - 1) + own * Math.sqrt(1 - h * h) : 1 + own;
  const f = { mass: mix('mass', g(1, 0.08)), fat: mix('fat', g(2, 0.2)), bmr: mix('bmr', g(3, 0.05)), speed: mix('speed', g(4, 0.07)), sleep: 5.7 + 1.4 * draw(s, id, SALT.setupWhere, 5) };
  const mind = {};
  MIND_KEYS.forEach((k, i) => { const own = 0.5 + 0.18 * gauss(s, id, SALT.setupMind, 10 + i); mind[k] = clamp(parents ? 0.5 + h * ((parents[0].mind[k] + parents[1].mind[k]) / 2 - 0.5) + (own - 0.5) * Math.sqrt(1 - h * h) : own, 0.05, 0.95); });
  return { f, mind };
}

export function attachIndex(s) {
  const cell = 8, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell), grid = Array.from({ length: cols * rows }, () => []);
  for (const q of s.patches) grid[Math.floor(q.y / cell) * cols + Math.floor(q.x / cell)].push(q);
  Object.defineProperty(s, 'patchIndex', { enumerable: false, configurable: true, value: (x, y, r) => {
    const out = [];
    for (let cy = Math.max(0, Math.floor((y - r) / cell)); cy <= Math.min(rows - 1, Math.floor((y + r) / cell)); cy++)
      for (let cx = Math.max(0, Math.floor((x - r) / cell)); cx <= Math.min(cols - 1, Math.floor((x + r) / cell)); cx++)
        for (const q of grid[cy * cols + cx]) if (Math.abs(q.x - x) + Math.abs(q.y - y) <= r) out.push(q);
    return out;
  } });
  Object.defineProperty(s, 'carer', { enumerable: false, configurable: true, writable: true, value: new Map() });
}
export function refreshCarers(s) { s.carer = new Map(); s.youngBy = new Map(); for (const p of living(s)) { const c = carerOf(s, p); if (c) { s.carer.set(p.id, c); if (!s.youngBy.has(c.id)) s.youngBy.set(c.id, []); s.youngBy.get(c.id).push(p); } } }

// Siler hazard (per year) and its integral from 0 to x.
export const siler = (S, x) => S.a1 * Math.exp(-S.b1 * x) + S.a2 + S.a3 * Math.exp(S.b3 * x);
export const silerCum = (S, x) => S.a1 / S.b1 * (1 - Math.exp(-S.b1 * x)) + S.a2 * x + S.a3 / S.b3 * (Math.exp(S.b3 * x) - 1);

// What a person expects to find at a place: what they last saw, recovering toward its usual level since then at the
// rate such food comes back (people learn how fast things regrow by living with them).
// The usual level follows the season of that food (people know when baobab or berries are in).
// People do not know a place's true size, season or regrowth. They hold beliefs built from what they have seen:
//   u      the place's usual stock: the average of what they found there on close looks
//   n      how many close looks (their certainty)
//   tau    for each kind of food, how many days it takes to come back, learned from going back to the same place
//          (prior 60 days, weight 1, updated in log space), and
//   month  for each kind, how full places of that kind were in each month compared with their usual (prior 1).
// ---------- once a month: pairing, conceiving, illness and old age ----------
export function monthly(s) {
  const C = clockOf(s), cfg = s.config, alive = [...living(s)];
  for (const b of s.bands) if (!b.ended) maybeMoveCamp(s, b);
  bandLife(s);
  // pairing: unpartnered adults pair with an unrelated unpartnered adult of the other sex, closest in age
  for (const p of alive) {
    if (p.partner !== null && s.people[p.partner]?.alive) continue;
    if (p.sex !== 'F' || p.body.age < cfg.firstPair.F || p.body.age > 45) continue;
    if (draw(s, p.id, SALT.pairing) > 0.15) continue;
    const m = alive.filter(q => q.sex === 'M' && q.body.age >= cfg.firstPair.M && (q.partner === null || !s.people[q.partner]?.alive) && related(s, p, q) < 0.125)
      .sort((a, b) => Math.abs(a.body.age - p.body.age - 4) - Math.abs(b.body.age - p.body.age - 4))[0];
    if (!m) continue;
    p.partner = m.id; m.partner = p.id;
    // they live with her band more often than his (approx.; Hadza couples often begin near the wife's mother)
    const band = draw(s, p.id, SALT.pairBand) < 0.6 ? (s.households[p.household]?.band ?? 0) : (s.households[m.household]?.band ?? 0);
    const hh = { id: s.households.length, members: [], pool: 0, band }; s.households.push(hh);
    for (const q of [p, m]) { const old = s.households[q.household]; if (old) old.members = old.members.filter(i => i !== q.id); q.household = hh.id; hh.members.push(q.id); }
    for (const k of p.young.map(i => s.people[i]).filter(k => k.alive && k.body.age < 14 && k.household !== hh.id)) { const old = s.households[k.household]; if (old) old.members = old.members.filter(i => i !== k.id); k.household = hh.id; hh.members.push(k.id); }
    changed(s); event(s, `${p.name} and ${m.name} made a home together.`);
  }
  // conception: a fed woman with a partner, past the nursing of her last child; fertility falls with her fat
  for (const p of alive) {
    if (p.sex !== 'F' || p.pregnant || p.body.age < cfg.menarche || p.body.age >= cfg.menopause) continue;
    if (living(s).length >= cfg.populationCap) { s.capReached = (s.capReached ?? 0) + 1; continue; } // technical limit, counted and reported
    const m = s.people[p.partner]; if (!m?.alive) continue;
    const last = p.births.at(-1); if (last !== undefined && (s.tick - last) / C.year < EN.LAW.weanYears * 0.9) continue;
    const fed = Math.min(1, (p.reserve / p.body.fatMax) / 0.6);
    if (draw(s, p.id, SALT.conceive) < cfg.fecundability * fed) p.pregnant = { due: s.tick + Math.round(cfg.gestation * C.year), father: m.id };
  }
  // illness and old age: the measured age pattern of death, at the share the sim does not model itself
  for (const p of alive) {
    const mu = siler(cfg.siler, p.body.age) * cfg.illnessShare;
    if (draw(s, p.id, SALT.illness) < 1 - Math.exp(-mu / 12)) die(s, p, p.body.age >= 60 ? 'Old age' : 'Illness');
  }
}
export function births(s) {
  const C = clockOf(s), cfg = s.config;
  for (const p of [...living(s)]) if (p.alive && p.pregnant && s.tick >= p.pregnant.due) {
    const dad = s.people[p.pregnant.father]; p.pregnant = null;
    const { f, mind } = drawFactors(s, s.people.length + 5000, [p, dad]);
    const kid = newPerson(s, { sex: draw(s, s.people.length, SALT.newborn) < cfg.maleRatio ? 'M' : 'F', born: s.tick, mother: p.id, father: dad.id, household: p.household, f, mind });
    kid.x = p.x; kid.y = p.y; kid.reserve = kid.body.fatMax * 0.8; kid.seen.set(p.seen);
    p.births.push(s.tick); p.young.push(kid.id); dad.young.push(kid.id); s.births++;
    event(s, `${p.name} gave birth to ${kid.name}.`); note(s, p, `Gave birth to ${kid.name}.`);
    if (draw(s, p.id, SALT.birth) < cfg.birthRisk) die(s, p, 'Childbirth');
    refreshCarers(s);
  }
}
export function die(s, p, cause) {
  if (!p.alive) return;
  if (s.diag?.deaths) { const C = clockOf(s), h = s.households[p.household], cp = campOf(s, p), w = s.waterById.get(cp.water), bm = bandMembers(s, bandOf(s, p)), ad = bm.filter(q => q.body.age >= 16);
    s.diag.deaths.push({ cause, age: p.body.age, month: dateOf(C, s.tick).month, year: Math.floor(s.tick / C.year), campWater: !!w?.active, distCamp: Math.hypot(p.x - cp.x, p.y - cp.y) * T.TILE_KM, pool: h?.pool ?? 0,
      adultsHome: (h?.members ?? []).filter(i => s.people[i].alive && s.people[i].body.age >= 16 && i !== p.id).length, band: bm.length, bandFat: ad.reduce((n, q) => n + q.reserve / q.body.fatMax, 0) / Math.max(1, ad.length),
      step: p.step?.k, chose: p.decision?.chose, young: youngOf(s, p).length, reserve: p.reserve / p.body.fatMax, thirst: p.thirst, hunger: p.hunger, mother: !!s.people[p.mother]?.alive, health: p.health, energy: p.energy, opts: p.decision?.options, sex: p.sex, pregnant: !!p.pregnant, ate: p.lastAte ?? null, tick: s.tick, carers: (p.carers ?? []).filter(i => s.people[i]?.alive).length, knownWaters: Object.keys(p.waters ?? {}).length, rain: s.rainNow ?? null }); }
  p.alive = false; p.death = { t: s.tick, cause, age: p.body.age }; s.deaths[cause] = (s.deaths[cause] ?? 0) + 1; changed(s);
  if (p.carry > 0) { s.lostCarry = (s.lostCarry ?? 0) + p.carry; p.carry = 0; } // food on a body that dies is lost (booked)
  p.seenCount = p.seen.reduce((n, v) => n + v, 0); p.seen = null; p.places = {}; p.waters = {}; p.carcasses = {}; p.plan = []; p.step = null; // the dead keep their story, not their maps (memory in long runs)
  event(s, `${p.name} died (${cause.toLowerCase()}, age ${Math.floor(p.body.age)}).`);
  adoptOrphans(s);
  refreshCarers(s);
}
// Children left in a home with no grown-up go to their closest kin who has one (grandparents, aunts and uncles,
// older siblings), or else to any family: among foragers orphans are taken in.
export function adoptOrphans(s) {
  for (const h of homes(s)) {
    const alive = h.members.map(i => s.people[i]).filter(q => q.alive);
    if (alive.some(q => q.body.age >= 16)) continue;
    for (const k of alive) {
      const fams = homes(s).filter(o => o !== h && o.members.some(i => s.people[i].alive && s.people[i].body.age >= 16));
      if (!fams.length) break;
      const best = fams.map(o => ({ o, r: Math.max(0, ...o.members.filter(i => s.people[i].alive).map(i => related(s, k, s.people[i]))) })).sort((a, b) => b.r - a.r || a.o.id - b.o.id)[0].o;
      // taken in as a chance each day: likelier from a caring family and close kin (an orphan may wait, or not be taken)
      const ad = best.members.map(i => s.people[i]).filter(m => m.alive && m.body.age >= 16), care = ad.reduce((n, m) => n + m.mind.care, 0) / ad.length;
      if (draw(s, k.id, SALT.adopt) > 0.2 + 0.5 * care + 0.5 * kinTo(s, k, best)) continue;
      h.members = h.members.filter(i => i !== k.id); best.members.push(k.id); k.household = best.id;
      note(s, k, `Taken in by ${s.people[best.members.find(i => s.people[i].alive && s.people[i].body.age >= 16)].name}'s family.`);
    }
    changed(s); refreshCarers(s);
  }
}

