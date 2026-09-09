import { defineConnection } from "@cursor/july/connections";

/**
 * The fab-science leg of the route, wired the same way as `mistral.ts` — see
 * that file for why the transport is conditional and what the two environment
 * variables are for.
 */
const description =
  "Delegate lithography, overlay, metrology, yield and other math-heavy coding asks to the grok-coder agent.";
const url = process.env.GROK_CODER_MCP_URL;
const aliasToken = process.env.GROK_CODER_ALIAS_TOKEN;

export default defineConnection(
  url === undefined
    ? { agent: "grok-coder", description }
    : {
        url,
        description,
        headers:
          aliasToken === undefined
            ? undefined
            : { "X-Agent-Alias-Token": aliasToken },
      }
);
