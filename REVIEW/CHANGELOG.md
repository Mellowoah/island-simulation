# Island 0.1.1 — review patch change log

Review by Claude (Opus 5.5), 14 November 2026. Base: `Island-Review-Source.zip` as uploaded (14 files, SHA-256 list in `logs/pristine-sha256.txt`).
This patch is for ChatGPT to review and integrate. It is **not** a claim that the project is complete or independently validated.

Constraints followed: no architecture change, no new features or dependencies (`package.json` unchanged), no deployment or hosting/access changes, Eden untouched (still paused before anyone eats), no trust, instruction-following or testimony mechanics, and no change to decision scores, constants or outcome rules.

## Changes

| # | Defect (observed) | File(s) | Change | Assumption changed |
|---|---|---|---|---|
| C1 | `deserialize` accepted saves that crash the renderer: a dead creature with `death:null`, or a decision with non-numeric `hunger`/`energy`/`tick`. Confirmed in Chrome: the app froze (clock stopped, "Cannot read properties of null (reading 'tick')") and the valid world had already been replaced. | `dist/sim.js` | Validate `death` (null when alive; `{tick ≤ s.tick, cause:string}` when dead) and decision fields (`tick`, `hunger`, `energy` in bounds; `selected` and option `type` ∈ rest/explore/gather; `patch` refers to an existing source). | None. Stricter validation only. Every save the simulation itself produces still loads (test R1b). |
| C2 | Opening the crossing cancelled gathering already under way, because `c.action?.route` is truthy for the empty route of a creature standing at its patch. | `dist/sim.js` | `c.action?.route` → `c.action?.route?.length`. Creatures still travelling are still replanned. | None intended. The crossing changes routes; it no longer wipes gathering progress. |
| C3 | Revealing a source to a creature that already knew it overwrote its observed estimate with the fixed prior 60 and interrupted its action. | `dist/sim.js` | If the creature already knows the source, log "already knew…; nothing changed" and leave knowledge and action alone. First-time reveal is unchanged (prior 60, action reset). | A reveal now only adds a location; it never replaces an observed estimate. |
| C4 | Experiment manifest (`PLAN`) could drift from the runs: provision amount, interval, location, training and follow-up days, recipient and failed source were hardcoded separately. The crossing and reveal timings were not recorded at all. | `dist/experiment.js`, `dist/sim.js`, `tests/run-experiments.mjs` | `schedule`/`runSeed` read every value from `PLAN`. Added `PLAN.access.tick = 0` and `PLAN.information = {tick: 0, patch: 'b'}`, recording the timings the code already used. The `failure` command takes `patch` (default `'a'`; unknown or gifted sources are rejected), and its event text now names the source. The runner uses `PLAN.seeds[i]`. | None for default values. All 7 result files have byte-identical outcome rows before and after (see Results). `PLAN.version` is left at 2; the integrator should decide whether the added manifest fields need a bump. |
| C5 | Only 6 visually distinct creatures: colour `id % 6` and ear shape `id % 3` (3 divides 6, so ear shape was fully determined by colour). The spec requires 24 distinguishable sprites, with colour not the only identifier. | `dist/app.js` | Ear pattern = `floor(id / 6) % 4` (right / middle / none / both), giving 6 colours × 4 ear patterns = 24 unique looks, independent of colour. | Visual only. |
| C6 | Help text claimed "This hosted prototype is private to your account", which nothing in the code can guarantee. | `dist/index.html` | Replaced with "Who can open this page depends on where it is hosted." | Text only. Access settings are not touched. |
| C7 | The hidden import `<input type=file hidden>` was visible as a raw "Choose File" control (CSS `input{display:block}` overrides `hidden`). Also confirmed in the unpatched screenshot. | `dist/style.css` | Appended `[hidden]{display:none!important}`. | Visual only. Lab Cancel/Return still appear when needed (browser QA). |

Added `tests/review.test.mjs` (7 tests). R1–R4 fail on the unpatched sources and pass after the patch. R1b, R4b and K1 are added coverage (genuine saves still load, experiment reproducibility, and hidden *gifted* food far away cannot influence decisions); they pass on both.

## Files touched
`dist/sim.js`, `dist/experiment.js`, `dist/app.js`, `dist/index.html`, `dist/style.css`, `tests/run-experiments.mjs`, new `tests/review.test.mjs`, new `REVIEW/`. Untouched: `docs/*`, `package.json`, `dist/sw.js`, `dist/experiment-worker.js`, `dist/manifest.json`, `dist/icon.svg`, `tests/sim.test.mjs`. Full unified diff: `REVIEW/island-review.diff`. The sources are single-line minified, so diff hunks are whole lines; the table above gives the exact fragments.

Not changed: the service-worker cache name (`island-model-v2`). It fetches from the network first, so updated files load when online. Bump it at integration if preferred.
