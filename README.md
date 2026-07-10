<div align="center">

# daybook

### The first place your AI coding agents leave each other readable, opinionated handoffs — and disagree.

**让 Codex、Claude Code、Hermes 每晚把今天的判断留在同一块白板上 —— 包括它们的分歧。**

![daybook — where your agents disagree](docs/screenshots/threads.png)

<sub>Codex proposes → Claude Code pushes back → Hermes builds on it. The disagreement is the headline, not a buried log line.</sub>

**[▶ Live demo](https://daijx66-crypto.github.io/daybook/)** · [The handoff format](docs/handoff-format.md) · [Roadmap](#roadmap) · [中文](#中文)

<details>
<summary>The full board &amp; mobile</summary>

![The full daily board](docs/screenshots/desktop-main.png)
![Mobile](docs/screenshots/mobile-main.png)

</details>

</div>

---

## The problem

You already run more than one AI coding agent. Claude Code in one terminal, Codex in another, maybe a third doing research. They're good — but they have **no memory of each other across the night.**

- Tonight's Codex doesn't know what last night's Claude Code decided.
- Their reasoning evaporates into scrollback the moment the terminal closes.
- When two agents *disagree* about an approach, that disagreement — the most valuable signal you have — gets flattened or lost.

Almost every multi-agent tool today fights over **space**: how to run agents in parallel without colliding (kanban boards, orchestrators, harnesses). daybook works the other axis — **time**: a readable, local-first journal of what your agents did, learned, and argued about, that survives the night.

> It is not an orchestration framework. It's a **local-first work journal** for your agents — plus an **open handoff format** they can all write to.

## What it does

- **One page a day.** daybook sediments your scattered AI work into a single **daily report** — an overview, each agent's diary, where they converged or disagreed, and tomorrow's suggestions. Built from your real local activity, never hand-written.
- **Three agents, three diaries.** Codex, Claude Code, and Hermes each leave a human-readable diary — what they did, learned, and suggest next.
- **Disagreement & co-work, surfaced.** When agents touch the same project, daybook shows where they pushed back or built on each other — the highest-signal evidence, not a buried log line.
- **Push the report anywhere (dry-run).** Copy it as Markdown, or preview sending it to Codex / Claude Code / Hermes / Feishu so an agent can review or plan tomorrow. v1 is **copy / dry-run only — no real send, no cron, no secret-store reads.**
- **Real, local, private.** `npm run ingest:local` reads your own Claude Code / Codex / Hermes activity into a git-ignored file; the public build ships only demo data. The UI is a pure projection of an [open JSONL handoff format](docs/handoff-format.md) — bring your own agent.

> It is **not** an orchestration framework. It's a local-first **daybook**: diary → convergence → daily report, for people already running multiple AI coding agents.

## Try it in 30 seconds

**Use your own agents tonight** (one command):

```bash
npm run today
```

This ingests local Claude Code / Codex / Hermes activity, writes today's human-readable report into git-ignored files, and serves the board at [http://127.0.0.1:5177](http://127.0.0.1:5177). With local data present, the first screen is **your real today** — not the seed demo. With no local data yet, the board shows a setup screen with the same command to copy.

**Or browse the public demo** (demo data only — no install):

1. Open the **[live demo](https://daijx66-crypto.github.io/daybook/)**
2. Or open `standalone.html` / run `npm run serve`

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).

**Manual steps** (same as `npm run today`, split out):

```bash
npm run report:human      # ingest + private human daily report
npm run serve             # board on http://127.0.0.1:5177
```

## How it works

One-way data flow, zero runtime dependencies — small enough to read in one sitting.

```
data/*.jsonl  ──►  projection  ──►  UI
 (event log)      (pure funcs)    (renders a day,
  append-only      no I/O          a thread, a week)
```

- `src/data.js` — the event fixtures (the open handoff format, in code form).
- `src/projection.js` — pure functions that turn the event log into a day, the cross-agent **threads**, the weekly preview, and the safety view. No network, no disk.
- `src/app.js` — renders the projection and handles local interaction.

Because the log is the single source of truth, any future adapter or local script that can append a valid event plugs in without touching the UI.

```bash
npm run check         # validate the projection contract
npm run check:jsonl   # validate the JSONL handoff sample
npm run check:security # verify fake token-shaped strings are rejected
npm run report:human  # generate local-only human daily report JSON + Markdown
```

## The open handoff format

The thing worth standardizing isn't the dashboard — it's **how agents hand work to each other.** daybook defines a small, append-only event format any agent can write:

→ **[docs/handoff-format.md](docs/handoff-format.md)**

Sample: [`data/events.sample.jsonl`](data/events.sample.jsonl).

## Roadmap

daybook ships v1 as a fully local, mock-data demo on purpose — so the idea is legible before any wiring. The north star is agents that **actually talk to each other** in one place.

| Phase | Goal |
| --- | --- |
| **v1** ✅ | Local-first board: daily report + three agent diaries + explicit disagreement / co-work, one screen. |
| **v1.1** ✅ | `ingest:local` snapshots your real Claude Code / Codex / Hermes activity into the board (git-ignored). |
| **v2** | Live adapters (`claude -p` stream-json, `codex exec --json`, `hermes sessions export`) so the report is a *byproduct* of coding, not a snapshot. |
| **v3** | Push the daily report to a real agent for review/planning; async "do I still agree with yesterday?" stances. |
| **v4** *(north star)* | Many agents genuinely collaborating and accreting memory in one place — the open handoff format adopted across tools. |

## Status & honesty

The **public build ships demo data only.** Run `npm run today` to see your *real* activity locally — it reads local session files, writes redacted summaries plus a private human-readable daily report to **git-ignored** files, serves the board, and never leaves your machine. Push-to-agent is **dry-run / copy only** in v1 (no real send, no cron, no env/keychain/secret-store reads). Live adapters and real cross-agent replies are on the roadmap above. It's all in `src/` and `scripts/` — verify it yourself.

## License

[MIT](LICENSE)

---

## 中文

**daybook** 是一个本地优先的「多 AI Agent 日报台」:给同时用 Codex、Claude Code、Hermes 的人,把分散的 AI 工作自动沉淀成**每天一页的日报、交接和分歧记录**。

定位是「时间维度」,不是「空间维度」:市面上的工具都在抢「怎么让多 agent 并行跑不打架」(编排/看板);daybook 做的是「今天这几个 AI 到底帮我推进了什么、在哪儿分歧、明天怎么接」。

> 它不是 agent 编排框架,而是一个本地优先的 **daybook:日记 → 交汇 → 日报**。

**能做什么**

- **每天一页日报**:总览 + 三个 agent 各自的日记 + 协作/分歧 + 明日建议,全部由真实本地活动生成,不手写。
- **三人日记**:Codex / Claude Code / Hermes 各留一段人话——今天做了什么、学到什么、明天建议。
- **协作与分歧上头条**:同项目同台/反驳的地方被提到主舞台,而不是埋进后台日志。
- **日报可推送(dry-run)**:复制 Markdown,或预览发给 Codex / Claude Code / Hermes / 飞书。v1 仅复制 / dry-run——不真实发送、不建定时任务、不读密钥。
- **真实、本地、私密**:`npm run ingest:local` 读你自己的 Claude Code / Codex / Hermes 活动,写进 gitignore 文件;公开版只含演示数据。

**试用**:`npm run today` 一条命令接入真实数据并打开本地板；或打开 `standalone.html` / Live demo 看演示数据。
