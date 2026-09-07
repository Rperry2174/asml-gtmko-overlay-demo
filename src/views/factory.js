/**
 * View 3 — the manual factory run.
 *
 * One die, one pass through the loop, by hand: read metrology, fit the model,
 * propose knobs, re-simulate, pass or fail. The pipeline is simulated — no
 * tool and no model is called — but the state it writes is the same state the
 * lot board reads.
 */

import {
  LOT,
  SPEC_NM,
  applyFix,
  crudeFromResiduals,
  getDie,
  localFit,
  mag,
  maxResidual,
  nm,
  residuals,
} from '../data.js';
import { layoutPanel, setMarkResidual } from '../layout-svg.js';
import { COPY, setTldr } from '../tldr.js';
import { kv, setStatus, setTabs, setTitleFile } from '../ui.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const resTone = (r) => (r > 8 ? 'fail' : r > SPEC_NM ? 'warn' : 'ok');

/**
 * Leaving the view mid-run abandons the pipeline rather than letting it write
 * into a detached DOM — and leaves the die unfixed, which is the honest
 * outcome of walking away before the run finished.
 */
let runToken = 0;

/** Rebuild the fit of an already-corrected die from the knob we recorded. */
function fitFromKnob(die) {
  const siteId = Object.keys(die.knobs.local)[0];
  const knob = die.knobs.local[siteId];
  return {
    siteId,
    knob,
    error: { dx: -knob.dx, dy: -knob.dy, theta: -knob.theta },
  };
}

export function renderFactory(app, dieId) {
  const die = getDie(dieId);
  if (!die) {
    location.hash = '#/lot';
    return;
  }

  if (!die.fixed && maxResidual(die) <= SPEC_NM) {
    location.hash = `#/die/${die.id}`;
    return;
  }

  // Replaying a die that was already fixed reads its pre-fix snapshot, so the
  // run tells the same story the second time it is shown.
  const before = die.fixed ? die.preFix : residuals(die);
  const fit = die.fixed ? fitFromKnob(die) : localFit(die);
  const crude = crudeFromResiduals(before);
  const worst = before.reduce((w, s) => (s.r > w.r ? s : w));
  const siteId = fit.siteId;
  const token = ++runToken;

  setTabs('factory');
  setTitleFile(`${LOT.file} · ${die.id} · factory run`);
  setTldr(COPY.factory(siteId));
  setStatus(`factory run · ${die.id}`, 'pipeline idle', `${LOT.file} · simulated`);

  app.innerHTML = `
  <div class="workspace workspace--factory">
    <aside class="rail">
      <h2 class="rail__title">Pipeline</h2>
      <ol class="steps" id="steps">${STEPS.map(stepRow).join('')}</ol>
      <div class="banner banner--info" style="margin-top:14px">
        Simulated run. No tool and no model is called in v1 — the state changes are real and the lot board picks them up.
      </div>
    </aside>

    <section class="canvas">
      <div class="crumb">
        <a href="#/lot">← lot board</a><span>/</span>
        <a href="#/die/${die.id}">${die.id}</a><span>/</span><span>factory run</span>
      </div>
      <div class="toolbar">
        <span class="tool tool--active">live re-sim</span>
        <span class="tool">site ${siteId} under correction</span>
        <span class="toolbar__spacer">watch ${siteId} come home</span>
      </div>
      <div class="panels panels--single" id="panels"></div>
      <div class="kpis" style="margin-top:12px; grid-template-columns: repeat(3, 1fr)">
        <div class="kpi">
          <div class="kpi__label">Before</div>
          <div class="kpi__value kpi__value--${resTone(worst.r)}">${worst.r.toFixed(1)}<span style="font-size:15px"> nm</span></div>
          <div class="kpi__sub">max |r| @ site ${siteId}</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Now</div>
          <div class="kpi__value" id="live-res">—</div>
          <div class="kpi__sub" id="live-sub">waiting for the run</div>
        </div>
        <div class="kpi">
          <div class="kpi__label">Good sites moved</div>
          <div class="kpi__value" id="untouched">—</div>
          <div class="kpi__sub">${before
            .filter((s) => s.id !== siteId)
            .map((s) => s.id)
            .join(', ')} must not move</div>
        </div>
      </div>
      <div class="stack" style="margin-top:12px">
        <div id="verdict"></div>
      </div>
    </section>

    <aside class="rail rail--right">
      <h2 class="rail__title">Process knobs</h2>
      <table class="knobs" id="knobs"></table>
      <p class="section-note">Global knobs stay where they are. That is the whole point — the correction is surgical, not a slide of the entire field.</p>

      <h2 class="rail__title">Run log</h2>
      <div class="log" id="log"></div>

      <div class="rail__block stack" style="margin-top:14px">
        <button class="btn btn--ghost" id="back-die">← back to ${die.id}</button>
        <button class="btn btn--ghost" id="back-lot">← back to lot board</button>
      </div>

      <h2 class="rail__title">Die</h2>
      <div class="rail__block">
        ${kv('id', die.id)}
        ${kv('site', siteId)}
        ${kv('spec', `${SPEC_NM.toFixed(1)} nm`)}
      </div>
    </aside>
  </div>`;

  const shown = before.map((s) => (s.id === siteId ? { ...s, theta: fit.error.theta } : s));
  document.getElementById('panels').innerHTML = layoutPanel({
    mode: 'measured',
    residuals: shown,
    badge: `MEASURED · max |r| = ${worst.r.toFixed(1)} nm @ ${siteId}`,
    tone: resTone(worst.r),
    selected: siteId,
    specNm: SPEC_NM,
    panelId: 'measured',
    footnote: 'offsets drawn ×100',
  });

  renderKnobs(die, fit, false);
  document.getElementById('back-die').onclick = () => (location.hash = `#/die/${die.id}`);
  document.getElementById('back-lot').onclick = () => (location.hash = '#/lot');

  runPipeline({ app, die, fit, crude, before, worst, siteId, token });
}

/* ------------------------------------------------------------- pipeline */

const STEPS = [
  { id: 'read', name: 'Read metrology', detail: 'Pull the four mark measurements off the tool.' },
  { id: 'fit', name: 'Fit model', detail: 'Decide which terms to fit — and which to leave alone.' },
  { id: 'knobs', name: 'Propose process knobs', detail: 'Turn the miss into a correction.' },
  { id: 're-sim', name: 'Re-sim overlay', detail: 'Re-run the exposure with the new knob.' },
  { id: 'verdict', name: 'Pass / fail', detail: 'Check the result against spec.' },
];

const stepRow = (s) => `
  <li class="step" data-step="${s.id}">
    <span class="step__marker">•</span>
    <div>
      <div class="step__name">${s.name}</div>
      <div class="step__detail" data-step-detail="${s.id}">${s.detail}</div>
    </div>
  </li>`;

async function runPipeline({ app, die, fit, crude, before, worst, siteId, token }) {
  const t0 = performance.now();
  const logEl = document.getElementById('log');
  const stepEl = (id) => app.querySelector(`[data-step="${id}"]`);
  const detailEl = (id) => app.querySelector(`[data-step-detail="${id}"]`);

  /** Resolves false once the presenter has navigated somewhere else. */
  const wait = async (ms) => {
    await sleep(ms);
    return token === runToken;
  };

  const log = (text, kind = '') => {
    const t = ((performance.now() - t0) / 1000).toFixed(1);
    const line = document.createElement('div');
    line.className = `log__line ${kind ? `log__line--${kind}` : ''}`;
    line.innerHTML = `<span class="log__t">t+${t}s</span><span>${text}</span>`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  };

  const enter = (id) => {
    stepEl(id)?.classList.add('is-active');
    setStatus(`factory run · ${die.id}`, `step: ${id}`, `${LOT.file} · simulated`);
  };
  const done = (id, detail) => {
    const el = stepEl(id);
    el?.classList.remove('is-active');
    el?.classList.add('is-done');
    el?.querySelector('.step__marker')?.replaceChildren(document.createTextNode('✓'));
    if (detail) detailEl(id).textContent = detail;
  };

  if (!(await wait(500))) return;

  // 1 — read metrology
  enter('read');
  log(`Reading metrology for ${die.id}, 4 sites, 8 grabs each.`);
  if (!(await wait(1000))) return;
  const clean = before.filter((s) => s.r <= SPEC_NM).map((s) => s.id);
  log(`${siteId} is ${worst.r.toFixed(1)} nm out. ${clean.join(', ')} are all under ${SPEC_NM.toFixed(1)} nm.`, 'bad');
  done('read', `${siteId} ${worst.r.toFixed(1)} nm · ${clean.join(', ')} under spec.`);

  // 2 — fit model
  enter('fit');
  log('Fitting r(x,y) = T + R·[x y]ᵀ.');
  if (!(await wait(1100))) return;
  log(
    `Global-T fit rejected: it would push ${crude.broken.join(', ')} out of spec to chase ${siteId}.`,
    'bad',
  );
  log(`Fitting T + R locally at ${siteId} instead.`, 'good');
  done('fit', `Local T + R at ${siteId}. Global term left alone.`);

  // 3 — propose knobs
  enter('knobs');
  if (!(await wait(900))) return;
  log(
    `Knob ${siteId}: Δx ${nm(fit.knob.dx)} nm, Δy ${nm(fit.knob.dy)} nm, θ ${nm(fit.knob.theta, 2)}°.`,
  );
  log('Global knobs untouched — dx 0.0, dy 0.0, θ 0.000, mag 0.0.', 'good');
  renderKnobs(die, fit, true);
  done('knobs', `Δx ${nm(fit.knob.dx)} · Δy ${nm(fit.knob.dy)} nm · θ ${nm(fit.knob.theta, 2)}°`);

  // 4 — re-sim, and the moment the mark comes home
  enter('re-sim');
  log('Re-simulating overlay with the corrected knob.');
  if (!(await wait(500))) return;

  const result = die.fixed
    ? { before: worst.r, after: maxResidual(die) }
    : (() => {
        const r = applyFix(die);
        return { before: r.before, after: r.after };
      })();

  const site = die.sites.find((s) => s.id === siteId);
  setMarkResidual(app, 'measured', siteId, { dx: site.dx, dy: site.dy }, SPEC_NM);
  countTo('live-res', result.before, result.after, 900, (v) => `${v.toFixed(1)} nm`);
  document.getElementById('live-sub').textContent = `max |r| @ site ${siteId}`;
  if (!(await wait(1000))) return;
  document.getElementById('live-res').classList.add('kpi__value--ok');

  const moved = die.sites.filter(
    (s) => s.id !== siteId && Math.abs(mag(s.dx, s.dy) - (before.find((b) => b.id === s.id)?.r ?? 0)) > 0.05,
  ).length;
  const untouchedEl = document.getElementById('untouched');
  untouchedEl.textContent = String(moved);
  untouchedEl.classList.add(moved === 0 ? 'kpi__value--ok' : 'kpi__value--warn');
  log(`Site ${siteId}: ${result.before.toFixed(1)} nm → ${result.after.toFixed(1)} nm.`, 'good');
  log(`${moved} good site(s) moved.`, 'good');
  done('re-sim', `${siteId} ${result.before.toFixed(1)} → ${result.after.toFixed(1)} nm.`);

  // 5 — verdict
  enter('verdict');
  if (!(await wait(700))) return;
  const pass = maxResidual(die) <= SPEC_NM;
  log(
    pass
      ? `PASS — max |r| ${maxResidual(die).toFixed(1)} nm, inside the ${SPEC_NM.toFixed(1)} nm spec.`
      : `FAIL — still ${maxResidual(die).toFixed(1)} nm.`,
    pass ? 'good' : 'bad',
  );
  done('verdict', pass ? 'Pass. Die is green.' : 'Still out of spec.');

  const badge = app.querySelector('[data-panel="measured"] .pill');
  if (badge) {
    badge.className = `pill pill--${pass ? 'ok' : 'fail'}`;
    badge.textContent = `RE-SIM · max |r| = ${maxResidual(die).toFixed(1)} nm`;
  }

  document.getElementById('verdict').innerHTML = pass
    ? `<div class="banner banner--ok">
        <strong>Pass.</strong> ${die.id} is green. Site ${siteId} came back inside spec and A, C, D never moved.
        The lot board has already picked this up — go back and look.
      </div>`
    : `<div class="banner banner--warn"><strong>Still out.</strong> ${die.id} needs another pass.</div>`;

  setTldr(COPY.factoryDone(siteId, result.before, result.after));
  setStatus(`factory run · ${die.id}`, pass ? 'complete · pass' : 'complete · fail', `${LOT.file} · simulated`);
}

/* --------------------------------------------------------------- widgets */

function renderKnobs(die, fit, applied) {
  const g = die.knobs.global;
  const local = applied ? fit.knob : { dx: 0, dy: 0, theta: 0 };
  const rows = [
    ['global Δx', g.dx.toFixed(1), g.dx.toFixed(1), 'nm', false],
    ['global Δy', g.dy.toFixed(1), g.dy.toFixed(1), 'nm', false],
    ['global θ', g.theta.toFixed(3), g.theta.toFixed(3), '°', false],
    ['global mag', g.mag.toFixed(1), g.mag.toFixed(1), 'ppm', false],
    [`${fit.siteId} Δx`, '0.0', nm(local.dx), 'nm', applied],
    [`${fit.siteId} Δy`, '0.0', nm(local.dy), 'nm', applied],
    [`${fit.siteId} θ`, '0.000', nm(local.theta, 3), '°', applied],
  ];
  document.getElementById('knobs').innerHTML = `
    <thead><tr><th>knob</th><th>before</th><th>after</th><th>unit</th></tr></thead>
    <tbody>
      ${rows
        .map(
          ([name, b, a, unit, changed]) =>
            `<tr class="${changed ? 'is-changed' : 'is-untouched'}"><td>${name}</td><td>${b}</td><td>${a}</td><td>${unit}</td></tr>`,
        )
        .join('')}
    </tbody>`;
}

/** Count a KPI from one value to another so the drop is felt, not just read. */
function countTo(id, from, to, ms, fmt) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = performance.now();
  const tick = (now) => {
    const p = Math.min(1, (now - start) / ms);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
