import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyEvidence,
  classifyProjectName,
  isLowInfoProjectName,
  normalizeProjectCandidate,
  buildTaxonomyAudit
} from "./project-taxonomy.mjs";

function event({ id, project, summary, agent = "codex", date = "2026-06-27", type = "task_update" }) {
  return {
    schemaVersion: "1.0",
    eventId: id,
    idempotencyKey: `${agent}:${date}:${id}`,
    traceId: `trace-${id}`,
    date,
    sourceAgent: agent,
    sourceInstance: "local-fixture",
    workspace: "taxonomy-fixture",
    eventType: type,
    occurredAt: `${date}T10:00:00+08:00`,
    observedAt: `${date}T10:00:05+08:00`,
    state: "accepted",
    payload: {
      title: project,
      summary,
      details: "",
      project,
      status: "done",
      priority: "medium",
      tags: [],
      evidencePreview: "",
      stance: ""
    },
    privacy: { containsSecret: false, redactionStatus: "clean" },
    sourceIds: []
  };
}

const toolNameProject = event({
  id: "taxonomy-tool-project",
  project: "codex",
  summary: "审计 Hermes 使用量、调用次数和订阅方案。"
});
const toolNameClass = classifyProjectName("codex", toolNameProject.payload.summary, toolNameProject);
assert.notEqual(toolNameClass.confidence, "high", "tool-name project cannot be high confidence codex");
assert.equal(normalizeProjectCandidate(toolNameProject).project, "hermes", "tool-name project remaps to Hermes when summary proves it");

const newChat = event({
  id: "taxonomy-new-chat",
  project: "new-chat-2",
  summary: "生成 daybook 最近活跃日报告并修正项目图谱。"
});
assert.ok(isLowInfoProjectName("new-chat-2"), "new-chat-* is low-info");
assert.equal(normalizeProjectCandidate(newChat).project, "agent协同", "new-chat with daybook signal remaps to agent协同");

const realProject = event({
  id: "taxonomy-real-kline",
  project: "人生K线",
  summary: "整理人生 K 线 Dashboard、股市曲线和项目表达结构。"
});
const realClass = classifyProjectName(realProject.payload.project, realProject.payload.summary, realProject);
assert.equal(realClass.confidence, "high", "real project keeps high confidence");
assert.equal(normalizeProjectCandidate(realProject).project, "人生K线", "real project is preserved");

assert.equal(
  classifyEvidence("推进 X 的可读进展整理。").quality,
  "generic",
  "template fallback evidence is generic"
);

const secretAdjacent = event({
  id: "taxonomy-secret",
  project: "hermes",
  summary: "配置 API key 和 model id。"
});
assert.equal(classifyEvidence(secretAdjacent.payload.summary).quality, "noise", "secret-adjacent text cannot become evidence preview");

const fixtureAudit = buildTaxonomyAudit([
  toolNameProject,
  newChat,
  realProject,
  event({ id: "taxonomy-web", project: "动态网站", summary: "核对动态网站里的 Caffline 数据展示口径。" }),
  event({ id: "taxonomy-obs", project: "obs", summary: "核对 OBS / Caffline 相关数据和对外表述。" }),
  event({ id: "taxonomy-mac", project: "mac-youtube", summary: "排查 mac-youtube 本地预览和脚本运行问题。" }),
  event({ id: "taxonomy-wedding", project: "姜哥婚礼网页", summary: "调整婚礼网页视觉和移动端交付。" }),
  event({ id: "taxonomy-video", project: "自动视频", summary: "验证自动视频脚本和生成流程。" }),
  event({ id: "taxonomy-hermes-2", project: "hermes", summary: "沉淀 Hermes 失败复盘规则。" }),
  secretAdjacent
]);

assert.equal(fixtureAudit.after.lowInfoProjectCountTop10, 0, "fixture after top10 has no low-info project");
assert.ok(fixtureAudit.after.templateEvidenceRateTop10 <= 0.35, "fixture template rate is within gate");
assert.ok(fixtureAudit.after.highConfidenceProjectRateTop50 >= 0.65, "fixture high-confidence rate is within gate");

const taxonomyPath = resolve(import.meta.dirname, "../data/project-taxonomy.local.json");
if (existsSync(taxonomyPath)) {
  const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8"));
  assert.equal(taxonomy.externalCallsMade, false, "taxonomy audit is local-only");
  assert.ok(taxonomy.after.lowInfoProjectCountTop10 <= 2, "local after low-info top10 gate");
  assert.ok(taxonomy.after.templateEvidenceRateTop10 <= 0.35, "local after template evidence gate");
  assert.ok(taxonomy.after.highConfidenceProjectRateTop50 >= 0.65, "local after high-confidence gate");
  const forbiddenTop = /^(codex|Claude code|new-chat(?:-\d+)?|sessions?|Desktop|tmp|后台 \/ 杂项|codex-claude-code-claude-code-claude)$/i;
  const polluted = taxonomy.topProjectsAfter.slice(0, 10).filter((project) => forbiddenTop.test(project.project));
  assert.deepEqual(polluted, [], "local after top10 is not polluted by low-info names");
}

console.log("check-project-taxonomy: taxonomy checks passed");

