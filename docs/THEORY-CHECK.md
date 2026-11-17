# Theory check: Robert's statements → code → evidence

Purpose: stop drift. Each line is something Robert stated, how the model does it, and the test or run that shows it. Last checked: 0.3.2 (salt registry is one table; released interrupts stay on memory), 15 November 2026.

| # | Robert's statement | How the model does it | Evidence |
|---|---|---|---|
| 1 | "Warned in the beginning of their lives about not eating" | Every founder, and every child born before anyone eats, gets the Creator's instruction and `warning = 1` at birth | `eden.test` (born warned); `eden-family.test` (children born before release are warned) |
| 2 | "If they don't eat… I lead them in positive directions when their curiosity carries them outside of what is best" | Guided phase: the Creator overrides only choices outside what is best (hunger, tiredness, wandering beyond reach of food). Each override records the intended choice and a reason | `eden.test` (overrides recorded with reasons); browser check shows "This was not its own decision" |
| 3 | "In whole they are not making their own decision" | True **for each overridden decision**, and the share is reported (`guidedShare`). Choices inside the bounds are labelled their own. *The size of the share comes from the bounds (D12), not from evidence.* | 20-seed run: 13–84% overridden |
| 4 | "If they never eat, that's okay" | Nothing forces any single choice. **But at the default settings a fall is certain:** belief in the serpent only rises, the warning never changes, the tree stands where they live, and hunger rises as the population grows. Death is switched off while guided, so nobody dies, **but they do starve**. | Observed on 0.3.1, seeds 41–60: 20/20 worlds fell within 10 years; while guided, 26.5% of creature-minutes after year 4 were at hunger ≥ 99 (`REVIEW/logs/v031-eden-fall-starvation.txt`). Confirms Edge's finding. |
| 5 | The serpent hides in the tree and deceives one independent agent | The serpent speaks only within one tile of the tree, once per creature per year. Island Lab setup input `serpentSilentYears` (default 0 = unchanged) keeps the serpent silent for the first N years so guidance length can be varied for P1/P2; no other rule changes (`lab16.test` G1, G2). Its claim is stored as a claim, never as knowledge. | `eden.test` (claim not in `known`) |
| 6 | Eating comes from "their own agency" (research theology + gaming) | Genesis 3:6 factors against the remembered warning; logistic weighted chance with the creature's own draw; every deliberation logged. Never certain either way. | `eden.test` (0 < P < 1; ate ⇔ draw < P; outcomes vary by seed) Each single choice is uncertain; whether *anyone ever* eats is not (row 4). |
| 7 | "God releases man to their own devices", triggered by one agent eating; everyone released | The first eating moves the whole world to released; no override happens after that | `eden.test` (no guidance after release) |
| 8 | After release: death begins, they judge for themselves | Starvation can kill only after release. Self-judgement reinforces each creature's own preferences. | `eden.test` (judgements recorded); no deaths before release in every test |
| 9 | After release: "options for producing all necessary items… statistically possible, like creation theory" | Fields (one per adult; ~1.2× one adult's need, first harvest after half a year), clothing (stops exposure), tools. The ground yields 50% (Genesis 3:17–19). | `eden.test` (production and reconciled accounting) |
| 11 | "Constraints and direction to maintain senses and life" | Sight shrinks with hunger, thirst, tiredness and harm (never below 1 tile). Water from the River of Eden (Genesis 2:10) and two springs. Thirst kills ~7× sooner than hunger, after release only. Health: injury and illness after release only; rest heals. | `eden-senses.test` (sight, ratio 5–9×); browser |
| 12 | The Creator leads "in positive directions" | The Creator steps in as soon as a need crosses its line, leading to the most urgent (water, then rest, then food), but **never overrules a choice that already meets a real need** | `eden-senses.test`; drift [2] |
| 13 | Before release, no harm | No injury, illness or death before release, even with no water at all | `eden-senses.test`; drift [4], [8] |
| 10 | Reproduction, "mathematically statistical and coherent" | 1 day = 1 year. Women 15–40, men 15+; 20% monthly chance of conception when fed and near a partner; 9-month gestation; 1.8 years of postpartum infertility; ~51% boys; children under 5 stay with a carer and share food; curiosity inherited (h² = 0.4); pain after release (Genesis 3:16). | `eden-family.test`: sexes, ages, spacing ≥ 2.55 years; mean birth interval 2.55–6 years; ledger. Six-seed 30-year run: mean interval 3.7–6.7 years (real natural fertility ≈ 3) |

## Drift caught and corrected
- **Released interrupt read live stock.** A hungry creature broke off its action when a source it remembered as empty actually held food. It now uses the remembered amount only (`streams.test` S3). The Creator, while guiding, still knows true stock.
- **Random draws shared salts.** The serpent's 77 sat inside the Creator's 70–87, and the Creator's 50–67 sat inside island explore 40–57. One table, `STREAMS`, gives each process its own range (`streams.test` S1, S2). Island salts were not moved.
- **Step 1, loop between creature and Creator:** a creature that was hungry and thirsty chose water, the Creator sent it to food, it chose water again, and so on (69,000 overrides; thirst never met). The Creator now accepts any choice that meets a real need.
- **Step 1, work lost on interruption:** urgent thirst broke off crafting, and the half-made garment vanished, so no one was ever clothed. Work is now kept and resumed.
- **Step 1, guided creatures half-blind:** they only reconsidered at the end of long trips, so thirst ran high and sight fell to ~1.9 tiles. Pressing needs now interrupt.
- **Fields were 4–5× too productive** (86 food a day against an adult need of 18), making life after the fall richer than the garden. That contradicts statements 8–9 and Genesis 3:17–19. Now ~22 a day.
- **Growth time ignored the 1 day = 1 year scale** (2 "years" to first harvest). Now half a year.
- **Babies could forage alone if orphaned.** They now stay with their father.
- **Births could overshoot the population cap.** Pregnancies in progress now count toward it.

## Built in by construction (do not report as findings)
- **The fall itself.** Certain at default settings (row 4). Only who eats and when is open.
- **"No one dies while guided."** A switch, not an achievement. Guided creatures can be starving.
- **The Creator knows true food stock and every spring.** Omniscient by design; creatures never do.
- **A thirsty creature heading to food counts as meeting a real need,** so the Creator does not redirect it to water.
- **Any single-setting result.** A result counts only when shown across a range of settings, including where it fails.
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

## Change on `claude/lab-features` (16 Nov 2026, awaiting Robert's say)
- **New Eden input `guidanceRate` (default 1 = original rule).** Below 1, the Creator steps in for a creature only in that share of months (one draw per creature per month, stream `guidanceLapse` 340). In a month without guidance the creature uses its own judgement, exactly as after release, but the warning still stands and nobody can die before the fall. Tests F1 (default unchanged, no new draw) and F2 (less guidance, eating still the creature's own draw).
- Why: the earlier "guidance length" input only silenced the serpent, so both matched worlds had the same fall. P1 and P2 are now judged by how often the Creator steps in.
- Not changed: the tree choice, the serpent, release, production, reproduction.

## One of many worlds: the way back and the demons (16 Nov 2026, awaiting Robert's say)
Robert, 15 Nov: "all those who choose to comply and realign or that obeyed will live in a world where the creator guides and feeds and brings peace"; "the deceiver should possess similar traits to satan in the Bible and ... have demons that seek his direction"; "Model the biblical interpretation; this is one of many worlds." All three inputs are **off by default**; with them off Eden is unchanged (test W1).
- **`restoration`** (T9). Everyone is still released by the first eating (T4 stands). Once a year the Creator calls each released adult. It answers by its own draw: need + the word − curiosity × belief in the deceiver's claim − `returnBar`, same logistic as at the tree. Those who turn back live in the same fallen world: the Creator leads them again, and gives bread or water before want can harm them (`provideAt`). They still work, age into the same world, and can be hurt.
- **`tempters`** (T11). Separate beings, not creatures. They start at the tree at the fall, walk to a creature and whisper the same lie. A whisper only raises that creature's belief in the claim (test W4: nothing else in the world changes). They go first for the restored.
- **`fallAgain`**. Whether a whisper can draw a restored creature away (its own draw, same weighing as at the tree). Traditions differ, so it is a setting.
- Built in, not findings: the restored cannot starve; the unrestored world has no restored.
- Assumptions for Robert: one call a year; `returnBar` 2.2 (about 5–10% say yes per call at defaults); provision at 79; demons seek the restored first; the deceiver does not learn.

## Natural drives (settings only)
Appetite, thirst, curiosity, desire for children, desire of the eyes, and how firmly the warning is held. Each rescales a number the sim already had; "Normal" is the original (test D1).

## Attribute system, layers of existence, and trait development (17 Nov 2026, branch `claude/attributes`, awaiting Robert's say)
Robert, 17 Nov: "creating a attribute system for humans as well as the different layers of the hierarchical existence system on earth"; "Trait should be influenced by the parents and then influence further by the parents throughout their interaction with the child and others, and that child's interaction with others and other things".
- **`dist/being.js`, read-only parts.** Layers of existence (matter, life, sense, reason, spirit; the Creator as source, not a layer), kinds (thing, plant, animal, human, spirit), and the human attribute catalogue by layer and channel, each marked active, recorded or planned. Seven temperament systems (Panksepp; frustration for rage): seeking is the existing curiosity; the other six are computed from the seed by curiosity's own rule (uniform for the first generation; mean + heritability × (midparent − mean) + noise for children), on new streams `temperament` 343–349. Reading them changes nothing (test A1).
- **`traitDevelopment` (Eden input, default off; test D2).** Every 10 ticks each living creature's seven traits move (1) toward those within 2 tiles, parents and children counting double; (2) with what it lived through: health lost raises fear, a parent or child dying raises grief, new food places raise seeking, a birth or being a fed young child raises care, being beside a non-kin peer raises play, high hunger with no known stocked food raises frustration; (3) slowly back toward its inborn value. Every step is scaled by plasticity (1 at birth, falling with age toward 0.15, τ = 8 years). No randomness. With it on, curiosity follows seeking, so it acts on choices; the other six are recorded only.
- **Parents pass on what they were born with.** `birth()` now inherits from the parents' inborn seeking when development is on (identical to before when off). What parents became reaches the child only by living near it (test D3).
- First look, seeds 61 and 62, 20 years: traits moved 5–14 points from birth on average; in 78–82% of trait comparisons the living child ended closer to its mother than it was born. Outcomes (year of fall, deaths, alive) were unchanged on both seeds, because curiosity enters the tree choice only through belief in the claim, which stays small. Built in: that young creatures move most (plasticity), and that children near their mothers converge (the pull rule). Open: what the traits then do, which needs phases 1–3.
- Assumptions for Robert: pull rate 0.003 per 10 ticks; kin weight 2; radius 2 tiles; experience push 0.06; nature's pull 0.0005; τ 8 years, floor 0.15.

## Body through the life course (17 Nov 2026, branch `claude/attributes`, awaiting Robert's say)
Robert, 17 Nov: "look at the biological makeup in the health and the reproductive and the eating and the sleeping … the different routines that are necessary at different parts of your life … things will develop within the system which will require different routines".
- **`lifeCourse` (Eden input, default off; test L1).** Nine stages from infant to elder (`being.js` LIFE_STAGES). Each stage sets:
  - **Food need** relative to an adult (Dietary Guidelines calorie needs by age: rise to the late teens, fall after 50): child 0.7, older child 0.9, adolescent 1.1, adult 1.0, middle age 0.9, elder 0.85. Thirst scales with food. Dependent children keep the existing childHunger 0.5.
  - **Sleep need** (CDC / AASM hours per 24 h): child 10.5, older child 10, adolescent 9, adult and older 7.5. Implemented as sleep pressure: energy drains while awake at a rate that, against the existing rest gain, makes the stage's sleep share the equilibrium share of time resting.
  - **Pregnancy:** +17% food in the second trimester, +22% in the third (+340 and +450 kcal/day on ~2,000).
  - **Healing** full to 30, then 1% slower per year, floor 40% (assumption). **Illness** while starving or parched ×1.3 under 12, ×1.5 from 65 (assumption).
  - **Dying of age:** Gompertz, doubling every 8 years, 5% a year at 70 (level is an assumption); checked monthly on stream `ageing` 350; **only after the fall** (no death in the garden, as before).
- **Routines are measured, not scripted:** each stage's share of time resting, gathering, travelling, exploring and working, recorded on the run (never the world) and reported.
- **The clock.** One sim day is a year; a tick is several hours of life. There is no night, and a meal lasts weeks of sim life. So daily routines cannot appear; what can is the share of life each stage spends on each activity. This is a limit of the compression, stated in every report.
- **First look (seeds 61–63, 30 years).** With the rules off, adults rest only 4–5% of the time: the old body barely tires, so sleep never mattered. With them on, rest shares came close to real sleep shares (adult 36% vs 31% target, child 47% vs 44%, adolescent 40% vs 37.5%). On seed 61 deaths rose from 24 to 40: less waking time means less time to find food. Old-age deaths were 0–1 per island, because founders start at 18 and runs are 30 years.
- Assumptions for Robert: no sex difference in food need yet (real adult men need ~20–30% more); no birth risk to mothers and no extra infant risk yet (hunter-gatherer data: ~23% die in the first year); end of fertility stays at 40, which matches the median age at last birth (40–41) in natural-fertility populations, not menopause (~50); healing and illness factors; 5% at 70.

## The deceiver can be switched off; Characters panel (17 Nov 2026, branch `claude/attributes`, awaiting Robert's say)
Robert, 17 Nov: "I wanna be able to turn the serpent off and then I wanna be able to see the attribute … click character and then I can see their attributes and their specific changes".
- **`serpent` (Eden input, default on = original; test S1).** Off: the serpent never appears or speaks. No one is tempted, so no one deliberates at the tree and there is no fall; the garden stays guided and protected. This is T3 (never eating is acceptable) made testable, and it isolates T4 (the fall comes through the deceiver's doubt).
- **Life record (measure only; test S2).** For every creature the run keeps a yearly snapshot (health, energy, hunger, thirst, belief in the claim, the word held, places known, skill, children, traits), its own memories as they happen (up to 150), and how it died. Kept on the run, never on the world; saved with the run.
- **Characters panel.** Pick any creature, living or dead, from a list; see its family, each attribute from first record to now with its change and a small line over its life, its story, and its full attribute catalogue. A creature chosen from the list stays chosen after it dies.
