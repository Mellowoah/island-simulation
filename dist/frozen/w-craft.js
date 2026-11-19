// Island small world: craft.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import {
  R,
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
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { SALT, bandMembers, bandOf, draw, event, living, note } from './w-core.js';
import { atCamp } from './w-mind.js';
import { bandName } from './w-social.js';

// ---------- things, know-how, fire ----------
// Picking up what lies to hand: a stick, a stone, dry grass. A chance, more for the curious; at most four things.
export function pickUp(s, p, base = R('pickupBase')) {
  if (p.body.age < 5 || p.items.length >= 4) return;
  for (const m of N.materialsAt(p.x, p.y)) {
    if (p.items.includes(m)) continue;
    if (draw(s, p.id, SALT.pickup, s.tick) < base * (0.5 + p.mind.curiosity)) {
      p.items.push(m);
      note(s, p, `Picked up ${N.MATERIAL[m].label === 'dry grass' ? 'some dry grass' : 'a ' + N.MATERIAL[m].label}.`);
    }
    return;
  }
}
// A recipe is what someone has found works: an action on two things (strike flint with cobble). It is known while its
// skill lasts (unused skills fade), passed on by showing, and lost when no one who knows it is left.
export const recipeKey = (verb, a, b) => `make:${verb}:${[a, b].sort().join('+')}`;
export const knownRecipes = p => Object.keys(p.skills).filter(k => k.startsWith('make:') && p.skills[k] >= 0.03);
export const productOf = k =>
  ({ 'make:strike:cobble+flint': 'flake', 'make:strike:flint+flint': 'flake', 'make:strike:cobble+cobble': 'chopper' })[
    k
  ] ?? (k.startsWith('make:cut:') ? 'spear' : k.startsWith('make:rub:') ? 'fire' : '?'); // what a known recipe gives (for wanting it)
export const recipeName = k => {
  const [, v, ab] = k.split(':');
  return `${v} ${ab.replace('+', ' with ')}`;
};
// An hour of trying: mostly the things one knows work, otherwise two things at random with a random action. The result
// comes from the laws of the materials (nature.js), not from a list of inventions.
export function tinker(s, p) {
  const r = i => draw(s, p.id, SALT.tinker, s.tick * 8 + i),
    known = knownRecipes(p).filter(k => {
      const [, , ab] = k.split(':');
      return ab.split('+').every(x => p.items.includes(x));
    });
  let verb, a, b;
  if (known.length && r(0) < 0.8) {
    const k = known[Math.floor(r(1) * known.length)],
      [, v, ab] = k.split(':');
    verb = v;
    [a, b] = ab.split('+');
  } else {
    if (p.items.length < 2) return;
    verb = N.VERBS[Math.floor(r(2) * N.VERBS.length)];
    const i = Math.floor(r(3) * p.items.length);
    let j = Math.floor(r(4) * (p.items.length - 1));
    if (j >= i) j++;
    a = p.items[i];
    b = p.items[j];
  }
  const key = recipeKey(verb, a, b),
    skill = p.skills[key] ?? 0,
    res = N.law(s, verb, a, b, skill, r(5));
  if (!res) {
    if (skill > 0) practise(s, p, key, 0.25);
    return;
  }
  practise(s, p, key, 1);
  const first = !s.firsts[res.made];
  if (first) {
    s.firsts[res.made] = { t: s.tick, by: p.name };
    event(s, `${p.name} ${res.note} (the first time anyone has).`);
  }
  note(s, p, `${res.note[0].toUpperCase()}${res.note.slice(1)}.`);
  if (res.made === 'ember') {
    const b0 = bandOf(s, p);
    if (p.items.includes('tinder')) {
      p.items.splice(p.items.indexOf('tinder'), 1);
      lightFire(s, b0, p);
    } else note(s, p, 'The ember died: nothing dry to catch it.');
    return;
  }
  if (res.made === 'spear') p.items.splice(p.items.indexOf('stick'), 1);
  if (!p.items.includes(res.made)) {
    s.made[res.made] = (s.made[res.made] ?? 0) + 1;
    if (p.items.length >= 4) p.items.shift();
    p.items.push(res.made);
  }
}
export function lightFire(s, b, p) {
  const was = b.fire?.fuel > 0;
  b.fire = { fuel: Math.max(b.fire?.fuel ?? 0, N.FIRE.startFuel), lit: s.tick };
  if (!was) {
    event(s, `${bandName(s, b)} has a fire at camp, lit by ${p.name}.`);
    s.made.fire = (s.made.fire ?? 0) + 1;
  }
}
// Each hour a camp fire burns its fuel; people at camp put on wood when there is wood near (a chance each hour, more
// from the careful); rain in the wet season can put it out.
export function fireHour(s) {
  const C = clockOf(s);
  for (const b of s.bands) {
    if (b.ended || !(b.fire?.fuel > 0)) continue;
    b.fire.fuel -= (sleepTime(C, s.tick) ? R('fireBanked') : 1) * R('fireBurnKgH') * C.hours; // banked at night it smoulders (approx.)
    b.fire.hours = (b.fire.hours ?? 0) + C.hours;
    const near = (b.fire.near ??= (() => {
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++)
          if (
            T.isWalkable(b.camp.x + dx, b.camp.y + dy) &&
            N.materialsAt(b.camp.x + dx, b.camp.y + dy).includes('stick')
          )
            return true;
      return false;
    })()); // dead wood within about a kilometre
    const tenders = bandMembers(s, b).filter(q => q.body.age >= 8 && atCamp(s, q) && q.step?.k !== 'sleep');
    for (const q of tenders)
      if (near && draw(s, q.id, SALT.fireTend, s.tick) < R('fireTend') * (0.5 + q.mind.care)) {
        b.fire.fuel += N.FIRE.fuelPerStick;
        if (b.fire.fuel > 4) break;
      }
    // finding out about cooking: food dropped by the fire comes out softer; someone may notice (a chance an hour)
    for (const q of tenders)
      if (!(q.skills.cook >= 0.03) && draw(s, q.id, SALT.cookFind, s.tick) < R('cookFindHour') * q.mind.curiosity) {
        practise(s, q, 'cook', 1);
        if (!s.firsts.cook) {
          s.firsts.cook = { t: s.tick, by: q.name };
          event(s, `${q.name} found that food put by the fire is softer and goes further.`);
        }
      }
    if (N.moisture(s) > 0.15 && draw(s, b.id, SALT.fireRain, s.tick) < R('fireRainOut')) b.fire.fuel = 0;
    if (b.fire.fuel <= 0) {
      b.fire = null;
      event(s, `The fire at ${bandName(s, b)}'s camp went out.`);
    }
  }
}
// Food at camp with a fire: someone who knows to put it by the fire gets more from it (cooking; gain approx.).
export function cooked(s, h, q, g) {
  const b = s.bands[h.band];
  if (!(b?.fire?.fuel > 0) || g <= 0) return;
  if (!h.members.some(i => s.people[i].alive && (s.people[i].skills.cook ?? 0) >= 0.03)) return;
  const extra = g * R('cookGain');
  eatKcal(s, q, extra);
  s.ledger.cookGain += extra;
}
// Cooks keep their skill by using it each day there is a fire at camp.
export function fireDay(s) {
  for (const q of living(s))
    if (q.skills.cook >= 0.03 && atCamp(s, q) && bandOf(s, q).fire?.fuel > 0) practise(s, q, 'cook', 0.5);
}
// Taking meat from a carcass: eat what one is short of, feed the young along, carry a load home.
