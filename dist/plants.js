// ---------- Layer 4: plants (first part: the herb layer) ----------
// The grass and herbs grow from the water they transpire, which the water layer (Layer 2) has already found:
// - Of the day's evapotranspiration (the soil's actual loss, FAO-56), a share passes through plants: about 51% in
//   steppes, shrublands and deserts (Schlesinger and Jasechko 2014, 81 partitioning studies).
// - Dry matter made per water transpired: C4 grasses use about 250-350 g of water per g of dry matter (the
//   transpiration ratio; Larcher, Physiological Plant Ecology). 1 mm over 1 m2 is 1 kg of water.
// - Of that, the share above ground: 53% on Nairobi savanna (ANPP 1004, BNPP 875 g/m2/yr; Kinyamario, ORNL DAAC).
// - The green grass cures (dries) once the soil has lost more than its readily available water (FAO-56 depletion
//   fraction p, about half), over a couple of weeks; cured grass stands as dead matter that termites, fire and
//   weathering remove.
// Nothing here is set from a wanted result. The check (tools/gate-patterns.mjs) compares the year's growth with
// Deshmukh (1984), measured across East and southern Africa: peak biomass (kg/ha) = 8.488 x rain (mm) - 195.8.
// One herb layer for the island for now: the water layer has one soil for the island. Every function < 30 lines.
import { R } from './clock.js';

export const newPlants = () => ({ green: 0, dead: 0, grownTotal: 0, removedTotal: 0, days: 0 });

// The day's growth above ground, g/m2, from the day's actual evapotranspiration (mm)
export const growthFrom = aetMm =>
  ((R('transpirationShare') * Math.max(0, aetMm) * 1000) / R('transpirationRatio')) * R('aboveShare');

// Share of the green grass that cures today, from the soil's wetness (0..1): none while the soil holds more than
// the readily available water, then 1/curingDays a day, rising as the soil dries further
export function curingShare(wetness) {
  const p = R('cureBelow');
  if (wetness >= p) return 0;
  return Math.min(1, (1 + (p - wetness) / p) / R('curingDays'));
}

// One day of the herb layer: growth in, curing from green to dead, dead matter removed (a half-life)
export function plantsDay(s) {
  const W = s.weather;
  if (!W || W.aet == null) return;
  const P = (s.plants ??= newPlants()),
    grow = growthFrom(W.aet),
    cure = P.green * curingShare(W.soil / R('soilMaxMm')),
    gone = P.dead * (1 - 0.5 ** (1 / R('litterHalfLifeDays')));
  P.green += grow - cure;
  P.dead += cure - gone;
  P.grownTotal += grow;
  P.removedTotal += gone;
  P.days++;
}
