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

## Swappable map, and Robert's principles for the savanna world (17 Nov 2026, branch `claude/attributes`)
- **Engine (test M1).** A world may name a registered map (`s.map = {id}`); every land check, path and explore target reads it. With no map named, the original 36×26 island is used exactly (all earlier tests unchanged). No change to Eden's rules.
- **Robert's principles, 17 Nov, for everything that follows:**
  1. "The tree … possesses … all knowledge … they have access to all knowledge, but it doesn't need to mean that they were born with it … built with the ability to understand, judge and apply it once they experience it." Knowledge comes only by experience, in every world.
  2. "Discovery only, what makes sense in what we believe to be true of early humans." Fire and sharp stone are discovered from natural sources, not given; uses evolve with experience and are shared.
  3. "Make sure that they make sense from a physics standpoint, a mathematical standpoint, so the ratios … you need scarcity because that's natural." One currency (calories), real return rates, real land area and needs; scarcity follows from the arithmetic, never from a tuning knob.
  4. "All things should have a natural decay … influenced by their decisions, health and the risk." Food spoils, tools wear, fires die without fuel, unused skill fades, bodies age; half-lives from real rates where they exist.
  5. "Consider decision points that would need to be made daily and how they would evolve … based on where they are in their lives." Choices open to a creature depend on its life stage.
  6. The unfallen garden with the deceiver off: families fill the earth (Gen 1:28) into the same savanna, still guided, no death, no curse. A third case beside the fallen world and the world without God.
  7. The lab brief's limits (no crafting, no technology) no longer bind this work (Robert, 17 Nov).

## Savanna world, first build (17 Nov 2026, work in progress, not playable yet)
- `dist/savanna.js`: 80×56 map (351 km² of land at 350 m a tile), lake, river, rocks, shore, woodland, grassland; seven foods with season curves, rain response and natural decay half-lives; 13 water points (lake and springs permanent; river, pools and pans seasonal); yearly rain lognormal (sd 0.4, mean normalised to 1) times a 40-year swing; severe droughts (rain < 60%) about one year in six. Food is set so the land feeds DENSITY × area = 84 people in an ordinary year (Hadza 0.24/km²). Stream `climate` 351.
- Eden input `god: false` puts 24 people by the lake with no Creator, word, tree, deceiver or spirits; `ground` natural or cursed.
- **First test failed on physics:** on seeds 61 and 62, 29–31 of 31–34 deaths were thirst. Cause: the body and walking rates were calibrated for Eden's compressed clock (about 60 m an hour of walking; weeks between drinks), which does not match a map with real distances and seasonal water. Proposed fix, awaiting Robert: run the savanna on a real clock (four 6-hour ticks a day, day and night) with walking, eating, drinking and sleep at real rates.

## One clock, matched rates, one law of energy (17 Nov 2026, branch `claude/clock`, awaiting Robert's say)
Robert, 17 Nov: "Everything should get a consistent internal synced clock." "Make sure decay matches appropriately that in growth and advancement or anything else that is conditioned upon one another." "Be sure that distance covered and energy used makes sense … some universal law of energy consumption … babies would need a lot of energy … moms would need energy to take care of the kids." "Any other universal laws we can apply." "Systematically apply these for what is most important to the simulation from start to finish." "Assure there's no drift."
- **The clock (`dist/clock.js`).** One tick is one hour. 24 a day, 365 days a year, tick 0 is 06:00 on 1 November (the first rains). Day and night at the equator (sunrise 06:30, sunset 18:30). Foragers fall asleep about 3.3 h after sunset and wake before sunrise (Yetish et al. 2015). Eden input `clock`: `'real'` (new default) or `'legacy'` (the old compressed clock, kept so every earlier result can be reproduced; every older test pins it).
- **Each hour is spent in full (`actReal`).** An hour can hold several things (arrive, gather, eat, decide again). Without this, what a creature did in a day depended on the tick length (at 2-hour ticks people walked 6 km a day, at 30-minute ticks 18). Now 30-, 60- and 120-minute ticks give the same day (test K11: about 22 km, 6.4 h travelling, 4 h gathering, 11.5 h resting at every tick length).
- **One register of rates (`RATES`)**, each with a value, a low and high for sweeps, and its source; every per-tick number is worked out from it (test K2). Sources: Pontzer et al. 2012 (Hadza energy), Yetish et al. 2015 (sleep), Bastien et al. 2005 (walking), survival without food and water, Gurven 2007 (accidents), Newell and Rosenbloom 1981 (practice), Ebbinghaus / Wixted and Ebbesen 1991 (forgetting). Values marked "assumption" are the first to sweep.
- **The pairs (`PAIRS`), each tested.** Sleep against waking and walking nets to zero on a normal day (K3). Eating fills the short-term store, then fat at 80% efficiency; need draws the same stores down; a starving body slows to 75% (K6). Water is lost with the energy burned (1.2 ml per kcal) and made up by drinking (K6). Food grows and rots: a patch left alone settles where growth equals decay (K7); the garden groves keep their old capacity as that level. Skill rises by the power law of practice and fades on the forgetting curve, and practice resumes from what was kept (K8). Learned likes and dislikes fade (half-life a year). Trait development scales with the clock so a year changes the same on any tick.
- **Conservation.** Every kcal eaten is burned, stored or lost (heat in making fat, or not absorbed when fat is full) (K9). Every unit of food is eaten, rots, or is still there (K10); the drift check now books rotted food.
- **The law of energy (`dist/energy.js`).** Mass by age and sex (Hadza adults 46 and 51.3 kg, Blurton Jones 2016). Resting burn by the measured human equations (Schofield, used by FAO/WHO/UNU); Kleiber's universal law is reported beside it because it reads children about a third low. Activity level by age; growth costs 35% of a newborn's energy, falling to nothing by the late teens; pregnancy +85/+285/+475 kcal by trimester; a nursing mother makes her baby's milk at 80% efficiency (milk only to 6 months, gone by 2.5 years) and its water; walking costs by the mass moved (body plus carried child, Bastien), more per kg for small bodies (Taylor 1982), and small bodies walk slower (Froude). Fat by age and sex. **Check, no tuning:** the model's daily need is within 13% of FAO/WHO/UNU at every age tested, and within 12% of the Hadza measurements (K4). **Emerged, not written in:** without food a woman lasts 56 days, a man 33, a 5-year-old 22; without water an adult about 3 days, a child about 1.5 (K6; real ranges 30–70 and 3–5).
- **Bodies on the real clock** (`dist/body.js`): a carer feels its young's hunger and thirst as its own, forages for them and takes them to water; children get food for growth (fat) before the forager eats beyond need; nursing babies put on fat when their mothers are fed. Drive settings (appetite, thirst) change how soon a need is felt, never the energy or water used (K12).
- **Bug found and fixed on the way:** walking many tiles in one tick drew the same random number for every tile, so one unlucky hour meant falling on every step (fatal). Now one draw a tick for the chance of at least one fall.
- **Savanna, first result on the real clock** (seeds 61, 62; 5 years): no more thirst wipe-out (before: 29–31 of 31–34 deaths were thirst). People live; 16–19 babies born. **But** children of about 2.5 years (just weaned) and some adults die in lean seasons with hunger high most of the last month, although the land is set to feed about 84 people and the band is about 30.
- **Failing check, kept visible (K13, a to-do):** adults walk about 20 km a day; Hadza women walk about 6 and men 11. Both this and the lean-season deaths point at the same thing: each person still forages alone, keeps going back to food and water, and nobody shares at camp. That is the next stage (daily decisions by life stage, a camp, sharing by Hamilton's rule), not something to tune away here.
- **Not yet on the real clock:** the original Moving Bar island (`sim.js` step) and the Lab island (`lab.js`). They still run on their own minute clock. Next, after the daily-decision stage, unless Robert wants them first.
- Speed: about 1.3 s a simulated year in the garden and 5–6 s on the savanna on this machine (the old clock: 0.2 s). Routing now uses distance fields on the real clock (legacy worlds keep their paths exactly).

## The small world (17 Nov 2026, branch `claude/clock`, awaiting Robert's say)
Robert, 17 Nov: "Something doesn't feel quite right, I think you're holding on too tight to some parameters." "I want a small little operable world that's similar to ours that's simulated." "The size to be comparable to how people lived … land that's discoverable that's blacked out until it's discovered by an inhabitant." "Make the island bigger, even if I have to scroll … more of an island look."
- **What I was holding too tight:** the old island's hand-set decision weights inside a real-world body, one set of values for everyone, everyone 18 at one lake, and old structures kept alive for old results. The small world drops all four. The old islands and Eden stay as they are, frozen, for their results.
- **The land (`dist/terrain.js`).** 160×112 tiles at 350 m (56×39 km), about 850 km² of main island plus islets, the same every run. Made by layered value noise with a domain warp and a central rise (ragged coast, bays, headlands); hills on the high ground; one lake in the lowest inland basin; rivers from the hills down a hollow-filled surface (priority-flood, Barnes et al. 2014) to the lake or sea; woodland along water; grass elsewhere. Food places by habitat on a jittered grid, sized so the island feeds about 200 people at the Hadza density (0.24/km²); every food has a half-life and a patch settles where growth equals decay. Water: lakeshore and hill springs never fail; rivers, pools and rain pans follow season and rain.
- **The people (`dist/world.js`).** Six families of mixed ages (couples, children at real spacing and survival, some grandparents), about 25–30 people. Each person varies around the measured values: body mass (sd 8%), body fat (sd 20%), resting burn (sd 5%), walking speed (sd 7%), sleep 5.7–7.1 h (Yetish), and four temperament traits; children take after both parents (heritability 0.4) with their own variation.
- **Choices by real trade-offs, not set weights.** Food trips are valued by net kcal per hour of the whole trip after the energy of walking, against what the household is short of; an adult who goes out brings a full load (central-place foraging, load-size theory); children range near camp. Water by thirst of self and carried young against distance; sleep by night; rest by tiredness; exploring by curiosity, worth more when what is known is poor or far. The choice is probabilistic (softmax, bounded rationality). Expected food at a remembered place recovers toward its usual level at that food's regrowth rate and follows its season.
- **Camp and sharing.** Food is carried home to the household. Several times a day, food beyond what a household needs to eat now goes to households whose members are hungry or thin, kin first (Hamilton's rule, r × benefit > cost, with a floor of 1/4 for campmates). In the evening, people tell their household everything they know about places, and tell up to three others, more if sociable. The band moves camp when another lasting water has clearly more food known around it, or sooner when people are getting thin or walking long days.
- **Life and death.** Pairing between unrelated adults; conception by fecundability, held back while nursing and when the woman is thin; 1.2% risk to the mother at each birth. Deaths from the body (starving, thirst, injury and illness from deprivation) and, for disease and old age that the sim does not model in detail, the measured hunter-gatherer age pattern (Siler, Hadza fit, Gurven and Kaplan 2007) at the ~79% share of deaths those causes make up.
- **Fog of war.** At the start everyone knows only about 4 km around the first camp. A tile is uncovered when someone sees it (farther on open and high ground, less in woodland, almost nothing at night); the world keeps who first saw each tile and when. Each person knows only what they have seen or been told.
- **Checks (tests/world.test.mjs).** Island shape and rivers (Y1); families and variation (Y2); fog and personal knowledge (Y3); a settled forager day: 5–15 km and 3–6 h of gathering (Y4, measured in year 2, after the band knows its land; in the first weeks on unknown land, 20 km days are common); food and energy books balance, including milk and food spoiled at camp (Y5); same seed, same history (Y6). **Visible to-do (Y4b):** women walk about 9 km a day against about 6 for Hadza women, because there is no hunting yet and so no division of labour.
- **First runs, 10 years, seeds 41–43.** Seeds 41 and 42 grow slowly (25→28, 25→33), about what hunter-gatherer growth looks like (near zero over the long run). Seed 43 grows to 33 and then loses about half in a drought year (rain at 53% of normal): famine, then thirst among young children whose mothers could no longer make milk. Not tuned away; droughts every few years are part of the climate (CLIMATE in savanna.js).
- **Not yet:** hunting and the division of labour; fire and tools by discovery; predators; bands splitting and moving on; Eden and the deceiver as layers on this same world. The Lab app does not show this world yet; it has its own page (`dist/world.html`).

## Long runs: audit and first results (17 Nov 2026, branch `claude/clock`)
Robert, 17 Nov: "We need to elongate the simulation. It looks like it's confined within 30 years. Review the code, make sure that we audited it, then return to me with three use cases."
- **The 30-year limit** was the Island Lab's run-length setting (max 30, mislabelled "days"). Eden now runs 2–500 years; the Lab island keeps 30 days.
- **Long-horizon defects found and fixed in the small world:** person ids stored in 16 bits (overflow at 32,767); the dead kept their maps (about 18 KB each); hourly loops walked the dead; the population cap was not enforced; the "how far people walk" measure went negative when people died; exploring was made more attractive by long walking days, which exploring itself caused (a feedback loop; now it follows how far food trips have to go); thirsty people far from camp did not think of going home to the camp's water; a band move did not tell everyone where the new camp was.
- **Two gaps that long runs exposed, fixed with real practices:** food reached a hungry family only through the household pool and a sharing rule, so whole families starved while the band was fat. Now anyone still hungry at camp asks other families, kin first, who give what they do not need to eat now (demand sharing, as among the Hadza). Children left without a grown-up in their home are taken in by their closest kin with one, or any family.
- **First long results** (`tools/run-world.mjs`, 30–100 years, seeds 41–43): bands of 10–35 people, five to seven generations in a century, the whole island known within a few decades. Population does not grow over the long run, about what prehistory looks like, but the reason here is repeated crashes in droughts (rain 28–55% of normal) rather than a steady balance: in the worst drought on seed 43 the band fell from 28 to 13 in four months, with people walking 25 km a day between a hill spring and food. Starvation, thirst and injury-with-illness together are still about half of all deaths; among real hunter-gatherers illness is about 70% and starvation a small share. **This is the clearest failure of the small world today.** Likely causes: one band on one camp cannot spread out in a drought, people carry no water, and the choice rules still have no sense of risk or of planning ahead. The next stage (motives, risk by the energy budget rule, learning) and band fission are aimed at it; the check will say whether they fix it.

## Bands, beliefs, chance and odds (17 Nov 2026)

- People now act on beliefs learned from what they saw or were told, not on the true stock of a place.
- Three bands with marriage across bands, family moves, splits over 50 and joins under 8.
- Sharing, talk, camp moves, band changes and adoption are chances that depend on kinship, temperament, hunger and past reciprocity.
- Daily alarms for impossible states; tests require none.
- Odds over 8 islands × 30 years (tools/odds.mjs): no island died out, but people fell to a median of 18; starvation 29% and thirst 25% of deaths against a small share in real foragers; ages 1–5 and 20–50 die 6–10× the Hadza rate. Open failure: fix by causes before adding anything new.
- Still-known leaks: routes and trip times use land nobody has seen.

## Causes of hunger and thirst found and fixed (17 Nov 2026)

Every death on 4 islands × 20 years was logged with its context (tools/diag-deaths.mjs, tools/diag-walks.mjs). Fixes are to causes, not rates:

- **Routes over unseen land.** People planned perfect routes through land they had never seen (55% unseen on long-walk days). Now they route over known land as it is and assume unseen land is passable, heading roughly straight; when they meet a lake, sea or river they see it and find another way. Long days rose from 10 to 17 in 8 years (about 2 a year, one-offs): the cost of guessing.
- **Gathering paid only at the end.** Food was credited only when a gathering bout finished; any interruption (a child's thirst, nightfall, a camp move) lost all of it. A lone father gathered 7–9 hours a day for weeks and got nothing. Now the hours spent yield their share.
- **Carers who were not parents.** When a toddler's parents died, a relative became its carer but only parents could feed and water their own young, so the child died of thirst beside water. Now a carer looks after whoever is in their care.
- **Families with no food never asked.** Demand sharing stopped before asking when a family's own store was empty. Now a hungry or starving person asks the other families of the camp, and a visibly starving asker is rarely refused (weight approx.).
- **No drive to stay alive.** Tiredness could outweigh hunger to the death. Now, as body fat falls below 40% of its most (one's own or a child's in one's care), getting food overrides rest and comfort, and with nothing worth going for nearby people go looking for new food.

Result on 4 islands × 20 years: hunger and thirst fell from 57% to 43% of deaths; illness is now the largest cause. What remains comes mainly in drought years and in large bands (35+), i.e. scarcity and crowding.

## Animals, stone, fire, cooking, know-how and the inner voice (17 Nov 2026)

Integrated nature.js into the small world. Nothing here says who does what; results come from the laws of the things involved and from what people learn.

- **Animals**: six species with densities from field counts and logistic growth by body size (Fenchel 1974). Groups are met at the standard random-search encounter rate. A small share of natural deaths (CARCASS_FOUND = 5%, approx.; sweep) leave meat a person can reach for about a day; vultures make them visible from about 3 km.
- **Hunting**: chosen from what each person expects it to return (their own record, the most experienced teller's record, and a modest guess for the untried), plus motives: survival (the drive), success (ambition: meat is shared and brings standing; Hawkes), against caution. Getting within reach falls with the animal's flight distance (reach/flight, changed from its square root, which let spears approach impala too easily). Stalking is slow (0.3 of walking pace), at most 6 hours.
  - Check: large kills per 6-hour hunter-day 0–0.019 on three islands over 8 years, against 0.01–0.03 for Hadza with bows (no bows here: should not beat them). Pass.
  - Emerged, not set: men hunt 1.6–3× the hours women do (stalking with an infant is harder).
  - Open: meat is about 3% of food against roughly 30% for the Hadza. The gap is bows and poison, which the laws do not yet allow.
- **Stone and wood**: people pick up what lies to hand (a chance, more for the curious). Trying things combines two held things with an action at random. The laws decide: a hard stone struck on flint gives a flake; a sharp edge cuts a stick to a point; dry wood rubbed on dry wood can give an ember, wet wood never. Flakes and spears appeared on every island, at different times.
- **Know-how**: a recipe is known while its skill lasts (unused skills fade by the power law). It is shown to others in the evening by chance and lost with the last person who knows it.
- **Fire**: lit from an ember caught in dry grass, or carried as a burning stick from a lightning grass fire. It burns about 1 kg of wood an hour by day and smoulders at night (banked; approx.), is fed by people at camp when dead wood is within about a kilometre, and the rain can put it out. Fires were lit on every island but often went out.
- **Cooking**: found by chance by someone tending a fire, then shown to others. Eating at camp with a fire gives +15% energy (assumption; Carmody et al. 2011 give the direction only; sweep 5–30%). The gain is booked in the kcal ledger.
- **Boom and bust found and fixed**: on one island a spear and a few lucky kills spread high hopes and almost everyone took up hunting, and the island fell to 20 people. Causes: hunting hours were not recorded when a trip was cut short (hopes never fell); approach was too easy; hunting days reached 60 km. All three fixed. Three islands are now stable.
- **Inner voice**: each choice now carries its motives in words (survival, pleasure, success, risk), shown on the phone page.
- **Ledgers**: kcal gathered from plants plus meat taken plus cooking gain = eaten + carried + at camp + spoiled; carcass kcal made = taken + rotted + lying. Both are checked daily (alarms) and in tests.

## Start knowledge and the start screen (17 Nov 2026)

- Robert noticed a pointed stick in the first weeks. On a blank slate a first try succeeded too often (a flake 1 time in 4). First-try chances are now in one place (nature.js FIRST: flake 5%, rough edge 3%, point 10%, ember 0.5%; approx., to sweep), rising with practice. On seed 1 the first flake now comes at about day 53 (was 18), the first spear at about day 126 (was 24). How soon is still a judgement: with about 50 people each trying things for an hour on idle days, rare first successes add up.
- Start knowledge is a setting: 'none' (a blank slate) or 'basic' (about half the grown-ups of 25 and over know how to knap flint, point a stick, make fire and cook, and carry a flake, a stick and dry grass; some a spear).
- The phone page now opens on a start screen: island seed, bands, families per band, start knowledge, run length, speed. The settings live in the address, so a run can be repeated exactly. Climate is not a setting; it comes from the island's own climate model.

## Daily walking limit and balance after the new features (17 Nov 2026)

- Days over 40 km rose to 933 in 80 island-years after meat came in: mainly carcass trips of up to 30 km on top of a day's foraging, with 19 people doing it 3+ times. People now know how far they have walked today and do not set out on a trip that would take the day past 35 km (DAY_KM_MAX, approx.; Hadza day ranges average 6–11 km and rarely pass 30). Going home or to water is always allowed. Result: about 6 long days a year across an island, mostly water in drought, exploring and getting home; no person 3+ times in most runs.
- Odds, 4 islands × 20 years: none died out; 55 alive at the end (was 18); 0 alarms. Deaths: illness 39%, starvation 25%, injury 20%, thirst 13%. Infant deaths match the Hadza (0.205 against 0.235 a year). Still too high: ages 5–10 (0.070 against 0.011), and adults 20–40 (4–5×), mostly from the sim's own hunger and thirst. Next to trace: children of 5–14 feeding themselves.

## Build plan step 1: chance keys (17 Nov 2026)

Eleven pairs of chance draws shared a key because offsets (`SALT.band + 1`) ran into other keys: e.g. accepting a gift used band moves' key, family moves used adoption's, a hunter's chance to hit used the key for fire. Every key is now named once in `dist/streams.js` (new block `worldMore` 440–479, clear of the Lab block 400–438 in `sim.js` STREAMS); importing it throws on a repeat or a key outside the world blocks. The drift check (R1, R2) fails on a repeat or any bare offset. Test Y12: draws under two keys are uncorrelated (|r| < 0.01 over 100,000). Histories change once (the draws that collided now differ).

## Build plan step 2: one register (17 Nov 2026)

35 numbers that lived in the small world's rules are now in the register (`RATES` in `dist/clock.js`) with value, range, unit and source or "assumption": the 35 km day, the survival-drive threshold, the five motive weights (survival, rest against hunger, seeking, ambition, caution), the six sharing weights, hunting hopes, stalking pace and bout length, meat load, findable carcasses, pickup and showing chances, the four first-try chances, fire burn, banking, tending and rain-out, cooking gain and finding. The code reads them with `R('name')`, so any of them can be swept. `tools/sweep.mjs <name> [islands] [years] [steps]` runs one across its range on paired seeds. The chance-key block moved to 440–479 to stay clear of the Lab's 400–438 (test L10).

Still to do for "no bare number in a rule": species traits and fire values in nature.js are sourced in place (SPECIES, MATERIAL), and a few structural constants (child trip ranges by age, the 0.3 weight of heard hunting records) remain in code; they move with the split (step 3).

## Build plan step 3: the world file split (17 Nov 2026)

`dist/world.js` (1,030 lines) is now ten files by subject: `w-core` (settings, chance, shared lists), `w-food` (plants, seeing, beliefs, gathering), `w-people` (bodies, the start, births, deaths, orphans), `w-mind` (options, inner voice, choosing), `w-move` (the hour's acts, walking, guessed routes), `w-meat` (hunting, scavenging), `w-craft` (things, know-how, fire, cooking), `w-social` (feeding, sharing, talk, camps, bands), `w-checks` (alarms, life table, measures), and a thin `world.js` (making a world, the hour). Each file imports by name exactly what it uses from the others (generated and checked mechanically).

Proof nothing changed: `tools/fingerprint.mjs 120 1,2` (every person's state and every book after 120 days on two islands) gives the same hash before and after: 10f065b2a05f45fa. All 137 tests pass; drift check passes (R2 now scans every w-*.js).

## Build plan step 4: weather and water (18 Nov 2026)

`dist/weather.js` is now the single source for the sky in the small world. Daily wet or dry by a two-state Markov chain (Richardson 1981) with month odds for the bimodal Eyasi rains; gamma amounts (shape 0.8); the year's swing from rainOf, damped (yearSwingWeight 0.6); temperature by season, cooler on wet days; Hargreaves-type potential evaporation; a soil bucket (Manabe 1969, 150 mm); water holes as stores (catchment in, evaporation out, spill when full; lakes and springs lasting); moon phase and night light; a tide function for coasts. Everything reads it: plants grow by the last 12 months' rain (droughts carry over) and regrow slower when picked below half their natural level; herds' carrying capacity follows the 12-month rain; dead wood's moisture decides whether a fire drill can raise an ember; grass fires need cured grass and burn more after wet years; water loss rises in heat; camp food and carcasses spoil faster when warm (Q10 2.5).

Checks (tools/weather-check.mjs, test Y13): wet-day share by month within 0.01-0.02 of target; annual rain 574-604 mm (expected 583), year-to-year variation 31-33%, years under 60% of normal 6-8%; seasonal rivers dry in the late dry season of ordinary years; pans dry most of Jul-Oct; water books balance to 1e-6 mm (also a daily alarm).

Effects on the people (4 islands x 20 years): 0 alarms after three fixes found by tracing (lasting water learned from June sightings; stalking distance per time slice; exploring that ignored the walk back). Hunger and thirst deaths rose (anomaly A7); adults' day range 4.6 km against the Hadza 5-15 (A6). Both are logged, not tuned; Y4 now averages four islands.

## Idea 1 of 10: one temperature law (18 Nov 2026)

Microbial spoilage now follows the Boltzmann-Arrhenius factor of the metabolic theory of ecology, exp(-E/k (1/T - 1/T_ref)), with activation energy E = 0.65 eV (register: activationEnergy, 0.5-0.8; Gillooly et al. 2001; Brown et al. 2004), replacing the separate Q10 number. It gives Q10 = 2.34 near 25 C, inside the familiar 2-3. The same function (weather.js `arrhenius`) is the one later microbial and ectotherm processes (infection, mosquitoes) must use. Not applied to people and mammals (they hold their own body temperature) or to plant growth (already shaped by season and rain; it would count heat twice). Test Y14. Checks: 139 tests pass, no drift, two islands x 5 years with 0 alarms and balanced books.

## Idea 2 of 10: maximum-entropy priors (18 Nov 2026)

Every register number now has the least-committal distribution its known facts allow (Jaynes 1957), from `priorOf(name)` in clock.js: fixed rules stay fixed (2); a number known only by its range is uniform on it (26), or uniform on the log scale when the range spans a factor of 4 or more (30); a measured value with a range gets the truncated exponential whose mean is the measured value (14). `tools/design.mjs` draws Latin-hypercube designs (McKay, Beckman and Conover 1979) from these priors for sensitivity analysis and the emulator. Test Y15 checks every prior, that samples stay in range, that measured means are kept, and that each stratum is used once. Behaviour of the world unchanged (the priors are read only by sweeps and designs). 140 tests pass, no drift.

## Idea 3 of 10: cross-entropy scoring (18 Nov 2026)

`dist/patterns.js` lists 15 real-world patterns with value, uncertainty and source, split into a calibration set (10, may be looked at while fixing; it honestly includes the ones already examined: day ranges, child deaths, meat share) and a held-out set (5, chosen before being looked at in the model: total fertility, birth interval, age at first birth, growth rate, camp moves). `tools/score.mjs [islands] [years] [--release]` runs islands and scores them by cross-entropy, the average -log p of each real value under the model's predictive distribution (synthetic likelihood, Wood 2010: normal with the islands' spread plus the measurement's), each pattern standardised by its own uncertainty so the score does not depend on units. Floor 0.92 nats (a perfect match); lower is better. Held-out scores are not printed without --release.

Baseline, 4 islands x 6 years, calibration set: 2.39 nats per pattern. Largest misses: meat share (z 2.6), men's day range (1.4), adult deaths 20-40 (-1.3), women's day range (-1.2). This is the measure every later change is judged by, and the proposed pre-registered measure for P1 against P2 (the difference in summed -log p is the log Bayes factor). Caveat: with few islands the islands' spread is itself uncertain; compare scores only on the same seeds and island counts. Test Y16 (exact case, unit-free, floor, held-out hidden). Also counted, without effect on the world: camp moves (s.campMoves).

## Idea 4 of 10: one learning engine for every creature (18 Nov 2026)

`dist/learning.js`: every creature learns by the same rule, the delta rule (Rescorla and Wagner 1972): an expectation moves toward what is seen by a share of the surprise. Minimising squared surprise is minimising cross-entropy under a normal error, the same objective the model is scored by. Creatures differ in capacity (LEARNERS): people average a place's level over their last 10 looks, move season shapes by 20% of the surprise, and learn recovery times on a log scale over up to 20 observations; herds share wariness of people in a place, raised by each chase (register wariAlarm 0.3) and fading over weeks (wariForgetDays 21; Stankowich 2008: flight distance rises with hunting pressure). Wariness lengthens flight distance by (1 + w), and hunters judge and attempt against it.

Part one moved people's existing learning onto the engine: fingerprint identical before and after (df586a243b45b1a4). Part two added herd wariness: 12 places held wariness after 5 years on island 1 (max 0.20); outcomes did not change there, because with about 35 attempts a year the same place is rarely chased twice within weeks. It will matter as hunting grows. Test Y17 (delta rule, alarm and fading, wary herds harder to approach). 142 tests pass, no drift, two islands x 5 years with 0 alarms.

## Idea 5 of 10: curiosity as the value of information (18 Nov 2026)

Exploring is now valued in the same currency as foraging (w-mind.js `exploreValue`): the food per hour of the trip that finding a better place is expected to add. Each person's expectation of unseen land comes from their own looks: places found per tile seen, starting from a hopeful guess (register exploreHopeTiles 200, divided by 0.5 + curiosity, so curiosity is now how hopeful someone is about the unknown, not a free weight). A new place is worth the expected improvement over the best place known (the standard expected-improvement formula for a normal spread like the places they know), used for voiHorizonHours (120); unseen land within reach and the walking cost enter directly. The hand-set explore weights (curiosity x energy x three terms, and wSeek) are gone; exploring gets the same urgency and survival terms as foraging.

Effects (paired seeds): cross-entropy 2.39 to 2.29 nats per pattern (4 islands x 6 years), with deaths at 1-5 and 20-40 moving toward the Hadza values. Island known after 3 years: island 1 0.97 to 0.76, island 2 0.87 to 0.90 (people explore when it pays, as foragers who know their range do; discovery slows on some islands). Long-walk days on island 2 rose from 38 to 68 in 5 years (no alarms). Test Y18. 143 tests pass, no drift.

## Idea 6 of 10: risk by Kelly's log rule with a survival cliff (18 Nov 2026)

A hunt is a gamble (usually nothing, sometimes a large haul). It is now valued at its certainty equivalent under the log value of what the household holds above its need (Kelly 1956), measured in days of need, with a survival cliff below zero (register riskDeathJump 3, riskDeathSlope 3; Stephens 1981, the energy-budget rule). Comfortable people value a long shot near its mean (1,668 of 1,800 kcal in the test case); people near their need value it far less (968). At the default settings the starving still prefer sure food (a short day is not death); within the register range (jump 6, slope 1) they turn bold (3,609 against 1,800), so Stephens' rule becomes a testable setting, not an assumption. Need and urgency are unchanged; only the risk of the gamble is new. Test Y19.

Found on checking: one alarm (61 km) on island 2: hunting grounds were not checked against the day's remaining walking, and on a day the camp moved overnight several hunters walked 20-28 km stalking and back. Hunting grounds now must fit there, the stalk and back; with none in reach, people stay at camp. After the fix: 0 alarms on two islands x 5 years; long-walk days on island 2 87 to 39.

Score (paired seeds, 4 islands x 6 years): 2.29 to 2.44 nats per pattern, worse. Hunting is valued more cautiously, so men walk less (men's day range was already short, A5). Reported, not tuned. 144 tests pass, no drift.

## Idea 7 — choice noise fitted by cross-entropy (18 Nov 2026)
Choice is McFadden random utility: Gumbel noise of scale T gives softmax with temperature T. T was a hand-set 0.05; it is now a register entry (choiceTemperature) fitted on the 10 calibration patterns only (held-out patterns untouched), 4 islands x 5 years, paired seeds:

| T | 0.02 | 0.05 | 0.075 | 0.1 | 0.13 | 0.2 |
|---|---|---|---|---|---|---|
| nats | 2.95 | 2.47 | 2.17 | 2.23 | 2.55 | 3.83 |

Parabola minimum 0.083 → 0.08 (range 0.06–0.11, within ~0.1 nat). Repeat with `node tools/fit.mjs choiceTemperature 0.02,0.05,0.075,0.1,0.13,0.2`.
Check found: more choice noise brought out a rare path — one 64 km day (a man walking home after a long hunt). Fix: a hard day limit (dayKmHard 45 km, assumption) past which a walker sleeps out and goes on next morning, as Hadza hunters do. The 60 km alarm is kept as a check. After the fix: 3 islands x 5 years, no alarms, books balance; score 2.30 nats (4x5). Test Y20.

## Idea 8 — active inference as a switchable decision model (18 Nov 2026)
Friston: choose by softmax over minus expected free energy, G = risk + ambiguity. Risk is taken as −u (each option's utility already stands for a log preference over outcomes); the new part is the expected information gain about the hidden state an option looks at: a food place's mean (0.5 ln((n+1)/n) nats after n looks, a first sighting worth aifPriorLooks), unseen land (one first look per place expected to be found), one's own hunting rate (one more look per day of hunting). Weighted in at aifEpistemicWeight per nat. Switched on with config.decision = 'activeInference'; off by default, and off changes nothing (fingerprint 4eb4d22739ca0b3e before and after). Weight 0 gives back expected utility exactly (test Y21).
Fit (4 islands x 5 years, seeds 1–4): weight 0 2.30, 0.25 2.05, 0.5 2.06, 1 2.36, 2 2.24 nats — bumpy, so noisy; minimum about 0.36 → 0.35. Out of sample (seeds 11–14): expected utility 2.25, active inference 2.16. A real but small gain (about 0.1 nat; the in-sample 0.25 was partly the fit chasing noise).
Check found: island 2 under active inference had 4 thirst deaths over 5 years (none under expected utility): the pull to learn draws people further from water. Kept as a result, not tuned away. Which model is the default is Robert's call.

## Idea 9 — news as a noisy channel with trust (18 Nov 2026)
Before: news of a food place was copied exactly from teller to hearer, however many times it had been passed on. Now each retelling multiplies the amount by a log-normal error, sd newsBlurPerHop (0.3, assumption; serial reproduction drifts, Bartlett 1932), and the hops are counted. The hearer weighs news by trust in the teller, a Beta(2,1) prior updated by checks: on their next own look at the place, the teller was right if within a factor of two. Measured in bits: the information the heard amount carries about what is really there, -0.5 log2(1 - r^2) on logs (Shannon's Gaussian channel), plus the share right.
Island 1, 2 years: 45,000 checks, 2.3 bits, 92% right within a factor of two, news on average 1.9 retellings old; trust settles high (about 0.9) because most news is from close kin who looked recently.
Score (4 islands x 5 years): perfect copying 2.30; blur 0.1 2.23, 0.3 2.12, 0.6 2.22 (flat within noise; 0.3 kept). Fresh islands 11–14: 2.25 → 2.18. 3 islands x 5 years: no alarms, books balance; no hunger or thirst deaths on these three (before: 1 and 0). Fingerprint changes (expected: behaviour changed). Test Y22. Water news is still copied exactly (a later step if wanted).

## Idea 10 — Price equation tool (18 Nov 2026)
dist/price.js and tools/price.mjs. Price (1970): w̄Δz̄ = Cov(w,z) + E(wΔz), selection plus transmission, an identity. Parents = adults alive after year 1; w = children born afterwards (each child once per parent); z' = their mean trait. Traits: the five mind traits and four body factors. Identity holds to 1e-16 on every trait (test Y23). No model behaviour changed.
First result, 4 islands x 8 years: no trait shows selection beyond island-to-island noise (largest |selection| 0.005, sd 0.008–0.02); one generation in 7 years is too short. Transmission is the larger term, and for body mass and fat it has a steady sign: parents' mean mass factor is 0.975–0.992 and children's is higher (+0.014 ± 0.004); fat the reverse. Cause: drawFactors pulls a child toward the fixed founding mean (1, or 0.5 for mind), not toward the parents' population, so the transmission term undoes any selection. Logged as anomaly A8. Whether to change inheritance is a modelling decision for Robert.

## Inheritance fixed (A8), approved by Robert 18 Nov 2026
drawFactors now uses standard quantitative genetics (Falconer and Mackay 1996): each trait has a breeding value g and a phenotype P = g + environment; heritability = h2 = Var(g)/Var(P) = 0.4. Child g = midparent g + Mendelian noise of variance h2 Var(P)/2; child P = g + environment of variance (1 − h2) Var(P). Founders keep their old phenotypes exactly; their g is drawn given P. Nothing pulls children back to the founders' mean.
Checks (2,000 per generation, 9 generations, /tmp/inh.mjs; test Y24): child-on-midparent slope 0.31–0.42 around h2 = 0.4; Var(g)/Var(P) stays 0.38–0.42; trait sd stays 0.08. Breeding the more curious half once: predicted response h2 × S = 0.4 × 0.144 = 0.057; seen 0.494 → 0.554, and it stayed (0.545–0.556 for five more generations). Before the fix it would have drifted back.
World: 2 islands x 5 years, no alarms, books balance. Price tool: mass transmission +0.009 ± 0.016 (was +0.014 ± 0.004, a steady pull-back); no trait now has a steady transmission sign. Score 1.97 nats (4x5; was 2.12, but founding children differ now, so part of that is a different draw). 149 tests pass.

## Wiring audit (18 Nov 2026, asked by Robert: "are all pieces connected appropriately")
Scripted checks over every module: register names read vs defined; settings read vs defaults; chance keys used vs named; exports never used; person fields read but never written; two-way imports; twin functions in Eden and the world; the page's module graph vs what the page serves.
Fixed now:
1. The world page was serving the idea-6 code. Since idea 7 the changed files had been published under dist/ while the page loads them from its top level; ideas 7, 8, 9 and the inheritance fix never reached the page. Republished at the right paths, wrong copies removed. tools/page-files.mjs now lists the page's files with hashes (run before each publish); test Y25 fails if the page imports a missing file.
2. Heat did nothing in the world: heatFactor was wired into Eden's loseWater (body.js) but the world has its own (w-people.js). Now both. Heat factor runs about 0.88 (Apr–May) to 1.07 (Sep–Oct). 3 islands x 5 years: no alarms, books balance, no thirst deaths; score 2.06 (4x5). Test Y25.
Found, not changed (for Robert): moon and tide are computed but nothing uses them; Eden (eden.js, being.js) still has the old pull-back inheritance; news about water is still copied exactly; only some numbers can be changed per run (s.config) while most live in the global register; 12 pairs of world modules import each other (works, but fragile); diagnostic fields lastAte and carers are read but never set; a few unused names (salts setup, pairMate, animals, material; exports COOK, SAVANNA_MAP, tide).

## Eden inheritance fixed (18 Nov 2026, Robert: "make the above changes")
Eden had the same pull-back as A8: a child's curiosity (eden.js birth) and its other six temperament systems (being.js) were mean + h2 (midparent − mean) + noise, a pull toward the fixed middle of the range. Now by breeding value, as in the small world: founders draw g given their inborn value; a child's g = parents' mean g + Mendelian noise of variance h2·Vp/2; inborn value = g + environment of variance (1 − h2)·Vp, clamped to the curiosity range; Vp is the founders' (uniform) variance. Eden keeps everything else: guidance, the warning, the serpent, development after birth. Breeding values are stored (c.eden.gCuriosity; temperament's g kept off the listed traits).
Checks: 12 Eden seeds x 30 days, 162 children: child-on-midparent slope 0.39 (h2 = 0.4). Test A3 rewritten to hand-check the new rule exactly. The small world is untouched (fingerprint 7bbddd1c4e66b511 before and after). 150 tests pass.
For the theory: in Eden, curiosity (seeking) now carries through generations without being pulled back, so whether guidance or the fall shifts it over generations becomes a fair test.

## Moonlight wired in (18 Nov 2026)
Before: the moon's phase was worked out daily (weather.js) but nothing used it. Now moonLight(s) = lit fraction of the disc while the moon is up (it crosses the sky ~50 min later each day: highest at noon when new, at midnight when full, up ~12 h around that). Night walking pace runs from nightPace 0.5 (moonless) to moonNightPace 0.8 (full moon up), and night fall risk from nightInjury 3x to moonNightInjury 1.5x (both new entries are assumptions with ranges). Checked over a month: waxing moon lights the evening, full moon the whole night, waning moon the hours before dawn (test Y26). 3 islands x 5 years: no alarms, books balance, deaths unchanged (people mostly sleep at night, so the effect is small for now). Not yet used: moonlight and sleep timing (Casiraghi et al. 2021 found people sleep later before full moons), night hunting at water holes. Eden has no weather, so it is unchanged.

## Water news as a binary channel (18 Nov 2026)
Before: news of whether a hole has water was copied exactly. Now each retelling gets it backwards with chance newsFlipPerHop (0.05, assumption; a binary symmetric channel). A hearer who already knows the hole takes the news only if their trust in the teller (the same Beta trust as place news) is at least one half. On arrival the news is checked and trust updated. Bits = mutual information between what was heard and what was there.
Island 1, 2 years: 29,500 checks, 91% right, 1.8 retellings, but only 0.10 bits: most holes hold water most of the time, so "has water" tells little a guess would not. (Place news: 2.4 bits.) 3 islands x 5 years: no alarms, books balance, no thirst deaths; one starvation death on island 2. Score 2.19 (was 2.06): worse by 0.13, reported, not tuned. dryOk (whether a hole lasts the dry season) is still passed on without noise. Test Y27.

## Per-run overrides and tidy-ups (18 Nov 2026)
Any register number can now be changed for one run: setRate(name, value) / clearRates() in clock.js; tools/score.mjs --set=name:value uses it for register names and passes the rest as world settings. With no overrides nothing changes (fingerprint c482dde46941ca92 before and after). Test Y28: an override changes a run, and clearing it gives back the identical run.
Death diagnostics: two fields that were never set (ate: always null; carers: always 0) replaced by the child's actual carer.
Left as they are, on purpose: the unused chance keys (reserved, harmless); SAVANNA_MAP (registers the map when loaded); COOK in nature.js, a per-food table of cooking gains that nothing uses (cooking uses one cookGain for all food): wiring it in would change behaviour, so it is a modelling choice for later; the 12 pairs of modules that import each other (they work, because nothing is used while the files load; untangling them is a larger refactor with no change in behaviour, best done in one careful step with the fingerprint as the guard).
Process: tools/ship.sh commits only when every test passes, nothing has drifted and the page has every file it imports (after one commit went out with a failing test, Y27, fixed in the next commit).
Phone app: the Island Lab page (https://claude.ai/artifact/QPGrSYmNedstaXfefMQups) now carries the current lab (Eden and the Lab island) and the small world, linked both ways; checked in a phone-size browser: both pages load with no errors and the small world runs.

## Feelings, stage 1: fear with pain as its signal (18 Nov 2026) — built, OFF by default
Robert asked for instinctive feelings that develop the way they are thought to develop in humans. Sources checked before building (corrections to my first sketch were sent to Robert first): Rescorla and Wagner 1972 (delta rule); Bouton 2002 (extinction is new, context-bound learning; spontaneous recovery, renewal, reinstatement); Ohman and Mineka 2001 (prepared fears learn faster and extinguish slower); Muris et al. 2001 (73% of 4–12-year-olds report night fears; ~80% trace them to negative information); Golkar et al. 2013 (vicarious extinction: safety learned from others); Taddio et al. 1997 (early pain raises later pain response); Campos et al. 1992 and Dahl et al. 2013 (wariness of heights comes with self-produced locomotion; not modelled, the island has no drops); Roberts and DelVecchio 2000 (personality consistency .31 child, .54 college, .64 at 30, .74 at 50+); heritability of neuroticism ~0.4–0.48.
Model (dist/feelings.js, one module for every world; nothing in it knows about God, the fall or the serpent): per cue (the dark; large animals) a fear memory F and a safety memory S; expressed fear = (F − S) x (0.5 + inherited caution). Harm with the cue present (a fall at night; being hurt by an animal) moves F toward the pain felt, faster for prepared cues and for the young (plasticity(age)), and cuts S (reinstatement). Hours with the cue and no harm build S, more slowly for prepared cues. S fades back over safetyRecoveryDays (spontaneous recovery); F is kept. In the evening talk the hearer moves toward the teller's fear, as far as they trust them, both ways (fear up, or safety up). Pain in the first year raises pain sensitivity. In choices: fear of the dark adds to the cost of trips that run past dusk (less under a moon that will be up); fear of large animals lowers the value of hunting.
Checks: with feelings off the run is identical (fingerprint c482dde46941ca92). Tests F1 (learning, safety on top, recovery, reinstatement), F2 (children faster, told both ways, off by default), F3 (plasticity against Roberts and DelVecchio: 0.23/0.57/0.69/0.75 against .31/.54/.64/.74).
Findings with feelings on, 3 islands x 10 years (feelings off in brackets): deaths by thirst 5 (4), 23 (7), 14 (15); no alarms. Fear of the dark: none under 4, rising through 4–7, then in 100% of everyone over 7 at about 0.7–0.85. First version let telling only add fear and drove everyone to the most frightened level (1.2–1.45); fixed (telling both ways). Two open problems, so it stays off: (1) fear of the dark is universal, where real children report it about 73% of the time and it falls in the teens — night falls may be too common (the night injury factor is an assumption) and adolescents here do not lose it; (2) thirst deaths rose sharply on one island in three; whether fear causes it needs paired runs on more islands (thirst over 10 years is already high with feelings off: anomaly A7).

## 19 Nov 2026: fixes after Robert's "fix it all" and the outside audit
1. Dawn counted as night (a bug since the real clock). With hour steps, the 06:00–07:00 hour began before sunrise (06:30) so all of it counted as full night: half pace, 3x falls, sight 1 tile; about 28% of all walking happens in that hour. New isDark (clock.js): judged at the middle of the step, dark only beyond civil twilight (~22 min near the equator). Used for pace, falls, sight and the fear of the dark, in the world and in Eden's body.js (no twin drift); isNight stays the schedule. Evening walking after dark is about 2% of walking.
2. Fear of the dark: safety now partly lasts (safetyLastingPerDay: recovery after extinction is partial and repeated extinction lasts, Bouton 2002), and hours awake in the dark at camp teach safety at a reduced weight (campDarkTransfer: extinction is context-bound). 6 islands x 10 years: fear no longer universal (0–68% of an age group, low levels); thirst deaths with fear on match fear off (9 v 10, 11 v 10, 0 v 1, ...). Not reproduced: the childhood peak of night fears and its fall in the teens; real children's fears come mostly from imagined dangers and stories, which we do not model, and no age curve was put in by hand.
3. Island 4 is chaotic (anomaly A9): with feelings off, news blur 0.29 or 0.31 gives 13 or 48 survivors; fear at weight 0.5 gives 70, fear at weight 0 gives exactly the feelings-off run. Any comparison must use many islands.
4. Feelings switched ON by default: score 2.017 with, 2.116 without (4 islands x 5 years). The first "on" score was wrongly identical because tools/score.mjs passed true as text; fixed.
5. Water news (audit: the test passed by rounding and the news told nothing): over a full year, beliefs taken at face value were right less often than just assuming water (91% v 95%). Now beliefs are Bayesian (own base rate of wet holes against trust in the teller) and information ages toward the base rate (waterNewsAgeDays 30). Beliefs right 99% v base rate 95–96%; 0.09–0.11 bits. Test Y27 now demands beliefs beat the base rate over a full year.
6. tools/ship.sh named the TAP reporter (Node 23+ prints "ℹ pass", and the old script stopped silently). withRates() clears overrides after one piece of work; a world records any overrides it ran with (config.rateOverrides).
7. The live site (GitHub Pages) was deployed only from design/lab-visual-polish, so main never reached it; the workflow now deploys from main.
8. Code formatted with prettier (printWidth 120): 6,262 lines to 15,829. Proved behaviour-neutral by tools/fingerprint-all.mjs (world, Eden, Lab, old island, Lab16 run: all five identical before and after). One source-text test (S2) made spacing-free.
Not done here (modelling decisions for Robert, from the audit): belief in the serpent only rises and the warning never fades (20 of 20 Eden worlds fall); lies are noise with no liar who gains; sharing costs nothing; the serpent does not adapt.

## 19 Nov 2026: the live site, branches and the home screen
Robert saw the live site "go backwards": when it moved to main its front page became the Eden test lab (16-bit, setup form first) and the small world sat behind a small link. Nothing was lost. New dist/home.html is the front page: the small world first, then the Eden test lab, then the first (15 Nov) Lab page, which still runs unchanged on today's code (dist/lab-classic.html, restored from design/lab-visual-polish). Every page links back to the home screen.
Branches: all 16 reviewed. Main held every file of every branch except Cursor's Moving Bar prototype (0.4.0-proto, pre-registered, 340 runs; P-a failed, P-b failed in the opposite direction: peer monitoring lowered detection, P-c held as an identity). It changes the 15 Nov Eden engine, which has since been rebuilt, so it does not merge; its design and results are now in docs/archive/, and porting it to today's Eden is a decision for Robert. All 13 old branches are kept in one branch, archive/old-branches, whose commit has every old tip as a parent (checked: 13 of 13 inside); the list is docs/archive/BRANCHES.md. Deleting the old branches is refused from this session; Robert can delete them on GitHub.

## 19 Nov 2026: one world at a time — the test worlds frozen
Robert: build the simulation first, as close to our world as possible, physics-accurate; testing (deception, the biblical theory) comes later; "one world at once". The small world is now the app (the live site opens on it). Eden, the Lab island and the first island are frozen: a complete copy of the code as of commit 1e85c4f is in dist/frozen/ with its own pages (frozen/home.html, lab.html, lab-classic.html); their tests and tools (14 test files, drift-check, data-pack, fingerprint-all) now point at the frozen copy, and their files are removed from the live folder. So changes to the small world's shared files (clock, body, energy, weather, being) can no longer change or be held back by the frozen worlds. Checked: the frozen engines' fingerprints equal the live ones before removal (eden ee2e8dc69c70, lab 230bf4b9d39e, sim 526dafc087d5, lab16 acb7906ce0e9; world 0baec8913f86); 156 tests pass; all four pages load with no errors in a phone-size browser.
Also agreed in direction (19 Nov, awaiting Robert's yes on the plan): calibration paused until the physics is complete (the score stays as a diagnostic); hand-set decision weights to be replaced by one currency (survival and reproductive value); the physics built in order: sun and air, body heat balance, water (Penman–Monteith), plants (light- and water-limited growth), animals and predators, movement (Pandolf, Tobler), illness as a process, then the mind.

## Layer 0: energy from the sun (19 Nov 2026)
Robert's layered plan (energy, atmosphere, water, terrain and soil, plants, animals, agents; networks, institutions, information and self-modification to be measured, not built). Corrections agreed in reply: the balance law is next = state + inflows - outflows (entropy is the second law's constraint on flows, not a term); terrain's shape is the base under water; air and water are one loop; layers run at their own time scales; weather arrives from outside the island; layers 7-10 emerge.
dist/sun.js (new, every function under 30 lines, pure functions, no state): the sun by Meeus (1998) on true astronomical time from 06:00 EAT 1 Nov 2026 (the world's 365-day calendar labels drift about a day per four years from the sun; the sun does not drift); sunrise, sunset, civil dawn and dusk, solar noon, day length; daylight 0..1; sunlight at the top of the air (1361 W/m2 over distance squared) and at the ground (FAO-56 Angstrom); FAO-56 daily Ra, clear-sky share, net shortwave and net longwave (Stefan-Boltzmann).
Spencer (1971), tried first, was dropped: against Meeus it was off by up to 0.3 deg (it assumes an average year), e.g. +0.25 deg at noon on 23 Sep 2026, after the real equinox at 00:05 UT.
Tests S1-S6: FAO-56 example 8 reproduced exactly (Ra 32.194 with FAO's own declination); 2026 equinox and solstices (USNO times) give declination 0.001 and +/-23.438 deg; equinox day length 12 h 07 min at Lake Eyasi; hourly sunlight summed over a day equals the FAO daily formula within 1% on four dates (two independent methods); tick 0 is 06:00 EAT; every function under 30 lines.
Wired in: physical darkness (isDark) now comes from the sun's elevation (dark below -6 deg at the middle of the step). With one-hour steps the pattern is unchanged (light 06:00-19:00 all year: at 3.6 S sunrise and sunset move only about 30 min over the year), so the world fingerprint is unchanged (0baec8913f86). The finer seasonal light needs a finer step: a reason for 15-minute steps later. Net radiation is ready for Layer 1 (air temperature), which will replace weather.js's heat factor.

## Layer 1: the atmosphere (19 Nov 2026)
dist/atmosphere.js (new; every function under 30 lines). Daily air: the measured monthly mean max and min temperature for the 0.5 deg cell over Lake Eyasi, 1901-2009 (max 24.7 deg C in July to 28.9 in October; min 13.3 in July to 16.6 in April), smoothed between month midpoints; a persistent anomaly (WGEN, Richardson 1981); wet days cooler by day and warmer by night, with dry days shifted the other way by the month's wet share so every month's mean stays on the record. Humidity from the dew point (FAO-56 Annex 6: near Tmin, 2-4 deg C below in the dry), pressure from elevation (FAO-56 eq. 7: 89.7 kPa at 1030 m), wind as a Weibull daily mean (windier June-October), sunshine fraction by wet or dry day. Hourly temperature by Parton and Logan (1981), fitted to the real sunrise and sunset from Layer 0.
Replaced: weather.js's hand-set temperature (30 deg C mean max with a cosine season). The old days were about 2-3 deg C hotter than the measured record. Heat (water loss) and spoilage now follow the measured climate.
Tests A1-A5: pressure 101.3 kPa at sea level and 90.0 at 1000 m (FAO table); 20 simulated years reproduce every month's measured max and min within 0.3 deg C with rain days in; the day curve is coldest at sunrise, warmest 13-16 h, continuous at sunrise and sunset; vapour pressure never above saturation; functions under 30 lines. The first A2 run failed: the test read the rain table (keyed by name, from November) by a January-first index; the world code converts the month explicitly.
World: 3 islands x 5 years, no alarms, books balance, no hunger or thirst deaths; score 2.013 (was 2.017); 167 tests pass. Open for this layer: lake breezes and hills (a tile's own temperature by lapse rate) wait for Layer 3 terrain; clouds and storms are carried by the rain chain (weather from outside the island).

## Layer 2: water — module built and verified; NOT yet wired into the world (19 Nov 2026)
dist/water.js (new; functions under 30 lines): FAO Penman-Monteith daily reference evaporation with net radiation from Layers 0 and 1; SCS curve-number runoff with antecedent wetness (Chow et al. 1988); soil store with FAO-style water stress; groundwater as a linear reservoir. Tests W1-W5: FAO-56 example 18 (Uccle, 6 July) reproduced, 3.88 mm/day, matching an independent reproduction; runoff limits; water conserved over 10 000 random days; evaporation responds the right way to heat, wind, sun and humidity; functions under 30 lines.
Tried in the world and taken back out: soil moisture by month barely changed (within 0.03), and evaporation became realistic (lower under wet-season cloud, higher in the dry season: 3.8-5.5 mm/day). But water holes, fed by runoff plus seepage with the catchment scaled to match the old average inflow (catchScale 12, island 1), held water far less: 16-55% of holes in the wet season and none from August to October, against 70-100% and about half before; the field record (O'Connell et al. on the Tli'ika area) has water widespread in the wet season and more restricted late in the dry. Thirst and starvation deaths followed. Causes: runoff comes in bursts that full holes spill; groundwater only recharges when the soil is saturated. To fix before wiring: drainage whenever soil is above field capacity (not only saturation), and hole catchments set against the observed pattern of water by season. The register entries curveNumber, groundwaterDays and catchScale are unused until then.
Also found: the quick-check script always loaded the current code, so a "before" run was really "after"; it now takes ROOT=<path> (tools/quick.mjs).

## The layer safeguards (19 Nov 2026, Robert: bake rules in so a new layer can never be mixed in unchecked)
1. Switchboard (dist/layers.js): every file belongs to one layer, marked real or stand-in; the world uses a new layer only when its status is changed there (test L1: no file without a layer).
2. Gate (tools/gate.mjs <layer>): the layer's own tests, then 6 islands with the layer as stand-in and 6 as real, each island in its own process (so "before" and "after" can never be the same code by mistake); no alarms, water books balanced, deaths per island not up by more than 20% (or 2), and the layer's real-world pattern (tools/gate-patterns.mjs). It writes docs/gates/<layer>.json with a hash of every file in the layer; test L3 refuses a real layer without a passing record, or whose files changed since (the gate must be run again).
3. Contracts (tests/contracts.test.mjs): every day for a year, what each layer hands the next stays in physical range.
4. Downhill only (test L2): no file imports from a higher layer. It found two: the clock read the sun (darkness now lives in sun.js) and the weather read the plants file for the year-to-year rain swing (rain-years.js, Layer 1); both moved with the world fingerprint unchanged (5bf2194c8c5470f5).
5. Stand-ins listed (tools/layers-report.mjs, printed on every save): which layers are real, which are temporary, and which real layers feed each temporary one.
Gates run: sun passed (dark 11.0 h a day in every month; deaths per island 5.0 -> 5.0); air passed (the world's monthly mean max within 0.28 deg C of the 1901-2009 record in every month). Both were wired before the gate existed, so their before and after run the same code; the record says so. Test L4: every function in a real layer is under 30 lines. Plus the GitHub read-back on every save. 177 tests pass.

## Layer 2: water — through its gate and made real (19 Nov 2026)
Fixes after the first attempt (holes dried): (1) HBV soil routine (Bergstrom 1992): of the water that soaks in, a share (soil wetness)^2 percolates to groundwater, so groundwater refills whenever the soil is wet, not only when saturated; (2) the HBV response routine: stream channels (7 days) and groundwater (120 days) as two linear reservoirs between the land and the holes, so runoff no longer arrives in one burst; (3) each kind of hole takes its own share of groundwater (rain-fed pans none, pools in seasonal streams 0.3, the river all); (4) curve number 85 (TR-55: poor desert-shrub and sparse cover on heavier soils, 77-88): at 75 the area's daily rains almost never passed the initial loss and pans stayed dry; (5) catchment scale 8, swept 1-16 on 3 islands x 3 years against the observed season of water.
Measured by kind (island 1, 3 years): pans hold water Nov-Jul (43-81% of them) and are dry Aug-Oct; river and pools hold water all year (an open point: real seasonal river pools in the Eyasi basin dry in some years). Stream flow 0-0.22 mm/day, groundwater seepage 0.11-0.50 mm/day, peaking in May-June after the long rains.
Gate (6 islands x 3 years, before = stand-in, after = real): passed. Holes with water 0.78 in the wet season and 0.51 in September-October (target >= 0.7 and 0.15-0.75); deaths per island 5.0 -> 4.2; no alarms; soil, hole, channel and groundwater books balanced. 3 islands x 5 years: no thirst or starvation deaths; score 1.903 (was 2.013).
Then the 30-line rule (test L4) applied to weather.js as part of a real layer: makeWeather, weatherDay and the stand-in water split into small functions (fillHoles, pastYear, rainDay, one shared holeStep), proved behaviour-neutral by fingerprint for both paths (real 5964aac3c52cbdb6, stand-in 5bf2194c8c5470f5); that edit voided the gate, which was run again and passed with the same numbers. Also fixed: the water switch assumed every world has settings (a bare test world has none). Water is real; the stand-in stays callable for gates (config.layers.water = 'stand-in').

## 20 Nov 2026: fitted water numbers marked provisional; Layer 3 (land) started, not yet real

- curveNumber (85) and catchScale (8) are marked PROVISIONAL in the register and on the switchboard
  (layers.js `provisional`; printed on every save). They were fitted to the seasonal water pattern while the
  land was missing and are to be replaced, not kept.
- dist/land.js: heights in metres (coast 1000 m, top 1900 m, like the Eyasi escarpment's 900 m rise), flow
  accumulation (O'Callaghan and Mark 1984) over the map's own drainage directions (priority-flood, Barnes et al.
  2014), so the drawn rivers lie exactly on the flow lines; catchment area and mean flow length per tile; slope;
  lapse rate 6.5 deg C per km. Tests T1-T4 (tests/land.test.mjs).
- With the land switched on (config.layers.terrain = 'real'), each hole gathers from its own catchment:
  inflow depth = runoff depth x catchment area / pool area (holeAreaHa, 1 ha, an assumption measurable in the
  field). This replaces catchScale. Old paths proven unchanged by fingerprint (5964aac3c52cbdb6 real water,
  5bf2194c8c5470f5 stand-in water). Water gate re-run after the edit to weather.js: passed, same numbers.
- Found, not yet fixed (needs Robert's decision): with real catchments, small-catchment pools now dry, but river
  pools still never dry. Two causes in Layer 2: (1) groundwater recharge is 18% of rain, against 0.1-5% measured
  for semi-arid land (Scanlon et al. 2006, Hydrological Processes 20: 3335-3370); (2) every river pool takes all
  the groundwater seepage, but semi-arid seasonal rivers are mostly losing streams: the water table lies below the
  bed, and groundwater comes out at springs and the lake, not in the channel. Even at 4% recharge, river pools stay
  wet; with losing rivers they would dry where nothing else feeds them.

## 20 Nov 2026 (later): losing rivers; FAO-56 deep percolation; Layer 3 (land) real

Robert approved fixing both water problems the land exposed.
- Deep percolation now follows FAO-56 (Allen et al. 1998, eq. 88): water drains below the roots only when the
  root zone holds more than it can after the day's evaporation. The HBV percolation (and its fitted exponent
  beta) is gone from the soil day. Diffuse recharge falls from 18% of rain to about 0%. Measured semi-arid
  recharge is 0.1-5% (Scanlon et al. 2006), and most of it is focused, through channel beds; that focused part
  is not yet credited to groundwater (catchments are nested, so the volumes need routing first). Open item.
- Seasonal rivers are losing streams: no seasonal hole takes groundwater (ground share 0); groundwater comes
  out at springs and the lake. With the real land, river and stream pools also seep into their sand beds
  (poolBedSeepMm, 3 mm a day, an assumption measurable in the field; tested at 1 and 10); clay pans do not.
- Result (6 islands, 3 years): river and stream pools wet in Sep-Oct, small catchments 0.32 against large 0.59;
  seasonal holes wet 0.73 in the wet season and 0.24 in Sep-Oct. Rivers now dry in the late dry season, small
  ones first, as Eyasi's seasonal rivers do; people are left with springs and the lake, as Hadza dry-season
  camps are (Marlowe 2010, The Hadza, ch. 2).
- Gates: water re-run and passed (deaths per island 5.0 -> 5.0); terrain passed (deaths 5.0 -> 4.3), so the land
  is real. catchScale is retired; curveNumber (85) is still provisional.
- waterSites split into four helpers for the 30-line rule; the sites are identical before and after (hash).
- Fingerprints: all real ef56e330baf9fc6b; land stand-in 6febb3225f828d4c; land and water stand-in
  5bf2194c8c5470f5 (unchanged since Layer 2).

## 20 Nov 2026: day temperature from the sun's energy (Layer 1)

- The fixed wet/dry shift on the day's maximum (wetDayCoolMax, retired) is replaced by the energy balance
  (atmosphere.js sunWarming): the day's net sunshine above or below the month's mean (FAO-56 eq. 21, 35, 38),
  times the share that heats the air (sensibleShare 0.5, a Bowen ratio near 1), spread through the afternoon
  mixed layer (mixedLayerM 1500 m; Stull 1988): dT = dRns x share / (rho cp h). Mean sunshine is the month's own,
  so departures average to zero and the measured monthly means hold.
- Cross-check: this gives wet days about 0.9 deg C below the mean and dry days about 1.1 above, a 2 deg C gap,
  the same size as the old assumed shift, now derived rather than assumed.
- Air gate re-run: passed; monthly mean max within 0.28 deg C of the record. Sun gate re-run after a comment
  edit in sun.js: passed, dark 11.0 h every month.
- Still statistical: the night minimum (wetDayWarmMin). Cloudy nights warmer by longwave (FAO-56 eq. 39) needs a
  night-layer depth and ground heat flux; next.
- Fingerprint, everything real: 90e5e57b88b992ff.

## 20 Nov 2026: night temperature from the longwave balance (Layer 1)

- The fixed wet/dry shift on the night minimum (wetDayWarmMin, retired) is replaced by the longwave balance
  (atmosphere.js nightWarming): FAO-56 eq. 39 net longwave with the cloud factor from the day's sunshine, half of
  it in the 12-hour equatorial night, part returned by the ground (groundNightShare 0.5, assumption), the rest
  cooling the night layer (nightLayerM 200 m; Stull 1988). Vapour pressure from the month's minimum (FAO-56
  eq. 48). Departures are from the month's mean sunshine, so the measured means hold.
- Result: cloudy nights about 1.2 deg C warmer than the mean, clear nights about 1.5 colder.
- The air gate now also checks night lows against the record. Passed: mean max within 0.28 deg C and mean min
  within 0.21 deg C of the record in every month.
- Day and night temperature are now both driven by the sun's energy (Layer 0 to Layer 1), anchored to the
  measured monthly means. Fingerprint, everything real: 711d9a635cfb7d95.

## 20 Nov 2026: curve numbers from land cover (TR-55); the last fitted water number retired

- Goal check: the small world as close to ours as possible, each layer built from measured physics, the output of
  each layer the environment of the next, nothing tuned to a wanted result. curveNumber (85) was the last number
  fitted to a pattern; it is now retired (kept only for the stand-in land path).
- Curve numbers come from what covers the ground (TR-55, USDA 1986, Table 2-2d arid and semiarid rangelands,
  fair condition, 30-70% ground cover): soil group B (sandy soils over granite and gneiss, as around Eyasi;
  assumption): herbaceous 71, desert shrub (thorn bush, woodland) 72; bare rock 98 (impervious, Table 2-2a);
  river beds loose sand, group A, 63 (the only group-A arid row, desert shrub poor). Each catchment's number is
  the area-weighted composite of its own cover (land.js catchmentCover); the island's number is 73.3.
- Pans: pans form on clay (which is why they hold water and do not seep); around them soil group D: herbaceous
  89, desert shrub 86.
- Each hole now has its own stream: its own runoff by its own curve number at the island's soil wetness, through
  its own channel reservoir (holeStream). Books: holeChannelError ~ 1e-11.
- Missing physics found and added: rain falling on a pool's own open water (all kept). Without it, and with pans
  scored on sandy ground, pans held water only 12% of wet-season days; with both, 89%.
- A contradiction found and fixed: river-bed squares were first scored as impervious (98), against the losing,
  sand-bed rivers of the water layer. This made tiny all-channel catchments wetter late in the dry season than
  large ones and failed the land gate (small 0.56 against large 0.45). As sand (63): small 0.32, large 0.39.
- Results (6 islands, 3 years): runoff 1.2% of rain, groundwater recharge 0.9% (measured semi-arid range 0.1-5%,
  Scanlon et al. 2006); seasonal holes wet 0.81 in the wet season, 0.23 in Sep-Oct.
- Gates: water passed (deaths per island 4.2 -> 5.5 against the old stand-in water; within the limit, and the
  rise is real: physical runoff leaves less water than the fitted number did); terrain passed (5.8 -> 5.5).
- Old paths proven unchanged against the last save (land stand-in a781c050f8219ff4; land and water stand-in
  754db016e0756aac). Fingerprint, everything real: .

## 20 Nov 2026: Layer 4 (plants), first part: the herb layer grows from transpired water

- Found: the food patches (w-food.js makeFood) are sized from the Hadza density (0.24 people/km2) x the land x a
  year's need. That builds the answer in. Layer 4 is to replace it with food grown from the plants.
- plants.js: each day, growth above ground (g/m2) = actual evapotranspiration (mm, from the water layer) x the
  share through plants (0.51; Schlesinger and Jasechko 2014) x 1000 / the transpiration ratio (300 g water per g
  dry matter, C4 grasses 250-350; Larcher) x the above-ground share (0.53; Nairobi savanna, Kinyamario, ORNL
  DAAC). Green grass cures once the soil has lost its readily available water (FAO-56 p = 0.5) over about two
  weeks; dead grass is removed with a half-life of about six months (assumptions, in the register).
- Independent check, nothing fitted: Deshmukh (1984), East and southern Africa, peak herb biomass (kg/ha) =
  8.488 x rain (mm) - 195.8. Across 6 islands x 3 years: peak standing grass / Deshmukh 0.97 (by year
  0.70-1.50), the year's growth / Deshmukh 1.09 (peak standing crop underestimates production, as the Nairobi
  work found). Green grass about 93 g/m2 in the wet season and 3 g/m2 in Sep-Oct.
- Gate passed. Plants stay a stand-in on the switchboard: food is still scripted. With the plants on or off the
  island is identical (fingerprint c4ffeb745a9ff88e both ways), because nothing reads them yet.
- Water gate re-run after weather.js began to hand the day's evapotranspiration upward (W.aet): passed.
- Books: grass grown = green + dead + removed, exactly (test P3).
- Next: grow the foods from the plants (berries and fruit from woody plants, tubers, seeds), each with a measured
  edible yield, and remove the density from makeFood. Needs woody-plant growth and published yields.

## 20 Nov 2026: the Hadza density removed from the food; food grown from measured yields (Layer 4 real)

Robert: "Remove hazda and implement our goal".
- Before: food patches were sized as 0.24 people/km2 (Hadza) x the land x a year's need x a diet share per food.
  The island was told how many people it feeds (about 205). That built the answer in.
- Now (dist/yields.js, w-food.js makeFoodGrown): every food at every food site of its own ground; each kind of
  ground's yearly yield from field measurements, shared among its sites. No people density, no diet shares:
  tubers //ekwa 5,200 kg/ha where it grows (Vincent 1985, in Wood et al. 2021), 146 kcal/100 g dry, ~78% water
  (Schoeninger et al. 2001); berries 935 kg/ha fresh edible fruit in savanna woodland (KwaZulu-Natal 2022),
  320 kcal/100 g dry (Crittenden et al. 2009); baobab 36.8 kg fruit per tree (Venter and Witkowski 2011), pulp
  16.6%, seeds ~29% (as nuts); honey 6.8 wild colonies/km2 in Africa (Visick and Ratnieks 2023) x 5-8 kg a year;
  fish by lake area (Marshall 1984: 147 kg/ha for the island's 34 km2 lake) and 43 kg/ha for rivers; shellfish
  88 g AFDW/m2 rocky shore (Seys et al.).
- Assumptions, in the register with ranges: share of land where //ekwa grows (0.1, the largest unknown), tuber
  renewal (2 years), berry dry and edible shares (0.3, 0.5), baobab trees per ha (2; recorded 0-60), intertidal
  share of shore (0.05), shellfish renewal (1 year).
- Each year's food follows that year's plant growth (plants.js plantYearRatio, against the plants' own average,
  514 g/m2, 24 island-years) in place of the rain shortcut; in the first year, the rain ratio.
- Result: the land grows about 20.6 billion kcal a year, food for about 25,000 people (the stand-in: about 205).
  Berries are about half of it and rest on the weakest numbers (a South African fruit plot and two assumptions).
- Effect: deaths per island 5.5 -> 4.2 (6 islands, 3 years); nobody starved before or after; almost all deaths
  are "Illness", which is a Hadza mortality curve (Siler fit) in the people layer: the next scripted input.
- Tests: P4 (changing the people density changes no patch), P5 (Marshall's points). Y8 now looks for regrowth
  learning across foods: with measured stocks tuber patches never fall below 64% of full, so tuber beliefs rightly
  stay put while baobab, nuts and berries beliefs move. Y9 looks for a band split on four islands, not one.
- Gate passed; plants are real. Fingerprints: all real eef4c2c7e0262054; plants stand-in c4ffeb745a9ff88e
  (unchanged from before).
- Other Hadza numbers still used as inputs (people layer, to be rebuilt): the Siler mortality fit, menarche and
  menopause ages, camp size at the start, daily energy use, sleep, day-range limits.

## 20 Nov 2026: Layer 5 (animals) real: herds graze the grass that grew

- fauna.js: herbivores eat in proportion to metabolic mass (mass^0.75; intake 0.09 kg dry matter per kg^0.75 a
  day, approx., range 0.06-0.12). Each day the herds' need comes out of the plants layer's grass, green first then
  dead (dry tissue is a large part of dry-season diets; McNaughton 1985). Short of grass they starve (a herd with
  nothing lasts about 60 days, assumption). The land's carrying capacity follows the plants' own year in place of
  the rain shortcut. Fish, shellfish and honey yields moved here from yields.js (identical fingerprint).
- Result (6 islands, 3 years): herds eat 2.5% of the grass grown; herbivores 1,278 kg/km2. Both within the
  measured ranges (native large herbivores eat 1-64% of ANPP, Joern and Raynor 2018; 10^2-10^4 kg/km2 across
  African parks, Fritz and Duncan 1994). 2.5% is near the low end: densities still come from field counts made
  where lions and people hold herds down, so on the island predators (implicit), not grass, set the numbers;
  grass limits them only in drought. Predators of their own are the next step for this layer.
- Gate passed (deaths per island 4.2 -> 4.2); plants gate re-run after the move: passed.
- Safeguard fixed: the 30-line test (L4) checked only each layer's original files, not its new real files; it now
  checks both (all pass). nature.js split: animalDay, law and wildfireDay into small functions, fingerprint
  identical (eef4c2c7e0262054).
- Still to tie in: wildfire fuel should come from the dead grass, not the rain ratio.

## 20 Nov 2026: merged to main and live

- Robert: "Merge all live". PR #4 (Layers 0-5 real) merged as 815e17d after the front-page screenshots were sent.
- The live-site workflow then failed without running: its name, "Publish Island: the small world", had an
  unquoted colon, so the YAML could not be read. Quoted, test WF1 added (any workflow name with a colon must be
  quoted), merged as PR #5 (28aafe5). GitHub Pages deployment of 28aafe5: success.
- Not checked from here: the workspace cannot open github.io, and the web-reader check went unapproved.

## 20 Nov 2026: fire burns the dry grass that grew

- Predators checked: they are in the model only implicitly (field-count herd densities carry their effect; most
  natural deaths are kills that lions and hyenas finish, so only a share leaves a carcass; buffalo and zebra can
  hurt hunters; people learn fear of large animals). Predators as their own animals are deferred (Robert).
- Fire with the real plants: odds in proportion to the standing dead grass against its mean on fire-possible days
  (fuelRefGm2 413 g/m2, the model's own, p10-p90 296-549); no dead grass, no fire. Savanna fire is limited by fuel,
  not sparks (Archibald et al. 2010); fuel follows the past years' rain (Govender et al. 2006); only grass not
  eaten is fuel (FAO). Each fire burns its share of the island's dead grass (burnedTotal). Books: grown = green +
  dead + removed + eaten + burned (test F5).
- Result (6 islands x 3 years): 38.9 fires a year (before, on the rain shortcut: 49.0), about a third of the land
  burnt a year (not yet checked against a source). Correlation of fires with that year's mean dead grass 0.33
  (before 0.43; lower because fires now remove the fuel they are measured against).
- Animals gate re-run: passed (deaths 4.8 -> 4.2, herds ate 2.5%). Plants stand-in path unchanged (c4ffeb745a9ff88e).

## 20 Nov 2026 (night): every new assumption run across its range; should the island be larger?

Robert approved the range runs, and asked whether to add land (journals and mathematics).
- tools/ranges.mjs: 23 assumptions, each at its register low and high, 2 islands x 2 years (94 runs); every
  layer's check applied to each (docs/ranges-2026-11-20.txt).
- Failures, shown in full:
  - Plants (peak standing under 0.75 of Deshmukh): transpirationShare 0.36 (0.60), aboveShare 0.4 (0.64),
    litterHalfLifeDays 90 (0.66), transpirationRatio 350 (0.73). Growth is uncertain by about a third across the
    measured ranges; the Deshmukh check rules out the low ends together.
  - Water (Sep-Oct holes under 0.15): holeAreaHa 4 (0.14), poolBedSeepMm 10 (0.10).
  - Land (small catchments drier than large): fails even at the base values in these short runs (0.32 against
    0.29; the gate's 6 islands x 3 years gave 0.32 against 0.39). The pattern is real but weak: the gap is small
    next to island-to-island noise. Not tuned; noted as fragile.
- People: deaths (2.0 per island) and people alive (60.5) are the same in every one of the 94 runs. No assumption
  in any layer changes who lives or dies, because food and water never run short and almost all deaths come from
  the scripted Hadza illness curve. The environment does not yet reach the people: the strongest reason to do
  Layer 6 next.
- Island size. Now 850 km2 of land, 45 people in 3 bands at the start (0.05 per km2). The Hadza: about 1,000
  people on about 4,000 km2, 0.24 per km2 in 1985 and 0.33 in 2000 (eHRAF, Marlowe 2010). A stable population of
  about 150 is demographically viable (White 2017, JASSS 20(4) 9); older work put it near 500 (Wobst 1974);
  isolated forager populations likely went extinct locally every few hundred years (Hamilton and Walker). At
  measured forager densities the island would hold about 200-280 people, above 150. Land is not what limits the
  island today; the starting number and the scripted deaths are. Recommendation: do not enlarge now; decide after
  Layer 6, when density is a result. If networks and institutions (Layers 7-10) need more bands, a Hadza-sized
  island (about 4,000 km2) is the measured reference, at about 4-5 times the computing and every gate re-run.
- Burnt area (about a third of the land a year) still not checked against a source: none found for this rainfall.

## 20 Nov 2026 (late): Layer 6 step 1: aging from the cross-forager measure, not the Hadza fit

- The deaths the sim does not model itself come from a Siler age curve (infant-child, constant, aging), all three
  terms the Hadza fit. Step 1 replaces only the aging term, the least Hadza-specific: human mortality doubling
  times are similar across populations, 7-9 years (Finch 2007); the Hadza term doubled every 5.5 years, the
  hunter-gatherer average every 8.1 (Gurven and Kaplan 2007, table 2: a3 1.47e-4, b3 0.086), now used.
- Effect on the curve: life expectancy at birth 34.3 -> 32.1 years; at 45, 24.9 -> 21.6 more years.
- Effect on the island (2 islands x 10 years): people alive 70 -> 68 and 72 -> 72; deaths almost unchanged.
  Seen in passing: on island 2, 12 of 32 deaths in ten years were from thirst, so the environment does reach
  people on some islands over longer runs (the 2-year range runs missed it).
- Next (step 2, a big modelling decision, to be agreed first): replace the infant-child and constant terms with
  disease from the body and from contact.

## 20-21 Nov 2026: Layer 5, predators, save 1 of 3: lions and hyenas (off by default)

Robert approved the plan (predators, then herds limited by grass, then carcasses and risk to people), predators
before disease because each layer's output is the next layer's environment.
- fauna.js: the grouped functional response of Fryxell et al. (2007, Nature): a group of G predators meets herds
  (animals per km2 / herd size), kills a day for the group a H / (1 + a H (h1 + h2 / G)); a 1.16 km2 a day, h1
  0.045 d, h2 1.422 d, lions G 6.3; hyenas G 3 with the lion's rates (assumptions). Needs: lion 6 kg of meat a
  day (Shamwari 5-7), hyena 3.9 (Henschel and Tilson 3.8-4.0). Prey by size (half to twice own mass); hyenas avoid
  zebra and buffalo (Hayward 2006). Births when fed up to Fenchel's rMax; deaths 0.15 a year (assumption). Start
  at Carbone and Gittleman's 90 kg per 10,000 kg of prey.
- First version (lions hunting alone, meeting single animals, type II on biomass): wiped out the prey in two to
  three years (herbivores 1,262 -> 33 kg/km2), as the unstable simple model predicts.
- With grouping: a slow decline instead (1,262 -> 89 kg/km2 in 8 years; lions 61 -> 62, starving). Expected while
  herds are capped by field counts: a capped herd spares at most r/4 of its mass a year (about 6-9%), and predators
  at Carbone's ratio need about 24% a year. Save 2 (herds limited by grass) is what can carry them.
- Off by default (config.predators); default island unchanged. Test F6. 194 tests pass.

## 21 Nov 2026: predators, save 2 of 3: large herds limited by grass (with predators on) - unstable, shown in full

- With config.predators, herds of 20 kg and up are held by grass and predators: births up to Fenchel's rMax in
  proportion to the food need met; background deaths herbivoreDeathRate (0.1 a year, assumption) and hunger.
- First try (all herds by grass): hares and hyraxes, with no predator of their own in the model, overran the
  island (hares 23 -> 23,497 kg/km2 in 8 years) and starved the large herds. Small animals now keep their
  field-count levels, which carry the small predators not modelled (jackals, caracals, eagles, pythons); hyenas no
  longer take 5 kg dik-dik (they prefer 56-182 kg, Hayward 2006).
- Second try: the large prey still collapse (island 1: impala 470 -> 0, zebra 502 -> 4, buffalo 232 -> 61 kg/km2
  in 12 years; lions 61 -> 114 -> 49, hyenas 65 -> 27, starving) with grass plentiful throughout.
- Mathematics: an equilibrium exists (for zebra about 200 kg/km2 and about 34 lions on the island: lions fed a third
  of their need, kills equal to the zebra's growth), but with prey not food-limited and predators unlimited by
  anything but prey it is unstable (the paradox of enrichment, Rosenzweig 1971); starting at Carbone's ratio
  (61 lions) above it, the swings grow until the prey crash.
- What steadies real systems (literature): predator territoriality and density-dependent cub survival; spatial
  refuges for prey; herd size growing with density (Fryxell 2007; its fitted values are in a supplement not
  reached). Proposed to Robert: prides and clans on home ranges on the map (territories and refuges together).
- Off by default; default island unchanged (fingerprint ee5f79eb58495f15).

## 21 Nov 2026: predators, save 3: prides and clans on home ranges, herd drift, hunger deaths (off by default)

Robert approved territories as the next step.
- fauna.js: home ranges placed on the habitat (lions 100 km2, hyenas 50 km2: assumptions within the measured
  36-600 and 9-1000+ km2), each group hunting only its own range with its own size in Fryxell's response; land no
  group holds is a refuge. Large herds drift to neighbouring 2.8 km cells (herdDriftPerDay 0.05, assumption).
- Island 1, 16 years: still a collapse (impala 470 -> 0, zebra 502 -> 2). Arithmetic: at low prey the share of
  zebra killed a year is about (lions per km2) x a / (herd x pride) = 0.13 x 1.16 / 63 x 365 = 0.87, against the
  zebra's most growth of 0.26; and the predators held that density for years on 11% of their food, because they
  had only a slow background death rate.
- Hunger added (it had been left out): each group carries body reserves of up to predatorStarveDays (30 days,
  assumption 14-60); once empty, the hungry die, as herbivores do.
- Island 1, 20 years, with hunger: lions 61 -> about 20, well fed; impala recover (96 -> 227 kg/km2); but hyenas
  die out by year 6 (24 small clans hunting impala only) and zebra fade (502 -> 3): lions living on impala and
  buffalo keep killing zebra faster than they breed (apparent competition; at low prey a pride's kills depend on
  the ground it searches, not its size; with prides over nearly all the habitat, zebra lose about 0.42 a year
  against 0.26 growth).
- Missing, from the literature: hyenas also eat zebra and take lion kills (hyenas lose 70% of their kills to lions
  yet gain equal food from them; Periquet et al. 2015); zebra herd size rising with density (Fryxell 2007);
  territories not covering all the land.
- This save made more than one change (ranges, drift, hunger): noted against the one-change rule.
- Off by default; default island unchanged (fingerprint ee5f79eb58495f15).

## 21 Nov 2026: predators time-boxed (Robert): up to three single-change saves, then on only if stable

- Save A, the hyena's real diet: zebra added (avoided, not refused; Hayward 2006). Island 1: worse. Zebra
  502 -> 53 kg/km2 in two years (hyenas now hunt them too; Carbone's start doubles hyenas to 135), hyenas still
  die out by year 6, lions settle near 16-20, impala recover. The diet is a measured fact and stays; the failure
  is recorded. The pattern behind all four tries: at low prey numbers each group's kills depend on the ground it
  searches, so a rare prey keeps being hunted by predators that live on a common one (apparent competition).
- Save B, prey switching (Murdoch 1969; the accelerating, type III response that prey selection produces, which
  counteracts fluctuations by sparing prey that have become rare: Owen-Smith and Mills 2008, Kruger lions; lions
  shift diet with prey numbers, Eastern Cape 2011): each group's hunting split in proportion to herds^2
  (switchingPower 2, assumption within 1-3). Island 1: the large herds and the lions now hold steady from about
  year 10 (impala about 20, zebra about 30, buffalo about 200 kg/km2; about 13 lions, fed 0.97). Lion biomass
  about 92 kg per 10,000 kg of its prey: Carbone and Gittleman's 90, not set. Still wrong: hyenas die out by
  year 6, and total large herbivores (about 250 kg/km2) are low, though inside the park range.
- Save C, scavenging: hyenas eat animals that died of other causes (background and hunger deaths, routed to the
  range they fall in; what no scavenger eats in a day goes to vultures and rot). Islands 1, 2 and 3, 16 years:
  all five species persist, steady from year 10 (impala about 7, zebra 11, buffalo 160 kg/km2; lions about 9,
  hyenas 6). Lions about 88 kg per 10,000 kg of prey (Carbone 90); all herds about 240 kg/km2 (in park range).
- But the three islands are identical to the last digit: with predators on, grass never runs short, so weather
  never reaches the large herds, and nothing else in them is random. Real herds die back in droughts.
- Time-box verdict (agreed rule: on only if stable and realistic): stable and on the narrow checks, but not
  realistic (every island the same; 6 hyenas over 24 clan ranges is no population; impala and zebra at 2-3% of
  field densities). Predators stay off; the island keeps its measured field counts. Open, for later: herds that
  feel drought through grass quality and water, whole animals rather than fractions, and clans that merge.

## 21 Nov 2026: Robert: "there is no next yet, resolve this"; a general energy law for herds (predators still off)

Robert asked for a general law (to scale beyond one island), journals and mathematics, and no fixation on one place.
- fauna.js: each day a herd's energy got against its need. Need: maintenance 0.51 MJ ME per kg^0.75 a day (cattle
  0.515, Luke; sheep 0.511, calorimetry). Food energy: Minson (1984) ME = 0.157 DOMD + 0.059 CP - 1.073. Green grass
  62% digestible, 10% protein; cured 44%, 2.5% (Botswana dry season 41.5-50.8%, 2.1-8.4%). Intake falls with
  digestibility (Zimmermann, Transvaal). Result: all-green diet 1.63 x need, all-cured 0.75. Reserves fill on a
  surplus and drain on a deficit; females breed while reserves last (impala fecundity did not follow rainfall,
  Ogutu et al. 2015); with reserves gone no young are raised (juvenile survival is what rainfall moves most,
  Owen-Smith et al. 2005) and the hungry die.
- Diet composition: green and cured grass taken as they stand, green favoured. With the assumed preference of 5,
  the diet was mostly cured grass all year and herds and lions collapsed (islands finally differed). The preference
  is now derived from two measurements: grazers eat green leaves almost exclusively in the wet season (McNaughton
  1985) while green is about 0.4 of standing dead (145 against 364 g/m2, Nairobi): about 22-25 times; set 25.
- With it the herds are well fed; the islands are identical again, because predators hold impala and zebra at
  about 2% of field densities (sustained by buffalo and by scavenging), so grass never runs short.
- Diagnosis: the gap is not the herds' food but predation at low prey numbers. Real impala persist among lions by
  avoiding lion areas and keeping vigilant (the landscape of fear), which a mean-field model cannot hold.
- Also measured and not yet used: standing dead grass decomposes at 7-11% a week in the wet season and 1-2% in the
  dry (Ngatia et al., Kenya), against the constant six-month half-life in plants.js.
- Predators off by default; default island unchanged (fingerprint ee5f79eb58495f15). Test F7.

## 21 Nov 2026: option B: the energy law on the field-count herds (default world)

Robert chose B now and the landscape of fear later, built once with the people (same machinery: individuals that
move, notice danger and avoid it; lions and hunters sharing one landscape).
- With the real animals, every herd (field-count or not) now carries body condition from the energy law: it breeds
  while reserves last and starves once they are gone (nature.js herdCondition). Stand-in path unchanged
  (fingerprint ee5f79eb58495f15 over 120 days).
- Two islands, 12 years: herds follow each island's own run of years. Island 1: three dry years (415, 411, 371 mm)
  took herds from about 1,290 to 1,015 kg/km2; two wet years brought them back. Island 2: 368, 422, 338 mm took
  them from 1,376 to about 1,000. Zebra reserves fell to 37-53 days at the lowest and never ran out: ordinary dry
  seasons are survived; only a deeper drought would starve them.
- Correction to the record: the field-count herds already followed each year's plant growth; the identical islands
  were only with predators on. What this adds is condition and starvation.

## 21 Nov 2026: Layer 6 step 2a: the pneumococcus passed between people (disease.js, off by default)

- One general engine for germs carried in the nose and throat (carry, pass on, clear, sometimes fall ill). First germ:
  Streptococcus pneumoniae, measured rates from Melegaro, Gay & Medley 2004 (household and community acquisition,
  51 and 19 days of carriage, density factor w 1.184) and starting shares by age from Hussain et al. 2005.
- Camp contact stands in for Melegaro's "community", scaled by the share of others in camp who carry it over the
  25% of swabs positive in that study. There is no world outside the island to bring the germ in.
- Pneumonia per new carriage 0.0056 (assumption, 0.002-0.02, worked from O'Brien 2009; no direct measurement);
  untreated case fatality children 0.13 (assumption, 0.057-0.30), adults 0.30 (Austrian, 0.25-0.35); crisis after
  7 days (5-10); hunger raises the hazard up to 11.63 (Olofin 2013) as the fat store empties below 50% (assumption).
- Off by default (config.disease.pneumococcus); default fingerprint unchanged (ee5f79eb58495f15). While on with the
  Hadza illness curve, pneumonia deaths are counted twice; the curve comes off only when 2a-2c are all in.
- First result, 4 islands x 3 years, nothing tuned: the germ died out on every island within 1-3 years (young-child
  carriage 13-35% in year 1, against 45-52% in the UK study; then 0). A closed island of 50-65 people at UK contact
  rates is below the size that keeps it going (critical community size). Cases 0-1 per island; pneumonia deaths 0-1.
  Open question for Robert: real foragers meet neighbours and share huts more closely than UK families; the island
  has neither neighbours nor forager-measured contact rates yet.

## 21 Nov 2026: fix: two register entries shared the name starveDays

The herds' entry (60 days, added with Layer 5) had the same name as the people's (40 days) in the register object, so
it silently replaced it. Renamed to herdStarveDays. Nothing in the people reads it (their fat store comes from body
fat, energy.js), so the people's fallback goes back to 40 and nothing changes: fingerprint ee5f79eb58495f15 before and
after; herds still use 60.

## 21 Nov 2026: speed work, exact changes only (step 1 toward a 10,000 km2 island)

Robert's rule for the bigger island: same 350 m detail everywhere; only speed-ups that change nothing. Proof for each:
the whole world state after one year on islands 42 and 43 hashes the same before and after (332adef1905a6bf1), and
the 120-day fingerprint stays ee5f79eb58495f15.
- Profile (one island-year, 14 s): about 80% is the people (choices 41%, sharing news 10%, food 10%), about 10% land.
- returnRate no longer copies and reverses its age table on every call (ageFactor; test M1 checks every age).
- exploreValue's list of known places' return rates is kept per person (w-memo.js) until they learn a place, their
  skills change or they pass into a new age row; a check mode works it out fresh on every call and throws on any
  difference (2 islands x 1 year passed; test M2 runs 60 days in check mode).
- Result: 2 island-years 31.1 s -> 24.5 s (21% faster), identical state.
- Caught by the full tests before saving (Y18): a test swapped a person's whole map of places for an empty one, and
  the memo did not notice. The memo now also checks it is the same map and skill book; all world tests pass.
- Evening news: a teller used to go through every place they know for every hearer. A hearer ends up holding each
  place at least as fresh as the teller (entries only get fresher), so next time only places the teller has written
  since can be news. Writes are logged per person (w-memo.js newsIds); places are still visited in the teller's own
  order, so everything happens exactly as before. Check mode compares with the full loop on every telling (2 islands
  x 1 year passed). Its share of run time fell from 6.6% to about 2.4% plus the log; it no longer grows with how
  many places people know, which is what matters on a bigger island.
- Option reasons for foraging trips are written out only for the six options kept with a decision (sorted first,
  then written): same words, same order.
- State hash unchanged throughout (332adef1905a6bf1). Timing on this machine varies by about 10%; best of two runs:
  28.9 s -> 25.4 s for 2 island-years.

## 21 Nov 2026: timing a 10,000 km2 map (throwaway copy, nothing saved but one fix)

Timing only, on a copy with the map 549 x 384 tiles (10,362 km2 of land, 5,608 food places, 475 waters), island 42,
the same 54 people: one year 22.9 s against 13.3 s on today's 850 km2. Found on the way: land.js took the highest
point with Math.max(...map), which overflows the call stack on a large map. Replaced by a plain loop that gives the
same value (NaN as Math.max would); fingerprint and one-year state hash unchanged.

## 21 Nov 2026: rules baked in (docs/RULES.md, tests/rules.test.mjs)

After the outside review, Robert asked for the rules and constraints we now understand to be built in. Six rules
added (9-14: exact speed-ups only; no outcome built in; no double counting; general, not one place; rebuild in
order; answer reviews with evidence), listed in docs/RULES.md with what enforces each, and in the goals doc.
- Rule 12 test (R1): no list spread into Math.max or Math.min anywhere in dist; the five places that did now use
  maxOf and minOf (dist/numbers.js, base layer), which give exactly what Math.max and Math.min give, signed zeros,
  NaN and empty lists included (R3), and handle a whole large map.
- Rule 11 test (R2): disease stays off in a default world while the Hadza illness curve is on.
- Rule 9 tool: tools/state-hash.mjs (whole state after a year on islands 42 and 43). Unchanged: 332adef1905a6bf1;
  fingerprint ee5f79eb58495f15.

## 21 Nov 2026: rebuild for the bigger world, Layer 0 (sun): every place its own sun

Robert agreed the layout (lake basin west, escarpment and highland plateau east, like Lake Eyasi and the Mbulu
Highlands) and the rebuild from the sun up. A 10,000 km2 world spans about 1 degree of latitude, so the sun can no
longer be one point at the lake.
- sun.js placeAt(dxKm, dyKm, metres): a place's own latitude, longitude and height from km east and south of the map's
  anchor, using WGS84 degree lengths (kmPerDegree, standard series). Every sun function already takes such a site.
- Test S7: degree lengths at the equator and 45 deg match the WGS84 values to 2 m; 100 km south of Lake Eyasi is
  4.50 S; clear-sky share at 2,300 m is 0.796 (FAO-56 eq. 37); the December day 100 km south is 3.2 min longer, within
  10% of what plain geometry gives. (My first bound, "under 3 minutes", was a guess and wrong; replaced by the
  geometric expectation, not by loosening.)
- sun.js reformatted by prettier (it had not been). Nothing uses placeAt yet, so the world is unchanged
  (fingerprint ee5f79eb58495f15). The map (Layer 3) will hand each square its place.

## 21 Nov 2026: Layer 1 (air) rebuild, step 1: rain made by mountains (orographic.js), not yet wired in

Robert chose the physics (option 1): the linear theory of orographic precipitation (Smith and Barstad 2004). Pure
function of any height grid (the air layer stays below the land; the water layer will hand it the map).
- Tests: O1 moist air (FAO-56 saturation 2.338 kPa at 20 C; moist lapse 4-5 K/km; Hw about 2.4 km); O2 no delays, no
  waves, thin moist layer -> exactly the classical upslope rain Cw U dh/dx (within 1%); O3 no water created overall
  (net under 0.1% once the grid holds the lee drying); O4 windward wet, lee dry, delays move rain downwind; O5 opposite
  wavenumbers give conjugates; O6 wind bearings and shares; O7 an independent exact solution (Queney's hydrostatic
  wave over a bell-shaped ridge, weighted over the moist layer) matches within 3% (test bound 5%).
- New register entries, all with ranges: cloud and fall-out delays 1000 s (200-2000, Smith and Barstad; Barstad and
  Smith 2005), moist stability 0.005 1/s (0.0005-0.01), wind 6 m/s (3-10, assumption) from 110 deg (60-150, the
  Indian Ocean inflow), background rain rate 2 mm/h (1-5, assumption).
- First look, a synthetic Eyasi-like profile (basin 1,000 m; escarpment to a 2,000 m plateau to the east; wind from
  the east-south-east), share of background rain, basin / plateau:
    central 1.44 / 0.27 (the opposite of the measured 300-400 mm basin and about 1,000 mm highlands);
    moist stability 0.0005: 0.56 / 1.18; 0.01: 1.31 / 0.55; wind 3 m/s: 1.20 / 0.75; 10 m/s: 0.93 / 0.38;
    delays 200 s: 1.60 / 0.20, 2000 s: 1.14 / 0.45; rain rate 1 mm/h: 1.89 / 0.01, 5 mm/h: 1.18 / 0.71.
  The pattern hinges on moist stability against wind and moist-layer depth (N Hw / U about 2 at the central values,
  where the moist layer spans a third of a vertical wavelength and windward rain is carried far upwind). Not tuned:
  reported. The independent exact check (O7) shows this is the theory, not a coding error. Next: look up measured
  moist stability and inflow wind in the rains rather than leave them assumptions.

## 21 Nov 2026: rules 15-17, so the world keeps working while it grows

Robert's concern: with the land scaled and every layer rebuilt, we might not end up with a working world. Three
rules added: build beside, not over (15); the whole world works on every save (16, tests/world-works.test.mjs: 5 years
on islands 42 and 43, no crash, people alive and having children, food and water books balanced, under 60 s an
island-year, page code parses; passes today, about 3 minutes); time-box each layer to three saves, then measured data
as input (17). Rain (Layer 1) is on save 1 of 3: save 1 was the physics (a23864c); next, measured moist stability and
inflow wind.

## 21 Nov 2026: Layer 1 rain, save 2 of 3: measured moist stability and wind

Robert: "see if you can work through it." No paper gives these for northern Tanzania, but real soundings do: four
Nairobi radiosondes (station 63741, 1,798 m, the nearest upper-air station, about 280 km north-east of Eyasi) in
the April 2025 long rains, from the College of DuPage archive. tools/moist-stability.mjs computes the saturated
buoyancy frequency layer by layer (Durran and Klemp 1982: Nm^2 = (g/T)(dT/dz + Gm)(1 + L qs/(Rd T)) - g/(1+qw) dqw/dz).
- All four saturated layers (1.3-2.4 km deep) were moist-UNSTABLE: Nm^2 -2.0e-5 to -6.5e-5 s-2.
- Winds in those layers: 1.5-3.6 m/s from 70-120 deg (one near-calm day from the north).
- Consequence: the linear theory of orographic rain needs stable or neutral moist air (Nm^2 >= 0), so it does not
  apply to these rains. They are convective, which fits the Kilimanjaro modelling (local processes give over 60% of
  the rain at 2-4 km). The first-look result (basin wetter than plateau) came from using the theory outside its range.
  The code stays (correct, tested, for stable-flow cases); register now carries the measured wind and the finding.
- Under rule 17 the third save is the fallback: measured rain as input, with held-out stations as the only checks.

## 21 Nov 2026: Layer 1 rain, save 3 of 3 (rule 17 fallback): each place's rain from measurements (rainmap.js)

The data services that hold CHIRPS / CHPclim (IRI Data Library, NASA POWER, Open-Meteo) forbid automated fetching
(robots), and the workspace network blocks the CHC server. Robert authorised a bypass; declined, as those are the
sites' own rules. Robert is downloading CHPclim himself; rainmap.js has the slot for it (rainShareFromMap).
Meanwhile, source 1: published station figures, rain by height, straight between two input stations (Eyasi basin
1,030 m 300-400 mm; Mbulu Highlands about 1,900 m, 1,000 mm or more), four held out as checks only:
    Karatu town 1,420 m: measured 900-1,000, got 686 (miss)
    Karatu highland zone about 1,700 m: measured 600-800, got 928 (miss; this source disagrees with the town figure)
    Ngorongoro crater rim 2,300 m: measured 900-1,100, got 1,100 (within)
    Arusha 1,387 m (windward of Meru): measured 1,000-1,200, got 658 (miss)
One of four within. Expected: in this region exposure matters more than height (Oettli and Camberlin 2005), and the
two Karatu figures contradict each other. Not tuned; reported. Time-box for rain is used up: source 1 stands as the
working input until CHPclim arrives, and the same checks then run on it.

## 21 Nov 2026: Layer 3 (terrain), the bigger world, save 1 of 3: the land's shape (land-big.js), built beside

Rule 15: a separate generator, imported by nothing in the running world (test TB4). A pure function of a landscape
description (rule 12) following the real land around Lake Eyasi: basin and lake at the foot of the Eyasi escarpment
(running south-west to north-east), the Mbulu-like plateau on its south-east, a volcanic block to the north-east.
The shape is generated (fractal noise on that layout); a survey grid (SRTM) would be better and can replace heightAt.
- Result (checks only, all against measurements): land 10,664 km2 (target about 10,000); basin median 1,266 m (lake
  1,030 m, Lake Eyasi); plateau median 2,081 m (Mbulu Highlands 1,500-2,300 m); highest 2,900 m (Ngorongoro
  conservation area tops out at 3,648 m); the escarpment climbs from the lake to about 1,860 m within 4 km. Lake 693
  km2 (an assumption of its size; Lake Eyasi varies with the seasons). Builds in 0.06 s (343 x 343 squares).
- Next saves: rivers, catchments and flow over it (the land.js routing, made to take any grid); then the switch that
  lets a world run on it, and the whole-world check on both worlds.

## 21 Nov 2026: Layer 3, the bigger world, save 2 of 3: water over any grid (flow.js)

The island's routing (priority-flood, Barnes et al. 2014; upstream-first accumulation) made into functions of any
grid (rule 12), run on the bigger land. Every square drains to the lake or the sea (FL1); catchments emptying into
outlets add up to all the land (FL2); largest catchment about 2,000 km2; 0.1 s. Hack's law (FL3): exponent 0.47
against the measured 0.5-0.7: anomaly A8, open, not tuned (likely the land is generated, not eroded).

## 22 Nov 2026: the map switch, step A1: the island's map built by named steps (exact)

Merged live first (PR #6, Robert's OK after front-page screenshots). Then terrain.js restructured so a second map
can reuse its steps: heights, sea and land, the main island, distance to the sea, hills, the lake, water routing,
rivers, shore and woodland, each a function reading one set of grids (module "let"s, swapped by a coming useMap).
The water routing now calls flow.js drainage (the same priority-flood, same order and comparisons) with the sea at
-1 m, instead of its own copy. Exact: fingerprint ee5f79eb58495f15 and one-year state hash 332adef1905a6bf1 unchanged.

## 22 Nov 2026: the map switch, step A2: useMap and redo-on-switch (exact)

terrain.js keeps each built map's grids and swaps one in with useMap(id); code that worked something out from the map
once redoes it through onMapChange: land.js (heights, flow accumulation, cover upstream; a map with its own heights
in metres uses them as they are), w-core.js (map width and height), nature.js (the animals' cell grid, habitat, land
area). A world selects its map when it is made (config.map, the island unless asked) and before every step. Exact:
fingerprint ee5f79eb58495f15 and state hash 332adef1905a6bf1 unchanged. Tests MP1-MP3.

## 22 Nov 2026: the map switch, step B: the Eyasi map in terrain.js, and a world living on it

buildEyasi runs the island's own steps on the land-big.js landscape (its heights in metres; its own lake; rock the
top 5% as on the island; rivers in proportion to land, the island's 9 per its 850 km2), built on first use. Result:
343 x 343 squares, 9,971 km2 of land, lake 693 km2, 48 rivers, grass 6,805 km2, woodland 2,165, rock 533; 2,244 food
sites, 580 water sites; built in 0.3 s. createWorld2(seed, { map: 'eyasi' }) runs on it: island 42, 3 bands, 54 then
56 people after two years, 8 births, about 22 s an island-year (limit 60). The whole-world check (rule 16) now runs
both maps every save. The island is unchanged: state hash 332adef1905a6bf1, and the same when island worlds are
stepped in turn with an Eyasi world. Not yet on this map: its own rain (the station rain map) and sun by place;
plants, animals and people still use the island's single-point climate. Those are the next rebuild steps.

## 27 Nov 2026: the picture frame page (frame.html), presentation only

Robert's Tokenframe: a full-screen page with nothing to press, the island living in time with the viewer's day. One
world hour per real hour by the local clock and calendar; the world's year starts on 1 November (clock.js), so it began
06:00 on 1 November 2026 (?since=YYYY for an older world) and its dawns, months and rains run with the viewer's. On
opening it catches up from its start (about 3 s on 27 Nov; the same seed always gives the same history), then steps
each passing hour, people drawn gliding between hourly positions, night and dawn/dusk shading from the world's own
sun. Land no one has seen is dimmed. frame.js reads and steps the world only; no rule changed (island state hash
unchanged). Catching up grows about 3-4 s per world year since the start; saved checkpoints can come later if needed.
