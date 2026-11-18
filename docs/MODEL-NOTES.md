# Model notes (implementation facts reviewers asked to have written down)

## Hunger moves in fixed steps of 16
- Hunger rises by `hungerRate` = 0.05 per tick (one tick is one simulated minute), so 16 hunger takes 320 ticks.
- A completed gather takes `min(stock, 4)` food. Each unit lowers hunger by 4, so a normal meal is exactly −16, and +2 energy per unit.
- With stock available, creatures settle into regular eat/explore cycles, and hunger values sit on a lattice spaced 16 apart. That is why survivor medians come out at exactly 12, 20 or 28, and why sampled-median measures such as "recovery" move in jumps.
- **Not changed.** Adding jitter (to meal size, hunger rate or timing) would change the model's behaviour, so whether to add it is Robert's decision.

## Update order compared with specification §3
Spec order: interventions/environment → observations/decisions → movement/actions and resource claims → needs/death → records.

What `step()` does each tick:
1. Player or experiment commands are applied *between* ticks, before `step()` (interventions).
2. `tick++`, then every source regenerates up to capacity (environment).
3. Living creatures are put in a seeded order, one random draw per creature per tick, used for arbitration.
4. Every creature observes (perception updates memory).
5. Creatures with no current action, or with energy below 5, decide. Scores and inputs are recorded before anything executes.
6. Then **per creature, in the seeded order**: hunger rises (needs), the action runs (rest, move, or gather with the stock claim), then the starvation counter is updated and death is checked.
7. Memory and chronicle events are written at the moment they happen, not in a separate pass.

**Deviations, documented rather than changed:**
- Needs, actions and death are interleaved per creature instead of running as three separate phases. A creature's hunger rises before its own meal in the same tick.
- Records are written inline.

Both deviations are deterministic, and arbitration order still decides who claims food first. Separating the phases would change every trajectory, so that is left for an explicit decision.

## Random numbers
- Draws are counter-based: `draw(seed, tick, creature, salt)` depends on nothing else. Interventions therefore never shift another creature's draws (test E2).
- Every simulation process takes its salt from one table, `STREAMS` in `dist/sim.js`. Ranges do not overlap, so two processes cannot draw the same number for the same creature on the same tick (tests S1, S2). Island salts are unchanged from 0.1.3. The Creator's redirect used to sit on 50–67 and 70–87, which overlapped island explore (40–57) and the serpent (77); it now uses 300–317 and 320–337.
- Worlds created from 0.1.3 on use `rng: 2`, which mixes the seed and each input in turn. The 0.1.1 function correlated nearby seeds (r ≈ −0.45 between seeds 41 and 43).
- Saves without `rng` keep the original stream, so they continue exactly as before (test E1b).
