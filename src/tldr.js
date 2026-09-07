/**
 * The story strip.
 *
 * Same slot, same shape, same voice on every view — plain English, short
 * sentences, pain then outcome. Technical chrome lives below it and never
 * takes its place. If you are tempted to put raw numbers here, put them in the
 * inspector instead.
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
          text: 'TLDR: Most of this lot prints fine. A few dies are out of alignment — that’s scrap risk. We’re measuring the miss, then fixing the process knobs — not rewriting their whole agent.',
          sub: 'Pain: engineers babysit STEM loops die by die. Outcome: residual down, dies green, hours back per shift.',
        }
      : {
          tone: 'ok',
          text: 'TLDR: The whole lot is inside spec now. Every die that was drifting got one knob turned, not a rebuild. Nothing good was touched on the way.',
          sub: 'Outcome: no scrap from this lot, and the loop that saved it is the one we automate next.',
        },

  dieFail: (die, site, residual) => ({
    tone: 'fail',
    text: `TLDR: Layer 2 mostly landed on Layer 1. Site ${site} didn’t — ~${Math.round(residual)} nm off. A weak model slides everything and breaks the good sites. A stronger STEM pass pinpoints ${site} and only turns that knob.`,
    sub: 'Pain: one bad site drags a whole die toward scrap. Outcome: residual down, die green, no re-work.',
  }),

  dieWatch: (die, site, residual) => ({
    tone: 'warn',
    text: `TLDR: This die still prints, but site ${site} is creeping — about ${residual.toFixed(1)} nm. It is worth watching, not worth a global correction yet. Touching everything here would cost more than it saves.`,
    sub: 'Pain: teams over-correct on a hunch. Outcome: fix only what moved, when it actually moves.',
  }),

  dieOk: (die) => ({
    tone: 'ok',
    text: die.fixed
      ? 'TLDR: This die is green. The bad site is back inside spec and the good sites never moved. One knob turned, nothing else touched.'
      : 'TLDR: This die is green. All four sites landed inside spec, so there is nothing to correct here. This is what a healthy die looks like next to a bad one.',
    sub: die.fixed
      ? 'Outcome: residual down, die green, and the manual loop that used to eat an afternoon is done.'
      : 'Outcome: no action needed. Keep the knobs where they are.',
  }),

  factory: (site) => ({
    tone: 'warn',
    text: `TLDR: You’re about to run one die through the factory by hand: read the measurements → pick the math → update process → re-check. Watch ${site} go green. Same loop we’ll automate next.`,
    sub: 'This supplements the model they already run — it doesn’t replace it. Pain today: an engineer sits through every one of these.',
  }),

  factoryDone: (site, before, after) => ({
    tone: 'ok',
    text: `TLDR: Done. Site ${site} came back from ${before.toFixed(0)} nm to ${after.toFixed(1)} nm, and the good sites never moved. One die saved by hand — now picture it running on every die, every lot.`,
    sub: 'Outcome: residual down, die green, hours back. Nobody had to babysit the loop to get here.',
  }),
};
