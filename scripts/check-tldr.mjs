/**
 * Guards what the status strip sounds like.
 *
 * The strip is the most-read text in the app and the easiest thing in the repo
 * to edit without thinking, so demo-script voice keeps drifting back into it:
 * a "TLDR:" prefix announcing the slot it already occupies, the caught → priced
 * → assigned mantra, "Pain: … Outcome: …", lines addressed to a room rather
 * than to the operator looking at the screen.
 *
 * Every state is rendered here and checked for two things: that it says
 * something concrete about the screen, and that it says it in product voice.
 *
 * Run with: npm test
 */

import assert from 'node:assert/strict';
import { COPY } from '../src/tldr.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
};

console.log('status strip claims:');

const die = (over = {}) => ({
  id: 'D07',
  wafersAtRisk: 1760,
  driftHours: 8.0,
  sites: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
  knobs: { local: { B: {} } },
  fixed: false,
  ...over,
});

const job = (state) => ({
  dieId: 'D07',
  costAvoided: 18_480_000,
  steps: Object.fromEntries(
    ['recipe', 'impact', 'shift', 'weekly', 'backlog'].map((s) => [s, state]),
  ),
});

/** Every state the strip can be in, so none of them can be voiced separately. */
const STATES = {
  'lot · fails': COPY.lot({
    openFails: 3,
    watching: 2,
    maxResidual: 22.0,
    yield: 75,
    total: 12,
    fixedCount: 0,
    dollarsAtRisk: 31_185_000,
  }),
  'lot · watching': COPY.lot({
    openFails: 0,
    watching: 3,
    maxResidual: 3.4,
    yield: 100,
    total: 12,
    fixedCount: 3,
    dollarsAtRisk: 0,
  }),
  'lot · one fail': COPY.lot({
    openFails: 1,
    watching: 2,
    maxResidual: 8.9,
    yield: 92,
    total: 12,
    fixedCount: 2,
    dollarsAtRisk: 4_620_000,
  }),
  'lot · clean': COPY.lot({
    openFails: 0,
    watching: 0,
    maxResidual: 0.6,
    yield: 100,
    total: 12,
    fixedCount: 3,
    dollarsAtRisk: 0,
  }),
  'die · fail': COPY.dieFail(die(), 'B', 22.0),
  'die · watch': COPY.dieWatch(die(), 'C', 3.4),
  'die · fixed': COPY.dieOk(die({ fixed: true })),
  'die · clean': COPY.dieOk(die()),
  'factory · running': COPY.factory('B'),
  'factory · done': COPY.factoryDone('B', 22.0, 0.6, 18_480_000),
  'recovery · idle': COPY.recovery(null),
  'recovery · open': COPY.recovery(job('todo')),
  'recovery · closed': COPY.recovery(job('done')),
};

/** Demo-script voice: a narrator talking about the product, not the product. */
const BANNED = [
  [/\bTLDR\b/i, 'the strip is already the TLDR slot — it does not need to say so'],
  [/caught → priced → assigned/i, 'the mantra belongs in the walkthrough, not on screen'],
  [/\b(Pain|Outcome|Thesis)\s*:/i, 'pitch scaffolding'],
  [/\b(we|our|us|they|their)\b/i, 'the strip addresses the operator, not a room'],
  [/\b(pull request|github\.com|cloud agent|coding task)\b/i, 'chrome from somebody else’s product'],
];

check('every state says something concrete, in one of the four tones', () => {
  for (const [name, copy] of Object.entries(STATES)) {
    assert.ok(copy.text?.trim(), `${name}: no headline`);
    assert.ok(copy.sub?.trim(), `${name}: no subline`);
    assert.ok(['neutral', 'warn', 'fail', 'ok'].includes(copy.tone), `${name}: tone ${copy.tone}`);
  }
});

check('no state slips back into demo-script voice', () => {
  for (const [name, copy] of Object.entries(STATES)) {
    const line = `${copy.text} / ${copy.sub}`;
    for (const [pattern, why] of BANNED) {
      assert.ok(!pattern.test(line), `${name} matches ${pattern} — ${why}:\n    ${line}`);
    }
  }
});

check('the last failing die is a die, not "1 dies"', () => {
  assert.match(STATES['lot · one fail'].text, /^1 die failing overlay ·/);
  assert.match(STATES['lot · fails'].text, /^3 dies failing overlay ·/);
});

check('the sublines name the next action in the product', () => {
  // An open incident points at the checks that are actually open, in order,
  // rather than at a generic nudge — so the strip stays useful as it is worked.
  assert.match(STATES['recovery · open'].sub, /^Submit recipe change, then log impact\.$/);
  assert.match(STATES['die · fail'].sub, /Run a factory fix or submit a recipe change\./);
  assert.match(STATES['lot · fails'].sub, /Open a die under Needs fix to start recovery\./);
  assert.match(STATES['lot · watching'].sub, /Open a die under Watching to see its worst site\./);
});

check('the lot line only calls the lot clean when nothing is still watching', () => {
  // Fixing the three fails leaves dies above spec on the Watching rail, and a
  // warn-toned max residual in the health band right under the strip.
  assert.match(STATES['lot · watching'].text, /3 watching · 3\.4 nm max residual/);
  assert.equal(STATES['lot · watching'].tone, 'warn');
  assert.match(STATES['lot · clean'].text, /All 12 dies inside spec/);
});

check('money on screen is the same figure the surface underneath it prints', () => {
  // The lot total rounds with the health band it sits above; a single die does
  // not, because $18,480,000 is what the card, the rail and the Sheet carry.
  assert.match(STATES['lot · fails'].text, /\$31\.2M at risk/);
  assert.match(STATES['lot · one fail'].text, /\$4\.6M at risk/);
  assert.match(STATES['die · fail'].text, /\$18,480,000 at risk/);
  assert.match(STATES['die · fixed'].text, /\$18,480,000 avoided/);
  assert.match(STATES['factory · done'].text, /\$18,480,000 avoided/);
  assert.match(STATES['recovery · open'].text, /\$18,480,000/);
  assert.match(STATES['recovery · closed'].text, /\$18,480,000 in the impact log/);
});

check('the wafer count behind a die is readable at four digits', () => {
  // "1760 wafers" reads as a part number; the comma is the whole point.
  assert.match(STATES['die · fail'].sub, /^1,760 wafers behind this die\b/);
});

console.log(`\n${passed} claims hold.`);
