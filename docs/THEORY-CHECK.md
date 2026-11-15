# Theory check: Robert's statements → code → evidence

Purpose: stop drift. Each line is something Robert stated, how the model does it, and the test or run that shows it. Last checked: 0.2.1, 15 November 2026.

| # | Robert's statement | How the model does it | Evidence |
|---|---|---|---|
| 1 | "Warned in the beginning of their lives about not eating" | Every founder, and every child born before anyone eats, gets the Creator's instruction and `warning = 1` at birth | `eden.test` (born warned); `eden-family.test` (children born before release are warned) |
| 2 | "If they don't eat… I lead them in positive directions when their curiosity carries them outside of what is best" | Guided phase: the Creator overrides only choices outside what is best (hunger, tiredness, wandering beyond reach of food). Each override records the intended choice and a reason | `eden.test` (overrides recorded with reasons); browser check shows "This was not its own decision" |
| 3 | "In whole they are not making their own decision" | True **for each overridden decision**, and the share is reported (`guidedShare`). Choices inside the bounds are labelled their own. *The size of the share comes from the bounds (D12), not from evidence.* | 20-seed run: 13–84% overridden |
| 4 | "If they never eat, that's okay" | Nothing forces eating. In a guided world nobody dies, indefinitely. | 20 seeds × 20 days before reproduction: seed 42 never fell |
| 5 | The serpent hides in the tree and deceives one independent agent | The serpent speaks only within one tile of the tree, once per creature per year. Its claim is stored as a claim, never as knowledge. | `eden.test` (claim not in `known`) |
| 6 | Eating comes from "their own agency" (research theology + gaming) | Genesis 3:6 factors against the remembered warning; logistic weighted chance with the creature's own draw; every deliberation logged. Never certain either way. | `eden.test` (0 < P < 1; ate ⇔ draw < P; outcomes vary by seed) |
| 7 | "God releases man to their own devices", triggered by one agent eating; everyone released | The first eating moves the whole world to released; no override happens after that | `eden.test` (no guidance after release) |
| 8 | After release: death begins, they judge for themselves | Starvation can kill only after release. Self-judgement reinforces each creature's own preferences. | `eden.test` (judgements recorded); no deaths before release in every test |
| 9 | After release: "options for producing all necessary items… statistically possible, like creation theory" | Fields (one per adult; ~1.2× one adult's need, first harvest after half a year), clothing (stops exposure), tools. The ground yields 50% (Genesis 3:17–19). | `eden.test` (production and reconciled accounting) |
| 10 | Reproduction, "mathematically statistical and coherent" | 1 day = 1 year. Women 15–40, men 15+; 20% monthly chance of conception when fed and near a partner; 9-month gestation; 1.8 years of postpartum infertility; ~51% boys; children under 5 stay with a carer and share food; curiosity inherited (h² = 0.4); pain after release (Genesis 3:16). | `eden-family.test`: sexes, ages, spacing ≥ 2.55 years; mean birth interval 2.55–6 years; ledger. Six-seed 30-year run: mean interval 3.7–6.7 years (real natural fertility ≈ 3) |

## Drift caught and corrected
- **Fields were 4–5× too productive** (86 food a day against an adult need of 18), making life after the fall richer than the garden. That contradicts statements 8–9 and Genesis 3:17–19. Now ~22 a day.
- **Growth time ignored the 1 day = 1 year scale** (2 "years" to first harvest). Now half a year.
- **Babies could forage alone if orphaned.** They now stay with their father.
- **Births could overshoot the population cap.** Pregnancies in progress now count toward it.

## Built in by construction (do not report as findings)
- Guided creatures do well because death is off and an overseer that knows everything corrects them.
- Released creatures face hardship because Genesis 3 consequences are written in.
- Birth spacing matches the real figures because the real figures were put in.

## Coherence caveats (abstractions to keep in mind)
- **Two clocks.** Hunger, meals and movement run in minutes; ageing and births run on 1 day = 1 year. This keeps lifetimes visible in a session, but a "day" of meals is also a "year" of life.
- No ageing death yet. Lifespans in Genesis (900+ years) versus real ones (~70) is a choice for Robert.
- Population is capped at 96 for phone performance. The cap stops conception and is counted, never kills.

## Open decisions for Robert
1. The Creator does not block the tree or decide at it.
2. Guidance thresholds: hunger 30, energy 30, wandering 10 tiles.
3. Children aged 5 and over can meet the serpent and eat. Is there an age of accountability?
4. Children born after release are not warned (the tree no longer matters). Should they be told anything?
5. Ageing and lifespan (see above).
