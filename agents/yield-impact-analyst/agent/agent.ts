import { defineAgent } from "@cursor/july";

/**
 * The hosted Grok Bot is get-or-created by (signed-in user, agent name), so
 * `name` is the identity of the bot and not just a label — renaming it points
 * turns at a different bot and drops the conversation history. It is also the
 * name `lot-incident-owner` hands work to.
 *
 * Everything this runtime refuses is listed in
 * `checkGrokBotRuntimeLimitations`: server tools, MCP connections and authored
 * subagents are hard errors at discovery, and `architecture: "v2"` cannot pair
 * with grokbot at all. A `tools` allowlist fails closed the same way, so the
 * box's own toolset is what the agent gets. `model` is ignored here — the
 * hosted harness picks it.
 *
 * The cost formula and the impact-log columns live in
 * `agent/instructions.md`, not here, so re-pricing for a different fab is a
 * copy edit rather than a code change.
 */
export default defineAgent({
  name: "yield-impact-analyst",
  description:
    "Prices a caught overlay miss in dollars and logs the row in the yield impact Sheet.",
  runtime: "grokbot",
});
