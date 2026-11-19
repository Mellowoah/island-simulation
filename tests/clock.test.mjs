// The real clock: one tick is an hour in every world, rates come from one register, rates that build something up
// are matched with the rates that wear it down, and energy follows one law for every body (clock.js, energy.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { makeClock, clockOf, hourOf, isNight, sleepTime, ticksUntilWake, dateOf, bodyRates, RATES, PAIRS, growPatch, decayFor, eatKcal, burnKcal, storedKcal, LEGACY_EDEN, LEGACY_ISLAND } from '../dist/frozen/clock.js';
import * as EN from '../dist/frozen/energy.js';
import { createEden, edenStep } from '../dist/frozen/eden.js';
import { practise, forget } from '../dist/frozen/body.js';

const C = { ...makeClock(60), real: true };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);

test('K1 one clock: an hour a tick, 24 a day, 365 days a year, tick 0 is 06:00 on 1 November', () => {
  assert.equal(C.day, 24); assert.equal(C.year, 8760); assert.equal(hourOf(C, 0), 6);
  assert.equal(dateOf(C, 0).label, 'Year 1, Nov, 06:00');
  assert.equal(isNight(C, 0), true); assert.equal(isNight(C, 6), false); assert.equal(isNight(C, 13), true);
  assert.equal(sleepTime(C, 16), true); assert.equal(ticksUntilWake(C, 16), 8); // 22:00 -> 06:00
  // the old clocks are kept for old results: the island ticked once a minute, Eden once every 6.08 hours
  assert.equal(LEGACY_ISLAND.day, 1440); assert.equal(LEGACY_EDEN.year, 1440); assert.equal(LEGACY_EDEN.month, 120);
});

test('K2 every rate in the register has a value inside its range and a source', () => {
  for (const [k, r] of Object.entries(RATES)) {
    assert.ok(r.low <= r.value && r.value <= r.high, `${k} inside its range`);
    assert.ok(typeof r.src === 'string' && r.src.length > 10, `${k} has a source`);
  }
  assert.equal(PAIRS.length, 8);
});

test('K3 PAIR sleep: a normal day of sleep and walking nets to zero tiredness', () => {
  const B = bodyRates(C), S = RATES.sleepHoursAdult.value;
  const gained = B.restGainTick * S, lost = B.wakeDrainTick(S) * (24 - S) + B.walkFatigueTile * RATES.dayKm.value / B.tileKm;
  near(gained, lost, 1e-9, 'gain vs loss');
});

test('K4 the law of energy matches FAO/WHO/UNU requirements within 15% at every age (no tuning)', () => {
  for (const r of EN.FAO_CHECK) {
    const m = EN.modelDay(r.age, r.sex, r.mass), err = m / r.kcal - 1;
    assert.ok(Math.abs(err) <= 0.15, `age ${r.age} ${r.sex}: model ${m.toFixed(0)} vs FAO ${r.kcal} (${(err * 100).toFixed(0)}%)`);
  }
  // Hadza adults by doubly labelled water (women ~1,880, men ~2,650 kcal/day)
  near(EN.modelDay(30, 'F'), 1880, 0.12 * 1880, 'Hadza woman'); near(EN.modelDay(30, 'M'), 2650, 0.12 * 2650, 'Hadza man');
  // Kleiber is reported, not used: it reads children low
  assert.ok(EN.kleiber(EN.massOf(5, 'F')) < 0.8 * EN.bmr(5, 'F'));
});

test('K5 walking costs by mass moved: a mother carrying her baby pays for its weight; small bodies pay more per kg', () => {
  const m = EN.massOf(25, 'F'), baby = EN.massOf(1, 'F');
  near(EN.walkKcalKm(m, baby) / EN.walkKcalKm(m), (m + baby) / m, 1e-9, 'load share');
  assert.ok(EN.cotPerKg(EN.massOf(6, 'M')) > EN.cotPerKg(EN.massOf(30, 'M')));
  assert.ok(EN.speedKmH(EN.massOf(6, 'M')) < EN.speedKmH(EN.massOf(30, 'M')));
  // a baby's own energy is mostly milk, and growth is a third of it in the first months
  assert.equal(EN.milkShare(0.3), 1); assert.equal(EN.milkShare(3), 0); near(EN.growthShare(0.1), 0.35, 1e-9, 'growth');
});

// A body left without food (or water), resting: how long until the store runs out.
import * as BODY from '../dist/frozen/body.js';
test('K6 PAIR food: without food a woman lasts 30-70 days and a lean man less; without water an adult lasts 2-5 days, a baby less', () => {
  const mk = (age, sex, what) => fastDaysOn(createEden(41, {}, { clock: 'real', god: false }), age, sex, what);
  const woman = mk(30, 'F', 'food'), man = mk(30, 'M', 'food');
  assert.ok(woman >= 30 && woman <= 70, `woman ${woman.toFixed(1)} days`);
  assert.ok(man < woman, `man ${man.toFixed(1)} < woman ${woman.toFixed(1)}`);
  assert.ok(man >= 20, `man ${man.toFixed(1)} days`);
  const adultDry = mk(30, 'F', 'water'), babyDry = mk(1, 'F', 'water');
  assert.ok(adultDry >= 2 && adultDry <= 5, `adult without water ${adultDry.toFixed(1)} days`);
  assert.ok(babyDry < adultDry, `baby ${babyDry.toFixed(1)} < adult ${adultDry.toFixed(1)}`);
});
function fastDaysOn(s, age, sex, what) {
  const c = s.creatures[0]; c.eden.sex = sex; c.eden.born = s.tick - age * 8760; c.body = null; c.reserve = undefined; c.eden.deficit = undefined; c.eden.mother = null;
  BODY.setBody(s, c); c.reserve = c.body.fatMax; c.hunger = 0;
  for (let h = 1; h < 24 * 200; h++) {
    s.tick++; BODY.liveTick(s, c, null, true);
    if (what === 'water') { c.hunger = 0; if (BODY.dehydrated(c)) return h / 24; }
    else { BODY.drink(c); if (c.hunger >= 100 && c.reserve <= 0) return h / 24; }
  }
  return Infinity;
}

test('K7 PAIR growth/decay: a patch left alone settles where growth equals decay', () => {
  const p = { stock: 0, capacity: 100, decay: decayFor(2, 100) };
  for (let i = 0; i < 5000; i++) growPatch(p, 2);
  near(p.stock, 100, 0.01, 'settles at growth/decay');
  const q = { stock: 100, capacity: 100, decay: decayFor(2, 100) };
  for (let i = 0; i < 5000; i++) growPatch(q, 1); // half the growth (a cursed ground): half the level
  near(q.stock, 50, 0.01, 'half growth, half level');
});

test('K8 PAIR skill: practice follows a power law, disuse a forgetting curve, and practice resumes from what was kept', () => {
  const s = createEden(41, {}, { clock: 'real' }), c = s.creatures[0], B = bodyRates(clockOf(s));
  practise(s, c, 'a', 100); const s100 = c.skills.a;
  practise(s, c, 'a', 300); const s400 = c.skills.a;
  near(s100, 1 - 2 ** -B.practiceExp, 1e-9, '100 h'); assert.ok(s400 - s100 < s100, 'diminishing returns');
  s.tick += 5 * 8760; forget(s, c);
  const kept = c.skills.a / s400;
  assert.ok(kept > 0.55 && kept < 0.8, `after 5 unused years ${(kept * 100).toFixed(0)}% kept`);
  const before = c.skills.a; practise(s, c, 'a', 1); assert.ok(c.skills.a < s400 && c.skills.a > before, 'resumes from what was kept');
});

test('K9 conservation of energy: every kcal eaten is burned, stored, or lost as heat or unabsorbed', () => {
  const s = createEden(5, {}, { clock: 'real', god: false, lifeCourse: true });
  const start = s.creatures.reduce((n, c) => n + storedKcal(s, c), 0);
  edenStep(s, 24 * 120);
  const L = s.energyLedger, end = s.creatures.reduce((n, c) => n + storedKcal(s, c), 0);
  // babies born during the run arrive with their own small store (from their mothers' pregnancy cost, booked as burned)
  const born = s.creatures.filter(c => c.eden.born > 0);
  const bornStores = born.reduce((n, c) => n + c.body.fatMax * 0.8 + (100 - 20) / c.body.hpk, 0);
  const err = (L.eaten - L.burned - L.heat - L.unabsorbed) - (end - start - bornStores);
  assert.ok(L.eaten > 1e6, 'people ate');
  assert.ok(Math.abs(err) < 0.002 * L.eaten, `unbooked kcal ${err.toFixed(0)} of ${L.eaten.toFixed(0)}`);
});

test('K10 food in the world is conserved: start + grown + gifted = eaten + rotted + left', () => {
  const s = createEden(7, {}, { clock: 'real', god: false });
  edenStep(s, 24 * 90);
  const L = s.ledger, left = s.patches.reduce((n, p) => n + p.stock, 0);
  near(L.initial + L.regenerated + L.gifted, L.consumed + (L.decayed ?? 0) + (L.withdrawn ?? 0) + left, 1e-6 * (L.initial + L.regenerated), 'food ledger');
});

test('K11 time step: halving or doubling the tick gives about the same lives (30 vs 60 vs 120 minutes)', () => {
  const run = min => {
    const s = createEden(11, {}, { clock: 'real', clockMinutes: min, god: false, lifeCourse: true });
    const Y = clockOf(s); edenStep(s, Math.round(Y.day * 120));
    const alive = s.creatures.filter(c => c.alive), adults = alive.filter(c => c.body.age >= 18);
    return { eatenPerDay: s.energyLedger.eaten / s.creatures.length / 120, fat: adults.reduce((n, c) => n + c.reserve / c.body.fatMax, 0) / adults.length,
      pop: s.creatures.length, burned: s.energyLedger.burned / s.creatures.length / 120 };
  };
  const a = run(30), b = run(60), c = run(120);
  if (process.env.SHOW) console.log(a, b, c);
  for (const [x, name] of [[a, '30'], [c, '120']]) {
    near(x.eatenPerDay, b.eatenPerDay, 0.15 * b.eatenPerDay, `${name}-minute tick: kcal eaten per person-day`);
    near(x.fat, b.fat, 0.15, `${name}-minute tick: adult fat level`);
  }
});

test('K12 the real clock leaves legacy worlds alone, and appetite changes how soon hunger is felt, not the energy used', () => {
  const legacy = createEden(41, {}, { clock: 'legacy' });
  assert.equal(legacy.clock, undefined); assert.equal(clockOf(legacy).year, 1440);
  const a = createEden(41, {}, { clock: 'real' }), b = createEden(41, { hungerRate: 0.1 }, { clock: 'real' });
  assert.equal(b.creatures[0].body.baseTick, a.creatures[0].body.baseTick);
  near(b.creatures[0].body.hpk, 2 * a.creatures[0].body.hpk, 1e-12, 'meter twice as quick');
});

// A check against the real world that the model does NOT pass yet. Kept visible as a to-do, not hidden.
test('K13 day range: adults walk about as far as Hadza foragers (women ~6, men ~11 km a day)', { todo: 'fails in Eden on the real clock: about 20 km a day, because Eden still uses the old island decision rules. The small world (world.js) has camps, full loads and sharing, and passes a settled-day check (tests/world.test.mjs Y4).' }, () => {
  const s = createEden(41, {}, { clock: 'real', god: false });
  edenStep(s, 24 * 60);
  const ad = s.creatures.filter(c => c.alive && c.body.age >= 18), km = ad.reduce((n, c) => n + (c.tiles ?? 0), 0) / ad.length / 60 * 0.35;
  assert.ok(km >= 5 && km <= 12, `${km.toFixed(1)} km a day`);
});
