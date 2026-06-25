import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SOURCES } from "../src/data.js";
import { findUnredactedSecret } from "./secret-patterns.mjs";

const allowedAgents = new Set(["codex", "claude_code", "hermes"]);
const allowedInstances = new Set(["mock-ui", "local-fixture", "future-cli", "future-mcp", "local-import"]);
const allowedStates = new Set(["accepted", "duplicate", "conflict", "quarantined", "redacted", "pending_sync", "failed"]);
const allowedTypes = new Set([
  "heartbeat",
  "task_started",
  "task_update",
  "decision",
  "artifact",
  "blocked",
  "handoff",
  "learning",
  "suggestion",
  "source_captured",
  "sync_request",
  "sync_plan",
  "conflict",
  "quarantined"
]);
const sourceIds = new Set(SOURCES.map((source) => source.sourceId));

const filePath = process.argv[2] ? resolve(process.cwd(), process.argv[2]) : resolve(import.meta.dirname, "../data/events.sample.jsonl");
const text = await readFile(filePath, "utf8");
const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);

assert.ok(lines.length > 0, "jsonl must have at least one event");

const seenEventIds = new Set();
const seenIdempotencyKeys = new Set();
const agentsSeen = new Set();

lines.forEach((line, index) => {
  let event;
  try {
    event = JSON.parse(line);
  } catch (error) {
    throw new Error(`line ${index + 1}: invalid JSON: ${error.message}`);
  }

  validateEvent(event, index + 1);
  seenEventIds.add(event.eventId);
  seenIdempotencyKeys.add(event.idempotencyKey);
  agentsSeen.add(event.sourceAgent);
});

for (const agentId of allowedAgents) {
  assert.ok(agentsSeen.has(agentId), `sample should include ${agentId}`);
}

console.log(JSON.stringify({
  status: "passed",
  file: filePath,
  events: lines.length,
  agents: [...agentsSeen],
  externalCallsMade: false
}, null, 2));

function validateEvent(event, lineNumber) {
  const prefix = `line ${lineNumber}`;
  assert.equal(event.schemaVersion, "1.0", `${prefix}: schemaVersion`);
  assertString(event.eventId, `${prefix}: eventId`);
  assertString(event.idempotencyKey, `${prefix}: idempotencyKey`);
  assertString(event.traceId, `${prefix}: traceId`);
  assertString(event.date, `${prefix}: date`);
  assert.match(event.date, /^\d{4}-\d{2}-\d{2}$/, `${prefix}: date format`);
  assert.ok(allowedAgents.has(event.sourceAgent), `${prefix}: sourceAgent`);
  assert.ok(allowedInstances.has(event.sourceInstance), `${prefix}: sourceInstance`);
  assert.ok(typeof event.workspace === "string" && event.workspace.trim().length > 0, `${prefix}: workspace`);
  assert.ok(allowedTypes.has(event.eventType), `${prefix}: eventType`);
  assert.ok(allowedStates.has(event.state), `${prefix}: state`);
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/, `${prefix}: occurredAt must be Asia/Shanghai`);
  assert.match(event.observedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/, `${prefix}: observedAt must be Asia/Shanghai`);
  assert.ok(!seenEventIds.has(event.eventId), `${prefix}: duplicate eventId`);
  assert.ok(!seenIdempotencyKeys.has(event.idempotencyKey), `${prefix}: duplicate idempotencyKey`);

  assert.ok(event.payload && typeof event.payload === "object", `${prefix}: payload`);
  assertString(event.payload.title, `${prefix}: payload.title`);
  assertString(event.payload.summary, `${prefix}: payload.summary`);
  assert.ok(event.privacy && typeof event.privacy === "object", `${prefix}: privacy`);
  assert.equal(typeof event.privacy.containsSecret, "boolean", `${prefix}: privacy.containsSecret`);
  assert.ok(["clean", "redacted", "quarantined"].includes(event.privacy.redactionStatus), `${prefix}: privacy.redactionStatus`);

  assert.ok(Array.isArray(event.sourceIds), `${prefix}: sourceIds`);
  event.sourceIds.forEach((sourceId) => {
    assert.ok(sourceIds.has(sourceId), `${prefix}: unknown sourceId ${sourceId}`);
  });

  const secretPattern = findUnredactedSecret(JSON.stringify(event));
  assert.ok(!secretPattern, `${prefix}: forbidden token-shaped value (${secretPattern})`);
}

function assertString(value, label) {
  assert.equal(typeof value, "string", label);
  assert.ok(value.trim().length > 0, label);
}
