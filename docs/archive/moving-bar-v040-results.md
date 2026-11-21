# Moving bar prototype — results (0.4.0-proto)

Status: **test build. Not a finding about people, Genesis, or the island experiments.** Not retuned after these numbers. Defaults stay as pre-registered in `docs/PROTO-MOVING-BAR.md` (committed in `21af4c7` before this run).

Labels: **Observed** (this run), **Inferred** (read off the code or the table, not a separate demonstration), **Unrun**, **Deferred**.

## 1. Command

```text
node REVIEW/tools/moving-bar-experiment.mjs
```

**Observed.** Exit 0. 246 seconds. 17 arms × seeds 61–80 = 340 runs. 0 seeds excluded (every world released by day 12 and finished the 3-day window; fall ticks 1 to 16,173). Machine summary: `REVIEW/logs/v040-experiment.txt`. Rows: `REVIEW/results/moving-bar-v040.json`.

Paired 95% t interval, df = 19, t = 2.093. A **claim** needs the interval to exclude 0. Three contrasts were named before the run. A star in the wrong direction is still a failed prediction.

## 2. Primary: detection in the final third

Fraction of non-dependent creatures alive at the start of the final third whose conviction was firing on at least half of the ticks they were still alive. Cohort size was about 17. About 36 creatures were alive when the hazard began (births before release). Rho = 0.7 except where noted.

| Arm | Mean detection (n = 20) |
|---|---|
| DRIFT | 0.840 |
| ANCHOR | 0.856 |
| PEER | 0.683 |
| ABLATION | 0.000 |

Ablation is 0 on every seed. **By construction** (conviction is forced off). It is not a result.

| Contrast | Paired difference | Excludes 0? | Verdict |
|---|---|---|---|
| **P-a** DRIFT − ANCHOR | −0.0155 ± 0.0424 | no | **Fails.** DRIFT is not shown to detect less. |
| **P-b** PEER − DRIFT | −0.1578 ± 0.0539 | yes, negative | **Fails.** PEER detects less, not more. |
| **P-c** DRIFT, rho 1 − rho 0 | +0.0000 ± 0.0000 | no; the difference is 0 | **Holds as an identity**, not as a measured effect size. |

**Observed, P-a.** The point estimate is a 1.6 percentage-point gap. The interval covers both a small DRIFT disadvantage and a small DRIFT advantage. No claim.

**Observed, P-b.** The interval lies entirely below 0. Under the pre-registered rule that is an effect, and the effect contradicts the prediction. Peer monitoring, as specified, did not protect detection.

**Observed, P-c.** On all 20 seeds, DRIFT detection at rho 0, 0.5, 0.7 and 1 is the same number. The same is true for ANCHOR and for PEER. Rho did not move a route, a hit, or a bar. That is what the independence test locks. It is not evidence that adaptation "happens to be small" in this world. Felt values do change with rho (`tests/moving-bar.test.mjs`); they are not consulted.

**Inferred, why P-a had little room.** Exposed creatures were hit about 1.6 times (DRIFT) or 1.6 times (ANCHOR). The scripted rule can turn DRIFT off once the recent mean has stopped rising and the 360-tick half-life has run. With one or two hits, that finish often does not fall inside the final third, so both bars are still over the line. A tick-by-tick trace of when each hit landed was **not** saved. Treat the timing story as a guess.

## 3. Rho, and the regions where the predictions were supposed to fail

Detection means, same 20 seeds:

| | rho 0 | rho 0.5 | rho 0.7 | rho 1 |
|---|---|---|---|---|
| DRIFT | 0.840 | 0.840 | 0.840 | 0.840 |
| ANCHOR | 0.856 | 0.856 | 0.856 | 0.856 |
| PEER | 0.683 | 0.683 | 0.683 | 0.683 |

| Region | What was pre-registered | Paired difference | What happened |
|---|---|---|---|
| **P-a off** (`driftHalfLife` infinite) | DRIFT becomes ANCHOR, so "detects less" fails | nodrift − anchor = +0.0000 ± 0.0000 | **Observed.** Identical on all 20 seeds. The prediction fails because the creep is off. |
| **P-b off** (`monitorWeight` 0, peer weight still 0.35) | The shared hazard should leave PEER indistinguishable from DRIFT | nomonitor − DRIFT = −0.2545 ± 0.0519 | **The expectation was wrong.** The interval excludes 0. Without the monitor, detection is lower still (mean 0.586), not the same. |
| **P-c off** (ANCHOR, but the signal is felt) | Rho should move detection once feeling is what gets compared with B | felt rho 1 − rho 0 = −0.8026 ± 0.0479 | **Observed, as pre-registered.** Rho 0 detects 0.856 (matches ANCHOR on every seed, because felt = harm). Rho 1 detects 0.053. Full adaptation of the signal that the bar reads does remove detection. |

**Inferred, the reversed peer result.** The peer median is the mean harm living neighbours actually took. On a hazard that is getting worse, that median sits up at the new level. Pulling B toward it raises the bar and conviction turns off. The monitor pulls the other way, toward the first-half record. Full PEER (0.683) sits above no-monitor (0.586); a post-hoc paired difference is +0.0967 ± 0.0450. That contrast was **not** pre-registered. It is a description of the same runs after the table was seen. It does not get the claim rule. It is consistent with the monitor giving some of the detection back and not enough to beat DRIFT.

## 4. Secondary (descriptive, not claims)

Hazard death share is **0** in every arm. The pre-registered bound was 0.25. The runs are under it. Nothing was retuned. **Observed.** The falling tree did not kill anyone. Ordinary Eden deaths averaged about 17.6 per run (population about 38, about 21 still alive at the window's end). Paired death differences between DRIFT, ANCHOR, PEER and ablation all include 0.

| | DRIFT | ANCHOR | PEER | ABLATION |
|---|---|---|---|---|
| Harm per exposure | 10.44 | 10.30 | 10.62 | 10.36 |
| Exposures per creature who was hit | 1.65 | 1.63 | 1.80 | 3.24 |
| Mean avoidance cost (extra tiles, all creatures) | 39.6 | 36.5 | 37.9 | 0 |
| Creatures who paid (cost > 0) | 27.4 | 25.8 | 26.3 | 0 |
| Creatures credited with others' information | 0 | 0 | 0.85 | 0 |
| Mean credited benefit (expected harm, diluted over everyone) | 0 | 0 | 0.40 | 0 |

Harm-per-exposure differences between the four arms include 0. The schedule's expected harm runs from 8 up to 12.8; a pooled mean near 10.4 sits in between. **Inferred** from the formula plus this average, not a separate check that each creature's hits followed the schedule.

**Observed, who pays.** Ablation never pays (the switch). ANCHOR's mean extra-tile cost minus ablation is +36.5 ± 4.9 and excludes 0. ANCHOR's exposures minus ablation are −1.62 ± 0.18 and exclude 0. Creatures who can fire do take the long way and are hit less often. DRIFT versus ANCHOR on that cost includes 0. DRIFT has about 1.7 more payers than ANCHOR (+1.65 ± 0.89, excludes 0). That payer count was not a pre-registered claim.

**Observed, who benefits.** Only the PEER rule can credit "others' information", and only when the own-drift shadow would not have fired. Mean 0.85 creatures per run are credited, and those same creatures also paid the walk (`bothPayAndBenefit` equals the beneficiary count). DRIFT and ANCHOR credit nobody, by the ledger rule. Almost everyone who walks the long way is paying for their own bar. The peer credit is rare. PEER's credited benefit minus DRIFT is +0.40 ± 0.19 and excludes 0; the absolute amount is small beside the tiles paid.

PEER is also hit slightly more often than DRIFT (+0.15 ± 0.09 exposures, excludes 0), which fits detecting less and therefore avoiding less. Descriptive.

## 5. What was checked before the run

| Command | Result |
|---|---|
| `node --test tests/moving-bar.test.mjs` on the parent, before the exports existed | **Fail.** The module did not export `MOVING_BAR_DEFAULTS`. Log: `REVIEW/logs/v040-tests-before.txt`. |
| `npm test` after the layer | **57 pass, 0 fail**, 22 s. Log: `REVIEW/logs/v040-npm-test.txt`. The new file is 9 tests: felt arithmetic, the schedule formula, the scripted DRIFT/ANCHOR rule, independence of B from rho, peer target and ablation, fall tick unchanged, hidden stock, salt and no `.stock` in the new block, ledger on a finished run. |
| `node tools/drift-check.mjs` | **No drift.** Log: `REVIEW/logs/v040-drift.txt`. |
| Flag off, seeds and lengths in the golden test | Island and Eden digests and SHA-256 of the save match 0.3.2. **Observed.** |

The felt formula, the 60% schedule rise, and the scripted "DRIFT can stop / ANCHOR keeps going" check are definitions of the code. They are not rows in the table above.

## 6. Assumptions still reserved for Robert

Not changed after the table. A different value is a new pre-registration.

| # | Assumption | This run |
|---|---|---|
| 1 | rho | 0.7, and the sweep 0, 0.5, 1 |
| 2 | H, felt half-life | 720 ticks |
| 3 | Drift rate (half-life of the creep) | 360 ticks; infinite in the P-a region |
| 4 | Hazard schedule | 3-day window; ×1.0 to ×1.6 over the first half, then hold; raw harm uniform on [4, 12); grove (18, 21), radius 2; one strike per entry |
| 5 | Peer weight | 0.35 |
| 6 | Avoidance cost | extra tiles at the existing per-tile price; no separate toll |
| 7 | Max acceptable hazard death share | 0.25. Observed share was 0. |

Also fixed in the pre-registration and not retuned: monitor weight 0.5, recent window 8, birth value of B = 8, majority rule for detection, minimum 3 peers, raw harm as the default signal, 15-day cap, first EMA step uses dt = H, only the walker is struck, salt `[340, 340]`.

## 7. Unrun and deferred

- **Unrun.** iPhone, Safari, a 20-minute session. No browser pass of the footer label beyond the string change.
- **Unrun.** A trace of hit times inside the final third, which would test the guess in section 2.
- **Deferred.** Slower creep, a heavier tree, a different grove. Any of those would be a new document, not a repair of this one.
- **Deferred.** Speech, teaching, trust, and the rest of the roadmap. The peer read is a median of witnessed harm, nothing else.
- **Limitation, already in the pre-registration.** Seeds 50, 61, 70 and 80 were used to see where creatures walk before the grove tile was locked. Detection was not computed then. Seeds 61–80 were still the experiment, as specified.

## 8. Verdict

In this prototype, under these defaults, with seeds 61–80:

- A fixed anchor did **not** detect the rise more reliably than a bar that creeps. The gap is compatible with noise.
- Peer monitoring did **not** detect it more than the creeping bar. It detected it less, and a monitor-off arm detected it less again.
- Rho did **not** move detection while the bar read raw harm. The difference is exactly zero. When the bar is instead allowed to read the adapted feeling, rho 1 detects far less than rho 0.

The question is still open for a world in which creatures are hit often enough for a creeping bar to finish catching up. This run did not produce that world, and the defaults were not adjusted to make it do so.
