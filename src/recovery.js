/**
 * The recovery job: what happens after a miss is caught.
 *
 * The first half of the demo ends when a die goes green. This is the second
 * half — the same miss gets priced, written to a log with a dollar figure on
 * it, and handed to an owner. Five things have to be true before an incident
 * is closed, and this module is the state behind those five.
 *
 * One job at a time, on purpose. The stage runs one incident, and a queue of
 * them would be a product decision nobody has made yet.
 *
 * Everything here is state and side effects. The DOM lives in
 * `src/views/recovery.js`.
 */

import { ARTIFACTS, COST_MODEL, qty, usd } from './config/artifacts.js';
import { LOT, dieCostAvoided } from './data.js';
import { appendImpactRow } from './lib/impact-log.js';

/** The checklist, in the order the shift works it. */
export const RECOVERY_STEPS = [
  {
    id: 'recipe',
    label: 'Recipe change',
    todo: 'No recipe change filed yet.',
    action: 'Submit recipe change',
  },
  {
    id: 'impact',
    label: 'Impact logged',
    todo: 'The miss has a number but nothing has written it down.',
    action: 'Log impact',
  },
  {
    id: 'shift',
    label: 'Shift notified',
    todo: 'The floor does not know this incident exists.',
    action: 'Notify shift',
  },
  {
    id: 'weekly',
    label: 'Weekly ROI',
    todo: 'Not in the pack the lead presents on Monday.',
    action: 'Show weekly pack',
  },
  {
    id: 'backlog',
    label: 'Backlog',
    todo: 'No ticket for the pattern behind it.',
    action: 'Show backlog stub',
  },
];

/** Who caught the miss. Ends up in the Sheet's `caught_by` column. */
export const CAUGHT_BY = {
  manual: 'manual factory run',
  recipeChange: 'recipe change',
};

/** The bots on the lane, in handoff order. Ids are assigned by the backend. */
export const BOTS = {
  owner: {
    name: 'lot-incident-owner',
    role: 'intake · floor manager',
    idVar: 'LOT_INCIDENT_OWNER_ID',
  },
  analyst: {
    name: 'yield-impact-analyst',
    role: 'prices the miss · appends the row',
    idVar: 'YIELD_IMPACT_ANALYST_ID',
  },
};

let job = null;

/**
 * The append in flight, if any. Remounting the panel mid-append — the compact
 * panel's link to the full rail — has to adopt this request rather than fire a
 * second one: a duplicate row in the Sheet is worse than a slow button.
 */
let impactInFlight = null;

export const currentRecovery = () => job;

/** The append in flight, so a fresh mount can wait on it instead of re-firing. */
export const pendingImpact = () => impactInFlight;

/** Reset demo drops the open incident along with the lot it belonged to. */
export function resetRecovery() {
  job = null;
}

/* --------------------------------------------------------------- opening */

/**
 * Start (or update) the recovery job for a die.
 *
 * Both entry points land here — the manual factory run and the filed recipe
 * change — because it is the same incident either way. Re-entering with
 * the die already open updates it rather than throwing away a checklist the
 * presenter has already worked through.
 *
 * @param {{die: object, siteId: string, residualBefore: number,
 *          residualAfter?: number|null, caughtBy: string}} args
 */
export function openRecovery({ die, siteId, residualBefore, residualAfter = null, caughtBy }) {
  if (job && job.dieId === die.id) {
    if (residualAfter != null) job.residualAfter = residualAfter;
    if (caughtBy && !job.caughtBy.includes(caughtBy)) job.caughtBy = `${job.caughtBy} + ${caughtBy}`;
    note('floor', `${caughtBy} reached ${die.id} again — same incident, still open.`);
    return job;
  }

  job = {
    lotId: LOT.id,
    dieId: die.id,
    siteId,
    residualBefore,
    residualAfter,
    wafersAtRisk: die.wafersAtRisk,
    // Kept alongside the count so the rail can show where the count came from
    // rather than asserting it. The handoff payload is unchanged: the bots are
    // briefed on `wafers_at_risk` and must not re-derive it.
    driftHours: die.driftHours,
    costAvoided: dieCostAvoided(die),
    caughtBy,
    owner: BOTS.owner.name,
    recipeChangeId: null,
    loggedAt: null,
    transport: null,
    steps: Object.fromEntries(RECOVERY_STEPS.map((s) => [s.id, 'todo'])),
    detail: {},
    log: [],
  };

  // Beat 3: the same path that fixes the die wakes the intake bot, and the
  // intake bot hands the priced question to the analyst. Both lines are
  // authored here so the lane on screen matches what the agents are told to
  // send in `agents/*/agent/instructions.md`.
  note(
    BOTS.owner.name,
    `Red lot on ${job.lotId}. ${job.dieId} site ${job.siteId} came in at ${residualBefore.toFixed(1)} nm — caught by ${caughtBy}. I have it.`,
    { to: 'user' },
  );
  note(
    BOTS.owner.name,
    `Handing ${job.dieId}/${job.siteId} to ${BOTS.analyst.name}: ${qty(job.wafersAtRisk)} wafers at risk, price it.`,
    { to: BOTS.analyst.name, payload: incidentPayload(job) },
  );
  return job;
}

/** The message body the incident owner sends the analyst. */
export function incidentPayload(j = job) {
  if (!j) return null;
  return {
    lot_id: j.lotId,
    die_id: j.dieId,
    site_id: j.siteId,
    residual_before_nm: j.residualBefore,
    residual_after_nm: j.residualAfter,
    wafers_at_risk: j.wafersAtRisk,
    caught_by: j.caughtBy,
    recipe_change_id: j.recipeChangeId,
    cost_model: {
      cost_per_wafer_usd: COST_MODEL.costPerWaferUsd,
      escape_prob_if_missed: COST_MODEL.escapeProbIfMissed,
    },
  };
}

/* --------------------------------------------------------------- actions */

/**
 * Correction ids are derived from the die rather than counted, so the same die
 * gets the same id every run — a presenter who reads one out loud is right the
 * second time too. The stride keeps consecutive dies from looking like
 * consecutive tickets in a queue that also serves the rest of the fab.
 */
const correctionId = (dieId) => `OCR-${4800 + Number(dieId.replace(/\D/g, '')) * 3}`;

/**
 * Beat 2, the paperwork half: a correction filed against the recipe rather than
 * a knob turned on the tool.
 *
 * Filing is not fixing. The change goes into review and the die stays out of
 * spec until somebody applies it — which is the whole point of having this lane
 * next to the manual one. Simulated: the record is authored here, no change
 * management system is called, and the card says so.
 */
export function submitRecipeChange() {
  if (!job) return null;
  const id = correctionId(job.dieId);
  job.recipeChangeId = id;
  job.detail.recipe = {
    id,
    tool: LOT.tool,
    recipe: LOT.recipe,
    scope: `${job.lotId} · ${job.dieId} · site ${job.siteId}`,
    correction: `local T + R fit at site ${job.siteId}; global knobs unchanged`,
    status: 'in review',
    apply: 'pending apply on the tool',
  };
  job.steps.recipe = 'done';
  note('process', `Recipe change ${id} submitted for review — ${job.detail.recipe.correction}.`);
  note(
    BOTS.owner.name,
    `Recipe change ${id} linked to the incident. Process review is the gate, not me — the site is still open.`,
  );
  return job.detail.recipe;
}

/**
 * Beat 4: the analyst prices the miss and appends a row.
 *
 * The append is a real call — see `src/lib/impact-log.js`. Whether it reaches
 * Google Sheets, a local JSONL file, or nothing at all depends on how the app
 * is being served, and the verdict line reports which of the three happened
 * rather than claiming the row landed in the Sheet.
 */
export async function logImpact() {
  if (!job) return null;
  if (impactInFlight) return impactInFlight;

  const incident = job;
  incident.steps.impact = 'pending';
  incident.loggedAt = new Date().toISOString();

  let result;
  impactInFlight = appendImpactRow(incident);
  try {
    result = await impactInFlight;
  } finally {
    impactInFlight = null;
  }

  // Reset demo — or a new incident — while the append was out: the row is
  // written, but the job it belonged to is gone and must not be resurrected.
  if (job !== incident) return result;

  job.transport = result.transport;
  job.detail.impact = result;
  job.steps.impact = 'done';

  note(
    BOTS.analyst.name,
    `${job.dieId}/${job.siteId}: ${qty(job.wafersAtRisk)} wafers × ${usd(COST_MODEL.costPerWaferUsd)} × ${COST_MODEL.escapeProbIfMissed} = ${usd(job.costAvoided)} avoided.`,
    { to: 'user' },
  );
  note(BOTS.analyst.name, `Impact log: ${result.detail}.`, { to: ARTIFACTS.sheet.label });
  return result;
}

export function notifyShift() {
  if (!job) return null;
  job.steps.shift = 'done';
  job.detail.shift = {
    channel: '#fab2-shift-b',
    text: `${job.dieId} site ${job.siteId} caught at ${job.residualBefore.toFixed(1)} nm · ${usd(job.costAvoided)} avoided · owner ${job.owner}`,
  };
  note('floor', `Shift B notified in ${job.detail.shift.channel}.`);
  return job.detail.shift;
}

/** Marks the pack seen. Opening the deck itself is the caller's job. */
export function showWeeklyPack() {
  if (!job) return ARTIFACTS.slides;
  job.steps.weekly = 'done';
  note('floor', 'Weekly ROI pack opened.');
  return ARTIFACTS.slides;
}

export function showBacklog() {
  if (!job) return ARTIFACTS.jira;
  job.steps.backlog = 'done';
  note('floor', 'Backlog stub opened — two themes waiting on a teammate to file them.');
  return ARTIFACTS.jira;
}

/* ------------------------------------------------------------- the log */

function note(actor, text, { to = null, payload = null } = {}) {
  if (!job) return;
  job.log.push({
    at: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    actor,
    to,
    text,
    payload,
  });
}

/** Only the lines a bot sent — what the handoff lane renders. */
export function botTurns(j = job) {
  const names = [BOTS.owner.name, BOTS.analyst.name];
  return j ? j.log.filter((e) => names.includes(e.actor)) : [];
}

/** Steps still open, in checklist order. Empty means the incident is closed. */
export function openSteps(j = job) {
  return j ? RECOVERY_STEPS.filter((s) => j.steps[s.id] !== 'done') : RECOVERY_STEPS;
}
