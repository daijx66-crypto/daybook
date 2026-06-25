# AGENTS.md

Guidance for AI agents (and humans) working **on** this repo.

## What this is

daybook is a local-first work journal for multiple AI coding agents — and an open
handoff format. It is **not** an orchestration framework. The soul of the product
is agents leaving each other readable, opinionated handoffs *and disagreeing*; keep
that the centerpiece, not a buried detail.

## Architecture (don't break the data flow)

```
data/*.jsonl  ──►  src/projection.js  ──►  src/app.js
 (event log)        (pure functions)        (render + local UI)
```

- The **event log is the single source of truth.** Every view (daily, threads,
  weekly, safety) is a pure projection of events. Don't let the UI become a second
  source of truth.
- `src/projection.js` must stay **pure**: no network, no disk, no `Date.now()` in
  ways that change output. Add a new view by adding a projection function.
- Cross-agent **threads** are built from `parentEventId` + `payload.stance`. See
  [docs/handoff-format.md](docs/handoff-format.md).

## Hard boundaries (v1)

- Mock / JSONL / `localStorage` only. **No external API calls. No secrets read. No
  cron / background jobs. No real Feishu/Notion writes.**
- Never commit real agent journals — `data/events.local.jsonl` is git-ignored.
- Suspected secrets must be redacted *before* an event is written.

## Before you commit

```bash
npm run check          # projection contract
npm run check:jsonl    # JSONL handoff format
npm run build:standalone   # regenerate standalone.html if src changed
```

`standalone.html` is a generated single-file build — edit `src/`, then rebuild;
don't hand-edit the bundle.
