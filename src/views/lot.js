/** View 1 — the lot board. Current state of every die in the lot. */

import {
  DIES,
  LOT,
  SPEC_NM,
  dieStatus,
  health,
  lotKpis,
  maxResidual,
  worstSite,
} from '../data.js';
import { dieThumb } from '../layout-svg.js';
import { COPY, setTldr } from '../tldr.js';
import { healthChips, kv, setStatus, setTabs, setTitleFile } from '../ui.js';

const tone = (s) => (s === 'fail' ? 'fail' : s === 'warn' ? 'warn' : 'ok');

function cardNote(die) {
  const status = dieStatus(die);
  const worst = worstSite(die);
  if (die.fixed) return `Fixed by hand — knob turned at ${Object.keys(die.knobs.local)[0]} only.`;
  if (status === 'fail') return `Site ${worst.id} is ${worst.r.toFixed(1)} nm out. Scrap risk.`;
  if (status === 'warn') {
    const note = die.notes.metrology || die.notes.process || die.notes.overlay;
    return note || `Site ${worst.id} drifting at ${worst.r.toFixed(1)} nm. Watch it.`;
  }
  return 'All four sites inside spec.';
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
    <div class="die-card__note ${status === 'fail' ? 'die-card__note--fail' : ''}">${cardNote(die)}</div>
  </button>`;
}

export function renderLot(app) {
  const k = lotKpis();
  setTabs('lot');
  setTitleFile(`${LOT.id} · lot board`);
  setTldr(COPY.lot(k));

  const fails = DIES.filter((d) => dieStatus(d) === 'fail');
  const watches = DIES.filter((d) => dieStatus(d) === 'warn');
  const yieldTone = k.openFails > 0 ? 'warn' : 'ok';

  app.innerHTML = `
  <div class="workspace">
    <aside class="rail">
      <h2 class="rail__title">Lot</h2>
      <div class="rail__block">
        ${kv('id', LOT.id)}
        ${kv('layers', LOT.layerPair)}
        ${kv('tool', LOT.tool)}
        ${kv('recipe', LOT.recipe)}
        ${kv('dies', String(DIES.length))}
        ${kv('spec', `${SPEC_NM.toFixed(1)} nm`)}
      </div>
      <h2 class="rail__title">Health dimensions</h2>
      <div class="rail__block prose">
        <p><strong>Lithography</strong> — did the exposure itself print correctly.</p>
        <p><strong>Overlay</strong> — did this layer land on the one below it.</p>
        <p><strong>Metrology</strong> — do we trust the measurement.</p>
        <p><strong>Process</strong> — are the correction knobs current.</p>
      </div>
    </aside>

    <section class="canvas">
      <div class="toolbar">
        <span class="tool tool--active">lot view</span>
        <span class="tool">${DIES.length} dies</span>
        <span class="tool ${k.openFails ? 'tool--alert' : ''}">${k.openFails} open fail${k.openFails === 1 ? '' : 's'}</span>
        <span class="toolbar__spacer">click any die to open the layout viewer</span>
      </div>

      <div class="kpis">
        <div class="kpi">
          <div class="kpi__label">Predicted yield</div>
          <div class="kpi__value kpi__value--${yieldTone}">${k.yield.toFixed(0)}%</div>
          <div class="kpi__sub">${DIES.length - k.openFails} of ${DIES.length} dies shippable</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Max residual</div>
          <div class="kpi__value kpi__value--${k.maxResidual > 8 ? 'fail' : k.maxResidual > SPEC_NM ? 'warn' : 'ok'}">${k.maxResidual.toFixed(1)}<span style="font-size:15px"> nm</span></div>
          <div class="kpi__sub">worst site anywhere in the lot · spec ${SPEC_NM.toFixed(1)} nm</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Open fails</div>
          <div class="kpi__value kpi__value--${k.openFails ? 'fail' : 'ok'}">${k.openFails}</div>
          <div class="kpi__sub">${k.fixedCount} fixed this session</div>
        </div>
      </div>

      <div class="dies">${DIES.map(dieCard).join('')}</div>
    </section>

    <aside class="rail rail--right">
      <h2 class="rail__title">Needs a decision</h2>
      <div class="rail__block stack">
        ${
          fails.length
            ? fails
                .map((d) => {
                  const w = worstSite(d);
                  return `<div class="banner banner--warn">
                    <strong>${d.id}</strong> — site ${w.id} ${w.r.toFixed(1)} nm out.
                    <br /><span class="muted">Open it and run the fix by hand.</span>
                  </div>`;
                })
                .join('')
            : `<div class="banner banner--ok">Nothing is failing. Every die in the lot is inside spec.</div>`
        }
        ${
          watches.length
            ? `<div class="banner banner--info">Watching ${watches.map((d) => d.id).join(', ')}. Drifting, not failing — leave the knobs alone for now.</div>`
            : ''
        }
      </div>

      <h2 class="rail__title">Why this matters</h2>
      <div class="rail__block prose">
        <p>Every red die here is a wafer that either gets re-worked or thrown away.</p>
        <p>Today an engineer opens each one, reads the marks, argues about the model, and turns a knob. That is the loop we are shortening.</p>
        <p class="section-note">v1 demo — simulated data, no live tool or model calls.</p>
      </div>
    </aside>
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
}
