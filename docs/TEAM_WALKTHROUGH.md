# Team walkthrough — 30 minutes on stage

Beats only. This is the running order and who owns what, not a script. The
words live in the app (`src/tldr.js`); the numbers live in `src/data.js` and
`src/config/artifacts.js`.

One sentence holds the whole thing together: **caught → priced → assigned.**
Catching a bad die is the part that already half works. Pricing it and putting a
name on it is the part that does not, which is why the same miss gets
re-argued next week.

Hit **Reset demo** in the titlebar before you start.

## Artifacts

| what | where | state |
| --- | --- | --- |
| Yield impact log | [Google Sheet](https://docs.google.com/spreadsheets/d/1h0MhoLHz8A76EV7hfalYlFDuodytpTMPi-IzfWbAlUY/edit) | live — one row per priced incident, 14 columns |
| Weekly ROI pack | [Google Slides](https://docs.google.com/presentation/d/1ipbu1IOxCQkOUKKhzdkiNRTikI60kgt5FLm6CO5jA6M/edit) | live — the week's impact rows as Monday's deck; the rail opens it |
| Backlog | Jira | stub. Two authored cards, `ASML-101` and `ASML-102` |

## The beats

### 1 · The board, and the money on it — 4 min

`#/lot`. Twelve dies, three failing. The health band carries four numbers:
**75% predicted yield, 22.0 nm max residual, 3 open fails, $303k at risk.**

The fourth is the new one. It is `wafers_at_risk × $8,500 × 0.35` summed over
the open fails, and it is on screen before anybody asks "what does that cost?".
Watch items are deliberately not priced into it — pricing a die nobody is going
to touch inflates the headline.

Fails come first on the board. D07 is on top with 22 nm and $178,500 on it.

### 2 · The catch — 6 min

Open **D07**. Golden left, measured right. A, C and D landed inside 1 nm; B is
22 nm out.

**Preview the crude fit (T only)** is the argument: fit one global translation
and B barely improves while the three good sites get dragged out of spec. A
weak model slides the whole stamp.

Then pick a lane. Both land in the same place:

- **Run fix on this die →** — the manual factory run. Five steps, the mark comes
  home, the residual counts down to 0.6 nm, the good sites never move.
- **Submit recipe change** — the same miss written up as an overlay correction
  against the recipe instead of worked on the floor. `OCR-4821` is filed, in
  review, pending apply. The die is *still* out of spec, because a filed change
  is not a knob turned.

For the 30-minute version, run the manual fix. Mention the recipe-change button
exists and that it opens the identical incident with that first check already
ticked.

> Aside, for a technical room only: under the hood this second lane is the
> coding-task story — a Cloud Agent drafting the correction and putting it up for
> review. Say it out loud if it helps; the product surface stays fab-native and
> never shows a repo, because a yield engineer does not open a forge to fix a die.

### 3 · The recovery rail — 8 min

The run finishes and the recovery panel appears under the verdict; the full
version is at `#/recovery` and in the titlebar from anywhere.

Five checks, and the incident is not closed until all five are:

**Recipe change · Impact logged · Shift notified · Weekly ROI · Backlog**

Two Grok Bots are on the lane. `lot-incident-owner` woke on the red lot, acked
the catch, and handed the priced question to `yield-impact-analyst`. Open
*message body sent to yield-impact-analyst* — that JSON is the actual payload
the agent project is written against, not a mock-up.

### 4 · Pricing it — 5 min

Press **Log impact**. The analyst's line appears with the arithmetic:

```
60 wafers × $8,500 × 0.35 = $178,500 avoided
```

The row it writes has 14 columns and shows on screen. The append is a real
call — `POST /api/impact/append` — and the badge says which of three things
happened: appended to the live Sheet, written to the dev server's local log, or
held in the app. It never claims Sheets when it did not reach Sheets.

Then **Open the impact Sheet ↗** and show the log the row belongs in.

### 5 · Assigning it — 4 min

**Notify shift** puts it in `#fab2-shift-b`. **Show weekly pack** opens the
Monday deck in a new tab — it is a real link, so know what is on the slide
before you click it in front of a room. **Show backlog stub** shows `ASML-101`
and `ASML-102` — the recurring themes, waiting on a teammate to file them.

All five green. Go back to `#/lot`: predicted yield is 83%, open fails is 2, and
$ at risk dropped by exactly D07's $178,500.

### 6 · What is real — 3 min

Real: the geometry, the residual arithmetic, the two competing model fits, the
cost formula, the state changes, and the append call.

Not real: the numbers are authored, the factory pipeline is a simulation on a
timer, the `OCR-4821` correction record is authored, and the two Grok Bots are
shown as a lane rather than called live from the app. Nothing in the UI claims
otherwise.

**Reset demo** and hand the laptop on.

## Who can own what next

Everything below is a real integration with a stubbed connector and a real hook
already in place. None of it needs the app rewritten.

| piece | what exists today | what owning it means |
| --- | --- | --- |
| **Sheets append** | `POST /api/impact/append` in `vite.config.js` forwards to the Sheets `values:append` API when `GOOGLE_SHEETS_ACCESS_TOKEN` is set, and writes `.impact-log.jsonl` when it is not | make the credential real — a service account and a shared sheet — so the badge says `sheets` on stage |
| **Slides generation** | the deck exists and the rail links it from `src/config/artifacts.js`, but the rows are rolled into it by hand — that is `ASML-102` | generate the week's slides from the log rows so the deck fills itself |
| **Jira tickets** | two authored cards behind **Show backlog stub** | cluster the week's rows into themes and file real tickets |
| **The two bots** | `agents/lot-incident-owner` and `agents/yield-impact-analyst`, instructions complete, teammate ids placeholdered | run one turn each, read the ids, patch them in with UpdateAgent — each README has the steps |
| **Recipe change** | authored `OCR-####` record behind **Submit recipe change** | file into the real change-management queue so review and apply are tracked where the fab already tracks them |

## Bot roles

| bot | owns | does not own |
| --- | --- | --- |
| [`lot-incident-owner`](../agents/lot-incident-owner/README.md) | intake, the ack to the person, the handoff, the rest of the checklist | the dollar figure |
| [`yield-impact-analyst`](../agents/yield-impact-analyst/README.md) | `cost_avoided`, the impact-log row | the model argument, the knob, whether a die is re-worked |

Both run on the experimental `grokbot` runtime, so a turn executes on Cursor's
hosted box and needs a Cursor API key. Only what a bot passes to `SendToUser` is
visible to the person.

`agents/weather-agent` is unrelated — a hello-world for rehearsing an Agent SDK
turn. **Do not show it to a customer** and do not let it into the deck.
