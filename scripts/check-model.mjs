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
import {
  DIES,
  SPEC_NM,
  applyFix,
  crudeGlobalFit,
  dieStatus,
  getDie,
  localFit,
  lotKpis,
  maxResidual,
  residuals,
  resetLot,
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

check('fixing one die moves the lot board KPIs', () => {
  const k = lotKpis();
  assert.equal(k.openFails, 2);
  assert.equal(k.yield.toFixed(0), '83');
  assert.equal(k.fixedCount, 1);
});

check('reset puts the KPIs back to the state the walkthrough opens on', () => {
  const d07 = getDie('D07');
  resetLot();

  const k = lotKpis();
  assert.equal(k.yield.toFixed(0), '75');
  assert.equal(k.maxResidual.toFixed(1), '22.0');
  assert.equal(k.openFails, 3);
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

check('reset restores the original fail set', () => {
  assert.deepEqual(
    DIES.filter((d) => dieStatus(d) === 'fail').map((d) => d.id),
    ['D05', 'D07', 'D11'],
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
});

console.log(`\n${passed} claims hold.`);
