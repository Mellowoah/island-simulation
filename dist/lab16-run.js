// Island Lab 16-bit: runs a world from the setup screen and records graph samples.
// The driver only calls the sims' own step functions and the existing player command ('food').
// It never edits creatures or rules. Chunked stepping gives the same history as one long step.
import { DAY, land, command } from './sim.js';
import { createEden, edenStep } from './eden.js';
import { createLab, labStep, labMetrics, serializeLab, deserializeLab } from './lab.js';
import { normalizeSetup, HELP, driveConfig } from './lab16-setup.js';
import { EDEN_DEFAULTS } from './eden.js';
import { DEFAULTS as SIM_DEFAULTS } from './sim.js';

export const SAMPLE_EVERY = 60;
export const THEORY_SAVE_KEY = 'island-lab-theory-v1';
export const THEORY_FORMAT = 'island-lab-theory';
export const LAB_SAVE_KEY = 'island-lab-save-v1'; // unchanged; old saves keep working

const sd = xs => { if (xs.length < 2) return 0; const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((n, x) => n + (x - m) ** 2, 0) / xs.length); };

// A fixed spot of dry land near where Eden's creatures begin, not on food, water or the tree.
export function helpSpot(s) {
  const taken = (x, y) => s.patches.some(p => p.x === x && p.y === y && !p.gift) || s.eden.springs.some(w => w.x === x && w.y === y) || (s.eden.tree.x === x && s.eden.tree.y === y);
  for (const [x, y] of [[9, 13], [10, 13], [9, 12], [8, 13], [10, 12], [11, 12], [8, 12]]) if (land(x, y, false) && !taken(x, y)) return { x, y };
  throw Error('No land for help');
}

// Spread of each creature's own habits (judged likes and dislikes), 0–100. Habits only form after release.
export function habitSpread(s) {
  const alive = s.creatures.filter(c => c.alive), cap = s.eden.config.biasCap;
  const keys = Object.keys(alive[0]?.eden.bias ?? {});
  if (!keys.length || alive.length < 2) return 0;
  return keys.reduce((n, k) => n + sd(alive.map(c => c.eden.bias[k])), 0) / keys.length / cap * 100;
}
export const curiositySpread = s => sd(s.creatures.filter(c => c.alive).map(c => c.eden.curiosity)) * 100;
export const hearingsTotal = s => s.creatures.reduce((n, c) => n + c.eden.hearings, 0);
export const giftEaten = s => s.ledger.gifted - s.patches.filter(p => p.gift).reduce((n, p) => n + p.stock, 0) - (s.ledger.withdrawn ?? 0);

// The moving bar (measure only). A creature's hardship is the average of its unmet needs, 0 to 100.
// Its bar is its own running average of that hardship over about `barWindow` days. Nothing here feeds back into the sim.
export const BAR_MARGIN = 5;
export const hardshipEden = c => (c.hunger + c.eden.thirst + (100 - c.energy) + (100 - c.eden.health)) / 4;
export const hardshipLab = c => (c.needs.hunger + (100 - c.needs.energy) + (100 - c.needs.safety) + (100 - c.needs.social)) / 4;
export function barSample(run) {
  const s = run.world, f = run.kind === 'lab' ? hardshipLab : hardshipEden, alive = s.creatures.filter(c => c.alive);
  const a = Math.min(1, SAMPLE_EVERY / (run.setup.barWindow * DAY));
  run.bar ??= {};
  let hard = 0, bar = 0, over = 0;
  for (const c of alive) {
    const h = f(c), b0 = run.bar[c.id] ?? h;
    if (h > b0 + BAR_MARGIN) over++;
    hard += h; bar += b0;
    run.bar[c.id] = b0 + (h - b0) * a; // the bar moves toward what the creature is living through
  }
  const n = alive.length;
  return n ? { hard: hard / n, bar: bar / n, over: over / n * 100 } : { hard: null, bar: null, over: null };
}

function edenSample(run) {
  const s = run.world, E = s.eden, alive = s.creatures.filter(c => c.alive);
  const cohort = run.cohort ? run.cohort.filter(id => s.creatures[id].alive).length / run.cohort.length * 100 : null;
  return { t: s.tick, phase: E.phase, pop: alive.length, births: E.births, deaths: s.creatures.length - alive.length,
    belief: alive.length ? alive.reduce((n, c) => n + c.eden.credence, 0) / alive.length * 100 : 0,
    food: s.patches.reduce((n, p) => n + p.stock, 0), hearings: hearingsTotal(s), ate: E.firstEater === null ? 0 : 1,
    cohort, habit: habitSpread(s), curiosity: curiositySpread(s), ...barSample(run),
    restored: E.phase === 'released' && E.config.restoration && alive.length ? alive.filter(c => c.eden.covered).length / alive.length * 100 : null };
}
function labSample(m) { return { t: m.tick, pop: m.alive, deaths: m.deaths, trust: m.trustMean, food: m.food, sent: m.messages.sent, falseSent: m.messages.falseSent, accepted: m.messages.accepted, spread: m.trustSpread }; }

export function createRun(input = {}) {
  const setup = normalizeSetup(input);
  const endTick = setup.runDays * DAY;
  if (setup.world === 'lab') {
    const world = createLab(setup.seed, { population: setup.population, falseInformationRate: setup.falseInfo, foodQuantity: setup.food, foodRegrowth: setup.regrowth, communication: setup.talk });
    const run = { kind: 'lab', setup, world, endTick, done: false, bar: {}, barSeries: [] };
    run.barSeries.push({ t: world.tick, ...barSample(run) });
    return run;
  }
  const drives = driveConfig(setup, EDEN_DEFAULTS, SIM_DEFAULTS);
  const world = createEden(setup.seed, drives.sim, { ...drives.eden, serpentSilentYears: setup.guidanceYears, guidanceRate: setup.guidance, restoration: setup.restoration, tempters: setup.tempters, fallAgain: setup.fallAgain, traitDevelopment: setup.traitDev });
  const run = { kind: 'eden', setup, world, endTick, done: false, helpUntil: setup.help ? Math.floor(endTick / 2) : 0, halfTick: Math.floor(endTick / 2),
    help: setup.help ? helpSpot(world) : null, cohort: null, half: null, series: [] };
  run.series.push(edenSample(run));
  return run;
}

// Lab graphs come from the Lab's own samples (every 60 minutes), so a restored save keeps its history.
export const seriesOf = run => {
  if (run.kind !== 'lab') return run.series;
  const bars = new Map((run.barSeries ?? []).map(b => [b.t, b]));
  return run.world.samples.map(m => ({ ...labSample(m), ...(bars.get(m.tick) ?? { hard: null, bar: null, over: null }) }));
};

export function stepRun(run, n = 1) {
  const s = run.world;
  for (let i = 0; i < n; i++) {
    if (s.tick >= run.endTick) { run.done = true; break; }
    if (run.kind === 'lab') { labStep(s, 1); if (s.tick % SAMPLE_EVERY === 0) (run.barSeries ??= []).push({ t: s.tick, ...barSample(run) }); continue; }
    if (run.help && s.tick < run.helpUntil && s.tick % HELP.every === 0) command(s, { type: 'food', x: run.help.x, y: run.help.y, amount: HELP.amount });
    edenStep(s, 1);
    if (!run.cohort && s.eden.fallTick !== null) run.cohort = s.creatures.filter(c => c.alive).map(c => c.id);
    if (s.tick === run.halfTick) run.half = { tick: s.tick, consumed: s.ledger.consumed, giftEaten: giftEaten(s) };
    if (s.tick % SAMPLE_EVERY === 0) run.series.push(edenSample(run));
  }
  if (s.tick >= run.endTick) run.done = true;
  return run;
}

export function runToEnd(input, endTick = null, onProgress = null) {
  const run = createRun(input), stop = endTick ?? run.endTick;
  run.endTick = Math.min(run.endTick, stop);
  while (!run.done) { stepRun(run, 1440); if (onProgress) onProgress(run.world.tick / run.endTick); }
  return run;
}

// ---- Saves. Eden theory runs use their own key; the Lab island keeps island-lab-save-v1 and its format. ----
export function serializeRun(run, ui = {}) {
  if (run.kind === 'lab') return serializeLab(run.world, { seed: run.setup.seed, selected: ui.selected ?? 0, paused: !!ui.paused, speed: [1, 4, 16].includes(ui.speed) ? ui.speed : 1, runDays: run.setup.runDays });
  const { world, ...rest } = run;
  return JSON.stringify({ format: THEORY_FORMAT, version: 1, run: rest, world, ui });
}
export function restoreLabRun(text) {
  const { world, ui } = deserializeLab(text); // throws on bad or old-format saves, exactly as before
  let runDays = 15; try { const r = JSON.parse(text).ui?.runDays; if (Number.isInteger(r) && r >= 2 && r <= 30) runDays = r; } catch {}
  runDays = Math.max(runDays, Math.floor(world.tick / DAY) + 1);
  const setup = normalizeSetup({ world: 'lab', seed: world.seed, population: world.creatures.length, falseInfo: world.config.falseInformationRate, food: world.config.foodQuantity, regrowth: world.config.foodRegrowth, talk: world.config.communication, speed: ui.speed, runDays: Math.min(30, runDays) });
  setup.population = world.creatures.length; setup.runDays = runDays; // keep the saved world's own values even outside the menu's range
  return { run: { kind: 'lab', setup, world, endTick: runDays * DAY, done: world.tick >= runDays * DAY, bar: {}, barSeries: [] }, ui };
}
export function restoreTheoryRun(text) {
  if (typeof text !== 'string' || text.length > 8000000) throw Error('Invalid save');
  const e = JSON.parse(text);
  if (e?.format !== THEORY_FORMAT || e.version !== 1 || e.world?.mode !== 'eden' || !Array.isArray(e.run?.series)) throw Error('Incompatible save');
  return { run: { ...e.run, world: e.world, setup: normalizeSetup(e.run.setup) }, ui: e.ui ?? {} };
}
