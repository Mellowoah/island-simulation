// Island: one learning engine for every creature (research plan; idea 4 of 10).
// The rule is the same for all: an expectation moves toward what is seen by a share of the surprise (the prediction
// error), the delta rule of Rescorla and Wagner (1972) and of temporal-difference learning. Minimising squared surprise
// this way is minimising cross-entropy under a normal error model, so it is the same objective the model as a whole is
// scored by (patterns.js). What differs between creatures is capacity, not the rule: how many past looks count (memory),
// how fast a season or a danger is learned, how fast it is forgotten, and whether others' experience is shared.
import { R } from './clock.js';

// Capacities by kind of creature. People: place levels average up to the last 10 looks; season shapes move 20% of the
// surprise each look; recovery times average up to 20 implied observations (all as before this refactor). Herds:
// wariness of people is shared by the herd in a place (they flee together), rises with each chase and fades over weeks.
export const LEARNERS = {
  human: { memoryLooks: 10, seasonRate: 0.2, recoveryLooks: 20 },
  herd: { get alarmRate() { return R('wariAlarm'); }, get forgetDays() { return R('wariForgetDays'); } },
};

// The delta rule. `byCount` uses a share 1/n (an average over the last n), written as a division so that results
// stay bit-for-bit what they were before the refactor.
export const delta = (old, seen, rate) => old + (seen - old) * rate;
export const deltaByCount = (old, seen, n) => old + (seen - old) / n;
// The same rule on a log scale with a growing weight (for times, which are learned as orders of magnitude):
// returns the new value and weight.
export function deltaLog(old, weight, seen, cap) { const w = Math.min(cap, weight + 1); return { value: Math.exp((Math.log(old) * weight + Math.log(seen)) / w), weight: w }; }

// ---------- herds: wariness ----------
// w in [0, 1] per species and place: each chase is a surprise of 1 (danger where none was expected) and moves w by
// alarmRate of it; each day without one, w moves toward 0 by 1/forgetDays (habituation). Wariness lengthens the
// distance at which animals flee, by (1 + w).
export function herdAlarm(s, species, cell) { const W = wariOf(s, species); W[cell] = delta(W[cell], 1, LEARNERS.herd.alarmRate); }
export function herdDay(s) { if (!s.wariness) return; const f = 1 / LEARNERS.herd.forgetDays; for (const id in s.wariness) { const W = s.wariness[id]; for (let c = 0; c < W.length; c++) if (W[c] > 0) W[c] = W[c] < 1e-4 ? 0 : delta(W[c], 0, f); } }
export const wariness = (s, species, cell) => s.wariness?.[species]?.[cell] ?? 0;
function wariOf(s, species) { s.wariness ??= {}; return s.wariness[species] ??= new Float64Array(s.animals[species].length); }
