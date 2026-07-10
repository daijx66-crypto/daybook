# Practicality v1.5 evidence · 2026-07-11

Outcome: daybook usable tonight on real multi-agent activity via one command.

## Verified

| Check | Result |
| --- | --- |
| `npm run check` | passed |
| `npm run check:today` | passed: Beijing date, zero-event first run, existing-report preservation |
| `npm run check:security` | passed |
| `npm run check:jsonl` | passed |
| `npm run build:standalone` | built |
| Local real board `http://127.0.0.1:5177` | mode pill `真实 · 1051`, date `2026-07-11`, human report visible, **复制 Markdown** in report header |
| Local empty board (no `events.local.jsonl`) | setup screen with copyable `npm run today` |
| Public Pages contract | unchanged: demo-data-only; `data/*.local.*` gitignored |
| `git status` privacy | no local journals staged |

## One-command loop

```bash
npm run today
```

Runs ingest → human report → serves `http://127.0.0.1:5177`.

The report date is pinned to the Asia/Shanghai calendar day. `--preserve-human`
prevents the daily loop from overwriting an existing human report. The internal
`--prepare-only` flag exercises the same ingest/report path without starting a
long-running server, which keeps the contract regression-testable.

## Notes

- Real-data screenshots were taken during verification and **not** committed (contain private project names).
- Markdown copy uses the human report when the selected date matches `daily-human-report.local.json`.
