import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EVENTS, JOURNAL_DATES, SOURCES } from "../src/data.js";
import {
  buildDailyProjection,
  buildDailyReport,
  buildDryRunSyncPlan,
  buildWeeklyPreview,
  displayLine,
  isDisplayNoise
} from "../src/projection.js";
import { buildHumanReport, renderMarkdown } from "./generate-human-report.mjs";

assert.ok(JOURNAL_DATES.length >= 5, "at least 5 dates");

const agentIds = ["codex", "claude_code", "hermes"];
const completeDates = JOURNAL_DATES.filter((day) => {
  const agentsForDay = new Set(EVENTS.filter((event) => event.date === day.date).map((event) => event.sourceAgent));
  return agentIds.every((agentId) => agentsForDay.has(agentId));
});
assert.ok(completeDates.length >= 3, "all agents appear on at least 3 dates");

for (const requiredState of ["accepted", "duplicate", "conflict", "quarantined", "redacted", "pending_sync", "failed"]) {
  assert.ok(EVENTS.some((event) => event.state === requiredState), `state fixture: ${requiredState}`);
}

for (const requiredKind of ["feishu_doc_mock", "feishu_wiki_mock", "feishu_base_mock"]) {
  assert.ok(SOURCES.some((source) => source.kind === requiredKind), `source kind: ${requiredKind}`);
}

SOURCES.filter((source) => source.kind.startsWith("feishu")).forEach((source) => {
  assert.ok(source.pathOrRef.startsWith("feishu-demo://"), `mock Feishu ref: ${source.sourceId}`);
});

const daily = buildDailyProjection("2026-06-25");
assert.equal(daily.agents.length, 3, "daily has 3 agents");
assert.ok(daily.sourceIds.length >= 3, "daily source index");
assert.ok(daily.conversation.length >= 3, "daily conversation");

const weekly = buildWeeklyPreview("2026-06-25");
assert.ok(weekly.wins.length > 0, "weekly wins");
assert.ok(weekly.nextActions.length > 0, "weekly next actions");

const dryRun = buildDryRunSyncPlan("2026-06-25");
assert.equal(dryRun.externalCallsMade, false, "dry-run makes no external calls");
assert.equal(dryRun.targets.length, 3, "dry-run has doc/wiki/base targets");

const noisyEvent = {
  schemaVersion: "1.0",
  eventId: "noise-1",
  idempotencyKey: "claude_code:2026-06-27:noise-1",
  traceId: "trace-noise-1",
  date: "2026-06-27",
  sourceAgent: "claude_code",
  sourceInstance: "local-import",
  workspace: "daybook-local",
  eventType: "task_update",
  occurredAt: "2026-06-27T06:32:00+08:00",
  observedAt: "2026-06-27T06:32:05+08:00",
  state: "accepted",
  payload: {
    title: "后台 / 杂项",
    summary: "Read the full prompt from stdin and execute it carefully. Follow all safety gates.",
    project: "后台 / 杂项",
    sessionCount: 1
  },
  privacy: { containsSecret: false, redactionStatus: "clean" },
  sourceIds: []
};
const realEvent = {
  ...noisyEvent,
  eventId: "real-1",
  idempotencyKey: "codex:2026-06-27:real-1",
  sourceAgent: "codex",
  payload: {
    ...noisyEvent.payload,
    title: "agent协同",
    summary: "看当前 daybook 项目推进到哪里，并对比本地与 GitHub 分支。",
    project: "agent协同"
  }
};
assert.equal(isDisplayNoise(noisyEvent), true, "folded backend bucket is display noise");
assert.equal(displayLine(noisyEvent), "", "scaffold prompt is hidden from report text");
assert.equal(isDisplayNoise(realEvent), false, "real project event remains visible");
assert.equal(displayLine({
  ...realEvent,
  eventId: "sensitive-context",
  payload: { ...realEvent.payload, summary: "我先发你 API key，以下分别是 model id 和 API key。" }
}), "", "secret-adjacent instructions stay out of the main report");
const realReport = buildDailyReport("2026-06-27", [noisyEvent, realEvent]);
assert.equal(realReport.sections.length, 1, "report only includes meaningful agent sections");
assert.ok(realReport.sections[0].done.some((line) => line.includes("daybook 项目")), "real summary survives report filtering");

const hermesAudit = {
  ...realEvent,
  eventId: "human-hermes-codex",
  idempotencyKey: "codex:2026-06-27:human-hermes-codex",
  sourceAgent: "codex",
  eventType: "blocked",
  payload: {
    ...realEvent.payload,
    title: "hermes",
    summary: "请帮我做一次 Hermes 最近 3 天的调用次数和 token 消耗审计，用来判断计费方案。",
    project: "hermes"
  }
};
const hermesLearning = {
  ...realEvent,
  eventId: "human-hermes-learning",
  idempotencyKey: "hermes:2026-06-27:human-hermes-learning",
  sourceAgent: "hermes",
  eventType: "learning",
  payload: {
    ...realEvent.payload,
    title: "hermes",
    summary: "新增 failure learning 记录和周复盘入口，把重复失败变成可执行规则。",
    project: "hermes"
  }
};
const hermesNext = {
  ...realEvent,
  eventId: "human-hermes-next",
  idempotencyKey: "hermes:2026-06-27:human-hermes-next",
  sourceAgent: "hermes",
  eventType: "suggestion",
  payload: {
    ...realEvent.payload,
    title: "hermes",
    summary: "下一步继续收敛 Hermes 使用量审计，给出更明确的 plan 选择建议。",
    project: "hermes"
  }
};
const disagreementRoot = {
  ...realEvent,
  eventId: "human-agent-root",
  idempotencyKey: "codex:2026-06-27:human-agent-root",
  sourceAgent: "codex",
  eventType: "decision",
  payload: {
    ...realEvent.payload,
    title: "agent协同",
    summary: "日报项目排序先看有效事件数，再看协作和风险。",
    project: "agent协同"
  }
};
const disagreementReply = {
  ...realEvent,
  eventId: "human-agent-disagree",
  idempotencyKey: "claude_code:2026-06-27:human-agent-disagree",
  sourceAgent: "claude_code",
  parentEventId: "human-agent-root",
  eventType: "conflict",
  payload: {
    ...realEvent.payload,
    title: "agent协同",
    summary: "不同意只按事件数排序，风险和真实分歧也要浮上来。",
    project: "agent协同",
    stance: "disagree"
  }
};
const secretAdjacent = {
  ...realEvent,
  eventId: "human-secret-adjacent",
  idempotencyKey: "codex:2026-06-27:human-secret-adjacent",
  payload: {
    ...realEvent.payload,
    title: "hermes",
    summary: "我先发你 API key，以下分别是 model id 和 API key。",
    project: "hermes"
  }
};
const humanReport = buildHumanReport("2026-06-27", [
  noisyEvent,
  realEvent,
  hermesAudit,
  hermesLearning,
  hermesNext,
  disagreementRoot,
  disagreementReply,
  secretAdjacent
]);
const humanMarkdown = renderMarkdown(humanReport);
assert.equal(humanReport.externalCallsMade, false, "human report top-level external call flag");
assert.equal(humanReport.evidence.externalCallsMade, false, "human report evidence external call flag");
assert.ok(humanReport.items.length >= 2, "human report groups projects");
assert.ok(humanReport.items.every((item) => item.agentActions.length <= 3), "human report caps project actions");
assert.ok(humanReport.items.every((item) => Array.isArray(item.todayProgress) && item.evidenceCount > 0), "human project carries structured progress and evidence");
assert.ok(humanReport.items.some((item) => item.collaborationLabel === "共同触达"), "human report marks shared-touch projects");
assert.ok(humanReport.items.some((item) => item.collaborationLabel === "真实分歧"), "human report marks explicit disagreements only from parent + disagree");
["## 按项目看", "## 按 agent 看", "## 需要继续确认", "## 明天可以接着做", "## 证据计数", "今日推进", "关键判断", "明天注意", "需要用户介入", "外部写入：0"].forEach((needle) => {
  assert.ok(humanMarkdown.includes(needle), `human markdown includes ${needle}`);
});
assert.doesNotMatch(
  `${JSON.stringify(humanReport)}\n${humanMarkdown}`,
  /你让我|你发现|请帮我|我把|我确认|API key|model id|bearer token|system-reminder|environment_context|read the full prompt from stdin|提示词|prompt/i,
  "human report excludes prompt-like and secret-adjacent text"
);

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
assert.ok(appSource.includes("JOURNAL_STORAGE_KEY"), "browser local journal key exists");
assert.ok(appSource.includes("persistLocalJournal"), "local writes persist in browser storage");
assert.ok(appSource.includes("exportEvents"), "local event export exists");
assert.ok(appSource.includes("return allDates[0];"), "local import defaults to newest real day");
assert.ok(appSource.includes('TODAY_COMMAND = "npm run today"'), "one-command today loop is documented in UI");
assert.ok(appSource.includes('dataMode: localDevHost ? "loading" : "demo"'), "local host starts without seed demo");
assert.ok(appSource.includes("enterSetupMode"), "empty local state shows setup guidance");
assert.ok(appSource.includes('data-copy-publish="markdown"'), "one-click copy markdown exists on report");

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
assert.equal(pkg.scripts.today, "node scripts/today.mjs", "npm run today entry exists");
assert.ok(pkg.scripts.serve, "npm run serve exists without forced ingest");

const todayScript = await readFile(new URL("./today.mjs", import.meta.url), "utf8");
assert.ok(todayScript.includes("ingest-local.mjs"), "today script runs ingest");
assert.ok(todayScript.includes("generate-human-report.mjs"), "today script writes human report");
assert.ok(todayScript.includes("127.0.0.1"), "today script serves local board");

const jsonlFixture = await readFile(new URL("../data/events.sample.jsonl", import.meta.url), "utf8");
assert.ok(jsonlFixture.includes('"sourceAgent":"codex"'), "jsonl codex sample exists");
assert.ok(jsonlFixture.includes('"sourceAgent":"claude_code"'), "jsonl claude sample exists");
assert.ok(jsonlFixture.includes('"sourceAgent":"hermes"'), "jsonl hermes sample exists");

console.log("check-demo: all local projection checks passed");
