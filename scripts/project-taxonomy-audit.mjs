import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { buildTaxonomyAudit, classifyEvidence } from "./project-taxonomy.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const EVENTS_FILE = resolve(ROOT, "data/events.local.jsonl");
const JSON_OUT = resolve(ROOT, "data/project-taxonomy.local.json");
const MD_OUT = resolve(ROOT, "reports/taxonomy/latest.local.md");

const events = readFileSync(EVENTS_FILE, "utf8")
  .split(/\r?\n/)
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

const audit = buildTaxonomyAudit(events);
const markdown = renderMarkdown(audit);
assertNoForbidden(`${JSON.stringify(audit)}\n${markdown}`);
write(JSON_OUT, JSON.stringify(audit, null, 2) + "\n");
write(MD_OUT, markdown);

console.log(JSON.stringify({
  status: "passed",
  json: JSON_OUT,
  markdown: MD_OUT,
  baseline: audit.baseline,
  after: audit.after,
  improvement: audit.improvement,
  needsHumanNaming: audit.needsHumanNaming.length,
  externalCallsMade: false
}, null, 2));

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function assertNoForbidden(value) {
  const match = String(value || "").match(/API key|model id|bearer token|environment_context|system-reminder|read the full prompt from stdin|请帮我|你让我/i);
  if (match) throw new Error(`taxonomy output contains forbidden text: ${match[0]}`);
}

function renderMarkdown(audit) {
  const lines = [
    "# daybook 项目归类质量审计",
    "",
    "## Before / After",
    `- lowInfoProjectCountTop10：${audit.baseline.lowInfoProjectCountTop10} -> ${audit.after.lowInfoProjectCountTop10}`,
    `- templateEvidenceRateTop10：${audit.baseline.templateEvidenceRateTop10} -> ${audit.after.templateEvidenceRateTop10}`,
    `- highConfidenceProjectRateTop50：${audit.baseline.highConfidenceProjectRateTop50} -> ${audit.after.highConfidenceProjectRateTop50}`,
    `- needsHumanNaming：${audit.needsHumanNaming.length}`,
    "- 外部写入：0",
    "",
    "## Top Projects Before"
  ];
  for (const project of audit.topProjectsBefore.slice(0, 10)) {
    lines.push(`- **${project.project}**：${project.usefulEventCount} 条；置信度 ${project.confidence}；证据质量 ${evidenceQuality(project)}`);
  }
  lines.push("", "## Top Projects After");
  for (const project of audit.topProjectsAfter.slice(0, 10)) {
    lines.push(`- **${project.project}**：${project.usefulEventCount} 条；置信度 ${project.confidence}；证据：${project.evidencePreview.join(" / ") || "暂无"}`);
  }
  lines.push("", "## Alias Candidates");
  if (audit.aliasCandidates.length) {
    for (const alias of audit.aliasCandidates.slice(0, 12)) {
      lines.push(`- ${alias.from} -> **${alias.to}**：${alias.count} 条`);
    }
  } else {
    lines.push("- 暂无自动 alias 候选。");
  }
  lines.push("", "## Needs Human Naming");
  if (audit.needsHumanNaming.length) {
    for (const item of audit.needsHumanNaming.slice(0, 12)) {
      lines.push(`- **${item.originalProject}**：${item.count} 条；原因：${item.reason}`);
    }
  } else {
    lines.push("- 暂无。");
  }
  lines.push("", "## Recommendations");
  for (const item of audit.recommendations) lines.push(`- ${item}`);
  return lines.join("\n") + "\n";
}

function evidenceQuality(project) {
  const previews = project.evidencePreview || [];
  if (!previews.length) return "none";
  const qualities = previews.map((preview) => classifyEvidence(preview).quality);
  return qualities.every((quality) => quality === "specific") ? "specific" : qualities.join(",");
}

