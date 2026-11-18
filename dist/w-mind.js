// Island small world: mind.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { H, SALT, W, bandOf, campOf, draw } from './w-core.js';
import { knownRecipes, productOf, recipeName, tinker } from './w-craft.js';
import { expected, look, unload } from './w-food.js';
import { butcher, huntRate, huntTarget, meatAvail, meatCarry } from './w-meat.js';
import { walk } from './w-move.js';
import { drink, survivalDrive, youngOf } from './w-people.js';
import { evening } from './w-social.js';

// ---------- choosing ----------
// What the household is short of, in kcal: each member's empty short-term store and half a day ahead, less food at camp.
export function householdShort(s, p) {
  const h = s.households[p.household]; if (!h) return p.hunger / p.body.hpk;
  let k = 0, coming = 0;
  for (const i of h.members) {
    const q = s.people[i]; if (!q.alive) continue;
    k += q.hunger / q.body.hpk + q.body.base / 2;
    if (q !== p) coming += q.carry + [q.step, ...q.plan].reduce((n, x) => n + (x?.k === 'gather' ? x.want : 0), 0); // food already on its way home
  }
  return Math.max(0, k - h.pool - coming);
}
export const householdDay = (s, p) => { const h = s.households[p.household]; return h ? h.members.reduce((n, i) => n + (s.people[i].alive ? s.people[i].body.base : 0), 0) : p.body.base; };
export const atCamp = (s, p) => { const c = campOf(s, p); return Math.abs(p.x - c.x) + Math.abs(p.y - c.y) <= 1; };
export const maxTripKm = a => a < 5 ? 0 : a < 10 ? 2 : a < 14 ? 5 : 15; // how far children range from camp (Hadza children forage near camp)
export const hoursTo = (s, p, x, y) => { const d = fieldDist(p.x, p.y, x, y, false, mapOf(s)); return d < 0 ? Infinity : d / p.body.tilesTick * clockOf(s).hours; };

export function options(s, p) {
  const C = clockOf(s), a = p.body.age, hour = hourOf(C, s.tick), night = sleepTime(C, s.tick), opts = [];
  const young = youngOf(s, p), thirst = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst) / 100;
  const tired = (100 - p.energy) / 100, home = atCamp(s, p), camp = campOf(s, p), band = bandOf(s, p);
  const homeH = home ? 0 : hoursTo(s, p, camp.x, camp.y);
  // the drive to stay alive: as body fat runs low (one's own, or a child's one is looking after) getting food
  // overrides tiredness and comfort, and people look further afield for it (survival before pleasure)
  const drive = survivalDrive(p, young);
  // how far one has already walked today: a new trip that would take the day past about 35 km is not set out on
  // (forager day ranges rarely pass 30 km; going home or to water is always possible)
  const kmLeft = R('dayKmMax') - (p.tiles - (p.tilesAtDay ?? p.tiles)) * T.TILE_KM;
  // sleep
  if (night) opts.push({ k: 'sleep', u: 2.5 + tired, why: 'night' });
  else opts.push({ k: 'rest', u: tired * tired * 3 - 0.2 - (p.energy > 15 ? R('wRestDrive') * drive : 0), why: `tired ${Math.round(tired * 100)}` });
  // water
  let best = null, bm = Infinity;
  for (const id in p.waters) { if (!p.waters[id].active) continue; const wt = s.waterById.get(id), md = Math.abs(wt.x - p.x) + Math.abs(wt.y - p.y); if (md < bm) { bm = md; best = wt; } } // nearest by straight-line first
  if (best) best = { w: best, hrs: hoursTo(s, p, best.x, best.y) };
  if (best && !night) opts.push({ k: 'drink', w: best.w, u: 3 * thirst ** 1.5 - best.hrs * 0.15, why: `thirst ${Math.round(thirst * 100)}, ${best.w.name.toLowerCase()} ${best.hrs.toFixed(1)} h away` });
  // food: net kcal per hour of the whole trip, against what the household is short of
  if (!night && a >= 5) {
    const short = a < 14 ? p.hunger / p.body.hpk : householdShort(s, p), day = a < 14 ? p.body.base : householdDay(s, p);
    const urgency = Math.min(2, short / Math.max(1, day)) + R('forageBase'); // foragers go out most days even when not short
    const range = maxTripKm(a) / T.TILE_KM;
    // the places worth thinking about today: refreshed once a day or when camp moves (people do not weigh every
    // place they have ever heard of before each step)
    const dayNo = Math.floor(s.tick / clockOf(s).day);
    if (!p.cand || p.cand.day !== dayNo || p.cand.camp !== camp.water) {
      const list = [];
      for (const id in p.places) { const q = s.patchById.get(id), md = Math.abs(q.x - camp.x) + Math.abs(q.y - camp.y); if (md > range * 1.05) continue; const e = expected(s, p, q, p.places[id]); if (e * 500 >= 1000) list.push({ id, v: e / (1 + md) }); }
      list.sort((x, y) => y.v - x.v); p.cand = { day: dayNo, camp: camp.water, ids: list.slice(0, 15).map(x => x.id) };
    }
    for (const id of p.cand.ids) {
      const k0 = p.places[id], q = s.patchById.get(id); if (!k0) continue;
      const k = { exp: expected(s, p, q, k0) };
      if (k.exp * 500 < 1000) continue; // exp is in food units (500 kcal)
      const out = hoursTo(s, p, q.x, q.y), back = fieldDist(q.x, q.y, camp.x, camp.y, false, mapOf(s)) / p.body.tilesTick * C.hours;
      if (!isFinite(out) || (out + back) * p.body.kmh / 2 > maxTripKm(a) || (out + back) * p.body.kmh > kmLeft) continue;
      // central-place foraging: an adult who goes out brings back a full load if the patch has it (load-size theory,
      // Orians and Pearson 1979); a child gathers for itself
      const rate = returnRate(q.food, a, p.skills[q.id] ?? 0), want = Math.min(a < 14 ? Math.max(500, short) : p.body.carryKcal, k.exp * 500);
      const hrs = out + want / rate + back, walk = (out + back) * p.body.tilesTick / C.hours * p.body.cotTile * p.body.mass;
      const net = (want - walk) / hrs, late = hour + hrs > 19 ? (hour + hrs - 19) * 0.25 : 0;
      opts.push({ k: 'forage', q, want, u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) - late - p.mind.caution * Math.max(0, out - 3) * 0.05, why: `${q.name.toLowerCase()} ${out.toFixed(1)} h away, about ${Math.round(net)} kcal an hour after walking` });
    }
  }
  // meat: going after animals, and carcasses one knows of (one's own kill, one seen from the vultures, or told)
  if (!night && a >= 14) {
    const short = householdShort(s, p), day = householdDay(s, p), urgency = Math.min(2, short / Math.max(1, day)) + R('forageBase');
    const walkH = p.body.cotTile * p.body.mass * p.body.kmh * R('stalkPace') / T.TILE_KM; // kcal an hour stalking
    if (hour < 12 && kmLeft > 20) {
      // risk (idea 6): a hunt is a gamble (usually nothing, sometimes a large haul); it is valued at its certainty
      // equivalent under the log value of household food with a survival cliff (riskValue), not at its mean
      const hrs = R('huntHoursMax'), haul = 0.5 * meatCarry(p), q = Math.min(0.95, huntRate(p) * hrs / haul);
      const W = householdStore(s, p), D = short + day, ce = certaintyEquivalent(W - D, day, [{ x: haul, p: q }, { x: 0, p: 1 - q }]);
      const rate = ce / hrs, net = rate - walkH;
      // motives: survival (the drive), success (ambition: meat is shared and brings standing, as Hawkes argues for Hadza
      // men), and caution against the risk of the chase. Weights approx.; what hunting returns is learned, not given.
      opts.push({ k: 'hunt', u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) + R('wAmbition') * p.mind.ambition - R('wCaution') * p.mind.caution, why: `hunting: about a ${Math.round(q * 100)}% chance of meat; worth about ${Math.round(net)} kcal an hour to me as things stand${p.hunt.hours < 1 ? ' (never tried)' : ''}`, risk: { q, haul, ce, mean: q * haul } });
    }
    for (const id in p.carcasses) {
      const c = s.carcasses.find(k => k.id === +id); if (!c) continue;
      const out = hoursTo(s, p, c.x, c.y), back = fieldDist(c.x, c.y, camp.x, camp.y, false, mapOf(s)) / p.body.tilesTick * C.hours;
      if (!isFinite(out) || s.tick + out * C.perHour > c.until || (out + back) * p.body.kmh / 2 > maxTripKm(a) || (out + back) * p.body.kmh > kmLeft) continue; // within a day's reach, before it rots
      const want = Math.min(meatAvail(p, c), meatCarry(p)); if (want < 300) continue;
      const hrs = out + 0.5 + back, net = (want - (out + back) * p.body.kmh / T.TILE_KM * p.body.cotTile * p.body.mass) / hrs;
      opts.push({ k: 'fetch', c, u: urgency * net / 1000 + (net > 0 ? R('wDrive') * drive : 0) + 0.2 - 0.5 * R('wCaution') * p.mind.caution, why: `meat: a ${N.SPECIES[c.species].label} carcass ${out.toFixed(1)} h away` });
    }
  }
  // explore, valued as information (idea 5): the food per hour that finding a better place is expected to add
  if (!night && a >= 12 && hour < 15 && kmLeft > 15) {
    const v = exploreValue(s, p);
    opts.push({ k: 'explore', u: urgency0(s, p) * v.rate / 1000 + (v.rate > 0 ? R('wDrive') * drive : 0), why: `looking for new food: I might find about ${v.found.toFixed(1)} new places, worth about ${Math.round(v.rate)} kcal an hour of the trip`, voi: v });
  }
  // camp: being with others, caring for the young, going home in the evening
  // trying things with what one has picked up: curiosity, when well fed and with time on one's hands (a full belly
  // leaves room for play; hunger narrows the mind to food). What works is found by trying, by chance.
  if (home && !night && a >= 8 && p.items.length) opts.push({ k: 'tinker', u: (R('tinkerBase') + R('tinkerCurious') * p.mind.curiosity) * (1 - drive) * (p.energy / 100) + (knownRecipes(p).some(k => !p.items.includes(productOf(k))) ? 0.2 : 0), why: knownRecipes(p).length ? `making things: I know how to ${knownRecipes(p).map(recipeName).join(', ')}` : 'trying things with what I have picked up' });
  if (home) opts.push({ k: 'camp', u: 0.25 + 0.25 * p.mind.social + (young.length ? 0.15 * p.mind.care : 0), why: 'at camp with the others' });
  else { const cw = s.waterById.get(camp.water), water = cw.active ? 3 * thirst ** 1.5 : 0; // camp has water: thirst draws people home too
    opts.push({ k: 'home', u: (hour >= 17 ? 1.5 : 0.2) + (p.carry > 0 ? 0.6 : 0) + water - homeH * 0.05, why: `camp ${homeH.toFixed(1)} h away${water > 0.5 ? ', and there is water there' : ''}` }); }
  return opts;
}

// The inner voice: the motives behind a choice, in words (what the numbers in options() stand for). Survival first
// when the body runs thin or thirst is high; pleasure (rest, company, play) when fed; success (standing) in the
// ambitious; risk taken more readily when hungry (the energy-budget rule) and by the less cautious.
export function innerVoice(s, p, o) {
  const young = youngOf(s, p), drive = survivalDrive(p, young), thirst = young.reduce((m, k) => Math.max(m, k.thirst), p.thirst), out = [];
  if (drive > 0.5) out.push(young.some(k => survivalDrive(k) > 0.5) ? 'The child is getting thin; food comes before anything.' : 'I am getting thin; food comes before anything.');
  else if (drive > 0) out.push('Thinner than I would like.');
  if (thirst >= 60) out.push('Thirsty.');
  const bold = (1 - p.mind.caution) + drive;
  const why = {
    hunt: `${drive > 0.3 ? 'Meat would fill us. ' : ''}${p.mind.ambition > 0.6 ? 'A kill is shared and talked about. ' : ''}${bold > 0.8 ? 'Worth the risk.' : 'Risky, but worth a try.'}`,
    fetch: 'There is meat lying out there; better us than the hyenas.',
    forage: drive > 0 ? 'Go where food is surest.' : 'Bring in a load for the household.',
    explore: drive > 0.3 ? 'What we know is not enough; look further.' : 'I want to see what is out there.',
    tinker: 'Fed and rested: time to try things.',
    rest: drive > 0 ? 'Too worn out to go on.' : 'Rest while I can.',
    camp: 'Stay with the others.', sleep: 'Night.', drink: 'Water first.', home: 'Time to go back to camp.',
  }[o.k];
  if (why) out.push(why);
  return out.join(' ');
}
export function decide(s, p) {
  const opts = options(s, p), T0 = s.config.choiceTemperature ?? R('choiceTemperature'), mx = Math.max(...opts.map(o => o.u));
  const w = opts.map(o => Math.exp((o.u - mx) / T0)), tot = w.reduce((a, b) => a + b, 0);
  let r = draw(s, p.id, SALT.choice) * tot, o = opts[opts.length - 1];
  for (let i = 0; i < opts.length; i++) { r -= w[i]; if (r <= 0) { o = opts[i]; break; } }
  p.decision = { t: s.tick, chose: o.k, why: o.why, thought: innerVoice(s, p, o), options: opts.map(x => ({ k: x.k, u: Math.round(x.u * 100) / 100, why: x.why })).sort((a, b) => b.u - a.u).slice(0, 6) };
  const C = clockOf(s), cp = campOf(s, p), camp = [cp.x, cp.y], band = bandOf(s, p);
  if (o.k === 'sleep') { if (!atCamp(s, p) && hoursTo(s, p, ...camp) <= 1.5) p.plan = [{ k: 'walk', to: camp }, { k: 'sleep' }]; else p.plan = [{ k: 'sleep' }]; }
  else if (o.k === 'rest') p.plan = [{ k: 'rest', left: C.perHour }];
  else if (o.k === 'drink') p.plan = [{ k: 'walk', to: [o.w.x, o.w.y] }, { k: 'drink', w: o.w, left: 0.25 * C.perHour }];
  else if (o.k === 'forage') {
    const d = fieldDist(o.q.x, o.q.y, cp.x, cp.y, false, mapOf(s)) * T.TILE_KM; if (d >= 0) band.tripKm = band.tripKm === undefined ? d : band.tripKm + (d - band.tripKm) / 30; // how far food trips go (a running average)
    p.plan = [{ k: 'walk', to: [o.q.x, o.q.y] }, { k: 'gather', q: o.q, want: o.want }, { k: 'walk', to: camp }, { k: 'unload' }];
  }
  else if (o.k === 'explore') { const t = exploreTarget(s, p); p.plan = t ? [{ k: 'walk', to: t, explore: true }, { k: 'walk', to: camp }] : [{ k: 'camp', left: C.perHour }]; }
  else if (o.k === 'home') p.plan = [{ k: 'walk', to: camp }, { k: 'unload' }];
  else if (o.k === 'hunt' && !huntTarget(s, p)) p.plan = [{ k: 'camp', left: C.perHour }]; // no hunting ground within what is left of the day
  else if (o.k === 'hunt') { const t = huntTarget(s, p); s.hunting.trips++; p.plan = [...(t ? [{ k: 'walk', to: t }] : []), { k: 'hunt', left: Math.min(R('huntHoursMax'), Math.max(1, 16 - hourOf(C, s.tick))) * C.perHour, kcal0: 0 }, { k: 'walk', to: camp }, { k: 'unload' }]; }
  else if (o.k === 'tinker') p.plan = [{ k: 'tinker', left: C.perHour }];
  else if (o.k === 'fetch') p.plan = [{ k: 'walk', to: [o.c.x, o.c.y] }, { k: 'butcher', c: o.c.id, left: 0.5 * C.perHour }, { k: 'walk', to: camp }, { k: 'unload' }];
  else p.plan = [{ k: 'camp', left: 2 * C.perHour }];
  p.step = null;
}
// ---------- risk: Kelly's log rule with a survival cliff (idea 6) ----------
// The value of food to a household is the log of what it holds above what it needs (Kelly 1956: maximising the long-run
// growth of a stock means maximising the expected log), measured in days of need. Below zero the household will be
// starving: value falls by a jump (riskDeathJump) and then steeply (riskDeathSlope). The jump is what makes the starving
// bold and the comfortable cautious (Stephens 1981, the energy-budget rule): a sure small gain that still leaves them
// short is worth less than a long shot that could carry them over. A gamble's certainty equivalent is the sure amount
// with the same expected value.
export const riskValue = (y, R0) => y > 0 ? Math.log(1 + y / R0) : -R('riskDeathJump') + R('riskDeathSlope') * y / R0;
const riskInverse = (v, R0) => v > 0 ? R0 * Math.expm1(v) : v > -R('riskDeathJump') ? 0 : (v + R('riskDeathJump')) * R0 / R('riskDeathSlope');
export function certaintyEquivalent(y0, R0, outcomes) {
  const ev = outcomes.reduce((n, o) => n + o.p * riskValue(y0 + o.x, Math.max(1, R0)), 0);
  return riskInverse(ev, Math.max(1, R0)) - y0;
}
// What a household holds: the person's own body fat and their share of the camp store (kcal)
const householdStore = (s, p) => { const h = s.households[p.household], n = h ? h.members.filter(i => s.people[i].alive).length : 1; return (p.reserve ?? 0) + (h?.pool ?? 0) / Math.max(1, n); };
// The same urgency foraging uses (how short the household is), so exploring and foraging are weighed alike.
const urgency0 = (s, p) => Math.min(2, householdShort(s, p) / Math.max(1, householdDay(s, p))) + R('forageBase');
// Value of information for a day's exploring. What a person expects of unseen land comes from their own looks: places
// found per tile seen, starting from a hopeful guess (exploreHopeTiles, more hopeful with curiosity). A new place is
// worth what it would add over the best place they know: the expected positive part of (its rate - the best rate),
// for a normal spread like the places they know (the standard expected-improvement formula), used for
// voiHorizonHours. Divided by the trip's hours, less the walking, it is food per hour, the currency of foraging.
export function exploreValue(s, p) {
  const C = clockOf(s), reach = Math.min(maxTripKm(p.body.age), 3 * EN.speedKmH(p.body.mass)) / T.TILE_KM / 2, tripTiles = 2 * reach * 0.7;
  const hope = R('exploreHopeTiles') / (0.5 + p.mind.curiosity), rho = ((p.foundN ?? 0) + 1) / ((p.seenN ?? 0) + hope);
  const unseenShare = Math.max(0, Math.min(1, 1 - (p.seenN ?? 0) / (Math.PI * reach * reach))), newTiles = tripTiles * 9 * unseenShare; // sight about 4 tiles each side
  const nets = []; for (const id in p.places) { const q = s.patchById.get(id); if (q) nets.push(returnRate(q.food, p.body.age, p.skills[q.id] ?? 0)); }
  const best = nets.length ? Math.max(...nets) : 0, mean = nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : R('exploreGuessRate');
  const sd = Math.max(100, nets.length > 1 ? Math.sqrt(nets.reduce((a, b) => a + (b - mean) ** 2, 0) / (nets.length - 1)) : mean / 2);
  const d = (mean - best) / sd, phi = Math.exp(-d * d / 2) / Math.sqrt(2 * Math.PI), Phi = 0.5 * (1 + erf(d / Math.SQRT2)), gain = sd * (phi + d * Phi);
  const found = rho * newTiles, hours = tripTiles * T.TILE_KM / p.body.kmh, walk = p.body.cotTile * p.body.mass * p.body.kmh / T.TILE_KM;
  return { found, gain, rate: found * gain * R('voiHorizonHours') / Math.max(1, hours) - walk, hope: rho };
}
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }; // Abramowitz and Stegun 7.1.26
export function exploreTarget(s, p) {
  const C = clockOf(s), reach = Math.min(maxTripKm(p.body.age), 3 * EN.speedKmH(p.body.mass)) / T.TILE_KM / 2; // out and back within the day
  let best = null, bs = -Infinity;
  for (let i = 0; i < 16; i++) {
    const ang = draw(s, p.id, SALT.explore, s.tick * 16 + i) * Math.PI * 2, rr = reach * (0.4 + 0.6 * draw(s, p.id, SALT.exploreAlt, s.tick * 16 + i));
    const c = campOf(s, p), x = Math.round(c.x + Math.cos(ang) * rr), y = Math.round(c.y + Math.sin(ang) * rr);
    if (!T.isWalkable(x, y)) continue;
    // there and back to camp must fit what is left of the day's walking (straight-line distance x 1.3 for the way)
    const kmLeft = R('dayKmMax') - (p.tiles - (p.tilesAtDay ?? p.tiles)) * T.TILE_KM;
    if ((Math.hypot(x - p.x, y - p.y) + Math.hypot(x - c.x, y - c.y)) * T.TILE_KM * 1.3 > kmLeft) continue;
    let unseen = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H && !p.seen[yy * W + xx]) unseen++; }
    if (unseen > bs) { bs = unseen; best = [x, y]; }
  }
  return best && bs > 0 ? best : null;
}

