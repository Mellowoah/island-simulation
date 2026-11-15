# Island Prototype — Specification and Task Breakdown

Version 0.1 • November 14, 2026 • Prepared for Robert

Status: planning handoff only. No simulation has been built, run, or validated. Model assignments below are proposed responsibilities, not active connections or completed work.

## 1. Purpose and scope

Build a small browser-playable experiment for iPhone: 24 pixel-art creatures gather, explore, remember food locations, and learn through experience. The player can provide food, open one crossing, or reveal a location. The experiment asks: under what modeled conditions does assistance improve immediate condition and future ability to obtain food?

This document is the scope baseline for implementation. Numeric starting values below are provisional engineering defaults, not claims about biology or user-approved theory. Keep them in a versioned configuration; record changes and their reasons before comparing results.

| Included | Definition |
| --- | --- |
| World | One island, two renewable food patches, one initially closed crossing that shortens an existing route |
| Creatures | 24 individuals with stable IDs and simple distinguishable pixel sprites |
| Needs | Hunger, energy, rest; food deprivation can cause death |
| Actions | Travel, gather/eat, explore, rest |
| Learning | Remember observed food locations; update expected availability and gathering skill through experience |
| Powers | Add food at a selected walkable tile; open the crossing; reveal a food location to one creature |
| Controls | Pause, 1×/4× speed, select creature, save/load, reset to starting seed |
| Inspection | Actual decision inputs, considered actions, selected action, and relevant recorded experience |
| Experiment | Replay matched starting worlds with defined intervention schedules and a later disturbance |

Deferred: reproduction, inheritance, social transmission, trust, religion, dialogue/voice/LLM calls, avatar embodiment, multiplayer, afterlife, resurrection, comprehensive ecology, monetization, and native app packaging. These remain possible later systems, not hidden requirements for this prototype.

## 2. Player experience

Open the prototype link, start the island, and observe autonomous activity immediately. Tap a creature to inspect what it knows and why it is acting. Pause to apply a power; resume to observe consequences. Select an experiment branch to inspect its outcomes separately.

Use a 2D pixel-art map with pan/zoom, visible food, a clearly marked crossing, and distinct creature markers. Keep controls readable and tappable on an iPhone in portrait orientation. Selection must work while paused. Color is not the only identifier. The inspector is a compact panel, with detailed records optional.

The core world requires no AI service or account. Include a downloadable save as well as local persistence. Pause when the page is hidden; no unobserved offline progression. Offline reopening is a delivery check to implement after initial loading/caching, not a claim that a browser cannot evict data.

## 3. Model rules

Maintain a fixed-step simulation independent of rendering. Proposed default: one tick equals one simulated minute; run 10 ticks per real second at 1×. Acceleration advances more identical ticks rather than increasing step size. Store the seed, configuration version, tick, and random-generator state.

Each creature stores position, alive/dead state, energy, hunger, action, target, per-source gathering skill, known food locations, expected availability, and relevant observations. All creatures begin with the same needs and abilities; seeded positions and subsequent experience can differ. No moral traits or personality system in this version.

| Mechanism | Required behavior |
| --- | --- |
| Perception | Observe nearby tiles within a configured radius. Distant food is unknown until observed or explicitly revealed. |
| Movement | Follow walkable routes. Travel consumes energy and time. Opening the crossing changes travel costs, not knowledge automatically. |
| Food | Patches have bounded stock and explicit regeneration. Gathering removes actual stock; eating reduces hunger and replenishes energy. Player-created food is logged as an external input. |
| Rest | Rest replenishes energy but does not satisfy hunger. It cannot indefinitely substitute for food. |
| Deprivation | A configurable sustained-hunger threshold causes death. Record the cause and tick. |
| Memory | Record where and when food was observed. Knowledge of location persists in this prototype; availability estimates may become stale. No omniscient updating. |
| Learning | Successful gathering improves source-specific efficiency with a cap. Directly gifted food does not train gathering skill. This distinction is an explicit assumption to test. |
| Expectations | After observing or gathering, update expected availability using a configurable learning rate. Failed gathering updates expectations too. |
| Exploration | Visit unknown tiles using a seeded exploration policy. It consumes ordinary travel resources and can reveal food. |

At decision points, compare feasible actions using explicit scores based on hunger, energy, estimated food benefit, known travel cost, and exploration preference. Unknown actual food stock must not enter a decision score. Continue actions until completion or a documented interruption condition; avoid changing targets every tick. Log scores and inputs before execution so the inspector explains the real choice rather than inventing a justification.

Required implementation configuration: starting hunger/energy, perception radius, action costs, rest recovery, patch capacity/regeneration, gathering rate/cap, learning rate, deprivation threshold, exploration weight, and decision frequency. Task T1 must publish initial values and unit definitions before coding dependent mechanics. Those constants are calibration choices; none may encode “hardship is good” or “help causes weakness.”

Resolve simultaneous claims on food through seeded arbitration. Total extraction cannot exceed stock. Define update order once: interventions/environment → observations/decisions → movement/actions and resource claims → needs/death → records. Keep IDs, arbitration, and random streams reproducible.

## 4. Experiment protocol

Initial comparison: four branches from each identical starting snapshot. Freeze the configuration before collecting results.

| Branch | Intervention |
| --- | --- |
| A — Baseline | No assistance |
| B — Provision | Fixed amount of food at a fixed location on a fixed schedule |
| C — Access | Open the crossing at a specified tick |
| D — Information | Reveal the second food patch to the same preselected creature at a specified tick |

Information is given to one individual; it does not spread socially in this version. Do not claim this tests teaching or cultural transmission. Keep intervention amount, recipient, location, and timing in the run manifest. Costs differ: report them rather than describing branches as equally costly.

Proposed pilot: 20 predetermined seeds, 10 simulated days of intervention, then branch each resulting state into (1) an unchanged control and (2) a 5-day disturbance in which one food source stops regenerating. Stop scheduled provision in both follow-up branches; retain acquired knowledge and the crossing. Also retain a continuation-of-provision control for B, so withdrawal is distinguishable from source failure. Report the named food source and exact timing. These are pilot settings to assess stability, not sufficient statistical proof.

Use event-keyed or separate random streams for environment and creature behavior so branching does not accidentally shift unrelated weather/resource randomness. Save the pre-intervention and pre-disturbance states. Compare differences across seeds; do not select a single attractive replay as the result.

## 5. Measurements and interpretation

| Immediate condition | Later capacity proxies |
| --- | --- |
| Alive count, per-creature hunger/energy, food consumed | Number of known reachable food sources per creature |
| Time spent gathering, travelling, resting, exploring | Source-specific gathering skill |
| Player-supplied versus gathered food | Survival and deprivation after disturbance |
| Individual food access and deaths | Time to regain pre-disturbance median hunger, plus alive count at that time; report “not recovered” if absent |

Always retain individual records and include deaths. Improved averages among survivors must not erase the losses of others. These are model-specific capacity proxies, not an exhaustive measure of all possible futures. There is no combined goodness score and no claim to prove CIDT, consciousness, free will, or a theological conclusion.

Required robustness checks: repeat with learning disabled; vary exploration and food regeneration around the baseline; compare a simple rule-based decision policy with the scored policy on the same scenarios. Report which findings survive and which depend on these choices. A hardship benefit programmed directly into a rule is not a discovery.

## 6. Architecture and acceptance gates

Proposed structure: a typed simulation core; a headless experiment runner; a browser renderer/input layer; versioned configuration, saves, and event records. The renderer reads the world and submits validated player commands. It never changes simulation state directly. Decide specific libraries during T0; do not expand scope to fit a framework.

| Gate | Pass condition |
| --- | --- |
| Reproducibility | Same snapshot/configuration/commands produce identical terminal state and event digest on repeated runs of the same supported build. |
| Accounting | Food never becomes negative; consumption, regeneration, gifts, and remaining stock reconcile. Needs remain within defined bounds. |
| Knowledge | Hidden food cannot influence decisions until observed or revealed. Inspector records agree with actual selected actions. |
| Learning | Controlled fixtures show experience changes skill and later action outcomes; disabling learning removes that mechanism. |
| Persistence | Saving/loading mid-action yields the same subsequent result as uninterrupted execution; malformed/incompatible saves fail clearly without replacing a valid save. |
| Independence | Creatures gather, explore, and rest without player instructions or network requests. |
| Phone performance | Proposed target: at least 30 FPS during a 20-minute 24-creature session at 1× on Robert’s actual iPhone; report device/browser, frame times, speed achieved, and observed heating. Untested devices are not certified. |
| Touch usability | Robert can select a creature, explain a displayed decision, apply each power, and restore a save without developer assistance. |
| Experiment integrity | All seeds and branches are retained; failed runs and parameter changes are disclosed; observed outputs remain distinct from narrative interpretation. |

No tests have been executed yet. Performance targets and experimental outcomes must be reported as pending until measured.

## 7. Task breakdown

Assignments are proposed for later shared-repository work. No external agent has received a task from this document.

| Task | Owner / reviewer | Dependency | Concrete deliverable and completion check |
| --- | --- | --- | --- |
| T0 — Repository and contracts | ChatGPT / Claude | None | Repository structure, run instructions, state/command/event/save schemas, configuration versioning, and decision log. No service keys required. |
| T1 — Model constants | ChatGPT / Grok | T0 | Initial parameter table with units, formulas, thresholds, and explicit assumptions; scenario schedules fixed. |
| T2 — World and resources | Claude / ChatGPT | T1 | Island, pathfinding, food, crossing, needs, rest, and death; accounting and fixed-step checks pass. |
| T3 — Decisions and learning | Claude / ChatGPT | T2 | Perception, memory, action selection, gathering skill, exploration, and decision inspector records; knowledge/learning checks pass. |
| T4 — Saves and replay | Claude / ChatGPT | T3 | Snapshot, restore, command replay, export/import; reproducibility and mid-action persistence checks pass. |
| T5 — Experiment runner | ChatGPT / Grok | T4 | All branches, controls, seeds, per-individual results, and robustness runs; failures retained. |
| T6 — Phone interface | Claude / ChatGPT | T4 | Pixel map, controls, inspector, three powers, branch selector, cached reopening, and save UI connected to the same core. |
| T7 — Review and playtest | Grok + Robert / ChatGPT integration | T5, T6 | Counterexample review, real phone measurements, usability observations, defect fixes, and concise findings. |

Each task handoff includes specification version, base commit, owned files, dependency status, acceptance criteria, changed assumptions, checks actually run, and unresolved issues. Use one owner per task, isolated branches, and review before merging. Models must not independently redesign interfaces or add deferred features. Disagreements are recorded with evidence; Robert decides changes to the intended experience or scope.

## 8. Definition of finished

Deliver one playable phone link, the shared repository, reproducible run instructions, exportable saves, and a compact results summary with actual measurements and limitations. Robert can observe autonomous behavior, inspect a real decision, use all three powers, save/restore, and compare interventions. A polished story, large population, or favorable theory result is not a substitute for these checks.

This planning deliverable stops at specification and task breakdown. Repository creation, implementation, agent connection, and publication have not occurred.
