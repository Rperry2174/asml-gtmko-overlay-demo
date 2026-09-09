# asml-router

The front door of the coding track. It reads one ask, decides whether the code
has to be right about fab physics, and hands the whole turn to
[`grok-coder`](../grok-coder/README.md) or [`mistral`](../mistral/README.md).
It does not write code itself.

This is a **Deployed Agent**, not a Grok Bot. It takes the Agent SDK's default
local runtime, which is what lets it carry MCP connections at all — the two
bots on the yield lane run on `grokbot`, where an MCP connection is a discovery
error.

## The routing rule

| ask | goes to |
| --- | --- |
| overlay, metrology, lithography, residuals, model fits, yield, process windows, units, numerics | `grok-coder` |
| CRUD, renames, boilerplate, small refactors, glue, tests with no domain science | `mistral` |
| genuinely ambiguous | `grok-coder` — a wrong number costs more than a slow one |

The full rule, including the tie-breakers and the reply shape, is
[`agent/instructions.md`](agent/instructions.md). That file is the agent; this
one is the operator's manual.

## Run the trio

The router is not useful alone — it has to reach its two peers. There are two
ways to arrange that, and they are the same two ways the deployment story
splits.

**`agent-sdk serve --dir agents` is not one of them.** `serve` takes a single
`--dir` and mounts every child project under it, and `agents/` also holds the
yield lane, which the published package refuses outright:

```
runtime: "grokbot" is not available in the published @cursor/july package
```

### One process, peer slugs

What `{ agent: "<slug>" }` is for. It needs a serve root containing only these
three projects, so point `--dir` at a directory holding the coding track and
nothing else:

```bash
npx agent-sdk login          # or: export CURSOR_API_KEY=...
npx agent-sdk serve --dir <coding-only-dir> --dev
# router playground: http://127.0.0.1:3000/asml-router/playground

npx agent-sdk chat --url http://127.0.0.1:3000/asml-router \
  --message "Fit T + R to the four site residuals on D07 and report the fit in nm."
# asml-router → grok-coder.ask → grok-coder's own session → reply
```

No environment variables. `serve` throws at startup if a peer slug is missing,
so a mount you forgot fails immediately rather than at delegation time.

### Three processes, peer URLs

Works from the tree as it stands, and rehearses exactly the wiring a deployed
router uses. Each agent serves itself in single mode; the router is pointed at
the other two:

```bash
npm --prefix agents/mistral    run serve -- --port 3001
npm --prefix agents/grok-coder run serve -- --port 3002

MISTRAL_MCP_URL=http://127.0.0.1:3001/v1/mcp \
GROK_CODER_MCP_URL=http://127.0.0.1:3002/v1/mcp \
  npm --prefix agents/asml-router run dev -- --port 3000
```

No alias tokens on loopback — `serve` admits direct local callers by default.
`agent-sdk info` on the router prints the transport each connection resolved
to, which is the quickest way to confirm the override took.

Checks that need no key and no network:

```bash
npm run validate             # discovery diagnostics
npm run check                # tsc --noEmit
```

From the repo root the same things are `npm run router:install`,
`router:dev`, `router:validate` and `router:check`.

## Deploy it

```bash
agent-sdk deploy --dir . --slug asml-router \
  --repo https://github.com/Rperry2174/asml-gtmko-overlay-demo \
  --ref <branch> --path agents/asml-router
```

Deploy the two peers first, the same way with their own slugs and paths.

**Managed hosting gives every deployment its own process, so the peer slugs do
not resolve across deployments.** `agent-sdk serve` throws at startup on an
unmounted slug, which would take the deployed router down rather than degrade
it. So the connection files switch transport when the environment says to — the
same override the three-process setup above uses, with real credentials:

| secret | value |
| --- | --- |
| `MISTRAL_MCP_URL` | the `mistral` deployment's alias URL + `/v1/mcp` |
| `MISTRAL_ALIAS_TOKEN` | that deployment's `X-Agent-Alias-Token` |
| `GROK_CODER_MCP_URL` | the `grok-coder` deployment's alias URL + `/v1/mcp` |
| `GROK_CODER_ALIAS_TOKEN` | that deployment's `X-Agent-Alias-Token` |

```bash
agent-sdk deployment mistral                 # read the alias URL
agent-sdk secrets set asml-router MISTRAL_MCP_URL MISTRAL_ALIAS_TOKEN
agent-sdk deploy --dir . --slug asml-router  # secrets are read on the next deploy
```

Unset, the files stay on the canonical `{ agent: "<slug>" }` peer form, which
is what local multi-serve wants. Each alias token prints **once**, on that
deployment's first deploy; `rotate-token <slug>` mints a new one if it is lost.

Add the alias hostname to `hosting.egressDomains` in
[`agent/agent.ts`](agent/agent.ts) once you know it — the pod's egress
allowlist is what lets the router reach its peers over the network at all.

## Files

```
agent/agent.ts                        local runtime, low-effort model, read-only tool allowlist
agent/instructions.md                 the routing rule, the delegation protocol, the guardrails
agent/mcp-connections/mistral.ts      peer → mistral, or the remote transport under MISTRAL_MCP_URL
agent/mcp-connections/grok-coder.ts   peer → grok-coder, same shape
```

## Why the tool allowlist is short

`tools: ["read", "grep", "glob", "ls"]`. A router that can edit files will
answer the question itself instead of routing it, and then there is nothing to
demonstrate. The SDK always adds `"mcp"` to a configured allowlist, so the two
peer connections survive it — the router can look, and it can delegate, and
that is all.
