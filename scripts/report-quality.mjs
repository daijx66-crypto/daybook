// Local-only quality audit and recent-active-days report for daybook.
// Rule-based by design: no model calls, no network, no external writes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS } from "../src/data.js";
import {
  evidencePreviewForEvent,
  normalizeProjectCandidate
} from "./project-taxonomy.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EVENTS_FILE = resolve(ROOT, "data/events.local.jsonl");
const QUALITY_JSON_OUT = resolve(ROOT, "data/report-quality.local.json");
const QUALITY_MD_OUT = resolve(ROOT, "reports/quality/latest.local.md");
const RECENT_JSON_OUT = resolve(ROOT, "data/recent-human-report.local.json");
const RECENT_MD_OUT = resolve(ROOT, "reports/recent/latest.local.md");

const FOLD_LABEL = "后台 / 杂项";
const REQUIRED_FILTER_REASONS = [
  "folded noise project",
  "prompt scaffold",
  "secret-adjacent text",
  "summary equals project/title",
  "empty or non-human text"
];

const FORBIDDEN_PATTERNS = [
  /\bAPI key\b/gi,
  /\bmodel id\b/gi,
  /\bbearer token\b/gi,
  /\benvironment_context\b/gi,
  /\bsystem-reminder\b/gi,
  /read the full prompt from stdin/gi,
  /请帮我/g,
  /你让我/g
];

const PROMPT_SCAFFOLD_PATTERNS = [
  /^# Files mentioned by the user:/i,
  /IMPORTANT:\s*Do NOT/i,
  /<scheduled-task\b/i,
  /file="\/Users\//i,
  /@["']?\/Users\//i,
  /read the full prompt from stdin/i,
  /follow all safety gates/i,
  /do not print secrets/i,
  /execute it carefully/i,
  /environment_context/i,
  /system-reminder/i,
  /<environment_context>/i,
  /<system-reminder>/i
];

const SECRET_ADJACENT_PATTERNS = [
  /\bAPI key\b/i,
  /\bmodel id\b/i,
  /\bbearer token\b/i,
  /\bprivate key\b/i,
  /\baccess token\b/i,
  /\btenant_access_token\b/i,
  /\bsecret\b/i,
  /\bsk-[A-Za-z0-9]{12,}\b/,
  /密钥/
];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

function main() {
  const command = process.argv[2] || "audit";
  const events = readJsonl(EVENTS_FILE);

  if (command === "audit") {
    const audit = buildQualityAudit(events);
    const markdown = renderQualityMarkdown(audit);
    assertNoForbiddenText(JSON.stringify(audit));
    assertNoForbiddenText(markdown);
    writeJson(QUALITY_JSON_OUT, audit);
    writeText(QUALITY_MD_OUT, markdown);
    console.log(JSON.stringify({
      status: "passed",
      json: QUALITY_JSON_OUT,
      markdown: QUALITY_MD_OUT,
      totalEvents: audit.totalEvents,
      activeDateCount: audit.activeDateCount,
      scannedActiveDates: audit.scannedActiveDates,
      latestDate: audit.latestDate,
      latestDay: audit.latestDay,
      recommendation: audit.recommendation,
      externalCallsMade: false
    }, null, 2));
    return;
  }

  if (command === "recent") {
    const report = buildRecentReport(events);
    const markdown = renderRecentMarkdown(report);
    assertNoForbiddenText(JSON.stringify(report));
    assertNoForbiddenText(markdown);
    writeJson(RECENT_JSON_OUT, report);
    writeText(RECENT_MD_OUT, markdown);
    console.log(JSON.stringify({
      status: "passed",
      json: RECENT_JSON_OUT,
      markdown: RECENT_MD_OUT,
      scannedActiveDates: report.scannedActiveDates,
      projectCount: report.projectCount,
      agentCount: report.agentCount,
      sharedTouchCount: report.sharedTouchCount,
      disagreementCount: report.disagreementCount,
      expanded: report.expanded,
      externalCallsMade: false
    }, null, 2));
    return;
  }

  throw new Error(`Unknown report-quality command: ${command}`);
}

export function readJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n");
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function beijingIsoNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");
}

function clip(value, max = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function sanitizeText(value, max = 120) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[已脱敏]");
  }
  return clip(text, max);
}

export function assertNoForbiddenText(value) {
  const text = String(value || "");
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    const match = text.match(pattern);
    if (match) throw new Error(`Report output contains forbidden text: ${match[0]}`);
  }
}

function eventText(event) {
  const payload = event?.payload || {};
  return [
    payload.project,
    payload.title,
    payload.summary,
    payload.details,
    payload.evidencePreview
  ].filter(Boolean).join(" ");
}

function payloadText(event, field) {
  return String(event?.payload?.[field] || "").trim();
}

function isSameSummaryAsLabel(event) {
  const summary = payloadText(event, "summary");
  const title = payloadText(event, "title");
  const project = payloadText(event, "project");
  return Boolean(summary && (summary === title || summary === project));
}

function isEmptyOrNonHuman(event) {
  const summary = payloadText(event, "summary");
  if (!summary) return true;
  const normalized = summary.replace(/\s+/g, " ").trim();
  if (/^(ok|okay|say ok|yes|test|continue|继续|收到)$/i.test(normalized)) return true;
  if (/^[\W_0-9-]{1,12}$/.test(normalized)) return true;
  if (normalized.length < 4) return true;
  return false;
}

function isFoldedNoise(event) {
  return payloadText(event, "project") === FOLD_LABEL || payloadText(event, "title") === FOLD_LABEL;
}

function hasPromptScaffold(event) {
  const text = eventText(event);
  return PROMPT_SCAFFOLD_PATTERNS.some((pattern) => pattern.test(text));
}

function hasSecretAdjacent(event) {
  const text = eventText(event);
  return event?.privacy?.containsSecret === true ||
    event?.privacy?.redactionStatus === "redacted" ||
    SECRET_ADJACENT_PATTERNS.some((pattern) => pattern.test(text));
}

export function classifyEvent(event) {
  if (isFoldedNoise(event)) return { useful: false, reason: "folded noise project" };
  if (hasPromptScaffold(event)) return { useful: false, reason: "prompt scaffold" };
  if (hasSecretAdjacent(event)) return { useful: false, reason: "secret-adjacent text" };
  if (isSameSummaryAsLabel(event)) return { useful: false, reason: "summary equals project/title" };
  if (isEmptyOrNonHuman(event)) return { useful: false, reason: "empty or non-human text" };
  return { useful: true, reason: "useful" };
}

function activeDates(events) {
  return [...new Set(events.map((event) => event.date).filter(Boolean))].sort((a, b) => b.localeCompare(a));
}

function agentName(agentId) {
  return AGENTS[agentId]?.name || agentId || "unknown";
}

function projectName(event) {
  return normalizeProjectCandidate(event).project;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount);
}

function reasonCounts(classified) {
  const counts = new Map(REQUIRED_FILTER_REASONS.map((reason) => [reason, 0]));
  for (const entry of classified) {
    if (!entry.classification.useful) increment(counts, entry.classification.reason);
  }
  return [...counts.entries()].map(([reason, count]) => ({ reason, count }));
}

function reasonForSparse(day) {
  if (day.rawEvents === 0) return "latest active date has no events";
  if (day.usefulEvents < 5 && day.projectCount < 3) return "latest active date has too few useful events and projects";
  if (day.usefulEvents < 5) return "latest active date has too few useful events";
  if (day.projectCount < 3) return "latest active date has too few projects";
  return "";
}

export function buildQualityAudit(events, options = {}) {
  const dates = activeDates(events);
  const scannedDates = dates.slice(0, options.scanActiveDates || 30);
  const scannedDateSet = new Set(scannedDates);
  const classified = events.map((event) => ({
    event,
    classification: classifyEvent(event)
  }));
  const useful = classified.filter((entry) => entry.classification.useful);
  const scannedUseful = useful.filter(({ event }) => scannedDateSet.has(event.date)).map(({ event }) => event);
  const latestDate = dates[0] || "";
  const latestEvents = events.filter((event) => event.date === latestDate);
  const latestUseful = useful.filter(({ event }) => event.date === latestDate).map(({ event }) => event);
  const latestDay = {
    rawEvents: latestEvents.length,
    usefulEvents: latestUseful.length,
    projectCount: unique(latestUseful.map(projectName).filter((name) => name !== "未归类")).length,
    agentCount: unique(latestUseful.map((event) => event.sourceAgent)).length,
    sparse: latestUseful.length < 5 || unique(latestUseful.map(projectName).filter((name) => name !== "未归类")).length < 3,
    reason: ""
  };
  latestDay.reason = latestDay.sparse ? reasonForSparse(latestDay) : "latest active date has enough useful signal";

  const minTotalEvents = options.minTotalEvents ?? 1000;
  const minActiveDates = options.minActiveDates ?? 30;
  let recommendation = "daily";
  if (events.length < minTotalEvents || dates.length < minActiveDates) recommendation = "needs-ingest-fix";
  else if (latestDay.sparse) recommendation = "recent-active-days";
  else if (buildProjectSummaries(scannedUseful).length < 5) recommendation = "weekly";

  const audit = {
    schemaVersion: "1.0",
    generatedAt: beijingIsoNow(),
    externalCallsMade: false,
    totalEvents: events.length,
    activeDateCount: dates.length,
    scannedActiveDates: scannedDates.length,
    scannedDateRange: scannedDates.length ? {
      newest: scannedDates[0],
      oldest: scannedDates[scannedDates.length - 1]
    } : null,
    latestDate,
    latestDay,
    dailyStats: scannedDates.map((date) => dailyStat(date, events, useful.map(({ event }) => event))),
    funnel: {
      rawEvents: events.length,
      usefulEvents: useful.length,
      filteredEvents: events.length - useful.length,
      filterReasons: reasonCounts(classified)
    },
    topProjects: buildProjectSummaries(scannedUseful).slice(0, 10),
    topAgents: buildAgentSummaries(scannedUseful),
    recommendation
  };
  assertNoForbiddenText(JSON.stringify(audit));
  return audit;
}

function dailyStat(date, events, usefulEvents) {
  const raw = events.filter((event) => event.date === date);
  const useful = usefulEvents.filter((event) => event.date === date);
  return {
    date,
    rawEvents: raw.length,
    usefulEvents: useful.length,
    projectCount: unique(useful.map(projectName).filter((name) => name !== "未归类")).length,
    agentCount: unique(useful.map((event) => event.sourceAgent)).length
  };
}

function buildAgentSummaries(events) {
  const counts = new Map();
  for (const event of events) increment(counts, event.sourceAgent);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([agentId, usefulEvents]) => ({ agentId, name: agentName(agentId), usefulEvents }));
}

function buildProjectSummaries(events) {
  const groups = new Map();
  for (const event of events) {
    const taxonomy = normalizeProjectCandidate(event);
    const project = taxonomy.project;
    if (!groups.has(project)) {
      groups.set(project, {
        project,
        confidence: taxonomy.confidence,
        projectQuality: taxonomy.projectQuality,
        needsHumanNaming: taxonomy.needsHumanNaming,
        agents: new Set(),
        events: [],
        risks: [],
        next: [],
        disagreementCount: 0
      });
    }
    const group = groups.get(project);
    if (qualityRank(taxonomy.projectQuality) > qualityRank(group.projectQuality)) {
      group.confidence = taxonomy.confidence;
      group.projectQuality = taxonomy.projectQuality;
      group.needsHumanNaming = taxonomy.needsHumanNaming;
    }
    group.agents.add(event.sourceAgent);
    group.events.push(event);
    if (isRiskEvent(event) && group.risks.length < 3) group.risks.push(riskFor(event));
    if (isNextEvent(event) && group.next.length < 3) group.next.push(nextFor(event));
    if (isRealDisagreement(event)) group.disagreementCount += 1;
  }

  return [...groups.values()]
    .map((group) => ({
      project: sanitizeText(group.project, 80),
      touchedAgents: [...group.agents].sort().map(agentName),
      usefulEventCount: group.events.length,
      evidencePreview: unique(group.events.map(evidenceFor)).slice(0, 3),
      nextStep: unique(group.next)[0] || nextForProject(group.project),
      risk: unique(group.risks)[0] || "",
      sharedTouch: group.agents.size >= 2,
      realDisagreement: group.disagreementCount > 0,
      disagreementCount: group.disagreementCount,
      confidence: group.confidence,
      projectQuality: group.projectQuality,
      needsHumanNaming: group.needsHumanNaming
    }))
    .sort((a, b) =>
      qualityRank(b.projectQuality) - qualityRank(a.projectQuality) ||
      b.usefulEventCount - a.usefulEventCount ||
      b.touchedAgents.length - a.touchedAgents.length ||
      a.project.localeCompare(b.project)
    );
}

function qualityRank(value) {
  return { high: 3, medium: 2, low: 1 }[value] || 0;
}

function isRiskEvent(event) {
  return ["blocked", "conflict", "quarantined"].includes(event.eventType) ||
    ["failed", "conflict", "quarantined", "redacted"].includes(event.state);
}

function isNextEvent(event) {
  return ["suggestion", "sync_plan"].includes(event.eventType) ||
    ["planned", "review"].includes(event.payload?.status);
}

function isRealDisagreement(event) {
  return Boolean(event.parentEventId && event.payload?.stance === "disagree");
}

function evidenceFor(event) {
  const taxonomyEvidence = evidencePreviewForEvent(event);
  if (taxonomyEvidence) return taxonomyEvidence;
  const project = projectName(event);
  const text = payloadText(event, "summary");
  const context = `${project} ${text}`;

  if (/agent协同|daybook|agent-sync|日报|多\s*agent/i.test(context)) {
    if (/质量|审计|漏斗|多日|最近活跃/i.test(text)) return "补齐 daybook 的质量审计、数据漏斗和最近活跃日报告。";
    if (/预览|端口|网页|显示|日期/i.test(text)) return "核对 daybook 的本地预览、默认日期和页面展示。";
    return "推进 daybook / 多 agent 协同项目的本地报告体验。";
  }
  if (/hermes/i.test(context)) {
    if (/调用次数|计费|plan|订阅|用量|token/i.test(text)) return "审计 Hermes 用量和计费判断口径。";
    if (/failure|失败|复盘|规则|learning/i.test(text)) return "把 Hermes 的失败复盘沉淀成可执行规则。";
    if (/GLM|模型|配置/i.test(text)) return "处理 Hermes 模型配置事项，敏感内容不进入报告。";
    return "推进 Hermes 运行、配置或复盘相关工作。";
  }
  if (/动态网站/i.test(project) && /obs|Caffline|咖了吗|树成林|PV|用户/i.test(text)) {
    return "围绕动态网站核对 Caffline / OBS 数据和展示口径。";
  }
  if (/obs|Caffline|咖了吗|树成林|PV|用户/i.test(context)) {
    return "核对 OBS / Caffline 相关数据和对外口径。";
  }
  if (/Claude code/i.test(project)) {
    if (/封号|ban|cloud|账号|权限/i.test(text)) return "排查 Claude Code 账号、权限或协作接续问题。";
    if (/配置|模型|API|运行|报错|bug/i.test(text)) return "排查 Claude Code 的本地运行和配置问题。";
  }
  if (/codex/i.test(project)) {
    if (/doctor|debug|prompt|配置|模型|运行|报错|bug/i.test(text)) return "排查 Codex 的本地运行、配置和可见上下文。";
  }
  if (/mac-youtube/i.test(project)) return "排查 mac-youtube 的本地运行、页面或交付问题。";
  if (/人生K线/i.test(project)) return "整理人生 K 线项目资料和表达框架。";
  if (/树林/i.test(project)) return "推进树林相关资料、页面或活动内容整理。";
  if (/婚礼|名片|网页|landing|portfolio/i.test(context)) {
    return `推进 ${sanitizeText(project, 50)} 的页面、交付物或视觉落地。`;
  }
  if (/bug|报错|修复|fix|失败/i.test(text)) return `修复 ${sanitizeText(project, 50)} 里的异常或阻塞。`;
  if (/审计|检查|核对|对比|排查|audit|check/i.test(text)) return `检查 ${sanitizeText(project, 50)} 的状态和证据。`;
  if (event.eventType === "learning") return `沉淀 ${sanitizeText(project, 50)} 的复盘和经验。`;
  if (isNextEvent(event)) return "";
  return "";
}

function riskFor(event) {
  const project = projectName(event);
  const text = payloadText(event, "summary");
  if (/obs|Caffline|咖了吗|PV|用户/i.test(`${project} ${text}`)) {
    return "对外数字需要回到原始记录确认后再使用。";
  }
  if (/hermes|调用次数|计费|plan|订阅|用量|token/i.test(`${project} ${text}`)) {
    return "费用和订阅判断需要继续以本地日志统计为准。";
  }
  if (isRealDisagreement(event)) return "存在明确分歧，需要保留证据后再收口。";
  return `${sanitizeText(project, 50)} 有待确认的阻塞或风险。`;
}

function nextFor(event) {
  return nextForProject(projectName(event));
}

function nextForProject(project) {
  if (/agent协同|daybook|agent-sync/i.test(project)) return "继续把质量审计和最近活跃日报告接进日常使用。";
  if (/hermes/i.test(project)) return "继续核对 Hermes 运行日志和费用口径。";
  if (/obs|Caffline|咖了吗/i.test(project)) return "继续回到 OBS / 原始记录确认数据来源。";
  return `继续推进 ${sanitizeText(project, 50)} 的下一步。`;
}

export function renderQualityMarkdown(audit) {
  const lines = [
    "# daybook 报告质量审计",
    "",
    `- 总事件：${audit.totalEvents}`,
    `- 活跃日期：${audit.activeDateCount}`,
    `- 扫描活跃日期：${audit.scannedActiveDates}`,
    `- 最新日期：${audit.latestDate || "无"}`,
    `- 推荐入口：${audit.recommendation}`,
    "- 外部写入：0",
    "",
    "## 最新日期",
    `- 原始事件：${audit.latestDay.rawEvents}`,
    `- 有效事件：${audit.latestDay.usefulEvents}`,
    `- 项目数：${audit.latestDay.projectCount}`,
    `- agent 数：${audit.latestDay.agentCount}`,
    `- 数据稀疏：${audit.latestDay.sparse ? "是" : "否"}`,
    `- 原因：${audit.latestDay.reason}`,
    "",
    "## 过滤漏斗",
    `- 原始事件：${audit.funnel.rawEvents}`,
    `- 进入报告候选：${audit.funnel.usefulEvents}`,
    `- 被过滤：${audit.funnel.filteredEvents}`
  ];
  for (const item of audit.funnel.filterReasons) {
    lines.push(`- ${item.reason}：${item.count}`);
  }
  lines.push("", "## Top Projects");
  if (audit.topProjects.length) {
    for (const project of audit.topProjects.slice(0, 10)) {
      lines.push(`- **${project.project}**：${project.usefulEventCount} 条；agent：${project.touchedAgents.join("、") || "未知"}；证据：${project.evidencePreview.join(" / ") || "暂无"}`);
    }
  } else {
    lines.push("- 暂无足够项目。");
  }
  lines.push("", "## Top Agents");
  for (const agent of audit.topAgents) {
    lines.push(`- **${agent.name}**：${agent.usefulEvents} 条有效事件`);
  }
  if (audit.latestDay.sparse) {
    lines.push("", "## 建议", "- 今天数据较少，建议查看最近活跃日报告。");
  }
  return lines.join("\n") + "\n";
}

export function buildRecentReport(events, options = {}) {
  const dates = activeDates(events);
  const classified = events.map((event) => ({ event, classification: classifyEvent(event) }));
  const usefulEvents = classified.filter((entry) => entry.classification.useful).map((entry) => entry.event);
  const baseDays = options.baseActiveDays || 7;
  const expandedDays = options.expandedActiveDays || 30;
  const baseDates = dates.slice(0, baseDays);
  const baseProjects = buildProjectSummaries(usefulEvents.filter((event) => baseDates.includes(event.date)));
  const expanded = baseProjects.length < 5 && dates.length > baseDays;
  const selectedDates = expanded ? dates.slice(0, expandedDays) : baseDates;
  const selectedSet = new Set(selectedDates);
  const selectedEvents = usefulEvents.filter((event) => selectedSet.has(event.date));
  const projects = buildProjectSummaries(selectedEvents);
  const shared = projects.filter((project) => project.sharedTouch);
  const disagreements = projects.filter((project) => project.realDisagreement);
  const needsUser = projects.filter((project) => project.risk).slice(0, 8).map((project) => ({
    project: project.project,
    risk: project.risk,
    agents: project.touchedAgents
  }));

  const report = {
    schemaVersion: "1.0",
    generatedAt: beijingIsoNow(),
    source: "local-rule-summary",
    mode: "recent-active-days",
    externalCallsMade: false,
    activeDateCount: dates.length,
    scannedActiveDates: selectedDates.length,
    scannedDates: selectedDates,
    expanded,
    expansionReason: expanded ? "最近 7 个活跃日不足 5 个项目，已自动扩大到最近 30 个活跃日。" : "",
    projectCount: projects.length,
    agentCount: unique(selectedEvents.map((event) => event.sourceAgent)).length,
    usefulEventCount: selectedEvents.length,
    rawEventCount: events.filter((event) => selectedSet.has(event.date)).length,
    sharedTouchCount: shared.length,
    disagreementCount: disagreements.length,
    topProjects: projects.slice(0, 12),
    sharedProjects: shared.slice(0, 8),
    disagreementProjects: disagreements.slice(0, 8),
    needsUser,
    next: projects.slice(0, 6).map((project) => ({
      project: project.project,
      nextStep: project.nextStep,
      agents: project.touchedAgents
    })),
    evidence: {
      previewPerProjectLimit: 3,
      externalCallsMade: false
    }
  };
  assertNoForbiddenText(JSON.stringify(report));
  return report;
}

export function renderRecentMarkdown(report) {
  const lines = [
    "# daybook 最近活跃日报告",
    "",
    report.expanded
      ? report.expansionReason
      : `扫描最近 ${report.scannedActiveDates} 个活跃日期。`,
    "",
    "## 项目推进图谱"
  ];
  if (report.topProjects.length) {
    for (const project of report.topProjects) {
      lines.push(`- **${project.project}**：${project.touchedAgents.join("、") || "未知"}；有效事件 ${project.usefulEventCount} 条；证据：${project.evidencePreview.join(" / ") || "暂无"}`);
      lines.push(`  - 下一步：${project.nextStep}`);
      if (project.risk) lines.push(`  - 风险：${project.risk}`);
    }
  } else {
    lines.push("- 暂无可读项目。");
  }

  lines.push("", "## 多 Agent 共同触达");
  if (report.sharedProjects.length) {
    for (const project of report.sharedProjects) {
      lines.push(`- **${project.project}**：${project.touchedAgents.join("、")}，${project.usefulEventCount} 条有效事件。`);
    }
  } else {
    lines.push("- 暂无多 agent 共同触达项目。");
  }

  lines.push("", "## 真实分歧");
  if (report.disagreementProjects.length) {
    for (const project of report.disagreementProjects) {
      lines.push(`- **${project.project}**：${project.disagreementCount} 条明确分歧，需要带证据收口。`);
    }
  } else {
    lines.push("- 暂无 parentEventId + disagree 形成的明确分歧。");
  }

  lines.push("", "## 需要用户介入");
  if (report.needsUser.length) {
    for (const item of report.needsUser) {
      lines.push(`- **${item.project}**：${item.risk}`);
    }
  } else {
    lines.push("- 暂无明确需要用户介入的阻塞。");
  }

  lines.push("", "## 下周 / 明天建议");
  if (report.next.length) {
    for (const item of report.next) {
      lines.push(`- **${item.project}**：${item.nextStep}`);
    }
  } else {
    lines.push("- 先补充更多真实事件后再生成建议。");
  }

  lines.push(
    "",
    "## 证据计数",
    `- 扫描活跃日期：${report.scannedActiveDates}`,
    `- 原始事件：${report.rawEventCount}`,
    `- 有效事件：${report.usefulEventCount}`,
    `- 项目数：${report.projectCount}`,
    `- agent 数：${report.agentCount}`,
    `- 共同触达项目：${report.sharedTouchCount}`,
    `- 真实分歧项目：${report.disagreementCount}`,
    "- 外部写入：0"
  );
  return lines.join("\n") + "\n";
}
