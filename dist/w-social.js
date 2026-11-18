// Island small world: social.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { SALT, bandMembers, bandOf, changed, draw, event, homes, living, note } from './w-core.js';
import { cooked, knownRecipes, recipeName } from './w-craft.js';
import { expected, stopGather } from './w-food.js';
import { atCamp } from './w-mind.js';
import { survivalDrive } from './w-people.js';

export function campTime(s, p) { const h = s.households[p.household]; if (h && h.pool > 0) feedFromPool(s, h); }
export function feedFromPool(s, h) {
  const B = body(s), mem = h.members.map(i => s.people[i]).filter(q => q.alive && atCamp(s, q)).sort((a, b) => a.body.age - b.body.age);
  for (const q of mem) {
    // the young eat for growth too; adults eat when hungry and, when there is food, put fat back on (people fatten
    // in good times and lose it in lean ones)
    const room = Math.max(0, q.body.fatMax - q.reserve) / B.fatStoreEff;
    const want = q.body.age < 14 ? q.hunger / q.body.hpk + room : q.hunger > 25 ? q.hunger / q.body.hpk + Math.min(room, q.body.base * 0.5) : 0;
    let g = Math.min(h.pool, want); if (g > 0) { eatKcal(s, q, g); h.pool -= g; cooked(s, h, q, g); }
    // demand sharing (as among the Hadza): someone still hungry at camp asks other families of the same camp, kin
    // first. Each ask is a chance: a family gives what it does not need to eat now, more readily to kin, from a
    // caring giver, to a family that gave to it before, and less readily when the giver is hungry itself.
    if (want - g > 50 && (q.hunger > 50 || q.body.age < 14 || survivalDrive(q) > 0)) {
      const b = h.band, others = homes(s).filter(o => o !== h && o.band === b && o.pool > 0).map(o => ({ o, r: kinTo(s, q, o) })).sort((a, b2) => b2.r - a.r);
      let left = want - g;
      for (const { o, r } of others) {
        const keep = o.members.reduce((n, i) => { const m = s.people[i]; return n + (m.alive ? m.hunger / m.body.hpk : 0); }, 0), spare = Math.max(0, o.pool - keep);
        if (spare <= 0) continue;
        if (draw(s, q.id * 31 + o.id, SALT.share) > giveChance(s, o, h, r, survivalDrive(q))) { note(s, q, `Asked ${familyName(s, o)} for food and was refused.`); continue; }
        const take = Math.min(spare, left);
        eatKcal(s, q, take); o.pool -= take; left -= take; s.shared = (s.shared ?? 0) + take; gave(s, o, h, take); if (left <= 50) break;
      }
    }
  }
}
// Who gives: kinship (Hamilton's rule), the giver family's care, whether it has been given to by the asker's family
// (reciprocity), and how hungry the giver is. A chance between 2% and 98%.
export const kinTo = (s, q, o) => Math.max(0, ...o.members.filter(i => s.people[i].alive).map(i => related(s, q, s.people[i])));
export const familyName = (s, o) => { const a = o.members.map(i => s.people[i]).find(m => m.alive && m.body.age >= 16); return a ? `${a.name}'s family` : 'another family'; };
export function giveChance(s, giverH, takerH, r, starving = 0) {
  const ad = giverH.members.map(i => s.people[i]).filter(m => m.alive && m.body.age >= 14);
  const care = ad.length ? ad.reduce((n, m) => n + m.mind.care, 0) / ad.length : 0.5, hunger = ad.length ? ad.reduce((n, m) => n + m.hunger, 0) / ad.length / 100 : 0;
  const RR = s.recip ??= {}, got = RR[`${takerH.id}>${giverH.id}`] ?? 0, given = RR[`${giverH.id}>${takerH.id}`] ?? 0, recip = Math.min(1, got / (given + 2000));
  return Math.min(0.98, Math.max(0.02, R('give0') + R('giveKin') * r + R('giveCare') * care + R('giveRecip') * recip - R('giveHunger') * hunger + R('giveStarving') * starving)); // a visibly starving asker is rarely refused (weights approx.)
}
export const gave = (s, from, to, kcal) => { const RR = s.recip ??= {}; RR[`${from.id}>${to.id}`] = (RR[`${from.id}>${to.id}`] ?? 0) + kcal; };

// ---------- the evening at camp: sharing food and news ----------
// Relatedness r through recorded parents (two generations): parent-child and full siblings 1/2, grandparent and
// aunt or uncle 1/4, first cousins 1/8; partners count as 1/2 (shared children).
export function related(s, a, b) {
  if (a === b) return 1; if (a.partner === b.id) return 0.5;
  const anc = (p, d) => { const out = new Map([[p.id, 1]]); let gen = [p]; for (let g = 0; g < d; g++) { const nx = []; for (const q of gen) for (const id of [q.mother, q.father]) if (id !== null && id !== undefined) { out.set(id, (out.get(id) ?? 0) + 0.5 ** (g + 1)); nx.push(s.people[id]); } gen = nx; } return out; };
  const A = anc(a, 2), Bm = anc(b, 2); let r = 0;
  for (const [id, wa] of A) if (Bm.has(id)) r += wa * Bm.get(id) * (id === a.id || id === b.id ? 1 : 0.5);
  return Math.min(0.5, r);
}
// Food at camp is shared (demand sharing, as among the Hadza): a household keeps what its members need to eat now;
// the rest goes to households whose members are hungry or thin, kin first, by Hamilton's rule: give while
// r x benefit to them > cost to you, with benefit and cost measured by how short each side is (with a floor of 1/4
// on r, since unrelated campmates also share).
export function share(s) {
  const B = body(s), hs = homes(s);
  const keep = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk : 0); }, 0);
  const short = h => h.members.reduce((n, i) => { const q = s.people[i]; return n + (q.alive ? q.hunger / q.body.hpk + Math.max(0, q.body.fatMax * 0.6 - q.reserve) / B.fatStoreEff : 0); }, 0);
  for (const g of hs) {
    let spare = g.pool - keep(g); if (spare <= 0) continue;
    const giver = s.people[g.members.find(i => s.people[i].alive)];
    const takers = hs.filter(h => h !== g && h.band === g.band).map(h => { const sh = Math.max(0, short(h) - h.pool), r = kinTo(s, giver, h); return { h, sh, r, w: sh * Math.max(0.25, r) }; }).filter(x => x.sh > 0).sort((a, b) => b.w - a.w);
    for (const t2 of takers) {
      if (spare <= 0) break;
      if (draw(s, g.id * 977 + t2.h.id, SALT.shareOffer) > giveChance(s, g, t2.h, t2.r)) continue; // offered or not: a chance
      const gv = Math.min(spare, t2.sh); t2.h.pool += gv; g.pool -= gv; spare -= gv; s.shared = (s.shared ?? 0) + gv; gave(s, g, t2.h, gv);
    }
  }
}
export function evening(s) {
  const hs = homes(s);
  share(s);
  // news: people at the same camp tell what they know. A household member hears it more often than not (70% plus
  // the teller's sociability, a chance); up to three others hear it as often as the teller is sociable.
  const here = living(s).filter(p => atCamp(s, p) && p.body.age >= 5);
  const tell = (a, b) => {
    for (const id in a.places) { const k = a.places[id], kb = b.places[id]; if (!kb || kb.t < k.t) { if (!kb) note(s, b, `Heard from ${a.name} about ${s.patchById.get(id).name.toLowerCase()}.`); b.places[id] = { exp: k.exp, t: k.t, u: kb?.u || k.u, n: kb?.n ?? 0 }; } } // news, not their own looks
    for (const id in a.waters) { const k = a.waters[id], kb = b.waters[id]; if (!kb || kb.t < k.t) b.waters[id] = { active: k.active, t: k.t, dryOk: (kb?.dryOk ?? false) || !!k.dryOk }; }
    for (const id in a.carcasses) if (b.body.age >= 14 && !b.carcasses[id] && s.carcasses.some(c => c.id === +id)) b.carcasses[id] = 1; // where the meat is
    for (const k of [...knownRecipes(a), ...(a.skills.cook >= 0.03 ? ['cook'] : [])]) if (!((b.skills[k] ?? 0) >= 0.03) && b.body.age >= 5 && draw(s, a.id * 101 + b.id, SALT.showHow, s.tick) < R('showChance') + 0.2 * a.skills[k]) { practise(s, b, k, 1); note(s, b, `${a.name} showed how to ${k === 'cook' ? 'cook food by the fire' : recipeName(k)}.`); }
    if (a.hunt.hours > (b.huntHeard?.hours ?? 0)) b.huntHeard = { kcal: a.hunt.kcal, hours: a.hunt.hours }; // how hunting has gone for them
  };
  for (const a of here) {
    const b0 = bandOf(s, a);
    for (const b of here) if (b !== a && b.household === a.household && draw(s, a.id * 7 + b.id, SALT.talkHome) < 0.7 + 0.3 * a.mind.social) tell(a, b);
    const mates = here.filter(b => bandOf(s, b) === b0);
    for (let i = 0; i < 3; i++) { if (draw(s, a.id, SALT.talk, s.tick * 3 + i) > a.mind.social) continue; const b = mates[Math.floor(draw(s, a.id + 7919, SALT.talk, s.tick * 3 + i) * mates.length)]; if (b && b !== a) tell(a, b); }
  }
  for (const h of hs) { const keep = h.pool * Math.exp(-Math.LN2 / s.config.poolHalfLifeDays); s.ledger.poolSpoiled += h.pool - keep; h.pool = keep; } // camp food spoils (booked, kcal)
}

// ---------- moving camp ----------
// Once a month the band weighs its camp against the waters its members know: the food they know of within a
// day's reach (expected kcal, nearer counts more), with water that will last. It moves when another place is
// clearly better (Hadza camps move several times a year as food near camp runs down).
export function campValue(s, w, knowledge) {
  let v = 0;
  for (const [id, exp] of knowledge) { const q = s.patchById.get(id), d = fieldDist(q.x, q.y, w.x, w.y, false, mapOf(s)); if (d >= 0 && d * T.TILE_KM <= 8) v += exp / (1 + d * T.TILE_KM / 3); }
  return v;
}
// A band is going hungry when a quarter of its grown members are getting thin.
export const bandThin = (s, b) => { const a = bandMembers(s, b).filter(p => p.body.age >= 14); return a.length && a.filter(p => p.reserve / p.body.fatMax < 0.4).length >= a.length / 4; };
// Water the band can count on: someone has seen it with water in the dry season, or it is where they live now.
export function maybeMoveCamp(s, b, urgent = false) {
  const alive = bandMembers(s, b).filter(p => p.body.age >= 14); if (!alive.length) return;
  const know = new Map(), waters = new Map();
  for (const p of alive) { for (const [id, k] of Object.entries(p.places)) know.set(id, Math.max(know.get(id) ?? 0, expected(s, p, s.patchById.get(id), k))); for (const [id, w] of Object.entries(p.waters)) if (w.active) waters.set(id, (waters.get(id) ?? false) || !!w.dryOk); }
  const here = s.waterById.get(b.camp.water), now = here.active ? campValue(s, here, know) : -1; // a camp whose water has failed must move
  const others = s.bands.filter(o => o !== b && !o.ended).map(o => o.camp);
  let best = null, bv = Math.max(0, now);
  for (const [id, lasts] of waters) {
    const w = s.waterById.get(id); if (!lasts || id === here.id) continue;
    if (others.some(c => Math.abs(c.x - w.x) + Math.abs(c.y - w.y) < 6)) continue; // not on top of another band
    const v = campValue(s, w, know); if (v > bv) { bv = v; best = w; }
  }
  if (!best) return;
  // the band talks it over: the clearer the gain, the likelier it goes (a chance, not a rule)
  const gain = now > 0 ? bv / now - 1 : 1, P = 1 - Math.exp(-gain / (urgent ? 0.1 : 0.3));
  if (draw(s, b.id, SALT.move) > P) return;
  b.camp = { x: best.x, y: best.y, water: best.id, since: s.tick };
  for (const p of bandMembers(s, b)) { p.waters[best.id] = { ...(p.waters[best.id] ?? {}), active: best.active, t: s.tick, dryOk: true }; if (!s.carer.get(p.id)) { stopGather(s, p); p.plan = []; p.step = null; } }
  event(s, `${bandName(s, b)} moved camp to ${best.name.toLowerCase()}, where more food is known nearby.`);
}
export const bandName = (s, b) => `Band ${b.id + 1}`;
// Bands split when they grow large and join others when they dwindle; families drift between bands where they have kin.
export function bandLife(s) {
  const cfg = s.config;
  for (const b of s.bands) {
    if (b.ended) continue;
    const mem = bandMembers(s, b);
    if (!mem.length) { b.ended = s.tick; event(s, `${bandName(s, b)} is gone: no one is left.`); continue; }
    if (mem.length > cfg.fissionSize && draw(s, b.id, SALT.band) < 0.3) split(s, b);
    else if (mem.length < cfg.fusionSize && draw(s, b.id, SALT.bandJoin) < 0.5) {
      const others = s.bands.filter(o => o !== b && !o.ended && bandMembers(s, o).length); if (!others.length) continue;
      const to = others.sort((x, y) => (Math.abs(x.camp.x - b.camp.x) + Math.abs(x.camp.y - b.camp.y)) - (Math.abs(y.camp.x - b.camp.x) + Math.abs(y.camp.y - b.camp.y)))[0];
      joinBand(s, homes(s).filter(h => h.band === b.id), to); b.ended = s.tick; event(s, `${bandName(s, b)}, down to ${mem.length}, joined ${bandName(s, to)}.`);
    }
  }
  for (const h of homes(s)) {
    const r0 = draw(s, h.id, SALT.bandHousehold); if (r0 > cfg.householdMove) continue;
    const others = s.bands.filter(o => o.id !== h.band && !o.ended && bandMembers(s, o).length); if (!others.length) continue;
    const lead = h.members.map(i => s.people[i]).find(m => m.alive); if (!lead) continue;
    const kin = others.map(o => ({ o, r: Math.max(0, ...bandMembers(s, o).map(m => related(s, lead, m))) })).sort((a, b2) => b2.r - a.r)[0];
    if (kin.r < 0.125 && r0 > cfg.householdMove * 0.2) continue; // mostly to where they have close kin; to strangers a fifth as often
    joinBand(s, [h], kin.o); event(s, `${familyName(s, h)} went to live with ${bandName(s, kin.o)}.`);
  }
}
export function joinBand(s, hs, b) {
  for (const h of hs) { h.band = b.id; for (const i of h.members) { const p = s.people[i]; if (!p.alive) continue; p.waters[b.camp.water] = { ...(p.waters[b.camp.water] ?? {}), active: true, t: s.tick, dryOk: true }; if (!s.carer.get(p.id)) { stopGather(s, p); p.plan = []; p.step = null; } } }
  changed(s);
}
export function split(s, b) {
  const hs = homes(s).filter(h => h.band === b.id); if (hs.length < 4) return;
  // the families closest in kin to one family go with it, about half the band
  const seed = hs[Math.floor(draw(s, b.id, SALT.bandSplit) * hs.length)], lead = s.people[seed.members.find(i => s.people[i].alive)];
  const go = hs.map(h => ({ h, r: h === seed ? 9 : kinTo(s, lead, h) })).sort((a, b2) => b2.r - a.r).slice(0, Math.floor(hs.length / 2)).map(x => x.h);
  const goers = go.flatMap(h => h.members.map(i => s.people[i]).filter(p => p.alive && p.body.age >= 14));
  // a new camp at lasting water they know, at least 8 km away from every other camp
  const waters = new Map(); for (const p of goers) for (const [id, w] of Object.entries(p.waters)) if (w.active && w.dryOk) waters.set(id, true);
  const know = new Map(); for (const p of goers) for (const [id, k] of Object.entries(p.places)) know.set(id, Math.max(know.get(id) ?? 0, expected(s, p, s.patchById.get(id), k)));
  let best = null, bv = 0;
  for (const id of waters.keys()) { const w = s.waterById.get(id); if (s.bands.some(o => !o.ended && Math.abs(o.camp.x - w.x) + Math.abs(o.camp.y - w.y) < 8 / T.TILE_KM)) continue; const v = campValue(s, w, know); if (v > bv) { bv = v; best = w; } }
  if (!best) return; // nowhere they know to go: they stay together for now
  const nb = { id: s.bands.length, camp: { x: best.x, y: best.y, water: best.id, since: s.tick } };
  s.bands.push(nb); joinBand(s, go, nb);
  event(s, `${bandName(s, b)} split: ${go.length} families left to camp at ${best.name.toLowerCase()} as ${bandName(s, nb)}.`);
}

