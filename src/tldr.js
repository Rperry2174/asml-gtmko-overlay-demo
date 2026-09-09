/**
 * The status strip.
 *
 * Same slot on every view, answering one question: what is true on this screen
 * right now. Counts, the site in question, the residual, the money on it, and
 * what is still open. The subline is the next thing to do in the product.
 *
 * It is a surface inside the tool, not a narrator standing next to it. No
 * prefix announcing itself, no mantra, no line addressed to a room, no claim
 * about what the software proves. If a line would not make sense to an operator
 * with the app open and nobody presenting, it does not belong here — the
 * argument lives in `README.md` and `docs/TEAM_WALKTHROUGH.md`.
 */

import { usd, usdCompact } from './config/artifacts.js';
import { dieCostAvoided } from './data.js';
import { RECOVERY_STEPS } from './recovery.js';

/*
 * Money on the strip is printed the way the surface underneath it prints the
 * same figure. The lot line sits above the health band, which sizes the total
 * for the back of the room, so it rounds with it. Everything else is one die,
 * and one die's figure is the one said out loud and written to the impact log —
 * `usdCompact` would round $178,500 to $179k and quietly disagree with both.
 */

const el = {
  strip: () => document.getElementById('tldr'),
  text: () => document.getElementById('tldr-text'),
  sub: () => document.getElementById('tldr-sub'),
};

/**
 * @param {{text: string, sub: string, tone?: 'neutral'|'warn'|'fail'|'ok'}} copy
 */
export function setTldr({ text, sub, tone = 'neutral' }) {
  const strip = el.strip();
  el.text().textContent = text;
  el.sub().textContent = sub;
  strip.dataset.tone = tone;
  // Re-trigger the entrance so a changed story reads as a change.
  strip.classList.remove('is-in');
  void strip.offsetWidth;
  strip.classList.add('is-in');
}

export const COPY = {
  lot: (kpis) =>
    kpis.openFails > 0
      ? {
          tone: 'warn',
          text: `${kpis.openFails} dies failing overlay · ${kpis.maxResidual.toFixed(1)} nm max residual · ${usdCompact(kpis.dollarsAtRisk)} at risk`,
          sub: `${kpis.yield.toFixed(0)}% predicted yield. Open a die under Needs fix to start recovery.`,
        }
      : {
          tone: 'ok',
          text: `All ${kpis.total} dies inside spec · ${kpis.fixedCount} corrected this session · nothing at risk`,
          sub: 'Nothing on the board needs a decision. Open the recovery rail for anything still on a checklist.',
        },

  dieFail: (die, site, residual) => ({
    tone: 'fail',
    text: `${die.id} · site ${site} out of spec at ${residual.toFixed(1)} nm · ${usd(dieCostAvoided(die))} at risk`,
    sub: `${die.wafersAtRisk} wafers behind this die. Run a factory fix or submit a recipe change.`,
  }),

  dieWatch: (die, site, residual) => ({
    tone: 'warn',
    text: `${die.id} · site ${site} drifting at ${residual.toFixed(1)} nm · below the fail threshold`,
    sub: 'Watch item — not counted in $ at risk, and no correction while it holds.',
  }),

  dieOk: (die) =>
    die.fixed
      ? {
          tone: 'ok',
          text: `${die.id} back in spec · site ${Object.keys(die.knobs.local)[0]} corrected, the other sites unchanged · ${usd(dieCostAvoided(die))} avoided`,
          sub: 'Complete the recovery checklist to close the incident.',
        }
      : {
          tone: 'ok',
          text: `${die.id} clean · all ${die.sites.length} sites inside spec`,
          sub: 'Nothing to correct on this die.',
        },

  factory: (site) => ({
    tone: 'warn',
    text: `Factory run in progress · site ${site} under correction`,
    sub: 'Five steps: read metrology, fit model, propose knobs, re-sim, pass/fail.',
  }),

  factoryDone: (site, before, after, dollars) => ({
    tone: 'ok',
    text: `Site ${site} back in spec · ${before.toFixed(1)} nm → ${after.toFixed(1)} nm · ${usd(dollars)} avoided`,
    sub: 'Complete the recovery checklist below to close the incident.',
  }),

  recovery: (job) => {
    if (!job) {
      return {
        tone: 'neutral',
        text: 'No incident open · impact log, weekly pack and backlog carry over between incidents',
        sub: 'Open a failing die and run a fix or submit a recipe change to start one.',
      };
    }
    const open = RECOVERY_STEPS.filter((s) => job.steps[s.id] !== 'done');
    return open.length
      ? {
          tone: 'warn',
          text: `${job.dieId} · ${usd(job.costAvoided)} · ${open.length} of ${RECOVERY_STEPS.length} steps open`,
          sub: nextActions(open),
        }
      : {
          tone: 'ok',
          text: `${job.dieId} closed · ${usd(job.costAvoided)} in the impact log · all ${RECOVERY_STEPS.length} steps done`,
          sub: 'Shift notified, in Monday’s ROI pack, theme filed to the backlog.',
        };
  },
};

/** "Submit recipe change, then log impact." — the checklist's own next steps. */
function nextActions(open) {
  const [first, second] = open;
  return second ? `${first.action}, then ${lower(second.action)}.` : `${first.action}.`;
}

const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
