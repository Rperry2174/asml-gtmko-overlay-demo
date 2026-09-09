# asml-gtmko-overlay-demo

ASML GTMKO stage demo — lot board, overlay/metrology layout viewer, recovery rail, TLDR strip (HTML/SVG)

A single-page demo a seller can open on a laptop and drive through in about 30 minutes.
It looks like a chip layout tool (KLayout / Virtuoso vibe: µm rulers, layer stack, manhattan
metal) and tells one story in three words: **caught → priced → assigned.**

A die is misaligned at one site. A weak correction would make things worse and a targeted one
fixes it without touching anything that was already fine — that is the catch. Then the same miss
gets a dollar figure, a row in a log, and an owner, because catching a bad die is the half that
already sort of works and pricing it is the half that does not.

Every graphic is generated SVG. There are no images in the app.

For the stage running order, see [`docs/TEAM_WALKTHROUGH.md`](docs/TEAM_WALKTHROUGH.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

The app is written as native ES modules with no build step, so a plain static server works too:

```bash
npx serve .          # or: python3 -m http.server
```

`npm run build` / `npm run preview` produce and serve a static bundle if you want to host it.

```bash
npm test             # asserts the numbers the pitch depends on
```

`npm test` is a handful of assertions over the data model and the recovery job, not a UI suite. It
checks that B really is 22 nm out, that the crude fit really does break A, C and D, that the fix
moves nothing it should not, that the lot KPIs move afterwards, that the board opens fails-first
with D07 on top, and that **Reset demo** puts every one of those numbers back.

It also guards the money: that the cost model is still $8,500 a wafer at 0.35 escape probability,
that D07 prices at $178,500 and the open lot at $303,450, that watch items are priced but not
counted, that fixing D07 drops the headline by exactly its own figure, and that the 14 columns
`yield-impact-analyst` is briefed on are the same 14 the app writes. Nobody should be able to edit
the demo data and quietly break a claim being made out loud on stage.

## Artifacts

The recovery half of the story writes to three places. Two of them are stubs today, on purpose,
and the UI says which:

| what | where | state |
| --- | --- | --- |
| Yield impact log | [Google Sheet](https://docs.google.com/spreadsheets/d/1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY/edit) | live — one row per priced incident |
| Weekly ROI pack | Google Slides | pending — `SLIDES_URL_PENDING` in [`src/config/artifacts.js`](src/config/artifacts.js) |
| Backlog | Jira | stub — two authored cards, `ASML-101` and `ASML-102` |

Drop the real Slides URL into that one constant and the rail turns the pending badge into a link.
Nothing else has to change.

## Reset demo

**Reset demo** sits in the titlebar, so it is one click away from every view. It restores the
authored opening state — 75% yield, 22.0 nm at D07, three open fails, $303,450 at risk, no knobs
turned, no open incident, board back to fails-first — and drops you on the lot board. Safe to mash
between runs, including mid-factory-run:
the pipeline is abandoned before the lot is restored, so a run in flight cannot write a fix into the
lot you just reset. A small **Demo reset** flash in the titlebar confirms it fired.

Run the pitch, hand the laptop to the next person, reset, run it again.

## The walkthrough

Ten minutes of clicking, in this order. Hit **Reset demo** first if someone has already driven it.

**1. Lot board** (`#/lot`) — twelve dies from lot `LOT-2291-A`. Each card carries four health
chips (Lithography, Overlay, Metrology, Process), a max residual, a per-site bar strip, and what
the die is worth if nobody catches it.

The board leads with a **Lot health · current state** band — one summary surface, big numbers,
sitting above the board controls so it never reads as a row of tabs: **75% predicted yield,
22.0 nm max residual, 3 open fails, $303k at risk.**

That fourth number is `wafers_at_risk × $8,500 × 0.35` summed over the open fails, so the cost of
the problem is on screen before anyone asks for it. Watch items carry a wafer count too but are
left out of the sum — pricing a die nobody is going to touch inflates the headline.

Below it the dies are grouped **fails first** — *Needs fix* (worst residual at the top, so D07 and
its 22 nm is the first card on screen), then *Watching*, then *In spec*. Nobody has to hunt a
wafer grid for the red ones. The **Wafer map** button in the board controls puts the physical
row/col order back if someone asks for it. Die IDs never change; only the display order does.

**2. Open D07** — the split view. Golden on the left is design intent. Measured on the right is
what actually printed. Marks A, C and D landed inside 1 nm. Site B is 22 nm out, drawn in red
with a Δx / Δy / |r| callout.

**3. Press "Preview the crude fit (T only)"** — this is the argument. Fit one global translation
across all four sites and the panel repaints: B barely improves (22.0 → 16.5 nm) while A, C and D
get dragged out of spec. A weak model slides the whole stamp.

**4. Press "Run fix on this die →"** — the manual factory run. Five steps animate: read metrology,
fit model, propose process knobs, re-sim overlay, pass/fail. Site B slides home and turns from red
to gold, the residual counts down to 0.6 nm, and the knob table shows three green rows at B with
the four global rows untouched. The run log says what changed.

The other lane is **"Run Cloud Agent fix (opens a PR)"**, next to it on the die view: the same miss
handed to a coding task instead of to the floor. It opens the identical incident with the PR check
already ticked, and leaves the die out of spec — because a PR is not a knob.

**5. The recovery rail** — the run finishes and a recovery panel appears under the verdict. The
full version is at `#/recovery`, in the titlebar from any view, and linked from the lot board.

The die is green; the incident is not closed. Five checks say so:
**PR · Impact logged · Shift notified · Weekly ROI · Backlog.** Two Grok Bots are on the lane —
`lot-incident-owner` woke on the red lot and handed the priced question to `yield-impact-analyst`.
Expand *message body sent to yield-impact-analyst* to show the payload; it is the same JSON the
agent project is written against, not a mock-up.

**6. Press "Log impact"** — the analyst prices it out loud:
`60 wafers × $8,500 × 0.35 = $178,500 avoided`, and a 14-column row appears. The append is a real
`POST /api/impact/append`, and the badge reports which of three things happened — appended to the
live Sheet, written to the dev server's local log, or held in the app. It never claims Sheets when
it did not reach Sheets. **Notify shift**, **Show weekly pack** and **Show backlog stub** close the
other three; the weekly pack says *pending* because the deck has no URL yet, which is the honest
state rather than a dead link.

**7. Go back to the lot board** — D07 has moved out of *Needs fix* and into *In spec*, predicted
yield is 83%, open fails is 2, and $ at risk has dropped by exactly D07's $178,500. The fix mutated
the shared state, so the board reflects it.

Two more dies (D05, D11) are still failing if you want to run the loop a second time — they are the
top of *Needs fix* now. When you are done, **Reset demo** puts all three fails back and drops the
open incident with them.

## The TLDR strip

Every view has the same story strip in the same slot, in the same voice: plain English, short
sentences, pain then outcome. It changes colour with the state — amber on the lot board, red on a
failing die, green after a fix. It never gets replaced with raw numbers; the technical chrome sits
below it. Copy lives in [`src/tldr.js`](src/tldr.js) so it can be re-voiced for a given audience
without touching any view code.

The arc through all of it is **caught → priced → assigned**. Scrap and re-work still come up, but
as consequences rather than as the hero — the argument the demo is making is that a miss nobody
prices is a miss nobody owns.

## What is real and what is not

Real: the geometry, the residual arithmetic, the two competing model fits, the cost formula, the
state changes, and the impact-log append. The crude global-T fit is genuinely computed from the
four site residuals, which is why it visibly breaks the good sites instead of being asserted to.
The append genuinely POSTs, genuinely forwards to Google Sheets when the dev server has a token,
and genuinely reports when it did not.

Not real: the numbers themselves are authored, the factory pipeline is a simulation on a timer, the
Cloud Agent PR card is authored, and the two Grok Bots are drawn as a lane rather than called live
from the app. **The app makes no model calls.** Nothing in the UI claims otherwise, and no vendor is
named in the product surface.

One display convention worth knowing before you present it: mark offsets are drawn **×100**, because
22 nm on a 40 µm plane is a thousandth of a pixel and would be invisible. The panel says so on
screen. Every printed residual number is the real value.

## The model, in one line

```
r(x, y) = T + R·[x y]ᵀ
```

The pitch is not *how far do we slide the stamp* — it is *which terms do we fit at all*. Fitting a
single global `T` across every site drags the good marks off target to chase the bad one. Fitting
`T + R` locally at the site that actually moved leaves the rest alone. On D07 that is a 14 nm shift
and a 0.21° rotation at B, and nothing anywhere else.

## Layout

```
index.html               app shell: titlebar, Reset demo, TLDR slot, status bar
vite.config.js           the dev-only /api/impact/append endpoint
src/main.js              hash router — #/lot, #/die/:id, #/die/:id/run, #/recovery — and the reset
src/data.js              the 12 dies, both model fits, the fix, wafers at risk, board order, reset
src/config/artifacts.js  Sheet / Slides / Jira, the cost model, the 14 impact-log columns
src/recovery.js          the five-check incident, the bot handoff, the append
src/lib/impact-log.js    the append call and its three transports
src/layout-svg.js        the coordinate plane, reticle geometry and the four marks
src/tldr.js              story strip copy and tone
src/ui.js                health chips, layer rail, status bar
src/views/               lot.js · die.js · factory.js · recovery.js
src/styles.css           dark layout-tool theme
docs/TEAM_WALKTHROUGH.md the 30-minute stage outline and who owns what next
agents/                  three separate Agent SDK projects — see below
```

To change the story, edit `src/data.js` (residuals, which site is the outlier, health per
dimension, wafers at risk), `src/config/artifacts.js` (the money and the links) and `src/tldr.js`
(the words). The views derive everything else.

## The cost model

One formula, in [`src/config/artifacts.js`](src/config/artifacts.js), and nothing in the app
prices anything a second way:

```
cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed
```

Defaults are `8500` and `0.35`. `escape_prob_if_missed` is the honest hedge — catching a miss is
worth the chance it would have shipped, not a whole wafer. On D07 that is
`60 × $8,500 × 0.35 = $178,500`.

The 14 impact-log columns live in the same file and are duplicated in prose in
`agents/yield-impact-analyst/agent/instructions.md`, because a model cannot import a module.
`npm test` fails if the two lists ever disagree, which is the only thing making that duplication
tolerable.

## Agent SDK projects

Three independent projects live under [`agents/`](agents/). None of them is imported by the Vite
app, `@cursor/july` is **not** a dependency of it, and `npm run dev` is unaffected by all three.
All three run on the experimental `grokbot` runtime, so a turn executes on Cursor's hosted box and
needs a Cursor API key.

| project | role |
| --- | --- |
| [`lot-incident-owner`](agents/lot-incident-owner/README.md) | intake. Acks the catch, hands the priced question to the analyst |
| [`yield-impact-analyst`](agents/yield-impact-analyst/README.md) | prices the miss with the formula above, appends the impact-log row |
| [`weather-agent`](agents/weather-agent/README.md) | rehearsal only — see below |

```bash
npm run incident:install && npm run incident:validate
npm run impact:install   && npm run impact:validate
```

`incident:*` and `impact:*` also carry `dev`, `check` and `test`, the same way `weather:*` does.
`validate`, `check` and `test` need no key and no network.

Teammate ids are placeholders (`YIELD_IMPACT_ANALYST_ID`, `LOT_INCIDENT_OWNER_ID`) because Grok Bot
ids are assigned by the backend on a bot's first turn. Each README has the UpdateAgent steps for
patching the real ids in once both bots have run.

### `agents/weather-agent` — rehearsal only

[`agents/weather-agent`](agents/weather-agent/README.md) reads a forecast for a city and decides
whether an outdoor plan holds or moves. It has **nothing to do with the ASML story** — it exists
only to rehearse a real Agent SDK turn before the hackathon, and it must not appear in a customer
deck, a demo, or any copy a customer reads. The two agents above are the ones on the lane.

Like them it runs on the experimental `grokbot` runtime, so the turn executes on Cursor's hosted
Grok Bot box rather than locally. That means it needs credentials for every command that opens a
session:

```bash
npm run weather:install
cd agents/weather-agent && npx agent-sdk login   # or export CURSOR_API_KEY=...
cd ../.. && npm run weather:dev                  # http://127.0.0.1:3000/playground
```

Checks that need no key: `npm run weather:validate`, `weather:check`, `weather:test`.

After one successful turn, expect a Grok Bot named **`weather-agent`** in the Cursor app — the
backend get-or-creates it by (user, agent name). If it is missing, create it with that exact
name first and re-send. Only content the agent passes to `SendToUser` is visible to the user.

**Experimental and internal only — do not demo the weather agent to customers.** The overlay demo
above is the customer-facing artifact. The agent README covers the rest, including the capabilities
the grokbot runtime refuses outright.
