# Release evidence · 2026-07-11

Star-ready public v1 surface for [daybook](https://github.com/daijx66-crypto/daybook).

## Outcome

| Check | Result |
| --- | --- |
| Repo visibility | `PUBLIC` |
| Homepage | https://daijx66-crypto.github.io/daybook/ |
| Pages HTTP | `200` |
| Pages title | `daybook · 夜谈台` |
| Pages commit | `5965e48` (built) |
| Local `index` / `standalone` | `200` on `127.0.0.1:5177` |
| Private local journals on `origin/main` | not present (`data/*.local.*` gitignored) |

## Commands run (all passed)

```text
npm run check
# check-demo: all local projection checks passed

npm run check:security
# status: passed (openai_key, github_pat, slack_token, bearer_token, api_key_assignment, private_key)

npm run check:jsonl
# status: passed, events: 3, agents: codex/claude_code/hermes, externalCallsMade: false

npm run build:standalone
# built standalone.html
```

## Git

- Branch shipped: `feature/local-ingest` → fast-forward `main`
- Release commit: `5965e48` — `release: ship star-ready public v1 surface`
- Remote: https://github.com/daijx66-crypto/daybook

## Privacy boundary

- Tracked sample only: `data/events.sample.jsonl`
- Ignored locally: `data/*.local.jsonl`, `data/*.local.json`, `reports/daily/*.md`
- Public build remains demo-data-only; ingest/report scripts write git-ignored outputs
