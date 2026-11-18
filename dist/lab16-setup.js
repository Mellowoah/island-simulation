// Island Lab 16-bit: the setup screen's choices. Pure data and checks; no simulation rules live here.
// Each choice names the theory line (T1–T10) or prediction (P1–P5) it tests, worded from the
// "Island Lab: Theory Reference" canvas. T6, T7, T9 and T10 are only proposed and are labelled so.

import { defaultClock } from './clock.js';
export const THEORY = {
  T1: 'People are warned at the beginning of their lives.',
  T2: 'While they keep the warning, God leads them toward good whenever their curiosity carries them outside what is best, and they freely follow.',
  T3: 'Never eating is acceptable. The fall is not required.',
  T4: 'A hidden deceiver persuades one independent agent by casting doubt on the warning itself. That single act releases everyone to their own devices.',
  T5: 'After release they must produce everything they need from knowledge and resources. Each develops its own wants, needs, fears and traits.',
  T6: '[proposed] Before release, freedom is whole and sheltered. After release, freedom is wider in range but wounded, bent toward self.',
  T7: '[proposed] Guidance is good for them in the moment. Whether it prepares them for release is the open question.',
  T8: 'How someone is doing now is separate from what they can do later; group gains don\'t erase individual losses; neither help nor hardship is assumed good or bad; what happened is separate from what anyone believes or approves.',
  T9: 'After the fall, all who choose to turn back and realign live where the Creator guides, feeds and brings peace. (Robert, 15 Nov 2026. Modelled on the biblical reading, as one of many possible worlds.)',
  T10: '[proposed] The fall is a real loss, not a needed step, though God brings good out of it.',
  T11: 'The deceiver has the traits Scripture gives Satan: he lies, he cannot force anyone, and demons seek his direction. (Robert, 15 Nov 2026.)',
};
export const PROPOSED = ['T6', 'T7', 'T10'];
export const PREDICTIONS = {
  P1: 'Creatures guided more are less likely to eat when the deceiver speaks.',
  P2: 'Populations guided more before the fall survive the first years after release better.',
  P3: 'After release, individuals grow more different from each other than while guided.',
  P4: 'Released creatures get better at predicting their own needs than guided ones.',
  P5: 'Help builds later ability to get food.',
};
export const lineLabel = id => (PROPOSED.includes(id) ? `${id} (proposed)` : id);

export const WORLDS = {
  eden: { label: 'Eden test (warning, guidance, deceiver, release)', note: 'The world the theory is about. Tests T1–T5 and P1, P2, P3, P5.' },
  lab: { label: 'Lab island (trust and rumours)', note: 'The older Lab island. It has no warning, guidance or release, so it cannot test P1–P5. Keeps your saved island.' },
};

// One field per control. `worlds` says where the sim supports it. Notes are one line each.
export const SETUP_FIELDS = [
  { key: 'seed', label: 'Island seed', type: 'number', min: 1, max: 999999, step: 1, def: 41, worlds: ['eden', 'lab'],
    note: 'Same seed and same choices give the same island and the same history. Change it to check a result is not luck (T8: what happened is kept apart from what anyone believes).' },
  { key: 'population', label: 'Creatures', type: 'number', min: 8, max: 48, step: 4, def: 24, worlds: ['lab'],
    fixed: { eden: 24 },
    note: 'How many creatures start. T8: group gains don\'t erase individual losses, so each one is counted.',
    fixedNote: 'Fixed at 24 in Eden: the Eden code has no setting for it, and this run does not change sim rules.' },
  { key: 'realClock', label: 'Clock', type: 'select', options: [[1, 'Real: 1 tick = 1 hour'], [0, 'Legacy: old results']], def: 1, worlds: ['eden'],
    note: 'Real: one clock for every world (day and night, real rates with sources, matched growth and decay, one law of energy for every body). Legacy reproduces runs made before 17 Nov. T5: after release the body\'s real needs must be met from what they know and find.' },
  { key: 'serpent', label: 'The deceiver is present', type: 'toggle', def: true, worlds: ['eden'],
    note: 'Off: the serpent never appears or speaks, so nobody is tempted and the fall cannot come from him. T3: never eating is acceptable; the fall is not required. T4: the fall comes through the deceiver\'s doubt.' },
  { key: 'guidance', label: 'How often the Creator steps in', type: 'select', options: [[1, 'Always'], [0.75, '75% of months'], [0.5, '50% of months'], [0.25, '25% of months'], [0, 'Never']], def: 1, worlds: ['eden'],
    note: 'Tests P1 (guided more, less likely to eat when the deceiver speaks) and P2 (guided more, survive the first years after release better). Lines T2, T4 and T7 (proposed). "Always" is the original rule.' },
  { key: 'guidanceYears', label: 'Deceiver stays silent at first (years)', type: 'number', min: 0, max: 10, step: 1, def: 0, worlds: ['eden'],
    note: 'Delays when the deceiver may first speak (T4). On its own it does not change how much anyone is guided, so P1 and P2 are judged with the setting above, not this one.' },
  { key: 'help', label: 'Your help (food near the start)', type: 'toggle', def: false, worlds: ['eden'],
    note: 'Tests P5 (help builds later ability to get food). When on, you leave 40 food near the start every month for the first half of the run, then stop. T8: help is not assumed good or bad.' },
  { key: 'falseInfo', label: 'False information', type: 'select', options: [[0, 'None'], [0.05, '5%'], [0.1, '10%'], [0.25, '25%']], def: 0, worlds: ['lab'],
    note: 'Share of passed-on messages that are false: a lying voice among the creatures, closest to T4 (doubt cast on what they were told). Not one of P1–P5.' },
  { key: 'lifeCourse', label: 'The body changes with age', type: 'toggle', def: false, worlds: ['eden'],
    note: 'Off: every creature has one adult body. On: sleep need, food need, healing and illness change with life stage; pregnancy needs more food; after the fall, the risk of dying of age doubles every 8 years. Figures from CDC sleep guidance, US Dietary Guidelines and the Gompertz law. T5: after release they must provide everything their body needs at each stage of life.' },
  { key: 'traitDev', label: 'Traits develop through life', type: 'toggle', def: false, worlds: ['eden'],
    note: 'Off: each creature keeps the seven traits it was born with. On: born with traits drawn from its parents, then shaped all its life by those it spends time with (parents count double), by what happens to it, and slowly back toward its nature; the young change fast, adults slowly. T5: each develops its own wants, needs, fears and traits. Seeking is curiosity, so it acts on choices; the other six are recorded until later phases.' },
  { key: 'restoration', label: 'A way back after the fall', type: 'toggle', def: false, worlds: ['eden'],
    note: 'Tests T9. Once a year the Creator calls each released creature. It weighs the call itself (its need, the word, its belief in the deceiver) and may turn back. Those who do are led and fed again, in the same fallen world.' },
  { key: 'tempters', label: 'Demons sent by the deceiver', type: 'select', options: [[0, 'None'], [1, '1'], [3, '3'], [6, '6']], def: 0, worlds: ['eden'],
    note: 'Tests T11. After the fall they seek creatures out and whisper the same lie. They cannot touch or force anyone; each creature answers for itself. They go first for those who turned back.' },
  { key: 'fallAgain', label: 'The restored can be drawn away again', type: 'toggle', def: true, worlds: ['eden'],
    note: 'Tests T9 and T11 together. Christian traditions differ on this, so it is a choice: on, a whisper can lead a restored creature away; off, it has no hold.' },
  // Natural drives. Each one only rescales a number the Eden sim already has; "Normal" is the original value.
  { key: 'dAppetite', label: 'Drive: appetite', type: 'select', options: [[0.75, 'Low'], [1, 'Normal'], [1.25, 'High']], def: 1, worlds: ['eden'],
    note: 'How fast hunger builds. T5: each has its own needs; a stronger appetite also adds to the pull of the fruit as food (T4).' },
  { key: 'dThirst', label: 'Drive: thirst', type: 'select', options: [[0.75, 'Low'], [1, 'Normal'], [1.25, 'High']], def: 1, worlds: ['eden'],
    note: 'How fast thirst builds. T5: after release they must meet every need from what they know.' },
  { key: 'dCuriosity', label: 'Drive: curiosity', type: 'select', options: [[-0.15, 'Low'], [0, 'Normal'], [0.15, 'High']], def: 0, worlds: ['eden'],
    note: 'Shifts every creature\'s inborn curiosity. T2: curiosity is what carries them outside what is best; T4: it is what the deceiver\'s claim works on.' },
  { key: 'dChildren', label: 'Drive: to have children', type: 'select', options: [[0.1, 'Low'], [0.2, 'Normal'], [0.3, 'High']], def: 0.2, worlds: ['eden'],
    note: 'Chance of conceiving in a month when fed and near a partner. T5: more mouths after release means more to produce.' },
  { key: 'dFruit', label: 'Drive: desire of the eyes', type: 'select', options: [[0.25, 'Low'], [0.5, 'Normal'], [0.75, 'High']], def: 0.5, worlds: ['eden'],
    note: 'How pleasing the fruit looks to them. T4: one of the three pulls at the tree (good for food, pleasing to the eye, desirable for wisdom).' },
  { key: 'dWarning', label: 'How firmly they hold the warning', type: 'select', options: [[2, 'Loosely'], [3, 'Normal'], [4, 'Firmly']], def: 3, worlds: ['eden'],
    note: 'The weight of the remembered warning against the three pulls. T2 and T4: it is what stands against the deceiver\'s doubt.' },
  { key: 'food', label: 'Food in each source', type: 'select', options: [[60, 'Plenty'], [30, 'Tight'], [15, 'Scarce']], def: 60, worlds: ['lab'],
    note: 'How much each food source can hold. With plenty, knowing where food is hardly matters; scarcity is where telling and trust can cost or save lives (T8: hardship is not assumed good or bad).' },
  { key: 'regrowth', label: 'Food regrowth', type: 'select', options: [[0.03, 'Normal'], [0.015, 'Half'], [0.0075, 'Quarter']], def: 0.03, worlds: ['lab'],
    note: 'How fast eaten food grows back. Slower regrowth makes a source run dry sooner (T8: how they are doing now is kept apart from what they can do later).' },
  { key: 'talk', label: 'Creatures can tell each other things', type: 'toggle', def: true, worlds: ['lab'],
    note: 'Off: each creature knows only what it has seen itself. Compares shared knowledge with first-hand knowledge (T8: what happened is kept apart from what anyone believes).' },
  { key: 'barWindow', label: 'How fast the bar moves', type: 'select', options: [[0.5, 'Fast'], [1, 'Medium'], [3, 'Slow']], def: 1, worlds: ['eden', 'lab'],
    note: 'Measure only; it changes no creature, so it tests nothing by itself. Each creature\'s bar is its own average hardship over about this many days (years in Eden). T8: how they are doing is kept apart from how it compares with what they are used to.' },
  { key: 'speed', label: 'Sim speed', type: 'select', options: [[1, '1× slow'], [4, '4×'], [16, '16×'], [64, '64× fast']], def: 16, worlds: ['eden', 'lab'],
    note: 'Display only. Results are identical at every speed, so it tests nothing.' },
  { key: 'runDays', label: 'Run length (Eden: years; Lab island: days)', type: 'number', min: 2, max: 500, step: 1, def: 15, worlds: ['eden', 'lab'],
    note: 'Eden runs up to 500 years, many generations (the Lab island stays at most 30 days). Long enough to see release, the years after it, and what passes down: T5, P2 and P3. Long runs take minutes; the population cap (96) still applies and is reported.' },
];

export function defaultSetup(world = 'eden') {
  const out = { world };
  for (const f of SETUP_FIELDS) out[f.key] = f.def;
  return out;
}

const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
// Clamp every input to what the sim supports. Unknown keys are dropped.
export function normalizeSetup(input = {}) {
  const world = input.world === 'lab' ? 'lab' : 'eden';
  const out = { world };
  for (const f of SETUP_FIELDS) {
    let v = input[f.key];
    if (f.type === 'number') { v = Math.round(num(v, f.def)); v = Math.min(f.max, Math.max(f.min, v)); if (f.step > 1) v = f.min + Math.round((v - f.min) / f.step) * f.step; v = Math.min(f.max, v); }
    else if (f.type === 'toggle') v = v === undefined ? f.def : (v === true || v === 'true' || v === 'on' || v === 1);
    else if (f.type === 'select') { v = num(v, f.def); if (!f.options.some(([o]) => o === v)) v = f.def; }
    if (f.fixed && f.fixed[world] !== undefined) v = f.fixed[world];
    out[f.key] = v;
  }
  if (world === 'lab') { out.guidanceYears = 0; out.guidance = 1; out.help = false; out.restoration = false; out.tempters = 0; out.fallAgain = true; out.traitDev = false; out.lifeCourse = false; out.serpent = true; out.dAppetite = 1; out.dThirst = 1; out.dCuriosity = 0; out.dChildren = 0.2; out.dFruit = 0.5; out.dWarning = 3; }
  if (input.realClock === undefined) out.realClock = defaultClock() === 'real' ? 1 : 0; // new runs use the real clock unless a test asks for the old one
  if (world === 'lab') out.runDays = Math.min(30, out.runDays); // the Lab island's own limit
  if (world === 'eden') { out.falseInfo = 0; out.food = 60; out.regrowth = 0.03; out.talk = true; }
  return out;
}

// Eden inputs for the natural-drive settings. Only existing sim numbers are rescaled; at "Normal" this returns the originals.
export function driveConfig(setup, base, simBase) {
  const cl = v => Math.min(1, Math.max(0, v));
  return { sim: setup.dAppetite === 1 ? {} : { hungerRate: simBase.hungerRate * setup.dAppetite },
    eden: { thirstRate: base.thirstRate * setup.dThirst, curiosityMin: cl(base.curiosityMin + setup.dCuriosity), curiosityMax: cl(base.curiosityMax + setup.dCuriosity), fecundability: setup.dChildren, beauty: setup.dFruit, wWarn: setup.dWarning } };
}

export const fieldsFor = world => SETUP_FIELDS.filter(f => f.worlds.includes(world) || (f.fixed && f.fixed[world] !== undefined));

// Help schedule (driver input, like a player tapping "provide food"; uses the existing sim command).
export const HELP = { amount: 40, every: 120 }; // legacy: 40 food every month (1440 ticks = 1 year in Eden). Real clock: the same share of a year's food (lab16-run.js)
