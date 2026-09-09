import { defineAgent } from "@cursor/july";

/**
 * The hosted Grok Bot is get-or-created by (signed-in user, agent name), so
 * `name` is the identity of the bot and not just a label — renaming it points
 * turns at a different bot and drops the conversation history. It is also the
 * name the analyst's teammate list has to match.
 *
 * Everything this runtime refuses is listed in
 * `checkGrokBotRuntimeLimitations`: server tools, MCP connections and authored
 * subagents are hard errors at discovery, and `architecture: "v2"` cannot pair
 * with grokbot at all. A `tools` allowlist fails closed the same way, so the
 * box's own toolset is what the agent gets. `model` is ignored here — the
 * hosted harness picks it.
 *
 * Teammates are wired in the Cursor app, not here: see the teammates table in
 * `agent/instructions.md` and the UpdateAgent walkthrough in the README.
 */
export default defineAgent({
  name: "lot-incident-owner",
  description:
    "Intake for red-lot overlay incidents: acknowledges the catch and hands the priced question to yield-impact-analyst.",
  runtime: "grokbot",
});
