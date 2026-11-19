// Island small world: move.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, ticksUntilWake, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { feelingsOn, harmed, safeHour, cueNow } from './feelings.js';
import { nightPaceOf, nightInjuryOf } from './weather.js';
import { H, SALT, W, clamp, draw, note } from './w-core.js';
import { pickUp, tinker } from './w-craft.js';
import { gatherDone, look, unload } from './w-food.js';
import { butcher, huntEnd, huntHour, spotCarcasses } from './w-meat.js';
import { decide } from './w-mind.js';
import { drink, loseWater, youngOf } from './w-people.js';
import { campTime } from './w-social.js';

// ---------- acting: each hour is spent in full (as in eden.js actReal) ----------
export function act(s, p) {
  const C = clockOf(s); let budget = 1;
  for (let guard = 0; budget > 1e-9 && p.alive && guard < 12; guard++) {
    if (!p.step) { if (!p.plan.length) decide(s, p); p.step = p.plan.shift(); if (!p.step) break; }
    const st = p.step;
    if (st.k === 'walk') { budget = walk(s, p, st, budget); if (!st.route?.length && st.arrived) p.step = null; continue; }
    if (st.k === 'sleep') { const u = budget; p.times.sleep += u; budget = 0; if (!sleepTime(C, s.tick + 1)) p.step = null; continue; }
    if (st.k === 'unload') { unload(s, p); p.step = null; continue; }
    if (st.k === 'hunt') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; st.spent = (st.spent ?? 0) + u * clockOf(s).hours; p.hunt.hours += u * clockOf(s).hours; s.hunting.tripHours += u * clockOf(s).hours; p.times.hunt += u; huntHour(s, p, st, u); if (st.left <= 1e-9 || st.done) { huntEnd(s, p, st); p.step = null; } continue; }
    if (st.k === 'tinker') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; p.times.camp += u; if (st.left <= 1e-9) { tinker(s, p); p.step = null; } continue; }
    if (st.k === 'butcher') { const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u; p.times.gather += u; if (st.left <= 1e-9) { butcher(s, p, s.carcasses.find(k => k.id === st.c)); p.step = null; } continue; }
    if (st.k === 'gather' && st.left === undefined) {
      const rate = returnRate(st.q.food, p.body.age, p.skills[st.q.id] ?? 0);
      st.left = Math.max(0.25 * C.perHour, st.want / rate * C.perHour); st.hours = st.left * C.hours;
    }
    const u = Math.min(budget, Math.max(0, st.left)); budget -= u; st.left -= u;
    p.times[st.k === 'gather' ? 'gather' : st.k === 'drink' ? 'drink' : st.k === 'rest' ? 'rest' : 'camp'] += u;
    if (st.k === 'camp') campTime(s, p);
    if (st.left <= 1e-9) { if (st.k === 'gather') gatherDone(s, p, st); if (st.k === 'drink') { drink(p); for (const k of youngOf(s, p)) drink(k); note(s, p, `Drank at ${st.w.name.toLowerCase()}.`); } p.step = null; }
  }
}
export function believedPath(s, p, tx, ty) {
  const N = W * H, prev = new Int32Array(N).fill(-2), q = new Int32Array(N), start = p.y * W + p.x, end = ty * W + tx;
  const ok = i => { const x = i % W, y = (i / W) | 0; return p.seen[i] ? T.isWalkable(x, y) : true; };
  let h = 0, n = 0; q[n++] = start; prev[start] = -1;
  while (h < n) { const i = q[h++]; if (i === end) break; const x = i % W, y = (i / W) | 0;
    // neighbours ordered toward the target so ties run straight at it
    const nb = [[x + Math.sign(tx - x), y], [x, y + Math.sign(ty - y)], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [a, b] of nb) { if (a < 0 || b < 0 || a >= W || b >= H) continue; const j = b * W + a; if (prev[j] !== -2 || !ok(j)) continue; prev[j] = i; q[n++] = j; } }
  if (prev[end] === -2) return null;
  const out = []; for (let i = end; prev[i] !== -1; i = prev[i]) out.push([i % W, (i / W) | 0]); return out.reverse();
}
export function walk(s, p, st, budget) {
  const m = mapOf(s);
  // past the hard limit of a day's walking, stop and sleep out; the walk goes on next morning (people on a long
  // journey break it into days)
  if ((p.tiles - (p.tilesAtDay ?? p.tiles)) * T.TILE_KM >= R('dayKmHard')) { p.plan.unshift(st); p.step = { k: 'rest', left: ticksUntilWake(clockOf(s), s.tick) }; if (!p.sleptOut || p.sleptOut < s.tick - 24) note(s, p, 'Too far to go on today: slept out and went on in the morning.'); p.sleptOut = s.tick; return budget; }
  if (!st.route) { st.route = st.explore ? path(p.x, p.y, st.to[0], st.to[1], false, m) : fieldPath(p.x, p.y, st.to[0], st.to[1], false, m); if (st.route.some(([x, y]) => !p.seen[y * W + x])) { st.route = believedPath(s, p, st.to[0], st.to[1]) ?? st.route; st.guess = true; } if (s.diag) { let u = 0; for (const [x, y] of st.route) if (!p.seen[y * W + x]) u++; s.diag.routes.push({ id: p.id, day: Math.floor(s.tick / clockOf(s).day), k: p.decision?.chose ?? st.k, explore: !!st.explore, len: st.route.length, unseen: u }); } if (!st.route.length) { st.arrived = true; return budget; } }
  const C = clockOf(s), B = body(s), v = p.body.tilesTick * (isNight(C, s.tick) ? nightPaceOf(s) : 1); // moonlight helps
  const young = youngOf(s, p), load = young.filter(k => EN.carried(k.body.age)).reduce((n, k) => n + k.body.mass, 0) + p.carry / 2000, walkers = young.filter(k => !EN.carried(k.body.age));
  p.stride = (p.stride ?? 0) + v * budget; let moved = 0;
  while (p.stride >= 1 && st.route.length) {
    if (st.guess && !T.isWalkable(st.route[0][0], st.route[0][1])) { // the way they guessed is blocked: they see it now and pick another way
      st.replans = (st.replans ?? 0) + 1; p.seen[st.route[0][1] * W + st.route[0][0]] = 1;
      st.route = (st.replans < 60 && believedPath(s, p, st.to[0], st.to[1])) || fieldPath(p.x, p.y, st.to[0], st.to[1], false, m);
      if (st.replans === 1) note(s, p, 'The way was blocked; looked for another.');
      if (!st.route.length) break; continue;
    }
    p.stride -= 1; moved++; [p.x, p.y] = st.route.shift(); p.tiles++; if (s.diag) { const k = (st.explore ? 'explore' : p.decision?.chose) ?? '?'; (p.dayK ??= {})[k] = (p.dayK[k] ?? 0) + 1; }
    const kc = p.body.cotTile * (p.body.mass + load); burnKcal(s, p, kc); loseWater(s, p, kc);
    for (const k of walkers) { const kk = k.body.cotTile * k.body.mass; burnKcal(s, k, kk); loseWater(s, k, kk); }
    p.energy = clamp(p.energy - B.walkFatigueTile * (1 + load / p.body.mass));
    look(s, p);
  }
  for (const k of young) { k.x = p.x; k.y = p.y; for (const i of [p.y * W + p.x]) k.seen[i] = 1; }
  if (moved) { spotCarcasses(s, p); pickUp(s, p); }
  if (moved && draw(s, p.id, SALT.injury) < 1 - (1 - B.injuryPerTile * (isNight(C, s.tick) ? nightInjuryOf(s) : 1)) ** moved) { p.health = clamp(p.health - B.injuryDamage); note(s, p, 'Fell and was hurt.'); if (feelingsOn(s) && isNight(C, s.tick)) harmed(s, p, 'dark', B.injuryDamage); }
  else if (moved && feelingsOn(s) && isNight(C, s.tick)) safeHour(s, p, 'dark', cueNow(s, p, 'dark') * C.hours); // out in the dark and nothing happened
  const used = st.route.length ? budget : Math.min(budget, moved / v);
  p.times[st.explore ? 'explore' : 'walk'] += used;
  if (st.route.length) return 0;
  p.stride = 0; st.arrived = true; return budget - used;
}
