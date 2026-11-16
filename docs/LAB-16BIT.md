# Island Lab 16-bit run (branch `design/lab-16bit`, preview only)

Approved by Mellow on 15 Nov 2026 (card t807s3065). Kill-or-keep: Mellow plays it on his phone by Sun 22 Nov 2026.
The live site (GitHub Pages from `design/lab-visual-polish`) and `main` are not changed by this branch.

## What it adds
- **Look:** a top-down, SNES-style 16-bit map drawn with Canvas 2D at whole-number pixel scales (nearest-neighbour), animated water and grass, a small HUD, and a zoom that follows the selected creature. Art is CC0 (see `CREDITS.md`). If the art cannot load (or with `?renderer=plain`) it draws flat pixel tiles instead. The renderer reads a copied view of the world (`lab16-view.js`) and never writes to it (`lab16.test` V1).
- **Setup screen:** world (Eden test or Lab island), seed, creatures, guidance before the deceiver speaks, help on or off, sim speed and run length. Each choice names the theory line or prediction it tests (`lab16-setup.js`). T6, T7, T9 and T10 are labelled "proposed".
- **Graphs:** population, belief in the deceiver (Eden has no trust score between creatures), food, deceiver spoke / ate, survival after release, and how much creatures differ (habits and curiosity). Lab island: population, trust, food, false messages, trust spread.
- **Reports:** plain-English story, each prediction with its numbers and a verdict, what it means for the theory, and how it was judged. Download as Markdown or HTML, or save on the device.

## Theory trace
| Build piece | Lines |
|---|---|
| Guidance years before the deceiver may speak | P1, P2, T2, T4, T7 (proposed) |
| Help on/off (40 food near the start every month, first half of the run) | P5, T8 |
| Survival after release graph | P2, T5, T7 (proposed) |
| How much they differ graph | P3, T5 |
| Report "not in the model" note | T9 (proposed) |

## Sim rules
No rule changed. One config input was added to `eden.js`: `serpentSilentYears` (default 0 = original behaviour). The serpent stays silent for that many years. Tests G1 and G2 check that the default is unchanged and that the setting acts only through the serpent. Help uses the existing player command `food`. Creature count is fixed at 24 in Eden (no setting exists there), so it is shown as fixed.

## Judging predictions
Each Eden report runs two matched worlds with the same seed for the same number of years: one with a different guidance length (0 if yours is above 0, otherwise 3) and one with help flipped. A prediction holds only if the difference is in the predicted direction and at least 5% of the smaller number. P4 is "not tested": the sim has no measure of how well creatures predict their own needs. One matched pair is weak evidence; the report says so.

## Saves
- The Lab island keeps `island-lab-save-v1` and its format (old saves load; new saves stay readable by the old page).
- Eden runs save under `island-lab-theory-v1`. Saved reports: `island-lab-reports-v1` (up to 20).
