// Ingest the user's REAL local agent activity into daybook — LOCAL ONLY.
//
//   node scripts/ingest-local.mjs
//
// Reads three real sources on this machine and writes daybook journal events to
// data/events.local.jsonl (git-ignored — never committed, never public):
//   - claude_code  ← ~/.claude/projects/<proj>/*.jsonl   (Claude Code sessions)
//   - codex        ← ~/.codex/sessions/**/*.jsonl          (Codex rollout sessions)
//   - hermes       ← ~/Desktop/codex/hermes/*.md           (Hermes dated reports)
//
// Sessions are aggregated per (date, project) so the journal stays readable.
// Secret-shaped strings are redacted before anything is written.
import { readdirSync, statSync, openSync, readSync, closeSync, writeFileSync, existsSync } from "node:fs";
import { join, basename, resolve } from "node:path";

const HOME = process.env.HOME;
const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "events.local.jsonl");

// ---------- helpers ----------
function readHead(path, bytes = 65536) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const n = readSync(fd, buf, 0, bytes, 0);
    return buf.toString("utf8", 0, n);
  } finally {
    closeSync(fd);
  }
}

function mtimeDate(path) {
  return statSync(path).mtime.toISOString().slice(0, 10);
}

let redactedHits = 0;
function redact(text) {
  if (!text) return "";
  let s = String(text);
  const before = s;
  s = s
    .replace(/(api[_-]?key|secret|password|passwd|bearer|access[_-]?token|tenant_access_token)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/sk-[A-Za-z0-9]{12,}/g, "[REDACTED]")
    .replace(/ghp_[A-Za-z0-9]{20,}/g, "[REDACTED]")
    .replace(/xox[baprs]-[A-Za-z0-9-]{8,}/g, "[REDACTED]")
    .replace(/-----BEGIN[\s\S]*?-----/g, "[REDACTED KEY]");
  if (s !== before) redactedHits++;
  return s;
}

function clean(text, max) {
  const s = redact(text).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
}

function firstUserText(chunk) {
  for (const line of chunk.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const msg = obj.message || obj.payload || obj;
    const role = msg.role || obj.role || obj.type;
    if (role !== "user") continue;
    const content = msg.content ?? msg.text ?? obj.text;
    if (typeof content === "string" && content.trim()) return content;
    if (Array.isArray(content)) {
      const t = content.find((p) => p && (p.type === "text" || typeof p.text === "string"));
      if (t && t.text) return t.text;
    }
  }
  return "";
}

function scanMeta(chunk) {
  // best-effort: first timestamp + cwd from any line
  let ts = "", cwd = "";
  for (const line of chunk.split("\n")) {
    if (ts && cwd) break;
    if (!line.trim().startsWith("{")) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    ts = ts || obj.timestamp || obj.time || (obj.payload && obj.payload.timestamp) || "";
    cwd = cwd || obj.cwd || (obj.payload && obj.payload.cwd) || "";
  }
  return { ts, cwd };
}

// agg: Map key `${date}|${project}` -> { count, samples:Set }
function addSession(agg, date, project, title) {
  const key = `${date}|${project}`;
  if (!agg.has(key)) agg.set(key, { date, project, count: 0, samples: [] });
  const e = agg.get(key);
  e.count++;
  if (title && e.samples.length < 3 && !e.samples.includes(title)) e.samples.push(title);
}

const baseEnvelope = { schemaVersion: "1.0", workspace: "daybook-local", sourceInstance: "local-import" };
const out = [];
const usedIds = new Set();
function pushEvent({ id, date, agent, type, time, title, summary, project, tags, secret }) {
  let eid = id;
  let n = 1;
  while (usedIds.has(eid)) eid = `${id}-${n++}`;
  usedIds.add(eid);
  out.push({
    ...baseEnvelope,
    eventId: eid,
    idempotencyKey: `${agent}:${date}:${eid}`,
    traceId: `trace-local-${eid}`,
    date,
    sourceAgent: agent,
    eventType: type,
    occurredAt: `${date}T${time}:00+08:00`,
    observedAt: `${date}T${time}:05+08:00`,
    state: "accepted",
    payload: {
      title: clean(title, 90),
      summary: clean(summary, 220),
      details: "",
      project: clean(project, 60),
      status: "done",
      priority: "medium",
      tags: tags || [],
      evidencePreview: "",
      stance: ""
    },
    privacy: { containsSecret: Boolean(secret), redactionStatus: secret ? "redacted" : "clean" },
    sourceIds: []
  });
}

// ---------- 1. Claude Code ----------
function ingestClaude() {
  const base = join(HOME, ".claude", "projects");
  if (!existsSync(base)) return 0;
  const agg = new Map();
  for (const proj of readdirSync(base)) {
    const dir = join(base, proj);
    let files;
    try { files = readdirSync(dir).filter((f) => f.endsWith(".jsonl")); } catch { continue; }
    for (const f of files) {
      const p = join(dir, f);
      let date, project, title;
      try {
        const head = readHead(p);
        const { ts, cwd } = scanMeta(head);
        date = (ts && ts.slice(0, 10)) || mtimeDate(p);
        project = cwd ? basename(cwd) : proj.replace(/^-+/, "").split("-").filter(Boolean).slice(-1)[0] || proj;
        title = firstUserText(head);
      } catch { continue; }
      addSession(agg, date, project, title);
    }
  }
  for (const { date, project, count, samples } of agg.values()) {
    const sec = samples.some((s) => /\[REDACTED/.test(clean(s, 90)));
    pushEvent({
      id: `cc-${date}-${slug(project)}`,
      date, agent: "claude_code", type: "task_update", time: "21:30",
      title: project,
      summary: `${count} 个 Claude Code 会话` + (samples.length ? `：${samples.map((s) => clean(s, 60)).join("；")}` : ""),
      project, tags: ["claude-code", "real"], secret: sec
    });
  }
  return agg.size;
}

// ---------- 2. Codex ----------
function ingestCodex() {
  const base = join(HOME, ".codex", "sessions");
  if (!existsSync(base)) return 0;
  const agg = new Map();
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".jsonl")) {
        let date, project, title;
        try {
          const head = readHead(p);
          const { ts, cwd } = scanMeta(head);
          date = (ts && ts.slice(0, 10)) || mtimeDate(p);
          project = cwd ? basename(cwd) : "codex";
          title = firstUserText(head);
        } catch { continue; }
        addSession(agg, date, project, title);
      }
    }
  };
  walk(base);
  for (const { date, project, count, samples } of agg.values()) {
    pushEvent({
      id: `cx-${date}-${slug(project)}`,
      date, agent: "codex", type: "task_update", time: "21:00",
      title: project,
      summary: `${count} 个 Codex 会话` + (samples.length ? `：${samples.map((s) => clean(s, 60)).join("；")}` : ""),
      project, tags: ["codex", "real"]
    });
  }
  return agg.size;
}

// ---------- 3. Hermes ----------
function ingestHermes() {
  const base = join(HOME, "Desktop", "codex", "hermes");
  if (!existsSync(base)) return 0;
  let files;
  try { files = readdirSync(base).filter((f) => f.endsWith(".md")); } catch { return 0; }
  let n = 0;
  for (const f of files) {
    const p = join(base, f);
    const m = f.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    const date = m ? `${m[1]}-${m[2]}-${m[3]}` : mtimeDate(p);
    let firstPara = "";
    try {
      const head = readHead(p, 4000);
      const lines = head.split("\n").map((l) => l.trim());
      firstPara = lines.find((l) => l && !l.startsWith("#")) || lines.find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") || "";
    } catch { /* keep empty */ }
    const titleFromFile = f.replace(/\.md$/, "").replace(/_/g, " ");
    const type = /HANDOFF/i.test(f) ? "handoff" : /DECISION/i.test(f) ? "decision" : /TODO|ROADMAP|GOAL/i.test(f) ? "suggestion" : /REPORT|AUDIT|DIAGNOSIS/i.test(f) ? "artifact" : "task_update";
    pushEvent({
      id: `hm-${date}-${slug(titleFromFile)}`,
      date, agent: "hermes", type, time: "22:00",
      title: titleFromFile,
      summary: firstPara || titleFromFile,
      project: "hermes", tags: ["hermes", "real"]
    });
    n++;
  }
  return n;
}

const ccCount = ingestClaude();
const cxCount = ingestCodex();
const hmCount = ingestHermes();

// sort by date desc, then agent
out.sort((a, b) => b.date.localeCompare(a.date) || a.sourceAgent.localeCompare(b.sourceAgent));
writeFileSync(OUT, out.map((e) => JSON.stringify(e)).join("\n") + "\n");

const dates = [...new Set(out.map((e) => e.date))].sort();
console.log(JSON.stringify({
  wrote: OUT,
  events: out.length,
  claude_code_groups: ccCount,
  codex_groups: cxCount,
  hermes_files: hmCount,
  date_range: dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "none",
  distinct_dates: dates.length,
  redactions: redactedHits,
  external_calls: false
}, null, 2));
