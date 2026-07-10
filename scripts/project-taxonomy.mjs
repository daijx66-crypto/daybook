// Project taxonomy and evidence-quality helpers for local daybook reports.
// Pure rule engine: no disk, no network, no external writes.

const FOLD_LABEL = "后台 / 杂项";
const NEEDS_HUMAN = "未归类 / 需人工命名";

const FORBIDDEN_PATTERNS = [
  /\bAPI key\b/gi,
  /\bmodel id\b/gi,
  /\bbearer token\b/gi,
  /\benvironment_context\b/gi,
  /\bsystem-reminder\b/gi,
  /read the full prompt from stdin/gi,
  /请帮我/g,
  /你让我/g,
  /\/Users\/[^\s)]+/g
];

const LOW_INFO_PATTERNS = [
  { name: "tool codex", pattern: /^codex$/i },
  { name: "tool claude code", pattern: /^claude code$/i },
  { name: "new chat", pattern: /^new-chat(?:-\d+)?$/i },
  { name: "session thread dir", pattern: /^codex(?:-claude-code)+$/i },
  { name: "temp directory", pattern: /^(sessions?|desktop|tmp|var|folders|documents|projects|node_modules|untitled)$/i },
  { name: "folded noise", pattern: /^后台 \/ 杂项$/ },
  { name: "numeric bucket", pattern: /^\d+-\d+$/ }
];

const KNOWN_PROJECTS = [
  { project: "hermes", patterns: [/hermes/i, /gateway/i, /watchdog/i, /GLM/i, /调用次数|计费|订阅|用量|token/i] },
  { project: "agent协同", patterns: [/daybook/i, /agent-sync/i, /agent协同/i, /多\s*agent/i, /最近活跃/i, /质量审计/i, /项目图谱/i, /日报/i] },
  { project: "obs", patterns: [/\bobs\b/i, /Obsidian/i, /Caffline/i, /咖了吗/i, /微信读书/i, /weread/i] },
  { project: "动态网站", patterns: [/动态网站/i, /前哨站/i, /落地页/i] },
  { project: "姜哥婚礼网页", patterns: [/姜哥婚礼/i, /婚礼网页/i, /名片/i] },
  { project: "人生K线", patterns: [/人生\s*K\s*线/i, /人生K线/i, /K\s*线/i, /股市/i, /Dashboard/i] },
  { project: "每日复利系统", patterns: [/每日复利/i, /复利系统/i] },
  { project: "mac-youtube", patterns: [/mac-youtube/i, /youtube/i] },
  { project: "树林黑客松", patterns: [/树林黑客松/i, /树成林黑客松/i, /黑客松/i] },
  { project: "树林", patterns: [/树林/i, /树成林/i] },
  { project: "自动视频", patterns: [/自动视频/i, /video-maker/i, /视频生成/i] },
  { project: "image2-frames", patterns: [/image2-frames/i, /分镜|帧/i] },
  { project: "image2-variants", patterns: [/image2-variants/i, /生图/i, /图片变体/i] },
  { project: "personal-site", patterns: [/personal-site/i, /个人网站/i, /自我介绍网页/i] },
  { project: "chatgpt-cloudflare-2", patterns: [/chatgpt-cloudflare/i, /Cloudflare/i] },
  { project: "Claude Code 环境排障", patterns: [/Claude Code/i, /claude code/i, /封号|账号|额度|刷新|定时任务|本地运行|配置/i] },
  { project: "Codex 本地环境", patterns: [/Codex/i, /codex doctor/i, /prompt-input/i, /本地执行员|工程沉淀/i] }
];

export function isLowInfoProjectName(project) {
  const text = String(project || "").trim();
  return LOW_INFO_PATTERNS.some(({ pattern }) => pattern.test(text));
}

export function lowInfoPatternName(project) {
  const text = String(project || "").trim();
  return LOW_INFO_PATTERNS.find(({ pattern }) => pattern.test(text))?.name || "";
}

function clean(value, max = 120) {
  let text = String(value || "").replace(/\s+/g, " ").trim();
  for (const pattern of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    text = text.replace(pattern, "[已脱敏]");
  }
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function textOf(eventOrText, extra = "") {
  if (typeof eventOrText === "string") return `${eventOrText} ${extra}`.trim();
  const payload = eventOrText?.payload || {};
  return [
    payload.project,
    payload.title,
    payload.summary,
    payload.details,
    payload.evidencePreview,
    extra
  ].filter(Boolean).join(" ");
}

function knownProjectFrom(text, originalProject = "") {
  const haystack = `${originalProject} ${text}`;
  for (const entry of KNOWN_PROJECTS) {
    if (entry.patterns.some((pattern) => pattern.test(haystack))) return entry.project;
  }
  return "";
}

function isHumanNamedProject(project) {
  const text = String(project || "").trim();
  if (!text || isLowInfoProjectName(text)) return false;
  if (/^[._/-]+$/.test(text)) return false;
  if (/^[a-z0-9-]{1,3}$/i.test(text)) return false;
  return true;
}

export function classifyProjectName(project, text = "", context = null) {
  const original = String(project || "").trim();
  const combined = textOf(context || text, text);
  const lowInfo = isLowInfoProjectName(original);
  const candidate = knownProjectFrom(combined, lowInfo ? "" : original);

  if (lowInfo) {
    return {
      project: original,
      confidence: candidate ? "medium" : "low",
      projectQuality: "low",
      lowInfo: true,
      candidate,
      reason: candidate ? `low-info project has candidate ${candidate}` : `low-info project: ${lowInfoPatternName(original) || "unknown"}`
    };
  }

  if (candidate && candidate === original) {
    return { project: original, confidence: "high", projectQuality: "high", lowInfo: false, candidate, reason: "known project" };
  }

  if (candidate && /^(obs|skills)$/i.test(original)) {
    return { project: original, confidence: "medium", projectQuality: "medium", lowInfo: false, candidate, reason: "short project with semantic evidence" };
  }

  if (isHumanNamedProject(original)) {
    const ambiguousShortName = /^(obs|skills)$/i.test(original) && !candidate;
    const confidence = ambiguousShortName ? "medium" : "high";
    return {
      project: original,
      confidence,
      projectQuality: confidence,
      lowInfo: false,
      candidate: candidate || original,
      reason: candidate ? "semantic evidence confirms project" : "human-readable project name"
    };
  }

  return { project: original || NEEDS_HUMAN, confidence: "low", projectQuality: "low", lowInfo: true, candidate: "", reason: "missing or non-human project name" };
}

export function normalizeProjectCandidate(event) {
  const originalProject = String(event?.payload?.project || event?.payload?.title || "").trim();
  const summary = String(event?.payload?.summary || "");
  const classified = classifyProjectName(originalProject, summary, event);
  if (classified.lowInfo) {
    if (classified.candidate) {
      return {
        originalProject,
        project: classified.candidate,
        confidence: classified.candidate === "Claude Code 环境排障" || classified.candidate === "Codex 本地环境" ? "medium" : "high",
        projectQuality: classified.candidate === "Claude Code 环境排障" || classified.candidate === "Codex 本地环境" ? "medium" : "high",
        needsHumanNaming: false,
        reason: classified.reason
      };
    }
    return {
      originalProject,
      project: NEEDS_HUMAN,
      confidence: "low",
      projectQuality: "low",
      needsHumanNaming: true,
      reason: classified.reason
    };
  }
  return {
    originalProject,
    project: classified.candidate || classified.project,
    confidence: classified.confidence,
    projectQuality: classified.projectQuality,
    needsHumanNaming: false,
    reason: classified.reason
  };
}

export function classifyEvidence(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (!value) return { quality: "noise", reason: "empty" };
  if (/API key|model id|bearer token|private key|secret|密钥/i.test(value)) return { quality: "noise", reason: "secret-adjacent" };
  if (/read the full prompt from stdin|environment_context|system-reminder|IMPORTANT:\s*Do NOT|^# Files mentioned by the user|<scheduled-task/i.test(value)) {
    return { quality: "noise", reason: "prompt scaffold" };
  }
  if (/\/Users\/|@["']?\/Users\/|file="\/Users\//.test(value)) return { quality: "noise", reason: "local path scaffold" };
  if (/^(ok|okay|say ok|test|continue|继续|收到)$/i.test(value)) return { quality: "noise", reason: "non-human" };
  if (/推进 .+ 的可读进展整理|推进 .+ 的实际工作|整理 .+ 的下一步|继续推进 .+ 的下一步/.test(value)) {
    return { quality: "generic", reason: "template fallback" };
  }
  if (/审计|核对|排查|修复|生成|重建|接入|配置|沉淀|验证|优化|调整|改进|归类|日报|报告|网页|数据|计费|调用|模型|复盘|预览|构建|截图|测试/i.test(value)) {
    return { quality: "specific", reason: "action and object present" };
  }
  return value.length >= 24 ? { quality: "specific", reason: "substantive sentence" } : { quality: "generic", reason: "short vague sentence" };
}

export function evidencePreviewForEvent(event) {
  const normalized = normalizeProjectCandidate(event);
  const project = normalized.project;
  const text = String(event?.payload?.summary || "");
  if (classifyEvidence(text).quality === "noise") return "";
  const context = `${project} ${text}`;

  if (project === "hermes") {
    if (/调用次数|计费|plan|订阅|用量|token/i.test(text)) return "审计 Hermes 调用次数、token 消耗和订阅方案。";
    if (/GLM|模型|配置|API|回退|fallback/i.test(text)) return "调整 Hermes 模型配置和回退策略，敏感内容不进入报告。";
    if (/failure|失败|复盘|规则|learning|教训/i.test(text)) return "沉淀 Hermes 失败复盘规则和周复盘入口。";
    if (/gateway|watchdog|health|状态|路由/i.test(text)) return "排查 Hermes gateway、watchdog 和路由状态。";
    return "推进 Hermes 运行、配置和复盘相关工作。";
  }
  if (project === "agent协同") {
    if (/taxonomy|归类|项目名|低信息/i.test(text)) return "修正 daybook 项目归类、低信息项目和证据质量指标。";
    if (/质量|审计|漏斗|最近活跃|多日/i.test(text)) return "补齐 daybook 质量审计、数据漏斗和最近活跃日报告。";
    if (/预览|端口|日期|显示|页面/i.test(text)) return "核对 daybook 本地预览、默认日期和页面展示。";
    return "推进 daybook / 多 agent 协同的报告和交接体验。";
  }
  if (project === "obs") return "核对 OBS / Caffline 数据来源、PV/用户口径和对外表述。";
  if (project === "动态网站") {
    if (/Caffline|OBS|PV|用户|数据/i.test(text)) return "核对动态网站里的 Caffline 数据展示口径。";
    return "推进动态网站内容整理、页面交付和本地预览验证。";
  }
  if (project === "姜哥婚礼网页") return "推进姜哥婚礼网页、名片或移动端交付。";
  if (project === "人生K线") return "整理人生 K 线 Dashboard、股市曲线和项目表达结构。";
  if (project === "每日复利系统") return "推进每日复利系统的记录、规则和自动化闭环。";
  if (project === "mac-youtube") return "排查 mac-youtube 本地预览、脚本和页面交付问题。";
  if (project === "树林黑客松" || project === "树林") return "推进树林 / 树成林黑客松资料、页面或活动内容整理。";
  if (project === "自动视频") return "验证自动视频脚本、生成流程和交付状态。";
  if (project === "image2-frames") return "整理 image2 分镜帧、画面结构和生成素材。";
  if (project === "image2-variants") return "整理 image2 图片变体、生图流程和输出质量。";
  if (project === "personal-site" || /^personal-site/i.test(project)) return "审查 personal-site 模块结构、页面组合和前端交付验证。";
  if (project === "chatgpt-cloudflare-2") return "推进 ChatGPT Cloudflare 相关站点、代理或部署问题。";
  if (project === "Claude Code 环境排障") return "排查 Claude Code 账号、额度刷新、本地运行或协作接续问题。";
  if (project === "Codex 本地环境") return "排查 Codex 本地运行、配置和可见上下文。";
  if (normalized.needsHumanNaming) return "";
  if (/bug|报错|修复|fix|失败/i.test(context)) return `修复 ${clean(project, 50)} 的异常或阻塞。`;
  if (/审计|检查|核对|对比|排查|audit|check/i.test(context)) return `检查 ${clean(project, 50)} 的状态和证据。`;
  if (/网页|页面|landing|portfolio|站点/i.test(context)) return `推进 ${clean(project, 50)} 的页面交付和预览验证。`;
  return "";
}

function isUsefulEvent(event) {
  const payload = event?.payload || {};
  const summary = String(payload.summary || "").trim();
  const project = String(payload.project || "").trim();
  const title = String(payload.title || "").trim();
  if (project === FOLD_LABEL || title === FOLD_LABEL) return false;
  if (!summary) return false;
  if (summary === project || summary === title) return false;
  if (classifyEvidence(summary).quality === "noise") return false;
  return true;
}

function groupProjects(events, { normalize }) {
  const groups = new Map();
  for (const event of events) {
    const normalized = normalize ? normalizeProjectCandidate(event) : {
      originalProject: event.payload?.project || "",
      project: event.payload?.project || event.payload?.title || NEEDS_HUMAN,
      confidence: classifyProjectName(event.payload?.project || "", event.payload?.summary || "", event).confidence,
      projectQuality: classifyProjectName(event.payload?.project || "", event.payload?.summary || "", event).projectQuality,
      needsHumanNaming: isLowInfoProjectName(event.payload?.project || "") && !knownProjectFrom(textOf(event)),
      reason: "baseline raw project"
    };
    const key = normalized.project;
    if (!groups.has(key)) {
      groups.set(key, {
        project: key,
        confidence: normalized.confidence,
        projectQuality: normalized.projectQuality,
        needsHumanNaming: normalized.needsHumanNaming,
        originalProjects: new Map(),
        events: [],
        evidencePreview: []
      });
    }
    const group = groups.get(key);
    group.events.push(event);
    group.originalProjects.set(normalized.originalProject, (group.originalProjects.get(normalized.originalProject) || 0) + 1);
    const evidence = normalize ? evidencePreviewForEvent(event) : legacyEvidenceFor(event);
    if (evidence && !group.evidencePreview.includes(evidence) && group.evidencePreview.length < 3) {
      group.evidencePreview.push(evidence);
    }
  }
  return [...groups.values()]
    .map((group) => ({
      project: clean(group.project, 80),
      confidence: group.confidence,
      projectQuality: group.projectQuality,
      lowInfo: isLowInfoProjectName(group.project),
      needsHumanNaming: group.needsHumanNaming,
      usefulEventCount: group.events.length,
      originalProjects: [...group.originalProjects.entries()].sort((a, b) => b[1] - a[1]).map(([project, count]) => ({ project: clean(project, 80), count })),
      evidencePreview: group.evidencePreview
    }))
    .sort((a, b) => {
      const quality = { high: 3, medium: 2, low: 1 };
      if (normalize && quality[b.projectQuality] !== quality[a.projectQuality]) return quality[b.projectQuality] - quality[a.projectQuality];
      return b.usefulEventCount - a.usefulEventCount || a.project.localeCompare(b.project);
    });
}

function legacyEvidenceFor(event) {
  const project = String(event?.payload?.project || "");
  const text = String(event?.payload?.summary || "");
  if (classifyEvidence(text).quality === "noise") return "";
  if (/hermes/i.test(`${project} ${text}`)) return /token|调用次数|计费|订阅|用量/i.test(text)
    ? "审计 Hermes 用量和计费判断口径。"
    : "推进 Hermes 运行、配置或复盘相关工作。";
  if (/obs|Caffline|咖了吗/i.test(`${project} ${text}`)) return "核对 OBS / Caffline 相关数据和对外口径。";
  if (/agent协同|daybook|agent-sync/i.test(`${project} ${text}`)) return "推进 daybook / 多 agent 协同项目的本地报告体验。";
  if (/suggestion|sync_plan/.test(event.eventType)) return `整理 ${clean(project, 50)} 的下一步。`;
  return `推进 ${clean(project, 50)} 的可读进展整理。`;
}

function metricFor(projects, totalUsefulEvents) {
  const top10 = projects.slice(0, 10);
  const top50 = projects.slice(0, 50);
  const previews = top10.flatMap((project) => project.evidencePreview || []);
  const nonSpecific = previews.filter((preview) => classifyEvidence(preview).quality !== "specific");
  const highConfidence = top50.filter((project) => project.confidence === "high" && !project.lowInfo);
  return {
    totalUsefulEvents,
    topProjectCount: projects.length,
    lowInfoProjectCountTop10: top10.filter((project) => project.lowInfo || project.projectQuality === "low").length,
    templateEvidenceRateTop10: previews.length ? Number((nonSpecific.length / previews.length).toFixed(3)) : 0,
    highConfidenceProjectRateTop50: top50.length ? Number((highConfidence.length / top50.length).toFixed(3)) : 0
  };
}

function lowInfoPatternsFor(events) {
  const counts = new Map();
  for (const event of events) {
    const project = event.payload?.project || "";
    const pattern = lowInfoPatternName(project);
    if (pattern) counts.set(pattern, (counts.get(pattern) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([pattern, count]) => ({ pattern, count }));
}

function aliasCandidatesFor(events) {
  const counts = new Map();
  for (const event of events) {
    const normalized = normalizeProjectCandidate(event);
    if (!isLowInfoProjectName(normalized.originalProject) || normalized.needsHumanNaming) continue;
    const key = `${normalized.originalProject}=>${normalized.project}`;
    if (!counts.has(key)) counts.set(key, { from: normalized.originalProject, to: normalized.project, count: 0, evidencePreview: [] });
    const entry = counts.get(key);
    entry.count += 1;
    const evidence = evidencePreviewForEvent(event);
    if (evidence && !entry.evidencePreview.includes(evidence) && entry.evidencePreview.length < 3) entry.evidencePreview.push(evidence);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.from.localeCompare(b.from)).slice(0, 30);
}

function needsHumanNamingFor(events) {
  const groups = new Map();
  for (const event of events) {
    const normalized = normalizeProjectCandidate(event);
    if (!normalized.needsHumanNaming) continue;
    const key = normalized.originalProject || NEEDS_HUMAN;
    if (!groups.has(key)) groups.set(key, { originalProject: key, count: 0, reason: normalized.reason, samplePreview: "" });
    const group = groups.get(key);
    group.count += 1;
    if (!group.samplePreview) group.samplePreview = clean(event.payload?.summary || "", 100);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.originalProject.localeCompare(b.originalProject));
}

export function buildTaxonomyAudit(events) {
  const usefulEvents = events.filter(isUsefulEvent);
  const baselineProjects = groupProjects(usefulEvents, { normalize: false });
  const afterProjects = groupProjects(usefulEvents, { normalize: true });
  const baseline = metricFor(baselineProjects, usefulEvents.length);
  const after = metricFor(afterProjects, usefulEvents.length);
  const needsHumanNaming = needsHumanNamingFor(usefulEvents);
  return {
    schemaVersion: "1.0",
    externalCallsMade: false,
    generatedAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().replace("Z", "+08:00"),
    baseline,
    after,
    improvement: {
      lowInfoProjectReduction: baseline.lowInfoProjectCountTop10 - after.lowInfoProjectCountTop10,
      templateEvidenceRateReduction: Number((baseline.templateEvidenceRateTop10 - after.templateEvidenceRateTop10).toFixed(3)),
      highConfidenceProjectRateGain: Number((after.highConfidenceProjectRateTop50 - baseline.highConfidenceProjectRateTop50).toFixed(3))
    },
    lowInfoPatterns: lowInfoPatternsFor(usefulEvents),
    aliasCandidates: aliasCandidatesFor(usefulEvents),
    topProjectsBefore: baselineProjects.slice(0, 50),
    topProjectsAfter: afterProjects.slice(0, 50),
    needsHumanNaming,
    recommendations: recommendationsFor(after, needsHumanNaming)
  };
}

function recommendationsFor(after, needsHumanNaming) {
  const items = [];
  if (after.lowInfoProjectCountTop10 > 2) items.push("继续扩充 low-info project 归类规则，优先处理 top10 污染。");
  if (after.templateEvidenceRateTop10 > 0.35) items.push("继续降低 evidence fallback，优先为 top projects 增加动作级摘要规则。");
  if (after.highConfidenceProjectRateTop50 < 0.65) items.push("需要改 ingest schema，保留更稳定的 workspace/project source。");
  if (needsHumanNaming.length) items.push("对 needsHumanNaming 中的高频原始项目名建立本地 alias。");
  if (!items.length) items.push("taxonomy gates passed; keep alias candidates local and review needsHumanNaming periodically.");
  return items;
}

export { NEEDS_HUMAN };
