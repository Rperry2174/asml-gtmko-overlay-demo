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

/* -------------------------------------------------- public scale anchors */

/**
 * Published ASML figures, used only to size the demo so it reads at the scale
 * of the customer rather than at the scale of a toy.
 *
 * Everything here is public and cited. There is no ASML internal data in this
 * repo and nothing here is a forecast of anyone's yield loss — see
 * `docs/COST_MODEL.md` for the sources and for every assumption laid out.
 */
export const ASML_PUBLIC = {
  fiscalYear: 2025,
  /** Total net sales, US GAAP. €32,667m as reported. */
  totalNetSalesEur: 32_700_000_000,
  netSystemSalesEur: 24_500_000_000,
  netServiceAndFieldOptionSalesEur: 8_200_000_000,
  systemsSoldUnits: 535,
  backlogEur: 38_800_000_000,
  source: 'ASML Q4 and full-year 2025 results, 28 January 2026',
  sourceUrl: 'https://www.asml.com/en/news/press-releases/2026/q4-2025-financial-results',
};

/**
 * The tool the lot is exposed on, at its published specification. Throughput
 * is what turns a drift window into a wafer count, so it has to be a number
 * anyone can look up rather than one we picked.
 */
export const TOOL_SPEC = {
  model: 'NXE:3800E',
  /** Wafers per hour at 30 mJ/cm², full productivity spec. */
  throughputWph: 220,
  matchedMachineOverlayNm: 0.9,
  source: 'ASML 2025 Annual Report — TWINSCAN NXE:3800E at full productivity specification',
};

/**
 * Wafers exposed in a drift window, from the tool's own throughput.
 *
 * The window is how long a site can be out before the next overlay check sees
 * it. That is what makes the wafer count traceable instead of authored: at
 * 220 wafers an hour, an eight-hour sampling gap is 1,760 exposed wafers.
 *
 * @param {number} hours
 * @returns {number} whole wafers
 */
export function wafersExposed(hours, wph = TOOL_SPEC.throughputWph) {
  return Math.round(hours * wph);
}

/** `1,760` — a wafer count at four digits is unreadable without the comma. */
export const qty = (v) => Math.round(v).toLocaleString('en-US');

/* ------------------------------------------------------------ cost model */

/**
 * The one formula the whole ROI story rests on:
 *
 *   cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed
 *
 * `costPerWaferUsd` is a 2 nm-class 300 mm wafer at the price the trade press
 * reports, because the layer pair in this lot is one the NXE:3800E is sold to
 * print. Foundries do not publish wafer prices, so it is an estimate and is
 * labelled as one everywhere it shows up.
 *
 * `escapeProbIfMissed` is the share of at-risk wafers that would have shipped
 * before anyone noticed. It is the honest hedge in the number: catching a miss
 * is not worth a whole wafer, it is worth the chance the miss escaped. It is
 * ours, not anyone's published figure.
 */
export const COST_MODEL = {
  costPerWaferUsd: 30000,
  escapeProbIfMissed: 0.35,
  formula: 'cost_avoided = wafers_at_risk * cost_per_wafer_usd * escape_prob_if_missed',
  basis: {
    costPerWaferUsd:
      'reported estimate for a 2 nm-class 300 mm wafer (~$30k); no foundry publishes wafer prices',
    escapeProbIfMissed: 'our assumption — the share of at-risk wafers that would have shipped',
    wafersAtRisk: `tool throughput × drift window (${TOOL_SPEC.throughputWph} wph, published spec)`,
  },
};

/** @returns {number} whole dollars — the Sheet stores integers. */
export function costAvoided(wafersAtRisk, model = COST_MODEL) {
  return Math.round(wafersAtRisk * model.costPerWaferUsd * model.escapeProbIfMissed);
}

/** `$10,500` — what one at-risk wafer is worth catching, before the count. */
export const perWaferAtRisk = (model = COST_MODEL) =>
  Math.round(model.costPerWaferUsd * model.escapeProbIfMissed);

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

/** `$18,480,000` — what the Sheet and the recovery rail print. */
export const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;

/** `$18.5M` — the same number sized for the back of the room. */
export function usdCompact(v) {
  const n = Math.round(v);
  const abs = Math.abs(n);
  if (abs < 1000) return `$${n}`;
  const [scaled, suffix] = abs < 1_000_000 ? [n / 1000, 'k'] : [n / 1_000_000, 'M'];
  return `$${Math.abs(scaled) >= 100 ? scaled.toFixed(0) : scaled.toFixed(1)}${suffix}`;
}
