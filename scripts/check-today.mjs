import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { beijingDate } from "./beijing-date.mjs";

const sourceRoot = resolve(import.meta.dirname, "..");
const fixtures = [];

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), "daybook-today-"));
  fixtures.push(root);
  cpSync(join(sourceRoot, "scripts"), join(root, "scripts"), { recursive: true });
  cpSync(join(sourceRoot, "src"), join(root, "src"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "reports", "daily"), { recursive: true });
  const home = join(root, "home");
  mkdirSync(home, { recursive: true });
  return { root, home };
}

function prepareOnly(fixture) {
  return spawnSync(process.execPath, [join(fixture.root, "scripts", "today.mjs"), "--prepare-only"], {
    cwd: fixture.root,
    env: { ...process.env, HOME: fixture.home },
    encoding: "utf8",
    timeout: 10_000
  });
}

try {
  assert.equal(beijingDate(new Date("2026-07-10T15:59:59Z")), "2026-07-10");
  assert.equal(beijingDate(new Date("2026-07-10T16:00:00Z")), "2026-07-11");

  const empty = makeFixture();
  const emptyRun = prepareOnly(empty);
  assert.equal(emptyRun.status, 0, `empty first run should prepare setup data:\n${emptyRun.stderr}`);
  const emptyReportPath = join(empty.root, "data", "daily-human-report.local.json");
  assert.ok(existsSync(emptyReportPath), "empty first run should still write today's report envelope");
  const emptyReport = JSON.parse(readFileSync(emptyReportPath, "utf8"));
  assert.equal(emptyReport.date, beijingDate(), "today loop must use the Asia/Shanghai calendar day");

  const existing = makeFixture();
  const existingReportPath = join(existing.root, "data", "daily-human-report.local.json");
  const existingMarkdownPath = join(existing.root, "reports", "daily", `${beijingDate()}.md`);
  const jsonSentinel = JSON.stringify({
    date: beijingDate(),
    source: "codex-human",
    sentinel: "keep-user-report"
  }) + "\n";
  const markdownSentinel = "# keep-user-report\n\nDo not overwrite this human report.\n";
  writeFileSync(existingReportPath, jsonSentinel);
  writeFileSync(existingMarkdownPath, markdownSentinel);
  const preserveRun = prepareOnly(existing);
  assert.equal(preserveRun.status, 0, `preserve run should succeed:\n${preserveRun.stderr}`);
  assert.equal(readFileSync(existingReportPath, "utf8"), jsonSentinel, "today loop must preserve the human JSON report");
  assert.equal(readFileSync(existingMarkdownPath, "utf8"), markdownSentinel, "today loop must preserve the human Markdown report");

  const pkg = JSON.parse(readFileSync(join(sourceRoot, "package.json"), "utf8"));
  assert.equal(pkg.scripts["report:human"], "node scripts/today.mjs --prepare-only", "report:human must share today's safe path");

  console.log("check-today: Beijing date, empty first run, and report preservation passed");
} finally {
  for (const fixture of fixtures) {
    if (existsSync(fixture)) rmSync(fixture, { recursive: true, force: true });
  }
}
