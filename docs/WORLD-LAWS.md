# World laws register

Status: **draft 2, 15 November 2026. No law below is built to this standard yet.** Written before any code, at Robert's direction.

## Purpose
Robert's aim is a **world**, not an experiment shaped around one theory. Its laws should be as true to ours as we can make them, so that any theory can be run inside it: The Moving Bar, the Eden account, both forks, and others not yet written. The world stays the same; only the question changes.

## Rules for this register
1. **The world is checked against reality, never against a theory.** Each law must reproduce known real-world figures on its own before any theory is run on it.
2. **No law is built without all five entries:** real-world source, level of detail, what is left out, validation check, and the settings it adds.
3. **Effects and their conditions, not equations.** We do not simulate forces. We encode what a law does and what its effect depends on. Gravity appears as the chance and severity of a fall, which depend on slope, height, load, tiredness and wet ground.
4. **Every setting has a source or is labelled a guess.** Guesses are listed and tested for how much they sway results.
5. **Theories are layers.** With every theory switch off, the world must behave identically (same digest).
6. **Nothing is cut; things are sequenced.** A law not yet built is listed as "not yet specified", never silently dropped.
7. **Graphics are out of scope.** The world runs headless. The pixel view is an optional window.

Source status key: **have** = cited in this project already; **named** = a source has been named (by Edge or Claude) but not yet read and checked; **find** = to be looked up and cited before the law is built.

## 0. Decisions needed first (proposals)
| Decision | Proposal | Why |
|---|---|---|
| Clock | **One real clock: 1 step = 1 hour.** No "1 day = 1 year". | Thirst (days) and lifetimes (decades) must share one scale. A 70-year life is about 613,000 steps, which runs in the background, not live. |
| Space | **1 tile = 1 km** (island about 36 × 26 km). | Walking pace of a few km per hour gives a few tiles per step. |
| Energy unit | **Kilocalories**, one budget per body. | Lets food, movement, work, warmth, healing and pregnancy draw on the same store. |
| Randomness | Counter-based draws with a **registry of stream numbers**, one per use. | Fixes the overlaps Edge found (77 vs 70–87; 50–67 vs 40–57). |

## A. Foundations
| Law | Level of detail | Left out | Validation check | Source |
|---|---|---|---|---|
| Conservation of matter (food, water, materials) | Ledger per kind; nothing appears or vanishes | Chemistry | Ledger reconciles every step | n/a (bookkeeping) |
| Conservation of energy | Intake = work + heat + storage + waste, per body | Thermodynamic detail | Daily adult budget falls in the human range at rest and at heavy work | find |
| Stable laws | Rules identical for every agent, at all times | Miracles (a theory-layer switch) | Same seed gives the same history | n/a |

## B. Environment
| Law | Level of detail | Left out | Validation check | Source |
|---|---|---|---|---|
| Gravity (as effects) | Fall chance and injury severity conditional on slope, height, load, tiredness, wet ground | Forces, trajectories | Fall-injury rates per exposure in a plausible human range | find |
| Terrain | Elevation and slope per tile; water bodies | Geology | Travel times match walking speeds on slope | find |
| Day and night | Light level by hour and season | Astronomy | Day length varies with season as at a chosen latitude | find |
| Climate and seasons | Temperature and rainfall by season, with year-to-year variation | Weather systems, storms as physics | Seasonal ranges match a chosen real climate | find |
| Water | Springs and rain refill; water can be scarce in dry seasons | Hydrology | Dry-season scarcity occurs at a realistic frequency | find |
| Plant growth | Seasonal productivity; regrowth depends on stock, rain and season; over-harvest damages a source | Plant biology, species | Yield per km² in the range of foraging and early farming | find |
| Trees and deadfall | Chance of a limb or tree falling depends on age, rot, lean, wind; the place is visible and avoidable | Wood mechanics | Rate per tree-year plausible; avoidable at a cost | find |
| Drowning and crossings | Risk depends on depth, current, skill, tiredness | Fluid dynamics | Risk per crossing plausible | find |
| Fire, storms, predators | **Not yet specified** | — | — | find |

## C. Body
| Law | Level of detail | Left out | Validation check | Source |
|---|---|---|---|---|
| Metabolism and starvation | Energy store; survival without food about 3 weeks | Organs, nutrients | Time to death without food | find (rule of thumb used so far) |
| Hydration | Water store; survival without water about 3 days, shorter in heat and work | Electrolytes | Time to death without water, by temperature | find (rule of thumb used so far) |
| Warmth | Heat loss depends on temperature, clothing, shelter, wetness; cold costs energy, then health | Physiology detail | Exposure survival times plausible | find |
| Sleep and tiredness | Need rises while awake; lack dims senses and judgment | Sleep stages | Daily sleep need in human range | find |
| Senses | Sight range by light and condition; hearing range for signals | Optics, acoustics | Ranges plausible for open ground and for night | find |
| Injury and healing | Severity classes; healing time depends on rest, food, age | Anatomy | Healing times by severity plausible | find |
| Disease | Contact spread, incubation, recovery, immunity; worse in crowds and when weak | Pathogen biology | Outbreak curves have the expected shape | find |
| Ageing and death | Mortality rises with age; infant and child mortality | Causes of ageing | Survival curve near a pre-modern life table | find |
| Reproduction | Monthly chance of conception 0.15–0.25; 9-month pregnancy; births about 3 years apart; fertile to about 40 | Genetics of fertility | Birth interval and children per woman | **have** ([Britannica](https://www.britannica.com/science/population-biology-and-anthropology/Biological-factors-affecting-human-fertility); [Evolution and Human Behavior 10.4](https://boisestate.pressbooks.pub/evolutionhumanbehavior/chapter/10-4-demographic-influences/)) |
| Childbirth risk | Risk to mother and child | Obstetrics | Pre-modern maternal and infant death rates | find |
| Growth | Children's needs and abilities change with age | Development detail | Age of self-sufficiency plausible | find |
| Genome and inheritance | Each agent carries a set of numbers from both parents, mixed and occasionally mutated, covering body and temperament traits | Molecular genetics | Parent–child resemblance matches chosen heritability; traits can shift over generations under selection | find |
| Drive to reproduce | A need like hunger, with strength carried in the genome; partner seeking and choice | Courtship, culture | Not assigned an outcome: weak-drive lines leave fewer descendants | find |

## D. Mind
| Law | Level of detail | Left out | Validation check | Source |
|---|---|---|---|---|
| Pain and distress signal | Involuntary, honest, perceivable by others nearby | Neuroscience | Signal strength tracks damage; can misfire at a set rate | find |
| Memory and forgetting | Memories fade unless renewed | Memory systems | Forgetting curve shape | find |
| Learning from outcomes | One reinforcement rule for all | Brain mechanisms | Learning curves have the expected shape | find |
| Feeling adapts (hedonic) | Felt level returns part-way to baseline, with a rate that can be set | Emotion detail | Size and speed of adaptation near measured values | **named** (Lucas 2007; Rutledge 2014, via Edge) |
| Judgment of "acceptable" | A standard separate from feeling; may be anchored or creeping | Moral philosophy | Independence test: judgment must not read felt level | **named** (Levari 2018; Pauly 1995, via Edge) |
| Fear learning | Aversion from harm and near misses; generalises to similar things; fades | Anxiety disorders | Generalisation and fading shapes | **named** (Tinsley, Dillon & Cronin 2012, via Edge) |
| Giving up and stopping | Distinguish numbness, rational stopping, and passivity under uncontrollable harm | Clinical detail | The three are separable in test worlds | **named** (Maier & Seligman 2016; marginal value theorem, via Edge) |
| Temperament | Inherited starting traits; character moves with experience | Personality theory | Twins with different lives diverge | find |

## E. Social
| Law | Level of detail | Left out | Validation check | Source |
|---|---|---|---|---|
| Signals and speech | A channel exists; meaning and honesty are not built in | Language | Honest and lying speakers start equal | find |
| Trust | Learned per speaker from outcomes | Reputation systems | Trust separates through experience alone | find |
| Sharing and care | Helping costs the helper | Kin selection theory | Sharing can lower the sharer's survival | find |
| Carrying, storing, giving | Food and materials can be carried (slows travel), stored (can spoil or be taken) and given (the giver has less) | Property, trade | Provision is possible but never free; hoarding, sharing or neither can all occur | find |
| Practice and know-how | Precautions and crafts are discovered or taught; cost something; can fail | Technology trees | Harm per exposure falls only if practice spreads | find |

## The five channels of adaptation (fixed structure for every agent)
From The Moving Bar. These stay intact: every agent adapts through all five, and each law above belongs to one.

| Channel | Laws that carry it | Built today |
|---|---|---|
| **Body:** healing, immunity, evolution | Injury and healing; disease and immunity; inheritance | Healing only |
| **Feeling:** the baseline resets | Feeling adapts (hedonic); pain and distress signal | Not built |
| **Knowledge:** learning what is preventable | Learning from outcomes; memory; hazards with causes | Food and water locations only |
| **Judgment:** what counts as acceptable | Judgment of "acceptable", separate from feeling | Fixed threshold; the bar does not move |
| **Practice:** guards, manuals, medicine, shared burdens | Practice and know-how; sharing and care; signals | Tools, clothing, fields; nothing shared |

## F. Theory layers (switches, not laws)
- **Creator's warning and guidance; the serpent; release and its consequences** (Eden account).
- **Restoration** (with-God fork): accounting only. It shows the same history two ways and changes nothing in the world.
- **Help experiments** (provision, access, information, ration).
- **Moving bar** (0.4.0-proto): felt adaptation and an acceptable-harm threshold, after release, **off unless the caller passes `movingBar`**. Not a law. Defaults and the pre-registered predictions are in `docs/PROTO-MOVING-BAR.md`.

With all layers off, the world's digest must be identical.

## Build order
1. **Prerequisites** (Edge):
   - fix `eden.js` released interrupt, where a creature consulted true food stock — done in 0.3.2 (memory only);
   - stream registry for random draws — done in 0.3.2 (`STREAMS` in `dist/sim.js`, every call site);
   - per-creature ledger of harm, exposure and benefit — a grove-only ledger exists behind the moving-bar flag (0.4.0-proto); the world-law ledger for every kind of harm is still not built;
   - ODD write-up;
   - digest test that reproduces 0.3.0 with every new flag off.
2. **Section 0 decisions**, then rebuild time, space and energy on one scale.
3. **One law at a time**, each with its five entries complete and its validation check passing, reviewed by Edge before the next.
4. **Theory layers** moved on top, then The Moving Bar predictions.

## What this register cannot do
It can never be complete. Every law is a simplification, and the "left out" column is permanent. Results are claims about this world, to be compared with ours, not claims about ours.
