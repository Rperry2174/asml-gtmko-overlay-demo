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
import {
  ARTIFACTS,
  COST_MODEL,
  SHEET_COLUMNS,
  SLIDES_URL_PENDING,
  hasLiveUrl,
} from '../src/config/artifacts.js';
import { applyFix, getDie, maxResidual, resetLot } from '../src/data.js';
import {
  CAUGHT_BY,
  RECOVERY_STEPS,
  botTurns,
  currentRecovery,
  incidentPayload,
  logImpact,
  notifyShift,
  openPr,
  openRecovery,
  openSteps,
  resetRecovery,
  showBacklog,
  showWeeklyPack,
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
    ['PR', 'Impact logged', 'Shift notified', 'Weekly ROI', 'Backlog'],
  );
});

await check('opening an incident prices it and wakes both bots', () => {
  const job = openD07();
  assert.equal(job.dieId, 'D07');
  assert.equal(job.costAvoided, 178500);
  assert.equal(job.wafersAtRisk, 60);
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
  assert.equal(payload.wafers_at_risk, 60);
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
    caughtBy: CAUGHT_BY.cloudAgent,
  });
  assert.equal(again, before, 'the same job object, not a replacement');
  assert.ok(again.caughtBy.includes(CAUGHT_BY.manual));
  assert.ok(again.caughtBy.includes(CAUGHT_BY.cloudAgent));
});

await check('the PR check links a change and leaves the tool alone', () => {
  const pr = openPr();
  const job = currentRecovery();
  assert.equal(job.steps.pr, 'done');
  assert.match(job.prUrl, /\/pull\/\d+$/);
  assert.equal(pr.state, 'open · awaiting review');
  // A PR is not a fix on the floor: the die is still out of spec.
  assert.ok(maxResidual(getDie('D07')) > 3.0);
});

await check('logging impact writes a full row and reports its transport', async () => {
  const result = await logImpact();
  const job = currentRecovery();
  assert.equal(job.steps.impact, 'done');
  assert.equal(result.row.length, SHEET_COLUMNS.length);
  assert.equal(result.row[SHEET_COLUMNS.indexOf('cost_avoided_usd')], 178500);
  assert.equal(result.row[SHEET_COLUMNS.indexOf('die_id')], 'D07');
  assert.equal(result.row[SHEET_COLUMNS.indexOf('pr_url')], job.prUrl);
  // No page origin in Node, so the append cannot reach an endpoint — and the
  // helper says so rather than claiming the row landed in Sheets.
  assert.equal(result.transport, 'local');

  const analyst = botTurns().filter((t) => t.actor === 'yield-impact-analyst');
  assert.equal(analyst.length, 2);
  assert.ok(analyst[0].text.includes('$178,500'));
});

await check('the incident is not closed until all five are', async () => {
  assert.equal(openSteps().length, 3);
  notifyShift();
  showWeeklyPack();
  showBacklog();
  assert.equal(openSteps().length, 0);
});

await check('the Sheet is live, the Slides deck is still a placeholder', () => {
  assert.ok(hasLiveUrl(ARTIFACTS.sheet));
  assert.match(ARTIFACTS.sheet.url, /^https:\/\/docs\.google\.com\/spreadsheets\//);
  assert.equal(ARTIFACTS.slides.url, SLIDES_URL_PENDING);
  assert.equal(hasLiveUrl(ARTIFACTS.slides), false, 'no dead link while the deck has no ID');
  assert.equal(hasLiveUrl(ARTIFACTS.jira), false, 'the backlog panel is a stub');
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
