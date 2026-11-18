// Island: the layers of existence and the human attribute system.
//
// This file READS the world and never writes to it. Nothing here changes a creature, a draw or an outcome.
// Every value is either read from state the sim already keeps, or computed from the seed by a fixed rule
// (temperament, plasticity), so the same seed always gives the same answer and the world is untouched.
//
// Status of each attribute:
//   'active'   the sim already has it and it already shapes what happens
//   'recorded' computed and shown, but it does not act on anything yet
//   'planned'  part of the design (docs: "Island: Minds and Agency"), not built; shows as empty
//
// Sources for the layers: Genesis 1–2 (each kind "after its kind"; the breath of life); Psalm 8:5;
// Aristotle, De Anima (nutritive, sensitive and rational powers); Aquinas, Summa Theologiae I q.50, q.76–78
// (angels as intellect and will without body; one human soul holding the powers of the lower layers).

import { noise2, seedKey, STREAMS, clamp } from './sim.js';
import { clockOf } from './clock.js';

const YR = s => clockOf(s).year; // 1440 on the legacy Eden clock, 8760 on the real clock

// ---------- Layers of existence ----------
// Each layer holds the powers of the layers below it, except spirit, which has intellect and will without a body.
export const LAYERS = [
  { id: 'matter', name: 'Matter', powers: 'Is, has place and amount, obeys the world\'s laws', agency: 'None',
    note: 'Land, water, the tree as a thing in a place.' },
  { id: 'life', name: 'Life', powers: 'Is nourished, grows, reproduces, decays', agency: 'None (grows toward what feeds it)',
    note: 'Groves, fields, the fruit. Genesis 1:11, "after its kind".' },
  { id: 'sense', name: 'Sense', powers: 'Perceives, remembers, desires, feels, moves, learns', agency: 'Natural: acts on drives and learning',
    note: 'Animals (none on the island yet) and the animal side of every human.' },
  { id: 'reason', name: 'Reason', powers: 'Understands, judges its own wants, holds or breaks a word, speaks, turns back', agency: 'Full: chooses, is accountable, can change course',
    note: 'Humans: matter, life, sense and reason in one being. Genesis 2:7; Psalm 8:5.' },
  { id: 'spirit', name: 'Spirit', powers: 'Intellect and will without a body; no needs, no growth; a choice once made stays', agency: 'Chooses targets and words; cannot force',
    note: 'The deceiver and the demons. Aquinas, Summa I q.50.' },
];
// Not a layer: the source of all of them.
export const SOURCE = { id: 'creator', name: 'The Creator', powers: 'Gives being and the laws; gives the word, guides, feeds, calls', agency: 'Never forces; acts consistently',
  note: 'Not one more being among the others. In the sim: fixed rules, not a developing mind.' };

export const KINDS = {
  thing:  { name: 'Thing',  layers: ['matter'] },
  plant:  { name: 'Plant',  layers: ['matter', 'life'] },
  animal: { name: 'Animal', layers: ['matter', 'life', 'sense'] },
  human:  { name: 'Human',  layers: ['matter', 'life', 'sense', 'reason'] },
  spirit: { name: 'Spirit', layers: ['spirit'] },
};

// What exists on this island, by kind. Read-only.
export function beingsOf(s) {
  const E = s.eden, alive = s.creatures.filter(c => c.alive);
  const groves = s.patches.filter(p => !p.field && !p.gift).length, fields = s.patches.filter(p => p.field).length;
  return [
    { kind: 'thing', layer: 'matter', items: [`${E.springs.length} springs`, 'the river', 'the land', 'the tree (as a place)'] },
    { kind: 'plant', layer: 'life', items: [`${groves} grove${groves === 1 ? '' : 's'}`, `${fields} tilled field${fields === 1 ? '' : 's'}`, 'the fruit of the tree'] },
    { kind: 'animal', layer: 'sense', items: ['none yet (an option in the design)'] },
    { kind: 'human', layer: 'reason', items: [`${alive.length} living`, `${s.creatures.length - alive.length} dead`] },
    { kind: 'spirit', layer: 'spirit', items: [E.config.serpent === false ? 'the deceiver (absent)' : 'the deceiver', `${E.tempters?.length ?? 0} demon${(E.tempters?.length ?? 0) === 1 ? '' : 's'}`] },
    { kind: 'source', layer: null, items: ['the Creator'] },
  ];
}

// ---------- Temperament ----------
// Panksepp's seven core emotional systems; frustration stands in for rage because Island has no combat.
// Seeking IS the curiosity the sim already uses. The other six are computed here from the seed, by the same rule
// curiosity uses: a uniform draw for the first generation; for children, mean + heritability x (midparent - mean) + noise.
export const TEMPERAMENT = [
  { key: 'seeking', label: 'Seeking', meaning: 'drive to explore and find out' },
  { key: 'fear', label: 'Fear', meaning: 'how strongly harm and threat register' },
  { key: 'care', label: 'Care', meaning: 'pull to tend, feed and protect others' },
  { key: 'grief', label: 'Grief', meaning: 'pain at separation and loss' },
  { key: 'play', label: 'Play', meaning: 'pull to be with others for its own sake' },
  { key: 'desire', label: 'Desire', meaning: 'pull toward a mate and pleasure' },
  { key: 'frustration', label: 'Frustration', meaning: 'reaction when blocked or deprived' },
];

const memo = new WeakMap(); // world -> Map(id -> temperament); a cache only, never part of the world
export function temperament(s, c) {
  let m = memo.get(s); if (!m) memo.set(s, m = new Map());
  if (m.has(c.id)) return m.get(c.id);
  const cfg = s.eden.config, lo = cfg.curiosityMin, hi = cfg.curiosityMax, mean = (lo + hi) / 2, k = seedKey(s.seed);
  const t = { seeking: c.eden.traits?.base.seeking ?? c.eden.curiosity }; // inborn seeking, even after development has moved curiosity
  const first = c.eden.mother === null, g = {};
  TEMPERAMENT.slice(1).forEach((x, i) => {
    const salt = STREAMS.temperament[0] + i;
    // Inheritance by breeding value (g): founders draw g given their temperament; a child's g is its parents' mean
    // plus Mendelian noise of half the additive variance, and its temperament adds an environmental part.
    const h2 = cfg.heritability, vp = (hi - lo) ** 2 / 12, b = first ? 0 : c.eden.born;
    const z = j => (noise2(k, b + 3 * j, c.id, salt) + noise2(k, b + 3 * j + 1, c.id, salt)
      + noise2(k, b + 3 * j + 2, c.id, salt) - 1.5) * 2; // approx. normal, sd 1
    if (first) {
      t[x.key] = lo + noise2(k, 0, c.id, salt) * (hi - lo);
      g[x.key] = mean + h2 * (t[x.key] - mean) + Math.sqrt(h2 * (1 - h2) * vp) * z(1);
    } else {
      const mo = temperament(s, s.creatures[c.eden.mother]), fa = temperament(s, s.creatures[c.eden.father]);
      g[x.key] = (mo.g[x.key] + fa.g[x.key]) / 2 + Math.sqrt(h2 * vp / 2) * z(1);
      t[x.key] = clamp(g[x.key] + Math.sqrt((1 - h2) * vp) * z(2), lo, hi);
    }
  });
  Object.defineProperty(t, 'g', { value: g, enumerable: false }); // breeding values, kept off the listed traits
  m.set(c.id, t);
  return t;
}

// ---------- Plasticity ----------
// How fast a creature can still change: 1 at birth, falling toward a floor with age. Recorded only; nothing uses it yet.
export const PLASTICITY = { tau: 8, floor: 0.15 };
export const plasticity = ageYears => PLASTICITY.floor + (1 - PLASTICITY.floor) * Math.exp(-Math.max(0, ageYears) / PLASTICITY.tau);

// ---------- The human attribute system ----------
// layer: which layer of existence the attribute belongs to. channel: Robert's five channels (Body, Feeling, Knowledge,
// Judgment, Practice), plus Temperament and Early life, which sit underneath them. read(s, c) returns the current value,
// or null when the attribute is planned and not built.
const age = (s, c) => (s.tick - c.eden.born) / YR(s);
const pct = v => Math.round(v * 100);
export const CHANNELS = ['Body', 'Feeling', 'Knowledge', 'Judgment', 'Practice', 'Temperament', 'Early life'];
export const HUMAN_ATTRIBUTES = [
  // Matter: the body as a thing in a place
  { key: 'place', label: 'Where it is', layer: 'matter', channel: 'Body', status: 'active', unit: '', read: (s, c) => `${c.x}, ${c.y}` },
  // Life: the body
  { key: 'health', label: 'Health', layer: 'life', channel: 'Body', status: 'active', unit: '/100', read: (s, c) => c.eden.health },
  { key: 'energy', label: 'Energy', layer: 'life', channel: 'Body', status: 'active', unit: '/100', read: (s, c) => c.energy },
  { key: 'hunger', label: 'Hunger', layer: 'life', channel: 'Body', status: 'active', unit: '/100', read: (s, c) => c.hunger },
  { key: 'thirst', label: 'Thirst', layer: 'life', channel: 'Body', status: 'active', unit: '/100', read: (s, c) => c.eden.thirst },
  { key: 'age', label: 'Age', layer: 'life', channel: 'Body', status: 'active', unit: ' years', read: (s, c) => age(s, c) },
  { key: 'children', label: 'Children', layer: 'life', channel: 'Body', status: 'active', unit: '', read: (s, c) => c.eden.children.length },
  { key: 'stage', label: 'Life stage', note: 'sets food, rest, healing and ageing', layer: 'life', channel: 'Body', status: 'recorded', statusOf: s => s.eden.config.lifeCourse ? 'active' : 'recorded', unit: '',
    read: (s, c) => lifeStage(age(s, c)).name, sub: (s, c) => { const st = lifeStage(age(s, c)); return `food ×${(st.food + pregnancyExtra(s, c)).toFixed(2)} · rest ${st.sleepHours}h of 24`; } },
  { key: 'healing', label: 'Healing speed', note: 'slows with age', layer: 'life', channel: 'Body', status: 'recorded', statusOf: s => s.eden.config.lifeCourse ? 'active' : 'recorded', unit: '%', read: (s, c) => pct(healFactor(age(s, c))) },
  { key: 'ageRisk', label: 'Yearly risk of dying of age', note: 'Gompertz; only after the fall', layer: 'life', channel: 'Body', status: 'recorded', statusOf: s => s.eden.config.lifeCourse ? 'active' : 'recorded', unit: '',
    read: (s, c) => `${(Math.min(1, ageHazard(age(s, c))) * 100).toFixed(age(s, c) < 40 ? 2 : 1)}%` },
  { key: 'plasticity', label: 'Plasticity', note: 'how fast it can still change', layer: 'life', channel: 'Body', status: 'recorded', unit: '%', read: (s, c) => pct(plasticity(age(s, c))) },
  // Sense: the animal side
  { key: 'sight', label: 'Sight', layer: 'sense', channel: 'Knowledge', status: 'active', unit: ' tiles', read: (s, c) => c.eden.sight },
  ...TEMPERAMENT.map(x => ({ key: 't_' + x.key, label: x.label, note: x.meaning, layer: 'sense', channel: 'Temperament',
    status: x.key === 'seeking' ? 'active' : 'recorded', unit: '%',
    read: (s, c) => pct((c.eden.traits?.now ?? temperament(s, c))[x.key]), sub: (s, c) => c.eden.traits ? `born ${pct(c.eden.traits.base[x.key])}%` : null })),
  { key: 'affect', label: 'Feelings now', note: 'fear, grief, contentment, longing', layer: 'sense', channel: 'Feeling', status: 'planned', phase: 1, read: () => null },
  { key: 'bar', label: 'Its bar', note: 'the hardship it is used to', layer: 'sense', channel: 'Feeling', status: 'planned', phase: 1, read: () => null },
  { key: 'dread', label: 'Places it dreads', layer: 'sense', channel: 'Feeling', status: 'planned', phase: 1, read: () => null },
  { key: 'bonds', label: 'Bonds', note: 'closeness to others', layer: 'sense', channel: 'Feeling', status: 'planned', phase: 2, read: () => null },
  // Reason: the human side
  { key: 'places', label: 'Food places it knows', layer: 'reason', channel: 'Knowledge', status: 'active', unit: '', read: (s, c) => Object.keys(c.known).length },
  { key: 'springs', label: 'Springs it knows', layer: 'reason', channel: 'Knowledge', status: 'active', unit: '', read: (s, c) => Object.keys(c.eden.water).length },
  { key: 'credence', label: 'Belief in the claim', note: 'what the deceiver said', layer: 'reason', channel: 'Knowledge', status: 'active', unit: '%', read: (s, c) => pct(c.eden.credence) },
  { key: 'warning', label: 'The word held', note: 'all or nothing for now; graded conviction is planned', layer: 'reason', channel: 'Judgment', status: 'active', unit: '%', read: (s, c) => pct(c.eden.warning) },
  { key: 'restored', label: 'Turned back', note: 'to the Creator, after the fall', layer: 'reason', channel: 'Judgment', status: 'active', unit: '', read: (s, c) => c.eden.covered ? 'yes' : 'no' },
  { key: 'selfModel', label: 'Knows its needs ahead', note: 'P4', layer: 'reason', channel: 'Judgment', status: 'planned', phase: 3, read: () => null },
  { key: 'character', label: 'Leanings', note: 'habits it has formed', layer: 'reason', channel: 'Practice', status: 'active', unit: '',
    read: (s, c) => { const b = Object.entries(c.eden.bias).filter(([, v]) => Math.abs(v) >= 0.05).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
      return b.length ? b.slice(0, 3).map(([k, v]) => `${v > 0 ? 'drawn to' : 'avoids'} ${k}`).join(', ') : 'none yet'; } },
  { key: 'skills', label: 'Gathering skill', layer: 'reason', channel: 'Practice', status: 'active', unit: '%', read: (s, c) => pct(Math.max(0, ...Object.values(c.skills))) },
  { key: 'made', label: 'Has made', layer: 'reason', channel: 'Practice', status: 'active', unit: '',
    read: (s, c) => [c.eden.clothed && 'clothing', c.eden.tool && 'a tool', s.patches.some(p => p.field && p.owner === c.id) && 'a field'].filter(Boolean).join(', ') || 'nothing yet' },
  { key: 'earlyLife', label: 'Early-life mark', note: 'trust, fear sensitivity', layer: 'reason', channel: 'Early life', status: 'planned', phase: 4, read: () => null },
  { key: 'standing', label: 'Standing', note: 'wisdom, character, goodwill in others\' eyes', layer: 'reason', channel: 'Judgment', status: 'planned', phase: 5, read: () => null },
];

// One creature's attributes, grouped by layer. Read-only.
export function attributesOf(s, c) {
  return LAYERS.filter(l => KINDS.human.layers.includes(l.id)).map(l => ({
    layer: l, rows: HUMAN_ATTRIBUTES.filter(a => a.layer === l.id).map(a => ({ ...a, status: a.statusOf ? a.statusOf(s) : a.status, value: a.read(s, c) })),
  })).filter(g => g.rows.length);
}

// ---------- Development: nature, then nurture ----------
// Off unless Eden's `traitDevelopment` is on. Then every DEV_EVERY ticks each living creature's seven traits move:
//   1. toward the traits of those around it (parents and children count double): what others are like rubs off;
//   2. with what happens to it: harm raises fear, losing family raises grief, being fed or feeding young raises care,
//      new finds raise seeking, time with peers raises play, going hungry with nowhere known to eat raises frustration;
//   3. slowly back toward what it was born with (nature keeps a pull).
// Every step is scaled by plasticity, so the young change fast and adults slowly. No randomness; it changes no draw.
// Parents pass on what they were BORN with (genes); what they became passes on only by living with the child.
// Seeking is the sim's curiosity, so with development on, curiosity moves too and does act on choices.
export const DEV_EVERY = 10;
export const DEV = {
  social: 0.003,   // share of the gap to those nearby closed per step, at full plasticity
  kin: 2,          // weight of a parent or child, against 1 for anyone else
  near: 2,         // tiles: who counts as around it
  experience: 0.06, // size of an experience's push, at full plasticity
  nature: 0.0005,  // pull back toward the inborn value per step, at full plasticity
  min: 0.02, max: 0.98,
};
const kinOf = (a, b) => a.eden.mother === b.id || a.eden.father === b.id || b.eden.mother === a.id || b.eden.father === a.id;
const relatives = (s, c) => [c.eden.mother, c.eden.father, ...c.eden.children].filter(id => id !== null).map(id => s.creatures[id]);

// f scales every step that runs with time (others, nature, steady conditions) so a year changes the same on any clock.
export function develop(s, f = 1) {
  const alive = s.creatures.filter(c => c.alive), keys = TEMPERAMENT.map(t => t.key);
  for (const c of alive) if (!c.eden.traits) {
    const born = temperament(s, c);
    c.eden.traits = { base: { ...born }, now: { ...born }, last: { health: c.eden.health, known: Object.keys(c.known).length, lost: 0, children: c.eden.children.length } };
  }
  const next = new Map();
  for (const c of alive) {
    const T = c.eden.traits, p = plasticity((s.tick - c.eden.born) / YR(s)), d = {};
    for (const k of keys) d[k] = 0;
    // 1. those around it
    let wsum = 0; const pull = {}; for (const k of keys) pull[k] = 0;
    for (const o of alive) {
      if (o === c || Math.abs(o.x - c.x) + Math.abs(o.y - c.y) > DEV.near) continue;
      const w = kinOf(c, o) ? DEV.kin : 1; wsum += w;
      for (const k of keys) pull[k] += w * (o.eden.traits.now[k] - T.now[k]);
    }
    if (wsum) for (const k of keys) d[k] += DEV.social * f * p * pull[k] / wsum;
    // 2. what happened to it since the last step (only what it lived through)
    const L = T.last, known = Object.keys(c.known).length, lost = relatives(s, c).filter(r => !r.alive).length;
    const push = (k, amount) => { d[k] += DEV.experience * p * amount * (1 - T.now[k]); };
    if (c.eden.health < L.health) push('fear', (L.health - c.eden.health) / 25);
    if (lost > L.lost) push('grief', lost - L.lost);
    if (known > L.known) push('seeking', 0.5);
    if (c.eden.children.length > L.children || (c.eden.mother !== null && s.tick - c.eden.born < 3 * YR(s) && c.hunger < 40)) push('care', 0.05 * (c.eden.children.length > L.children ? 1 : f));
    if (alive.some(o => o !== c && !kinOf(c, o) && Math.abs(o.x - c.x) + Math.abs(o.y - c.y) <= 1 && Math.abs(o.eden.born - c.eden.born) < 3 * YR(s))) push('play', 0.03 * f);
    if (c.hunger >= 70 && !Object.keys(c.known).some(id => (s.patches.find(q => q.id === id)?.stock ?? 0) >= 1)) push('frustration', 0.05 * f);
    // 3. nature's pull
    for (const k of keys) d[k] += DEV.nature * f * p * (T.base[k] - T.now[k]);
    next.set(c, d);
    T.last = { health: c.eden.health, known, lost, children: c.eden.children.length };
  }
  // apply after everyone is computed, so the order of creatures never matters
  for (const [c, d] of next) {
    const T = c.eden.traits;
    for (const k of keys) T.now[k] = Math.min(DEV.max, Math.max(DEV.min, T.now[k] + d[k]));
    c.eden.curiosity = T.now.seeking;
  }
}
export const traitsNow = (s, c) => c.eden.traits?.now ?? temperament(s, c);

// Summary of development in a world: how far traits moved from birth, and whether children ended up nearer their
// mother than they were born. Read-only. Returns null when development was off.
export function developmentSummary(s) {
  const keys = TEMPERAMENT.map(t => t.key), alive = s.creatures.filter(c => c.alive && c.eden.traits);
  if (!alive.length) return null;
  const shift = Object.fromEntries(keys.map(k => [k, alive.reduce((n, c) => n + Math.abs(c.eden.traits.now[k] - c.eden.traits.base[k]), 0) / alive.length * 100]));
  let closer = 0, pairs = 0;
  for (const c of alive) {
    const mo = c.eden.mother === null ? null : s.creatures[c.eden.mother].eden.traits;
    if (!mo) continue;
    for (const k of keys) { pairs++; if (Math.abs(c.eden.traits.now[k] - mo.now[k]) < Math.abs(c.eden.traits.base[k] - mo.base[k])) closer++; }
  }
  return { shift, meanShift: keys.reduce((n, k) => n + shift[k], 0) / keys.length, closer, pairs };
}

// ---------- The body through the life course (Eden input `lifeCourse`, off by default) ----------
// Figures, rounded, with sources (see docs/THEORY-CHECK.md, "Body through the life course"):
//   sleep  : CDC / American Academy of Sleep Medicine hours per 24 h by age (toddler 11-14, preschool 10-13,
//            school age 9-12, teen 8-10, adult 7+, 65+ 7-8). Used as the share of time a creature must rest.
//   food   : Dietary Guidelines for Americans estimated calorie needs by age, relative to an adult (~2,000 kcal):
//            age 2-3 ~1,000; 4-8 ~1,400; 9-13 ~1,800; 14-18 ~2,200; 51+ ~1,800. Needs rise to about 20, then fall.
//   pregnancy: +340 kcal/day in the second trimester, +450 in the third (about +17% and +22%).
//   ageing : Gompertz law, the yearly risk of dying doubles about every 8 years of adult age.
// On the legacy clock there is no day and night (one sim day is a year), so "sleep" is the share of time resting.
// On the real clock (clock.js) there is: adults sleep at night, and the body's needs come from energy.js.
export const LIFE_STAGES = [
  { id: 'infant', name: 'Infant', plural: 'infants', from: 0, sleepHours: 14, food: 0.5 },
  { id: 'toddler', name: 'Toddler', plural: 'toddlers', from: 1, sleepHours: 12.5, food: 0.5 },
  { id: 'preschool', name: 'Young child', plural: 'young children', from: 3, sleepHours: 11.5, food: 0.6 },
  { id: 'child', name: 'Child', plural: 'children', from: 5, sleepHours: 10.5, food: 0.7 },
  { id: 'juvenile', name: 'Older child', plural: 'older children', from: 9, sleepHours: 10, food: 0.9 },
  { id: 'adolescent', name: 'Adolescent', plural: 'adolescents', from: 14, sleepHours: 9, food: 1.1 },
  { id: 'adult', name: 'Adult', plural: 'adults', from: 18, sleepHours: 7.5, food: 1.0 },
  { id: 'middle', name: 'Middle age', plural: 'the middle-aged', from: 50, sleepHours: 7.5, food: 0.9 },
  { id: 'elder', name: 'Elder', plural: 'elders', from: 65, sleepHours: 7.5, food: 0.85 },
];
export const LIFE = {
  adultSleepHours: 7.5,
  pregnancyFood: [0, 0.17, 0.22],   // extra food need by trimester
  hazardAt70: 0.05,                 // yearly risk of dying of age at 70 (assumption; Robert to set)
  hazardDoubling: 8,                // years (Gompertz)
  healFullUntil: 30, healLossPerYear: 0.01, healFloor: 0.4, // healing slows with age (assumption)
  illnessYoung: 1.3, illnessOld: 1.5, youngUntil: 12, oldFrom: 65, // susceptibility (assumption)
};
export const lifeStage = ageYears => [...LIFE_STAGES].reverse().find(st => ageYears >= st.from) ?? LIFE_STAGES[0];
// How much faster than an adult this stage tires: the odds of resting r/(1-r) against an adult's.
export const sleepFactor = st => { const odds = h => (h / 24) / (1 - h / 24); return odds(st.sleepHours) / odds(LIFE.adultSleepHours); };
// Sleep pressure: tiredness from simply being awake, set so that a creature that rests only to recover needs to rest
// about its stage's share of the day: awake drain d and rest gain g balance when rest share r = d / (d + g).
export const wakeDrain = (st, restGain) => { const r = st.sleepHours / 24; return restGain * r / (1 - r); };
export const healFactor = ageYears => Math.max(LIFE.healFloor, 1 - LIFE.healLossPerYear * Math.max(0, ageYears - LIFE.healFullUntil));
export const illnessFactor = ageYears => ageYears < LIFE.youngUntil ? LIFE.illnessYoung : ageYears >= LIFE.oldFrom ? LIFE.illnessOld : 1;
// Yearly hazard of dying of age (Gompertz): mu(x) = mu(70) * 2^((x - 70) / doubling).
export const ageHazard = ageYears => LIFE.hazardAt70 * 2 ** ((ageYears - 70) / LIFE.hazardDoubling);
export function pregnancyExtra(s, c) {
  const p = c.eden.pregnant; if (!p) return 0;
  const g = s.eden.config.gestation * YR(s), progress = 1 - (p.due - s.tick) / g;
  return LIFE.pregnancyFood[Math.min(2, Math.max(0, Math.floor(progress * 3)))];
}
