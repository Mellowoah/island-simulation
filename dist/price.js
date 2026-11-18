// ---------- the Price equation (idea 10) ----------
// Price (1970): the change in a population's mean trait over a generation splits exactly into two parts,
//   w̄ Δz̄ = Cov(w, z) + E(w Δz)
// selection (those with more of the trait leave more offspring) and transmission (offspring differ from their
// parents: inheritance that is less than perfect, regression to the mean, learning). It is an identity, not a model:
// it holds for any population, so it says why a trait moved, not what moves it. Here w is the number of children a
// person had in a window and z' the mean trait of those children; each child is counted once for each parent.
import { MIND_KEYS } from './w-people.js';
import { clockOf } from './clock.js';

export function price(rows) { // rows: [{ z, w, zOff }] (zOff ignored when w = 0)
  const n = rows.length, wbar = rows.reduce((a, r) => a + r.w, 0) / n, zbar = rows.reduce((a, r) => a + r.z, 0) / n;
  if (!(wbar > 0)) return null;
  const cov = rows.reduce((a, r) => a + (r.w - wbar) * (r.z - zbar), 0) / n, ewdz = rows.reduce((a, r) => a + (r.w > 0 ? r.w * (r.zOff - r.z) : 0), 0) / n;
  const zOffBar = rows.reduce((a, r) => a + (r.w > 0 ? r.w * r.zOff : 0), 0) / (n * wbar); // offspring mean, each child once per parent
  return { n, wbar, zbar, dz: zOffBar - zbar, selection: cov / wbar, transmission: ewdz / wbar, check: zOffBar - zbar - (cov + ewdz) / wbar };
}
// The traits a person carries from birth: mind (0-1) and body factors (multipliers about 1)
export const TRAITS = [...MIND_KEYS.map(k => ['mind', k]), ['f', 'mass'], ['f', 'fat'], ['f', 'bmr'], ['f', 'speed']];
const traitOf = (p, [a, k]) => p[a][k];
// Parents: everyone 15 or older and alive at tick t0. Offspring: their children born after t0 up to t1.
export function priceOfWorld(s, t0, t1 = s.tick, minAge = 15) {
  const Y = clockOf(s).year;
  const alive0 = s.people.filter(p => p.born <= t0 - minAge * Y && (p.alive || p.death.t > t0));
  const kids = new Map(alive0.map(p => [p.id, []]));
  for (const c of s.people) if (c.born > t0 && c.born <= t1) for (const id of [c.mother, c.father]) kids.get(id)?.push(c);
  const out = {};
  for (const tr of TRAITS) out[tr.join('.')] = price(alive0.map(p => { const ks = kids.get(p.id); return { z: traitOf(p, tr), w: ks.length, zOff: ks.length ? ks.reduce((a, c) => a + traitOf(c, tr), 0) / ks.length : 0 }; }));
  return out;
}
