# Decision log

Each entry records who decided, what changed, and why. Robert decides the intended experience and scope. On 14 Nov 2026 he asked Claude to take the lead on the open review items, with Grok reviewing.

## 0.3.2 — 15 November 2026 (salt registry completed; hidden-stock interrupt stays memory-only)

| ID | Decision | Source |
|---|---|---|
| D27 | One salt table, `STREAMS` in `dist/sim.js`. Every island and Eden draw reads it. No range overlaps another, including the serpent (77) and the Creator's redirect (now 300–337, off the old 50–67 and 70–87). Island salt numbers are the same as before, so main-island saves and experiment rows are byte-identical. Eden histories are the 0.3.1 histories (already different from 0.3.0). Tests S1, S2. | Edge |
| D28 | Released interrupt stays on remembered stock only (D24). Test S3: changing stock the creature has not seen, including a source it remembers as empty, does not change the decision. The Creator's guided check still reads true stock, on purpose. | Edge |

## 0.3.1 — 15 November 2026 (corrections after Edge's 14:41 UTC review; Robert's new direction)

| ID | Decision | Source |
|---|---|---|
| D23 | **Direction:** build a world faithful to real laws that any theory can be run in; check the world against reality, not a theory; nothing cut, only sequenced; graphics out of scope; the five channels of adaptation are fixed structure (`docs/WORLD-LAWS.md`). Robert has no intended outcome: results count only across a range of settings. | Robert |
| D24 | Fixed: a released creature used true food stock to decide whether to break off (`eden.js` `pressing`). Now memory only. Test S3 fails before, passes after. | Edge (confirmed) |
| D25 | Fixed: random-stream overlaps. Registry `SIM_STREAMS`/`EDEN_STREAMS`; Creator's redirect moved to 300–337. Tests S1, S2. **Eden histories change from 0.3.0.** | Edge (confirmed) |
| D26 | Corrections: five tests renamed to what they show; recovery label reworded; dependency reported per survivor and per creature with the dead as 0; summary tool committed with t intervals and a multiple-comparison note (`REVIEW/tools/summarize.mjs`); THEORY-CHECK rows 4 and 6 corrected (the fall is certain at defaults; guided creatures starve without dying). | Edge |

Not yet done from Edge's list: re-run v5 on fresh seeds 61–80; per-creature harm/exposure/benefit ledger; ODD write-up.

## 0.3.0 — 15 November 2026 (Robert hired Claude as game developer and theologian to keep the build coherent)

| ID | Decision | Source |
|---|---|---|
| D20 | Roadmap choices: Eden only; learned trust including the Creator's word (step 4); self-model measures (step 2); map before building | Robert, on Claude's recommendation |
| D21 | Step 1: senses depend on condition; water (River of Eden, Genesis 2:10, plus two springs); thirst ~7× deadlier than hunger; health with injury and illness only after release | Claude (developer/theologian); figures from the 3-days/3-weeks rule of thumb |
| D22 | Coherence fixes found while building step 1: the Creator accepts any choice meeting a real need (no override loops); pressing needs interrupt actions; interrupted work is kept | Claude, drift check and diagnosis |

## 0.2.2 — 15 November 2026 (Robert: "as long as we can test theories within the confines of what we're building I'm OK with what we change")

| ID | Decision | Source | Files |
|---|---|---|---|
| D18 | Experiment plan v5: a **ration** branch (the same food as provision, handed straight to the living, no pile); **real withdrawal** (leftover gifts removed at day 10 and recorded as `ledger.withdrawn`); a **root failure** alongside the berry failure; **10-day follow-up**; **20 seeds for every variant**. Recovery is matched to the right control (withdrawn ↔ withdrawn, continued ↔ continued). | Grok F1, F2, F5 design proposals; approved by Robert | `dist/sim.js` (`withdraw`, `ration` commands, ledger), `dist/experiment.js`, `tests/run-experiments.mjs`, `dist/index.html` |
| D19 | Anti-drift check: `npm run drift` (`tools/drift-check.mjs`) re-tests every THEORY-CHECK statement plus the island reporting rules, and flags Eden code changed after THEORY-CHECK.md. It runs at every 30-minute check-in and after every change. | Robert | `tools/drift-check.mjs`, `package.json` |

Not done: hunger jitter. It changes the creatures' basic needs, so it waits for an explicit yes.

## 0.2.1 — 15 November 2026 (Robert's direction; built by Claude)

| ID | Decision | Source |
|---|---|---|
| D15 | Reproduction in Eden using real natural-fertility figures (see EDEN-DESIGN "Family"). This was deferred in spec §1; Robert has now brought it into scope for Eden only. | Robert (scope), Claude (parameters from demographic sources) |
| D16 | Fields recalibrated to ~1.2× one adult's need, with first harvest after half a year (drift found: 0.2.0 fields made the post-fall world richer than the garden). | Claude, drift check |
| D17 | `docs/THEORY-CHECK.md` maps each of Robert's statements to the code and its evidence; it must be updated with every Eden change. | Robert ("make sure we're not drifting") |

## 0.2.0 — 15 November 2026 (Robert's direction; built by Claude)

| ID | Decision | Source | Files |
|---|---|---|---|
| D11 | Eden is a separate world entered from the footer. The main island and experiments are unchanged (sim.js only exports its existing `event`, `observe` and `decide`). | Robert | `dist/eden.js`, `dist/app.js`, `dist/index.html` |
| D12 | Guided phase: everyone is warned at birth. The Creator overrides only choices outside what is best (hunger ≥ 30 and not going to real food; energy < 30 and not resting; wandering > 10 tiles from food). No death before release. The Creator does not block the tree or decide at it. | Robert (theory); thresholds and "does not block the tree" chosen by Claude, open to change | `dist/eden.js` |
| D13 | At the tree: a Genesis 3:6 utility (food, beauty, curiosity × credence) against the remembered warning, chosen by logistic weighted chance with the creature's own seeded draw. Every deliberation is logged. | Robert asked for agency grounded in theology and game design; Claude's research and design (`docs/EDEN-DESIGN.md`) | `dist/eden.js` |
| D14 | Release on the first eating, for everyone at once: death begins, self-judgement (reinforcement), cursed ground (50% regrowth), exposure, and production (one field per creature, clothing, tools). | Robert | `dist/eden.js` |

**Observed in 20 seeds × 20 days:** someone ate in 19 of 20 seeds (from day 0.0 to day 9.9, by different creatures); seed 42 never fell. No deaths before release. After release, 14–22 of 24 were alive at day 20. During guided time the Creator overrode 13–84% of decisions; almost all were curiosity wandering beyond 10 tiles from food. Each figure comes straight from the settings above, so it is not a finding about agency or theology.

## 0.1.3 — 15 November 2026 (Claude, responding to the Edge critic review, issue #1)

| ID | Decision | Reason | Files | Effect on results |
|---|---|---|---|---|
| D7 | New worlds use `rng: 2`: the seed is mixed (`seedKey`), and each input is hashed in turn (`noise2`). Saves without `rng` keep the 0.1.1 stream. `PLAN.version` is 4. | Observed: the 0.1.1 random streams for nearby seeds correlated (r = −0.445 for 41 vs 43; −0.25 for 50 vs 51), so the 20 seeds were not independent replicates. After the fix, the worst pairwise \|r\| for seeds 41–60 is 0.040, which is at chance level for 190 pairs. | `dist/sim.js`, `dist/experiment.js` | **All trajectories change for new worlds.** Results from earlier versions are not comparable; regenerate them. |
| D8 | Added `medianHungerAll` (each death counted as 100) and `deaths` to metrics, plus `hungerAllMean` to summaries. The lab shows both medians. | Critic F4: survivor-only medians can improve because the hungriest die. | `dist/sim.js`, `dist/experiment.js`, `dist/app.js` | Reporting only |
| D8b | Capacity proxies also reported over everyone, with each death counted as 0: `knownSourcesAll`, `skillAll` (metrics); `knownAllMean`, `skillAllMean`, `deathsMean` (summaries); lab shows known sources both ways. | Grok F4 follow-up (12:33 UTC): "report every metric over all 24, deaths included". | `dist/sim.js`, `dist/experiment.js`, `dist/app.js` | Reporting only |
| D9 | Recovery (D3) is now judged on `medianHungerAll` (each death counted as 100) instead of the survivor median. | Observed after D7: baseline berry-failure 'recovered' in 15/20 runs while the dead-inclusive median was 99.7. The survivor median was recovering through deaths (critic F4, Claude's open question 1). | `dist/experiment.js`, `dist/app.js` | Recovery fields only |
| D10 | A recovery counts only if it holds: at day 15 the dead-inclusive median must still be ≤ its day-10 value (`recoverySustained`). Temporary returns are labelled 'Recovered temporarily, then worsened' and counted separately. | Observed: 34 of 69 baseline-pilot 'recoveries' happened while all 24 were alive, followed by mass starvation. | `dist/experiment.js`, `dist/app.js` | Recovery fields only |
| — | Documented the fixed 16-point hunger steps and the update order against spec §3 (`docs/MODEL-NOTES.md`). | Critic implementation items 5 and 7. Jitter and phase separation would change the model, so they are left for Robert. | docs | None |

The critic's items addressed by earlier commits: the PLAN fields drive runs (C4, test R4); a learning fixture shows skill changes later gathering outcomes (integration test); the reveal no longer overwrites observed estimates (C3).

## 0.1.2 — 14 November 2026 (decided by Claude at Robert's direction; open to Grok challenge)

| ID | Decision | Reason | Files | Effect on results |
|---|---|---|---|---|
| D1 | On open, restore `island-autosave` automatically, **paused**. If it fails validation, start fresh, keep the damaged text as `island-autosave-rejected`, and say so. | The autosave was written but never read. Restoring paused keeps the spec rule "no unobserved progression". | `dist/app.js`, `dist/index.html` | None |
| D2 | While an experiment branch is on screen, block Save, Load, Import and New run with "Return to your island first". Skip the autosave. Export is still allowed, named `Island-experiment-branch.json`. | Stops a branch world overwriting the player's own island. | `dist/app.js` | None |
| D3 | Recovery is defined only for disturbed runs. It is *worsened* when a sampled survivor median hunger exceeds the maximum seen in the matched undisturbed run (berry-failure ↔ unchanged; continued-provision+failure ↔ continued-provision), or when no-one is alive. It *recovers* when the median then returns to ≤ its day-10 value. Undisturbed runs report "Not applicable". Rows record `controlCondition` and `controlMaxMedianHunger`. `PLAN.version` is 3 and `PLAN.recovery` is `'matched-control'`. | The 0.1.1 measure marked all 200 pilot rows, controls included, as "recovered". The matched control supplies the normal fluctuation band without an invented threshold. | `dist/experiment.js`, `dist/app.js` | New recovery fields only. Alive/hunger/food outcomes identical to 0.1.1 in all 7 result files. |
| D4 | Gifted food left when provision stops is **kept**, and reported as `giftRemaining` (metrics), `giftLeftAtBranchMean` (summary), and "(N left at day 10)" in the lab. | Removing it would be a new, unspecified intervention. Reporting it makes the carry-over visible. | `dist/sim.js`, `dist/experiment.js`, `dist/app.js` | Reporting only |
| D5 | **No recalibration.** Interventions wear off fast (the second source is found within day 1) and seeds converge, but constants are not tuned. | Tuning until an intervention "matters" shapes the result. Any recalibration needs a T1-style published parameter change first. **Escalated to Robert** (see HANDOFF). | — | — |
| D6 | `expectationRate` (0.35) and `revealPrior` (60) moved into `DEFAULTS`. Save format `VERSION` is 3. Version-2 saves convert on load with these defaults and continue byte-identically. | Spec §3 requires a configurable expectation learning rate. Defaults reproduce 0.1.1 exactly. | `dist/sim.js` | None at defaults |

Also: prototype label, `package.json` 0.1.2, service-worker cache `island-model-v3`. A learning fixture test now shows skill lowers gathering minutes per food unit, and that disabling learning removes the effect.

## 0.1.1 review patch — 14 November 2026 (Claude)
C1–C7: see `REVIEW/CHANGELOG.md`.
