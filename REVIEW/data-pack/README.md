# Island Lab data pack for outside review (16 Nov 2026)

Branch `claude/lab-features`, commit after `4aa46ff`. Made by `tools/data-pack.mjs`. Nothing here was picked by hand: every seed and every run that was made is in the files.

**Purpose:** let a reviewer check, from the data alone, that the simulation does what its rules say, and that the comparisons Claude reports are computed correctly.

## What was run
- Seeds **61 to 80** (20 islands; not used in any earlier tuning). Same seed + same settings always gives the same history.
- Eden worlds: **20 years** each (1 sim day = 1 year = 1440 ticks; needs and movement run per tick).
- Lab islands: **10 days** each (1 tick = 1 minute).
- 11 worlds per seed = 220 runs. Each variant changes only what is listed; everything else is default.

| Variant | Change from default |
|---|---|
| `base` | none (original Eden rules) |
| `guidance50`, `guidance0` | Creator steps in for a creature in 50% / 0% of months before the fall |
| `help` | 40 food left near the start every 120 ticks for the first 10 years, then none |
| `wayback` | after the fall, a yearly call; those who turn back are led and fed |
| `wayback_demons3` | the above plus 3 tempters |
| `demons3` | 3 tempters, no way back |
| `lab_base` | Lab island defaults (food 60 per source, regrowth 0.03) |
| `lab_scarce` | food 15, regrowth 0.0075 |
| `lab_scarce_notalk` | scarce, creatures cannot tell each other anything |
| `lab_scarce_lies25` | scarce, 25% of passed-on messages are false |

## Files
- `parameters.json`: every number the sims use (`sim`, `eden`, `lab`), the random-stream registry, the variants.
- `eden_runs.csv`: one row per seed × Eden variant (140 rows). Empty cell = not applicable.
- `lab_runs.csv`: one row per seed × Lab variant (80 rows).
- `choices.csv`: every recorded free choice (20,619 rows; each run keeps its most recent 500 of each kind). `kind` = `tree` (deceiver at the tree), `call` (Creator's call after the fall), `whisper` (tempter to a restored creature). `U` = the creature's weighing, `P` = its chance, `draw` = its random draw, `yes` = 1 if it ate / turned back / left.
- `SUMMARY.md`: Claude's own paired comparisons and checks, for the reviewer to reproduce.

## The rules behind the choice records
All three use `P = 1 / (1 + exp(−U / temperature))`, `temperature = 0.5`, and the outcome is exactly `draw < P`. Nobody is ever forced: P is never 0 or 1.
- **tree:** `U = wFood·(hunger/100) + wEye·beauty + wWisdom·(curiosity·credence) − wWarn·warning` with 1, 0.6 × 0.5, 1.2, 3. `credence = 1 − (1 − 0.15)^hearings`.
- **call:** `U = 1·need + 1·word − 1.2·(curiosity·credence) − 2.2`, `need = max(hunger, thirst, 100 − health)/100`, `word = 0.5 + 0.5·warning`. One call per released adult per year.
- **whisper:** `U = 1·(hunger/100) + 1.2·(curiosity·credence) − 3·warning` (the tree's weighing without the fruit's look).

## Measures
- `hardship` = mean of (hunger, thirst, 100 − energy, 100 − health); Lab: (hunger, 100 − energy, 100 − safety, 100 − social). 0 = no unmet need.
- `bar` = each creature's own running average of its hardship; `above_bar` = share with hardship more than 5 points over their own bar. A measure only; no creature acts on it.
- `survival_Ny_pct` = of those alive at the fall, share alive N years later. Dead creatures stay in every count.
- `own_food_later` = food taken from the island itself (not from help) in years 10 to 20, per creature per year.
- Paired statistics: gap per seed (A − B), mean, 95% range by paired t (df 19, t = 2.093).

## What Claude reads from this (please try to break each one)
1. **Help:** more alive at the end (+22, range 17 to 27) but less self-gathered food later (−4.2, range −5.0 to −3.4), on 19 of 20 islands each. Help was not assumed good or bad.
2. **Guidance amount:** no clear effect on the chance of eating, the year of the fall, or survival after it. P1 and P2 are **not supported and not refuted** on this data.
3. **Hardship is higher while guided than after release** (19.4 vs 11.2, 19 of 20 islands). Claude's reading: the Creator only steps in when a need crosses its guidance line (hunger 30), so guided creatures sit near that line; released creatures who survive learn to eat earlier, and the dead are no longer averaged. Possible survivor effect. Needs checking.
4. **Way back:** fewer deaths (−3.9) and more alive (+9.4). Partly built in: the restored are fed by rule.
5. **The restored show MORE hardship than the rest** (21.5 vs 8.4, 20 of 20). This does not match "the Creator brings peace". Two candidate causes: selection (need raises the chance of turning back) and the rule itself (guidance acts only at the guidance lines; provision only at 79). Claude thinks the rule under-delivers what Robert described and should be put to him.
6. **Demons:** with a way back, 3 tempters cut those who turn back by about a quarter (−6.2) and add about one death per island. With no way back they change nothing but belief (deaths identical on all 20), which is by design.
7. **Lab island:** scarcity kills (22 → 7 alive of 24). Under scarcity, telling each other helps a little (+1.3 alive, +6 points knowledge). 25% lies lower trust (−4.3) but show no clear effect on lives.

## Checks the reviewer can repeat
- In `choices.csv`, `yes` must equal `draw < P` on every row (Claude finds 0 exceptions), and mean `P` should match the share of `yes` within chance for each kind. Note `whisper`: mean P 1.23% vs 0.84% yes on 3,216 rows, about 2 standard errors low. Chance, or a flaw? Please test.
- `draw` should look uniform on 0 to 1 within each kind and be unrelated to `P`.
- `demons3` must equal `base` on every non-belief column.
- Reproduce any row: `node tools/data-pack.mjs <variant> <dir>`; or in the page, same seed and settings.

## Limits
One model, one set of weights, chosen by Claude and listed in `parameters.json`. Results say what follows from these rules. They say nothing about real people, and several comparisons were made at once, so one clear line among many can be luck.
