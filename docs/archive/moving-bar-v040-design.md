# Prototype: the moving bar (0.4.0-proto)

Pre-registered **before any run** of this experiment. Written 15 November 2026. This is a test build, not a world law and not a finding. Nothing here is tuned to a result. If a prediction fails, the result stands.

The question (Robert's): if an agent's conviction adapts to whatever it experiences, what stops it from adapting away the ability to tell that things are getting worse? Does a constraint help — a fixed anchor, or Ostrom-style peer monitoring?

The layer sits in Eden, and it turns on only after release, and only when the caller passes `movingBar`. With the flag omitted, island and Eden histories are the flag-off world (same digest, same save bytes).

## What is built, and what is not

Built, behind the flag:

1. **Hazard.** One falling tree at tile (18, 21), reach Manhattan radius 2 (land tiles only). A creature who steps in from outside is exposed once per entry. Harm is one draw, `harmLo + U * (harmHi - harmLo)`, U from `STREAMS.hazardHarm`, then multiplied by the schedule below. The long way around treats those tiles as blocked. Extra tiles are the avoidance cost, priced like any other step (existing score weight 0.35 per tile, existing move cost).
2. **Felt signal.** On each exposure, `felt = harm - rho * EMA`, with the EMA updated toward that harm. Half-life H. Between exposures the EMA holds (it does not decay back to zero). `felt = harm - rho * EMA` is a definition. A unit test checks the arithmetic. It is not a result.
3. **Bar.** Each creature has an acceptable-harm threshold B. B is initialised to the expected raw harm at the start of the schedule, `(harmLo + harmHi) / 2`, for every creature, including those born later. B never reads `felt` unless the run is the pre-registered felt-coupled boundary (`signal: 'felt'`). An independence test locks that.
4. **Conviction** fires when the mean of the last K recorded signals exceeds B. The signal is raw harm, except in the felt-coupled boundary, where it is `felt`. Firing makes the creature take the avoiding route. It is recomputed every tick from the current mean and the current B, so a bar that has caught up stops firing and the creature can be exposed again.
5. **Ledger**, per creature: harm taken, exposures, avoidance cost (extra tiles), benefit from others' avoidance information (analyst-side expected harm on trips avoided only because the peer-adjusted bar was firing and the own-drift bar was not). Peers contribute the mean raw harm they themselves took. They do not contribute felt, and they do not contribute the schedule.

Not built: reproduction changes, speech, teaching, trust, a new UI control, a new dependency. The app does not turn the flag on.

## Schedule (written in, not measured)

Let `u` be the fraction of the post-release window that has elapsed, window = 3 simulated days (3 × 1440 ticks).

- For `u < 0.5`, multiplier = `1 + 0.6 * (u / 0.5)` (rises from 1 to 1.6).
- For `u >= 0.5`, multiplier = 1.6 and stays there.

True expected harm per exposure is `8 * multiplier` because the raw draw is uniform on [4, 12) and the mean of that range is 8. From the start of the final third (`u >= 2/3`) through the end of the window, the multiplier is 1.6, which is a 60% rise and so is at least the 50% rise the outcome requires. That inequality is a property of this formula. A unit test checks the formula. It is not a result about creatures.

## Bar conditions

The creep target is what B moves toward. Each tick, B closes a fraction `1 - 0.5 ** (1 / driftHalfLife)` of the gap to the target, and snaps when the gap is under `1e-4` so a bar that has arrived is equal to its target and the strict `>` test can turn off.

| Condition | Target of B | Conviction |
|---|---|---|
| **DRIFT** | The creature's own recent mean (raw harm). Prevalence-induced concept change (Levari et al. 2018, as named in `docs/WORLD-LAWS.md`). | Fires only while the recent mean is still above B. Once B has caught the mean, it stops. |
| **ANCHOR** | None. B stays at the birth value. | Fires while the recent mean is above that fixed value. |
| **PEER** | Own recent mean, then `peerWeight` of the way to the median raw harm of living peers with at least `minPeers` such peers, then, if the own mean exceeds the group's recorded past, `monitorWeight` of the way toward that past. | Same comparison, against this constrained target. |
| **ABLATION** | B is unused. | Never fires. No avoidance. Harm still lands. Detection is 0 by construction. |

**Peers and the monitor use only witnessed harm.** The peer median is the median of `harm / exposures` among other living creatures who have been hit. The group's recorded past is the median of raw harm records from living creatures with tick before the schedule's halfway mark. Nobody reads food stock, the multiplier, or another creature's felt signal.

**Own-drift shadow.** PEER also keeps `Bown`, which creeps toward the own mean only. A trip's peer-benefit is credited only when conviction is firing and `Bown` would not have fired. The credited amount is the schedule's expected harm. That number is analyst accounting. The creature does not read it back.

## Primary outcome

**Detection.** Among creatures who are alive and not dependent at the first tick of the final third, the fraction for whom conviction is firing on at least half of the final-third ticks they are still alive (`finalFiring / finalTicks >= 0.5`). Creatures with no ticks in the window are not in the denominator. Creatures who never entered the grove are in the denominator, and they count as not detecting.

The final third is `u` from `floor(2/3 * window) / window` through 1, which is entirely on the plateau.

A seed is excluded if release has not happened by day 12, or if the 3-day window has not finished by day 15. Exclusion depends on the fall, which the flag does not move. A seed excluded in one arm is excluded from every paired comparison.

## Secondary outcomes (reported, not claims)

- Deaths, and the share of those alive when the hazard first begins who die with cause "Falling tree".
- Harm per exposure, mean across creatures who were exposed at least once.
- Who pays (avoidance cost > 0) and who is credited with benefit from others' information (benefit > 0).

## What counts as an effect

Paired difference on the same seed, 20 fresh seeds **61–80**. Two-sided 95% t interval, df = n − 1 (same convention as `REVIEW/tools/summarize.mjs`; t for df 19 is 2.093). **An effect is claimed only if that interval excludes 0.** Three comparisons were named before the run, so they are not a search across outcomes. No further correction was pre-registered. Secondary intervals are descriptive.

Seeds 50, 61, 70 and 80 were used while choosing the grove tile, to see where released creatures walk. Detection was not computed. Those seeds stay in the set Robert named (61–80). The placement use is a limitation, recorded here rather than quietly avoided.

## Predictions that can fail

- **P-a.** DRIFT detection − ANCHOR detection < 0, and the interval excludes 0.
- **P-b.** PEER detection − DRIFT detection > 0, and the interval excludes 0.
- **P-c.** On DRIFT, detection at rho = 1 minus detection at rho = 0 has an interval that **includes** 0. The bar does not read felt, so rho should not move detection. Rho 0.5 and 0.7 are reported beside that pair. The same contrast is reported for ANCHOR and PEER as a check, not as extra claims.

### Regions where each prediction is expected to fail

These regions were chosen because the mechanism is switched off or coupled, not because a pilot looked good.

- **P-a fails** when `driftHalfLife` is infinite (creep rate 0). DRIFT then holds B at the birth value, the same rule as ANCHOR. The paired difference should be 0.
- **P-b fails** when `monitorWeight` is 0 and the peer weight remains 0.35. The peer median is of the same hazard everyone is in, so the pull toward peers should not restore detection once the monitor's memory of the past is removed. If the interval still excludes 0, that expectation was wrong.
- **P-c fails** when `signal` is `felt` and the condition is ANCHOR (B fixed), rho 1 versus rho 0. Felt then is the thing compared with B, so full adaptation should detect less than no adaptation. "Rho has little effect" should not hold in this region.

A scripted sequence (fixed harms, no island) checks that DRIFT's bar can arrive and stop firing while ANCHOR's does not. That is a check of the rule. It is not the experiment.

## Assumptions reserved for Robert

These are the defaults. They were not fit to seeds 61–80, and they will not be changed after the results are seen. A different value is a new pre-registration, not a correction of this one.

| # | Assumption | Default |
|---|---|---|
| 1 | **rho**, how fully the felt baseline resets | 0.7 (sweep 0, 0.5, 1) |
| 2 | **H**, half-life of the felt EMA | 720 ticks (12 hours) |
| 3 | **Drift rate**, half-life of B's creep toward its target | 360 ticks (6 hours). Rate 0 = infinite half-life |
| 4 | **Hazard schedule** | window 3 days; linear rise to ×1.6 over the first half; hold; raw harm uniform on [4, 12); grove (18, 21); radius 2; one strike per entry |
| 5 | **Peer weight** | 0.35 of the gap from the own mean to the living-peer median |
| 6 | **Avoidance cost** | extra tiles, at the existing per-tile score and move cost; no separate toll |
| 7 | **Max acceptable hazard death share** | 0.25 of those alive when the hazard begins. If the share is higher, say so and do not retune |

Also fixed here, same rule (not tuned after results):

| # | Choice | Default | Why it had to be something |
|---|---|---|---|
| 8 | Monitor weight | 0.5 of the gap toward the group's first-half harm | The peer condition needs a number for "pulled back" |
| 9 | Recent window K | 8 exposures | "Recent" needs a length |
| 10 | Birth value of B | 8, the mean of [4, 12), for every creature | "Fixed at birth" is read as the original standard, not the harm prevailing at that birth |
| 11 | Detection rule | majority of final-third ticks, cohort fixed at the start of that third, non-dependents | The outcome needs one definition |
| 12 | Minimum peers | 3 | A median of one neighbour is not a group |
| 13 | Default signal | raw harm | The bar is separate from feeling except in the felt boundary |
| 14 | Run length | cap 15 days; exclude if not released by day 12 | The window has to be able to finish |
| 15 | First EMA step | uses dt = H, not the creature's age | Otherwise the first hit would depend on an 18-year back-date |
| 16 | Who is struck | the adult who steps in, not a child carried onto the tile | Children do not choose the route |
| 17 | Salt | `STREAMS.hazardHarm = [340, 340]` | One draw per strike; the range touches no other range |

## Claim boundary

A starred interval is a statement about this prototype under the table above. It is not a statement about people, about Genesis, or about the island experiments. The ablation's detection of 0 is the switch. The schedule's 60% rise is the formula. Guided creatures are untouched by the hazard, and no one is struck before release.
