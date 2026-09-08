/**
 * Fake-but-honest demo data for the ASML GTMKO stage demo.
 *
 * Everything is in-memory and mutable: the manual factory run writes back into
 * this state, so the lot board reflects the fix when you navigate back.
 *
 * Units: residuals and knob translations in nanometres, mark positions in
 * micrometres, rotation in degrees, magnification in ppm.
 */

/** Max residual (nm) a site may show and still count as on-spec. */
export const SPEC_NM = 3.0;
/** Above this a site is a hard fail rather than a watch item. */
export const WARN_NM = 8.0;

export const LOT = {
  id: 'LOT-2291-A',
  layerPair: 'metal2 → metal1',
  tool: 'NXE:3800E',
  recipe: 'OVL_M2M1_4SITE_v7',
  cell: 'TOP',
  file: 'die_overlay_demo.gds',
};

/**
 * Alignment marks. Same reticle for every die on the wafer, so the geometry is
 * shared and only the per-die residuals differ.
 */
export const SITES = [
  { id: 'A', kind: 'cross', label: 'cross', x: 8.0, y: 33.0 },
  { id: 'B', kind: 'boxinbox', label: 'box-in-box', x: 31.0, y: 33.0 },
  { id: 'C', kind: 'lbar', label: 'L-bar', x: 7.5, y: 11.5 },
  { id: 'D', kind: 'greekcross', label: 'greek-cross', x: 19.0, y: 10.5 },
];

const ZERO_KNOBS = () => ({ dx: 0.0, dy: 0.0, theta: 0.0, mag: 0.0 });

/**
 * The authored opening state of one die, kept apart from the live object so
 * the demo can be put back to it between runs on stage.
 *
 * @param {string} id
 * @param {[number, number]} pos wafer-map row/col
 * @param {Record<string, [number, number]>} residuals per-site [dx, dy] in nm
 * @param {object} extra
 */
function die(id, pos, residuals, extra = {}) {
  return { id, pos, residuals, extra };
}

/** The live, mutable die the views read and the fix writes into. */
function buildDie({ id, pos, residuals, extra }) {
  return {
    id,
    row: pos[0],
    col: pos[1],
    sites: SITES.map((s) => ({
      ...s,
      dx: residuals[s.id][0],
      dy: residuals[s.id][1],
    })),
    outlier: extra.outlier ?? null,
    litho: extra.litho ?? 'ok',
    metrology: extra.metrology ?? 'ok',
    process: extra.process ?? 'ok',
    notes: extra.notes ?? {},
    knobs: { global: ZERO_KNOBS(), local: {} },
    fixed: false,
    log: [],
  };
}

/** Small, non-random residuals so the demo reads the same every time. */
const DIE_SPECS = [
  die('D01', [1, 2], { A: [0.3, 0.4], B: [-0.2, 0.5], C: [0.4, -0.2], D: [0.2, 0.3] }),
  die('D02', [1, 3], { A: [0.5, -0.3], B: [0.6, 0.4], C: [-0.4, 0.3], D: [0.3, 0.5] }),
  die('D03', [1, 4], { A: [0.6, 0.4], B: [0.7, -0.5], C: [2.4, -2.4], D: [0.5, 0.4] }, {
    outlier: 'C',
    metrology: 'warn',
    notes: {
      metrology: 'Mark contrast low at C — 2 of 8 grabs rejected.',
      overlay: 'C drifting toward spec limit. Watch, do not touch yet.',
    },
  }),
  die('D04', [2, 1], { A: [0.2, 0.4], B: [0.3, -0.3], C: [0.4, 0.2], D: [-0.3, 0.3] }),
  die('D05', [2, 2], { A: [0.6, 0.5], B: [0.4, 0.6], C: [0.5, -0.4], D: [8.9, -7.1] }, {
    outlier: 'D',
    notes: { overlay: 'D greek-cross 11.4 nm out. Same signature as D07, smaller.' },
  }),
  die('D06', [2, 3], { A: [0.7, 0.5], B: [-0.5, 0.6], C: [0.6, 0.4], D: [0.5, -0.5] }),
  // Hero die: the one on the slide. Site B is the outlier, everything else prints fine.
  die('D07', [2, 4], { A: [0.3, 0.26], B: [17.2, -13.7], C: [-0.5, 0.49], D: [0.35, -0.36] }, {
    outlier: 'B',
    process: 'warn',
    notes: {
      overlay: 'Box-in-box at B is 22 nm out. A, C, D are all inside 1 nm.',
      process: 'Knobs last touched 11 days ago. Nothing has compensated the B drift.',
      litho: 'Focus and dose nominal across the field.',
      metrology: 'All 4 sites measured clean, 8/8 grabs.',
    },
  }),
  die('D08', [3, 1], { A: [0.4, 0.5], B: [0.5, 0.4], C: [-0.4, 0.5], D: [0.6, 0.3] }),
  die('D09', [3, 2], { A: [1.9, 1.6], B: [0.6, 0.5], C: [0.5, -0.6], D: [0.7, 0.4] }, {
    outlier: 'A',
    process: 'warn',
    notes: { process: 'Knob set is 14 days stale for this field.' },
  }),
  die('D10', [3, 3], { A: [0.4, -0.4], B: [0.3, 0.5], C: [0.5, 0.3], D: [-0.4, 0.4] }),
  die('D11', [3, 4], { A: [7.1, -5.4], B: [0.6, 0.4], C: [0.5, 0.6], D: [0.4, -0.5] }, {
    outlier: 'A',
    litho: 'warn',
    notes: {
      litho: 'Dose drift on the left half of the field.',
      overlay: 'Cross at A 8.9 nm out.',
    },
  }),
  die('D12', [4, 2], { A: [0.5, 0.6], B: [0.4, -0.5], C: [0.6, 0.4], D: [0.5, 0.4] }),
];

export const DIES = DIE_SPECS.map(buildDie);

/**
 * Put the lot back to the state the walkthrough opens on: 75% predicted yield,
 * 22.0 nm at D07, three open fails, no knobs turned.
 *
 * Each die is restored in place rather than replaced, so a view or an in-flight
 * factory run holding a reference sees the reset lot instead of a detached copy
 * of the old one.
 */
export function resetLot() {
  DIE_SPECS.forEach((spec, i) => {
    const live = DIES[i];
    for (const key of Object.keys(live)) delete live[key];
    Object.assign(live, buildDie(spec));
  });
}

/* ---------------------------------------------------------------- helpers */

export const mag = (dx, dy) => Math.hypot(dx, dy);

export const nm = (v, digits = 1) => `${v >= 0 ? '' : '−'}${Math.abs(v).toFixed(digits)}`;

/** @returns {{dx:number, dy:number, r:number, id:string}[]} */
export function residuals(die) {
  return die.sites.map((s) => ({ id: s.id, dx: s.dx, dy: s.dy, r: mag(s.dx, s.dy) }));
}

export function maxResidual(die) {
  return residuals(die).reduce((m, s) => Math.max(m, s.r), 0);
}

export function worstSite(die) {
  return residuals(die).reduce((w, s) => (s.r > w.r ? s : w));
}

/** Overlay health follows straight from the numbers — no authored status. */
export function overlayStatus(die) {
  const r = maxResidual(die);
  if (r > WARN_NM) return 'fail';
  if (r > SPEC_NM) return 'warn';
  return 'ok';
}

/** The four health chips shown on every die card. */
export function health(die) {
  return {
    litho: die.litho,
    overlay: overlayStatus(die),
    metrology: die.metrology,
    process: die.process,
  };
}

export function dieStatus(die) {
  const h = Object.values(health(die));
  if (h.includes('fail')) return 'fail';
  if (h.includes('warn')) return 'warn';
  return 'ok';
}

export function getDie(id) {
  return DIES.find((d) => d.id === id);
}

/* --------------------------------------------------------- board ordering */

/**
 * The lot board in stage order: hard fails first, worst residual at the top,
 * then the watch items, then everything already inside spec.
 *
 * Presentation only. Die IDs and wafer positions never change, so a die that
 * gets fixed simply lands in `ok` on the next render.
 *
 * @param {object[]} dies
 * @returns {{fail: object[], warn: object[], ok: object[]}}
 */
export function boardGroups(dies = DIES) {
  const groups = { fail: [], warn: [], ok: [] };
  for (const d of dies) groups[dieStatus(d)].push(d);
  // Worst first in the two groups that need a decision; the in-spec tail stays
  // in die order so it reads like inventory rather than a second ranking.
  const worstFirst = (a, b) => maxResidual(b) - maxResidual(a) || a.id.localeCompare(b.id);
  groups.fail.sort(worstFirst);
  groups.warn.sort(worstFirst);
  groups.ok.sort((a, b) => a.id.localeCompare(b.id));
  return groups;
}

/** Flat fails-first order — the same sequence `boardGroups` renders. */
export function failsFirst(dies = DIES) {
  const g = boardGroups(dies);
  return [...g.fail, ...g.warn, ...g.ok];
}

/** The other board order: the physical row/col walk the tool reports in. */
export function waferOrder(dies = DIES) {
  return [...dies].sort((a, b) => a.row - b.row || a.col - b.col);
}

/* ------------------------------------------------------------ the models */

/**
 * The crude model the pitch argues against: one global translation fitted to
 * every site at once. It drags the three good sites off target to chase the
 * one bad one, which is exactly the failure we want on screen.
 *
 * r(x, y) = T  (rotation term dropped)
 */
export function crudeGlobalFit(die) {
  return crudeFromResiduals(residuals(die));
}

/** @param {{id:string,dx:number,dy:number,r:number}[]} rs */
export function crudeFromResiduals(rs) {
  const T = {
    dx: rs.reduce((a, s) => a + s.dx, 0) / rs.length,
    dy: rs.reduce((a, s) => a + s.dy, 0) / rs.length,
  };
  const after = rs.map((s) => ({
    id: s.id,
    dx: s.dx - T.dx,
    dy: s.dy - T.dy,
    r: mag(s.dx - T.dx, s.dy - T.dy),
  }));
  const before = rs;
  return {
    T,
    after,
    maxAfter: after.reduce((m, s) => Math.max(m, s.r), 0),
    broken: after.filter((s, i) => s.r > SPEC_NM && before[i].r <= SPEC_NM).map((s) => s.id),
  };
}

/** Share of the miss the local translation takes; the rest is rotation. */
const SHIFT_SHARE = 0.813;
/** Effective arm of a box-in-box mark, in nm — what the rotation acts on. */
const ARM_NM = 1100;

/**
 * The model we actually ship: leave the global term alone and solve a local
 * translation + rotation at the one site that moved.
 *
 * r(x, y) = T + R·[x y]ᵀ, fitted per-site instead of per-field.
 */
export function localFit(die) {
  const site = die.outlier ? residuals(die).find((s) => s.id === die.outlier) : worstSite(die);
  const shift = { dx: round(site.dx * SHIFT_SHARE, 1), dy: round(site.dy * SHIFT_SHARE, 1) };
  const rem = { dx: site.dx - shift.dx, dy: site.dy - shift.dy };
  const sign = Math.sign(site.dx) || 1;
  const theta = round(((sign * mag(rem.dx, rem.dy)) / ARM_NM) * (180 / Math.PI), 3);
  return {
    siteId: site.id,
    before: { dx: site.dx, dy: site.dy, r: site.r },
    // What the model says went wrong at that site.
    error: { ...shift, theta },
    // What we actually turn: the negation of it.
    knob: { dx: -shift.dx, dy: -shift.dy, theta: -theta },
  };
}

const round = (v, d) => Number(v.toFixed(d));

/**
 * Residual set to draw for a given panel.
 * @param {object} die
 * @param {'golden'|'measured'|'crude'|'fixed'} mode
 */
export function residualsFor(die, mode) {
  if (mode === 'golden') return die.sites.map((s) => ({ id: s.id, dx: 0, dy: 0, r: 0 }));
  if (mode === 'crude') return crudeGlobalFit(die).after;
  return residuals(die);
}

/* ------------------------------------------------- state mutation (fix) */

/**
 * Apply the local correction. Writes the knob, drops the residual at the bad
 * site to sensor noise and — the whole point — leaves the good sites alone.
 */
export function applyFix(die) {
  const fit = localFit(die);
  const crude = crudeGlobalFit(die);
  const site = die.sites.find((s) => s.id === fit.siteId);
  const before = mag(site.dx, site.dy);

  // Keep the pre-fix numbers so the factory run can be replayed on stage.
  die.preFix = die.sites.map((s) => ({ id: s.id, dx: s.dx, dy: s.dy, r: mag(s.dx, s.dy) }));
  die.knobs.local[fit.siteId] = { ...fit.knob };
  // Residual after correction is the un-modelled remainder: sensor noise.
  site.dx = round(site.dx * 0.031, 2);
  site.dy = round(site.dy * -0.026, 2);

  die.process = 'ok';
  if (die.metrology === 'warn') die.metrology = 'ok';
  die.fixed = true;
  die.log = [
    `Read metrology: 4 sites, ${before.toFixed(1)} nm max at ${fit.siteId}.`,
    `Rejected global-T fit — it would push ${crude.broken.length} good site(s) out of spec.`,
    `Fitted T + R locally at ${fit.siteId}: Δx ${nm(fit.error.dx)} nm, Δy ${nm(fit.error.dy)} nm, θ ${nm(fit.error.theta, 2)}°.`,
    `Turned knob ${fit.siteId}: Δx ${nm(fit.knob.dx)} nm, Δy ${nm(fit.knob.dy)} nm, θ ${nm(fit.knob.theta, 2)}°.`,
    `Global knobs untouched — dx 0.0, dy 0.0, θ 0.000, mag 0.0.`,
    `Re-sim overlay: max |r| ${maxResidual(die).toFixed(1)} nm, inside the ${SPEC_NM.toFixed(1)} nm spec.`,
  ];
  return { fit, crude, before, after: mag(site.dx, site.dy) };
}

/* -------------------------------------------------------------- lot KPIs */

export function lotKpis() {
  const fails = DIES.filter((d) => dieStatus(d) === 'fail');
  const passing = DIES.filter((d) => dieStatus(d) !== 'fail');
  return {
    yield: (passing.length / DIES.length) * 100,
    maxResidual: DIES.reduce((m, d) => Math.max(m, maxResidual(d)), 0),
    openFails: fails.length,
    fixedCount: DIES.filter((d) => d.fixed).length,
    total: DIES.length,
  };
}
