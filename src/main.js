/** Hash router. Three views, one page, no framework. */

import { resetLot } from './data.js';
import { renderLot, resetBoardView } from './views/lot.js';
import { renderDie } from './views/die.js';
import { abandonFactoryRun, renderFactory } from './views/factory.js';

const app = document.getElementById('app');

function route() {
  const hash = location.hash || '#/lot';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  app.scrollTop = 0;
  abandonFactoryRun();

  if (parts[0] === 'die' && parts[1]) {
    if (parts[2] === 'run') renderFactory(app, parts[1].toUpperCase());
    else renderDie(app, parts[1].toUpperCase());
    return;
  }
  renderLot(app);
}

/**
 * Back to the top of the pitch: authored lot state, default board order, lot
 * board on screen. Safe to mash mid-run — abandoning the pipeline first stops
 * an in-flight factory run from writing a fix into the lot we just restored.
 */
function resetDemo() {
  abandonFactoryRun();
  resetLot();
  resetBoardView();
  // Only a hash we are not already on fires a hashchange, so render directly
  // when the presenter resets from the board itself.
  if (location.hash === '#/lot') route();
  else location.hash = '#/lot';
  flashReset();
}

let flashTimer;
function flashReset() {
  const flash = document.getElementById('reset-flash');
  flash.hidden = false;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flash.hidden = true;
  }, 1600);
}

document.getElementById('reset-demo').addEventListener('click', resetDemo);
window.addEventListener('hashchange', route);
route();
