# grok-coder

The hard leg of the coding track, and the reason the track exists. Overlay,
metrology, lithography, residuals, model fits, yield, process windows — the
coding asks where a fast generalist produces something that compiles, reads
well, and is wrong by a factor nobody catches.

This is a **Deployed Agent**, not a Grok Bot.

## What it does differently

| | `mistral` | `grok-coder` |
| --- | --- | --- |
| effort | low, `fast` | high, not `fast` |
| tools | full standard toolset | full standard toolset |
| on a residual fit | hands it back to the router | fits it, states the assumptions, runs the script |

Three habits are pushed hard in [`agent/instructions.md`](agent/instructions.md)
because they are what make the difference visible on stage:

- **Assumptions get listed** before the result that rests on them, so the
  person can disagree with one line instead of the whole answer.
- **Units live in the code** — `residual_before_nm`, `drift_ppm`,
  `wafers_at_risk` — because a nm/µm mismatch is the most common way this class
  of code is wrong.
- **The answer is a script that was run**, seeded and with intermediates
  printed, not a number asserted in prose.

There is no `tools` allowlist. An agent that cannot run a script cannot check
its own arithmetic, and checking the arithmetic is the job.

## Run it

Useful on its own, and the router needs it mounted alongside to delegate:

```bash
npm install
npx agent-sdk login          # or: export CURSOR_API_KEY=...
npm run dev                  # http://127.0.0.1:3000/playground
```

Checks that need no key and no network:

```bash
npm run validate             # discovery diagnostics
npm run check                # tsc --noEmit
```

From the repo root: `npm run grok:install`, `grok:dev`, `grok:validate`,
`grok:check`. Serving all three coding agents together is in the
[router README](../asml-router/README.md#run-the-trio).

## A prompt worth demoing

The overlay demo in the repo root is built on one model:

```
r(x, y) = T + R·[x y]ᵀ
```

The interesting question is not how far to slide the stamp — it is which terms
to fit at all. Fitting a global `T` across every site drags the good marks off
target to chase the bad one; fitting `T + R` locally at the site that moved
leaves the rest alone. `src/data.js` carries both fits and the four site
residuals on D07.

> Fit T and T + R to the four site residuals on D07 in `src/data.js`, report
> each fit's per-site residual in nm, and say which sites the global fit makes
> worse.

Ask `mistral` the same thing and watch it decline.

## Deploy it

```bash
agent-sdk deploy --dir . --slug grok-coder \
  --repo https://github.com/Rperry2174/asml-gtmko-overlay-demo \
  --ref <branch> --path agents/grok-coder
```

Deploy this before `asml-router` if the router is going to reach it over its
alias URL — the router's README explains that wiring.

## Files

```
agent/agent.ts          local runtime, high-effort model, no tool allowlist
agent/instructions.md   the domain, the assumption/unit/reproducibility rules, the reply shape
```
