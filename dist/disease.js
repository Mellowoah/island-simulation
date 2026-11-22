// Island, Layer 6 (people), step 2a: illness that passes between people.
// One general engine for germs carried in the nose and throat: each person carries the germ or not; carriers pass it
// on to the people they live with (household) and, more weakly, to the rest of their camp; carriage clears by
// itself; now and then a new carriage turns into disease, which a hungry body survives less often.
// Each germ is a table of measured numbers. The first is Streptococcus pneumoniae, the leading bacterial cause of
// pneumonia in young children. Off by default (config.disease.pneumococcus) until steps 2a-2c can replace the Hadza
// illness curve together; while both are on, deaths from this germ are counted twice (stated in THEORY-CHECK).
import { R, clockOf } from './clock.js';
import { draw, SALT, living } from './w-core.js';
import { die } from './w-people.js';

// Melegaro, Gay & Medley 2004 (Epidemiol. Infect. 132:433), 121 UK households, swabs every 4 weeks; children are
// under 5. Per day. Starting shares by age: Hussain et al. 2005 (same study), mean carriage by age.
export const PNEUMOCOCCUS = {
  childAge: 5,
  community: { child: 0.012, adult: 0.004 }, // acquisition from outside the household (k1, k2)
  communityShare: 0.25, // share of all swabs positive in that study: the carriers that community rate was met with
  household: { childFromChild: 0.047, childFromAdult: 0.106, adultFromChild: 0.005, adultFromAdult: 0.048 },
  densityW: 1.184, // within-household rate divided by (household size - 1)^w
  clear: { child: 0.02, adult: 0.053 }, // carriage lasts 51 and 19 days on average
  startShare: [
    [3, 0.52],
    [5, 0.45],
    [18, 0.21],
    [Infinity, 0.08],
  ],
};
const isChild = (p, g) => p.body.age < g.childAge;
const homeOf = (s, p) => s.households[p.household];

export function startCarriage(s, g = PNEUMOCOCCUS) {
  for (const p of living(s)) {
    const share = g.startShare.find(([age]) => p.body.age < age)[1];
    p.pnc = draw(s, p.id, SALT.pncStart) < share;
  }
  s.disease = { acquired: 0, cleared: 0, cases: 0, deaths: 0, days: 0, carrierDays: 0, personDays: 0 };
}

// Carriers and people, by household and by band, counted once a day before anyone changes.
export function tally(s, g = PNEUMOCOCCUS) {
  const hh = new Map(),
    band = new Map();
  for (const p of living(s)) {
    const h = homeOf(s, p),
      b = h?.band ?? 0,
      k = isChild(p, g) ? 'child' : 'adult';
    const th = hh.get(p.household) ?? { n: 0, child: 0, adult: 0 },
      tb = band.get(b) ?? { n: 0, c: 0 };
    th.n++;
    tb.n++;
    if (p.pnc) {
      th[k]++;
      tb.c++;
    }
    hh.set(p.household, th);
    band.set(b, tb);
  }
  return { hh, band };
}

// Daily chance of picking the germ up: from carriers at home (Melegaro's household rates, divided by (size-1)^w)
// plus from the rest of the camp (the community rate, scaled by how many of the others in camp carry it, relative
// to the share of carriers behind that measured rate). There is no world outside the island to bring it in.
export function forceOn(s, p, T, g = PNEUMOCOCCUS) {
  const h = T.hh.get(p.household),
    b = T.band.get(homeOf(s, p)?.band ?? 0),
    child = isChild(p, g),
    me = p.pnc ? 1 : 0,
    kids = h.child - (child ? me : 0),
    grown = h.adult - (child ? 0 : me);
  const H = g.household,
    home = child
      ? H.childFromChild * kids + H.childFromAdult * grown
      : H.adultFromChild * kids + H.adultFromAdult * grown,
    perHome = h.n > 1 ? home / Math.pow(h.n - 1, g.densityW) : 0;
  const othersN = b.n - h.n,
    othersC = b.c - h.child - h.adult,
    campShare = othersN > 0 ? othersC / othersN : 0;
  return perHome + (child ? g.community.child : g.community.adult) * (campShare / g.communityShare);
}

// How much a hungry body raises the chance of dying of it: the hazard ratio for severe wasting (Olofin et al. 2013,
// pooled cohorts, 11.6) reached as the body's fat store empties, rising log-linearly from the share where hunger
// begins to tell (an assumption). Case fatality then follows proportional hazards: 1 - (1 - base)^HR.
export function hungerHazard(p) {
  const r = Math.max(0, (p.reserve ?? 0) / p.body.fatMax),
    start = R('hungerRiskReserve'),
    x = Math.min(1, Math.max(0, (start - r) / start));
  return Math.exp(Math.log(R('hungerRiskMax')) * x);
}
export function caseFatality(p, g = PNEUMOCOCCUS) {
  const base = isChild(p, g) ? R('pneumoniaFatalChild') : R('pneumoniaFatalAdult');
  return 1 - Math.pow(1 - base, hungerHazard(p));
}

// Once a day: the sick reach their crisis; then every person clears or picks up the germ, all from the morning's
// counts, so the order people are visited in changes nothing.
export function diseaseDay(s, g = PNEUMOCOCCUS) {
  if (!s.disease) startCarriage(s, g);
  crisis(s);
  const T = tally(s, g),
    D = s.disease,
    change = [];
  for (const p of living(s)) {
    D.personDays++;
    if (p.pnc) {
      D.carrierDays++;
      const rate = isChild(p, g) ? g.clear.child : g.clear.adult;
      if (draw(s, p.id, SALT.pncClear) < 1 - Math.exp(-rate)) change.push([p, false]);
    } else if (draw(s, p.id, SALT.pncCatch) < 1 - Math.exp(-forceOn(s, p, T, g))) change.push([p, true]);
  }
  for (const [p, now] of change) {
    p.pnc = now;
    if (now) (D.acquired++, maybeIll(s, p, g));
    else D.cleared++;
  }
  D.days++;
}
// A new carriage turns into pneumonia at the register's rate; untreated pneumonia runs to its crisis in about a
// week, and whether the person lives through it is drawn at the start (from their body as it was then).
function maybeIll(s, p, g) {
  if (p.ill || draw(s, p.id, SALT.pncIll) >= R('pneumoniaPerCarriage')) return;
  const C = clockOf(s);
  p.ill = {
    until: s.tick + Math.round(R('pneumoniaDays') * C.day),
    dies: draw(s, p.id, SALT.pncFatal) < caseFatality(p, g),
  };
  s.disease.cases++;
}
function crisis(s) {
  for (const p of living(s)) {
    if (!p.ill || s.tick < p.ill.until) continue;
    const dies = p.ill.dies;
    p.ill = null;
    if (dies) (s.disease.deaths++, die(s, p, 'Pneumonia'));
  }
}
// The share of person-days spent carrying the germ (a check against carriage surveys, never used to set anything).
export const carriageShare = s => (s.disease?.personDays ? s.disease.carrierDays / s.disease.personDays : NaN);
