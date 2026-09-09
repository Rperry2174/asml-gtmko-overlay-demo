/**
 * Guards the things that make this a working grokbot agent, plus the three the
 * dollar figure depends on.
 *
 * `agent-sdk validate` catches the runtime half, but only once someone has
 * installed the package and logged in. These assertions need neither, so a
 * reviewer or CI step can check the shape of the project offline.
 *
 * The repo-root `npm test` additionally checks that the column list below
 * matches `src/config/artifacts.js`, which is the other half of the contract.
 *
 * Run with: npm test
 */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const instructions = readFileSync(join(root, "agent", "instructions.md"), "utf8");

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

check("the agent name resolves to yield-impact-analyst every way it can", () => {
  // Discovery takes config.name, else the package name, else the directory.
  // The hosted bot is keyed on the winner, so all three have to agree.
  assert.match(agentTs, /name:\s*"yield-impact-analyst"/);
  assert.equal(pkg.name, "yield-impact-analyst");
  assert.equal(basename(root), "yield-impact-analyst");
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
  for (const dir of ["tools", "mcp-connections", "host-connections", "subagents"]) {
    assert.ok(
      !existsSync(join(root, "agent", dir)),
      `agent/${dir}/ is a discovery error on the grokbot runtime`,
    );
  }
});

check("instructions tell the model that only SendToUser is visible", () => {
  assert.match(instructions, /SendToUser/);
});

check("the cost formula is stated verbatim, with both defaults", () => {
  assert.match(
    instructions,
    /cost_avoided = wafers_at_risk \* cost_per_wafer_usd \* escape_prob_if_missed/,
  );
  assert.match(instructions, /`8500`/);
  assert.match(instructions, /`0\.35`/);
});

check("the live impact Sheet is named by id, not just by link text", () => {
  assert.match(instructions, /1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY/);
  assert.match(instructions, /impact_log/);
});

check("no credential is baked into the instructions", () => {
  // The Sheets token is read from the environment at turn time. A literal one
  // here would be committed, and committed is leaked.
  assert.match(instructions, /GOOGLE_SHEETS_ACCESS_TOKEN/);
  assert.doesNotMatch(instructions, /ya29\.[\w-]{10,}/, "a Google access token leaked");
  assert.doesNotMatch(instructions, /\bAIza[\w-]{20,}/, "a Google API key leaked");
});

check("the teammate id is still an obvious placeholder", () => {
  assert.match(instructions, /LOT_INCIDENT_OWNER_ID/);
  assert.doesNotMatch(
    instructions,
    /\bbc_[a-z0-9]{8,}/i,
    "a real agent id leaked into the instructions",
  );
});

console.log(`\n${passed} invariants hold.`);
