/**
 * The story strip.
 *
 * Same slot, same shape, same voice on every view — plain English, short
 * sentences, pain then outcome. Technical chrome lives below it and never
 * takes its place. If you are tempted to put raw numbers here, put them in the
 * inspector instead.
 *
 * One arc runs through all of it: **caught → priced → assigned**. A miss is
 * caught at the tool, priced against the wafers behind it, and handed to an
 * owner. Everything else on screen is in service of those three words.
 */

import { usd } from './config/artifacts.js';
import { dieCostAvoided } from './data.js';

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
          text: `TLDR: ${kpis.openFails} dies in this lot printed out of alignment. Each one gets caught at the tool, priced against the wafers behind it, and handed to an owner — before the lot moves on.`,
          sub: `Caught → priced → assigned. ${usd(kpis.dollarsAtRisk)} is riding on the open fails right now, and nobody had to go looking for that number.`,
        }
      : {
          tone: 'ok',
          text: 'TLDR: Nothing in this lot is out of alignment any more. Every miss that was here got caught, priced and assigned — and what each one was worth is written down.',
          sub: 'Outcome: no open incidents, and the money the loop saved is in a log instead of an argument.',
        },

  dieFail: (die, site, residual) => ({
    tone: 'fail',
    text: `TLDR: Site ${site} printed about ${Math.round(residual)} nm off. That is the catch. What it is worth and who owns it come next — and a weak global correction here would break the three sites that landed fine.`,
    sub: `Caught → priced → assigned. ${usd(dieCostAvoided(die))} rides on this die: ${die.wafersAtRisk} wafers behind one bad mark.`,
  }),

  dieWatch: (die, site, residual) => ({
    tone: 'warn',
    text: `TLDR: This die still prints, but site ${site} is creeping — about ${residual.toFixed(1)} nm. Worth watching, not worth a correction yet. We price the misses we act on, not the ones we watch.`,
    sub: 'Pain: teams over-correct on a hunch. Outcome: fix only what moved, when it actually moves.',
  }),

  dieOk: (die) => ({
    tone: 'ok',
    text: die.fixed
      ? 'TLDR: This die is green. One knob at one site, and the good sites never moved. The catch is closed — what it was worth is in the impact log.'
      : 'TLDR: This die is green. All four sites landed inside spec, so there is nothing here to catch, price or assign. This is what a healthy die looks like next to a bad one.',
    sub: die.fixed
      ? 'Caught → priced → assigned. Open the recovery rail to see the row it wrote.'
      : 'Outcome: no action needed. Keep the knobs where they are.',
  }),

  factory: (site) => ({
    tone: 'warn',
    text: `TLDR: You’re about to run one die through the factory by hand: read the measurements → pick the math → update process → re-check. Watch ${site} go green — then watch it get priced.`,
    sub: 'Caught → priced → assigned. This supplements the model they already run; it does not replace it.',
  }),

  factoryDone: (site, before, after, dollars) => ({
    tone: 'ok',
    text: `TLDR: Caught. Site ${site} came back from ${before.toFixed(0)} nm to ${after.toFixed(1)} nm and the good sites never moved. Now it gets priced and assigned — the recovery rail below is the rest of the job.`,
    sub: `${usd(dollars)} avoided on this die alone, and the loop that found it is the one we automate next.`,
  }),

  recovery: (job) => {
    if (!job) {
      return {
        tone: 'neutral',
        text: 'TLDR: Nothing is in recovery right now. This is where a caught miss gets a price, a row in the log, and an owner — the artifacts below outlive any one incident.',
        sub: 'Caught → priced → assigned. Open a failing die to start one.',
      };
    }
    const remaining = Object.values(job.steps).filter((s) => s !== 'done').length;
    return remaining
      ? {
          tone: 'warn',
          text: `TLDR: ${job.dieId} is caught and priced at ${usd(job.costAvoided)}. What is left is ownership — a recipe change, a row in the log, the shift told, Monday’s pack, and a ticket for the pattern behind it.`,
          sub: `Caught → priced → assigned. ${remaining} of 5 still open; an incident nobody owns is not closed.`,
        }
      : {
          tone: 'ok',
          text: `TLDR: ${job.dieId} is closed. Caught at the tool, priced at ${usd(job.costAvoided)}, and every owner has it — recipe change, log, floor, weekly pack, backlog.`,
          sub: 'Outcome: the money is written down and the pattern has a ticket instead of somebody’s memory.',
        };
  },
};
