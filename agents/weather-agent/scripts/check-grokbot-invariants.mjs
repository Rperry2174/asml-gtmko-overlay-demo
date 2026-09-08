/**
 * Guards the four things that make this a working grokbot agent.
 *
 * `agent-sdk validate` catches all of it, but only once someone has installed
 * the package and logged in. These assertions need neither, so a reviewer or CI
 * step can check the shape of the project offline.
 *
 * Run with: npm test
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

// The comments in agent.ts name the very keys these assertions forbid, so the
// checks below have to read code only.
const agentTs = readFileSync(join(root, "agent", "agent.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*$/gm, "");

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log("grokbot invariants:");

check("the agent name resolves to weather-agent every way it can", () => {
  // Discovery takes config.name, else the package name, else the directory.
  // The hosted bot is keyed on the winner, so all three have to agree.
  assert.match(agentTs, /name:\s*"weather-agent"/);
  assert.equal(pkg.name, "weather-agent");
  assert.equal(root.split("/").at(-1), "weather-agent");
});

check('runtime is "grokbot"', () => {
  assert.match(agentTs, /runtime:\s*"grokbot"/);
});

check('architecture "v2" is not set — it cannot pair with grokbot', () => {
  assert.doesNotMatch(agentTs, /architecture\s*:/);
});

check("no tools allowlist — grokbot fails closed on one", () => {
  assert.doesNotMatch(agentTs, /\btools\s*:/);
  assert.doesNotMatch(agentTs, /\bbuiltinTools\s*:/);
});

check("no server tools, MCP connections or subagents to be refused", () => {
  for (const dir of [
    "tools",
    "mcp-connections",
    "host-connections",
    "subagents",
  ]) {
    assert.ok(
      !existsSync(join(root, "agent", dir)),
      `agent/${dir}/ is a discovery error on the grokbot runtime`,
    );
  }
});

check("instructions tell the model that only SendToUser is visible", () => {
  const instructions = readFileSync(
    join(root, "agent", "instructions.md"),
    "utf8",
  );
  assert.match(instructions, /SendToUser/);
});

console.log(`\n${passed} invariants hold.`);
