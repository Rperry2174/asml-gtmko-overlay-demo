import { defineConnection } from "@cursor/july/connections";

/**
 * The simple-coding leg of the route. Every mounted agent is also an MCP
 * server, so this connection puts `mistral`'s `ask` and `check` on the
 * router's toolset and the peer answers in its own session, with its own
 * instructions and model.
 *
 * `{ agent: "<slug>" }` resolves only when both agents are mounted in one
 * serve process (`agent-sdk serve --dir agents`), and `serve` throws at
 * startup when the slug is not mounted — a typo fails immediately rather
 * than at delegation time. Managed hosting gives every deployment its own
 * process, so a deployed router cannot reach a deployed peer that way.
 * Setting `MISTRAL_MCP_URL` to the peer deployment's alias MCP endpoint
 * (`<alias-url>/v1/mcp`) switches this file to the remote transport instead;
 * `MISTRAL_ALIAS_TOKEN` is the `X-Agent-Alias-Token` that endpoint requires.
 */
const description = "Delegate simple coding asks to the mistral agent.";
const url = process.env.MISTRAL_MCP_URL;
const aliasToken = process.env.MISTRAL_ALIAS_TOKEN;

export default defineConnection(
  url === undefined
    ? { agent: "mistral", description }
    : {
        url,
        description,
        headers:
          aliasToken === undefined
            ? undefined
            : { "X-Agent-Alias-Token": aliasToken },
      }
);
