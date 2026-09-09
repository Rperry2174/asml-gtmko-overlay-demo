# mistral

The easy leg of the coding track. Fast, short answers, ordinary software work —
CRUD, renames, boilerplate, small refactors, tests with no domain science. When
an ask turns out to be about lithography or overlay or yield, it says so and
points back at [`asml-router`](../asml-router/README.md) rather than guessing.

This is a **Deployed Agent**, not a Grok Bot.

> **It is a mock.** The name is branding for the demo: a stand-in for the
> generalist coding agent ASML already runs, so the router has something
> realistic to route *away from*. Nothing in this package calls Mistral's API,
> holds a Mistral key, or reaches mistral.ai, and nothing should. If you find
> yourself adding a Mistral dependency here, the demo has drifted.

## Why it is deliberately cheap

`effort: low`, `fast: true`. The demo's argument is a contrast — same repo,
same ask, two agents, visibly different depth — so this side has to stay
genuinely fast and genuinely shallow. Raising the effort to make it "better"
deletes the thing being shown.

## Run it

Useful on its own, and the router needs it reachable before it can delegate:

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

From the repo root: `npm run mistral:install`, `mistral:dev`,
`mistral:validate`, `mistral:check`. Serving all three coding agents together
is in the [router README](../asml-router/README.md#run-the-trio).

## Deploy it

```bash
agent-sdk deploy --dir . --slug mistral \
  --repo https://github.com/Rperry2174/asml-gtmko-overlay-demo \
  --ref <branch> --path agents/mistral
```

Deploy this before `asml-router` if the router is going to reach it over its
alias URL — the router's README explains that wiring.

## Files

```
agent/agent.ts          local runtime, low-effort model
agent/instructions.md   what it takes, what it hands to grok-coder, and why
```
