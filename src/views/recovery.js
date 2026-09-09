/**
 * View 4 — the recovery rail.
 *
 * The die is green. This is what happens next: the miss gets a price, a row in
 * a log, an owner, and a place in Monday's pack. Five checks, and the incident
 * is not closed until all five are.
 *
 * The same panel renders in two places — inline under a finished factory run,
 * and full width at `#/recovery` — so the presenter can work the checklist
 * without leaving the run, or open the rail on its own from the lot board.
 */

import {
  ARTIFACTS,
  COST_MODEL,
  JIRA_STUB_TICKETS,
  SHEET_COLUMNS,
  hasLiveUrl,
  sheetRow,
  usd,
} from '../config/artifacts.js';
import { LOT } from '../data.js';
import {
  BOTS,
  RECOVERY_STEPS,
  botTurns,
  currentRecovery,
  incidentPayload,
  logImpact,
  notifyShift,
  openSteps,
  pendingImpact,
  showBacklog,
  showWeeklyPack,
  submitRecipeChange,
} from '../recovery.js';
import { COPY, setTldr } from '../tldr.js';
import { kv, setStatus, setTabs, setTitleFile } from '../ui.js';

const TRANSPORT_NOTE = {
  sheets: 'appended to the live Sheet',
  mock: 'written to the dev server’s local log',
  local: 'held in the app — no append endpoint answered',
};

/* ------------------------------------------------------------- the panel */

/**
 * Render the recovery panel into a host element and keep it wired.
 *
 * Actions mutate the job and re-render in place, so the caller does not have to
 * know anything about recovery state.
 *
 * @param {HTMLElement} host
 * @param {{compact?: boolean, onUpdate?: (() => void)|null}} opts compact drops
 *   the detail cards and points at the full rail instead — it is the version
 *   that sits under a factory run; onUpdate repaints whatever chrome outside
 *   the host also reads the job
 */
export function mountRecoveryPanel(host, { compact = false, onUpdate = null } = {}) {
  if (!host) return;
  // Which detail cards the presenter has opened. View state, not job state:
  // reopening the rail should not re-expand everything they closed.
  const open = { weekly: false, backlog: false };
  let busy = false;

  const paint = () => {
    host.innerHTML = panel({ compact, open, busy });
    wire();
    onUpdate?.();
  };

  const run = async (fn) => {
    busy = true;
    paint();
    await fn();
    busy = false;
    paint();
  };

  function wire() {
    host.querySelectorAll('[data-recovery-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        switch (btn.dataset.recoveryAction) {
          case 'recipe':
            submitRecipeChange();
            paint();
            break;
          case 'impact':
            run(logImpact);
            break;
          case 'shift':
            notifyShift();
            paint();
            break;
          case 'weekly':
            showWeeklyPack();
            open.weekly = compact ? false : !open.weekly;
            window.open(ARTIFACTS.slides.url, '_blank', 'noopener');
            paint();
            break;
          case 'backlog':
            showBacklog();
            open.backlog = compact ? false : !open.backlog;
            paint();
            break;
        }
      });
    });
  }

  // Mounting while an append is out — the compact panel's link to the full
  // rail, clicked mid-request — waits on that one instead of leaving the row
  // stuck on “appending…” or offering the button again.
  const inFlight = pendingImpact();
  if (inFlight) run(() => inFlight);
  else paint();
}

function panel({ compact, open, busy }) {
  const job = currentRecovery();
  if (!job) return emptyState();

  const remaining = openSteps(job).length;
  return `
  <section class="recovery">
    <header class="recovery__head">
      <div>
        <h2 class="recovery__title">Recovery · ${job.lotId} / ${job.dieId}</h2>
        <p class="recovery__meta">
          site ${job.siteId} · caught by ${job.caughtBy} · ${job.wafersAtRisk} wafers at risk
        </p>
      </div>
      <div class="recovery__money">
        <div class="recovery__money-v">${usd(job.costAvoided)}</div>
        <div class="recovery__money-l">cost avoided</div>
      </div>
    </header>

    <ol class="checklist">
      ${RECOVERY_STEPS.map((s) => checkRow(s, job, busy)).join('')}
    </ol>

    <p class="recovery__state ${remaining ? '' : 'recovery__state--ok'}">
      ${
        remaining
          ? `${remaining} of ${RECOVERY_STEPS.length} still open — the incident is caught and priced, not closed.`
          : 'All five closed. Caught, priced, assigned, and in Monday’s pack.'
      }
    </p>

    ${botLane(job, compact)}
    ${compact ? '' : detailCards(job, open)}
    ${
      compact
        ? `<div class="recovery__more"><a class="btn btn--ghost" href="#/recovery">Open the recovery rail →</a></div>`
        : ''
    }
  </section>`;
}

function checkRow(step, job, busy) {
  const state = job.steps[step.id];
  const done = state === 'done';
  const pending = state === 'pending';
  return `
  <li class="check-row ${done ? 'is-done' : ''} ${pending ? 'is-pending' : ''}">
    <span class="check-row__mark">${done ? '✓' : pending ? '·' : '○'}</span>
    <span class="check-row__label">${step.label}</span>
    <span class="check-row__detail">${done || pending ? stepDetail(step.id, job) : step.todo}</span>
    <button
      class="btn btn--ghost btn--sm"
      data-recovery-action="${step.id}"
      ${busy || pending || (done && ONE_SHOT.has(step.id)) ? 'disabled' : ''}
    >${done && !ONE_SHOT.has(step.id) ? 'Show again' : step.action}</button>
  </li>`;
}

/** Steps that are a side effect rather than a view — clicking twice is wrong. */
const ONE_SHOT = new Set(['recipe', 'impact', 'shift']);

function stepDetail(id, job) {
  const d = job.detail;
  switch (id) {
    case 'recipe':
      return d.recipe
        ? `${d.recipe.id} · ${d.recipe.tool} · site ${job.siteId} · ${d.recipe.status}`
        : '—';
    case 'impact':
      if (job.steps.impact === 'pending') return 'appending…';
      return d.impact ? `${usd(job.costAvoided)} · ${TRANSPORT_NOTE[d.impact.transport]}` : '—';
    case 'shift':
      return d.shift ? `${d.shift.channel} notified` : '—';
    case 'weekly':
      return 'in the weekly pack';
    case 'backlog':
      return `${JIRA_STUB_TICKETS.length} themes waiting on a teammate to file them`;
    default:
      return '—';
  }
}

/* ---------------------------------------------------------- the bot lane */

/**
 * Beat 3 on screen: the recovery path wakes the intake bot, which peers to the
 * analyst. The lines are the ones the agents are instructed to send, and the
 * payload is the message body — see `agents/<bot>/agent/instructions.md`.
 */
function botLane(job, compact) {
  const turns = botTurns(job);
  const linesFor = (name) => turns.filter((t) => t.actor === name);
  const card = (bot) => {
    const lines = linesFor(bot.name);
    return `
    <div class="bot ${lines.length ? 'is-awake' : ''}">
      <div class="bot__head">
        <span class="bot__dot"></span>
        <span class="bot__name">${bot.name}</span>
        <span class="bot__state">${lines.length ? 'awake' : 'idle'}</span>
      </div>
      <div class="bot__role">${bot.role}</div>
      ${
        lines.length
          ? lines
              .map(
                (l) =>
                  `<p class="bot__line"><span class="bot__to">→ ${l.to ?? 'log'}</span>${l.text}</p>`,
              )
              .join('')
          : `<p class="bot__line bot__line--idle">Waiting on a handoff.</p>`
      }
    </div>`;
  };

  const payload = incidentPayload(job);
  return `
  <div class="lane">
    <h3 class="lane__title">Grok Bots on this incident</h3>
    <div class="lane__bots">
      ${card(BOTS.owner)}
      <span class="lane__arrow" aria-hidden="true">→</span>
      ${card(BOTS.analyst)}
    </div>
    ${
      compact
        ? ''
        : `<details class="lane__payload">
            <summary>message body sent to ${BOTS.analyst.name}</summary>
            <pre>${JSON.stringify(payload, null, 2)}</pre>
          </details>`
    }
  </div>`;
}

/* ------------------------------------------------------- the detail cards */

function detailCards(job, open) {
  return [
    job.detail.recipe ? recipeCard(job.detail.recipe) : '',
    job.detail.impact ? impactCard(job) : '',
    open.weekly ? weeklyCard() : '',
    open.backlog ? backlogCard() : '',
  ].join('');
}

function recipeCard(change) {
  const field = (label, value) => `<tr><td>${label}</td><td class="rowtable__v">${value}</td></tr>`;
  return `
  <article class="card">
    <header class="card__head">
      <span class="pill pill--info">Recipe change · queued</span>
      <h3 class="card__title">${change.id} — overlay correction</h3>
    </header>
    <div class="card__body">
      <table class="rowtable">
        <tbody>
          ${field('correction id', change.id)}
          ${field('tool', change.tool)}
          ${field('recipe', change.recipe)}
          ${field('scope', change.scope)}
          ${field('proposed correction', change.correction)}
          ${field('status', `${change.status} · ${change.apply}`)}
        </tbody>
      </table>
      <p class="section-note">
        Filed, not applied. The correction is queued for process review and nothing on the tool has
        moved, so the site is still out of spec — a filed change is not a knob turned. Simulated:
        the record is authored here, no change-management system is called.
      </p>
    </div>
  </article>`;
}

function impactCard(job) {
  const row = sheetRow(job);
  return `
  <article class="card">
    <header class="card__head">
      <span class="pill pill--${job.detail.impact.transport === 'sheets' ? 'ok' : 'info'}">
        Impact log · ${job.detail.impact.transport}
      </span>
      <h3 class="card__title">${ARTIFACTS.sheet.label}</h3>
    </header>
    <div class="card__body">
      <table class="rowtable">
        <tbody>
          ${SHEET_COLUMNS.map(
            (c, i) => `<tr><td>${c}</td><td class="rowtable__v">${row[i] === '' ? '—' : row[i]}</td></tr>`,
          ).join('')}
        </tbody>
      </table>
      <p class="section-note">${job.detail.impact.detail}</p>
      <a class="btn btn--ghost" href="${ARTIFACTS.sheet.url}" target="_blank" rel="noopener">
        Open the impact Sheet ↗
      </a>
    </div>
  </article>`;
}

function weeklyCard() {
  return `
  <article class="card">
    <header class="card__head">
      <span class="pill pill--ok">Weekly ROI · ready</span>
      <h3 class="card__title">${ARTIFACTS.slides.label}</h3>
    </header>
    <div class="card__body">
      <p>${ARTIFACTS.slides.note}</p>
      <a class="btn btn--ghost" href="${ARTIFACTS.slides.url}" target="_blank" rel="noopener">Open the pack ↗</a>
      <p class="section-note">Owned by: ${ARTIFACTS.slides.owner}.</p>
    </div>
  </article>`;
}

function backlogCard() {
  return `
  <article class="card">
    <header class="card__head">
      <span class="pill pill--info">Backlog · stub</span>
      <h3 class="card__title">Teammate owns: create tickets from weekly themes</h3>
    </header>
    <div class="card__body">
      <div class="tickets">
        ${JIRA_STUB_TICKETS.map(
          (t) => `<div class="ticket">
            <div class="ticket__key">${t.key}</div>
            <div class="ticket__title">${t.title}</div>
            <div class="ticket__theme">theme: ${t.theme}</div>
            <div class="ticket__owner">${t.owner}</div>
          </div>`,
        ).join('')}
      </div>
      <p class="section-note">${ARTIFACTS.jira.note}</p>
    </div>
  </article>`;
}

function emptyState() {
  return `
  <section class="recovery">
    <div class="banner banner--info">
      <strong>No recovery job open.</strong> Open a failing die and either run the fix by hand or
      submit a recipe change — both land here.
    </div>
    <p class="section-note">
      The artifacts below stay put between incidents. The checklist is what changes.
    </p>
  </section>`;
}

/* -------------------------------------------------------------- the view */

export function renderRecovery(app) {
  const job = currentRecovery();
  setTabs('recovery');
  setTitleFile(job ? `${LOT.id} · ${job.dieId} · recovery` : `${LOT.id} · recovery`);

  app.innerHTML = `
  <div class="workspace">
    <aside class="rail">
      <h2 class="rail__title">Incident</h2>
      <div class="rail__block">
        ${
          job
            ? [
                kv('lot', job.lotId),
                kv('die', job.dieId),
                kv('site', job.siteId),
                kv('caught by', job.caughtBy),
                kv('owner', job.owner),
                kv('wafers', String(job.wafersAtRisk)),
              ].join('')
            : `<p class="muted">Nothing open.</p>`
        }
      </div>

      <h2 class="rail__title">Cost model</h2>
      <div class="rail__block">
        <div class="model"><span class="m-eq">cost_avoided =</span>
  wafers_at_risk
× cost_per_wafer_usd
× escape_prob_if_missed</div>
        ${kv('cost / wafer', usd(COST_MODEL.costPerWaferUsd))}
        ${kv('escape prob', COST_MODEL.escapeProbIfMissed.toFixed(2))}
        ${job ? kv('= avoided', usd(job.costAvoided)) : ''}
      </div>
      <p class="section-note">
        Escape probability is the hedge: catching a miss is worth the chance it would have shipped,
        not a whole wafer.
      </p>
    </aside>

    <section class="canvas">
      <div class="crumb">
        <a href="#/lot">← lot board</a><span>/</span>
        ${job ? `<a href="#/die/${job.dieId}">${job.dieId}</a><span>/</span>` : ''}
        <span>recovery</span>
      </div>
      <div class="toolbar">
        <span class="tool tool--active">caught → priced → assigned</span>
        <span class="tool" id="recovery-open"></span>
        <span class="toolbar__spacer">artifacts are shared; the checklist is per incident</span>
      </div>
      <div id="recovery-panel"></div>
    </section>

    <aside class="rail rail--right">
      <h2 class="rail__title">Artifacts</h2>
      <div class="rail__block stack">
        ${Object.values(ARTIFACTS).map(artifactLink).join('')}
      </div>

      <h2 class="rail__title">Recovery log</h2>
      <div class="log" id="recovery-log"></div>

      <div class="rail__block stack" style="margin-top:14px">
        <button class="btn btn--ghost" id="back-lot">← back to lot board</button>
      </div>
    </aside>
  </div>`;

  // Everything outside the panel that reads the job — story strip, open count,
  // log, status bar — is painted here, so closing a check updates the screen
  // the presenter is looking at rather than only the checklist on it.
  const paintChrome = () => {
    const count = document.getElementById('recovery-open');
    // An append that lands after the presenter navigated away has no chrome
    // left to write: the strip and status bar belong to the view now on screen.
    if (!count) return;
    const j = currentRecovery();
    setTldr(COPY.recovery(j));
    count.textContent = j ? `${openSteps(j).length} open` : 'no incident';
    document.getElementById('recovery-log').innerHTML = logLines(j);
    setStatus(
      j ? `recovery · ${j.dieId}` : 'recovery · idle',
      j ? `${openSteps(j).length} of ${RECOVERY_STEPS.length} open · ${usd(j.costAvoided)} avoided` : '',
      `${LOT.file} · simulated`,
    );
  };

  mountRecoveryPanel(document.getElementById('recovery-panel'), { onUpdate: paintChrome });
  document.getElementById('back-lot').onclick = () => (location.hash = '#/lot');
}

function logLines(job) {
  if (!job || !job.log.length) return `<div class="log__line"><span>Nothing yet.</span></div>`;
  return job.log
    .map(
      (e) =>
        `<div class="log__line"><span class="log__t">${e.at}</span><span><strong>${e.actor}</strong> ${e.text}</span></div>`,
    )
    .join('');
}

function artifactLink(a) {
  const live = hasLiveUrl(a);
  return `<div class="artifact">
    <div class="artifact__head">
      <span class="artifact__label">${a.label}</span>
      <span class="artifact__where">${a.where}</span>
    </div>
    ${
      live
        ? `<a class="artifact__link" href="${a.url}" target="_blank" rel="noopener">open ↗</a>`
        : `<span class="artifact__pending">stub</span>`
    }
    <p class="artifact__note">${a.note}</p>
  </div>`;
}
