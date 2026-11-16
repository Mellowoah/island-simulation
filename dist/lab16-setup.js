// Island Lab 16-bit: the setup screen's choices. Pure data and checks; no simulation rules live here.
// Each choice names the theory line (T1–T10) or prediction (P1–P5) it tests, worded from the
// "Island Lab: Theory Reference" canvas. T6, T7, T9 and T10 are only proposed and are labelled so.

export const THEORY = {
  T1: 'People are warned at the beginning of their lives.',
  T2: 'While they keep the warning, God leads them toward good whenever their curiosity carries them outside what is best, and they freely follow.',
  T3: 'Never eating is acceptable. The fall is not required.',
  T4: 'A hidden deceiver persuades one independent agent by casting doubt on the warning itself. That single act releases everyone to their own devices.',
  T5: 'After release they must produce everything they need from knowledge and resources. Each develops its own wants, needs, fears and traits.',
  T6: '[proposed] Before release, freedom is whole and sheltered. After release, freedom is wider in range but wounded, bent toward self.',
  T7: '[proposed] Guidance is good for them in the moment. Whether it prepares them for release is the open question.',
  T8: 'How someone is doing now is separate from what they can do later; group gains don\'t erase individual losses; neither help nor hardship is assumed good or bad; what happened is separate from what anyone believes or approves.',
  T9: '[proposed] After the fall, God responds: He covers them and promises a rescue. The model must not show loss alone.',
  T10: '[proposed] The fall is a real loss, not a needed step, though God brings good out of it.',
};
export const PROPOSED = ['T6', 'T7', 'T9', 'T10'];
export const PREDICTIONS = {
  P1: 'Creatures guided longer are less likely to eat when the deceiver speaks.',
  P2: 'Populations guided longer before the fall survive the first years after release better.',
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
  { key: 'guidanceYears', label: 'Guidance before the deceiver speaks (years)', type: 'number', min: 0, max: 10, step: 1, def: 3, worlds: ['eden'],
    note: 'Tests P1 (guided longer, less likely to eat when the deceiver speaks) and P2 (guided longer, survive the first years after release better). Lines T2, T4 and T7 (proposed).' },
  { key: 'help', label: 'Your help (food near the start)', type: 'toggle', def: false, worlds: ['eden'],
    note: 'Tests P5 (help builds later ability to get food). When on, you leave 40 food near the start every month for the first half of the run, then stop. T8: help is not assumed good or bad.' },
  { key: 'falseInfo', label: 'False information', type: 'select', options: [[0, 'None'], [0.05, '5%'], [0.1, '10%'], [0.25, '25%']], def: 0, worlds: ['lab'],
    note: 'Share of passed-on messages that are false: a lying voice among the creatures, closest to T4 (doubt cast on what they were told). Not one of P1–P5.' },
  { key: 'speed', label: 'Sim speed', type: 'select', options: [[1, '1× slow'], [4, '4×'], [16, '16×'], [64, '64× fast']], def: 16, worlds: ['eden', 'lab'],
    note: 'Display only. Results are identical at every speed, so it tests nothing.' },
  { key: 'runDays', label: 'Run length (days)', type: 'number', min: 2, max: 30, step: 1, def: 15, worlds: ['eden', 'lab'],
    note: 'In Eden one day is one year. Long enough to see release and the years after it: T5, P2 and P3.' },
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
    else if (f.type === 'toggle') v = v === true || v === 'true' || v === 'on' || v === 1;
    else if (f.type === 'select') { v = num(v, f.def); if (!f.options.some(([o]) => o === v)) v = f.def; }
    if (f.fixed && f.fixed[world] !== undefined) v = f.fixed[world];
    out[f.key] = v;
  }
  if (world === 'lab') { out.guidanceYears = 0; out.help = false; }
  if (world === 'eden') out.falseInfo = 0;
  return out;
}

export const fieldsFor = world => SETUP_FIELDS.filter(f => f.worlds.includes(world) || (f.fixed && f.fixed[world] !== undefined));

// Help schedule (driver input, like a player tapping "provide food"; uses the existing sim command).
export const HELP = { amount: 40, every: 120 }; // 40 food every month (1440 ticks = 1 year in Eden)
