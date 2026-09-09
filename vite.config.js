import { appendFileSync } from 'node:fs';
import { defineConfig } from 'vite';

/**
 * The append endpoint behind the recovery rail's **Log impact** button.
 *
 * Two modes, one route. With `GOOGLE_SHEETS_ACCESS_TOKEN` in the environment it
 * forwards to the real Sheets `values:append` API; without it, it writes the
 * row to `.impact-log.jsonl` (gitignored) and says so. The client always makes
 * the same call — see `src/lib/impact-log.js` — so wiring the live connector is
 * a credential, not a rewrite.
 *
 * The token is read from the environment and never logged. Do not commit one.
 */
function impactLogEndpoint() {
  return {
    name: 'impact-log-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/impact/append', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body;
        try {
          body = JSON.parse(await readBody(req));
        } catch {
          return json(res, 400, { ok: false, detail: 'body must be JSON' });
        }
        const { spreadsheetId, sheetName, values } = body ?? {};
        if (!spreadsheetId || !Array.isArray(values) || !values.length) {
          return json(res, 400, { ok: false, detail: 'spreadsheetId and values are required' });
        }

        const token = process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
        let why = 'no GOOGLE_SHEETS_ACCESS_TOKEN';
        if (token) {
          try {
            const detail = await appendToSheets({ spreadsheetId, sheetName, values, token });
            return json(res, 200, { ok: true, transport: 'sheets', detail });
          } catch (err) {
            // A bad token should not take the demo down mid-run: fall through
            // to the local log and tell the UI which one it actually got.
            why = `Sheets append failed (${err.message})`;
          }
        }

        appendFileSync(
          '.impact-log.jsonl',
          values.map((v) => JSON.stringify({ at: new Date().toISOString(), row: v })).join('\n') + '\n',
        );
        return json(res, 200, {
          ok: true,
          transport: 'mock',
          detail: `${why} — row written to .impact-log.jsonl`,
        });
      });
    },
  };
}

/**
 * Shorter than the browser helper's 4s abort in `src/lib/impact-log.js`, on
 * purpose: a hung Sheets call has to give up here first, or the client reports
 * `local` while the row is still on its way and a retry appends it twice.
 */
const SHEETS_TIMEOUT_MS = 3000;

async function appendToSheets({ spreadsheetId, sheetName, values, token }) {
  const range = encodeURIComponent(`${sheetName || 'Sheet1'}!A:N`);
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}` +
    ':append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ values }),
    signal: AbortSignal.timeout(SHEETS_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const out = await res.json();
  return `appended to ${out?.updates?.updatedRange ?? sheetName}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [impactLogEndpoint()],
});
