# asml-gtmko-overlay-demo

ASML GTMKO stage demo — lot board, overlay/metrology layout viewer, TLDR strip, manual factory fix (HTML/SVG)

A single-page demo a seller can open on a laptop and drive through in about 30 minutes.
It looks like a chip layout tool (KLayout / Virtuoso vibe: µm rulers, layer stack, manhattan
metal) and tells one story: **a die is misaligned at one site, a weak correction would make
things worse, and a targeted one fixes it without touching anything that was already fine.**

Every graphic is generated SVG. There are no images in the app.

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

`npm test` is a handful of assertions over the data model, not a UI suite. It checks that B really
is 22 nm out, that the crude fit really does break A, C and D, that the fix moves nothing it should
not, that the lot KPIs move afterwards, that the board opens fails-first with D07 on top, and that
**Reset demo** puts every one of those numbers back — so nobody edits the demo data and quietly
breaks a claim being made out loud on stage.

## Reset demo

**Reset demo** sits in the titlebar, so it is one click away from every view. It restores the
authored opening state — 75% yield, 22.0 nm at D07, three open fails, no knobs turned, board back
to fails-first — and drops you on the lot board. Safe to mash between runs, including mid-factory-run:
the pipeline is abandoned before the lot is restored, so a run in flight cannot write a fix into the
lot you just reset. A small **Demo reset** flash in the titlebar confirms it fired.

Run the pitch, hand the laptop to the next person, reset, run it again.

## The walkthrough

Five minutes of clicking, in this order. Hit **Reset demo** first if someone has already driven it.

**1. Lot board** (`#/lot`) — twelve dies from lot `LOT-2291-A`. Each card carries four health
chips (Lithography, Overlay, Metrology, Process), a max residual, and a per-site bar strip.

The board leads with a **Lot health · current state** band — one summary surface, big numbers,
sitting above the board controls so it never reads as a row of tabs: **75% predicted yield,
22.0 nm max residual, 3 open fails.**

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

**5. Go back to the lot board** — D07 has moved out of *Needs fix* and into *In spec*, predicted
yield is 83%, open fails is 2. The fix mutated the shared state, so the board reflects it.

Two more dies (D05, D11) are still failing if you want to run the loop a second time — they are the
top of *Needs fix* now. When you are done, **Reset demo** puts all three fails back.

## The TLDR strip

Every view has the same story strip in the same slot, in the same voice: plain English, short
sentences, pain then outcome. It changes colour with the state — amber on the lot board, red on a
failing die, green after a fix. It never gets replaced with raw numbers; the technical chrome sits
below it. Copy lives in [`src/tldr.js`](src/tldr.js) so it can be re-voiced for a given audience
without touching any view code.

## What is real and what is not

Real: the geometry, the residual arithmetic, the two competing model fits, and the state changes.
The crude global-T fit is genuinely computed from the four site residuals, which is why it visibly
breaks the good sites instead of being asserted to.

Not real: the numbers themselves are authored, and the factory pipeline is a simulation on a timer.
**v1 makes no tool calls and no model calls.** Nothing in the UI claims otherwise, and no agent or
vendor is named in the product surface.

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
index.html            app shell: titlebar, Reset demo, TLDR slot, status bar
src/main.js           hash router — #/lot, #/die/:id, #/die/:id/run — and the reset
src/data.js           the 12 dies, both model fits, the fix that mutates state, board order, reset
src/layout-svg.js     the coordinate plane, reticle geometry and the four marks
src/tldr.js           story strip copy and tone
src/ui.js             health chips, layer rail, status bar
src/views/            lot.js · die.js · factory.js
src/styles.css        dark layout-tool theme
```

To change the story, edit `src/data.js` (residuals, which site is the outlier, health per
dimension) and `src/tldr.js` (the words). The views derive everything else.
