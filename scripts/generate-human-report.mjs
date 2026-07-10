// Generate a local-only, human-readable daily report from real daybook events.
// This is intentionally rule-based and safe: no model calls, no external writes.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS } from "../src/data.js";
import { buildDailyProjection, displayLine, eventsForDate, isDisplayNoise } from "../src/projection.js";

const ROOT = resolve(import.meta.dirname, "..");
const EVENTS_FILE = resolve(ROOT, "data/events.local.jsonl");
const JSON_OUT = resolve(ROOT, "data/daily-human-report.local.json");
const REPORT_DIR = resolve(ROOT, "reports/daily");

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

function main() {
  const preserveHuman = process.argv.includes("--preserve-human");
  const requestedDate = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
  const events = readJsonl(EVENTS_FILE);
  const date = requestedDate || latestDate(events);
  if (!date) {
    throw new Error("No local events found. Run npm run ingest:local first.");
  }
  if (preserveHuman && hasHumanReportFor(date)) {
    console.log(JSON.stringify({
      status: "preserved",
      date,
      json: JSON_OUT,
      markdown: resolve(REPORT_DIR, `${date}.md`),
      externalCallsMade: false
    }, null, 2));
    return;
  }

  const report = buildHumanReport(date, events);
  assertNoPromptLeak(report);
  mkdirSync(dirname(JSON_OUT), { recursive: true });
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2) + "\n");
  writeFileSync(resolve(REPORT_DIR, `${date}.md`), renderMarkdown(report));

  console.log(JSON.stringify({
    status: "passed",
    date,
    items: report.items.length,
    json: JSON_OUT,
    markdown: resolve(REPORT_DIR, `${date}.md`),
    externalCallsMade: false
  }, null, 2));
}

function readJsonl(path) {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function hasHumanReportFor(date) {
  if (!existsSync(JSON_OUT)) return false;
  try {
    const current = JSON.parse(readFileSync(JSON_OUT, "utf8"));
    return current.date === date && current.source === "codex-human";
  } catch {
    return false;
  }
}

function latestDate(sourceEvents) {
  return [...new Set(sourceEvents.map((event) => event.date))]
    .sort()
    .at(-1);
}

function clip(value, max = 130) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

function beijingIsoNow() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00");
}

function stripCount(value) {
  return String(value || "").replace(/^\d+\s*个\s*(Claude Code|Codex)\s*会话[：:]\s*/, "").trim();
}

function eventLine(event) {
  return stripCount(displayLine(event));
}

function isUseful(event) {
  return !isDisplayNoise(event) && Boolean(eventLine(event));
}

function contextOf(project, line) {
  return `${project || ""} ${line || ""}`;
}

function workSummary(project, line) {
  const text = String(line || "");
  const context = contextOf(project, text);

  if (/agent协同|daybook|agent-sync|日报|多 agent|多agent/i.test(context)) {
    if (/GitHub|仓库|分支|同步|本地/i.test(text)) {
      return "核对 daybook 项目的本地分支、GitHub 状态和当前预览入口。";
    }
    if (/日期|6 月 27|6月27|默认|显示|今天/i.test(text)) {
      return "修复 daybook 页面默认日期和当天日报显示问题。";
    }
    if (/总结|人话|概括|日报|卡片/i.test(text)) {
      return "把 daybook 日报和 agent 卡片改成按项目归纳的结果语言。";
    }
    return "推进 daybook / 多 agent 协同项目的本地预览和日报展示。";
  }

  if (/obs|Caffline|咖了吗|树成林|PV|用户/i.test(context)) {
    return "核对 Caffline 相关数据口径，回到 OBS / 原始记录确认真实来源。";
  }

  if (/hermes/i.test(context)) {
    if (/token|调用次数|计费|plan|订阅|用量/i.test(text)) {
      return "审计 Hermes 使用量、调用次数和 token 消耗，用于判断后续计费 / 订阅方案。";
    }
    if (/failure|learning|失败|复盘|规则|问太多/i.test(text)) {
      return "沉淀 Hermes 失败复盘规则，把重复问题转成后续可执行的改进项。";
    }
    if (/GLM|模型|API|key|密钥/i.test(text)) {
      return "处理 Hermes 模型配置相关事项，敏感内容未进入日报。";
    }
    return "推进 Hermes 运行、配置或复盘相关工作。";
  }

  if (/bug|报错|失败|修复|fix/i.test(text)) return `修复 ${project || "这个项目"} 里的一个 bug / 异常。`;
  if (/审计|检查|核对|对比|排查|audit|check/i.test(text)) return `检查 ${project || "这个项目"} 的当前状态和证据。`;
  return `推进 ${project || "这个项目"} 的当天工作。`;
}

function riskText(project, line) {
  const context = contextOf(project, line);
  if (/obs|Caffline|咖了吗|PV|用户/i.test(context)) {
    return "Caffline 的公开数字需要等 OBS / 原始数据确认后再写进对外材料。";
  }
  if (/hermes|token|调用次数|计费|plan|订阅|用量/i.test(context)) {
    return "Hermes 的计费 / 订阅判断需要继续以本地调用日志和 token 统计为准。";
  }
  return `${project || "这个项目"} 还有需要继续确认的点。`;
}

function nextText(project, line) {
  const context = contextOf(project, line);
  if (/agent协同|daybook|agent-sync|日报|多 agent|多agent/i.test(context)) {
    return "继续把 daybook 的人话日报接进页面和每日自动任务。";
  }
  if (/obs|Caffline|咖了吗|PV|用户/i.test(context)) {
    return "继续核对 Caffline 的真实数据来源，把不准口径改成可验证表述。";
  }
  if (/hermes|token|调用次数|计费|plan|订阅|用量/i.test(context)) {
    return "继续收敛 Hermes 使用量审计，给出更明确的 plan 选择建议。";
  }
  return `继续推进 ${project || "这个项目"} 的下一步。`;
}

function isRiskEvent(event) {
  return ["blocked", "conflict", "quarantined"].includes(event.eventType) ||
    ["failed", "conflict", "quarantined", "redacted"].includes(event.state);
}

function isTomorrowEvent(event) {
  return ["suggestion", "sync_plan"].includes(event.eventType) ||
    ["planned", "review"].includes(event.payload?.status);
}

function isDecisionEvent(event) {
  return event.eventType === "decision" || event.eventType === "conflict" || event.payload?.stance === "disagree";
}

function isDisagreementEvent(event) {
  return Boolean(event.parentEventId && event.payload?.stance === "disagree");
}

function projectStatus(item) {
  if (item.risks.length || item.disagreementCount) return "needs_attention";
  if (item.next.length || item.inProgress.length) return "in_progress";
  return "done";
}

function statusLabel(status) {
  if (status === "needs_attention") return "待确认";
  if (status === "in_progress") return "推进中";
  return "已完成";
}

function collaborationType(item) {
  if (item.disagreementCount) return "real_disagreement";
  if (item.agents.size >= 2) return "shared_touch";
  return "single_agent";
}

function collaborationLabel(type) {
  if (type === "real_disagreement") return "真实分歧";
  if (type === "shared_touch") return "共同触达";
  return "单 agent 推进";
}

function projectScore(item) {
  return (item.eventCount * 10) +
    (item.agents.size * 5) +
    (item.risks.length * 4) +
    (item.disagreementCount * 8) +
    (item.next.length * 2);
}

function uniqueText(lines) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const text = clip(line, 140);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function sentenceList(lines) {
  return lines
    .map((line) => String(line || "").replace(/[。；;]+$/g, "").trim())
    .filter(Boolean)
    .join("；") + "。";
}

export function assertNoPromptLeak(report) {
  const text = JSON.stringify(report);
  const leaked = text.match(/你让我|你发现|请帮我|我把|我确认|API key|model id|bearer token|system-reminder|environment_context|read the full prompt from stdin|提示词|prompt/i);
  if (leaked) {
    throw new Error(`Daily report still contains prompt-like language: ${leaked[0]}`);
  }
}

export function buildHumanReport(date, sourceEvents) {
  const dayEvents = eventsForDate(date, sourceEvents);
  const usefulEvents = dayEvents.filter(isUseful);
  const daily = buildDailyProjection(date, sourceEvents);
  const byProject = new Map();

  for (const event of usefulEvents) {
    const project = event.payload.project || event.payload.title || "未归类";
    if (!byProject.has(project)) {
      byProject.set(project, {
        project,
        agents: new Set(),
        actions: [],
        completed: [],
        inProgress: [],
        judgments: [],
        samples: [],
        risks: [],
        next: [],
        disagreementCount: 0,
        eventCount: 0
      });
    }
    const group = byProject.get(project);
    group.agents.add(event.sourceAgent);
    group.eventCount += event.payload.sessionCount || 1;
    const line = eventLine(event);
    if (group.actions.length < 6) {
      group.actions.push({
        agentId: event.sourceAgent,
        agent: AGENTS[event.sourceAgent]?.name || event.sourceAgent,
        text: actionText(event, line)
      });
    }
    if (isDisagreementEvent(event)) group.disagreementCount += 1;
    if (isRiskEvent(event)) {
      if (group.risks.length < 2) group.risks.push(riskText(project, line));
    }
    if (isDecisionEvent(event)) {
      if (group.judgments.length < 3) group.judgments.push(workSummary(project, line));
    } else if (isTomorrowEvent(event)) {
      if (group.next.length < 2) group.next.push(nextText(project, line));
      if (group.inProgress.length < 2) group.inProgress.push(workSummary(project, line));
    } else if (group.completed.length < 3) {
      group.completed.push(workSummary(project, line));
    }
    if (group.samples.length < 3) {
      group.samples.push(workSummary(project, line));
    }
  }

  const items = [...byProject.values()]
    .sort((a, b) => projectScore(b) - projectScore(a) || a.project.localeCompare(b.project))
    .slice(0, 6)
    .map((item, index) => {
      const collabType = collaborationType(item);
      const todayProgress = uniqueText([...item.completed, ...item.samples]).slice(0, 3);
      const keyJudgments = uniqueText(item.judgments).slice(0, 3);
      const tomorrowNotes = uniqueText(item.next).slice(0, 3);
      const needsUser = uniqueText(item.risks).slice(0, 3);
      const agents = [...item.agents].map((agentId) => AGENTS[agentId]?.name || agentId);
      return {
        index: index + 1,
        title: item.project,
        folder: item.project,
        status: projectStatus(item),
        statusLabel: statusLabel(projectStatus(item)),
        collaborationType: collabType,
        collaborationLabel: collaborationLabel(collabType),
        hasDisagreement: item.disagreementCount > 0,
        plain: summarizeProject(item, { todayProgress, keyJudgments, tomorrowNotes, needsUser }),
        todayProgress,
        keyJudgments,
        tomorrowNotes,
        needsUser,
        agentActions: mergeActions(item.actions),
        agents,
        evidenceCount: item.eventCount,
        risks: needsUser,
        next: tomorrowNotes
      };
    });

  const agentSections = buildAgentSections(items, usefulEvents);

  const folderList = items.map((item) => item.folder || item.title).join("、");
  return {
    schemaVersion: "1.0",
    date,
    generatedAt: beijingIsoNow(),
    source: "local-rule-summary",
    externalCallsMade: false,
    title: daily.title,
    headline: items.length
      ? `今天按项目 / 文件夹看，主要推进了 ${items.length} 个项目：${folderList}。`
      : "今天按项目 / 文件夹看，还没有可读项目进展。",
    overview: items.length
      ? `今天的 ${dayEvents.length} 条本地记录被整理成 ${items.length} 个项目条目，重点保留推进结果、关键判断、明天注意和需要用户介入的点。`
      : "今天还没有可读的真实工作记录。",
    items,
    agents: agentSections,
    risks: uniqueText(usefulEvents
      .filter((event) => ["blocked", "conflict", "quarantined"].includes(event.eventType) || ["failed", "conflict", "quarantined", "redacted"].includes(event.state))
      .map((event) => riskText(event.payload.project || event.payload.title || "未归类", eventLine(event))))
      .slice(0, 5),
    next: uniqueText(usefulEvents
      .filter((event) => ["suggestion", "sync_plan"].includes(event.eventType))
      .map((event) => nextText(event.payload.project || event.payload.title || "未归类", eventLine(event))))
      .slice(0, 5),
    evidence: {
      rawEvents: dayEvents.length,
      usefulEvents: usefulEvents.length,
      agents: new Set(usefulEvents.map((event) => event.sourceAgent)).size,
      projects: items.length,
      collaborationProjects: items.filter((item) => item.collaborationType !== "single_agent").length,
      disagreementProjects: items.filter((item) => item.hasDisagreement).length,
      riskItems: items.reduce((sum, item) => sum + item.needsUser.length, 0),
      nextItems: items.reduce((sum, item) => sum + item.tomorrowNotes.length, 0),
      externalCallsMade: false
    },
    quality: {
      maxActionsPerProject: 3,
      leakCheckPassed: true,
      deterministicRules: true
    }
  };
}

function summarizeProject(item, parts) {
  const leadSource = (parts.todayProgress?.length || parts.keyJudgments?.length)
    ? [...(parts.todayProgress || []), ...(parts.keyJudgments || [])]
    : [...(parts.tomorrowNotes || [])];
  const leads = uniqueText(leadSource);
  const lead = leads.length ? sentenceList(leads.slice(0, 2)) : `推进 ${item.project} 的当天工作。`;
  const agentText = [...item.agents].map((agentId) => AGENTS[agentId]?.name || agentId).join("、");
  const collab = collaborationLabel(collaborationType(item));
  const suffix = parts.needsUser?.length
    ? `需要用户介入：${clip(parts.needsUser[0], 90)}`
    : "暂无需要用户介入的卡点。";
  return `${collab}。${agentText} 推进了 ${item.eventCount} 条有效工作。今日推进：${clip(lead, 180)} ${suffix}`;
}

function actionText(event, line) {
  const project = event.payload.project || event.payload.title || "未归类";
  const text = workSummary(project, line);
  if (event.eventType === "blocked") return text;
  if (event.eventType === "suggestion" || event.eventType === "sync_plan") return nextText(project, line);
  return text;
}

function mergeActions(actions) {
  const seen = new Set();
  const out = [];
  for (const action of actions) {
    const key = action.text;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(action);
  }
  return out.slice(0, 3);
}

function buildAgentSections(items, usefulEvents) {
  const visibleProjects = new Set(items.map((item) => item.folder || item.title));
  const byAgent = new Map();
  for (const event of usefulEvents) {
    const project = event.payload.project || event.payload.title || "未归类";
    if (!visibleProjects.has(project)) continue;
    const agentId = event.sourceAgent;
    if (!byAgent.has(agentId)) {
      byAgent.set(agentId, {
        agentId,
        name: AGENTS[agentId]?.name || agentId,
        projects: new Set(),
        sessions: 0
      });
    }
    const section = byAgent.get(agentId);
    section.projects.add(project);
    section.sessions += event.payload.sessionCount || 1;
  }
  return [...byAgent.values()].map((section) => {
    const projects = [...section.projects].slice(0, 5);
    const lead = projects.slice(0, 3).join("、");
    return {
      agentId: section.agentId,
      name: section.name,
      plain: `${section.name} 今天覆盖 ${projects.length} 个文件夹、${section.sessions} 次会话，主要处理 ${lead}${projects.length > 3 ? " 等" : ""} 相关工作。`,
      projects,
      sessions: section.sessions
    };
  });
}

export function renderMarkdown(report) {
  const lines = [
    `# ${report.date} daybook 人话日报`,
    "",
    report.headline,
    "",
    report.overview,
    "",
    "## 按项目看"
  ];
  if (report.items.length) {
    for (const item of report.items) {
      lines.push(`${item.index}. **${item.folder || item.title}**（${item.collaborationLabel || "单 agent 推进"} / ${item.statusLabel || statusLabel(item.status)}）：${item.plain}`);
      lines.push(`   - 今日推进：${item.todayProgress?.[0] || "暂无明确推进记录。"}`);
      lines.push(`   - 关键判断：${item.keyJudgments?.[0] || "暂无新的关键判断。"}`);
      lines.push(`   - 明天注意：${item.tomorrowNotes?.[0] || "暂无明确明天事项。"}`);
      lines.push(`   - 需要用户介入：${item.needsUser?.[0] || "暂无需要用户介入的卡点。"}`);
      lines.push(`   - 证据：${item.evidenceCount} 条有效事件；agent：${(item.agents || []).join("、") || "未知"}`);
      (item.agentActions || []).forEach((action) => {
         lines.push(`   - ${action.agent}：${action.text}`);
      });
    }
  } else {
    lines.push("- 暂无可读记录。");
  }
  lines.push("", "## 按 agent 看");
  for (const agent of report.agents) {
    lines.push(`- **${agent.name}**：${agent.plain}`);
  }
  if (!report.agents.length) lines.push("- 暂无可读 agent 摘要。");
  lines.push("", "## 需要继续确认");
  (report.risks.length ? report.risks : ["暂无需要用户介入的卡点。"]).forEach((risk) => lines.push(`- ${risk}`));
  lines.push("", "## 明天可以接着做");
  (report.next.length ? report.next : ["暂无明确明天事项。"]).forEach((next) => lines.push(`- ${next}`));
  lines.push(
    "",
    "## 证据计数",
    `- 原始本地事件：${report.evidence.rawEvents}`,
    `- 进入日报正文：${report.evidence.usefulEvents}`,
    `- 协作项目：${report.evidence.collaborationProjects}`,
    `- 真实分歧项目：${report.evidence.disagreementProjects}`,
    `- 外部写入：0`
  );
  return lines.join("\n") + "\n";
}
