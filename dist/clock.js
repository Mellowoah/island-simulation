// Island: one clock for every world, and one table of rates in real units.
//
// Robert, 17 Nov: "Everything should get a consistent internal synced clock." and "Make sure decay matches
// appropriately that in growth and advancement or anything else that is conditioned upon one another."
//
// 1. The clock. On the real clock one tick is one hour (REAL_MINUTES) in every world: the island, Eden, the savanna
//    and the Lab. A day is 24 ticks, a year 365 days, and tick 0 is 06:00 on 1 November, the start of the rains.
//    Day and night follow the equator (sunrise about 06:30, sunset about 18:30).
//    A world made before the real clock has no `s.clock`. It keeps its old tick so old results can be reproduced:
//    the original island ticked once a minute (1440 a day), and Eden once every 6.08 hours (1440 a year).
//
// 2. The rates. Every rate is written once, below, in real units, with its source and a plausible low and high
//    for sensitivity sweeps. The per-tick numbers the worlds use are worked out from this table, never typed in.
//
// 3. The pairs. A rate that builds something up is set together with the rate that wears it down, so that they
//    balance where they should (PAIRS, below; each one is checked in tests/clock.test.mjs):
//      sleep and waking        a normal day nets to zero tiredness
//      eating and starving     the body's store fills from food beyond need and drains, at the same rate, without it
//      drinking and thirst     water is lost with the energy burned (ml per kcal); a drink makes it up
//      growth and decay        an unharvested patch settles where growth equals decay (no arbitrary cap)
//      healing and harm        an injury heals in about a week; deprivation harms faster than rest heals
//      learning and forgetting skill rises with practice (power law) and fades without it (forgetting curve)
//      judging and fading      what a creature learned to like or avoid fades unless it keeps being borne out
//      nurture and nature      traits move with others and with what happens, and are pulled back to what was inborn

export const REAL_MINUTES = 60;
export const START_HOUR = 6; // tick 0 is 06:00
export const DAYS_PER_YEAR = 365;
export const SUNRISE = 6.5,
  SUNSET = 18.5;

export function makeClock(min) {
  const day = 1440 / min,
    year = day * DAYS_PER_YEAR;
  return { min, hours: min / 60, perHour: 60 / min, day, year, month: year / 12, real: false };
}
const REAL = { ...makeClock(REAL_MINUTES), real: true };
export const LEGACY_ISLAND = makeClock(1); // day = 1440 ticks
export const LEGACY_EDEN = makeClock(365); // year = 1440 ticks
const clocks = new Map([[REAL_MINUTES, REAL]]);
// The clock a world runs on. `s.clock = { min }` is the real clock (min may be changed only for the time-step test).
export function clockOf(s) {
  if (!s.clock) return s.eden || s.mode === 'eden' ? LEGACY_EDEN : LEGACY_ISLAND;
  let C = clocks.get(s.clock.min);
  if (!C) {
    C = { ...makeClock(s.clock.min), real: true };
    clocks.set(s.clock.min, C);
  }
  return C;
}
export const isReal = s => !!s.clock;
// Which clock new worlds get. Tests of old behaviour set 'legacy' at the top of their file.
let DEFAULT_CLOCK = 'real';
export const setDefaultClock = v => {
  DEFAULT_CLOCK = v;
};
export const defaultClock = () => DEFAULT_CLOCK;

// ---------- Calendar (meaningful on the real clock) ----------
export const hourOf = (C, tick) => (((START_HOUR + tick * C.hours) % 24) + 24) % 24;
export const dayOf = (C, tick) => Math.floor((tick * C.hours + START_HOUR) / 24);
export const yearOf = (C, tick) => Math.floor(tick / C.year);
export const yearFrac = (C, tick) => (((tick % C.year) + C.year) % C.year) / C.year;
export const isNight = (C, tick) => {
  const h = hourOf(C, tick);
  return h < SUNRISE || h >= SUNSET;
};
// Darkness (isDark) lives with the sun now (sun.js, Layer 0): the base layer may not read a higher one.

// Foragers fall asleep about 3.3 hours after sunset and wake before sunrise (Yetish et al. 2015).
export const SLEEP_FROM = SUNSET + 3.3,
  SLEEP_UNTIL = 6;
export const sleepTime = (C, tick) => {
  const h = hourOf(C, tick);
  return h >= SLEEP_FROM || h < SLEEP_UNTIL;
};
// Ticks from now until the next 06:00.
export const ticksUntilWake = (C, tick) => {
  const h = hourOf(C, tick);
  const left = (SLEEP_UNTIL - h + 24) % 24;
  return Math.max(1, Math.round(left * C.perHour));
};
const MONTHS = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export function dateOf(C, tick) {
  const y = yearOf(C, tick),
    m = Math.floor(yearFrac(C, tick) * 12),
    h = hourOf(C, tick);
  return {
    year: y + 1,
    month: MONTHS[m],
    hour: h,
    label: `Year ${y + 1}, ${MONTHS[m]}, ${String(Math.floor(h)).padStart(2, '0')}:00`,
  };
}

// ---------- The rate register ----------
// value: what the sim uses. low/high: plausible range for sweeps. src: where it comes from ("assumption" when no
// study pins it; those are the first to sweep). Everything is for an adult unless it says otherwise.
export const RATES = {
  kcalDay: {
    value: 2250,
    low: 1880,
    high: 2650,
    unit: 'kcal/day',
    src: "Pontzer et al. 2012, Hadza total energy expenditure by doubly labelled water (women ~1,880, men ~2,650). Sizes the land's food; each body's own need comes from energy.js",
  },
  unitKcal: { value: 500, low: 500, high: 500, unit: 'kcal', src: 'definition: one food unit is about one meal' },
  hungerFullDays: {
    value: 2,
    low: 1,
    high: 3,
    unit: 'days',
    src: 'assumption: felt hunger goes from fed to its worst in about 2 days without food',
  },
  dayKm: {
    value: 9,
    low: 6,
    high: 12,
    unit: 'km/day',
    src: 'Hadza GPS: men ~11, women ~6 km a day (Pontzer et al. 2012; Wood et al. 2021)',
  },
  nightPace: {
    value: 0.5,
    low: 0.3,
    high: 0.8,
    unit: 'x day pace',
    src: 'assumption: walking in the dark (no moon) is slower',
  },
  moonNightPace: {
    value: 0.8,
    low: 0.6,
    high: 0.95,
    unit: 'x day pace',
    src: 'assumption: walking under a full moon (about 0.2 lux, enough for night vision) is nearly day pace; the world uses nightPace + (this - nightPace) x moonlight (weather.js)',
  },
  nightSight: {
    value: 0.35,
    low: 0.2,
    high: 0.6,
    unit: 'x day sight',
    src: 'assumption: moonlight and firelight only',
  },
  starveDays: {
    value: 40,
    low: 30,
    high: 70,
    unit: 'days',
    src: "survival without food 30-70 days, depending on body fat (rule-of-three summaries). A check: each body's store comes from its fat (energy.js)",
  },
  cultivateHours: {
    value: 150,
    low: 60,
    high: 400,
    unit: 'work hours',
    src: 'assumption: clearing and planting a small plot by hand',
  },
  craftHours: {
    value: 60,
    low: 20,
    high: 150,
    unit: 'work hours',
    src: 'assumption: a hide garment or a digging tool with stone tools',
  },
  gardenKcalHour: {
    value: 2000,
    low: 1000,
    high: 3500,
    unit: 'kcal/hour',
    src: 'assumption: picking from a rich grove, like baobab or berry returns (savanna.js)',
  },
  maxCarryUnits: {
    value: 8,
    low: 4,
    high: 12,
    unit: 'food units',
    src: 'assumption: about 4,000 kcal carried home in a day; Hadza women bring back a few thousand kcal',
  },
  fatStoreEff: {
    value: 0.8,
    low: 0.7,
    high: 0.9,
    unit: 'share',
    src: 'about 75-85% of surplus food energy ends up stored as fat (assumption, textbook range)',
  },
  waterMlPerKcal: {
    value: 1.2,
    low: 1.0,
    high: 1.5,
    unit: 'ml/kcal',
    src: 'water turnover follows energy turnover, about 1 ml per kcal (a long-used rule for water needs), more in heat (assumption 1.2 on the savanna)',
  },
  thirstAtShare: {
    value: 0.04,
    low: 0.02,
    high: 0.05,
    unit: 'share of body mass',
    src: 'thirst and impairment are strong at 2-4% of body mass lost as water',
  },
  dehydrationDeathShare: {
    value: 0.15,
    low: 0.1,
    high: 0.2,
    unit: 'share of body mass',
    src: 'water losses of about 15% of body mass are usually fatal (10-20%). A check: an adult then lasts about 3 days without water (3-5 is the usual figure); a baby far less',
  },
  sleepHoursAdult: {
    value: 6.4,
    low: 5.7,
    high: 7.1,
    unit: 'hours',
    src: 'Hadza, San and Tsimane sleep 6.4 h a day, range 5.7-7.1 (Yetish et al. 2015)',
  },
  fatigueDay: {
    value: 50,
    low: 35,
    high: 70,
    unit: 'energy points/day',
    src: 'scale choice: a day awake uses half the energy scale, so two days without sleep empties it',
  },
  walkFatigueKm: {
    value: 1.2,
    low: 0.6,
    high: 2,
    unit: 'energy points/km',
    src: "assumption: a 9 km day is about a fifth of a day's tiredness",
  },
  injuryPerKm: {
    value: 1 / 1000,
    low: 1 / 3000,
    high: 1 / 300,
    unit: 'falls/km',
    src: 'assumption: a few injuries a year at Hadza walking distances; accidents are a quarter of Tsimane deaths (Gurven 2007)',
  },
  injuryDamage: { value: 15, low: 5, high: 30, unit: 'health points', src: 'kept from the original model' },
  nightInjury: {
    value: 3,
    low: 1.5,
    high: 5,
    unit: 'x day risk',
    src: 'assumption: falls are more likely in the dark (no moon)',
  },
  moonNightInjury: {
    value: 1.5,
    low: 1,
    high: 3,
    unit: 'x day risk',
    src: 'assumption: under a full moon falls are less likely than in the dark',
  },
  healDays: {
    value: 7,
    low: 3,
    high: 21,
    unit: 'days',
    src: 'assumption: a minor injury (15 points) heals in about a week of ordinary life',
  },
  restHealShare: { value: 0.5, low: 0.3, high: 0.7, unit: 'share', src: 'assumption: half of healing happens asleep' },
  deprivationHarmDays: {
    value: 30,
    low: 15,
    high: 60,
    unit: 'days',
    src: 'assumption: deprivation-related illness alone takes health from full to zero in about a month',
  },
  practiceHours: {
    value: 100,
    low: 30,
    high: 300,
    unit: 'hours',
    src: 'power law of practice (Newell and Rosenbloom 1981): skill = 1 - (1 + hours / this)^-practiceExp. Value is an assumption',
  },
  practiceExp: {
    value: 0.5,
    low: 0.2,
    high: 0.8,
    unit: 'exponent',
    src: 'power law of practice; exponents of about 0.2-0.6 are typical across skills',
  },
  forgetDays: {
    value: 30,
    low: 7,
    high: 90,
    unit: 'days',
    src: 'forgetting curve (Ebbinghaus; power-law forgetting, Wixted and Ebbesen 1991): kept = (1 + days unused / this)^-forgetExp. Value is an assumption',
  },
  forgetExp: {
    value: 0.1,
    low: 0.05,
    high: 0.3,
    unit: 'exponent',
    src: 'assumption: motor and foraging skills are well kept (after 5 unused years about two thirds remains)',
  },
  habitHalfLife: {
    value: 1,
    low: 0.25,
    high: 3,
    unit: 'years',
    src: 'assumption: a learned like or dislike that is no longer borne out halves in about a year',
  },
  gardenHalfLifeRule: {
    value: 1,
    low: 1,
    high: 1,
    unit: 'rule',
    src: 'Eden and island patches keep their original capacity as the point where growth equals decay',
  },
  // ---- the small world (world.js, nature.js): build plan change 2. Every assumed number in a rule lives here. ----
  dayKmMax: {
    value: 35,
    low: 30,
    high: 45,
    unit: 'km/day',
    src: 'assumption: no new trip past this in a day; Hadza day ranges average 6-11 km and rarely pass 30 (Pontzer et al. 2012; Wood et al. 2021)',
  },
  survivalFat: {
    value: 0.4,
    low: 0.2,
    high: 0.6,
    unit: 'share of most fat',
    src: 'assumption: below this the drive to stay alive begins to override other motives',
  },
  wDrive: {
    value: 2,
    low: 1,
    high: 4,
    unit: 'utility',
    src: 'motive weight (assumption): survival, added to food options at full drive',
  },
  wRestDrive: {
    value: 1.5,
    low: 0.5,
    high: 3,
    unit: 'utility',
    src: 'motive weight (assumption): how far hunger overrides tiredness',
  },
  wAmbition: {
    value: 0.3,
    low: 0,
    high: 0.6,
    unit: 'utility',
    src: 'motive weight (assumption): success, the standing from meat shared (Hawkes show-off hypothesis)',
  },
  wCaution: {
    value: 0.2,
    low: 0,
    high: 0.5,
    unit: 'utility',
    src: 'motive weight (assumption): the risk of the chase',
  },
  forageBase: {
    value: 0.12,
    low: 0,
    high: 0.3,
    unit: 'urgency',
    src: 'assumption: foragers go out most days even when not short',
  },
  tinkerBase: {
    value: 0.15,
    low: 0,
    high: 0.3,
    unit: 'utility',
    src: 'motive weight (assumption): pleasure in trying things',
  },
  tinkerCurious: {
    value: 0.5,
    low: 0.2,
    high: 0.8,
    unit: 'utility',
    src: 'motive weight (assumption): how much curiosity adds to trying things',
  },
  give0: { value: 0.15, low: 0, high: 0.3, unit: 'chance', src: 'assumption: base chance a family gives when asked' },
  giveKin: {
    value: 0.6,
    low: 0.3,
    high: 0.9,
    unit: 'per r',
    src: 'assumption: kin are given to more (Hamilton); weight per unit of relatedness',
  },
  giveCare: { value: 0.3, low: 0, high: 0.5, unit: 'per care', src: 'assumption: caring givers give more' },
  giveRecip: {
    value: 0.3,
    low: 0,
    high: 0.5,
    unit: 'per share',
    src: 'assumption: families that gave before are given to (reciprocity; Kaplan and Hill 1985)',
  },
  giveHunger: { value: 0.5, low: 0.2, high: 0.8, unit: 'per hunger', src: 'assumption: hungry givers give less' },
  giveStarving: {
    value: 0.5,
    low: 0.2,
    high: 0.8,
    unit: 'per drive',
    src: 'assumption: a visibly starving asker is rarely refused',
  },
  huntPriorKcal: {
    value: 300,
    low: 0,
    high: 1000,
    unit: 'kcal',
    src: 'assumption: what the untried expect from hunting (with huntPriorHours: about 150 kcal an hour)',
  },
  huntPriorHours: {
    value: 2,
    low: 0.5,
    high: 10,
    unit: 'hours',
    src: 'assumption: how much the untried guess counts against experience',
  },
  stalkPace: {
    value: 0.3,
    low: 0.2,
    high: 0.5,
    unit: 'x walking pace',
    src: 'assumption: stalking is slow, about 1-1.5 km an hour',
  },
  huntHoursMax: { value: 6, low: 3, high: 8, unit: 'hours', src: 'assumption: a hunting bout' },
  meatLoadKg: { value: 25, low: 15, high: 35, unit: 'kg', src: 'assumption: a load of meat carried home' },
  carcassFound: {
    value: 0.05,
    low: 0.01,
    high: 0.2,
    unit: 'share',
    src: "assumption: share of medium and large natural deaths that leave meat a person can reach (check: ~20% of Hadza large carcasses scavenged, O'Connell et al. 1988)",
  },
  pickupBase: {
    value: 0.05,
    low: 0.01,
    high: 0.2,
    unit: 'chance/hour',
    src: 'assumption: picking up a stick or stone while walking (x 0.5-1.5 by curiosity)',
  },
  showChance: {
    value: 0.15,
    low: 0.05,
    high: 0.3,
    unit: 'chance/evening',
    src: 'assumption: someone shows a know-how to another at camp (plus 0.2 x skill)',
  },
  firstFlake: {
    value: 0.05,
    low: 0.01,
    high: 0.25,
    unit: 'chance',
    src: 'assumption: an unpractised strike on flint gives a usable flake',
  },
  firstChopper: {
    value: 0.03,
    low: 0.01,
    high: 0.1,
    unit: 'chance',
    src: 'assumption: two tough cobbles give a rough edge',
  },
  firstSpear: {
    value: 0.1,
    low: 0.03,
    high: 0.4,
    unit: 'chance',
    src: 'assumption: cutting a stick to a point with an edge',
  },
  firstEmber: {
    value: 0.005,
    low: 0.001,
    high: 0.04,
    unit: 'chance',
    src: 'assumption: a first fire-drill try gives an ember (experimental archaeology: most need many tries)',
  },
  fireBurnKgH: { value: 1, low: 0.5, high: 2, unit: 'kg/hour', src: 'assumption: a small cooking fire' },
  fireBanked: {
    value: 0.15,
    low: 0.05,
    high: 0.3,
    unit: 'x burn',
    src: 'assumption: a fire banked for the night smoulders',
  },
  fireTend: {
    value: 0.3,
    low: 0.1,
    high: 0.5,
    unit: 'chance/hour',
    src: 'assumption: someone at camp puts on wood (x 0.5-1.5 by care)',
  },
  fireRainOut: {
    value: 0.005,
    low: 0.001,
    high: 0.02,
    unit: 'chance/hour',
    src: 'assumption: rain puts out a camp fire in the wet season',
  },
  cookGain: {
    value: 0.15,
    low: 0.05,
    high: 0.3,
    unit: 'share',
    src: 'assumption: extra energy from cooked food; Carmody et al. 2011 give the direction for tubers and meat, not the size in humans',
  },
  soilMaxMm: {
    value: 150,
    low: 80,
    high: 250,
    unit: 'mm',
    src: 'assumption: water the root zone holds (Manabe 1969 bucket used 150 mm)',
  },
  wetPersistence: {
    value: 0.35,
    low: 0.1,
    high: 0.6,
    unit: 'correlation',
    src: 'assumption: a wet day makes the next more likely (two-state Markov rain, Richardson 1981); lag-1 correlation typical of tropical stations',
  },
  rainGammaShape: {
    value: 0.8,
    low: 0.5,
    high: 1.2,
    unit: 'shape',
    src: 'assumption: daily rain amounts are gamma-distributed with shape below 1 (Richardson 1981; Wilks)',
  },
  rainPerWetDay: {
    value: 6.5,
    low: 5,
    high: 9,
    unit: 'mm',
    src: 'assumption: mean rain on a wet day; with the month odds gives about 575 mm a year, in the range reported for the Eyasi basin (300-600 mm); to verify',
  },
  yearSwingWeight: {
    value: 0.6,
    low: 0.3,
    high: 1,
    unit: 'exponent',
    src: 'assumption: how much of the year-to-year swing (rainOf) reaches the daily rain, set so annual rain varies by about 25-35% (typical of semi-arid East Africa; to verify against station records)',
  },
  heatWaterPerC: {
    value: 0.03,
    low: 0.01,
    high: 0.06,
    unit: 'per C',
    src: 'assumption: water loss rises about 3% for each degree of the day high above 30 C',
  },
  activationEnergy: {
    value: 0.65,
    low: 0.5,
    high: 0.8,
    unit: 'eV',
    src: 'mean activation energy of biological rates, 0.6-0.7 eV (Gillooly et al. 2001, Science 293; Brown et al. 2004, Ecology 85), for microbial and ectotherm processes',
  },
  regrowHalf: {
    value: 0.5,
    low: 0.2,
    high: 0.8,
    unit: 'share of natural level',
    src: 'assumption: below this a picked-over patch regrows more slowly in proportion (overuse can deplete it)',
  },
  wariAlarm: {
    value: 0.3,
    low: 0.1,
    high: 0.6,
    unit: 'share of surprise',
    src: "assumption: how much one chase raises a herd's wariness; hunted ungulates flee from further away (Stankowich 2008 meta-analysis: flight distance rises with hunting pressure)",
  },
  wariForgetDays: {
    value: 21,
    low: 7,
    high: 90,
    unit: 'days',
    src: 'assumption: how fast wariness fades without chases (habituation)',
  },
  exploreHopeTiles: {
    value: 200,
    low: 50,
    high: 1000,
    unit: 'tiles per place',
    src: 'assumption: before much is seen, how much land a person guesses holds one food place (divided by 0.5 + curiosity: the curious are more hopeful); replaced by experience as they look',
  },
  exploreGuessRate: {
    value: 300,
    low: 100,
    high: 800,
    unit: 'kcal/h',
    src: 'assumption: what a food place is guessed to return when none is known yet',
  },
  voiHorizonHours: {
    value: 120,
    low: 40,
    high: 400,
    unit: 'hours',
    src: 'assumption: hours a newly found better place is used before the season changes (about a month of gathering)',
  },
  riskDeathJump: {
    value: 3,
    low: 1,
    high: 6,
    unit: 'log units',
    src: 'assumption: the drop in value at the point a household starts to starve (the survival cliff of the energy-budget rule, Stephens 1981)',
  },
  riskDeathSlope: {
    value: 3,
    low: 1,
    high: 10,
    unit: 'per day of need',
    src: 'assumption: how fast value falls with each further day of shortfall',
  },
  choiceTemperature: {
    value: 0.08,
    low: 0.06,
    high: 0.11,
    unit: 'utility (Gumbel scale)',
    dist: 'uniform',
    src: 'fitted 18 Nov 2026 by cross-entropy on the calibration patterns (tools/score.mjs, 4 islands x 5 years, paired seeds): 0.02 2.95, 0.05 2.47, 0.075 2.17, 0.1 2.23, 0.13 2.55, 0.2 3.83 nats; parabola minimum 0.083; range = within about 0.1 nat. The scale of the Gumbel noise in random-utility choice (McFadden 1974): softmax with this temperature',
  },
  aifEpistemicWeight: {
    value: 0.35,
    low: 0.2,
    high: 0.6,
    unit: 'utility per nat',
    dist: 'uniform',
    src: 'fitted 18 Nov 2026 by cross-entropy (tools/fit.mjs, decision = activeInference, 4 islands x 5 years): 0 2.30, 0.25 2.05, 0.5 2.06, 1 2.36, 2 2.24 nats; parabola minimum 0.36. On 4 fresh islands (seeds 11-14) 2.25 (expected utility) against 2.16. How much one nat of expected information gain is worth against food; 0 = active inference reduces to expected utility',
  },
  aifPriorLooks: {
    value: 1,
    low: 0.5,
    high: 3,
    unit: 'looks',
    dist: 'uniform',
    src: 'assumption (idea 8): what a first sighting is worth as knowledge of a place, in looks (a vague prior; keeps the information gain of a first look finite: 0.5 ln 2 = 0.35 nats at 1)',
  },
  newsBlurPerHop: {
    value: 0.3,
    low: 0.1,
    high: 0.6,
    unit: 'log units per retelling',
    dist: 'uniform',
    src: 'assumption (idea 9): the sd of the log error each retelling adds to an amount (0.3 = typically off by a third). Serial reproduction drifts (Bartlett 1932); no forager figure found',
  },
  // feelings, stage 1 (feelings.js): fear learned from pain, safety learned on top, told fear
  fearRate: {
    value: 0.5,
    low: 0.2,
    high: 1,
    unit: 'share of the gap per harm',
    dist: 'uniform',
    src: 'assumption: one bad experience moves fear half-way to the pain felt (one-trial fear learning is common: Rescorla and Wagner 1972 rule, rate set by hand); times fearPrepGain for prepared cues and plasticity(age)',
  },
  fearPrepGain: {
    value: 2,
    low: 1.5,
    high: 3,
    unit: 'x',
    dist: 'uniform',
    src: 'assumption: prepared cues (the dark, large animals) are learned faster (Ohman and Mineka 2001); the factor is not measured',
  },
  safetyRate: {
    value: 0.05,
    low: 0.01,
    high: 0.15,
    unit: 'share of the gap per hour',
    dist: 'uniform',
    src: 'assumption: an hour with the cue and no harm builds safety (extinction is new learning, Bouton 2002)',
  },
  safetyPrepFactor: {
    value: 0.5,
    low: 0.25,
    high: 0.8,
    unit: 'x',
    dist: 'uniform',
    src: 'assumption: safety builds more slowly for prepared cues (they resist extinction: Ohman and Mineka 2001)',
  },
  safetyRecoveryDays: {
    value: 60,
    low: 20,
    high: 180,
    unit: 'days',
    dist: 'loguniform',
    src: 'assumption: learned safety fades on this time scale (spontaneous recovery, Pavlov 1927; Bouton 2002)',
  },
  safetyLastingPerDay: {
    value: 0.02,
    low: 0.005,
    high: 0.05,
    unit: 'share of recent safety per day',
    dist: 'loguniform',
    src: 'assumption: recovery after extinction is partial and repeated extinction lasts (Bouton 2002); this share of recent safety becomes lasting each day',
  },
  campDarkTransfer: {
    value: 0.3,
    low: 0.1,
    high: 0.6,
    unit: 'x',
    dist: 'uniform',
    src: 'assumption: safety learned in the dark at camp (fire, company) carries over only in part to the dark away from camp (extinction is context-bound: Bouton 2002)',
  },
  fearToldRate: {
    value: 0.1,
    low: 0.02,
    high: 0.3,
    unit: 'share of the gap per telling',
    dist: 'uniform',
    src: "assumption: how much of a teller's fear a hearer takes on (most children's night fears come from negative information: Muris et al. 2001)",
  },
  earlyPainGain: {
    value: 0.2,
    low: 0.05,
    high: 0.5,
    unit: 'pain sensitivity per harm in the first year',
    dist: 'uniform',
    src: 'assumption for the size; the direction is from Taddio et al. 1997 (neonatal pain raised later pain response)',
  },
  wFear: {
    value: 1,
    low: 0.3,
    high: 2,
    unit: 'utility per unit fear',
    dist: 'uniform',
    src: 'assumption: how much expressed fear weighs in a choice; to be fitted by cross-entropy',
  },
  waterNewsAgeDays: {
    value: 30,
    low: 10,
    high: 90,
    unit: 'days',
    dist: 'loguniform',
    src: 'assumption: how fast what one knows of a water hole goes stale (holes fill and dry over weeks with the seasons)',
  },
  // Layer 1, the atmosphere (atmosphere.js)
  tempPersistence: { value: 0.7, low: 0.5, high: 0.85, unit: 'day-to-day correlation', dist: 'uniform', src: 'assumption in the range found for daily temperature (Richardson 1981 WGEN: lag-1 correlations about 0.6-0.8)' },
  tempAnomalySd: { value: 1.2, low: 0.6, high: 2, unit: 'deg C', dist: 'uniform', src: 'assumption: spread of daily max temperature about the monthly mean near the equator (small seasonal and day-to-day swings)' },
  sensibleShare: { value: 0.5, low: 0.3, high: 0.8, unit: 'share', dist: 'uniform', src: 'Share of extra net sunshine that heats the air (sensible heat), beta/(1+beta) for a Bowen ratio beta near 1 over semi-arid savanna (assumption within the measured range; Stull 1988).' },
  mixedLayerM: { value: 1500, low: 1000, high: 2500, unit: 'm', dist: 'uniform', src: 'Depth of the afternoon convective mixed layer over dry tropical land, about 1-2 km (Stull 1988).' },
  nightLayerM: { value: 200, low: 100, high: 500, unit: 'm', dist: 'uniform', src: 'Depth of the stable night layer that the ground cools, about 100-500 m (Stull 1988).' },
  groundNightShare: { value: 0.5, low: 0.3, high: 0.7, unit: 'share', dist: 'uniform', src: 'Assumption: share of the night longwave loss made up by heat stored in the ground by day, rather than taken from the air.' },
  transpirationShare: { value: 0.51, low: 0.36, high: 0.66, unit: 'share', dist: 'uniform', src: 'Share of evapotranspiration that passes through plants: 51% (sd 15%) in steppes, shrublands and deserts (Schlesinger and Jasechko 2014, 81 partitioning studies).' },
  transpirationRatio: { value: 300, low: 250, high: 350, unit: 'g water per g dry matter', dist: 'uniform', src: 'C4 grasses: about 250-350 g of water transpired per g of dry matter (Larcher, Physiological Plant Ecology).' },
  aboveShare: { value: 0.53, low: 0.4, high: 0.65, unit: 'share', dist: 'uniform', src: 'Above-ground share of grass production: 53% on Nairobi savanna (ANPP 1004, BNPP 875 g/m2/yr; Kinyamario, ORNL DAAC NPP_NRB).' },
  cureBelow: { value: 0.5, low: 0.4, high: 0.6, unit: 'soil wetness', dist: 'uniform', src: 'Grass cures once the soil has lost its readily available water: FAO-56 depletion fraction p, about 0.5 (Allen et al. 1998, Table 22).' },
  curingDays: { value: 14, low: 7, high: 30, unit: 'days', dist: 'uniform', src: 'Assumption: green grass on drying soil cures over about two weeks.' },
  litterHalfLifeDays: { value: 180, low: 90, high: 365, unit: 'days', dist: 'loguniform', src: 'Assumption: standing dead grass removed by termites, fire and weathering with a half-life of about six months.' },
  tuberCover: { value: 0.1, low: 0.02, high: 0.5, unit: 'share of grass and woodland', dist: 'loguniform', src: 'Assumption, the largest unknown in the yields: share of grass and woodland where //ekwa grows at its measured density (5,200 kg/ha; Vincent 1985).' },
  tuberHalfLifeDays: { value: 730, low: 365, high: 1460, unit: 'days', dist: 'loguniform', src: 'Assumption: a tuber stand renews over about two years (perennial legume rootstocks).' },
  berryDryShare: { value: 0.3, low: 0.15, high: 0.5, unit: 'share', dist: 'uniform', src: 'Assumption: dry matter share of fresh wild berries (Grewia drupes are fairly dry).' },
  berryEdibleShare: { value: 0.5, low: 0.3, high: 0.7, unit: 'share', dist: 'uniform', src: 'Assumption: share of a berry that is eaten (Grewia has a large hard stone).' },
  baobabPerHa: { value: 2, low: 0.5, high: 10, unit: 'adult trees per ha', dist: 'loguniform', src: 'Assumption within the recorded range (0-60 stems per ha in natural woodland; 5 per ha in riverine forest, Tigrai).' },
  intertidalShare: { value: 0.05, low: 0.02, high: 0.15, unit: 'share of shore', dist: 'loguniform', src: 'Assumption: the rocky intertidal strip is about 17 m of a 350 m shore square.' },
  shellfishHalfLifeDays: { value: 365, low: 180, high: 730, unit: 'days', dist: 'loguniform', src: 'Assumption: a shellfish bed renews in about a year.' },
  meanHerbGrowth: { value: 514, low: 400, high: 650, unit: 'g/m2 a year', dist: 'uniform', src: 'The herb layer\'s own average yearly growth at the measured climate (6 islands x 4 years, sd 99; 20 Nov 2026), so an average year gives the measured food yields; Deshmukh (1984) predicts about 485 at this rain.' },
  intakePerKgMetabolic: { value: 0.09, low: 0.06, high: 0.12, unit: 'kg dry matter per kg^0.75 a day', dist: 'uniform', src: 'Herbivore voluntary intake scales with metabolic mass (mass^0.75); ruminants about 60-120 g DM per kg^0.75 a day (standard animal nutrition, approx.).' },
  starveDays: { value: 60, low: 30, high: 120, unit: 'days', dist: 'uniform', src: 'Assumption: a herbivore with no food lives on its reserves for about two months.' },
  fuelRefGm2: { value: 413, low: 300, high: 550, unit: 'g/m2', dist: 'uniform', src: 'The herb layer\'s own mean standing dead grass on days fire is possible (6 islands x 3 years, 20 Nov 2026; p10-p90 296-549), so an average fuel year burns as often as before.' },
  predatorSearchKm2: { value: 1.16, low: 0.6, high: 2.3, unit: 'km2 a day', dist: 'loguniform', src: 'Search and attack rate of a lion group on wildebeest: 0.4 km path x 10 km a day x 0.29 success (Fryxell et al. 2007, Nature).' },
  handleDays: { value: 0.045, low: 0.02, high: 0.1, unit: 'days a kill', dist: 'loguniform', src: 'Time to attack and subdue (Fryxell et al. 2007).' },
  digestDays: { value: 1.422, low: 0.7, high: 3, unit: 'days a carcass', dist: 'loguniform', src: 'Digestive pause per carcass, shared by the group (Fryxell et al. 2007).' },
  lionGroup: { value: 6.3, low: 3, high: 10, unit: 'adults', dist: 'uniform', src: 'Mean adults in a Serengeti pride (Fryxell et al. 2007).' },
  hyenaGroup: { value: 3, low: 1, high: 6, unit: 'adults', dist: 'uniform', src: 'Assumption: spotted hyenas hunt in small groups.' },
  predatorDeathRate: { value: 0.15, low: 0.1, high: 0.25, unit: 'per year', dist: 'uniform', src: 'Assumption: adult lion and hyena deaths a year from causes other than hunger.' },
  herbivoreDeathRate: { value: 0.1, low: 0.05, high: 0.2, unit: 'per year', dist: 'uniform', src: 'Assumption: deaths a year among wild herbivores from causes other than predators and hunger (disease, accidents, age).' },
  lionRangeKm2: { value: 100, low: 36, high: 600, unit: 'km2', dist: 'loguniform', src: 'Assumption within measured pride ranges: about 36-43 km2 where prey is rich (Ishasha, Uganda; Mudumba et al. 2015) to 300-600 km2 where it is sparse.' },
  hyenaRangeKm2: { value: 50, low: 9, high: 1000, unit: 'km2', dist: 'loguniform', src: 'Assumption within measured clan territories, 9 to over 1000 km2, smaller where prey is rich (East and Hofer 2013).' },
  herdDriftPerDay: { value: 0.05, low: 0.01, high: 0.2, unit: 'share a day', dist: 'loguniform', src: 'Assumption: share of a large herd that moves into a neighbouring 2.8 km cell in a day.' },
  predatorStarveDays: { value: 30, low: 14, high: 60, unit: 'days', dist: 'uniform', src: 'Assumption: days a lion or hyena can live on its body reserves without food.' },
  switchingPower: { value: 2, low: 1, high: 3, unit: 'exponent', dist: 'uniform', src: 'Prey switching (Murdoch 1969): hunting split in proportion to herds^power; 1 is no switching, 2 the classic switching form (assumption within 1-3). Lions shift diet with prey numbers (Kruger, Owen-Smith and Mills 2008; Eastern Cape, 2011).' },
  wetDayCoolMax: { value: 2, low: 1, high: 4, unit: 'deg C', dist: 'uniform', src: 'RETIRED 20 Nov 2026 (day temperature now from the energy balance, sunWarming in atmosphere.js). Was: assumption: rain days are cooler by day (clouds); dry days are warmer so the monthly mean holds (Richardson 1981 conditions temperature on wet and dry days)' },
  wetDayWarmMin: { value: 1, low: 0, high: 2, unit: 'deg C', dist: 'uniform', src: 'RETIRED 20 Nov 2026 (night temperature now from the longwave balance, nightWarming in atmosphere.js). Was: assumption: cloudy nights lose less heat (net longwave, FAO-56 eq. 39), so rain days have warmer nights' },
  dewDepressionDry: { value: 3, low: 2, high: 5, unit: 'deg C', dist: 'uniform', src: 'FAO-56 Annex 6: in arid and semi-arid places the dew point is about 2-4 deg C below Tmin; dry season' },
  dewDepressionWet: { value: 1, low: 0, high: 2, unit: 'deg C', dist: 'uniform', src: 'FAO-56 Annex 6: in humid conditions the dew point is near Tmin; wet season dry days' },
  windDryMs:     { value: 3, low: 2, high: 5, unit: 'm/s at 2 m', dist: 'uniform', src: 'assumption: the Eyasi dry season is windy (Max Planck Institute fieldwork notes); daily means Weibull, k = 2' },
  windWetMs:     { value: 2, low: 1, high: 3, unit: 'm/s at 2 m', dist: 'uniform', src: 'FAO-56 default when wind is not measured: 2 m/s; wet season' },
  sunshineDry:   { value: 0.75, low: 0.6, high: 0.9, unit: 'n/N', dist: 'uniform', src: 'assumption: share of possible sunshine on a dry day in a semi-arid tropical place' },
  sunshineWet:   { value: 0.3, low: 0.1, high: 0.5, unit: 'n/N', dist: 'uniform', src: 'assumption: share of possible sunshine on a rain day' },
  tempPeakLagH:  { value: 1.5, low: 1, high: 2.5, unit: 'h after solar noon', dist: 'uniform', src: 'Parton and Logan 1981: the day sine peaks about 1.5-2 h after solar noon (fitted lag)' },
  tempNightDecay: { value: 2.2, low: 1.5, high: 4, unit: 'e-folds per night', dist: 'uniform', src: 'Parton and Logan 1981: night cooling coefficient about 2.2 for air temperature' },
  // Layer 2, water (water.js)
  curveNumber:   { value: 85, low: 70, high: 88, unit: 'SCS curve number (average wetness)', dist: 'uniform', src: 'RETIRED with the real land (20 Nov 2026): curve numbers now come from land cover by TR-55 tables (water.js CN_BY_COVER: soil group B, fair condition; pans on clay, group D). Used only if the land is switched back to stand-in, where this fitted value (85) applies. History: USDA TR-55 (1986): poor desert-shrub and sparse herbaceous cover on soils of groups C-D give about 77-88. Set to 85 on 19 Nov 2026: at 75, daily rains here (mean about 9 mm on a wet day) almost never pass the initial loss, and rain-fed pans stayed dry (measured, island 1, 3 years)' },
  groundwaterDays: { value: 120, low: 30, high: 365, unit: 'days', dist: 'loguniform', src: 'assumption: time constant of the groundwater store (linear reservoir); baseflow recession constants of weeks to months are typical of small semi-arid catchments (Brutsaert 2005)' },
  percolationBeta: { value: 2, low: 1, high: 5, unit: 'exponent', dist: 'uniform', src: 'HBV soil routine (Bergstrom 1992): share of infiltrating water passed down = (soil wetness)^beta; beta usually 1-6 in calibrations' },
  channelDays:   { value: 7, low: 5, high: 40, unit: 'days', dist: 'loguniform', src: 'assumption: time constant of the stream channels and sand rivers (the HBV fast reservoir); seasonal streams in semi-arid East Africa recede over days to weeks after rain' },
  poolBedSeepMm: { value: 3, low: 1, high: 10, unit: 'mm/day', dist: 'loguniform', src: 'Assumption, measurable in the field: water a river or stream pool loses into its sand bed each day (a losing stream). Only with the real land (Layer 3).' },
  holeAreaHa: { value: 1, low: 0.25, high: 4, unit: 'ha', dist: 'loguniform', src: 'Assumption, measurable in the field: the open water of one dry-season waterhole or river pool, about 100 m across. With the real land (Layer 3), inflow depth = runoff depth x catchment area / this area.' },
  catchScale:    { value: 8, low: 4, high: 36, unit: 'x', dist: 'loguniform', src: 'RETIRED with the real land (Layer 3, 20 Nov 2026): each hole now gathers from its own catchment (land.js). Used only if the land is switched back to stand-in, where this fitted multiple applies. History: set 19 Nov 2026 against the observed season of water holes (widespread in the wet season, scarcer late in the dry; O\'Connell et al., the Tli\'ika area): swept 1-16 on 3 islands x 3 years; at 8, with curve number 85, pans hold water Nov-Jul and dry Aug-Oct (island 1)' },
  newsFlipPerHop: {
    value: 0.05,
    low: 0.01,
    high: 0.15,
    unit: 'chance per retelling',
    dist: 'uniform',
    src: 'assumption (water news): the chance that a retelling gets "has water" or "dry" backwards (a binary symmetric channel, Shannon 1948)',
  },
  trustPriorRight: {
    value: 2,
    low: 1,
    high: 4,
    unit: 'checks',
    dist: 'uniform',
    src: 'assumption (idea 9): the Beta prior on a teller being right, as if this many checks had come out right (with trustPriorWrong 1: start at 2/3 trust)',
  },
  trustPriorWrong: {
    value: 1,
    low: 0.5,
    high: 2,
    unit: 'checks',
    dist: 'uniform',
    src: 'assumption (idea 9): the Beta prior on a teller being wrong, in checks',
  },
  dayKmHard: {
    value: 45,
    low: 40,
    high: 55,
    unit: 'km/day',
    src: 'assumption: beyond this a walker stops and sleeps out, going on next morning (a long day on foot with loads; the 60 km alarm stays as a check)',
  },
  cookFindHour: {
    value: 0.003,
    low: 0.0005,
    high: 0.01,
    unit: 'chance/hour',
    src: 'assumption: someone tending a fire notices food by it is softer (x curiosity)',
  },
};
// Per-run overrides: any register number can be changed for one run (tools/score.mjs --set, sweeps, fits)
// without touching the register. Set them before the world is made; clearRates() puts everything back.
const OVERRIDE = {};
export const R = k => (k in OVERRIDE ? OVERRIDE[k] : RATES[k].value);
export function setRate(k, v) {
  if (!(k in RATES)) throw new Error(`no register entry ${k}`);
  OVERRIDE[k] = v;
}
export function clearRates() {
  for (const k in OVERRIDE) delete OVERRIDE[k];
}
// Overrides are global to the program, so they last until cleared. withRates sets them for one piece of work and
// always clears them after, even on an error, so they cannot leak into the next run (found by the 18 Nov audit).
export function withRates(over, fn) {
  for (const [k, v] of Object.entries(over)) setRate(k, v);
  try {
    return fn();
  } finally {
    clearRates();
  }
}
export const activeRates = () => ({ ...OVERRIDE }); // recorded in each world's config, so a run says what it ran with

// ---------- Maximum-entropy priors for the register (Jaynes) ----------
// What we may assume about a number is only what we know about it; the least-committal distribution consistent with
// that is the one with the most entropy (Jaynes 1957). For each register entry:
//   - a fixed rule (low = high): fixed.
//   - only a range known (src says assumption): uniform on [low, high]; if the range spans a factor of 4 or more,
//     uniform on the log scale (the maximum-entropy choice when what is known is the order of magnitude, i.e. E[log x]).
//   - a measured value and a range (src cites a source): the truncated exponential on [low, high] whose mean is the
//     measured value (the maximum-entropy distribution with a known mean on a bounded interval).
// An entry can name its own with `dist`. Sweeps and the designed runs for the emulator sample from these.
export function priorOf(k) {
  const r = RATES[k];
  if (!r) throw new Error(`no register entry ${k}`);
  if (!(r.high > r.low)) return { kind: 'fixed', sample: () => r.value, mean: r.value };
  const kind =
    r.dist ??
    (/^\s*(assumption|motive weight \(assumption\))/i.test(r.src) || /assumption/i.test(r.src.slice(0, 40))
      ? r.low > 0 && r.high / r.low >= 4
        ? 'loguniform'
        : 'uniform'
      : 'truncexp');
  if (kind === 'uniform') return { kind, sample: u => r.low + u * (r.high - r.low), mean: (r.low + r.high) / 2 };
  if (kind === 'loguniform') {
    const a = Math.log(r.low),
      b = Math.log(r.high);
    return { kind, sample: u => Math.exp(a + u * (b - a)), mean: (r.high - r.low) / (b - a) };
  }
  // truncated exponential on [a, b] with mean m: density ~ exp(-lam x); solve lam by bisection on the mean
  const a = r.low,
    b = r.high,
    w = b - a,
    m = Math.min(b - 1e-9 * w, Math.max(a + 1e-9 * w, r.value));
  const meanOf = lam => (Math.abs(lam * w) < 1e-9 ? a + w / 2 : a + 1 / lam - w / Math.expm1(lam * w));
  let lo = -1e3 / w,
    hi = 1e3 / w;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (meanOf(mid) > m) lo = mid;
    else hi = mid;
  }
  const lam = (lo + hi) / 2;
  const sample = u => (Math.abs(lam * w) < 1e-9 ? a + u * w : a - Math.log1p(-u * -Math.expm1(-lam * w)) / lam);
  return { kind: 'truncexp', lambda: lam, sample, mean: meanOf(lam) };
}

// ---------- Per-tick values, worked out from the register ----------
// Hunger 0-100 is the short-term store (gut and glycogen): 100 points are hungerFullDays of need.
// Below it is the body store (fat), in kcal: full is starveDays of a day's need (kcalDay).
export function bodyRates(C) {
  const h = C.hours,
    kcalDay = R('kcalDay'),
    hungerPerKcal = 100 / (kcalDay * R('hungerFullDays'));
  const sleep = R('sleepHoursAdult'),
    walkF = R('walkFatigueKm') * R('dayKm');
  const restGain = R('fatigueDay') / sleep; // energy per hour asleep
  const tileKm = 0.35;
  const healPerDay = 15 / R('healDays'),
    restShare = R('restHealShare');
  return {
    tileKm,
    hungerFullDays: R('hungerFullDays'),
    hungerPerKcal,
    unitKcal: R('unitKcal'),
    hungerPerUnit: R('unitKcal') * hungerPerKcal,
    reserveMax: R('starveDays') * kcalDay,
    fatStoreEff: R('fatStoreEff'),
    sleepHoursAdult: sleep,
    waterMlPerKcal: R('waterMlPerKcal'),
    thirstAtShare: R('thirstAtShare'),
    dehydrationDeathShare: R('dehydrationDeathShare'),
    restGainTick: restGain * h,
    // awake: the day's tiredness less what walking adds, spread over the waking hours (PAIR sleep)
    wakeDrainTick: sleepH => (Math.max(0, restGain * sleepH - walkF) / (24 - sleepH)) * h,
    walkFatigueTile: R('walkFatigueKm') * tileKm,
    nightPace: R('nightPace'),
    nightSight: R('nightSight'),
    injuryPerTile: R('injuryPerKm') * tileKm,
    injuryDamage: R('injuryDamage'),
    nightInjury: R('nightInjury'),
    restHealTick: ((healPerDay * restShare) / sleep) * h,
    baseHealTick: ((healPerDay * (1 - restShare)) / (24 - sleep)) * h,
    illnessTick: (100 / (R('deprivationHarmDays') * 24)) * h,
    practiceHours: R('practiceHours'),
    practiceExp: R('practiceExp'),
    forgetDays: R('forgetDays'),
    forgetExp: R('forgetExp'),
    habitDecayMonth: Math.LN2 / (R('habitHalfLife') * 12),
    cultivateTicks: Math.round(R('cultivateHours') * C.perHour),
    craftTicks: Math.round(R('craftHours') * C.perHour),
    gardenKcalHour: R('gardenKcalHour'),
    maxCarryUnits: R('maxCarryUnits'),
    unitsPerAdultYear: (kcalDay * 365) / R('unitKcal'),
  };
}
const bodyCache = new Map();
export function body(s) {
  const C = clockOf(s);
  let b = bodyCache.get(C.min);
  if (!b) {
    b = bodyRates(C);
    bodyCache.set(C.min, b);
  }
  return b;
}

// ---------- The body store ----------
// Food first fills the short-term store (hunger); what is left over is laid down as fat, at fatStoreEff.
// With the short-term store empty (hunger at 100), the day's need is drawn from fat. Death when fat runs out.
// Every kcal is booked in s.energyLedger (conservation of energy, checked in tests): eaten = into the short-term
// store + into fat + heat lost in making fat + not absorbed (fat full); burned = from the short-term store + from fat.
const ledger = s => (s.energyLedger ??= { eaten: 0, burned: 0, heat: 0, unabsorbed: 0 });
export function eatKcal(s, c, kcal) {
  const B = body(s),
    L = ledger(s),
    hpk = c.body?.hpk ?? B.hungerPerKcal,
    room = c.hunger / hpk,
    used = Math.min(room, kcal);
  c.hunger = Math.max(0, c.hunger - used * hpk);
  L.eaten += kcal;
  const extra = kcal - used;
  if (extra > 0) {
    const max = c.body?.fatMax ?? B.reserveMax,
      before = c.reserve ?? 0,
      into = Math.min(max - before, extra * B.fatStoreEff);
    c.reserve = before + Math.max(0, into);
    const taken = Math.max(0, into) / B.fatStoreEff;
    L.heat += taken - Math.max(0, into);
    L.unabsorbed += extra - taken;
  }
}
// Burn `kcal` of need this tick: into hunger until it is full, then out of the fat store. A starving body slows
// down (energy.js LAW.starvingBurn), so the store lasts longer than the usual burn would suggest.
export function burnKcal(s, c, kcal, starvingBurn = 0.75) {
  const B = body(s),
    L = ledger(s),
    hpk = c.body?.hpk ?? B.hungerPerKcal,
    room = (100 - c.hunger) / hpk,
    used = Math.min(room, kcal);
  c.hunger = Math.min(100, c.hunger + used * hpk);
  let fromFat = 0;
  if (kcal > used) {
    const want = (kcal - used) * starvingBurn;
    fromFat = Math.min(c.reserve ?? 0, want);
    c.reserve = (c.reserve ?? 0) - fromFat;
  }
  L.burned += used + fromFat;
}
// Kcal held in a body: the short-term store (hunger) plus fat.
export const storedKcal = (s, c) => (100 - c.hunger) / (c.body?.hpk ?? body(s).hungerPerKcal) + (c.reserve ?? 0);
export const starved = c => c.hunger >= 100 && (c.reserve ?? 0) <= 0;

// ---------- Growth and decay of food (PAIR growth/decay) ----------
// dS/dt = growth - k S - harvest. Left alone, a patch settles at S* = growth / k: growth equals decay.
// Worlds that had a capacity keep it as that settling point, so k = regen / capacity.
export const decayFor = (regenPerTick, capacity) => (capacity > 0 ? regenPerTick / capacity : 0);
export function growPatch(p, grow) {
  let lost = p.stock * (p.decay ?? 0);
  const add = Math.max(0, grow),
    next = Math.max(0, p.stock + add - lost),
    top = p.capacity * 1.5;
  if (next > top) lost += next - top; // a guard only (the settling point is growth/decay); anything over it rots, and is booked as rotted
  p.stock = Math.min(next, top);
  return { add, lost };
}

// ---------- The pairs, as checks (used by tests and shown in the docs) ----------
export const PAIRS = [
  {
    id: 'sleep',
    up: 'rest gain while asleep',
    down: 'tiredness while awake and walking',
    balance: 'a normal day (sleep hours asleep, dayKm walked) nets to zero',
  },
  {
    id: 'food',
    up: 'eating (to hunger, then fat at fatStoreEff)',
    down: 'need (from hunger, then fat)',
    balance: "eating the day's need holds hunger and fat level; nothing for starveDays empties a full store",
  },
  {
    id: 'water',
    up: 'drinking',
    down: 'water lost with energy burned (ml per kcal)',
    balance: 'thirst at thirstAtShare of body mass lost; death at dehydrationDeathShare',
  },
  {
    id: 'growth',
    up: 'patch growth (season x rain x ground)',
    down: 'decay (half-life) and harvest',
    balance: 'unharvested, stock settles at growth / decay',
  },
  {
    id: 'health',
    up: 'healing (asleep and awake)',
    down: 'injury, deprivation illness',
    balance: 'a 15-point injury heals in healDays; deprivation outruns healing',
  },
  {
    id: 'skill',
    up: 'practice (power law of practice)',
    down: 'disuse (power-law forgetting)',
    balance: 'returning to a skill starts from what was kept, not from what was once reached',
  },
  {
    id: 'habit',
    up: 'being borne out (judged good or bad)',
    down: 'fading',
    balance: 'a judgement not repeated halves in habitHalfLife',
  },
  {
    id: 'traits',
    up: 'others and experience',
    down: 'pull back to the inborn',
    balance: 'scaled by the clock, so a year changes traits the same on any tick length',
  },
];
