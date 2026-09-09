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

Peer MCP connections address another agent **mounted in the same serve
process**, so the router is not useful on its own. Serve the directory, not the
package:

```bash
npm install --prefix agents/asml-router
npm install --prefix agents/mistral
npm install --prefix agents/grok-coder

npx agent-sdk login          # or: export CURSOR_API_KEY=...
npx agent-sdk serve --dir agents/asml-router --dir agents/mistral --dir agents/grok-coder --dev
# router playground: http://127.0.0.1:3000/asml-router/playground
```

One turn from the terminal:

```bash
npx agent-sdk chat --url http://127.0.0.1:3000/asml-router \
  --message "Fit T + R to the four site residuals on D07 and report the fit in nm."
# asml-router → grok-coder.ask → grok-coder's own session → reply
```

`agent-sdk serve --dir agents` would mount the whole folder, including the
three `grokbot` agents. Mount the three coding packages explicitly and leave
the yield lane alone.

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
it. So the connection files switch transport when the environment says to:

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
