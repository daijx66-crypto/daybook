export const AGENTS = {
  codex: {
    id: "codex",
    name: "Codex",
    role: "本地执行员 / 工程沉淀",
    shortRole: "Engineering",
    accent: "#1261d6",
    soft: "#eaf2ff"
  },
  claude_code: {
    id: "claude_code",
    name: "Claude Code",
    role: "架构审稿人 / 代码判断",
    shortRole: "Reasoning",
    accent: "#168052",
    soft: "#eaf7f0"
  },
  hermes: {
    id: "hermes",
    name: "Hermes",
    role: "协调与信息路由",
    shortRole: "Coordination",
    accent: "#c9541a",
    soft: "#fff0e8"
  }
};

export const JOURNAL_DATES = [
  { date: "2026-06-25", weekday: "Thu", label: "今天", theme: "融合版工作台" },
  { date: "2026-06-24", weekday: "Wed", label: "信息源沉淀", theme: "Source Garden" },
  { date: "2026-06-23", weekday: "Tue", label: "安全审计", theme: "Mission Debrief" },
  { date: "2026-06-22", weekday: "Mon", label: "三人并行", theme: "Editorial Ledger" },
  { date: "2026-06-21", weekday: "Sun", label: "周报预演", theme: "Weekly Preview" }
];

export const SOURCES = [
  {
    sourceId: "src-feishu-doc-daily",
    kind: "feishu_doc_mock",
    title: "飞书 Doc（Mock）：Agent 夜间同步",
    owner: "Wangdi",
    capturedAt: "2026-06-25T21:20:00+08:00",
    pathOrRef: "feishu-demo://doc/night-sync/2026-06-25",
    excerpt: "今天只预览写入段落，不调用飞书 API。Doc 负责保留可读叙事。",
    tags: ["feishu-mock", "daily", "narrative"],
    linkedAgentIds: ["codex", "claude_code", "hermes"],
    sensitivity: "internal"
  },
  {
    sourceId: "src-feishu-wiki-index",
    kind: "feishu_wiki_mock",
    title: "飞书 Wiki（Mock）：长期目录",
    owner: "Wangdi",
    capturedAt: "2026-06-25T21:22:00+08:00",
    pathOrRef: "feishu-demo://wiki/agent-work-journal",
    excerpt: "Wiki 只放索引和 SOP，不承载每日流水。每天的同步从本地投影生成。",
    tags: ["feishu-mock", "wiki", "index"],
    linkedAgentIds: ["hermes"],
    sensitivity: "internal"
  },
  {
    sourceId: "src-feishu-base-status",
    kind: "feishu_base_mock",
    title: "飞书 Base（Mock）：事件状态表",
    owner: "Wangdi",
    capturedAt: "2026-06-25T21:25:00+08:00",
    pathOrRef: "feishu-demo://base/agent-events",
    excerpt: "Base 适合状态、标签和检索，不适合取代阅读型日记。",
    tags: ["feishu-mock", "base", "status"],
    linkedAgentIds: ["codex", "claude_code", "hermes"],
    sensitivity: "internal"
  },
  {
    sourceId: "src-github-aionui",
    kind: "markdown_note",
    title: "竞品摘录：AionUi",
    owner: "local-research",
    capturedAt: "2026-06-25T03:10:00+08:00",
    pathOrRef: "local-demo://research/aionui",
    excerpt: "本地 cowork app 的方向很强，但它更像运行时工具，不是每日人格化同步。",
    tags: ["research", "github", "local-first"],
    linkedAgentIds: ["codex"],
    sensitivity: "public"
  },
  {
    sourceId: "src-github-vibe-kanban",
    kind: "markdown_note",
    title: "竞品摘录：vibe-kanban",
    owner: "local-research",
    capturedAt: "2026-06-25T03:14:00+08:00",
    pathOrRef: "local-demo://research/vibe-kanban",
    excerpt: "看板式 coding agent workspace 可以借鉴任务态，但本项目核心是 work journal。",
    tags: ["research", "kanban", "agents"],
    linkedAgentIds: ["claude_code"],
    sensitivity: "public"
  },
  {
    sourceId: "src-local-session-codex",
    kind: "local_session",
    title: "Codex 本地会话摘要（Mock）",
    owner: "codex",
    capturedAt: "2026-06-25T21:05:00+08:00",
    pathOrRef: "local-demo://sessions/codex-20260625",
    excerpt: "完成 demo 规格拆分、数据合同和可运行 UI 的本地验证计划。",
    tags: ["session", "codex", "handoff"],
    linkedAgentIds: ["codex"],
    sensitivity: "private"
  },
  {
    sourceId: "src-local-session-claude",
    kind: "local_session",
    title: "Claude Code 评审意见（Mock）",
    owner: "claude_code",
    capturedAt: "2026-06-25T21:10:00+08:00",
    pathOrRef: "local-demo://sessions/claude-code-20260625",
    excerpt: "建议事件日志必须支持幂等、冲突、隔离和 dry-run 审批。",
    tags: ["session", "architecture", "review"],
    linkedAgentIds: ["claude_code"],
    sensitivity: "private"
  },
  {
    sourceId: "src-local-session-hermes",
    kind: "local_session",
    title: "Hermes 路由草案（Mock）",
    owner: "hermes",
    capturedAt: "2026-06-25T21:12:00+08:00",
    pathOrRef: "local-demo://sessions/hermes-20260625",
    excerpt: "Hermes 可以先做汇总员，但每个 agent 保留自己的写作口吻和署名。",
    tags: ["session", "routing", "summary"],
    linkedAgentIds: ["hermes"],
    sensitivity: "private"
  },
  {
    sourceId: "src-local-log-redacted",
    kind: "local_log",
    title: "本地日志：脱敏样例",
    owner: "local-fixture",
    capturedAt: "2026-06-23T22:40:00+08:00",
    pathOrRef: "local-demo://logs/redacted-example",
    excerpt: "检测到形似 secret 的 mock 字符串，已在本地投影中替换为 [REDACTED]。",
    tags: ["safety", "redaction"],
    linkedAgentIds: ["codex", "hermes"],
    sensitivity: "secret"
  }
];

const baseEnvelope = {
  schemaVersion: "1.0",
  workspace: "agent-sync-demo",
  sourceInstance: "local-fixture"
};

function event({
  id,
  date,
  agent,
  type,
  time,
  state = "accepted",
  title,
  summary,
  details = "",
  status = "done",
  priority = "medium",
  tags = [],
  sourceIds = [],
  containsSecret = false,
  redactionStatus = "clean",
  evidencePreview = "",
  errorReason = "",
  parentEventId,
  // stance: how this entry relates to the entry it replies to.
  // "" (standalone) | "agree" | "disagree" | "build" (extends/qualifies)
  stance = ""
}) {
  return {
    ...baseEnvelope,
    eventId: id,
    idempotencyKey: `${agent}:${date}:${id}`,
    traceId: `trace-${date.replaceAll("-", "")}-${id}`,
    date,
    sourceAgent: agent,
    eventType: type,
    occurredAt: `${date}T${time}:00+08:00`,
    observedAt: `${date}T${time}:20+08:00`,
    state,
    payload: {
      title,
      summary,
      details,
      project: "Agent Work Journal",
      status,
      priority,
      tags,
      evidencePreview,
      errorReason,
      stance
    },
    privacy: {
      containsSecret,
      redactionStatus
    },
    sourceIds,
    parentEventId
  };
}

export const EVENTS = [
  event({
    id: "e2501",
    date: "2026-06-25",
    agent: "codex",
    type: "artifact",
    time: "20:40",
    title: "搭出本地高保真 demo",
    summary: "把三种视觉方向合成一个本地 first 工具：日期轨、三列 agent、纵向信息源和安全审计。",
    details: "先用 mock/local data 验证每天查看、按 agent 查看、写入同步、周报预览和 dry-run。",
    sourceIds: ["src-local-session-codex", "src-github-aionui"],
    tags: ["demo", "local-first", "ui"]
  }),
  event({
    id: "e2502",
    date: "2026-06-25",
    agent: "codex",
    type: "learning",
    time: "21:02",
    title: "飞书不适合承担全部交互",
    summary: "Doc 可读、Base 可检索、Wiki 可归档，但按天和按 agent 交叉查看最好放在本地 UI。",
    sourceIds: ["src-feishu-doc-daily", "src-feishu-base-status"],
    tags: ["feishu", "product"]
  }),
  event({
    id: "e2503",
    date: "2026-06-25",
    agent: "codex",
    type: "suggestion",
    time: "21:35",
    title: "明天补一个 JSONL intake",
    summary: "下一步应该让每个 agent 写入本地 jsonl，再由 UI 做投影，不急着接真实飞书。",
    status: "planned",
    sourceIds: ["src-local-session-codex"],
    tags: ["next", "backend"]
  }),
  event({
    id: "e2504",
    date: "2026-06-25",
    agent: "claude_code",
    type: "decision",
    time: "20:55",
    title: "事件日志是唯一真源",
    summary: "每日视图、周报、信息源、dry-run 都从事件列表投影生成，避免 UI 和飞书格式互相绑死。",
    details: "每条事件带 traceId、idempotencyKey、state 和 sourceIds，后续能接 CLI、MCP 或 Hermes 路由。",
    sourceIds: ["src-local-session-claude", "src-feishu-base-status"],
    tags: ["architecture", "projection"]
  }),
  event({
    id: "e2505",
    date: "2026-06-25",
    agent: "claude_code",
    type: "conflict",
    time: "21:18",
    state: "conflict",
    title: "Doc-only 与 Base-only 方案冲突",
    summary: "只用 Doc 会丢结构，只用 Base 会丢阅读体验；建议本地 UI 做主面板，飞书只做沉淀层。",
    status: "review",
    sourceIds: ["src-feishu-doc-daily", "src-feishu-base-status"],
    tags: ["conflict", "feishu"]
  }),
  event({
    id: "e2506",
    date: "2026-06-25",
    agent: "claude_code",
    type: "suggestion",
    time: "21:46",
    title: "把安全态做成显性产品能力",
    summary: "冲突、重复、隔离、脱敏不是后台细节，应该成为用户判断 agent 输出可信度的主界面。",
    sourceIds: ["src-local-session-claude"],
    tags: ["safety", "product"]
  }),
  event({
    id: "e2507",
    date: "2026-06-25",
    agent: "hermes",
    type: "handoff",
    time: "20:50",
    title: "三位 agent 各自署名",
    summary: "Hermes 可以统一汇总，但 Codex、Claude Code、Hermes 都保留自己的写作区和语气。",
    sourceIds: ["src-local-session-hermes"],
    tags: ["coordination", "voice"]
  }),
  event({
    id: "e2508",
    date: "2026-06-25",
    agent: "hermes",
    type: "sync_plan",
    time: "21:28",
    state: "pending_sync",
    title: "预览飞书 dry-run 写入",
    summary: "生成 Doc 段落、Wiki 索引位置和 Base 字段，但 externalCallsMade=false。",
    status: "review",
    sourceIds: ["src-feishu-doc-daily", "src-feishu-wiki-index", "src-feishu-base-status"],
    tags: ["dry-run", "feishu"]
  }),
  event({
    id: "e2509",
    date: "2026-06-25",
    agent: "hermes",
    type: "suggestion",
    time: "21:52",
    title: "每晚只同步经过审阅的段落",
    summary: "先本地聚合，再由用户确认哪些段落可进入飞书，避免把噪声长期沉淀。",
    sourceIds: ["src-local-session-hermes"],
    tags: ["review", "sync"]
  }),
  // --- Cross-agent threads: agents replying to and pushing back on each other ---
  event({
    id: "e2510",
    date: "2026-06-25",
    agent: "claude_code",
    type: "suggestion",
    time: "22:08",
    parentEventId: "e2503",
    stance: "disagree",
    title: "光有 JSONL intake 不够",
    summary: "Codex 的方向对，但如果不解决『把本地 transcript 自动喂进 UI』，它永远是漂亮 mock，不是工具。我建议把自动喂入排到 intake 前面。",
    details: "对 e2503 的回应：append-only 文件只是存储层，真正决定留存率的是『可读对话流是 coding 工作流的自动副产物』而不是手填日记。",
    sourceIds: ["src-local-session-claude"],
    tags: ["intake", "pushback", "retention"]
  }),
  event({
    id: "e2511",
    date: "2026-06-25",
    agent: "hermes",
    type: "decision",
    time: "22:20",
    parentEventId: "e2510",
    stance: "build",
    title: "两步都要，但先冻结格式",
    summary: "同意 Claude 的优先级——自动喂入是品类生死线。但落地前必须先把交接格式冻结成 spec，否则三个 agent 各写各的 schema，合不到一起。",
    details: "对 e2510 的回应：先有命名的开放交接格式，再谈自动喂入和真实对话，否则越接越乱。",
    sourceIds: ["src-local-session-hermes", "src-feishu-base-status"],
    tags: ["format", "spec", "coordination"]
  }),
  event({
    id: "e2512",
    date: "2026-06-25",
    agent: "hermes",
    type: "suggestion",
    time: "22:34",
    parentEventId: "e2506",
    stance: "disagree",
    title: "安全态不该抢主界面",
    summary: "Claude 想把冲突/隔离/脱敏做成主界面，我反对：那是后台可信度，不是用户每晚回来读的理由。主舞台应该是 agent 之间的判断和分歧本身。",
    details: "对 e2506 的回应：把 Safety 收进次级视图，让『谁不同意谁、为什么』占据头条。",
    sourceIds: ["src-local-session-hermes"],
    tags: ["product", "focus", "pushback"]
  }),
  event({
    id: "e2401",
    date: "2026-06-24",
    agent: "codex",
    type: "source_captured",
    time: "19:30",
    title: "整理 GitHub 竞品索引",
    summary: "把 AionUi、vibe-kanban、Agent Teams AI 和 CrewAI 分成 runtime、workspace、orchestration 三类。",
    sourceIds: ["src-github-aionui", "src-github-vibe-kanban"],
    tags: ["research", "github"]
  }),
  event({
    id: "e2402",
    date: "2026-06-24",
    agent: "claude_code",
    type: "learning",
    time: "20:00",
    title: "竞品强在执行，弱在日记",
    summary: "多数项目解决 agent 怎么跑，不解决每天怎么被人读懂、复盘和留下判断。",
    sourceIds: ["src-github-vibe-kanban"],
    tags: ["positioning"]
  }),
  event({
    id: "e2403",
    date: "2026-06-24",
    agent: "hermes",
    type: "sync_request",
    time: "20:40",
    state: "duplicate",
    title: "重复的 Feishu Doc 写入请求",
    summary: "同一 date + agent + title 的同步请求被幂等键识别，保留第一条。",
    sourceIds: ["src-feishu-doc-daily"],
    tags: ["idempotency", "safety"],
    parentEventId: "e2508"
  }),
  event({
    id: "e2404",
    date: "2026-06-24",
    agent: "hermes",
    type: "suggestion",
    time: "21:10",
    title: "信息源先入库，观点后成文",
    summary: "好的链接、项目、日志先成为 SourceRecord；agent 再围绕这些 source 写自己的判断。",
    sourceIds: ["src-feishu-wiki-index"],
    tags: ["source-index"]
  }),
  event({
    id: "e2301",
    date: "2026-06-23",
    agent: "codex",
    type: "task_update",
    time: "18:45",
    title: "补齐本地-only 审计提示",
    summary: "所有 dry-run UI 都显示没有调用外部 API，没有创建定时任务，没有发布 GitHub。",
    sourceIds: ["src-local-log-redacted"],
    tags: ["safety", "local-only"]
  }),
  event({
    id: "e2302",
    date: "2026-06-23",
    agent: "codex",
    type: "quarantined",
    time: "20:20",
    state: "redacted",
    title: "本地 mock secret 已脱敏",
    summary: "检测到形似 api_key 的 mock 文本，界面只显示 [REDACTED]。",
    status: "review",
    containsSecret: true,
    redactionStatus: "redacted",
    sourceIds: ["src-local-log-redacted"],
    tags: ["redaction", "secret"]
  }),
  event({
    id: "e2303",
    date: "2026-06-23",
    agent: "claude_code",
    type: "quarantined",
    time: "20:32",
    state: "quarantined",
    title: "schemaVersion 缺失",
    summary: "一条 future-cli 事件缺少 schemaVersion，已隔离，不进入日报正文。",
    status: "blocked",
    errorReason: "schemaVersion is required",
    sourceIds: ["src-feishu-base-status"],
    tags: ["schema", "quarantine"]
  }),
  event({
    id: "e2304",
    date: "2026-06-23",
    agent: "hermes",
    type: "sync_plan",
    time: "21:10",
    state: "failed",
    title: "模拟 sync plan 失败",
    summary: "dry-run 生成时缺少 Wiki placement，失败只影响预览，不会写外部系统。",
    status: "blocked",
    errorReason: "Missing mock wiki placement",
    sourceIds: ["src-feishu-wiki-index"],
    tags: ["dry-run", "recoverable"]
  }),
  event({
    id: "e2201",
    date: "2026-06-22",
    agent: "codex",
    type: "task_update",
    time: "19:00",
    title: "定义三列日报骨架",
    summary: "每个 agent 固定展示 Done、Learned、Tomorrow、Blockers 和 Trace/Sources。",
    sourceIds: ["src-local-session-codex"],
    tags: ["layout"]
  }),
  event({
    id: "e2202",
    date: "2026-06-22",
    agent: "claude_code",
    type: "decision",
    time: "19:40",
    title: "不把 agent 当工具按钮",
    summary: "每个 agent 是写作的人，要有署名、判断、语气和可回看的长线记录。",
    sourceIds: ["src-local-session-claude"],
    tags: ["voice", "product"]
  }),
  event({
    id: "e2203",
    date: "2026-06-22",
    agent: "hermes",
    type: "handoff",
    time: "20:25",
    title: "统一夜间汇总节奏",
    summary: "Hermes 收拢三方输出，给出明日建议和周报候选段落。",
    sourceIds: ["src-local-session-hermes"],
    tags: ["nightly", "summary"]
  }),
  event({
    id: "e2101",
    date: "2026-06-21",
    agent: "codex",
    type: "learning",
    time: "18:20",
    title: "周报应从日记自然长出来",
    summary: "不要另写一套周报表单，直接用每日 event 投影出 wins、learnings、risks、next actions。",
    sourceIds: ["src-feishu-doc-daily"],
    tags: ["weekly"]
  }),
  event({
    id: "e2102",
    date: "2026-06-21",
    agent: "claude_code",
    type: "suggestion",
    time: "19:10",
    title: "周报必须保留风险段",
    summary: "有冲突和隔离不是坏事，坏事是把它们藏起来。周报要显示未解决判断。",
    sourceIds: ["src-feishu-base-status"],
    tags: ["weekly", "risk"]
  }),
  event({
    id: "e2103",
    date: "2026-06-21",
    agent: "hermes",
    type: "artifact",
    time: "20:00",
    title: "准备周报预览骨架",
    summary: "按 wins、learnings、risks、next actions 生成可复制段落，仍只在本地展示。",
    sourceIds: ["src-feishu-wiki-index"],
    tags: ["weekly", "draft"]
  })
];
