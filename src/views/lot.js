/** View 1 — the lot board. Current state of every die in the lot. */

import { COST_MODEL, qty, usd, usdCompact } from '../config/artifacts.js';
import {
  DIES,
  LOT,
  SPEC_NM,
  boardGroups,
  dieCostAvoided,
  dieStatus,
  health,
  lotKpis,
  maxResidual,
  residuals,
  waferOrder,
  worstSite,
} from '../data.js';
import { dieThumb } from '../layout-svg.js';
import { currentRecovery, openSteps } from '../recovery.js';
import { COPY, setTldr } from '../tldr.js';
import { fact, healthChips, setStatus, setTabs, setTitleFile } from '../ui.js';

/** How the board is sorted. Presentation state, so it lives with the view. */
let sort = 'fails-first';

/** Reset drops the board back to the order the walkthrough is written against. */
export function resetBoardView() {
  sort = 'fails-first';
}

function cardNote(die) {
  const status = dieStatus(die);
  const worst = worstSite(die);
  if (die.fixed) {
    return `Fixed — knob turned at ${Object.keys(die.knobs.local)[0]} only. ${usd(dieCostAvoided(die))} avoided.`;
  }
  if (status === 'fail') {
    return `Site ${worst.id} is ${worst.r.toFixed(1)} nm out. ${usd(dieCostAvoided(die))} riding on it.`;
  }
  if (status === 'warn') {
    const note = die.notes.metrology || die.notes.process || die.notes.overlay;
    return note || `Site ${worst.id} drifting at ${worst.r.toFixed(1)} nm. Watch it.`;
  }
  return 'All four sites inside spec.';
}

/**
 * Four mini bars, one per site, on a square-root scale so a 22 nm miss and a
 * 0.5 nm one are both readable on the same 26 px strip.
 */
function siteBars(die) {
  return `<div class="sites">
    ${residuals(die)
      .map((s) => {
        const h = Math.max(2, Math.min(1, Math.sqrt(s.r / 22)) * 26);
        const tone = s.r > 8 ? 'fail' : s.r > SPEC_NM ? 'warn' : 'ok';
        return `<div class="site" title="site ${s.id} · ${s.r.toFixed(1)} nm">
            <div class="site__track"><div class="site__bar site__bar--${tone}" style="height:${h.toFixed(0)}px"></div></div>
            <span class="site__id">${s.id}</span>
          </div>`;
      })
      .join('')}
  </div>`;
}

function dieCard(die) {
  const status = dieStatus(die);
  const r = maxResidual(die);
  const rTone = r > 8 ? 'fail' : r > SPEC_NM ? 'warn' : 'ok';
  return `
  <button class="die-card die-card--${status}" data-die="${die.id}">
    <div class="die-card__top">
      <div>
        <div class="die-card__id">${die.id}</div>
        <div class="die-card__pos">row ${die.row} · col ${die.col}</div>
      </div>
      <div class="die-card__res">
        <div class="die-card__res-v die-card__res-v--${rTone}">${r.toFixed(1)}<span class="die-card__res-l"> nm</span></div>
        <div class="die-card__res-l">max |r|</div>
      </div>
    </div>
    <div class="die-card__body">
      ${dieThumb(status)}
      ${healthChips(health(die))}
    </div>
    <div class="die-card__sites">
      ${siteBars(die)}
      <span class="die-card__sites-label">per-site residual</span>
    </div>
    <div class="die-card__note ${status === 'fail' ? 'die-card__note--fail' : ''}">${cardNote(die)}</div>
  </button>`;
}

/* --------------------------------------------------------- the board body */

const SECTIONS = [
  {
    key: 'fail',
    title: 'Needs fix',
    note: 'worst residual first — open these before anything else',
    empty: 'Nothing is failing. Every die in this lot is inside spec.',
  },
  { key: 'warn', title: 'Watching', note: 'drifting, not failing — leave the knobs alone' },
  { key: 'ok', title: 'In spec', note: 'nothing to do here' },
];

function section({ key, title, count, note, body }) {
  return `
  <section class="board-section">
    <header class="board-section__head">
      <span class="board-section__dot board-section__dot--${key}"></span>
      <h2 class="board-section__title">${title}</h2>
      <span class="board-section__count">${count} die${count === 1 ? '' : 's'}</span>
      <span class="board-section__note">${note}</span>
    </header>
    ${body}
  </section>`;
}

/**
 * Fails first is the stage default: a presenter should hit the dies that need a
 * decision without hunting the grid. Wafer map is there for anyone who wants
 * the physical layout back.
 */
function board() {
  if (sort === 'wafer') {
    return section({
      key: 'wafer',
      title: 'Wafer map',
      count: DIES.length,
      note: 'row / col order, as the tool reports it',
      body: `<div class="dies">${waferOrder().map(dieCard).join('')}</div>`,
    });
  }

  const groups = boardGroups();
  return SECTIONS.filter((s) => groups[s.key].length || s.empty)
    .map((s) =>
      section({
        key: s.key,
        title: s.title,
        count: groups[s.key].length,
        note: groups[s.key].length ? s.note : '',
        body: groups[s.key].length
          ? `<div class="dies">${groups[s.key].map(dieCard).join('')}</div>`
          : `<div class="banner banner--ok">${s.empty}</div>`,
      }),
    )
    .join('');
}

/* ------------------------------------------------------------ the view */

export function renderLot(app) {
  const k = lotKpis();
  setTabs('lot');
  setTitleFile(`${LOT.id} · lot board`);
  setTldr(COPY.lot(k));

  const groups = boardGroups();
  const fails = groups.fail;
  const watches = groups.warn;
  const yieldTone = k.openFails > 0 ? 'warn' : 'ok';
  const job = currentRecovery();
  // The wafer count the money is built from, so the headline can be checked
  // against the tool's throughput rather than taken on faith.
  const waferCount = fails.reduce((sum, d) => sum + d.wafersAtRisk, 0);

  app.innerHTML = `
  <div class="stage">
    <!-- Lot health: the summary band. Deliberately not shaped like the
         board controls below it — these are numbers, not filters. -->
    <section class="lot-health">
      <header class="lot-health__head">
        <h2 class="lot-health__title">Lot health · current state</h2>
        <span class="lot-health__meta">${LOT.id} · ${DIES.length} dies · measured after exposure</span>
      </header>
      <div class="lot-health__stats">
        <div class="stat">
          <div class="stat__label">Predicted yield</div>
          <div class="stat__value stat__value--${yieldTone}">${k.yield.toFixed(0)}<span class="stat__unit">%</span></div>
          <div class="stat__sub">${DIES.length - k.openFails} of ${DIES.length} dies shippable</div>
        </div>
        <div class="stat">
          <div class="stat__label">Max residual</div>
          <div class="stat__value stat__value--${k.maxResidual > 8 ? 'fail' : k.maxResidual > SPEC_NM ? 'warn' : 'ok'}">${k.maxResidual.toFixed(1)}<span class="stat__unit">nm</span></div>
          <div class="stat__sub">worst site anywhere in the lot · spec ${SPEC_NM.toFixed(1)} nm</div>
        </div>
        <div class="stat">
          <div class="stat__label">Open fails</div>
          <div class="stat__value stat__value--${k.openFails ? 'fail' : 'ok'}">${k.openFails}</div>
          <div class="stat__sub">${k.fixedCount} fixed this session</div>
        </div>
        <!-- The catch, in the only unit the room agrees on. Watch items are
             not priced here: pricing a die nobody will touch inflates it. -->
        <div class="stat">
          <div class="stat__label">$ at risk</div>
          <div class="stat__value stat__value--${k.dollarsAtRisk ? 'fail' : 'ok'}">${usdCompact(k.dollarsAtRisk)}</div>
          <div class="stat__sub">open fails only · ${usd(k.dollarsAtRisk)} at ${usdCompact(COST_MODEL.costPerWaferUsd)}/wafer × ${COST_MODEL.escapeProbIfMissed} escape</div>
        </div>
      </div>
      <div class="factbar">
        ${fact('layers', LOT.layerPair)}
        ${fact('tool', `${LOT.tool} · ${LOT.throughputWph} wph`)}
        ${fact('recipe', LOT.recipe)}
        ${fact('spec', `${SPEC_NM.toFixed(1)} nm`)}
        ${fact('wafers at risk', `${qty(waferCount)} across ${fails.length} open fail${fails.length === 1 ? '' : 's'}`)}
      </div>
    </section>

    ${
      job
        ? `<div class="banner banner--info">
            <strong>${job.dieId}</strong> has an open incident — ${usd(job.costAvoided)} priced,
            ${openSteps(job).length} of 5 checks left.
            <a href="#/recovery">Open the recovery rail →</a>
          </div>`
        : ''
    }

    <div class="board-controls">
      <span class="board-controls__label">Board order</span>
      <div class="seg" role="group" aria-label="Board order">
        <button class="seg__btn ${sort === 'fails-first' ? 'is-on' : ''}" data-sort="fails-first">Fails first</button>
        <button class="seg__btn ${sort === 'wafer' ? 'is-on' : ''}" data-sort="wafer">Wafer map</button>
      </div>
      <span class="board-controls__hint">click any die to open the layout viewer</span>
      <a class="btn btn--ghost btn--sm" href="#/recovery">Recovery rail →</a>
    </div>

    <div class="board">${board()}</div>

    <p class="section-note">
      Health chips, left to right: <strong>Lithography</strong> — did the exposure print correctly.
      <strong>Overlay</strong> — did this layer land on the one below it.
      <strong>Metrology</strong> — do we trust the measurement.
      <strong>Process</strong> — are the correction knobs current.
      Simulated data; no live tool or model calls.
    </p>
  </div>`;

  setStatus(
    `lot ${LOT.id}`,
    `${DIES.length} dies · ${k.openFails} fail · ${watches.length} watch`,
    `${LOT.file} · read-only`,
  );

  app.querySelectorAll('[data-die]').forEach((btn) => {
    btn.addEventListener('click', () => {
      location.hash = `#/die/${btn.dataset.die}`;
    });
  });

  app.querySelectorAll('[data-sort]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sort = btn.dataset.sort;
      renderLot(app);
    });
  });
}
