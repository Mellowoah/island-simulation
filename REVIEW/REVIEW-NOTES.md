# Island 0.1.1 — review notes

Status: **review patch for integration. Not complete, not independently validated, not tested on an iPhone.**
Each item is labelled **Observed** (run and seen), **Inferred** (reasoned from code or data, not demonstrated), **Unrun**, or **Deferred**.

## 1. Inputs
- ZIP opened. All 14 files present; nothing referenced was missing (all `index.html`/`sw.js` assets exist). `docs/specification.md` and `docs/HANDOFF.md` read.
- Work was done on a separate copy. The original was kept unmodified for before/after comparison.
- Environment: Linux, Node v22.23.4, Google Chrome for Testing 153.0.8010.12 headless, Playwright 1.63.0 (reviewer tool only, not added to the project), Python 3.13 `http.server` on localhost.

## 2. Test commands and results

| Command | Code | Result |
|---|---|---|
| `npm test` | unpatched (baseline, before any change) | **11/11 pass** (`logs/baseline-npm-test.txt`) |
| `node --test tests/review.test.mjs` | unpatched + new tests | **3 pass, 4 fail** as expected: R1, R2, R3, R4 fail; R1b, R4b, K1 pass (`logs/review-tests-on-unpatched.txt`) |
| `npm test` | patched | **18/18 pass** (`logs/patched-npm-test.txt`) |
| `npm run experiment` | unpatched | **Completed**, exit 0, 3 min 9 s: all 7 variants (`logs/baseline-experiment-log.txt`) |
| `npm run experiment` | patched | **Completed**, exit 0, 3 min 10 s. Outcome rows byte-identical to unpatched in all 7 files; only `plan` gained `access`/`information` (`logs/patched-experiment-log.txt`) |
| `node REVIEW/tools/probes.mjs dist` | both | Reviewer probes (`logs/*-probes.txt`). P10 hardcodes the unpatched sprite formula; the browser check below verifies the patched sprites. |
| `node REVIEW/tools/browser-qa.mjs http://localhost:PORT label` (serve `dist/` with `python3 -m http.server PORT`) | both | Unpatched: 22 pass, 4 fail, 2 info. Patched: **27 pass, 0 fail**, 1 info (`logs/qa-*.txt`, `screenshots/`) |

Browser QA ran in an emulated 390×844 touch viewport, headless desktop Chrome, not Safari. It covers: autonomous progression; pause; 4×; tap-select while paused; inspector marking the selected option; 24 distinct portraits; food on land and refusal on water; crossing; reveal; save/load; export; malformed import; crash-save import; Eden paused; help text; lab single seed, Inspect and Return; lab 20-seed pilot in the worker (≈64 s); pause on hide; autosave written; offline reopen from the service-worker cache.

## 3. Trace: perception → memory → decision → action → consequence (Observed unless marked)
- **Perception.** `observe()` runs each tick before decisions and covers sources within Manhattan radius `perception` (4). It records the actual stock only for sources in range. Terrain is known by design (spec).
- **Memory.** `known[id] = {expected, last}`. Re-observation blends the estimate 0.65 old / 0.35 new. Gathering sets the estimate to the remaining stock, including after a failed (empty) gather.
- **Decision.** Options are rest, explore, and gather for each *known* reachable source. Scores use hunger, energy, the remembered estimate, route length and skill. Actual stock of unknown sources never enters a score (code reading plus P1 and K1). Emergency rest below energy 10 is flagged. The recorded inputs and options are logged before the action is set.
- **Inspector agreement.** P2 checked 3,977 decisions: 0 where the recorded selection was not the executed action or (scored policy) not the top score. The browser inspector marks the same option.
- **Hidden information.** P1: for 5 seeds, worlds differing only in root-garden stock have identical decisions and positions until someone first observes it. K1: the same holds for 200 gifted food placed far away.
- **Consequence.** Gathering removes real stock (at most 4 per completion), lowers hunger by 4 per unit and raises energy by 2 per unit. Skill rises only from non-gift gathering (spec assumption). Death comes after 300 ticks at hunger ≥ 99, with the cause and tick recorded.

## 4. Other areas reviewed
- **Accounting (Observed).** Over 20,000 ticks with gifts and source failure, the largest ledger error was 1.07e-9, with no negative or over-capacity stock and needs within 0–100 (P3). Saves with unreconciled ledgers are rejected.
- **Pathfinding (Observed).** 6,000 BFS routes: every step adjacent, every tile land, every route ends on its target. The crossing never lengthens a route (P4). The channel leaves land paths at the north and south, so the crossing shortens an existing route, as the spec requires.
- **Reproducibility (Observed).** Same-seed runs, mid-action save/restore, command replay and `runSeed` repeat are all identical. Randomness is a stateless hash of (seed, tick, id, salt), so branching cannot shift other streams. There is no separate generator state to store.
- **Learning (Observed).** With learning disabled, skill stays 0 and gathering continues. The existing test shows skill rises with experience; it does not show that skill changes *later outcomes*. Skill shortens gathering time by construction, but no fixture isolates that effect (spec gate partly covered).
- **Save/load.** Fixed C1. Malformed JSON is rejected without replacing the world (Observed in the browser).
- **Experiment controls.** Four branches; an unchanged and a berry-failure follow-up for each; continued-provision controls for B. Provision stops at day 10 in the non-continued follow-ups. Manifest drift fixed (C4).

## 5. Completed experiment results (descriptive only, from `npm run experiment`)
Full tables: `results/summary.json` and `logs/experiment-summary.txt`. These are model outputs under v2 calibration, not findings about assistance or hardship. Survivor medians are shown next to the alive counts so deaths stay visible; individual records are in the raw result files, which `npm run experiment` regenerates in about 3 minutes.

- **20-seed pilot, alive at day 15 (mean, min–max of 24):**
  - Every unchanged follow-up and every provision follow-up: 24 (24–24).
  - Berry-failure follow-up: baseline 9.35 (6–12), access 9.35 (7–12), information 9.75 (7–12).
  - No deaths occurred during training in any run.
- **Observed patterns that limit interpretation:**
  1. **Recovery measure does not discriminate.** All 200 pilot rows, unchanged controls included, are "Recovered after sampled worsening". Normal hunger fluctuation triggers it. (Inferred: a survivor-median measure can also "recover" because the hungriest creatures die; `recoveryAlive` partly exposes this.)
  2. **Provision leaves a stockpile.** At day 10 the provision branch holds about 1,300 food in total versus about 216 in baseline (seed 41 gift pile: 1,072). The "provision stopped" follow-ups therefore run on leftover gifts, so they do not isolate withdrawal of supply.
  3. **The information and access effects on knowledge vanish quickly.** In baseline, someone finds the root garden by tick 85–285, and recipient creature 0 finds it by tick 233–1,417 (within day 1). By day 15, every survivor in every branch knows both sources.
  4. **Low seed variance.** In the unchanged follow-ups, survivor median hunger is exactly 12.00 in all 80 runs (4 branches × 20 seeds). Mean skill is exactly 0.1700 on every seed for baseline, access and information (provision varies, 0.113–0.120). So 20 seeds carry less independent information than the count suggests.
  5. **Lower skill under provision (0.117 vs 0.170) is by construction**, because gifts do not train skill. It is an assumption, not a discovery.
  6. **Carrying capacity sits close to demand.** Total regeneration is about 490 food/day against about 432 needed. In the 0.8× regeneration variant, the baseline, access and information branches had deaths with no disturbance (unchanged-follow-up alive means 20.2–20.8). The provision branch stayed at 24.
- Robustness variants used 5 seeds each.
- **Deferred:** none of this is presented as support for or against any theory, and there is no combined score.

## 6. Unresolved issues (not fixed; integrator or Robert to decide)
1. **Autosave is written but never read (Observed).** Hiding the page writes `island-autosave`, but Load reads only `island-save`, and reopening always starts at seed 41, D1 00:00 (browser QA, info line). `island-before-reset` is also never readable. The fix needs a UX choice: auto-restore on open, a Load fallback, or a restore prompt.
2. **Inspecting an experiment branch makes it the current world (Inferred from code).** Pressing Save, or hiding the page, then stores that branch world. Save would overwrite the user's own island save. "Return" exists only in memory.
3. **Recovery measure and stockpile carry-over** (section 5, items 1–2): these are protocol definitions in the spec's domain, so they were not changed.
4. **Spec deviation (Observed):** the expectation-update rate (0.65/0.35) is hardcoded rather than configurable, and the reveal prior (60) is not in the config. Changing either affects save validation (all `DEFAULTS` keys are required), so this needs a config/version decision.
5. **Learning gate:** no fixture shows that skill changes later action outcomes, as opposed to the skill value itself.
6. **Usability (Observed in screenshots / Inferred):**
   - The selected creature's name label can cover a source label.
   - Stacked creatures can only be reached with the → button.
   - Pinch-zoom scales around the centre rather than the fingers.
   - Pan is unbounded (the fit button resets it).
   - The inspector only shows policy and emergency in text.
7. **Colour-vision distinctness (Inferred):** creatures now differ by 4 ear patterns as well as 6 colours, but two creatures with the same ears are told apart only by colour unless selected (name label). Whether that meets the spec's intent is Robert's call.
8. **Minor code notes:**
   - `{passive:false}` after `canvas.onwheel` is a no-op (harmless).
   - The lab "Inspect" button indexes rows by summary index, which is correct only for single-seed runs, where it is the only case shown.
   - `PLAN` is a mutable shared export.
   - `digest` hashes event text length only, and no gate uses it.
9. **Version labels:** `PLAN.version`, `VERSION` and "PROTOTYPE 0.1.1" are unchanged.

## 7. Requires Robert's actual iPhone (Unrun here)
- 30 FPS target over a 20-minute, 24-creature session at 1×; frame times, 4× speed achieved, heat, battery. Headless desktop Chrome showed about 60 FPS, which certifies nothing.
- Safari touch: tap-select accuracy at real finger size, two-finger pinch, pan, double-tap/zoom interference, dialog scrolling, safe-area insets in portrait.
- Safari `localStorage` and service-worker behaviour: offline reopen from the home-screen icon, storage eviction, export/download and file import from the Files app.
- The 20-seed lab in a Web Worker on the phone (about 64 s on desktop CPU): duration, heat, whether iOS suspends it when backgrounded.
- Touch-usability gate: Robert selects, explains a decision, applies each power and restores a save without help.

## 8. Unchanged and deferred
- Eden: still a paused script. "No one has eaten" was checked in the browser, and nothing assigns an action.
- Not implemented: trust, instruction-following, competing testimony, social transmission, or any other deferred system.
- No scores, constants or outcome rules were changed. Assistance and hardship have no built-in direction beyond the spec's existing assumption that gifts do not train skill (item 5.5).
- Current measures (alive, hunger, food) and capacity proxies (known sources, skill, post-disturbance survival) stay separate. Deaths stay in per-individual records.
