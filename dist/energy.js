// Island: one law of energy for every body (real clock only).
//
// Robert, 17 Nov: "Be sure that distance covered and energy used makes sense ... some universal law of energy
// consumption. Babies would need a lot of energy ... moms would need energy to take care of the kids."
//
// The laws used, all in kcal and kg:
//   Body size     mass by age and sex: Hadza adults, women 46 kg, men 51.3 kg (Blurton Jones 2016); infants
//                 5-24 months 7.3-10.2 kg (an African infant sample); children in between (approx., WHO reference
//                 curves scaled to Hadza adult size).
//   Resting burn  The universal law across living things is Kleiber's: resting energy ~ 70 x mass^0.75 kcal/day.
//                 Within humans it under-reads children by about a third (their brains burn more), so the body
//                 uses the measured human equations (Schofield, adopted by FAO/WHO/UNU) and reports Kleiber beside it.
//   Daily burn    resting x activity level (PAL) by age, for everything except walking (FAO/WHO/UNU 2004 ranges;
//                 Hadza women ~1.6, men ~1.8 of BMR including walking, Pontzer et al. 2012).
//   Walking       cost per km is proportional to the mass moved, body plus anything carried (Bastien et al. 2005),
//                 and per kg it is higher for small bodies (Taylor et al. 1982: cost per kg per km ~ mass^-0.3).
//                 0.5 kcal/kg/km for a 50 kg adult. A mother carrying her baby pays for its weight on every step.
//   Speed         small bodies walk slower: dynamic similarity (Froude), speed ~ leg length^0.5 ~ mass^(1/6).
//   Growth        building tissue costs 35% of an infant's energy at 0-3 months, 5% at 12 months, 3% in the second
//                 year, 1-2% to mid-adolescence, nothing in the late teens (FAO/WHO/UNU 2004).
//   Pregnancy     +85, +285, +475 kcal/day by trimester (FAO/WHO/UNU 2004).
//   Nursing       the mother makes the milk her baby lives on: its need, at 80% conversion efficiency. Milk is all a
//                 baby eats to 6 months, then a falling share to weaning at about 2.5 years (Hadza, approx.).
//   Reserves      body fat by age and sex (Hadza women ~21%, men ~13%, approx.; infants ~25%) x 7,700 kcal/kg.
//                 Starving, the body slows to about 75% of its usual burn (Keys et al. 1950: large falls in BMR).
//                 So fat-rich bodies last longer: a lean man runs out sooner than a woman (a check, not a rule).

export const LAW = {
  kleiberA: 70,
  kleiberB: 0.75,
  cotAt50: 0.5,
  cotExp: -0.3, // kcal per kg per km for walking, and its scaling with body mass
  speedAt48: 4,
  speedExp: 1 / 6, // km/h for an adult, and its scaling
  fatKcalPerKg: 7700,
  starvingBurn: 0.75,
  milkEfficiency: 0.8,
  milkOnlyUntil: 0.5,
  weanYears: 2.5,
  carryUntil: 3,
  pregnancy: [85, 285, 475],
};
// Mass (kg) by age, sex-averaged to 12, then by sex.
const MASS = [
  [0, 3.0],
  [0.25, 5.0],
  [0.5, 6.6],
  [1, 8.4],
  [1.5, 9.0],
  [2, 10.2],
  [3, 11.8],
  [5, 14.5],
  [7, 17.5],
  [10, 22.5],
  [12, 27],
];
const MASS_F = [
    [14, 34],
    [16, 40],
    [18, 44],
    [20, 46],
  ],
  MASS_M = [
    [14, 33],
    [16, 41],
    [18, 47],
    [20, 51.3],
  ];
const lerp = (table, x) => {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++)
    if (x <= table[i][0]) {
      const [a, va] = table[i - 1],
        [b, vb] = table[i];
      return va + ((vb - va) * (x - a)) / (b - a);
    }
  return table.at(-1)[1];
};
export const massOf = (age, sex) =>
  age < 12 ? lerp(MASS, age) : lerp([[12, 27], ...(sex === 'M' ? MASS_M : MASS_F)], age);

// Resting burn, kcal/day.
export const kleiber = m => LAW.kleiberA * m ** LAW.kleiberB;
const SCHOFIELD = {
  M: [
    [3, 60.9, -54],
    [10, 22.7, 495],
    [18, 17.5, 651],
    [30, 15.3, 679],
    [60, 11.6, 879],
    [Infinity, 13.5, 487],
  ],
  F: [
    [3, 61.0, -51],
    [10, 22.5, 499],
    [18, 12.2, 746],
    [30, 14.7, 496],
    [60, 8.7, 829],
    [Infinity, 10.5, 596],
  ],
};
export function bmr(age, sex, m = massOf(age, sex)) {
  const [, a, b] = SCHOFIELD[sex === 'M' ? 'M' : 'F'].find(([u]) => age < u);
  return a * m + b;
}
// Activity level (everything but walking, which is costed by distance).
const PAL = [
  [0, 1.3],
  [1, 1.35],
  [3, 1.4],
  [6, 1.45],
  [10, 1.5],
  [14, 1.55],
  [18, 1.5],
  [50, 1.45],
  [65, 1.35],
];
export const palOf = age => lerp(PAL, age);
// Growth as a share of the day's energy (FAO/WHO/UNU 2004).
const GROWTH = [
  [0, 0.35],
  [0.25, 0.35],
  [0.5, 0.17],
  [1, 0.05],
  [2, 0.03],
  [3, 0.018],
  [14, 0.015],
  [16, 0.01],
  [18, 0],
];
export const growthShare = age => lerp(GROWTH, age);
// Everything but walking, pregnancy and nursing, kcal/day.
export function baseKcalDay(age, sex, m = massOf(age, sex)) {
  const e = bmr(age, sex, m) * palOf(age);
  return e / (1 - growthShare(age));
}
// Walking: kcal per km for a body of mass m carrying `load` kg.
export const cotPerKg = m => LAW.cotAt50 * (m / 50) ** LAW.cotExp;
export const walkKcalKm = (m, load = 0) => cotPerKg(m) * (m + load);
export const speedKmH = m => LAW.speedAt48 * Math.min(1.05, (m / 48) ** LAW.speedExp);
// Body fat share by age and sex (approx.).
const FAT = [
  [0, 0.14],
  [0.5, 0.25],
  [1, 0.24],
  [3, 0.18],
  [6, 0.15],
  [12, 0.16],
];
export const fatShare = (age, sex) =>
  age < 12
    ? lerp(FAT, age)
    : lerp(
        [
          [12, 0.16],
          [18, sex === 'M' ? 0.13 : 0.21],
        ],
        age,
      );
export const fatKcal = (age, sex) => massOf(age, sex) * fatShare(age, sex) * LAW.fatKcalPerKg;
// How much of a nursing child's food is milk.
export const milkShare = age =>
  age < LAW.milkOnlyUntil
    ? 1
    : age >= LAW.weanYears
      ? 0
      : 1 - (age - LAW.milkOnlyUntil) / (LAW.weanYears - LAW.milkOnlyUntil);
export const carried = age => age < LAW.carryUntil;
export const pregnancyKcal = trimester => LAW.pregnancy[Math.min(2, Math.max(0, trimester))];

// FAO/WHO/UNU 2004 daily energy requirements, for the check (kcal/day, moderate activity; adults at 50-55 kg).
export const FAO_CHECK = [
  { age: 0.08, sex: 'F', kcal: 464, mass: 4.35 },
  { age: 0.08, sex: 'M', kcal: 518, mass: 4.58 },
  { age: 1.5, sex: 'F', kcal: 850, mass: 10.8 },
  { age: 1.5, sex: 'M', kcal: 950, mass: 11.5 },
  { age: 4.5, sex: 'F', kcal: 1250, mass: 16.8 },
  { age: 4.5, sex: 'M', kcal: 1350, mass: 17.7 },
  { age: 6.5, sex: 'F', kcal: 1425, mass: 20.6 },
  { age: 6.5, sex: 'M', kcal: 1575, mass: 21.7 },
  { age: 30, sex: 'F', kcal: 2150, mass: 50 },
  { age: 30, sex: 'M', kcal: 2650, mass: 55 },
];
// The model's day for a typical forager of that age: base + walking a typical distance (adults 6 km women,
// 11 km men; children 3 km, under-3s carried).
// Pass `m` to compare at the reference's own body mass (FAO uses larger, well-fed reference bodies).
export function modelDay(age, sex, m = massOf(age, sex)) {
  const km = age < LAW.carryUntil ? 0 : age < 12 ? 3 : sex === 'M' ? 11 : 6;
  return baseKcalDay(age, sex, m) + walkKcalKm(m) * km;
}
