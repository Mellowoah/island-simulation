// ---------- Feelings, stage 1: fear, learned, with pain as its signal ----------
// One module for every world, so Eden and the small world cannot drift apart.
// Sources (checked 18 Nov 2026; see docs/THEORY-CHECK.md "Feelings, stage 1"):
// - Fear is learned by prediction error (Rescorla and Wagner 1972), the shared delta rule in learning.js.
// - Losing a fear is new learning laid over the old one, not erasure (Bouton 2002): we keep two memories per cue,
//   fear F and safety S. Expressed fear is F - S. Safe exposures raise S; they never lower F. S fades back with
//   time (spontaneous recovery), and one new harm drives F up at once (reinstatement).
// - Prepared fears (Ohman and Mineka 2001): cues that threatened our ancestors (the dark, large animals) are
//   learned faster and lose their fear more slowly.
// - Children learn fastest: learning scales with plasticity(age) (being.js; checked against Roberts and
//   DelVecchio 2000, test F4).
// - Most children's night fears come from being told (Muris et al. 2001: about 80% name negative information),
//   so fear also passes in the evening talk, weighed by trust in the teller (idea 9).
// - Pain is the harm signal. Pain in the first year raises later pain sensitivity (Taddio et al. 1997).
// - Inborn sensitivity is the inherited caution trait (about 40% heritable, as for neuroticism).
// The same rules run in every world: nothing here knows about God, the fall or the serpent.
import { R, clockOf, isNight } from './clock.js';
import { plasticity } from './being.js';
import { moonLight } from './weather.js';

export const CUES = {
  dark: { label: 'the dark', prepared: true },
  beast: { label: 'large animals', prepared: true },
};

const blank = () => ({ F: 0, S: 0 });

export const feelingsOn = s => s.config?.feelings === true; // off until stage 1 is checked (see THEORY-CHECK)

export function fearOf(p) {
  if (!p.fear) p.fear = { dark: blank(), beast: blank(), painSens: 1 };
  return p.fear;
}

// How strongly a cue is present now, 0..1. The dark: out at night, less so under a moon that is up.
export function cueNow(s, p, cue) {
  if (cue === 'dark') return isNight(clockOf(s), s.tick) ? 1 - 0.7 * moonLight(s) : 0;
  if (cue === 'beast') return p.step?.k === 'hunt' ? 1 : 0;
  return 0;
}

const ageOf = (s, p) => p.body?.age ?? 0;
const prep = cue => (CUES[cue].prepared ? R('fearPrepGain') : 1);

// Expressed fear of a cue, 0..1 and up: what is learned (F - S) times inborn sensitivity.
export function fearLevel(p, cue) {
  const f = fearOf(p)[cue];
  const sens = 0.5 + (p.mind?.caution ?? 0.5);
  return Math.max(0, f.F - f.S) * sens;
}

// Harm with a cue present: pain is the teaching signal. damage is in health points.
export function harmed(s, p, cue, damage) {
  const m = fearOf(p), f = m[cue], a = ageOf(s, p);
  if (a < 1) m.painSens = Math.min(2, m.painSens + R('earlyPainGain')); // early pain sensitises (Taddio 1997)
  const pain = Math.min(1, damage / 20 * m.painSens); // a fall (15) hurts 0.75; a goring (45) 1
  const rate = Math.min(1, R('fearRate') * prep(cue) * plasticity(a));
  if (pain > f.F) f.F += rate * (pain - f.F); // delta rule toward the pain; a lesser hurt does not lower fear
  f.S *= 1 - pain;                            // reinstatement: a new harm undoes learned safety (Bouton)
}

// An hour with the cue present and no harm: safety is learned in proportion to the fear that was not met.
export function safeHour(s, p, cue, strength) {
  const f = fearOf(p)[cue]; if (f.F <= f.S || strength <= 0) return;
  const slow = CUES[cue].prepared ? R('safetyPrepFactor') : 1;
  f.S += R('safetyRate') * slow * plasticity(ageOf(s, p)) * strength * (f.F - f.S);
}

// Once a day: safety fades back (spontaneous recovery); fear memory itself is kept.
export function fearDay(p) {
  const m = fearOf(p), k = Math.exp(-1 / R('safetyRecoveryDays'));
  for (const cue in CUES) m[cue].S *= k;
}

// Told: a hearer moves toward the teller's fear, as far as they trust them, both ways. A more frightened teller
// adds fear memory; a calmer one adds safety (vicarious extinction: Golkar et al. 2013, other people as a means
// to safety). So the band settles near a trust-weighted average of what its members have lived, not at its most
// frightened member.
export function toldFear(a, b, trust) {
  const ma = fearOf(a), mb = fearOf(b), k = R('fearToldRate') * trust * plasticity(b.body?.age ?? 0);
  for (const cue in CUES) {
    const fa = Math.max(0, ma[cue].F - ma[cue].S), fb = Math.max(0, mb[cue].F - mb[cue].S), gap = fa - fb;
    if (gap > 0) mb[cue].F = Math.min(1, mb[cue].F + k * gap);
    else if (gap < 0) mb[cue].S = Math.min(mb[cue].F, mb[cue].S - k * gap);
  }
}
