# The cost model, and every assumption in it

One formula prices the whole demo:

```
cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed
```

The constants live in [`src/config/artifacts.js`](../src/config/artifacts.js) —
`COST_MODEL`, `TOOL_SPEC` and `ASML_PUBLIC` — and the per-die drift windows live
in [`src/data.js`](../src/data.js). Nothing else in the app prices anything a
second way, and `npm test` fails if any of these numbers move without the
assertions moving with them.

This file exists so that a number on screen can be traced, out loud, in front of
a customer. Three of the inputs are public and cited. Two are ours, and are
labelled as ours wherever they appear.

## What is public

| figure | value | where it comes from |
| --- | --- | --- |
| ASML FY2025 total net sales | €32.7bn (€32,667m, US GAAP) | [ASML Q4 and full-year 2025 results, 28 Jan 2026](https://www.asml.com/en/news/press-releases/2026/q4-2025-financial-results) |
| ASML FY2025 net system sales | €24.5bn | same release / [2025 Annual Report](https://www.asml.com/en/investors/annual-report/2025/financials) |
| ASML FY2025 net service and field option sales | €8.2bn | same |
| Systems sold in FY2025 | 535 units | 2025 Annual Report, *At a glance* |
| Backlog at end of FY2025 | €38.8bn | Q4 2025 results release |
| TWINSCAN NXE:3800E throughput | 220 wafers/hour at 30 mJ/cm² | 2025 Annual Report — shipped at full productivity specification in 2025 |
| TWINSCAN NXE:3800E matched machine overlay | ≤ 0.9 nm | same |

The revenue figures are **scale reference only**. They are not part of the
formula and no number on screen is derived from them. They are here so the room
can size the demo against the customer it is being shown to: a $31.2M lot at
risk is roughly 0.1% of ASML's reported annual net sales, which is the right
order of magnitude for one lot on one tool on one shift — big enough to matter,
small enough to be credible.

The throughput figure **is** in the formula. It is what turns a drift window
into a wafer count.

## What is ours

| assumption | value | why |
| --- | --- | --- |
| `cost_per_wafer_usd` | `30000` | A 2 nm-class 300 mm wafer, which is the node the NXE:3800E is sold to print. No foundry publishes wafer prices; trade reporting and market-research estimates converge on roughly $30k for N2 against $18–22k for N3. Treat it as an estimate and say so. |
| `escape_prob_if_missed` | `0.35` | The share of at-risk wafers that would have shipped before anyone noticed. Nobody publishes this. It is the honest hedge in the number: catching a miss is worth the chance it escaped, not a whole wafer. |
| drift windows per die | 0.5 h – 8.0 h | How long a site sat out of spec before the overlay check that would have caught it. Authored per die, because the story needs one hero incident and two smaller ones, not an average. |

Nothing in this repo is ASML internal data. There is no yield model, no
customer figure, and no claim about what any fab actually loses.

## How a wafer count is built

`wafers_at_risk` is not authored. It is the drift window at the tool's published
throughput:

```
wafers_at_risk = drift_window_hours * 220 wph
```

| die | status | drift window | wafers at risk | cost avoided |
| --- | --- | --- | --- | --- |
| D07 | fail (hero) | 8.0 h | 1,760 | $18,480,000 |
| D05 | fail | 3.5 h | 770 | $8,085,000 |
| D11 | fail | 2.0 h | 440 | $4,620,000 |
| D03 | watch | 1.0 h | 220 | $2,310,000 — priced, not counted |
| D09 | watch | 0.5 h | 110 | $1,155,000 — priced, not counted |

**$ at risk on the lot board is $31,185,000** — the three open fails only. Watch
items carry a wafer count and a price, and are deliberately left out of the sum:
pricing a die nobody is going to touch inflates the headline.

One at-risk wafer is worth `$30,000 × 0.35 = $10,500` to catch, which is the
figure to quote when a wafer count is missing rather than guessing the count.

## Re-pricing it for a different room

Change `COST_MODEL.costPerWaferUsd` for a different node, or the `hours` on a
die in `src/data.js` for a different sampling interval, and every surface —
board headline, die card, status strip, recovery rail, impact-log row and both
agent briefs — follows. Then run `npm test`, which will tell you exactly which
claims you just changed.
