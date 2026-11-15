# Decision log

Each entry records who decided, what changed, and why. Robert decides the intended experience and scope. On 14 Nov 2026 he asked Claude to take the lead on the open review items, with Grok reviewing.

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
