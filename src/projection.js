import { AGENTS, EVENTS, JOURNAL_DATES, SOURCES } from "./data.js";

const stateWeights = {
  accepted: 1,
  pending_sync: 0.8,
  duplicate: 0.65,
  conflict: 0.45,
  redacted: 0.5,
  quarantined: 0.2,
  failed: 0.15
};

export function getEvents() {
  return EVENTS;
}

export function getSources() {
  return SOURCES;
}

export function sourceById(id) {
  return SOURCES.find((source) => source.sourceId === id);
}

export function agentMeta(agentId) {
  return AGENTS[agentId];
}

export function dates() {
  return JOURNAL_DATES;
}

export function eventsForDate(date, sourceEvents = EVENTS) {
  return sourceEvents
    .filter((event) => event.date === date)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function classify(event) {
  const type = event.eventType;
  if (["artifact", "task_update", "decision", "source_captured", "handoff"].includes(type)) return "done";
  if (type === "learning") return "learned";
  if (type === "suggestion" || type === "sync_plan") return "tomorrow";
  if (["blocked", "conflict", "quarantined"].includes(type) || ["conflict", "quarantined", "failed", "redacted"].includes(event.state)) return "blockers";
  return "done";
}

function pushLimited(list, value) {
  if (!list.includes(value)) list.push(value);
}

function agentProjection(agentId, dayEvents) {
  const meta = AGENTS[agentId];
  const ownEvents = dayEvents.filter((event) => event.sourceAgent === agentId);
  const projection = {
    agentId,
    name: meta.name,
    role: meta.role,
    accent: meta.accent,
    done: [],
    learned: [],
    tomorrow: [],
    blockers: [],
    sourceIds: [],
    events: ownEvents.map((event) => event.eventId)
  };

  ownEvents.forEach((event) => {
    const bucket = classify(event);
    const line = event.payload.summary;
    if (bucket === "done") pushLimited(projection.done, line);
    if (bucket === "learned") pushLimited(projection.learned, line);
    if (bucket === "tomorrow") pushLimited(projection.tomorrow, line);
    if (bucket === "blockers") pushLimited(projection.blockers, line);
    event.sourceIds.forEach((sourceId) => pushLimited(projection.sourceIds, sourceId));
  });

  if (projection.done.length === 0) projection.done.push("今天没有 accepted 的完成项，保留空白以避免伪造同步。");
  if (projection.learned.length === 0) projection.learned.push("今天还没有写入新的学习条目。");
  if (projection.tomorrow.length === 0) projection.tomorrow.push("明天建议从未解决项和信息源补齐开始。");
  if (projection.blockers.length === 0) projection.blockers.push("无明确阻塞。");

  return projection;
}

function conversation(dayEvents) {
  return dayEvents.map((event) => ({
    id: `conv-${event.eventId}`,
    date: event.date,
    time: event.occurredAt.slice(11, 16),
    agentId: event.sourceAgent,
    kind: event.eventType === "handoff" ? "handoff" : event.eventType === "decision" ? "decision" : event.eventType === "sync_plan" ? "sync" : event.eventType === "conflict" ? "question" : "note",
    text: `${event.payload.title}：${event.payload.summary}`,
    sourceIds: event.sourceIds
  }));
}

// Build EXPLICIT cross-agent threads: an entry that replies to another entry (via
// parentEventId) forms a chain. We surface only chains where two or more
// different agents take part — agents referencing and pushing back on each other.
// These only exist in the seed demo (real ingested events carry no parentEventId).
function buildExplicitThreads(dayEvents) {
  const byId = new Map(dayEvents.map((event) => [event.eventId, event]));
  const childrenOf = new Map();
  const isReply = new Set();
  dayEvents.forEach((event) => {
    if (event.parentEventId && byId.has(event.parentEventId)) {
      isReply.add(event.eventId);
      if (!childrenOf.has(event.parentEventId)) childrenOf.set(event.parentEventId, []);
      childrenOf.get(event.parentEventId).push(event);
    }
  });

  const node = (event, isRoot) => ({
    eventId: event.eventId,
    agentId: event.sourceAgent,
    name: AGENTS[event.sourceAgent].name,
    accent: AGENTS[event.sourceAgent].accent,
    time: event.occurredAt.slice(11, 16),
    stance: event.payload.stance || (isRoot ? "open" : ""),
    title: event.payload.title,
    summary: event.payload.summary
  });

  const collect = (event, isRoot) => {
    const out = [node(event, isRoot)];
    (childrenOf.get(event.eventId) || [])
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .forEach((child) => out.push(...collect(child, false)));
    return out;
  };

  const roots = dayEvents.filter((event) => childrenOf.has(event.eventId) && !isReply.has(event.eventId));

  return roots
    .map((root) => {
      const nodes = collect(root, true);
      const participants = [...new Set(nodes.map((entry) => entry.agentId))];
      return {
        rootId: root.eventId,
        topic: root.payload.title,
        nodes,
        participantCount: participants.length,
        hasDisagreement: nodes.some((entry) => entry.stance === "disagree"),
        time: nodes[0].time
      };
    })
    .filter((thread) => thread.participantCount >= 2)
    .sort((a, b) => (b.hasDisagreement ? 1 : 0) - (a.hasDisagreement ? 1 : 0) || a.time.localeCompare(b.time));
}

// Build IMPLICIT threads from REAL data: when 2+ agents worked the same project on
// the same day, that co-working relationship objectively exists — we surface it
// honestly (neutral "co_worked" stance), never inventing a disagreement.
function buildImplicitThreads(dayEvents) {
  const real = dayEvents.filter(
    (event) => event.sourceInstance === "local-import" &&
      event.payload.project &&
      event.payload.project !== "后台 / 杂项"
  );
  const byProject = new Map();
  real.forEach((event) => {
    const p = event.payload.project;
    if (!byProject.has(p)) byProject.set(p, []);
    byProject.get(p).push(event);
  });

  const threads = [];
  for (const [project, evs] of byProject) {
    const agents = [...new Set(evs.map((e) => e.sourceAgent))];
    if (agents.length < 2) continue;
    // One representative entry per agent (the most substantive), so a co-work
    // thread reads as "who worked on this", not a flood of near-duplicate lines.
    const repByAgent = new Map();
    for (const e of evs) {
      const cur = repByAgent.get(e.sourceAgent);
      if (!cur || (e.payload.summary || "").length > (cur.payload.summary || "").length) {
        repByAgent.set(e.sourceAgent, e);
      }
    }
    const reps = [...repByAgent.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const nodes = reps.map((event, index) => ({
      eventId: event.eventId,
      agentId: event.sourceAgent,
      name: AGENTS[event.sourceAgent].name,
      accent: AGENTS[event.sourceAgent].accent,
      time: event.occurredAt.slice(11, 16),
      stance: index === 0 ? "open" : "co_worked",
      title: event.payload.title,
      summary: event.payload.summary
    }));
    threads.push({
      rootId: `implicit-${project}`,
      topic: project,
      nodes,
      participantCount: reps.length,
      hasDisagreement: false,
      implicit: true,
      demo: false,
      time: nodes[0].time
    });
  }
  return threads.sort((a, b) => b.participantCount - a.participantCount || a.topic.localeCompare(b.topic));
}

// Combined: real co-working threads first (the everyday signal), then the seed
// demo's full-blooded disagreement threads (clearly flagged demo in the UI).
function buildThreads(dayEvents) {
  const implicit = buildImplicitThreads(dayEvents);
  const explicit = buildExplicitThreads(dayEvents).map((thread) => ({ ...thread, implicit: false, demo: true }));
  return [...implicit, ...explicit];
}

function safety(dayEvents) {
  const counts = {
    accepted: 0,
    duplicates: 0,
    conflicts: 0,
    quarantined: 0,
    redacted: 0,
    pendingSync: 0
  };

  const items = dayEvents
    .filter((event) => event.state !== "accepted")
    .map((event) => {
      if (event.state === "duplicate") counts.duplicates += 1;
      if (event.state === "conflict") counts.conflicts += 1;
      if (event.state === "quarantined") counts.quarantined += 1;
      if (event.state === "redacted") counts.redacted += 1;
      if (event.state === "pending_sync") counts.pendingSync += 1;
      if (event.state === "failed") counts.quarantined += 1;
      return {
        id: `safety-${event.eventId}`,
        state: event.state,
        title: event.payload.title,
        explanation: safetyExplanation(event),
        traceId: event.traceId,
        eventId: event.eventId
      };
    });

  counts.accepted = dayEvents.filter((event) => event.state === "accepted").length;
  return { ...counts, items };
}

function safetyExplanation(event) {
  if (event.state === "duplicate") return "幂等键命中，重复事件被忽略，只保留第一条可读记录。";
  if (event.state === "conflict") return "多个 agent 对同一决策给出不同建议，需要用户确认后再沉淀。";
  if (event.state === "quarantined") return `schema 校验失败，原因：${event.payload.errorReason || "未知字段错误"}。`;
  if (event.state === "redacted") return "检测到形似 secret 的 mock 文本，已本地脱敏，不展示原值。";
  if (event.state === "pending_sync") return "仅进入 dry-run 队列，没有调用飞书 API。";
  if (event.state === "failed") return `模拟失败：${event.payload.errorReason || "可恢复错误"}。`;
  return "已记录为非标准状态，等待人工确认。";
}

export function buildDailyProjection(date, sourceEvents = EVENTS) {
  const dayEvents = eventsForDate(date, sourceEvents);
  const dayMeta = JOURNAL_DATES.find((item) => item.date === date) || { theme: "每日同步" };
  const unresolvedCount = dayEvents.filter((event) => ["conflict", "quarantined", "failed", "redacted"].includes(event.state)).length;
  const syncCompleteness = dayEvents.length
    ? Math.round((dayEvents.reduce((sum, event) => sum + (stateWeights[event.state] || 0.5), 0) / dayEvents.length) * 100)
    : 0;
  const sourceIds = [...new Set(dayEvents.flatMap((event) => event.sourceIds))];
  const dateText = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date(`${date}T12:00:00+08:00`));

  return {
    date,
    title: `${dateText} · ${dayMeta.theme}`,
    summary: summarizeDay(dayEvents),
    syncCompleteness,
    unresolvedCount,
    localStoreHealth: unresolvedCount >= 3 ? "warning" : "healthy",
    dryRunSyncState: dayEvents.some((event) => event.state === "pending_sync") ? "pending" : "ready",
    agents: Object.keys(AGENTS).map((agentId) => agentProjection(agentId, dayEvents)),
    conversation: conversation(dayEvents),
    threads: buildThreads(dayEvents),
    sourceIds,
    safety: safety(dayEvents)
  };
}

function summarizeDay(dayEvents) {
  if (dayEvents.length === 0) return "今天还没有同步，等待本地 mock 写入。";
  const accepted = dayEvents.filter((event) => event.state === "accepted").length;
  const pending = dayEvents.filter((event) => event.state === "pending_sync").length;
  const conflicts = dayEvents.filter((event) => event.state === "conflict").length;
  return `共 ${dayEvents.length} 条本地事件，${accepted} 条进入日报正文，${pending} 条等待 dry-run 预览，${conflicts} 条需要判断。`;
}

export function buildWeeklyPreview(selectedDate, sourceEvents = EVENTS) {
  const selectedIndex = JOURNAL_DATES.findIndex((item) => item.date === selectedDate);
  const weekDates = JOURNAL_DATES.slice(Math.max(0, selectedIndex), selectedIndex + 5).map((item) => item.date);
  const events = sourceEvents.filter((event) => weekDates.includes(event.date));
  const wins = events.filter((event) => ["artifact", "task_update", "decision", "handoff", "source_captured"].includes(event.eventType) && event.state === "accepted").slice(0, 5);
  const learnings = events.filter((event) => event.eventType === "learning").slice(0, 5);
  const risks = events.filter((event) => ["conflict", "quarantined", "redacted", "failed"].includes(event.state)).slice(0, 5);
  const next = events.filter((event) => ["suggestion", "sync_plan"].includes(event.eventType)).slice(0, 5);

  return {
    range: `${weekDates[weekDates.length - 1] || selectedDate} 至 ${weekDates[0] || selectedDate}`,
    wins: wins.map((event) => `${AGENTS[event.sourceAgent].name}: ${event.payload.title}`),
    learnings: learnings.map((event) => `${AGENTS[event.sourceAgent].name}: ${event.payload.summary}`),
    risks: risks.map((event) => `${stateLabel(event.state)}: ${event.payload.title}`),
    nextActions: next.map((event) => `${AGENTS[event.sourceAgent].name}: ${event.payload.summary}`)
  };
}

export function buildDryRunSyncPlan(date, sourceEvents = EVENTS) {
  const daily = buildDailyProjection(date, sourceEvents);
  const weekly = buildWeeklyPreview(date, sourceEvents);
  return {
    id: `dry-run-${date}`,
    date,
    status: daily.dryRunSyncState === "pending" ? "pending" : "draft",
    externalCallsMade: false,
    targets: [
      {
        target: "feishu_doc_mock",
        title: "飞书 Doc 段落预览",
        mode: "append",
        preview: `${daily.title}\n${daily.summary}\n\n${daily.agents.map((agent) => `${agent.name}: ${agent.done[0]}`).join("\n")}`
      },
      {
        target: "feishu_wiki_mock",
        title: "飞书 Wiki 放置位置",
        mode: "place_after_section",
        preview: `Agent Work Journal / ${date} / ${daily.unresolvedCount ? "Needs Review" : "Daily Notes"}`
      },
      {
        target: "feishu_base_mock",
        title: "飞书 Base 字段预览",
        mode: "upsert",
        preview: "按 date + agent + eventId upsert。本地模拟，不写入外部系统。",
        fields: {
          Date: date,
          Completeness: `${daily.syncCompleteness}%`,
          Events: String(eventsForDate(date, sourceEvents).length),
          "Unresolved": String(daily.unresolvedCount),
          "Weekly Range": weekly.range
        }
      }
    ]
  };
}

export function stateLabel(state) {
  const labels = {
    accepted: "Accepted",
    duplicate: "Duplicate ignored",
    conflict: "Conflict",
    quarantined: "Quarantined",
    redacted: "Redacted",
    pending_sync: "Pending dry-run",
    failed: "Recoverable failure"
  };
  return labels[state] || state;
}
