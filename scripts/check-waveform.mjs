/**
 * Guards the waveform strip: same residuals as the plane, peel-apart on a
 * miss, overlap when the site is in spec. If someone edits the scan mapping
 * and B no longer reads as offset, the pitch loses its second picture of
 * the same miss.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import {
  SPEC_NM,
  applyFix,
  crudeGlobalFit,
  getDie,
  residuals,
  resetLot,
} from '../src/data.js';
import { scanShift, shiftPx } from '../src/waveform.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log('waveform claims:');

resetLot();

check('D07 site B peels apart and A, C, D sit on top of each other', () => {
  const rs = residuals(getDie('D07'));
  const b = rs.find((s) => s.id === 'B');
  const good = rs.filter((s) => s.id !== 'B');
  assert.ok(Math.abs(scanShift(b)) > 1.4, `B scan shift should be obvious, got ${scanShift(b)}`);
  assert.ok(Math.abs(shiftPx(b)) > 12, `B inner-trace translate should be visible, got ${shiftPx(b)}`);
  for (const s of good) {
    assert.ok(s.r < SPEC_NM, `${s.id} should be in spec`);
    assert.ok(
      Math.abs(shiftPx(s)) < 1,
      `${s.id} traces should overlap, got ${shiftPx(s)}px from ${s.r.toFixed(2)} nm`,
    );
  }
});

check('golden (zero residual) has no scan shift', () => {
  assert.equal(scanShift({ dx: 0, dy: 0 }), 0);
  assert.equal(shiftPx({ dx: 0, dy: 0, r: 0 }), 0);
});

check('the peel uses |r|, so it matches the number on the plane', () => {
  const b = residuals(getDie('D07')).find((s) => s.id === 'B');
  assert.equal(b.r.toFixed(1), '22.0');
  assert.equal(Math.abs(scanShift(b)).toFixed(4), (b.r * 0.072).toFixed(4));
});

check('crude T-only fit starts peeling the good sites apart too', () => {
  const after = crudeGlobalFit(getDie('D07')).after;
  const broken = after.filter((s) => s.id !== 'B');
  for (const s of broken) {
    assert.ok(s.r > SPEC_NM, `${s.id} should be dragged out of spec`);
    assert.ok(Math.abs(shiftPx(s)) > 1, `${s.id} should no longer overlap after the crude fit`);
  }
});

check('after the local fix, B overlaps again and the good sites never peeled', () => {
  const die = getDie('D07');
  const beforeGood = residuals(die)
    .filter((s) => s.id !== 'B')
    .map((s) => shiftPx(s));
  applyFix(die);
  const rs = residuals(die);
  const b = rs.find((s) => s.id === 'B');
  assert.ok(b.r < SPEC_NM);
  assert.ok(Math.abs(shiftPx(b)) < 1, `fixed B should overlap, got ${shiftPx(b)}px`);
  rs.filter((s) => s.id !== 'B').forEach((s, i) => {
    assert.equal(shiftPx(s).toFixed(4), beforeGood[i].toFixed(4));
  });
  resetLot();
});

console.log(`\n${passed} claims hold.`);
