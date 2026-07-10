import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertNoForbiddenText,
  buildQualityAudit,
  buildRecentReport,
  classifyEvent,
  readJsonl,
  renderQualityMarkdown,
  renderRecentMarkdown
} from "./report-quality.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const LOCAL_EVENTS = resolve(ROOT, "data/events.local.jsonl");

function event({
  id,
  date,
  agent = "codex",
  project,
  summary,
  type = "task_update",
  state = "accepted",
  parentEventId = "",
  stance = ""
}) {
  return {
    schemaVersion: "1.0",
    eventId: id,
    idempotencyKey: `${agent}:${date}:${id}`,
    traceId: `trace-${id}`,
    date,
    sourceAgent: agent,
    sourceInstance: "local-fixture",
    workspace: "daybook-quality-fixture",
    eventType: type,
    occurredAt: `${date}T10:00:00+08:00`,
    observedAt: `${date}T10:00:05+08:00`,
    state,
    parentEventId,
    payload: {
      title: project,
      summary,
      details: "",
      project,
      status: "done",
      priority: "medium",
      tags: [],
      evidencePreview: "",
      stance
    },
    privacy: { containsSecret: false, redactionStatus: "clean" },
    sourceIds: []
  };
}

const fixture = [
  event({
    id: "latestSparseHistoryRich-001",
    date: "2026-06-08",
    project: "daybook",
    summary: "补充质量审计入口，避免最新一天记录很少时误判为日报完成。"
  }),
  event({
    id: "promptNoise-001",
    date: "2026-06-08",
    project: "daybook",
    summary: "read the full prompt from stdin and inspect environment_context"
  }),
  event({
    id: "secretAdjacent-001",
    date: "2026-06-07",
    project: "hermes",
    summary: "配置时出现 API key 和 model id，需要过滤出报告正文。"
  }),
  event({
    id: "sharedTouch-001",
    date: "2026-06-07",
    agent: "codex",
    project: "hermes",
    summary: "审计 Hermes 用量统计和本地报告口径。"
  }),
  event({
    id: "sharedTouch-002",
    date: "2026-06-07",
    agent: "hermes",
    project: "hermes",
    summary: "沉淀 Hermes 复盘规则和下一步配置检查。"
  }),
  event({
    id: "realDisagreement-root",
    date: "2026-06-06",
    agent: "codex",
    project: "agent协同",
    summary: "报告排序先按有效事件数和项目覆盖来定。"
  }),
  event({
    id: "realDisagreement-reply",
    date: "2026-06-06",
    agent: "claude_code",
    project: "agent协同",
    summary: "不同意只看数量，风险和明确分歧也要排到前面。",
    type: "conflict",
    parentEventId: "realDisagreement-root",
    stance: "disagree"
  }),
  event({
    id: "project-obs",
    date: "2026-06-05",
    agent: "codex",
    project: "obs",
    summary: "核对 OBS 里的 Caffline 数据来源和对外表述。"
  }),
  event({
    id: "project-web",
    date: "2026-06-04",
    agent: "claude_code",
    project: "动态网站",
    summary: "调整动态网站的页面交付和本地预览验证。"
  }),
  event({
    id: "project-video",
    date: "2026-06-03",
    agent: "codex",
    project: "video-maker-engine",
    summary: "检查视频生成工具的构建输出和运行状态。"
  }),
  event({
    id: "project-skills",
    date: "2026-06-02",
    agent: "hermes",
    project: "skills",
    summary: "沉淀多 agent 协作流程里的可复用规则。"
  }),
  event({
    id: "project-kline",
    date: "2026-06-01",
    agent: "codex",
    project: "人生K线",
    summary: "整理人生 K 线项目资料和下一步表达结构。"
  }),
  event({
    id: "summaryEqualsProject-001",
    date: "2026-06-01",
    project: "0-40",
    summary: "0-40"
  }),
  event({
    id: "emptyNonHuman-001",
    date: "2026-06-01",
    project: "每日复利系统",
    summary: "say ok"
  })
];

const audit = buildQualityAudit(fixture, { minTotalEvents: 1, minActiveDates: 1 });
assert.equal(audit.latestDate, "2026-06-08", "fixture latest date");
assert.equal(audit.latestDay.projectCount, 1, "latest day has one useful project");
assert.equal(audit.latestDay.sparse, true, "latest day is sparse");
assert.equal(audit.recommendation, "recent-active-days", "sparse latest day cannot recommend daily");

const reasons = new Set(audit.funnel.filterReasons.map((entry) => entry.reason));
for (const reason of [
  "folded noise project",
  "prompt scaffold",
  "secret-adjacent text",
  "summary equals project/title",
  "empty or non-human text"
]) {
  assert.ok(reasons.has(reason), `filter reason exists: ${reason}`);
}
assert.equal(classifyEvent(fixture.find((entry) => entry.eventId === "promptNoise-001")).reason, "prompt scaffold");
assert.equal(classifyEvent(fixture.find((entry) => entry.eventId === "secretAdjacent-001")).reason, "secret-adjacent text");
assert.equal(classifyEvent(fixture.find((entry) => entry.eventId === "summaryEqualsProject-001")).reason, "summary equals project/title");
assert.equal(classifyEvent(fixture.find((entry) => entry.eventId === "emptyNonHuman-001")).reason, "empty or non-human text");

const recent = buildRecentReport(fixture);
assert.ok(recent.projectCount >= 5, "recent range has 5+ projects");
assert.ok(recent.sharedProjects.some((project) => project.project === "hermes"), "shared touch is surfaced");
assert.ok(recent.disagreementProjects.some((project) => project.project === "agent协同"), "real disagreement is surfaced");

const qualityMarkdown = renderQualityMarkdown(audit);
const recentMarkdown = renderRecentMarkdown(recent);
assertNoForbiddenText(`${JSON.stringify(audit)}\n${qualityMarkdown}\n${JSON.stringify(recent)}\n${recentMarkdown}`);
for (const heading of [
  "## 项目推进图谱",
  "## 多 Agent 共同触达",
  "## 真实分歧",
  "## 需要用户介入",
  "## 下周 / 明天建议",
  "## 证据计数"
]) {
  assert.ok(recentMarkdown.includes(heading), `recent markdown heading: ${heading}`);
}

if (existsSync(LOCAL_EVENTS)) {
  const localEvents = readJsonl(LOCAL_EVENTS);
  const localAudit = buildQualityAudit(localEvents);
  assert.ok(localAudit.totalEvents >= 1000, "local audit reads the full event file");
  assert.ok(localAudit.activeDateCount >= 30, "local audit has 30+ active dates");
  assert.ok(localAudit.scannedActiveDates >= 20, "local audit scans at least 20 active dates");
  assert.ok(localAudit.topProjects.length >= 5, "local audit finds at least 5 projects");
  if (localAudit.latestDay.projectCount < 3 || localAudit.latestDay.usefulEvents < 5) {
    assert.notEqual(localAudit.recommendation, "daily", "sparse local latest day cannot recommend daily");
  }
  assertNoForbiddenText(`${JSON.stringify(localAudit)}\n${renderQualityMarkdown(localAudit)}`);

  const localRecent = buildRecentReport(localEvents);
  assert.ok(localRecent.scannedActiveDates >= 7, "recent report scans at least 7 active dates");
  assert.ok(localRecent.projectCount >= 5, "recent report finds 5+ projects");
  assert.ok(localRecent.topProjects.every((project) => project.evidencePreview.length <= 3), "preview limit per project");
  assertNoForbiddenText(`${JSON.stringify(localRecent)}\n${renderRecentMarkdown(localRecent)}`);
}

console.log("check-report-quality: quality audit and recent report checks passed");
