// Island small world: food.js (split from world.js, build plan change 4; behaviour unchanged).
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
  isDark,
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
import { LEARNERS, delta, deltaByCount, deltaLog } from './learning.js';
import { SALTS } from './streams.js';
import { H, W, bandOf, dist, note, placeName } from './w-core.js';
import { lightFire } from './w-craft.js';
import { atCamp } from './w-mind.js';
import { youngOf } from './w-people.js';
import { checkNews, checkWaterNews } from './w-social.js';

// ---------- the land's food and water ----------
export const FOOD_BY_REGION = {
  shore: ['shellfish', 'fish', 'berries'],
  river: ['fish', 'berries'],
  woodland: ['berries', 'nuts', 'honey', 'tubers', 'baobab'],
  grass: ['tubers', 'baobab'],
  rock: ['honey'],
};
export function makeFood(s) {
  const C = clockOf(s),
    B = body(s),
    carrying = s.config.density * T.LAND_KM2,
    yearUnits = (carrying * 2250 * 365) / B.unitKcal;
  const sites = T.foodSites().filter(site => FOOD_BY_REGION[site.region]);
  const chosen = sites.map(site => {
    let opts = FOOD_BY_REGION[site.region];
    if (site.region === 'shore') {
      const lake = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [2, 0],
        [-2, 0],
        [0, 2],
        [0, -2],
      ].some(([a, b]) => T.regionAt(site.x + a, site.y + b) === 'lake');
      opts = lake ? ['fish', 'berries'] : ['shellfish'];
    }
    const tot = opts.reduce((n, f) => n + FOODS[f].share, 0);
    let r = site.r * tot,
      food = opts[0];
    for (const f of opts) {
      r -= FOODS[f].share;
      if (r <= 0) {
        food = f;
        break;
      }
    }
    return { ...site, food };
  });
  const count = {};
  for (const c of chosen) count[c.food] = (count[c.food] ?? 0) + 1;
  return chosen.map((c, i) => {
    const F = FOODS[c.food],
      annual = (yearUnits * F.share) / count[c.food];
    const regen = annual / C.year,
      decay = Math.LN2 / (F.realHalfLifeDays * C.day),
      cap = regen / decay;
    return {
      id: 'p' + i,
      name: F.label,
      food: c.food,
      x: c.x,
      y: c.y,
      stock: cap * 0.6,
      capacity: cap,
      regen,
      decay,
      gift: false,
    };
  });
}

// ---------- seeing ----------
export const SIGHT = { rock: 9, grass: 6, shore: 6, river: 4, woodland: 3 }; // tiles; open ground and high ground see far (approx.)
export function look(s, p) {
  const r0 = SIGHT[T.regionAt(p.x, p.y)] ?? 4,
    r = isDark(clockOf(s), s.tick) ? 1 : r0;
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > r) continue;
      const x = p.x + dx,
        y = p.y + dy;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (!p.seen[i]) {
        p.seen[i] = 1;
        p.seenN = (p.seenN ?? 0) + 1;
      } // tiles seen with one's own eyes (for how rich unseen land may be)
      if (s.seenAt[i] < 0) {
        s.seenAt[i] = s.tick;
        s.seenBy[i] = p.id;
        s.discovered++;
      }
    }
  for (const q of s.patchIndex(p.x, p.y, r)) {
    const near = dist(q, p) <= 2,
      prev = p.places[q.id];
    if (!prev) {
      note(s, p, `Found ${q.name.toLowerCase()} (${placeName(q)}).`);
      p.foundN = (p.foundN ?? 0) + 1;
    }
    if (near)
      observe(s, p, q, q.stock); // a close look
    else if (!prev) p.places[q.id] = { exp: q.stock * 0.5, t: s.tick, u: 0, n: 0 }; // seen from afar: it is there, how much is a guess
  }
  for (const w of s.waters)
    if (dist(w, p) <= r) {
      if (!p.waters[w.id]) note(s, p, `Found water: ${w.name.toLowerCase()}.`);
      const was = p.waters[w.id];
      checkWaterNews(s, p, was, w.active); // was what one heard right?
      if (!was || was.from !== undefined || s.tick - was.t > 24) {
        const ws = (p.waterSeen ??= { n: 0, wet: 0 });
        ws.n++;
        ws.wet += w.active ? 1 : 0;
      } // own looks, for the base rate (at most one a day per hole)
      p.waters[w.id] = {
        active: w.active,
        t: s.tick,
        dryOk:
          !w.active && realFrac(s) >= 7 / 12 ? false : (was?.dryOk ?? false) || (w.active && realFrac(s) >= 10 / 12),
      }; // a hole seen with water at the end of the dry season (Sep-Oct) lasts; one seen dry in the dry season does not (learned both ways)
    }
}
export const MONTH = s => Math.floor(realFrac(s) * 12);
export function beliefOf(p, food) {
  return ((p.foodBelief ??= {})[food] ??= { tau: 60, w: 1, month: Array(12).fill(1) });
}
export function observe(s, p, q, stock) {
  const k = p.places[q.id],
    b = beliefOf(p, q.food),
    C = clockOf(s);
  if (k && k.n > 0 && k.u > 0) {
    // regrowth: what was left, what is there now, against the usual level -> an implied recovery time
    const days = ((s.tick - k.t) * C.hours) / 24,
      f = (k.u - stock) / (k.u - k.exp);
    // learned with the shared engine (learning.js): recovery time on a log scale, the season shape by the delta rule
    if (days > 1 && k.u > k.exp && f > 0.05 && f < 0.95) {
      const tauObs = Math.min(2000, Math.max(1, days / -Math.log(f))),
        L = deltaLog(b.tau, b.w, tauObs, LEARNERS.human.recoveryLooks);
      b.w = L.weight;
      b.tau = L.value;
    }
    const m = MONTH(s);
    b.month[m] = delta(b.month[m], stock / Math.max(1e-9, k.u), LEARNERS.human.seasonRate);
  }
  checkNews(s, p, k, stock); // was what one heard right?
  const n = (k?.n ?? 0) + 1,
    u = k?.u ? deltaByCount(k.u, stock, Math.min(n, LEARNERS.human.memoryLooks)) : stock;
  p.places[q.id] = { exp: stock, t: s.tick, u, n };
}
export function expected(s, p, q, k) {
  const b = beliefOf(p, q.food),
    usual = (k.u ?? k.exp) * b.month[MONTH(s)],
    days = ((s.tick - k.t) * clockOf(s).hours) / 24;
  return Math.max(0, usual - (usual - k.exp) * Math.exp(-days / b.tau));
}

// Gathering cut short (thirst, nightfall, the camp moving): what was gathered in the hours spent is kept.
// Food comes in as the hours pass, not only at the end of a trip.
export function stopGather(s, p) {
  const st = p.step;
  if (!st || st.k !== 'gather' || st.left === undefined || !(st.hours > 0)) return;
  const done = 1 - Math.max(0, st.left) / (st.hours / clockOf(s).hours);
  if (done <= 0.01) return;
  gatherDone(s, p, { ...st, want: st.want * Math.min(1, done), hours: st.hours * done });
}
export function gatherDone(s, p, st) {
  const q = st.q,
    B = body(s),
    takeUnits = Math.min(q.stock, st.want / B.unitKcal);
  q.stock -= takeUnits;
  s.ledger.consumed += takeUnits;
  p.gotKcal = (p.gotKcal ?? 0) + takeUnits * B.unitKcal;
  let kcal = takeUnits * B.unitKcal;
  // eat what you are short of on the spot, feed the young with you, carry the rest home
  for (const k of youngOf(s, p)) {
    const g = Math.min(kcal, k.hunger / k.body.hpk + Math.max(0, k.body.fatMax - k.reserve) / B.fatStoreEff);
    if (g > 0) {
      eatKcal(s, k, g);
      kcal -= g;
    }
  }
  const own = Math.min(kcal, p.hunger / p.body.hpk);
  eatKcal(s, p, own);
  kcal -= own;
  p.carry += kcal;
  if (takeUnits > 0) practise(s, p, q.id, st.hours ?? 1);
  observe(s, p, q, q.stock + takeUnits);
  p.places[q.id].exp = q.stock; // saw it before taking; left what remains
  note(
    s,
    p,
    takeUnits > 0.05
      ? `Gathered ${Math.round(takeUnits * B.unitKcal)} kcal of ${q.name.toLowerCase()}.`
      : `Found the ${q.name.toLowerCase()} picked clean.`,
  );
}
export function unload(s, p) {
  if (p.brand && atCamp(s, p)) {
    p.brand = null;
    lightFire(s, bandOf(s, p), p);
  }
  if (p.carry <= 0) return;
  const h = s.households[p.household];
  if (h && atCamp(s, p)) {
    h.pool += p.carry;
    p.carry = 0;
  } else {
    eatKcal(s, p, p.carry);
    p.carry = 0;
  }
}
// At camp: anyone hungry eats from the household's food; the young are fed first (and get their growth).
