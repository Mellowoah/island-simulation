# Handoff — 0.1.2, 14 November 2026

**Status:** 0.2.0. Adds the Eden world at Robert's direction (`docs/EDEN-DESIGN.md`); the 0.1.3 critic responses are included. Awaiting Grok's review. Not complete; not tested on an iPhone; not independently validated.

## Run it
- `npm test`: 34 tests, all passing (11 original, 7 review regressions, 6 integration, 5 critic-response, 5 Eden).
- `npm run experiment`: about 3.5 min; writes `results/` (not committed; regenerate it).
- Browser: serve `dist/` with any static server (e.g. `python3 -m http.server -d dist 8000`). Reviewer browser scripts are in `REVIEW/tools/` (they need a local Playwright; they are not project dependencies).

## What changed
- 0.1.1 review fixes C1–C7: `REVIEW/CHANGELOG.md`.
- 0.1.2 decisions D1–D6: `docs/DECISIONS.md`.

## Checks run at handoff (Observed)
- 24/24 node tests.
- Browser (headless Chrome, emulated 390×844 touch, *not Safari*): earlier 28-check suite all pass; 0.1.2 restore/guard/lab checks 14/14.
- Experiments: all 7 variants completed. Alive, hunger and food outcomes are identical to 0.1.1; only the new reporting fields differ.

## Open questions for Grok (start here)
1. **Survivorship in recovery.** In the baseline pilot, berry-failure "recovers" in 12/20 runs while about 15 of 24 creatures die. Does the matched-control measure count deaths of the hungriest creatures as recovery? Propose a test or a correction that does not invent thresholds.
2. **Counterexamples to K1/P1.** Is there any path by which unobserved stock influences a decision (ordering, arbitration, cached paths, gift creation)?
3. **Tests that prove less than their names claim.** E.g. the original "unobserved food" test runs only one tick (K1 and P1 strengthen it).
4. Review D1–D6 and post `AGREE` or an objection with evidence in `CHANNEL.md` on `main`.

## Escalated to Robert
- **D5 calibration:** under current constants the information and access interventions barely change knowledge, because creatures find the second source within day 1 anyway, and the seeds give near-identical results. Should the experiment be recalibrated, and toward what question? This is a theory/scope choice, so it is not changed.
- **iPhone checks** (only Robert can run): 20-minute 30 FPS session, heat, battery; Safari touch, pinch and pan; offline reopen from the home screen; export/import with Files; the 20-seed lab on the phone.

## Unchanged
The main island and experiments are unchanged by Eden. No trust between creatures, teaching or testimony spreading. No dependencies added.
