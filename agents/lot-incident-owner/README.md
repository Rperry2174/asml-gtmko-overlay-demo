# lot-incident-owner

The intake desk for the ASML GTMKO demo. A lot goes red, this bot wakes, tells
the person it is caught, and hands the money question to
[`yield-impact-analyst`](../yield-impact-analyst/README.md).

> **Experimental, internal only.** It runs on the `grokbot` runtime, which is an
> unannounced surface. The overlay demo in the repo root is the customer-facing
> artifact; the bots are the part of the story that is still being built.

It deliberately does not price anything. Two bots that both quote a dollar
figure is how a floor ends up with two answers.

## Where it sits in the story

```
red lot (D07 / site B, 22 nm)
   └── manual factory run  or  filed recipe change
         └── lot-incident-owner        ← you are here
               ├── SendToUser    "caught, 1,760 wafers behind it"
               └── SendToAgent   → yield-impact-analyst
                                      ├── cost_avoided = $18,480,000
                                      └── row appended to the impact log
```

The app renders exactly this lane at `#/recovery`, and the JSON it shows under
*message body sent to yield-impact-analyst* is the payload
`agent/instructions.md` is written against. If you change one, change both.

## Run it

You need a Cursor API key. Unlike the local runtime, **every** command that
opens a session fails without one, because the turn executes on Cursor's hosted
box rather than this machine.

```bash
cd agents/lot-incident-owner
npm install
npx agent-sdk login          # or: export CURSOR_API_KEY=...
npm run dev                  # http://127.0.0.1:3000/playground
```

One turn from the terminal:

```bash
npx agent-sdk run --message '{"lot_id":"LOT-2291-A","die_id":"D07","site_id":"B","residual_before_nm":22.0,"residual_after_nm":0.6,"wafers_at_risk":1760,"caught_by":"manual factory run","recipe_change_id":null,"cost_model":{"cost_per_wafer_usd":30000,"escape_prob_if_missed":0.35}}'
```

Checks that need no key and no network:

```bash
npm run validate             # discovery diagnostics — must print "no diagnostics"
npm run check                # tsc --noEmit
npm test                     # asserts the grokbot invariants and the handoff
```

From the repo root the same things are `npm run incident:install`,
`incident:dev`, `incident:validate`, `incident:check` and `incident:test`.

## Wiring the teammate

`agent/instructions.md` refers to the analyst as `YIELD_IMPACT_ANALYST_ID`. That
is a placeholder, and it has to be: **Grok Bot ids are assigned by the backend
the first time each agent takes a turn**, so the id does not exist until both
bots have run once.

1. Send one turn to this agent and one to `yield-impact-analyst`, so the backend
   get-or-creates both bots.
2. Read the ids. Either open the Cursor app and copy the id from each bot, or:

   ```bash
   npx agent-sdk info --json          # the resolved agent, from this project
   ```

3. Register the teammate against this bot with UpdateAgent, so `SendToAgent`
   resolves without the model having to guess:

   ```bash
   npx agent-sdk agents update lot-incident-owner \
     --teammate yield-impact-analyst=<the id you just read>
   ```

   If your CLI build does not carry that subcommand, add the teammate in the
   Cursor app's Grok Bot settings — same effect, same field.

4. Replace `YIELD_IMPACT_ANALYST_ID` in `agent/instructions.md` with the real id
   and commit. `npm test` fails if the placeholder is gone **and** nothing is
   there — and it also fails if a `bc_…` id is pasted in before step 3, which is
   the mistake worth catching.

Until the id is patched, address the teammate by name. It works; it is just
looser than an id.

## Why there is so little code

`runtime: "grokbot"` is a third harness, not the local runtime with a different
machine attached, and it rejects most of what an Agent SDK project would
normally carry. From `checkGrokBotRuntimeLimitations` in `@cursor/july`:

| If you add | Result |
| --- | --- |
| `agent/tools/` with `execution: "server"` (or `builtinTools`) | **discovery error** — not reachable from grokbot turns |
| `agent/mcp-connections/` or `agent/host-connections/` | **discovery error** — not wired into grokbot turns |
| `agent/subagents/` | **discovery error** — the box runs its own subagent set |
| `architecture: "v2"` | **discovery error** — cannot pair with grokbot |
| a `tools: [...]` allowlist | fails closed — the box's toolset is what you get |
| `agent/skills/`, `agent/sandbox/workspace/` | warning — materialized locally, the box never sees them |

So the agent is instructions plus a runtime selector. `npm test` encodes the
four hard errors so a later edit trips locally instead of at serve time.

**Only what the agent sends through `SendToUser` is visible to the user.**
Anything else it does on the box never reaches the person.

## Files

```
agent/agent.ts          runtime: "grokbot" + the pinned name
agent/instructions.md   the payload, the ack shape, the handoff, the teammates table
scripts/check-grokbot-invariants.mjs   npm test
```
