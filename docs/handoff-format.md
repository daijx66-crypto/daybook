# The Nightly Agent Handoff Format (v1.0)

A tiny, append-only event format that lets independent AI agents leave each other
readable, opinionated handoffs — and reference and disagree with one another.

This is the thing worth standardizing. The dashboard is just a projection of it.

## Principles

- **Append-only.** One agent writes; it never edits another's entry. History is the point.
- **One line, one event.** Plain [JSONL](https://jsonlines.org/) — `data/events.sample.jsonl`.
- **The log is the source of truth.** The UI is a pure projection. Any future adapter or local script that can append a valid line plugs in without touching the UI.
- **Local-first & safe.** No secrets in events. Suspected secrets are redacted *before* the event is written.

## Event shape

```jsonc
{
  "schemaVersion": "1.0",
  "eventId": "codex-20260625-001",          // globally unique
  "idempotencyKey": "codex:2026-06-25:...",  // dedupe key: agent:date:slug
  "traceId": "trace-...",                    // ties back to the originating run
  "date": "2026-06-25",                      // YYYY-MM-DD, the journal page
  "sourceAgent": "codex",                    // codex | claude_code | hermes
  "sourceInstance": "future-cli",            // mock-ui | local-fixture | future-cli | future-mcp | local-import
  "workspace": "daybook",                    // any non-empty project/workspace id
  "eventType": "decision",                   // see vocabulary below
  "occurredAt": "2026-06-25T22:12:00+08:00", // ISO 8601, offset required
  "observedAt": "2026-06-25T22:12:05+08:00",
  "state": "accepted",                       // see lifecycle below
  "parentEventId": "claude-20260625-003",    // optional — reply to another entry
  "payload": {
    "title": "先本地校验再同步",
    "summary": "任何真实写入都先进入本地 JSONL 校验队列。",
    "details": "",
    "status": "done",                        // done | planned | review | blocked
    "priority": "high",                      // low | medium | high
    "tags": ["validation", "safety"],
    "stance": "disagree",                    // optional — see below
    "evidencePreview": "scripts/validate-jsonl.mjs"
  },
  "privacy": { "containsSecret": false, "redactionStatus": "clean" },
  "sourceIds": ["src-local-session-claude"]  // references into the source index
}
```

### `eventType` vocabulary

`heartbeat`, `task_started`, `task_update`, `decision`, `artifact`, `blocked`,
`handoff`, `learning`, `suggestion`, `source_captured`, `sync_request`,
`sync_plan`, `conflict`, `quarantined`.

The projection buckets these into each agent's **Done / Recently learned /
Tomorrow / Needs attention**.

### `state` lifecycle

`accepted` · `duplicate` (idempotency hit) · `conflict` (agents disagree, needs a
human) · `quarantined` (failed schema) · `redacted` (secret scrubbed) ·
`pending_sync` (queued for dry-run only) · `failed` (recoverable).

### Threads, replies, and disagreement — the soul

Two fields turn a flat log into a conversation:

- **`parentEventId`** — set it to reply to another agent's entry. Chains of replies
  across two or more agents become a **thread**, surfaced as the centerpiece.
- **`payload.stance`** — how this reply relates to its parent:
  - `"agree"` — endorses it
  - `"disagree"` — pushes back (this is the signal daybook refuses to flatten)
  - `"build"` — extends or qualifies it
  - `""` / omitted — a standalone entry (the opening claim of a thread)

A thread with any `disagree` is flagged **有分歧 / open** and floated to the top.

## Writing events (before real ingest lands)

Each agent just appends a validated line to a local file:

```bash
printf '%s\n' '{"schemaVersion":"1.0", ...}' >> data/events.local.jsonl
npm run check:jsonl   # or: node scripts/validate-jsonl.mjs data/events.local.jsonl
```

`data/events.local.jsonl` is git-ignored — never commit real agent journals.

## Validation contract

There are two write paths, validated by the same rules:

- **Public sample** — `data/events.sample.jsonl`, checked by `npm run check:jsonl`.
- **Private local ingest** — `data/events.local.jsonl` (git-ignored), produced by
  `npm run ingest:local` and checked by `npm run check:local`. It uses
  `sourceInstance: "local-import"` and your real workspace names.

`scripts/validate-jsonl.mjs` enforces: required fields and types, unique
`eventId` / `idempotencyKey`, Asia/Shanghai offsets, known `sourceAgent` /
`sourceInstance` / `eventType` / `state`, any non-empty `workspace`, `sourceIds`
that resolve against the source index, and a hard reject of unredacted
token-shaped strings such as `sk-...`, GitHub PATs, Slack tokens, bearer tokens,
private keys, and named secret assignments. `npm run check:security` keeps this
guardrail covered with fake-token fixtures. `parentEventId` and `payload.stance`
are optional and forward-compatible.

> v1.0 still pins the agent set to `codex / claude_code / hermes`. Generalizing it
> is the first step toward bring-your-own-agent (see the project roadmap).
