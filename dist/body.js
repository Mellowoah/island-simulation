// Island: a body on the real clock (Eden and the savanna). Legacy worlds never call this file.
// The law of energy is in energy.js, the rates and pairs in clock.js. This file applies them to one creature.

import {
  clockOf,
  body,
  eatKcal,
  burnKcal,
  storedKcal,
  sleepTime,
  ticksUntilWake,
  isNight,
  hourOf,
  SLEEP_UNTIL,
} from './clock.js';
import { skillsChanged } from './w-memo.js';
import { isDark } from './sun.js';
import { heatFactor } from './weather.js';
import * as EN from './energy.js';
import { lifeStage } from './being.js';

export const ageOf = (s, c) => (s.tick - c.eden.born) / clockOf(s).year;
const ADULT = new Set(['adult', 'middle', 'elder']);

// Size, burn, store and pace for the creature's age and sex. Called at birth and once a day.
export function setBody(s, c) {
  const C = clockOf(s),
    B = body(s),
    a = Math.max(0, ageOf(s, c)),
    sex = c.eden.sex,
    m = EN.massOf(a, sex),
    base = EN.baseKcalDay(a, sex);
  const cfg = s.eden.config,
    st = lifeStage(a),
    sleepH = ADULT.has(st.id) ? B.sleepHoursAdult : st.sleepHours,
    hpk = (100 / (base * B.hungerFullDays)) * (cfg.appetite ?? 1);
  if (c.body && c.body.hpk !== hpk) {
    // keep the kcal in the short-term store when the meter's size changes
    const store = (100 - c.hunger) / c.body.hpk,
      h = 100 - store * hpk;
    if (h < 0) {
      c.reserve = (c.reserve ?? 0) + -h / hpk;
      c.hunger = 0;
    } else c.hunger = Math.min(100, h);
  }
  c.body = {
    age: a,
    mass: m,
    base,
    baseTick: (base / 24) * C.hours,
    hpk,
    fatMax: EN.fatKcal(a, sex),
    cotTile: EN.cotPerKg(m) * B.tileKm,
    tilesTick: (EN.speedKmH(m) / B.tileKm) * C.hours,
    sleepH,
    waterAt: (B.thirstAtShare * m * 1000) / (cfg.thirstFeel ?? 1),
    waterDeath: B.dehydrationDeathShare * m * 1000,
  };
  if (c.reserve === undefined) c.reserve = c.body.fatMax * 0.8;
  if (c.eden.deficit === undefined) c.eden.deficit = 0;
}

// Water: lost with the energy burned (ml per kcal); thirst is that loss against the body's size.
export function loseWater(s, c, kcal) {
  const e = c.eden;
  e.deficit += kcal * body(s).waterMlPerKcal * heatFactor(s); // more in the heat (weather.js; 1 without weather)
  e.thirst = Math.min(100, (e.deficit / c.body.waterAt) * 100);
}
export function drink(c) {
  c.eden.deficit = 0;
  c.eden.thirst = 0;
}
export const dehydrated = c => c.eden.deficit >= c.body.waterDeath;

// One tick of living, before the action: the body's own burn (with growth), pregnancy, and for a nursing baby the
// milk its mother makes for it (her cost, at milk efficiency, with the water in the milk).
export function liveTick(s, c, mother, resting) {
  const C = clockOf(s),
    B = body(s),
    b = c.body,
    e = c.eden;
  let kcal = b.baseTick;
  if (e.pregnant) {
    const g = s.eden.config.gestation * C.year,
      tri = Math.floor((1 - (e.pregnant.due - s.tick) / g) * 3);
    kcal += (EN.pregnancyKcal(tri) / 24) * C.hours;
  }
  let own = kcal;
  if (mother) {
    const milk = EN.milkShare(b.age);
    if (milk > 0 && !(mother.hunger >= 100 && (mother.reserve ?? 0) <= 0)) {
      // Milk covers the baby's burn and, while its fat store is below full, a little more to lay down (at most a
      // quarter extra): babies put on fat when their mothers are fed.
      const room = Math.max(0, b.fatMax - (c.reserve ?? 0)) / B.fatStoreEff,
        extra = Math.min(room, kcal * 0.25) * milk;
      const made = (kcal * milk + extra) / EN.LAW.milkEfficiency;
      burnKcal(s, mother, made);
      loseWater(s, mother, kcal * milk + extra);
      if (extra > 0) eatKcal(s, c, extra);
      own = kcal * (1 - milk);
    }
  }
  burnKcal(s, c, own);
  loseWater(s, c, own);
  if (!resting && !mother) c.energy = Math.max(0, c.energy - B.wakeDrainTick(b.sleepH));
}

// Who a carer is carrying, and their weight (walking cost is per kg moved, body plus load).
export const carriedBy = (s, c, isCarer) =>
  s.creatures.filter(k => k.alive && k.body && isCarer(k, c) && EN.carried(k.body.age));
export const walkersWith = (s, c, isCarer) =>
  s.creatures.filter(k => k.alive && k.body && isCarer(k, c) && !EN.carried(k.body.age));

// One tile walked: the walker pays for its body and its load; children walking alongside pay for themselves.
export function stepCost(s, c, load, walkers) {
  const B = body(s),
    b = c.body,
    kcal = b.cotTile * (b.mass + load);
  burnKcal(s, c, kcal);
  loseWater(s, c, kcal);
  for (const k of walkers) {
    const kk = k.body.cotTile * k.body.mass;
    burnKcal(s, k, kk);
    loseWater(s, k, kk);
  }
  return B.walkFatigueTile * (1 + load / b.mass);
}
export const pace = (s, c) => c.body.tilesTick * (isDark(clockOf(s), s.tick) ? body(s).nightPace : 1);
export const injuryFactor = s => (isDark(clockOf(s), s.tick) ? body(s).nightInjury : 1);
export const sightFactor = s => (isDark(clockOf(s), s.tick) ? body(s).nightSight : 1);
// Sleep runs to dawn; a nap by day is an hour (Yetish et al. 2015: foragers rarely nap). In ticks, at least one.
// Durations are in ticks and may be fractions: the real clock spends each tick in full (eden.js actReal).
export const restTicks = s => {
  const C = clockOf(s);
  return sleepTime(C, s.tick) ? ((SLEEP_UNTIL - hourOf(C, s.tick) + 24) % 24 || 24) * C.perHour : C.perHour;
};
export const drinkTicks = s => 0.25 * clockOf(s).perHour; // a drink takes about a quarter of an hour
export const bedtime = s => sleepTime(clockOf(s), s.tick);

// How much food to bring back: what the forager and the young it feeds are short of, and half a day more, in food
// units, within what one person carries. More mouths means more hours foraging.
export function wantUnits(s, c, kids) {
  // What each is short of now, plus up to half a day more while its fat store has room, so one trip can carry most
  // of the day without waste (no one stores food yet; a later stage plans the day and shares at camp).
  const B = body(s),
    short = x => x.hunger / x.body.hpk + Math.min(x.body.base / 2, (x.body.fatMax - (x.reserve ?? 0)) / B.fatStoreEff);
  const kidShort = k => k.hunger / k.body.hpk + Math.max(0, k.body.fatMax - (k.reserve ?? 0)) / B.fatStoreEff;
  const kcal = short(c) + kids.reduce((n, k) => n + kidShort(k), 0);
  return Math.max(1, Math.min(B.maxCarryUnits, Math.ceil(kcal / B.unitKcal)));
}
// Share food: the young first, each up to what it is short of; the forager eats the rest (extra goes to fat).
export function shareFood(s, c, kids, units) {
  let kcal = units * body(s).unitKcal;
  const given = new Map();
  // A growing child also lays down body fat (part of growth); it gets that before the forager eats beyond need.
  const B = body(s),
    room = k => k.hunger / k.body.hpk + Math.max(0, k.body.fatMax - (k.reserve ?? 0)) / B.fatStoreEff;
  for (const k of kids) {
    const g = Math.min(kcal, room(k));
    if (g > 0) {
      eatKcal(s, k, g);
      kcal -= g;
      given.set(k, g);
    }
  }
  if (kcal > 0) eatKcal(s, c, kcal);
  return given;
}

// Skill: the power law of practice, and the forgetting curve. `kept` is what is there now; practising again starts
// from what was kept, not from what was once reached.
export function practise(s, c, id, hours) {
  const B = body(s),
    P0 = B.practiceHours,
    a = B.practiceExp,
    kept = c.skills[id] ?? 0;
  const P = kept > 0 ? ((1 - Math.min(0.999, kept)) ** (-1 / a) - 1) * P0 : 0;
  const learned = 1 - (1 + (P + hours) / P0) ** -a;
  (c.learned ??= {})[id] = learned;
  (c.lastPractice ??= {})[id] = s.tick;
  c.skills[id] = learned;
  skillsChanged(c);
}
export function forget(s, c) {
  if (!c.learned) return;
  const B = body(s),
    C = clockOf(s);
  for (const id of Object.keys(c.learned)) {
    const days = ((s.tick - c.lastPractice[id]) * C.hours) / 24;
    c.skills[id] = c.learned[id] * (1 + days / B.forgetDays) ** -B.forgetExp;
  }
  skillsChanged(c);
}
export function fadeHabits(s, c) {
  const k = Math.exp((-body(s).habitDecayMonth * 12) / 365);
  for (const key of Object.keys(c.eden.bias)) c.eden.bias[key] *= k;
}
export { storedKcal };
