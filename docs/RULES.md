# Island: the rules

Robert's rules for building the island, and what enforces each one. A rule with a test fails the save if broken
(tools/ship.sh runs every test before anything is saved). The goals doc carries the same list:
https://claude.ai/artifact/SiFKyyUgYtuReWmqc7kMjM

| # | Rule | Enforced by |
|---|------|-------------|
| 1 | Branch first. Work happens on claude/clock; nothing reaches main or the live site without Robert's OK and a front-page screenshot sent first. | Process (D27); tests/workflow.test.mjs checks the publish workflow |
| 2 | Talk before big decisions. Any big modelling choice is put to Robert before it is built. | Process |
| 3 | Nothing scripted. Every number is measured or labelled as an assumption with a range; nothing is tuned to get a wanted result; checks never set anything. | dist/clock.js register (every number has a source and range); tests/world.test.mjs Y15 |
| 4 | Show the ranges. Results across the assumption ranges, failures included. | tools/ranges.mjs; docs/THEORY-CHECK.md |
| 5 | Gate every layer. Real only when its tests pass, its books balance, deaths do not rise, and it matches a measurement. Any edit voids a gate until re-run. | tools/gate.mjs; tests/layers.test.mjs L3 (gate hashes match the files) |
| 6 | Respect GitHub's limits. Every function under 30 lines, formatted, every save read back from GitHub. | tests/layers.test.mjs L4; prettier; tools/ship.sh read-back |
| 7 | One change at a time, checked and reported. | Process; one ship per change |
| 8 | Privacy. Robert's email address is never shared with outside services. | Process |
| 9 | Exact speed-ups only. Same fingerprint, same full-state hash after a year on two islands, check mode comparing every shortcut with the full calculation. Same 350 m detail everywhere. | tools/fingerprint.mjs; tools/state-hash.mjs; tests/memo.test.mjs |
| 10 | No outcome built in. For the theories, nothing may make an outcome certain by construction: beliefs can rise and fall, a world can fail to fall, results are the share of worlds across the ranges. | Required of every theory layer's gate before it is built (Eden, Moving Bar, with or without God) |
| 11 | No double counting. A new cause of death or birth replaces the stand-in it covers and stays off by default until the stand-in can be switched off. | tests/rules.test.mjs R2 |
| 12 | General, not one place. Numbers come from the map and the register; nothing may break at large sizes. | tests/rules.test.mjs R1 (no spreading a list into Math.max/min) |
| 13 | Rebuild in order. When the world changes, every layer is rebuilt and re-gated from the sun up, rules re-checked at each layer. | tools/gate.mjs per layer; docs/THEORY-CHECK.md |
| 14 | Answer reviews with evidence. Tests run, fingerprints compared with main; findings become a rule or a test. | tools/fingerprint-all.mjs |
| 15 | Build beside, not over. A changed world (the 10,000 km2 highland world) is built behind a switch next to the working one, which stays the default and live until the new one passes every check. | tests/world-works.test.mjs runs every world in its list |
| 16 | The whole world works. Every save: each world runs 5 years on two islands with no crash, people alive and having children, food and water books balanced, under 60 s an island-year, and the page code parsing. | tests/world-works.test.mjs (blocks the save) |
| 17 | Time-box each layer. Three saves per layer; if the physics cannot match its real-world checks in that time, use measured data as the input (still rule 3) and record why. The physics stays in the code to improve later. | Process; docs/THEORY-CHECK.md records each save against the box |
