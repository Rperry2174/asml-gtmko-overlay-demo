# yield-impact-analyst

The second bot in the ASML GTMKO recovery lane.
[`lot-incident-owner`](../lot-incident-owner/README.md) hands it a caught
overlay miss; it puts a dollar figure on the miss and appends a row to the
impact log.

> **Experimental, internal only.** It runs on the `grokbot` runtime, which is an
> unannounced surface. The overlay demo in the repo root is the customer-facing
> artifact; the bots are the part of the story that is still being built.

## The one formula

```
cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed
```

Defaults are `8500` and `0.35`. On the hero die that is
`60 × $8,500 × 0.35 = $178,500`, which is the figure the app prints at
`#/recovery` and the number `npm test` in the repo root asserts.

`escape_prob_if_missed` is the hedge that keeps the claim defensible: catching a
miss is worth the chance it would have shipped, not a whole wafer. The
instructions say so, and say not to quietly raise it.

## The impact log

- Sheet: <https://docs.google.com/spreadsheets/d/1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY/edit>
- tab: `impact_log`, 14 columns, one row per priced incident, appended

The column list lives in `agent/instructions.md` and is duplicated in
[`src/config/artifacts.js`](../../src/config/artifacts.js) so the app can build
the same row. The repo-root `npm test` fails if the two ever disagree — that is
the only reason the duplication is tolerable.

Appending needs a credential the runtime does not carry:

- With `GOOGLE_SHEETS_ACCESS_TOKEN` in the box's environment, the agent appends
  with `curl` against the Sheets `values:append` API.
- Without it, the agent says the row did not land and emits a tab-separated line
  to paste. It is instructed never to fabricate a confirmation.

**Do not commit a token.** `.gitignore` here covers `.env`, and `npm test`
fails if a `ya29.…` or `AIza…` string ends up in the instructions.

## Run it

You need a Cursor API key. Unlike the local runtime, **every** command that
opens a session fails without one, because the turn executes on Cursor's hosted
box rather than this machine.

```bash
cd agents/yield-impact-analyst
npm install
npx agent-sdk login          # or: export CURSOR_API_KEY=...
npm run dev                  # http://127.0.0.1:3000/playground
```

One turn from the terminal:

```bash
npx agent-sdk run --message 'LOT-2291-A die D07 site B, 22.0 nm before / 0.6 nm after, 60 wafers at risk, caught by manual factory run. Price it and log it.'
```

Checks that need no key and no network:

```bash
npm run validate             # discovery diagnostics — must print "no diagnostics"
npm run check                # tsc --noEmit
npm test                     # grokbot invariants, the formula, and no leaked keys
```

From the repo root the same things are `npm run impact:install`, `impact:dev`,
`impact:validate`, `impact:check` and `impact:test`.

## Wiring the teammate

`agent/instructions.md` refers to the incident owner as `LOT_INCIDENT_OWNER_ID`.
That is a placeholder, and it has to be: **Grok Bot ids are assigned by the
backend the first time each agent takes a turn**, so the id does not exist until
both bots have run once.

1. Send one turn to this agent and one to `lot-incident-owner`, so the backend
   get-or-creates both bots.
2. Read the ids from the Cursor app, or with `npx agent-sdk info --json` in each
   project.
3. Register the teammate with UpdateAgent so `SendToAgent` resolves:

   ```bash
   npx agent-sdk agents update yield-impact-analyst \
     --teammate lot-incident-owner=<the id you just read>
   ```

   If your CLI build does not carry that subcommand, add the teammate in the
   Cursor app's Grok Bot settings — same effect, same field.

4. Replace `LOT_INCIDENT_OWNER_ID` in `agent/instructions.md` with the real id
   and commit.

Until the id is patched, address the teammate by name.

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

So the Sheets append is the box's own `curl`, not a server tool, and the agent
is instructions plus a runtime selector. `npm test` encodes the four hard errors
so a later edit trips locally instead of at serve time.

**Only what the agent sends through `SendToUser` is visible to the user.**

## Files

```
agent/agent.ts          runtime: "grokbot" + the pinned name
agent/instructions.md   the formula, the reply shape, the 14 columns, the teammates table
scripts/check-grokbot-invariants.mjs   npm test
```
