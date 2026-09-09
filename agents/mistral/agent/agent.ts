import { defineAgent } from "@cursor/july";

/**
 * A Deployed Agent on the default local runtime, not a Grok Bot.
 *
 * The name is the demo's whole point and also its biggest trap: this is a
 * **stand-in** for the generalist coding agent ASML already runs, so the
 * router has something realistic to route away from. Nothing here calls
 * Mistral's API, carries a Mistral key, or reaches mistral.ai. Do not add one.
 *
 * Low effort and `fast` are deliberate rather than incidental. The contrast
 * with `grok-coder` — same repo, same ask, different depth — is what the demo
 * shows, so this side has to stay genuinely cheap.
 */
export default defineAgent({
  name: "mistral",
  description:
    "Fast generalist coding agent. Handles ordinary software work; hands fab science to grok-coder.",
  model: {
    id: "grok-4.5",
    params: [
      { id: "effort", value: "low" },
      { id: "fast", value: "true" },
    ],
  },
});
