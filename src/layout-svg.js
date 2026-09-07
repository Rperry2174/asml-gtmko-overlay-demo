/**
 * The layout viewer: a pure-SVG coordinate plane in µm with the reticle
 * geometry and the four alignment marks drawn on top.
 *
 * Nothing here is a bitmap. Every panel on screen is generated from this file.
 */

import { SITES, mag, nm } from './data.js';

/* ------------------------------------------------------------- plane math */

const PLANE = 40; // µm across, both axes
const S = 9; // px per µm
const PAD = { l: 42, t: 18, r: 18, b: 40 };
export const VB_W = PAD.l + PLANE * S + PAD.r;
export const VB_H = PAD.t + PLANE * S + PAD.b;

const sx = (x) => PAD.l + x * S;
const sy = (y) => PAD.t + (PLANE - y) * S;

/**
 * Residuals are nanometres on a 40 µm plane — 22 nm is a thousandth of a
 * pixel. Offsets are drawn exaggerated so the audience can see the miss, and
 * the panel says so out loud.
 */
export const DISPLAY_GAIN = 100;
const off = (nmValue) => (nmValue * DISPLAY_GAIN) / 1000; // nm -> displayed µm

/* ------------------------------------------------------------- geometry
 * One reticle, printed on every die, so the shapes are shared and only the
 * per-die residuals differ. Coordinates in µm.
 */

const DIFF = [
  [5.5, 34.2, 13.5, 35.6],
  [5.5, 31.6, 13.5, 33.0],
  [21.0, 34.2, 26.0, 35.6],
  [21.0, 31.6, 26.0, 33.0],
  [4.8, 12.4, 11.2, 13.8],
  [4.8, 9.8, 11.2, 11.2],
];

const POLY = [
  [16.5, 31.2, 19.5, 35.8],
  [28.2, 17.6, 30.6, 20.4],
];

/** metal1: manhattan routing, drawn as stroked polylines. */
const METAL1 = [
  [
    [6.0, 21.8],
    [6.0, 27.8],
    [19.6, 27.8],
    [19.6, 22.4],
    [25.6, 22.4],
    [25.6, 19.4],
  ],
  [
    [5.4, 13.2],
    [5.4, 10.2],
    [10.4, 10.2],
  ],
];

/** metal2: vertical straps crossing metal1. */
const METAL2 = [
  [7.6, 21.4, 7.6, 27.2],
  [10.6, 21.4, 10.6, 27.2],
  [13.6, 21.4, 13.6, 27.2],
  [17.4, 20.8, 17.4, 26.4],
  [23.2, 19.8, 23.2, 25.6],
];

/** via array, bottom right. */
const VIAS = [];
for (const vx of [27.6, 30.6, 33.6]) {
  for (const vy of [6.6, 9.2, 11.8]) VIAS.push([vx, vy]);
}

const DIE_OUTLINE = [2.5, 3.0, 37.5, 37.0];

/* ----------------------------------------------------------------- render */

const rect = (x0, y0, x1, y1, cls) =>
  `<rect class="${cls}" x="${sx(x0)}" y="${sy(y1)}" width="${(x1 - x0) * S}" height="${(y1 - y0) * S}" />`;

const poly = (pts, cls) =>
  `<polyline class="${cls}" points="${pts.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')}" />`;

function axes() {
  const ticks = [0, 10, 20, 30, 40];
  let out = '';
  for (const t of ticks) {
    out += `<line class="lv-tick" x1="${sx(t)}" y1="${sy(0)}" x2="${sx(t)}" y2="${sy(0) + 5}" />`;
    out += `<text class="lv-axis-label" x="${sx(t)}" y="${sy(0) + 17}" text-anchor="middle">${t}</text>`;
    out += `<line class="lv-tick" x1="${sx(0) - 5}" y1="${sy(t)}" x2="${sx(0)}" y2="${sy(t)}" />`;
    out += `<text class="lv-axis-label" x="${sx(0) - 9}" y="${sy(t) + 3.5}" text-anchor="end">${t}</text>`;
  }
  out += `<line class="lv-axis" x1="${sx(0)}" y1="${sy(0)}" x2="${sx(PLANE)}" y2="${sy(0)}" />`;
  out += `<line class="lv-axis" x1="${sx(0)}" y1="${sy(0)}" x2="${sx(0)}" y2="${sy(PLANE)}" />`;
  out += `<text class="lv-axis-name" x="${sx(0) - 9}" y="${sy(PLANE) - 4}" text-anchor="end">y</text>`;
  out += `<text class="lv-axis-name" x="${sx(PLANE) + 6}" y="${sy(0) + 4}">x</text>`;
  out += `<text class="lv-axis-unit" x="${sx(PLANE)}" y="${sy(0) + 30}" text-anchor="end">µm</text>`;
  return out;
}

function grid() {
  let out = '';
  for (let g = 5; g < PLANE; g += 5) {
    out += `<line class="lv-grid" x1="${sx(g)}" y1="${sy(0)}" x2="${sx(g)}" y2="${sy(PLANE)}" />`;
    out += `<line class="lv-grid" x1="${sx(0)}" y1="${sy(g)}" x2="${sx(PLANE)}" y2="${sy(g)}" />`;
  }
  return out;
}

function reticle() {
  let out = `<rect class="lv-die-outline" x="${sx(DIE_OUTLINE[0])}" y="${sy(DIE_OUTLINE[3])}" width="${(DIE_OUTLINE[2] - DIE_OUTLINE[0]) * S}" height="${(DIE_OUTLINE[3] - DIE_OUTLINE[1]) * S}" />`;
  for (const r of DIFF) out += rect(r[0], r[1], r[2], r[3], 'lv-diff');
  for (const r of POLY) out += rect(r[0], r[1], r[2], r[3], 'lv-poly');
  for (const p of METAL1) out += poly(p, 'lv-metal1');
  for (const m of METAL2)
    out += `<line class="lv-metal2" x1="${sx(m[0])}" y1="${sy(m[1])}" x2="${sx(m[2])}" y2="${sy(m[3])}" />`;
  for (const [vx, vy] of VIAS) out += rect(vx - 0.85, vy - 0.85, vx + 0.85, vy + 0.85, 'lv-via');
  return out;
}

/* ------------------------------------------------------------------ marks */

/** Mark artwork, centred on (0,0) in µm and emitted in screen units. */
function markGlyph(kind) {
  const u = S; // 1 µm
  switch (kind) {
    case 'cross':
      return `<line class="lv-mark-stroke" x1="${-2.4 * u}" y1="0" x2="${2.4 * u}" y2="0" />
              <line class="lv-mark-stroke" x1="0" y1="${-2.4 * u}" x2="0" y2="${2.4 * u}" />`;
    case 'boxinbox':
      return `<rect class="lv-mark-box" x="${-1.9 * u}" y="${-1.9 * u}" width="${3.8 * u}" height="${3.8 * u}" />
              <rect class="lv-mark-box lv-mark-box--inner" x="${-0.95 * u}" y="${-0.95 * u}" width="${1.9 * u}" height="${1.9 * u}" />
              <line class="lv-mark-hair" x1="${-0.95 * u}" y1="0" x2="${0.95 * u}" y2="0" />
              <line class="lv-mark-hair" x1="0" y1="${-0.95 * u}" x2="0" y2="${0.95 * u}" />`;
    case 'lbar':
      return `<polyline class="lv-mark-stroke" points="${-1.9 * u},${-2.2 * u} ${-1.9 * u},${2.2 * u} ${2.2 * u},${2.2 * u}" />`;
    case 'greekcross':
      return `<path class="lv-mark-fill" d="M ${-0.5 * u} ${-2.3 * u} H ${0.5 * u} V ${-0.5 * u} H ${2.3 * u} V ${0.5 * u} H ${0.5 * u} V ${2.3 * u} H ${-0.5 * u} V ${0.5 * u} H ${-2.3 * u} V ${-0.5 * u} H ${-0.5 * u} Z" />`;
    default:
      return '';
  }
}

/**
 * @param {object} opts
 * @param {'golden'|'measured'} opts.mode
 * @param {{id:string,dx:number,dy:number,r:number}[]} opts.residuals
 * @param {string|null} opts.selected site id to highlight
 * @param {boolean} opts.showResiduals print `A · 0.4 nm` under each mark
 * @param {boolean} opts.showCallout print the Δx/Δy/θ block at the bad site
 * @param {number} opts.specNm
 */
function marks({ mode, residuals, selected, showResiduals, showCallout, specNm }) {
  let out = '';
  for (const site of SITES) {
    const r = residuals.find((x) => x.id === site.id) ?? { dx: 0, dy: 0, r: 0 };
    const bad = r.r > specNm;
    const isSel = selected === site.id;
    const cx = sx(site.x);
    const cy = sy(site.y);
    const tx = off(r.dx) * S;
    const ty = -off(r.dy) * S;

    // Golden footprint stays put; only the measured mark carries the offset.
    if (mode === 'measured') {
      out += `<g transform="translate(${cx} ${cy})">
                <rect class="lv-err-ghost" data-ghost="${site.id}" style="opacity:${bad ? 1 : 0}"
                      x="${-2.6 * S}" y="${-2.6 * S}" width="${5.2 * S}" height="${5.2 * S}" />
              </g>`;
    }
    if (isSel) {
      out += `<g transform="translate(${cx} ${cy})">
                <rect class="lv-sel" x="${-3.1 * S}" y="${-3.1 * S}" width="${6.2 * S}" height="${6.2 * S}" />
              </g>`;
    }

    out += `<g class="lv-mark ${bad ? 'is-bad' : ''} ${isSel ? 'is-sel' : ''}"
               data-mark="${site.id}"
               style="transform: translate(${cx + tx}px, ${cy + ty}px)">
              ${mode === 'measured' ? `<rect class="lv-err-box" style="opacity:${bad ? 1 : 0}" x="${-2.6 * S}" y="${-2.6 * S}" width="${5.2 * S}" height="${5.2 * S}" />` : ''}
              ${markGlyph(site.kind)}
            </g>`;

    const labelY = cy + 4.4 * S;
    const text = showResiduals ? `${site.id} · ${r.r.toFixed(1)} nm` : site.id;
    out += `<text class="lv-mark-label ${bad ? 'is-bad' : ''}" data-mark-label="${site.id}"
              x="${cx}" y="${labelY}" text-anchor="middle">${text}</text>`;

    // Only the site under discussion gets a callout. Printing one per bad
    // site turns the crude-fit preview into overlapping text.
    if (showCallout && bad && (!selected || isSel)) {
      const ox = cx + 3.4 * S;
      const oy = cy - 1.6 * S;
      // θ comes from the local fit and only exists where one was made — the
      // crude translation-only model has no rotation term to show.
      const theta = r.theta === undefined ? '' : `<text x="${ox}" y="${oy + 24}">θ  ${nm(r.theta, 2)}°</text>`;
      out += `<g class="lv-callout" data-callout="${site.id}">
                <text x="${ox}" y="${oy}">Δx ${nm(r.dx)} nm</text>
                <text x="${ox}" y="${oy + 12}">Δy ${nm(r.dy)} nm</text>
                ${theta}
              </g>`;
    }
  }
  return out;
}

/* ------------------------------------------------------------ full panel */

/**
 * One layout panel: header pill, coordinate plane, geometry, marks.
 *
 * @param {object} opts
 * @param {'golden'|'measured'} opts.mode
 * @param {{id:string,dx:number,dy:number,r:number}[]} opts.residuals
 * @param {string} opts.badge text of the pill in the panel corner
 * @param {'ok'|'warn'|'fail'} opts.tone pill colour
 * @param {string|null} [opts.selected]
 * @param {number} [opts.specNm]
 * @param {string} [opts.panelId]
 */
export function layoutPanel(opts) {
  const {
    mode,
    residuals: rs,
    badge,
    tone,
    selected = null,
    specNm = 3.0,
    panelId = mode,
    footnote = '',
  } = opts;

  return `
  <figure class="panel" data-panel="${panelId}">
    <figcaption class="panel__head">
      <span class="pill pill--${tone}">${badge}</span>
      ${footnote ? `<span class="panel__note">${footnote}</span>` : ''}
    </figcaption>
    <svg class="lv" viewBox="0 0 ${VB_W} ${VB_H}" role="img"
         aria-label="${mode} layout, ${PLANE} by ${PLANE} micrometre plane">
      <g class="lv-plane">
        ${grid()}
        ${reticle()}
        ${axes()}
        ${marks({ mode, residuals: rs, selected, showResiduals: mode === 'measured', showCallout: mode === 'measured', specNm })}
      </g>
    </svg>
  </figure>`;
}

/**
 * Move an already-rendered mark to a new residual and update its label.
 * Used by the factory run so site B can be seen sliding home.
 */
export function setMarkResidual(root, panelId, siteId, r, specNm = 3.0) {
  const panel = root.querySelector(`[data-panel="${panelId}"]`);
  if (!panel) return;
  const site = SITES.find((s) => s.id === siteId);
  const g = panel.querySelector(`[data-mark="${siteId}"]`);
  const label = panel.querySelector(`[data-mark-label="${siteId}"]`);
  const callout = panel.querySelector(`[data-callout="${siteId}"]`);
  const bad = mag(r.dx, r.dy) > specNm;

  if (g) {
    g.style.transform = `translate(${sx(site.x) + off(r.dx) * S}px, ${sy(site.y) - off(r.dy) * S}px)`;
    g.classList.toggle('is-bad', bad);
    const errBox = g.querySelector('.lv-err-box');
    if (errBox) errBox.style.opacity = bad ? '1' : '0';
  }
  if (label) {
    label.textContent = `${siteId} · ${mag(r.dx, r.dy).toFixed(1)} nm`;
    label.classList.toggle('is-bad', bad);
  }
  if (callout) callout.style.opacity = bad ? '1' : '0';
  const ghost = panel.querySelector(`[data-ghost="${siteId}"]`);
  if (ghost) ghost.style.opacity = bad ? '1' : '0';
}

/** Screen point -> plane coordinates in µm, for the cursor readout. */
export function planeCoords(svg, evt) {
  const box = svg.getBoundingClientRect();
  const px = ((evt.clientX - box.left) / box.width) * VB_W;
  const py = ((evt.clientY - box.top) / box.height) * VB_H;
  return { x: (px - PAD.l) / S, y: PLANE - (py - PAD.t) / S };
}

/* ------------------------------------------------------------ wafer glyph */

/** Tiny SVG die thumbnail for the lot board cards. */
export function dieThumb(status) {
  return `<svg class="thumb" viewBox="0 0 60 60" aria-hidden="true">
    <rect class="thumb__frame thumb__frame--${status}" x="3" y="3" width="54" height="54" rx="2" />
    <rect class="thumb__diff" x="9" y="10" width="18" height="4" />
    <rect class="thumb__diff" x="9" y="17" width="18" height="4" />
    <rect class="thumb__poly" x="33" y="9" width="7" height="13" />
    <polyline class="thumb__m1" points="10,32 24,32 24,42 40,42" />
    <line class="thumb__m2" x1="14" y1="28" x2="14" y2="37" />
    <line class="thumb__m2" x1="19" y1="28" x2="19" y2="37" />
    <rect class="thumb__via" x="43" y="30" width="4" height="4" />
    <rect class="thumb__via" x="49" y="30" width="4" height="4" />
    <rect class="thumb__via" x="43" y="36" width="4" height="4" />
    <rect class="thumb__via" x="49" y="36" width="4" height="4" />
    <line class="thumb__mark" x1="44" y1="14" x2="52" y2="14" />
    <line class="thumb__mark" x1="48" y1="10" x2="48" y2="18" />
    <line class="thumb__mark" x1="10" y1="48" x2="18" y2="48" />
    <line class="thumb__mark" x1="14" y1="44" x2="14" y2="52" />
  </svg>`;
}
