import { defineAgent } from "@cursor/july";

/**
 * A Deployed Agent, not a Grok Bot. The two bots on the yield lane
 * (`lot-incident-owner`, `yield-impact-analyst`) set `runtime: "grokbot"` and
 * run on Cursor's hosted box; this one takes the default local runtime, so it
 * carries MCP connections — which is the whole point, because routing here
 * means delegating over peer MCP.
 *
 * The read-only tool allowlist is deliberate. A router that can edit files
 * answers the question itself instead of routing it, and then the demo has
 * nothing to show. The SDK always adds `"mcp"` to a configured allowlist, so
 * the peer connections under `agent/mcp-connections/` survive it.
 *
 * Effort and speed are model params, not id suffixes: `grok-4.5-fast` is
 * rejected. Classification is a cheap call, so it runs at low effort.
 */
export default defineAgent({
  name: "asml-router",
  description:
    "Classifies a coding ask and routes it to mistral (simple) or grok-coder (fab science).",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "low" },
      { id: "fast", value: "true" },
    ],
  },
  tools: ["read", "grep", "glob", "ls"],
  hosting: {
    secretNames: [
      "MISTRAL_MCP_URL",
      "MISTRAL_ALIAS_TOKEN",
      "GROK_CODER_MCP_URL",
      "GROK_CODER_ALIAS_TOKEN",
    ],
  },
});
