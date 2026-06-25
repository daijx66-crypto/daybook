import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const sampleText = await readFile(new URL("../data/events.sample.jsonl", import.meta.url), "utf8");
const sampleEvents = sampleText.trim().split(/\r?\n/).map((line) => JSON.parse(line));

const cases = [
  ["openai_key", "fake key sk-AAAAAAAAAAAAAA should be rejected"],
  ["github_pat", "fake token ghp_AAAAAAAAAAAAAAAAAAAA should be rejected"],
  ["slack_token", "fake token xoxb-AAAAAAAA should be rejected"],
  ["bearer_token", "Authorization: Bearer fakebearertoken should be rejected"],
  ["api_key_assignment", "api_key=fakevalue should be rejected"],
  ["private_key", "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY----- should be rejected"]
];

const tempDir = await mkdtemp(join(tmpdir(), "daybook-security-"));
try {
  for (const [name, secretText] of cases) {
    const events = sampleEvents.map((event) => ({ ...event, payload: { ...event.payload } }));
    events[0].eventId = `security-${name}`;
    events[0].idempotencyKey = `codex:2026-06-25:security-${name}`;
    events[0].payload.summary = secretText;
    const file = join(tempDir, `${name}.jsonl`);
    await writeFile(file, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);

    const result = spawnSync(process.execPath, [fileURLToPath(new URL("./validate-jsonl.mjs", import.meta.url)), file], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      encoding: "utf8"
    });

    assert.notEqual(result.status, 0, `${name}: validator should reject token-shaped content`);
    assert.match(`${result.stderr}\n${result.stdout}`, /forbidden token-shaped value/, `${name}: rejection should explain token-shaped value`);
  }

  console.log(JSON.stringify({
    status: "passed",
    cases: cases.map(([name]) => name)
  }, null, 2));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
