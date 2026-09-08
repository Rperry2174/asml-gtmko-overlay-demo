import { defineAgent } from "@cursor/july";

/**
 * The hosted Grok Bot is get-or-created by (signed-in user, agent name), so
 * `name` is the identity of the bot and not just a label — renaming it points
 * turns at a different bot and drops the conversation history.
 *
 * Everything this runtime refuses is listed in
 * `checkGrokBotRuntimeLimitations`: server tools, MCP connections and authored
 * subagents are hard errors at discovery, and `architecture: "v2"` cannot pair
 * with grokbot at all. A `tools` allowlist fails closed the same way, so the
 * box's own toolset is what the agent gets. `model` is ignored here — the
 * hosted harness picks it.
 */
export default defineAgent({
  name: "weather-agent",
  description:
    "Reads a forecast for a city and decides whether an outdoor plan holds or moves.",
  runtime: "grokbot",
});
