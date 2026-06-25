import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EVENTS, JOURNAL_DATES, SOURCES } from "../src/data.js";
import { buildDailyProjection, buildDryRunSyncPlan, buildWeeklyPreview } from "../src/projection.js";

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

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
assert.ok(appSource.includes("JOURNAL_STORAGE_KEY"), "browser local journal key exists");
assert.ok(appSource.includes("persistLocalJournal"), "local writes persist in browser storage");
assert.ok(appSource.includes("exportEvents"), "local event export exists");

const jsonlFixture = await readFile(new URL("../data/events.sample.jsonl", import.meta.url), "utf8");
assert.ok(jsonlFixture.includes('"sourceAgent":"codex"'), "jsonl codex sample exists");
assert.ok(jsonlFixture.includes('"sourceAgent":"claude_code"'), "jsonl claude sample exists");
assert.ok(jsonlFixture.includes('"sourceAgent":"hermes"'), "jsonl hermes sample exists");

console.log("check-demo: all local projection checks passed");
