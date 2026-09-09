/** Shared bits: health chips, key/value rows, titlebar tabs, status bar. */

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

export function kv(k, v) {
  return `<div class="kv"><span>${k}</span><span class="kv__v">${v}</span></div>`;
}

/** One fact on a horizontal bar, for the facts a view used to rail down a side. */
export function fact(k, v) {
  return `<div class="fact"><span class="fact__k">${k}</span><span class="fact__v">${v}</span></div>`;
}

export function setTabs(view) {
  const tabs = [
    { id: 'lot', label: 'Lot board', href: '#/lot' },
    { id: 'die', label: 'Cell · TOP', href: null },
    { id: 'factory', label: 'Factory run', href: null },
    { id: 'recovery', label: 'Recovery', href: '#/recovery' },
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
