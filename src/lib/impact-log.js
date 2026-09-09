/**
 * The one place the app talks to something outside itself.
 *
 * `appendImpactRow` builds the row the impact Sheet expects and POSTs it to
 * `/api/impact/append`. What happens on the other side depends on how the app
 * is being served, and the caller is told which of the three it got:
 *
 *   sheets  the dev server had Google credentials and appended to the live
 *           Sheet — this is the real thing
 *   mock    the dev server answered but had no credentials, so the row went to
 *           a local JSONL file instead
 *   local   nothing answered (static hosting, file://) — the row exists only in
 *           the app's own recovery state
 *
 * The call is the same in all three cases. Only the confirmation differs, and
 * the UI says which one it got rather than claiming the row landed in Sheets.
 */

import { ARTIFACTS, SHEET_COLUMNS, sheetRow } from '../config/artifacts.js';

export const IMPACT_ENDPOINT = '/api/impact/append';

/** Give up rather than leave the presenter watching a spinner. */
const TIMEOUT_MS = 4000;

/**
 * @param {object} incident the priced incident — see `sheetRow`
 * @returns {Promise<{ok: boolean, transport: 'sheets'|'mock'|'local', detail: string, row: (string|number)[]}>}
 */
export async function appendImpactRow(incident) {
  const row = sheetRow(incident);
  const body = {
    spreadsheetId: ARTIFACTS.sheet.spreadsheetId,
    sheetName: ARTIFACTS.sheet.sheetName,
    columns: SHEET_COLUMNS,
    values: [row],
  };

  try {
    const res = await fetchWithTimeout(IMPACT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`append endpoint returned ${res.status}`);
    const json = await res.json();
    return {
      ok: true,
      transport: json.transport === 'sheets' ? 'sheets' : 'mock',
      detail: json.detail ?? 'row appended',
      row,
    };
  } catch (err) {
    return {
      ok: true,
      transport: 'local',
      detail: `no append endpoint (${short(err)}) — row held in the app`,
      row,
    };
  }
}

async function fetchWithTimeout(url, init) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: abort.signal });
  } finally {
    clearTimeout(timer);
  }
}

const short = (err) => (err?.name === 'AbortError' ? 'timed out' : String(err?.message ?? err));
