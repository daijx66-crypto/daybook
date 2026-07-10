# Contributing to daybook

Thanks for helping. daybook stays small on purpose: a local-first journal and an open handoff format — not an orchestration framework.

## Quick loop

```bash
npm run check
npm run check:jsonl
npm run check:security
npm run build:standalone   # if you changed src/
```

Open `standalone.html`, or run `npm run dev` and visit `http://127.0.0.1:5177`.

## Rules that keep the project star-worthy

1. **Event log is the source of truth.** Views are pure projections of JSONL events.
2. **No secrets in git.** Never commit `data/*.local.*`, real session text, `.env`, tokens, or cookies.
3. **Public build = demo data only.** Local ingest may read your machine; it must write only to git-ignored files.
4. **v1 stays dry-run.** No real send, cron, keychain, or secret-store reads.
5. **Keep `src/projection.js` pure** — no network, no disk, no hidden clocks that change output.

## Pull requests

- Prefer one focused change per PR.
- Include the check commands you ran and their results.
- If UI changed, attach a desktop screenshot (and mobile if layout is affected).
- Do not expand scope into multi-agent orchestration, cloud sync, or paid services unless an issue already asks for it.

## Handoff format

Cross-agent threads use `parentEventId` + `payload.stance`. See [docs/handoff-format.md](docs/handoff-format.md).
