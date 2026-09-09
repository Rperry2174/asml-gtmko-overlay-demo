/**
 * Where a recovery job leaves its evidence, and what it prices itself with.
 *
 * The demo's second half is an accounting story: a miss is caught at the tool,
 * priced in dollars, and handed to an owner. Every number in that sentence
 * comes from this file, so re-pricing the story for a different customer is a
 * constant edit rather than a hunt through the views.
 *
 * Nothing here is a secret. The Sheet and the deck are demo artifacts, and the
 * only credential in the whole flow lives in the dev server's environment — see
 * `vite.config.js` and `src/lib/impact-log.js`.
 */

export const ARTIFACTS = {
  sheet: {
    id: 'sheet',
    label: 'Yield impact log',
    where: 'Google Sheets',
    url: 'https://docs.google.com/spreadsheets/d/1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY/edit',
    spreadsheetId: '1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY',
    sheetName: 'impact_log',
    owner: 'yield-impact-analyst',
    note: 'One row per priced incident. The analyst appends; nobody types into it by hand.',
  },
  slides: {
    id: 'slides',
    label: 'Weekly ROI pack',
    where: 'Google Slides',
    url: 'https://docs.google.com/presentation/d/1ipbu1IOxCQkOUKKhzdkiNRTikI60kgt5FLm6CO5jA6M/edit',
    owner: 'teammate — Slides generation',
    note: 'Rolls the week of impact rows into the deck the shift lead presents on Monday.',
  },
  jira: {
    id: 'jira',
    label: 'Backlog from weekly themes',
    where: 'Jira',
    url: null,
    owner: 'teammate — ticket creation',
    note: 'Stub. A teammate owns turning repeated weekly themes into real tickets.',
  },
};

/** True only for an artifact that can actually be opened in a browser today. */
export const hasLiveUrl = (artifact) =>
  typeof artifact?.url === 'string' && artifact.url.startsWith('http');

/**
 * The Jira panel is a stub on purpose — it is the piece a teammate owns. These
 * two cards stand in for what ticket creation from weekly themes would produce.
 */
export const JIRA_STUB_TICKETS = [
  {
    key: 'ASML-101',
    title: 'Recurring box-in-box drift at site B on NXE:3800E',
    theme: 'same signature on D05 and D07 two weeks running',
    owner: 'unassigned',
  },
  {
    key: 'ASML-102',
    title: 'Auto-price overlay incidents into the weekly ROI pack',
    theme: 'impact rows are logged but rolled up by hand',
    owner: 'unassigned',
  },
];

/* ------------------------------------------------------------ cost model */

/**
 * The one formula the whole ROI story rests on:
 *
 *   cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed
 *
 * `escapeProbIfMissed` is the share of at-risk wafers that would have shipped
 * before anyone noticed. It is the honest hedge in the number: catching a miss
 * is not worth a whole wafer, it is worth the chance the miss escaped.
 */
export const COST_MODEL = {
  costPerWaferUsd: 8500,
  escapeProbIfMissed: 0.35,
  formula: 'cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed',
};

/** @returns {number} whole dollars — the Sheet stores integers. */
export function costAvoided(wafersAtRisk, model = COST_MODEL) {
  return Math.round(wafersAtRisk * model.costPerWaferUsd * model.escapeProbIfMissed);
}

/* ---------------------------------------------------------- the sheet row */

/**
 * Column order of the live impact log, top row first.
 *
 * This list is the contract between three things that have to agree: the Sheet
 * itself, `agents/yield-impact-analyst/agent/instructions.md`, and the append
 * call in `src/lib/impact-log.js`. Change it here and change it in all three.
 */
export const SHEET_COLUMNS = [
  'logged_at',
  'lot_id',
  'die_id',
  'site_id',
  'residual_before_nm',
  'residual_after_nm',
  'wafers_at_risk',
  'cost_per_wafer_usd',
  'escape_prob_if_missed',
  'cost_avoided_usd',
  'caught_by',
  'owner',
  'recipe_change_id',
  'notes',
];

/**
 * Flatten one priced incident into the row the Sheet expects.
 *
 * @param {object} incident
 * @returns {(string|number)[]} one value per entry in `SHEET_COLUMNS`
 */
export function sheetRow(incident) {
  const row = {
    logged_at: incident.loggedAt ?? new Date().toISOString(),
    lot_id: incident.lotId,
    die_id: incident.dieId,
    site_id: incident.siteId,
    residual_before_nm: incident.residualBefore ?? '',
    residual_after_nm: incident.residualAfter ?? '',
    wafers_at_risk: incident.wafersAtRisk,
    cost_per_wafer_usd: COST_MODEL.costPerWaferUsd,
    escape_prob_if_missed: COST_MODEL.escapeProbIfMissed,
    cost_avoided_usd: incident.costAvoided,
    caught_by: incident.caughtBy,
    owner: incident.owner,
    recipe_change_id: incident.recipeChangeId ?? '',
    notes: incident.notes ?? '',
  };
  return SHEET_COLUMNS.map((c) => row[c]);
}

/* -------------------------------------------------------------- money fmt */

/** `$178,500` — what the Sheet and the recovery rail print. */
export const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;

/** `$178.5k` — the same number sized for the back of the room. */
export function usdCompact(v) {
  const n = Math.round(v);
  if (Math.abs(n) < 1000) return `$${n}`;
  const k = n / 1000;
  return `$${k >= 100 ? k.toFixed(0) : k.toFixed(1)}k`;
}
