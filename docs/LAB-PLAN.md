# Island lab plan

Status: **piece 1 of 4 built (core, no screen yet), 15 November 2026.** Source: Robert's lab brief of 15 November. It governs the island from now on. Eden is frozen as it is; `docs/WORLD-LAWS.md` is kept for later and is not being built.

## Goal
A laboratory where identical starting conditions are run under different interventions. The player changes knowledge, environment and conditions. Creatures decide for themselves from local information, needs, memory, trust and visible utility scores.

## No-drift rules (from the brief)
No chatbots or outside AI. No combat, civilization building, technology trees, crafting, quests, inventories beyond food, narrative scripting or direct control. Nothing is added that the brief does not ask for.

## Where it lives
`dist/lab.js` is a new, readable core. The classic island (`sim.js`) and Eden (`eden.js`) are untouched, so every earlier result still reproduces.

## Robert's addition: a larger, marshmallow-shaped island
72 × 44 tiles, a rounded rectangle, about four times the classic island's land. A river down the middle has two fords; one is open by default. Food is balanced across the river. Reason it matters: on the classic island creatures found everything within a day, so information had nothing to do.

## Built in piece 1 (58/58 tests pass)
| Brief item | State |
|---|---|
| Needs: hunger, energy, safety, social (0–100) | Built |
| Knowledge items with type, coordinates, confidence, source, time; local only; confidence fades with age | Built. Types: food, garden, danger, crossing. "Water locations" is covered by the river and its crossings; there is no thirst need in the brief, so no separate water. |
| Personality: curiosity, risk tolerance, trustfulness, persistence, social preference; random at start, permanent | Built |
| Utility scoring every tick, real scores and reasons shown, highest wins | Built. Actions: eat, find food, rest, explore, socialize, share knowledge, investigate, avoid danger. Persistence adds a visible bonus to the action under way. "Cross river" happens as part of a route, not as its own action yet. |
| Trust network 0–100, moved by outcomes | Built. True information raises trust in the teller; false lowers it. A place that is real but empty changes nothing. |
| Communication with source chain; confidence falls 10% per hop; low trust often ignored | Built |
| Misinformation setting (0, 5, 10, 25%) | Built as `falseInformationRate` |
| Seeds, trials, experiment variables | Built as `runTrial(seed, config, interventions, ticks)`. All 12 variables in the brief are settings. |
| Interventions: reveal food to one creature, open a crossing, boost trust, add food | Built |
| Measurements over time | Built: alive, deaths, hunger, energy, safety, social, knowledge spread, food discovery, trust mean and spread, travel, utility, survival time. Every average also has a dead-inclusive form where it matters. |

## Not built yet
- **Piece 2:** the Lab screen: trial setup, side-by-side comparison, graphs, the decision panel.
- **Piece 3:** save and export of lab worlds and trial results.
- **Piece 4:** network overlays; the optional culture system.

## Assumptions for Robert to set (all are settings)
- One message per creature per 30 minutes (`messageInterval`). Without a limit, rumours multiplied every tick.
- Trust gain 10, loss 20, start 50. Hop confidence 0.9. Memory half-life one day.
- Danger zones hurt on 5% of ticks inside them (energy −12, safety −30). Death is by starvation or exhaustion only.
- Score weights inside each action (shown in the reason line).
- One-minute ticks, as on the classic island.

## First look (descriptive only; nothing was predicted beforehand)
Seeds 61–80, 3 days, defaults (`REVIEW/logs/lab-first-look.txt`):
- Communication raised knowledge spread by 9.7 ± 2.3 points (87% vs 78%). Survival was the same (about 24 of 24).
- 25% false information lowered mean trust by 6.6 ± 0.4 points and did not change survival.
- At these defaults nobody is short of food, so survival cannot show an effect. Scarcity has to come from the experiment variables.

## Standards kept from the review
Predictions written before a run; fresh seeds; paired comparisons with intervals; results shown across a range of settings including where they fail; deaths counted in every average; one random stream per use; no creature reads what it has not observed.
