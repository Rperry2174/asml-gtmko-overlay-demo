/** Shared chrome: health chips, the layer rail, titlebar tabs, status bar. */

export const STATUS_WORD = { ok: 'ok', warn: 'watch', fail: 'fail' };

export function chip(label, status) {
  return `<span class="chip"><span class="chip__dot chip__dot--${status}"></span>${label}</span>`;
}

export function healthChips(h) {
  return `<div class="chips">
    ${chip('Litho', h.litho)}
    ${chip('Overlay', h.overlay)}
    ${chip('Metrology', h.metrology)}
    ${chip('Process', h.process)}
  </div>`;
}

const LAYERS = [
  { n: 1, name: 'diff', color: '#2f7a4f' },
  { n: 2, name: 'poly', color: '#6a4bab' },
  { n: 31, name: 'metal1', color: '#21b5f0' },
  { n: 32, name: 'metal2', color: '#ef9a1f' },
  { n: 40, name: 'via', color: '#cfe8f5' },
  { n: 99, name: 'overlay err', color: '#ff5252' },
];

export function layerRail() {
  return `
    <h2 class="rail__title">Layers</h2>
    <div class="rail__block">
      ${LAYERS.map(
        (l) => `<div class="layer">
          <span class="layer__swatch" style="background:${l.color}"></span>
          <span class="layer__num">${l.n}</span>
          <span>${l.name}</span>
        </div>`,
      ).join('')}
    </div>
    <h2 class="rail__title">Display</h2>
    <div class="rail__block">
      <label class="check"><input type="checkbox" checked disabled /> grid 5 µm</label>
      <label class="check"><input type="checkbox" checked disabled /> rulers</label>
      <label class="check"><input type="checkbox" checked disabled /> markers</label>
    </div>`;
}

export function kv(k, v) {
  return `<div class="kv"><span>${k}</span><span class="kv__v">${v}</span></div>`;
}

export function setTabs(view) {
  const tabs = [
    { id: 'lot', label: 'Lot board', href: '#/lot' },
    { id: 'die', label: 'Cell · TOP', href: null },
    { id: 'factory', label: 'Factory run', href: null },
  ];
  document.getElementById('titlebar-tabs').innerHTML = tabs
    .map((t) =>
      t.href
        ? `<a class="tab ${view === t.id ? 'is-active' : ''}" href="${t.href}">${t.label}</a>`
        : `<span class="tab ${view === t.id ? 'is-active' : ''}">${t.label}</span>`,
    )
    .join('');
}

export function setStatus(left, mid = '', right = 'die_overlay_demo.gds · read-only') {
  document.getElementById('status-left').textContent = left;
  document.getElementById('status-mid').textContent = mid;
  document.getElementById('status-right').textContent = right;
}

export function setTitleFile(name) {
  document.getElementById('titlebar-file').textContent = name;
}
