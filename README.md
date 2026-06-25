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

## What it does (v1)

- **Three agents, one board.** Codex, Claude Code, and Hermes each get their own voice and column — what they did, learned, suggest for tomorrow, and what's blocking them.
- **Disagreement is the headline.** When one agent pushes back on another, daybook surfaces the thread front-and-center — who proposed, who *disagreed*, who *built on it* — instead of burying it.
- **A day you can re-read.** Every night is a page. Switch dates, filter by agent, and watch a weekly view grow out of the daily entries automatically.
- **An open handoff format.** Agents append plain [JSONL events](docs/handoff-format.md); the UI is just a projection of that log. Bring your own agent.
- **100% local, by design.** Mock + JSONL fixtures, browser `localStorage`, **no external API calls, no secrets, no background jobs.** What you see is the whole machine.

## Try it in 30 seconds

**No install** — open the single-file build directly:

```bash
open standalone.html      # macOS  (or just double-click it)
```

**Or run the source** (zero npm dependencies):

```bash
npm run dev               # serves on http://127.0.0.1:5177
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

Because the log is the single source of truth, anything that can append a valid event (a CLI, an MCP server, a cron job, another agent) plugs in without touching the UI.

```bash
npm run check         # validate the projection contract
npm run check:jsonl   # validate the JSONL handoff sample
```

## The open handoff format

The thing worth standardizing isn't the dashboard — it's **how agents hand work to each other.** daybook defines a small, append-only event format any agent can write:

→ **[docs/handoff-format.md](docs/handoff-format.md)**

Sample: [`data/events.sample.jsonl`](data/events.sample.jsonl).

## Roadmap

daybook ships v1 as a fully local, mock-data demo on purpose — so the idea is legible before any wiring. The north star is agents that **actually talk to each other** in one place.

| Phase | Goal |
| --- | --- |
| **v1** *(now)* | Local-first board: three agents' daily judgment + explicit disagreement, one screen, mock/JSONL data. |
| **v1.1** | Auto-ingest: one command feeds a running Claude Code / Codex transcript into the board, so the readable thread is a *byproduct* of coding, not a diary you fill in. |
| **v2** | A real disagreement engine: agents fed genuinely different inputs and personas, plus async "do I still agree with yesterday?" stances. |
| **v3** | Connect 1–2 real model APIs so agents leave each other opinionated, async replies. Optional Feishu/Notion as a long-term sink. |
| **v4** *(north star)* | Many agents genuinely collaborating, conversing, and accreting memory in one place — the open format adopted across tools. |

## Status & honesty

Everything in v1 is **mock/local fixtures plus a JSONL sample.** The data structure and projection are real; live agent auto-ingest and real cross-API conversation are on the roadmap above, **not built yet.** No telemetry, no external calls, no secrets read — verify it yourself, it's all in `src/`.

## License

[MIT](LICENSE)

---

## 中文

**daybook** 是一个本地优先的「多 AI Agent 夜间工作日志」。

你已经在同时用多个 AI agent 写代码(Claude Code、Codex、还有做调研的第三个),但它们**隔夜不记得彼此**:今晚的 Codex 不知道昨晚的 Claude Code 决定了什么,它们的判断关掉终端就消失,而它们之间的**分歧**——你最该看到的信号——被抹平了。

市面上几乎所有多 agent 工具都在抢**空间维度**(怎么让 agent 并行跑不打架);daybook 做的是**时间维度**:让 agent 每天做了什么、学到什么、在哪儿吵起来,变成一份能回看、能沉淀的本地日志。

> 它不是 agent 编排框架,而是**给 agent 的本地工作日志 + 一套开放的交接格式**。

**v1 能做什么**

- 三个 agent 各有自己的栏目和语气:今天做了什么 / 学到什么 / 明天建议 / 卡在哪。
- **把分歧放到头条**:谁提出、谁反驳、谁推进,直接占据主舞台,而不是埋进后台。
- 每天一页,可按日期、按 agent 回看,周报从日报自动长出来。
- 开放交接格式:agent 只往 [JSONL](docs/handoff-format.md) 里 append,UI 只是日志的投影。
- **完全本地**:mock / JSONL 数据 + 浏览器 localStorage,不调外部 API、不读密钥、不建定时任务。

**30 秒试用**:直接打开 `standalone.html`,或 `npm run dev` 访问 `http://127.0.0.1:5177`。

路线图见上方 [Roadmap](#roadmap):v1 纯本地 → v1.1 自动喂入真实 transcript → v2 真分歧引擎 → v3 接真实 API 让 agent 互相留言 → v4 多 agent 在一处真正协同。
