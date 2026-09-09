/**
 * Guards the numbers the presenter says out loud.
 *
 * The demo's credibility rests on a handful of claims: B is 22 nm out, the
 * crude fit breaks the three good sites, and the local fix moves nothing it
 * should not. If an edit to the data model breaks one of those, this fails
 * before a customer sees it.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { COST_MODEL, SHEET_COLUMNS, costAvoided, sheetRow } from '../src/config/artifacts.js';
import {
  DIES,
  SPEC_NM,
  applyFix,
  boardGroups,
  crudeGlobalFit,
  dieCostAvoided,
  dieStatus,
  dollarsAtRisk,
  failsFirst,
  getDie,
  localFit,
  lotKpis,
  maxResidual,
  residuals,
  resetLot,
  waferOrder,
} from '../src/data.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log('model claims:');

check('the lot opens with 12 dies, 3 of them failing', () => {
  assert.equal(DIES.length, 12);
  assert.equal(DIES.filter((d) => dieStatus(d) === 'fail').length, 3);
});

check('D07 site B is 22 nm out and the other three are inside 1 nm', () => {
  const d07 = getDie('D07');
  const rs = residuals(d07);
  const b = rs.find((s) => s.id === 'B');
  assert.equal(b.r.toFixed(1), '22.0');
  for (const s of rs.filter((x) => x.id !== 'B')) {
    assert.ok(s.r < 1.0, `site ${s.id} should be under 1 nm, got ${s.r}`);
  }
});

check('the cost model is the one the story quotes: $8,500 a wafer, 0.35 escape', () => {
  assert.equal(COST_MODEL.costPerWaferUsd, 8500);
  assert.equal(COST_MODEL.escapeProbIfMissed, 0.35);
  // wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed, nothing else.
  assert.equal(costAvoided(60), 60 * 8500 * 0.35);
  assert.equal(costAvoided(0), 0);
});

check('D07 prices at $178,500 and the open lot at $303,450', () => {
  assert.equal(dieCostAvoided(getDie('D07')), 178500);
  assert.equal(dieCostAvoided(getDie('D05')), 71400);
  assert.equal(dieCostAvoided(getDie('D11')), 53550);
  assert.equal(lotKpis().dollarsAtRisk, 303450);
});

check('watch items are priced but not counted as money at risk', () => {
  // D03 and D09 have wafers behind them, and they are drifting rather than
  // failing — pricing a die nobody is going to touch inflates the headline.
  assert.ok(dieCostAvoided(getDie('D03')) > 0);
  assert.ok(dieCostAvoided(getDie('D09')) > 0);
  const failsOnly = DIES.filter((d) => dieStatus(d) === 'fail').reduce(
    (sum, d) => sum + dieCostAvoided(d),
    0,
  );
  assert.equal(dollarsAtRisk(), failsOnly);
});

check('the impact row matches the sheet columns, dollars included', () => {
  const row = sheetRow({
    lotId: 'LOT-2291-A',
    dieId: 'D07',
    siteId: 'B',
    residualBefore: 22.0,
    residualAfter: 0.6,
    wafersAtRisk: 60,
    costAvoided: 178500,
    caughtBy: 'manual factory run',
    owner: 'lot-incident-owner',
  });
  assert.equal(row.length, SHEET_COLUMNS.length);
  assert.equal(row[SHEET_COLUMNS.indexOf('cost_avoided_usd')], 178500);
  assert.equal(row[SHEET_COLUMNS.indexOf('wafers_at_risk')], 60);
  assert.equal(row[SHEET_COLUMNS.indexOf('cost_per_wafer_usd')], 8500);
  assert.equal(row[SHEET_COLUMNS.indexOf('escape_prob_if_missed')], 0.35);
  // An incident with no recipe change filed is an empty cell, not "null".
  assert.equal(row[SHEET_COLUMNS.indexOf('recipe_change_id')], '');
});

check('the crude global-T fit pushes A, C and D out of spec', () => {
  const crude = crudeGlobalFit(getDie('D07'));
  assert.deepEqual(crude.broken.sort(), ['A', 'C', 'D']);
  // ...and barely helps the site it was chasing.
  assert.ok(crude.maxAfter > 10, `crude fit should still be bad, got ${crude.maxAfter}`);
});

check('the local fit at B is a ~14 nm shift and a ~0.21 degree rotation', () => {
  const fit = localFit(getDie('D07'));
  assert.equal(fit.siteId, 'B');
  assert.equal(fit.error.dx.toFixed(0), '14');
  assert.equal(fit.error.theta.toFixed(2), '0.21');
  // The knob is the negation of the error, not a second guess at it.
  assert.equal(fit.knob.dx, -fit.error.dx);
  assert.equal(fit.knob.theta, -fit.error.theta);
});

check('the board opens fails first, hero die at the top', () => {
  const groups = boardGroups();
  // Hard fails by worst residual: D07 (22 nm) leads, then D05, then D11.
  assert.deepEqual(
    groups.fail.map((d) => d.id),
    ['D07', 'D05', 'D11'],
  );
  assert.deepEqual(
    groups.warn.map((d) => d.id),
    ['D03', 'D09'],
  );
  assert.equal(groups.ok.length, 7);

  const order = failsFirst().map((d) => d.id);
  assert.equal(order[0], 'D07');
  assert.equal(order.length, DIES.length);
  const lastFail = order.indexOf('D11');
  const firstPassing = order.findIndex((id) => dieStatus(getDie(id)) === 'ok');
  assert.ok(lastFail < firstPassing, 'every fail must come before the first passing die');
});

check('the wafer map order is still available, unchanged', () => {
  assert.deepEqual(
    waferOrder().map((d) => d.id),
    DIES.map((d) => d.id),
  );
});

check('applying the fix brings B inside spec and moves nothing else', () => {
  const d07 = getDie('D07');
  const before = residuals(d07);
  const result = applyFix(d07);
  const after = residuals(d07);

  assert.ok(result.after <= SPEC_NM, `B should be in spec, got ${result.after}`);
  for (const s of after.filter((x) => x.id !== 'B')) {
    const was = before.find((b) => b.id === s.id).r;
    assert.equal(s.r, was, `site ${s.id} moved: ${was} -> ${s.r}`);
  }
  assert.deepEqual(d07.knobs.global, { dx: 0, dy: 0, theta: 0, mag: 0 });
  assert.deepEqual(Object.keys(d07.knobs.local), ['B']);
  assert.ok(maxResidual(d07) <= SPEC_NM);
});

check('fixing one die moves the lot board KPIs, money included', () => {
  const k = lotKpis();
  assert.equal(k.openFails, 2);
  assert.equal(k.yield.toFixed(0), '83');
  assert.equal(k.fixedCount, 1);
  // D07's $178,500 leaves the headline the moment the die goes green.
  assert.equal(k.dollarsAtRisk, 303450 - 178500);
});

check('a fixed die leaves "needs fix" and joins the passing group', () => {
  const groups = boardGroups();
  assert.deepEqual(
    groups.fail.map((d) => d.id),
    ['D05', 'D11'],
  );
  assert.ok(groups.ok.some((d) => d.id === 'D07'));
});

check('reset puts the KPIs back to the state the walkthrough opens on', () => {
  const d07 = getDie('D07');
  resetLot();

  const k = lotKpis();
  assert.equal(k.yield.toFixed(0), '75');
  assert.equal(k.maxResidual.toFixed(1), '22.0');
  assert.equal(k.openFails, 3);
  assert.equal(k.dollarsAtRisk, 303450);
  assert.equal(k.fixedCount, 0);

  // Restored in place, so a view still holding the old reference sees the
  // reset die rather than a stale copy of the fixed one.
  assert.equal(getDie('D07'), d07);
  assert.equal(d07.fixed, false);
  assert.equal(maxResidual(d07).toFixed(1), '22.0');
  assert.deepEqual(Object.keys(d07.knobs.local), []);
  assert.equal(d07.preFix, undefined);
  assert.equal(d07.log.length, 0);
  assert.equal(d07.process, 'warn');
});

check('reset restores the original fail set and board order', () => {
  assert.deepEqual(
    DIES.filter((d) => dieStatus(d) === 'fail').map((d) => d.id),
    ['D05', 'D07', 'D11'],
  );
  assert.deepEqual(
    boardGroups().fail.map((d) => d.id),
    ['D07', 'D05', 'D11'],
  );
});

check('reset is idempotent — mash it as often as you like', () => {
  applyFix(getDie('D05'));
  applyFix(getDie('D11'));
  resetLot();
  resetLot();
  const k = lotKpis();
  assert.equal(k.openFails, 3);
  assert.equal(k.yield.toFixed(0), '75');
  assert.equal(k.maxResidual.toFixed(1), '22.0');
  assert.equal(k.dollarsAtRisk, 303450);
});

console.log(`\n${passed} claims hold.`);
