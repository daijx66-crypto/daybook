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
import { redactSecrets } from "./secret-patterns.mjs";

const HOME = process.env.HOME;
const ROOT = resolve(import.meta.dirname, "..");
const OUT = join(ROOT, "data", "events.local.jsonl");

// ---------- helpers ----------
function readHead(path, bytes = 220000) {
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

// Convert a UTC timestamp (or a file mtime) to a real Asia/Shanghai {date, time}.
// Codex/Claude store UTC; naively appending +08:00 would mis-bucket near midnight.
function localStamp(ts, fallbackPath) {
  let d = null;
  if (ts) { const x = new Date(ts); if (!isNaN(x.getTime())) d = x; }
  if (!d && fallbackPath) { try { d = statSync(fallbackPath).mtime; } catch { /* none */ } }
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).formatToParts(d);
  const get = (type) => (parts.find((p) => p.type === type) || {}).value;
  let hh = get("hour"); if (hh === "24") hh = "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hh}:${get("minute")}` };
}

let redactedHits = 0;
function redact(text) {
  if (!text) return "";
  const { text: redacted, redacted: changed } = redactSecrets(text);
  if (changed) redactedHits++;
  return redacted;
}

// Strip injected scaffolding (env context, system reminders, xml-ish tags) so a
// real instruction survives even when the agent wrapped it.
function stripTags(s) {
  return String(s)
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, " ")
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, " ")
    .replace(/<command-[\s\S]*?>/gi, " ")
    .replace(/<[^>\n]{1,48}>/g, " ")
    .replace(/Caveat:[^\n]*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clean(text, max) {
  const s = redact(stripTags(text)).replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
}

// Fold tool/work-dir residue (not real user projects) into one quiet bucket.
const NOISE_PROJECTS = new Set([
  "sessions", "Desktop", "tmp", "observer-sessions", "projects", "node_modules",
  ".claude", ".codex", "", "-", "T", "var", "folders", "private", "Documents",
  "djx", "new-chat", "untitled"
]);
const FOLD_LABEL = "后台 / 杂项";
function isNoiseProject(p) {
  return NOISE_PROJECTS.has(p) || /worktree|^tmp|\bT$|^\.[A-Za-z]/.test(String(p));
}
function foldProject(p) {
  return isNoiseProject(p) ? FOLD_LABEL : p;
}

// A piece reads like a human instruction once scaffolding is stripped.
function looksHuman(s) {
  const t = stripTags(s);
  if (t.length < 4) return false;
  if (/^#?\s*(AGENTS|CLAUDE|GEMINI|README)\.md/i.test(t)) return false; // injected repo instructions
  if (/instructions for \/|行为准则/i.test(t)) return false;
  if (/Asia\/Shanghai/.test(t) && t.length < 130) return false; // env_context residue
  if (/^(you are\b|you're a\b|hello memory agent|this session is being continued|please continue)/i.test(t)) return false;
  if (/claude-mem|continuing to observe/i.test(t)) return false;
  return true;
}

function textPieces(content) {
  if (typeof content === "string") return [content];
  if (Array.isArray(content)) {
    return content.map((p) => (p == null ? "" : (typeof p === "string" ? p : (p.text || "")))).filter(Boolean);
  }
  return [];
}

// Re-bucket flat task_update into the journal's four lanes by content.
function classifyType(text) {
  const t = String(text || "");
  if (/学到|发现|原来|root cause|turns out|lesson|复盘|教训/i.test(t)) return "learning";
  if (/明天|待办|todo|next step|接下来|下一步|roadmap|goal\b/i.test(t)) return "suggestion";
  if (/阻塞|blocked|卡在|崩溃|hang|报错|失败了|无法|timeout/i.test(t)) return "blocked";
  return "task_update";
}

function firstUserText(chunk) {
  for (const line of chunk.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const msg = obj.message || obj.payload || obj;
    const role = msg.role || obj.role || obj.type;
    if (role !== "user") continue;
    for (const piece of textPieces(msg.content ?? msg.text ?? obj.text)) {
      if (looksHuman(piece)) return stripTags(piece);
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
function pushEvent({ id, date, agent, type, time, title, summary, project, tags, secret, sessionCount }) {
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
      summary: clean(summary, 240),
      details: "",
      project: clean(project, 60),
      sessionCount: sessionCount || 1,
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

// Emit ONE event per session (real time), so the swimlane has real chips and the
// report can aggregate honestly. agent: "claude_code" | "codex".
function ingestSessions(agent, files) {
  let n = 0;
  for (const { path: p, projHint } of files) {
    let stamp, project, title;
    try {
      const head = readHead(p);
      const { ts, cwd } = scanMeta(head);
      stamp = localStamp(ts, p);
      if (!stamp) continue;
      const raw = cwd ? basename(cwd) : (projHint || agent);
      project = foldProject(raw);
      title = firstUserText(head);
    } catch { continue; }
    const sec = /\[REDACTED/.test(clean(title || "", 90));
    pushEvent({
      id: `${agent === "codex" ? "cx" : "cc"}-${stamp.date}-${stamp.time.replace(":", "")}-${slug(project)}`,
      date: stamp.date,
      agent,
      type: classifyType(title),
      time: stamp.time,
      title: project,
      summary: ((project !== FOLD_LABEL && title) ? clean(title, 200) : "") || project,
      project, tags: [agent === "codex" ? "codex" : "claude-code", "real"], secret: sec, sessionCount: 1
    });
    n++;
  }
  return n;
}

// ---------- 1. Claude Code ----------
function ingestClaude() {
  const base = join(HOME, ".claude", "projects");
  if (!existsSync(base)) return 0;
  const files = [];
  for (const proj of readdirSync(base)) {
    const dir = join(base, proj);
    const projHint = proj.replace(/^-+/, "").split("-").filter(Boolean).slice(-1)[0] || proj;
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith(".jsonl")) files.push({ path: join(dir, f), projHint });
      }
    } catch { continue; }
  }
  return ingestSessions("claude_code", files);
}

// ---------- 2. Codex ----------
function ingestCodex() {
  const base = join(HOME, ".codex", "sessions");
  if (!existsSync(base)) return 0;
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      const p = join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith(".jsonl")) files.push({ path: p, projHint: "codex" });
    }
  };
  walk(base);
  return ingestSessions("codex", files);
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
      const isMeta = (l) =>
        !l || l === "---" ||
        /^(last_updated|canonical|status|owner|date|tags|title|author|generated)\s*[:：]/i.test(l) ||
        (/^[a-zA-Z_-]+\s*:/.test(l) && !/[一-龥]/.test(l));
      const body = lines.filter((l) => !l.startsWith("#") && !isMeta(l));
      firstPara =
        body.find((l) => /[一-龥]/.test(l) && l.length > 10) ||
        body.find((l) => l.length > 10) ||
        lines.find((l) => l.startsWith("#"))?.replace(/^#+\s*/, "") || "";
    } catch { /* keep empty */ }
    const titleFromFile = f.replace(/\.md$/, "").replace(/_/g, " ");
    const type = /HANDOFF/i.test(f) ? "handoff" : /DECISION/i.test(f) ? "decision" : /TODO|ROADMAP|GOAL/i.test(f) ? "suggestion" : /REPORT|AUDIT|DIAGNOSIS/i.test(f) ? "artifact" : "task_update";
    const time = (localStamp(null, p) || { time: "22:00" }).time;
    pushEvent({
      id: `hm-${date}-${slug(titleFromFile)}`,
      date, agent: "hermes", type, time,
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
