#!/usr/bin/env node
// One-command practical loop: ingest real local agent activity, write today's
// human report, then serve the board. Public Pages stay demo-data-only.
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const node = process.execPath;

function run(script, args = []) {
  const result = spawnSync(node, [resolve(root, script), ...args], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run("scripts/ingest-local.mjs");
run("scripts/generate-human-report.mjs");

const url = "http://127.0.0.1:5177/";
console.log(`\ndaybook ready → ${url}`);
console.log("Local data stays git-ignored. Ctrl+C to stop.\n");

const child = spawn("python3", ["-m", "http.server", "5177", "--bind", "127.0.0.1"], {
  cwd: root,
  stdio: "inherit"
});

child.on("exit", (code) => process.exit(code || 0));
process.on("SIGINT", () => {
  child.kill("SIGINT");
  process.exit(0);
});
