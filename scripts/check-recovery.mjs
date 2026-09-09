/**
 * Guards the second half of the story: caught → priced → assigned.
 *
 * `check-model.mjs` proves the physics. This proves the accounting and the
 * handoff — that one incident is opened per die, that the price on it is the
 * one formula and not a second guess at it, that the impact row carries the
 * dollars, and that Reset demo leaves nothing behind.
 *
 * The append call runs for real here. Node has no page origin, so the relative
 * URL fails to parse, the helper falls back, and the transport comes back as
 * `local` — which is exactly the branch a statically-hosted demo takes.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACTS, COST_MODEL, SHEET_COLUMNS, hasLiveUrl } from '../src/config/artifacts.js';
import { LOT, applyFix, getDie, maxResidual, resetLot } from '../src/data.js';
import {
  CAUGHT_BY,
  RECOVERY_STEPS,
  botTurns,
  currentRecovery,
  incidentPayload,
  logImpact,
  notifyShift,
  openRecovery,
  openSteps,
  resetRecovery,
  showBacklog,
  showWeeklyPack,
  submitRecipeChange,
} from '../src/recovery.js';

let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log('recovery claims:');

const openD07 = () => {
  const die = getDie('D07');
  return openRecovery({
    die,
    siteId: 'B',
    residualBefore: maxResidual(die),
    caughtBy: CAUGHT_BY.manual,
  });
};

await check('the checklist is the five the walkthrough names, in order', () => {
  assert.deepEqual(
    RECOVERY_STEPS.map((s) => s.label),
    ['Recipe change', 'Impact logged', 'Shift notified', 'Weekly ROI', 'Backlog'],
  );
});

await check('opening an incident prices it and wakes both bots', () => {
  const job = openD07();
  assert.equal(job.dieId, 'D07');
  assert.equal(job.costAvoided, 18_480_000);
  assert.equal(job.wafersAtRisk, 1760);
  assert.equal(openSteps().length, 5);

  // The intake bot acks the user and hands the priced question to the analyst.
  const turns = botTurns();
  assert.equal(turns.length, 2);
  assert.ok(turns.every((t) => t.actor === 'lot-incident-owner'));
  assert.deepEqual(
    turns.map((t) => t.to),
    ['user', 'yield-impact-analyst'],
  );
});

await check('the handoff payload carries the cost model, not just the residual', () => {
  const payload = incidentPayload();
  assert.equal(payload.die_id, 'D07');
  assert.equal(payload.site_id, 'B');
  assert.equal(payload.wafers_at_risk, 1760);
  assert.equal(payload.cost_model.cost_per_wafer_usd, COST_MODEL.costPerWaferUsd);
  assert.equal(payload.cost_model.escape_prob_if_missed, COST_MODEL.escapeProbIfMissed);
});

await check('re-entering the same die updates the incident instead of forking it', () => {
  const before = currentRecovery();
  const die = getDie('D07');
  const again = openRecovery({
    die,
    siteId: 'B',
    residualBefore: maxResidual(die),
    caughtBy: CAUGHT_BY.recipeChange,
  });
  assert.equal(again, before, 'the same job object, not a replacement');
  assert.ok(again.caughtBy.includes(CAUGHT_BY.manual));
  assert.ok(again.caughtBy.includes(CAUGHT_BY.recipeChange));
});

await check('a filed recipe change closes its check and leaves the tool alone', () => {
  const change = submitRecipeChange();
  const job = currentRecovery();
  assert.equal(job.steps.recipe, 'done');
  assert.match(job.recipeChangeId, /^OCR-\d{4}$/);
  assert.equal(change.id, job.recipeChangeId);
  assert.equal(change.tool, LOT.tool);
  assert.equal(change.status, 'in review');
  // Filing is not fixing: nobody has turned a knob, so the die is still out of
  // spec. This is the invariant that keeps the two lanes honestly different.
  assert.ok(maxResidual(getDie('D07')) > 3.0);
  assert.ok(!getDie('D07').fixed);
});

await check('the recipe change carries no forge chrome — this is a fab artifact', () => {
  const surface = JSON.stringify(currentRecovery());
  for (const forge of ['github', 'pull request', 'pr #', '/pull/', 'branch']) {
    assert.ok(
      !surface.toLowerCase().includes(forge),
      `recovery state must not leak "${forge}" into the product surface`,
    );
  }
});

await check('logging impact writes a full row and reports its transport', async () => {
  const result = await logImpact();
  const job = currentRecovery();
  assert.equal(job.steps.impact, 'done');
  assert.equal(result.row.length, SHEET_COLUMNS.length);
  assert.equal(result.row[SHEET_COLUMNS.indexOf('cost_avoided_usd')], 18_480_000);
  assert.equal(result.row[SHEET_COLUMNS.indexOf('die_id')], 'D07');
  assert.equal(result.row[SHEET_COLUMNS.indexOf('recipe_change_id')], job.recipeChangeId);
  // No page origin in Node, so the append cannot reach an endpoint — and the
  // helper says so rather than claiming the row landed in Sheets.
  assert.equal(result.transport, 'local');

  const analyst = botTurns().filter((t) => t.actor === 'yield-impact-analyst');
  assert.equal(analyst.length, 2);
  assert.ok(analyst[0].text.includes('$18,480,000'));
  // The arithmetic is said out loud, at the scale it actually runs at.
  assert.ok(analyst[0].text.includes('1,760 wafers'), analyst[0].text);
  assert.ok(analyst[0].text.includes('$30,000'), analyst[0].text);
});

await check('the incident is not closed until all five are', async () => {
  assert.equal(openSteps().length, 3);
  notifyShift();
  showWeeklyPack();
  showBacklog();
  assert.equal(openSteps().length, 0);
});

await check('the Sheet and the weekly deck are live, the backlog is still a stub', () => {
  assert.ok(hasLiveUrl(ARTIFACTS.sheet));
  assert.match(ARTIFACTS.sheet.url, /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit$/);
  assert.ok(hasLiveUrl(ARTIFACTS.slides), 'the weekly pack opens a deck, not a placeholder');
  assert.match(ARTIFACTS.slides.url, /^https:\/\/docs\.google\.com\/presentation\/d\/[\w-]+\/edit$/);
  assert.equal(hasLiveUrl(ARTIFACTS.jira), false, 'the backlog panel is a stub');
});

await check('the artifact links in the docs are the ones the app opens', () => {
  // The Sheet and the deck are advertised twice: once in the config the rail
  // reads, once in prose a presenter reads off a laptop. A stale URL in either
  // one is a dead click on stage, so this is what fails when they drift.
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const doc of ['README.md', join('docs', 'TEAM_WALKTHROUGH.md')]) {
    const prose = readFileSync(join(repo, doc), 'utf8');
    assert.ok(prose.includes(ARTIFACTS.sheet.url), `${doc} links the live impact Sheet`);
    assert.ok(prose.includes(ARTIFACTS.slides.url), `${doc} links the live weekly deck`);
  }
});

await check('the analyst is briefed on the same columns the app writes', () => {
  // The column list is duplicated: once here for the app, once in prose for a
  // model that cannot import anything. Duplication is only tolerable while
  // something fails when the two drift, so this is that something.
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const brief = readFileSync(
    join(repo, 'agents', 'yield-impact-analyst', 'agent', 'instructions.md'),
    'utf8',
  );
  const documented = [...brief.matchAll(/\|\s*\d+\s*\|\s*`([a-z_]+)`\s*\|/g)].map((m) => m[1]);
  assert.deepEqual(
    documented,
    SHEET_COLUMNS,
    'the numbered column table in the analyst instructions must match SHEET_COLUMNS, in order',
  );
});

await check('the intake brief is written against the payload the app actually sends', () => {
  // Same duplication as the column table above, one bot along: the worked JSON
  // in the intake brief is the only spec the model has for the message body,
  // and it cannot import `incidentPayload`. Keys and nesting are the contract —
  // the values in the brief are an example and are free to differ.
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const brief = readFileSync(
    join(repo, 'agents', 'lot-incident-owner', 'agent', 'instructions.md'),
    'utf8',
  );
  const block = brief.match(/```json\n([\s\S]*?)```/);
  assert.ok(block, 'the intake brief must carry a worked JSON payload');

  const documented = JSON.parse(block[1]);
  const sent = incidentPayload();
  assert.deepEqual(Object.keys(documented), Object.keys(sent), 'top-level payload keys, in order');
  assert.deepEqual(
    Object.keys(documented.cost_model),
    Object.keys(sent.cost_model),
    'cost_model keys, in order',
  );

  // A documented `caught_by` the app stopped sending is the same drift one
  // level down: the bot would be briefed on a value it will never receive.
  assert.ok(
    Object.values(CAUGHT_BY).includes(documented.caught_by),
    `the brief's caught_by must be one the app sends: ${Object.values(CAUGHT_BY).join(' | ')}`,
  );
});

await check('reset demo drops the incident along with the lot', () => {
  applyFix(getDie('D07'));
  resetLot();
  resetRecovery();
  assert.equal(currentRecovery(), null);
  assert.equal(botTurns().length, 0);
  assert.equal(openSteps().length, RECOVERY_STEPS.length);
  assert.equal(incidentPayload(), null);
});

console.log(`\n${passed} claims hold.`);
