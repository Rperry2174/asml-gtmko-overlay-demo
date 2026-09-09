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
  wafersAtRisk: 60,
  sites: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }],
  knobs: { local: { B: {} } },
  fixed: false,
  ...over,
});

const job = (state) => ({
  dieId: 'D07',
  costAvoided: 178500,
  steps: Object.fromEntries(
    ['recipe', 'impact', 'shift', 'weekly', 'backlog'].map((s) => [s, state]),
  ),
});

/** Every state the strip can be in, so none of them can be voiced separately. */
const STATES = {
  'lot · fails': COPY.lot({
    openFails: 3,
    maxResidual: 22.0,
    yield: 75,
    total: 12,
    fixedCount: 0,
    dollarsAtRisk: 303450,
  }),
  'lot · clean': COPY.lot({
    openFails: 0,
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
  'factory · done': COPY.factoryDone('B', 22.0, 0.6, 178500),
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

check('the sublines name the next action in the product', () => {
  // An open incident points at the checks that are actually open, in order,
  // rather than at a generic nudge — so the strip stays useful as it is worked.
  assert.match(STATES['recovery · open'].sub, /^Submit recipe change, then log impact\.$/);
  assert.match(STATES['die · fail'].sub, /Run a factory fix or submit a recipe change\./);
  assert.match(STATES['lot · fails'].sub, /Open a die under Needs fix to start recovery\./);
});

check('money on screen is the same figure the surface underneath it prints', () => {
  // The lot total rounds with the health band it sits above; a single die does
  // not, because $178,500 is what the card, the rail and the Sheet all carry.
  assert.match(STATES['lot · fails'].text, /\$303k at risk/);
  assert.match(STATES['die · fail'].text, /\$178,500 at risk/);
  assert.match(STATES['die · fixed'].text, /\$178,500 avoided/);
  assert.match(STATES['factory · done'].text, /\$178,500 avoided/);
  assert.match(STATES['recovery · open'].text, /\$178,500/);
  assert.match(STATES['recovery · closed'].text, /\$178,500 in the impact log/);
});

console.log(`\n${passed} claims hold.`);
