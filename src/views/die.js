/**
 * View 2 — die detail. Golden versus measured, side by side, with the
 * inspector that argues for the local fit over the global one.
 */

import {
  LOT,
  SPEC_NM,
  crudeGlobalFit,
  dieStatus,
  getDie,
  health,
  localFit,
  maxResidual,
  nm,
  residualsFor,
  worstSite,
} from '../data.js';
import { layoutPanel, planeCoords } from '../layout-svg.js';
import { COPY, setTldr } from '../tldr.js';
import { healthChips, kv, layerRail, setStatus, setTabs, setTitleFile } from '../ui.js';

const resTone = (r) => (r > 8 ? 'fail' : r > SPEC_NM ? 'warn' : 'ok');

export function renderDie(app, dieId) {
  const die = getDie(dieId);
  if (!die) {
    location.hash = '#/lot';
    return;
  }

  const state = { preview: false };
  const status = dieStatus(die);
  const worst = worstSite(die);

  setTabs('die');
  setTitleFile(`${LOT.file} · ${die.id}`);
  tellStory(die);

  app.innerHTML = `
  <div class="workspace">
    <aside class="rail">
      ${layerRail()}
      <h2 class="rail__title">Die</h2>
      <div class="rail__block">
        ${kv('id', die.id)}
        ${kv('position', `r${die.row} c${die.col}`)}
        ${kv('layers', LOT.layerPair)}
        ${kv('sites', '4')}
      </div>
      <h2 class="rail__title">Health</h2>
      <div class="rail__block">${healthChips(health(die))}</div>
    </aside>

    <section class="canvas">
      <div class="crumb"><a href="#/lot">← lot board</a><span>/</span><span>${die.id}</span></div>
      <div class="toolbar">
        <span class="tool">xy µm</span>
        <span class="tool">zoom 1:1</span>
        <span class="tool tool--active">fit residual</span>
        <span class="tool ${status === 'ok' ? '' : 'tool--alert'}">${
          status === 'ok' ? 'all sites in spec' : `site ${worst.id} outlier`
        }</span>
        <span class="toolbar__spacer">compare: golden vs measured</span>
      </div>
      <div class="panels" id="panels"></div>
      <p class="section-note" id="gain-note"></p>
    </section>

    <aside class="rail rail--right" id="inspector"></aside>
  </div>`;

  paint();

  function paint() {
    const rs = residualsFor(die, state.preview ? 'crude' : 'measured');
    const crude = crudeGlobalFit(die);
    const maxNow = state.preview ? crude.maxAfter : maxResidual(die);
    if (!state.preview) withTheta(die, rs);

    document.getElementById('panels').innerHTML =
      layoutPanel({
        mode: 'golden',
        residuals: residualsFor(die, 'golden'),
        badge: 'GOLDEN · residual < 1 nm',
        tone: 'ok',
        specNm: SPEC_NM,
        panelId: 'golden',
        footnote: 'design intent',
      }) +
      layoutPanel({
        mode: 'measured',
        residuals: rs,
        badge: state.preview
          ? `CRUDE T-ONLY FIT · max |r| = ${maxNow.toFixed(1)} nm`
          : `MEASURED · max |r| = ${maxNow.toFixed(1)} nm @ ${worst.id}`,
        tone: resTone(maxNow),
        selected: die.outlier ?? worst.id,
        specNm: SPEC_NM,
        panelId: 'measured',
        footnote: state.preview ? 'what a weak model does' : 'after exposure',
      });

    document.getElementById('gain-note').textContent =
      `Mark offsets are drawn ×100 so a nanometre-scale miss is visible on a 40 µm plane. Residual numbers are real.`;

    document.getElementById('inspector').innerHTML = inspector(die, state, crude);
    wire();
  }

  function wire() {
    const runBtn = document.getElementById('run-fix');
    if (runBtn) {
      runBtn.addEventListener('click', () => {
        location.hash = `#/die/${die.id}/run`;
      });
    }
    const previewBtn = document.getElementById('toggle-crude');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        state.preview = !state.preview;
        paint();
      });
    }
    app.querySelectorAll('svg.lv').forEach((svg) => {
      svg.addEventListener('mousemove', (e) => {
        const p = planeCoords(svg, e);
        setStatus(
          `cursor ${p.x.toFixed(1)}, ${p.y.toFixed(1)} µm`,
          `cell ${LOT.cell}    selected MARK_${die.outlier ?? worst.id}`,
          `${LOT.file} · read-only`,
        );
      });
    });
    setStatus(
      `die ${die.id}`,
      `cell ${LOT.cell}    selected MARK_${die.outlier ?? worst.id}`,
      `${LOT.file} · read-only`,
    );
  }
}

function tellStory(die) {
  const status = dieStatus(die);
  const worst = worstSite(die);
  if (status === 'fail') setTldr(COPY.dieFail(die, worst.id, worst.r));
  else if (status === 'warn') setTldr(COPY.dieWatch(die, worst.id, worst.r));
  else setTldr(COPY.dieOk(die));
}

/* ---------------------------------------------------------------- panels */

function inspector(die, state, crude) {
  const fit = localFit(die);
  const rs = residualsFor(die, state.preview ? 'crude' : 'measured');
  const maxNow = state.preview ? crude.maxAfter : maxResidual(die);
  const worst = rs.reduce((w, s) => (s.r > w.r ? s : w));
  const canFix = maxResidual(die) > SPEC_NM;

  return `
    <h2 class="rail__title">Overlay fit</h2>
    <div class="insp__big insp__big--${resTone(maxNow)}">${maxNow.toFixed(1)} nm</div>
    <div class="insp__caption">
      ${
        state.preview
          ? `after a global-T fit — ${crude.broken.length} good site${crude.broken.length === 1 ? '' : 's'} pushed out of spec`
          : maxNow > SPEC_NM
            ? `max residual @ site ${worst.id}`
            : 'every site inside spec'
      }
    </div>

    <h2 class="rail__title">Per-site residuals</h2>
    <div class="rail__block">
      ${rs
        .map(
          (s) => `<div class="res-row">
            <span class="res-row__id">${s.id} ${siteLabel(die, s.id)}</span>
            <span class="res-row__v res-row__v--${resTone(s.r)}">${s.r.toFixed(1)} nm</span>
          </div>`,
        )
        .join('')}
    </div>

    <h2 class="rail__title">Model picked</h2>
    <div class="model"><span class="m-eq">r(x,y) = T + R·[x y]ᵀ</span>

<span class="m-bad">// crude: T only → breaks ${crude.broken.join(', ') || 'the good sites'}</span>
<span class="m-good">// better: T + local R @ ${fit.siteId}</span>

θ_${fit.siteId}  = ${nm(fit.error.theta, 2)}°
Δx_${fit.siteId} = ${nm(fit.error.dx)} nm
Δy_${fit.siteId} = ${nm(fit.error.dy)} nm</div>

    <div class="rail__block prose" style="margin-top:10px">
      <p>The math lives on the plane. The question is not <em>how far do we slide the stamp</em> — it is <em>which terms do we fit at all</em>.</p>
      <p>Fit one global translation and you drag the three good marks off target to chase the bad one. Fit locally and only the site that moved moves.</p>
    </div>

    <div class="rail__block stack" style="margin-top:14px">
      ${
        canFix
          ? `<button class="btn" id="run-fix">Run fix on this die →</button>`
          : `<div class="banner banner--ok">${
              die.fixed
                ? 'Fixed. Site ' +
                  Object.keys(die.knobs.local)[0] +
                  ' is back inside spec and the good sites never moved.'
                : 'Nothing to correct on this die.'
            }</div>`
      }
      <button class="btn btn--ghost" id="toggle-crude">
        ${state.preview ? 'Back to measured' : 'Preview the crude fit (T only)'}
      </button>
    </div>

    ${
      state.preview
        ? `<div class="banner banner--warn" style="margin-top:10px">
            One global shift of ${nm(crude.T.dx)}, ${nm(crude.T.dy)} nm.
            Site ${die.outlier ?? worst.id} barely improves and ${crude.broken.join(', ')} go out of spec.
            This is the correction we are arguing against.
          </div>`
        : ''
    }`;
}

function siteLabel(die, id) {
  const s = die.sites.find((x) => x.id === id);
  return s ? s.label : '';
}

/** Hang the fitted rotation off the outlier so the panel can call it out. */
function withTheta(die, rs) {
  const fit = localFit(die);
  const target = rs.find((s) => s.id === fit.siteId);
  if (target) target.theta = fit.error.theta;
}
