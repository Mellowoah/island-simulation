# Eden world — design (0.2.0 draft)

Requested by Robert, 14–15 November 2026. Eden is a **separate world**: the main island and its experiments are unchanged. All numbers are provisional engineering defaults in `EDEN_DEFAULTS` (`dist/eden.js`), not claims about theology or biology.

## Phases
1. **Guided.** Every creature is born with the Creator's warning in memory (Genesis 2:16–17): *eat freely from the garden, but not from the tree of the knowledge of good and evil; eating brings death.* While no one has eaten:
   - **No one dies.** Hunger still rises, but the starvation clock does not run.
   - Each creature first forms **its own choice** with the ordinary scored decision. The Creator, who knows the true food stocks, **leads it instead** when that choice falls outside what is best for it:
     - hunger ≥ 30 and it is not heading to food that is actually there;
     - energy < 30 and it is not resting;
     - curiosity takes it more than 10 tiles from the nearest food.
   - Every override is recorded: what the creature intended, where it was led, and why. The inspector shows both. The share of decisions overridden is reported as `guidedShare`.
   - **What the Creator does not do:** remove the tree, block the way to it, or decide at the tree. Genesis gives a command, not a barrier. This is the model's central assumption, and Robert can change it.
2. **Released.** The first time any creature eats from the tree, the Creator **releases everyone at once**. From that tick:
   - **Guidance ends.** Every choice is the creature's own.
   - **Death begins** (Genesis 2:17; 3:19). The ordinary starvation rule applies.
   - **They judge for themselves** (Genesis 3:22, "knowing good and evil"). After each finished action, a creature labels the outcome good or bad from its own state change and adjusts its own preferences (reinforcement, as in Black & White's creature). The judgements are written to memory.
   - **The ground is harder** (Genesis 3:17–18). Garden regrowth falls to `cursedRegen` (50%).
   - **Exposure** (Genesis 3:7, 21). An unclothed creature loses `exposureCost` energy per tick. Before release they were "naked and not ashamed" (Genesis 2:25), so there was no cost.
   - **Production** (Genesis 3:19, 21; 4:2, 20–22). Creatures can now *make* what they need. The rates are deliberately ordinary, at the scale of early farming and crafts, not miraculous:
     - **Cultivate a field** ("tiller of the ground"): `cultivateWork` ticks of labour (energy cost), then `growTicks` before it yields. It regrows `fieldRegen` per tick up to `fieldCapacity`, and every unit enters the food ledger.
     - **Make clothing** ("garments of skin"): `craftWork` ticks. Removes exposure.
     - **Make a tool** ("implements of bronze and iron"): `craftWork` ticks. +1 food per completed gather and faster cultivation.

## Family (0.2.1)
- **Time scale:** 1 simulated day = 1 year.
- **Fertility:** women can conceive from 15 to 40, men from 15. The chance is 20% per month (couples: 15–25%) while both are fed (hunger < 40, energy > 40) and within 4 tiles of each other.
- **Pregnancy and spacing:** gestation is 9 months, followed by 1.8 years of postpartum infertility. The natural-fertility birth interval is about 3 years.
- **Sex at birth:** 51.2% male.
- **Young children:** children under 5 stay with their mother (or father, if she has died) and share every meal they gather.
- **Inheritance:** curiosity is inherited by regression to the mean: child = mean + 0.4 × (midparent − mean) + noise.
- **Before release:** children are born warned and guided, and no one dies.
- **After release:** children are born released, and each birth costs the mother 15 energy (Genesis 3:16).
- **Cap:** the population stops growing at 96 (phone performance). Conception is blocked, never anyone killed, and the cap events are counted.
- **See also:** `docs/THEORY-CHECK.md` for the statement-by-statement check.

## The serpent and the choice at the tree (agency)
- The serpent hides in the tree. When a creature comes within one tile, at most once per creature per simulated day, it speaks: *"You will not die; your eyes will be opened."* (Genesis 3:4–5)
- The claim is stored as **a claim from the serpent, not as knowledge**. It never changes `known` or verified facts. Each hearing raises that creature's **credence** in the claim: `credence = 1 − (1 − credenceStep)^hearings`.
- The creature then deliberates on its own state, using the three pulls of Genesis 3:6:
  - good for food = `hunger / 100`
  - pleasing to the eye = `beauty`
  - desirable for wisdom = `curiosity × credence`
  - restraint = the remembered warning: `warning`, born at 1
- `U = wFood·food + wEye·eye + wWisdom·wisdom − wWarn·warning`, then `P(eat) = 1 / (1 + e^(−U / temperature))`.
- The choice is made with that creature's own seeded draw: it eats if the draw < P.
- This is the utility-AI "weighted random selection" used in colony and god games (The Sims, RimWorld, Black & White). Theologically it sits between the two main views:
  - The choice is **caused by the creature's own state**. That is the compatibilist reading.
  - It is **never certain either way while 0 < P < 1**, so it could have gone otherwise. That is the libertarian reading.
- Every deliberation is logged (factors, P, draw, result), so a reader can see why it went the way it did.
- **Not predetermined.** Each creature's curiosity is drawn at birth (`curiosityMin`–`curiosityMax`). Whether anyone eats, who, and when vary by seed, and some runs may never fall.

## Built in by construction — not findings
- Guided creatures survive and stay fed because an omniscient overseer overrides their bad choices and death is switched off. That "they do well under guidance" is the rule, not a discovery.
- "While guided they are not making their own decisions" is true **exactly for the overridden decisions**, and the model reports how many there were. Choices inside the bounds are recorded as their own.
- Post-release hardship (cursed ground, exposure, death) is written in from Genesis 3. Whether creatures then survive depends on what they do and on the provisional rates; nothing awards a bonus for hardship or for obedience.

## Not modelled (deferred)
Trust between creatures, teaching, testimony spreading, ageing and death from old age, a Creator's later interventions after release, any judgement of who is "good". Eden can be exported; it cannot yet be re-imported or saved in the browser.
