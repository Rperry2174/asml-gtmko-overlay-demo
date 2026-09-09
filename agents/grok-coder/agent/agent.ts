import { defineAgent } from "@cursor/july";

/**
 * A Deployed Agent on the default local runtime, not a Grok Bot.
 *
 * No `tools` allowlist, on purpose. This is the end of the route: the ask has
 * already been classified as hard, and an agent that cannot run a script
 * cannot check its own arithmetic. It gets the model's full standard toolset,
 * including `shell`.
 *
 * The model config is the mirror of `mistral`'s. High effort, and `fast` is
 * omitted rather than set false — a params array replaces the default
 * wholesale, so leaving it out is what turns the fast path off.
 */
export default defineAgent({
  name: "grok-coder",
  description:
    "Fab-science coding agent: overlay, metrology, yield and unit-bearing numerics, with the work shown.",
  model: {
    id: "grok-4.5",
    params: [{ id: "effort", value: "high" }],
  },
});
