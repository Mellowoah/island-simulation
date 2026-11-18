// Island small world: core.js (split from world.js, build plan change 4; behaviour unchanged).
import { noise2, seedKey, STREAMS, fieldPath, fieldDist, mapOf, path } from './sim.js';
import { R, clockOf, body, eatKcal, burnKcal, storedKcal, hourOf, isNight, sleepTime, REAL_MINUTES, SLEEP_UNTIL, dateOf } from './clock.js';
import * as EN from './energy.js';
import { FOODS, rainOf, waterActive, landStep, returnRate, realFrac } from './savanna.js';
import { practise, forget } from './body.js';
import { lifeStage } from './being.js';
import * as T from './terrain.js';
import * as N from './nature.js';
import { SALTS } from './streams.js';
import { walk } from './w-move.js';
import { births, siler } from './w-people.js';
import { share, split } from './w-social.js';

export const WORLD_VERSION = 1;
export const WORLD_DEFAULTS = {
  bands: 3,                 // neighbouring bands on the island, so there are others to marry and to join (foragers live in regional networks)
  families: 4,              // families per band at the start: about 20 people a camp (Hadza camps average about 30; Marlowe 2010)
  fissionSize: 50,          // a band this large may split (group sizes nest by about x3: families ~5, bands ~15-50, communities ~150; Hamilton et al. 2007)
  fusionSize: 8,            // a band this small may join another
  householdMove: 0.03,
  startKnowledge: 'none',   // 'none': a blank slate, nothing known about tools or fire; 'basic': like people landing on an island, some grown-ups know how to knap flint, point a stick, make fire and cook
  years: 0,                 // run length for the page (0 = until stopped)      // chance a month that a family moves to another band where it has kin (camp membership is fluid among foragers; approx.)
  clockMinutes: 60,
  density: 0.24,            // people per km² the land feeds in an ordinary year (Hadza, Marlowe)
  menarche: 16, firstPair: { F: 16, M: 18 }, menopause: 45, // forager menarche ~16, last births around 40 (Hadza)
  fecundability: 0.2, gestation: 0.75, maleRatio: 0.512, heritability: 0.4,
  birthRisk: 0.012,         // death of the mother per birth before modern medicine (Cambridge Group summary)
  illnessShare: 0.79,       // share of hunter-gatherer deaths from illness (~70%) and degenerative causes (~9%) (Gurven and Kaplan 2007)
  siler: { a1: 0.351, b1: 0.895, a2: 0.011, a3: 6.7e-6, b3: 0.125 }, // Hadza Siler fit (Gurven and Kaplan 2007, table 2; e0 = 34)
  campRadiusKm: 4,          // what the first band knows around its camp at the start
  poolHalfLifeDays: 3,      // food kept at camp spoils
  populationCap: 400,       // technical limit only
};

export const K = STREAMS.world[0];
export const SALT = SALTS; // every chance key is named once in streams.js (checked when imported)
export const draw = (s, id, salt, t = s.tick) => noise2(seedKey(s.seed), t, id, salt);
export const gauss = (s, id, salt, t) => { let z = 0; for (let i = 0; i < 4; i++) z += draw(s, id, salt + 0, t * 4 + i + 1); return (z - 2) * Math.sqrt(3); }; // approx. N(0,1)
export const SYL = ['ka', 'lo', 'mi', 'ne', 'ra', 'su', 'te', 'vi', 'ze', 'do', 'an', 'el', 'or', 'ul', 'ya', 'be', 'ha', 'ji', 'mu', 'si'];
export const nameOf = (s, id) => { const r = i => SYL[Math.floor(draw(s, id, SALT.newbornAlt, 7 + i) * SYL.length)]; return (r(0) + r(1) + (draw(s, id, SALT.newbornAlt, 9) < 0.4 ? r(2) : '')).replace(/^./, x => x.toUpperCase()); };
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

export const ageOf = (s, p) => (s.tick - p.born) / clockOf(s).year;
// The living and the households with someone alive, cached until a birth or a death (long runs keep everyone who
// ever lived, so loops must not walk the dead).
export const LIVE = new WeakMap(), HOMES = new WeakMap();
export const living = s => { let l = LIVE.get(s); if (!l) { l = s.people.filter(p => p.alive); LIVE.set(s, l); } return l; };
export const homes = s => { let h = HOMES.get(s); if (!h) { h = s.households.filter(x => x.members.some(i => s.people[i].alive)); HOMES.set(s, h); } return h; };
export const changed = s => { LIVE.delete(s); HOMES.delete(s); };
// Bands: each family belongs to one; each band has its own camp.
export const bandOf = (s, p) => s.bands[s.households[p.household]?.band ?? 0];
export const campOf = (s, p) => bandOf(s, p).camp;
export const bandMembers = (s, b) => living(s).filter(p => (s.households[p.household]?.band ?? 0) === b.id);
export const W = T.TW, H = T.TH;

export const placeName = q => `${Math.round(q.x * T.TILE_KM)} km east, ${Math.round(q.y * T.TILE_KM)} km south`;
export function note(s, p, text) { p.memories.push({ t: s.tick, text }); if (p.memories.length > 60) p.memories.shift(); }
export function event(s, text) { s.events.push({ t: s.tick, text }); if (s.events.length > 300) s.events.shift(); }

