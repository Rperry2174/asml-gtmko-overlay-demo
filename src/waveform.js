/**
 * Overlay mark scan waveforms.
 *
 * Each site is a 1-D X-scan of a box-in-box: outer grating stays put (gold)
 * and the inner grating (cyan) is shifted by the residual. When the mark is
 * on target the two traces sit on top of each other; when it is out they
 * peel apart. Same residual numbers as the plane — this is not a second
 * measurement, it is the same miss drawn as a scan.
 */

import { SITES, SPEC_NM, mag } from './data.js';

export const WF = {
  w: 160,
  h: 70,
  padL: 4,
  padR: 4,
  padT: 8,
  padB: 10,
  x0: -6,
  x1: 6,
  // 22 nm of overlay becomes ~1.6 scan units on a 12-unit axis — a clear
  // peel-apart without looking like a different signal.
  nmToScan: 0.072,
};

/** Signed scan shift from a residual, using |r| so the peel matches the number on the plane. */
export function scanShift({ dx, dy }) {
  const r = mag(dx, dy);
  const sign = Math.sign(dx) || Math.sign(dy) || 1;
  return sign * r * WF.nmToScan;
}

/** Scan-axis shift expressed in the waveform viewBox, for the inner-trace translate. */
export function shiftPx(residual) {
  const plotW = WF.w - WF.padL - WF.padR;
  return (scanShift(residual) / (WF.x1 - WF.x0)) * plotW;
}

/** Scan-axis shift as a % of the waveform viewBox — scale-independent. */
export function shiftPct(residual) {
  return (shiftPx(residual) / WF.w) * 100;
}

function gauss(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z);
}

/** Two-edge mark: peaks at ±pitch. Narrow enough that the doublet reads as a scan, not a blob. */
function markSignal(x, shift, pitch = 2.45) {
  return gauss(x, -pitch + shift, 0.32) + gauss(x, pitch + shift, 0.32);
}

export function scanSamples({ shift = 0, n = 96 } = {}) {
  const { x0, x1 } = WF;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = x0 + (x1 - x0) * t;
    pts.push({ x, y: markSignal(x, shift) });
  }
  return pts;
}

function toScreen(pts, yLift = 0) {
  const plotW = WF.w - WF.padL - WF.padR;
  const plotH = WF.h - WF.padT - WF.padB;
  const { x0, x1 } = WF;
  const yScale = 0.72;
  return pts.map((p) => {
    const sx = WF.padL + ((p.x - x0) / (x1 - x0)) * plotW;
    const sy = WF.padT + plotH - p.y * yScale * plotH - yLift;
    return `${sx.toFixed(2)},${sy.toFixed(2)}`;
  });
}

const SCAN = scanSamples({ shift: 0 });
const OUTER_POINTS = toScreen(SCAN, 0).join(' ');
const INNER_POINTS = toScreen(SCAN, 7).join(' ');

function siteCell(r, { selected, specNm }) {
  const bad = r.r > specNm;
  const isSel = selected === r.id;
  const tag = bad ? 'OFFSET' : 'MATCH';
  return `
    <div class="wf__site ${bad ? 'is-bad' : ''} ${isSel ? 'is-sel' : ''}" data-wf-site="${r.id}">
      <div class="wf__meta">
        <span class="wf__id">${r.id}</span>
        <span class="wf__r" data-wf-r="${r.id}">${r.r.toFixed(1)} nm</span>
        <span class="wf__tag wf__tag--${bad ? 'fail' : 'ok'}" data-wf-tag="${r.id}">${tag}</span>
      </div>
      <svg class="wf__svg" viewBox="0 0 ${WF.w} ${WF.h}" role="img"
           aria-label="site ${r.id} inner versus outer X-scan, ${tag.toLowerCase()}">
        <polyline class="wf-outer" points="${OUTER_POINTS}" />
        <g class="wf-inner-g" data-wf-inner="${r.id}" style="transform: translate(${shiftPct(r).toFixed(3)}%, 0)">
          <polyline class="wf-inner ${bad ? 'is-bad' : ''}" points="${INNER_POINTS}" />
        </g>
      </svg>
    </div>`;
}

/**
 * Four-site waveform strip that sits under a layout panel.
 *
 * @param {object} opts
 * @param {{id:string,dx:number,dy:number,r:number}[]} opts.residuals
 * @param {string|null} [opts.selected]
 * @param {number} [opts.specNm]
 */
export function waveformBar({ residuals, selected = null, specNm = SPEC_NM }) {
  const rs = SITES.map((s) => residuals.find((x) => x.id === s.id) ?? { id: s.id, dx: 0, dy: 0, r: 0 });
  return `
    <div class="wf">
      <div class="wf__head">
        <span class="wf__title">Waveform analysis</span>
        <span class="wf__sub">inner / outer X-scan</span>
        <span class="wf__keys">
          <span class="wf-key"><i class="wf-key__swatch wf-key__swatch--outer"></i>outer</span>
          <span class="wf-key"><i class="wf-key__swatch wf-key__swatch--inner"></i>inner</span>
        </span>
      </div>
      <div class="wf__sites">
        ${rs.map((r) => siteCell(r, { selected, specNm })).join('')}
      </div>
    </div>`;
}

/** Slide one site's inner trace to a new residual. Used by the factory run. */
export function setWaveformResidual(root, panelId, siteId, r, specNm = SPEC_NM) {
  const panel = root.querySelector(`[data-panel="${panelId}"]`);
  if (!panel) return;
  const magR = mag(r.dx, r.dy);
  const bad = magR > specNm;
  const cell = panel.querySelector(`[data-wf-site="${siteId}"]`);
  const inner = panel.querySelector(`[data-wf-inner="${siteId}"]`);
  const label = panel.querySelector(`[data-wf-r="${siteId}"]`);
  const tag = panel.querySelector(`[data-wf-tag="${siteId}"]`);
  const stroke = inner?.querySelector('.wf-inner');

  if (inner) inner.style.transform = `translate(${shiftPct(r).toFixed(3)}%, 0)`;
  if (cell) {
    cell.classList.toggle('is-bad', bad);
  }
  if (stroke) stroke.classList.toggle('is-bad', bad);
  if (label) label.textContent = `${magR.toFixed(1)} nm`;
  if (tag) {
    tag.textContent = bad ? 'OFFSET' : 'MATCH';
    tag.className = `wf__tag wf__tag--${bad ? 'fail' : 'ok'}`;
  }
}
