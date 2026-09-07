/** Hash router. Three views, one page, no framework. */

import { renderLot } from './views/lot.js';
import { renderDie } from './views/die.js';
import { renderFactory } from './views/factory.js';

const app = document.getElementById('app');

function route() {
  const hash = location.hash || '#/lot';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  app.scrollTop = 0;

  if (parts[0] === 'die' && parts[1]) {
    if (parts[2] === 'run') renderFactory(app, parts[1].toUpperCase());
    else renderDie(app, parts[1].toUpperCase());
    return;
  }
  renderLot(app);
}

window.addEventListener('hashchange', route);
route();
