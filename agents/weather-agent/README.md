# weather-agent

An Agent SDK (`@cursor/july`, CLI `agent-sdk`) hello-world for the GTMKO
hackathon. Give it a city and an outdoor plan; it pulls a forecast and says
whether the plan **holds** or **moves**.

> **Experimental, internal only. Do not demo this to customers.**
> It runs on the `grokbot` runtime, which is an unannounced surface. The overlay
> demo on `main` is the customer-facing artifact; this is not.

It has no tools and no MCP connections, on purpose — see
[Why there is so little code](#why-there-is-so-little-code).

## Run it

You need a Cursor API key. Unlike the local runtime, **every** command that
opens a session fails without one, because the turn executes on Cursor's
hosted box rather than this machine.

```bash
cd agents/weather-agent
npm install
npx agent-sdk login          # or: export CURSOR_API_KEY=...
```

Then either drive it from the playground:

```bash
npm run dev                  # http://127.0.0.1:3000/playground
```

...or send one turn from the terminal:

```bash
npx agent-sdk run --message "Picnic in Austin tomorrow 2pm — keep it or move it?"
```

Checks that need no key and no network:

```bash
npm run validate             # discovery diagnostics — must print "no diagnostics"
npm run check                # tsc --noEmit
npm test                     # asserts the grokbot invariants below
npx agent-sdk info --json    # resolved name, runtime, toolset
```

From the repo root the same things are `npm run weather:install`,
`weather:dev`, `weather:validate`, `weather:check` and `weather:test`.

## After the first turn: the Grok Bot

The backend **get-or-creates a hosted Grok Bot keyed on (your user, the agent
name)**. So after one successful turn you should see a Grok Bot named
**`weather-agent`** in the Cursor app. Two things follow from that:

- If it is missing, create a Grok Bot named exactly `weather-agent` in the app
  first, then send the turn again.
- The name is identity, not a label. Renaming the package, the directory, or
  `name` in `agent/agent.ts` points turns at a *different* bot and leaves the
  conversation history behind. All three currently say `weather-agent`, and
  `npm test` fails if they ever disagree.

**Only what the agent sends through `SendToUser` is visible to the user.**
Anything else it does on the box — shell, reasoning, tool output — never
reaches the person. `agent/instructions.md` says so explicitly; keep that line
if you rewrite them.

## Why there is so little code

`runtime: "grokbot"` is not a variant of the local runtime with a different
machine attached. It is a third harness, and it rejects most of what an Agent
SDK project would normally carry. From `checkGrokBotRuntimeLimitations` in
`@cursor/july`:

| If you add | Result |
| --- | --- |
| `agent/tools/` with `execution: "server"` (or `builtinTools`) | **discovery error** — not reachable from grokbot turns |
| `agent/mcp-connections/` or `agent/host-connections/` | **discovery error** — not wired into grokbot turns |
| `agent/subagents/` | **discovery error** — the box runs its own subagent set |
| `architecture: "v2"` | **discovery error** — cannot pair with grokbot |
| a `tools: [...]` allowlist | fails closed — the box's toolset is what you get |
| `agent/skills/`, `agent/sandbox/workspace/` | warning — materialized locally, the box never sees them |
| `cloud: {...}`, `local.sandbox` | warning — unused here |

So the agent is instructions plus a runtime selector, and the forecast comes
from the box's own `curl` against keyless public APIs (Open-Meteo, `wttr.in`)
rather than from a server tool. `npm test` encodes the four hard errors so a
later edit trips locally instead of at serve time.

One more thing that looks wrong but is not: `agent-sdk info` prints a `model`
(`grok-4.5`). Grokbot ignores it — the hosted harness picks the model. Setting
`model` in `agent/agent.ts` would change nothing.

## Files

```
agent/agent.ts          runtime: "grokbot" + the pinned name
agent/instructions.md   the whole agent: forecast, decision rule, reply shape
scripts/check-grokbot-invariants.mjs   npm test
```

To change the decision, edit `agent/instructions.md`. The thresholds
(60% rain, thunderstorms, 40 km/h wind, 2–35 °C) live there so a stage run is
repeatable rather than re-argued each turn.
