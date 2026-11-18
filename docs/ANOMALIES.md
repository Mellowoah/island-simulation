# Island: anomaly log

Each mismatch between the model and the real world is logged here before any fix (research plan, remedy 3). A fix
counts as progressive only if it also moves a pattern it was not aimed at, in the predicted direction; otherwise it is
logged as a patch. Tests are never loosened to pass; a failing pattern becomes a TODO test pointing here.

| # | Logged | Pattern | Expected (source) | Seen | Candidate causes | Status |
| --- | --- | --- | --- | --- | --- | --- |
| A1 | 17 Nov | Deaths of children 5-10 | 0.011 a year (Hadza, Siler fit) | 0.070 (4 islands x 20 y) | children feeding themselves count against family need; who provisions them; contested: grandmothers (Hawkes) not to be added as a fix | open |
| A2 | 17 Nov | Deaths of adults 20-40 | about 0.011-0.012 a year (Hadza) | 4-5 x higher | hunger in droughts and crowded bands; illness still a background rate (double counting) | open (change 6) |
| A3 | 17 Nov | Meat share of diet | about 30% of kcal (Hadza) | about 3% | no bows or poison: the laws do not yet allow them | open |
| A4 | 17 Nov | Camp fires | kept going for days (ethnography) | lit, then often out | tending odds and wood supply assumptions | open |
| A5 | 17 Nov | Men's day range | about 11 km (Hadza) | about 9 km | rare hunting without bows | open (test Y4b TODO) |
| A6 | 18 Nov | Adults' day range, four islands | 5-15 km (Hadza women about 6, men about 11) | 4.6 km mean (4.1-5.2 by island) | water now closer in the wet season (pans and pools fill); plants regrow slower when picked over is not yet biting; one-island tests hid the spread | open (test Y4a TODO) |
| A7 | 18 Nov | Hunger and thirst deaths after the weather came in | small share (Gurven and Kaplan 2007) | 4 islands x 20 y: starvation 31%, thirst 22% (was 25% and 13%); one island fell to 14 people | droughts now carry over 12 months into plants and herds; picked-over patches regrow slower; water holes now dry by level, not by rule; 4 islands is too few to separate this from luck | open: needs the pilot-sized run before any fix |

Fixed, for the record (each was a code error found by tracing a mismatch, 17 Nov): routes over unseen land; gathering paid only at the end of a bout; carers who were not parents could not feed children; families with an empty store never asked; no survival drive; hunting hopes not updated when a trip was cut short; spears approaching too easily; carcass trips stacking into 40+ km days; eleven shared chance keys. 18 Nov: water holes learned as lasting from a June sighting (now: seen with water in Sep-Oct; seen dry in the dry season unlearns it); stalking moved at least one tile per time slice (now builds up by distance); exploring ignored the walk back (now must fit the day).

## A8 — inheritance pulls back to the founders' mean (18 Nov 2026, found by the Price tool, idea 10)
Children's traits regress toward a fixed 1 (body) or 0.5 (mind), not toward the population as it now is: child = 1 + h(midparent − 1) + noise. So whatever selection moves, transmission moves back: the population cannot evolve away from where it started. Seen as transmission +0.014 ± 0.004 on body mass while parents average below 1. Standard quantitative genetics (breeding value = midparent breeding value + Mendelian noise of half the additive variance; phenotype = breeding value + environment) would let means move. Not changed: a modelling decision.
**Resolved 18 Nov 2026** (Robert approved): breeding values with Mendelian noise; see THEORY-CHECK 'Inheritance fixed (A8)'.
