import { AGENTS, EVENTS } from "./data.js";
import {
  agentMeta,
  buildCollab,
  buildDailyProjection,
  buildDailyReport,
  buildDryRunSyncPlan,
  buildWeeklyPreview,
  dates,
  displayLine,
  getSources,
  isDisplayNoise,
  sourceById,
  stateLabel
} from "./projection.js";

const app = document.querySelector("#app");
const JOURNAL_STORAGE_KEY = "agent-sync-demo.local-events.v1";
const LOCAL_IMPORT_FILE = "./data/events.local.jsonl";
const HUMAN_REPORT_FILE = "./data/daily-human-report.local.json";
const QUALITY_REPORT_FILE = "./data/report-quality.local.json";
const PREFS_KEY = "daybook.prefs.v1";
const TODAY_COMMAND = "npm run today";
const loadedLocalJournal = loadLocalJournal();
const prefs = loadPrefs();
const localDevHost = isLocalDevHost();
const state = {
  selectedDate: beijingToday(),
  agentFilter: "all",
  rightTab: "conversation",
  conversationFilter: "all",
  selectedSourceId: "src-feishu-doc-daily",
  selectedSafetyId: null,
  dryRunOpen: false,
  generatedWeekly: false,
  search: "",
  storageStatus: loadedLocalJournal.status,
  importedCount: 0,
  lang: prefs.lang,
  theme: prefs.theme,
  rightOpen: prefs.rightOpen,
  dateOffset: 0,
  publishTarget: null,
  summarizer: prefs.summarizer,
  view: prefs.view,
  openAgents: new Set(),
  reportGen: false,
  humanReport: null,
  qualityReport: null,
  // Local http://127.0.0.1 starts empty until real ingest lands; public/demo keeps seed.
  dataMode: localDevHost ? "loading" : "demo",
  events: localDevHost
    ? mergeEvents([], loadedLocalJournal.events)
    : mergeEvents(EVENTS, loadedLocalJournal.events),
  dateList: []
};

function isLocalDevHost() {
  try {
    const host = window.location.hostname;
    return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  } catch {
    return false;
  }
}

function beijingToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// Prefer calendar today (Asia/Shanghai) when that day has real events; else newest.
function pickDefaultDate(imported) {
  const allDates = [...new Set(imported.map((e) => e.date))].sort().reverse();
  const today = beijingToday();
  if (allDates.includes(today)) return today;
  return allDates[0];
}

function loadPrefs() {
  const fallback = { lang: "zh", theme: "light", rightOpen: false, summarizer: "claude_code", view: "report" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return fallback;
  }
}

function persistPrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      lang: state.lang, theme: state.theme, rightOpen: state.rightOpen, summarizer: state.summarizer, view: state.view
    }));
  } catch { /* ignore */ }
}

// --- i18n: translate the UI chrome only; agent names, project names and the
// real content stay untouched. ---
const I18N = {
  zh: {
    tagline: "多 agent 夜间工作日志", dailyReview: "每日回顾 · 上海",
    threadsCap: "跨 agent 交流", clash: "今天 agent 之间的交锋", cowork: "今天谁和谁在一起干活",
    threadsEmpty: "今天三个 agent 没有在同一个项目上交集。各自的进展见下方。",
    flagDisagree: "有分歧", flagCowork: "同台协作", flagAligned: "已对齐", thread: "条", threadsWord: "条交流",
    done: "完成", learned: "学到", tomorrow: "明天", blockers: "待解决", sources: "来源",
    composer: "写一条本地记录…", addNote: "添加本地记录",
    dates: "日期", status: "本地状态", boundary: "边界",
    boundaryText: "只读你本机的真实活动（gitignore，不进公开仓库）；不写真实飞书、不调外部 API、不读密钥。",
    tabSources: "信息源", tabConversation: "对话流", tabWeekly: "周报", tabSafety: "安全",
    metricReal: "真实事件", metricProjects: "今日项目", metricAgents: "活跃 agent",
    prevDay: "前一周", nextDay: "后一周", toggleRight: "证据抽屉",
    latest: "最新", imported: "已导入", real: "条真实", exportJson: "导出 JSON", today: "今天",
    diaryAcross: "今天在", diaryProjects: "个项目", diarySessions: "次会话", noActivity: "今天没有留下记录。",
    tomorrowLabel: "明天建议", blockersLabel: "待解决",
    convHeading: "当天对话流", weeklyDraft: "已生成周报草稿", weeklyPreview: "周报预览", weeklyGenerate: "生成",
    weeklyEmpty: "暂无内容，等待更多本地事件。", safetyHeading: "可信状态", sourceMapHeading: "信息源索引",
    feishuMock: "飞书 Mock", localEvidence: "本地证据", noSources: "没有匹配的信息源。",
    safetyEmpty: "今天没有需要人工确认的安全项。", dryRunHeading: "飞书写入预览", close: "关闭", selectedSource: "选中信息源",
    reportCap: "今日产出", reportTitle: "今日日报", expand: "展开", collapse: "收起",
    overview: "今日总览", publish: "推送预览", copyMd: "复制 Markdown", sendTo: "发给",
    dryRunNote: "v1 仅 dry-run / 复制：不真实发送、不写飞书、不读密钥、不建定时任务。",
    copied: "已复制", risksLabel: "风险 / 待解决", noReport: "今天还没有可成报的真实活动。", coworkWord: "处协作",
    allAgents: "全部", wWins: "完成", wLearnings: "学到", wRisks: "风险 / 冲突", wNext: "下一步",
    mechDraft: "人话版", mechDraftHint: "从本地事件整理成可读日报；每日自动任务会继续改写这份报告。",
    sparseHint: "今天数据较少，建议查看最近活跃日报告。",
    summarizer: "摘要器", generate: "生成", expandRaw: "展开原话 ▾", collapseRaw: "收起原话 ▴",
    viewReport: "日报", viewCollab: "协作",
    collabCap: "今日协作", collabHeading: "今天谁在推进什么",
    convergeWith: "交汇于", convergeHeading: "同台项目", noCollab: "今天没有可视化的真实活动。",
    collabHint: "只读复盘：行=agent，横轴=真实时间，色块=会话（按项目着色）；同色跨行=同一项目上的交汇。", sessionsUnit: "会话",
    modeReal: "真实", modeDemo: "Demo", modeSetup: "待接入", modeLoading: "加载中",
    setupTitle: "先接入你自己的 Agent 活动",
    setupBody: "本地还没有 events.local.jsonl。在项目根目录跑下面这一条命令，会摄入 Claude Code / Codex / Hermes 的本地活动，生成今日人话日报，并打开这块板。",
    setupCopy: "复制命令",
    setupHint: "公开 Pages 仍只展示 demo 数据；真实会话只留在本机 gitignore 文件里。",
    copyCmdDone: "已复制命令"
  },
  en: {
    tagline: "Multi-agent nightly work journal", dailyReview: "Daily review · Shanghai",
    threadsCap: "Cross-agent threads", clash: "Where they clashed today", cowork: "Who worked together today",
    threadsEmpty: "No shared project across agents today. See each agent below.",
    flagDisagree: "Disagreed", flagCowork: "Co-worked", flagAligned: "Aligned", thread: "", threadsWord: "threads",
    done: "Done", learned: "Learned", tomorrow: "Tomorrow", blockers: "Needs attention", sources: "Sources",
    composer: "Write a local note…", addNote: "Add local note",
    dates: "Dates", status: "Local status", boundary: "Boundary",
    boundaryText: "Reads only your real local activity (git-ignored, never public); no real Feishu, no external API, no secrets.",
    tabSources: "Sources", tabConversation: "Conversation", tabWeekly: "Weekly", tabSafety: "Safety",
    metricReal: "Real events", metricProjects: "Projects today", metricAgents: "Active agents",
    prevDay: "Previous week", nextDay: "Next week", toggleRight: "Evidence drawer",
    latest: "Latest", imported: "Imported", real: " real", exportJson: "Export JSON", today: "Today",
    diaryAcross: "Across", diaryProjects: "projects", diarySessions: "sessions", noActivity: "No activity logged today.",
    tomorrowLabel: "Tomorrow", blockersLabel: "Needs attention",
    convHeading: "Conversation", weeklyDraft: "Weekly draft", weeklyPreview: "Weekly preview", weeklyGenerate: "Generate",
    weeklyEmpty: "Nothing yet — needs more local events.", safetyHeading: "Trust & safety", sourceMapHeading: "Source index",
    feishuMock: "Feishu (mock)", localEvidence: "Local evidence", noSources: "No matching source.",
    safetyEmpty: "Nothing to review today.", dryRunHeading: "Feishu dry-run", close: "Close", selectedSource: "Selected source",
    reportCap: "Today's output", reportTitle: "Daily report", expand: "Expand", collapse: "Collapse",
    overview: "Overview", publish: "Publish", copyMd: "Copy Markdown", sendTo: "Send to",
    dryRunNote: "v1 is dry-run / copy only: no real send, no Feishu writes, no secrets, no cron.",
    copied: "Copied", risksLabel: "Risks / blockers", noReport: "No real activity to report yet today.", coworkWord: "co-work",
    allAgents: "All", wWins: "Wins", wLearnings: "Learnings", wRisks: "Risks / conflicts", wNext: "Next actions",
    mechDraft: "Human-readable", mechDraftHint: "Prepared from local events; the nightly automation rewrites this report.",
    sparseHint: "Sparse latest day. Use the recent active-days report.",
    summarizer: "Summarizer", generate: "Generate", expandRaw: "Show raw ▾", collapseRaw: "Hide raw ▴",
    viewReport: "Report", viewCollab: "Collab",
    collabCap: "Today's collaboration", collabHeading: "Who advanced what today",
    convergeWith: "converges with", convergeHeading: "Shared projects", noCollab: "No real activity to visualize today.",
    collabHint: "Read-only review: rows = agents, x = real time, blocks = sessions (colored by project); same color across rows = they met on that project.", sessionsUnit: "sessions",
    modeReal: "Real", modeDemo: "Demo", modeSetup: "Setup", modeLoading: "Loading",
    setupTitle: "Connect your own agent activity first",
    setupBody: "No events.local.jsonl yet. From the repo root, run the command below to ingest Claude Code / Codex / Hermes activity, generate today's human report, and open this board.",
    setupCopy: "Copy command",
    setupHint: "Public Pages stay demo-only. Real sessions never leave git-ignored local files.",
    copyCmdDone: "Command copied"
  }
};
const STANCE_I18N = {
  zh: { disagree: ["✗", "反驳"], agree: ["✓", "同意"], build: ["↗", "推进"], co_worked: ["⇄", "同台"], handoff: ["→", "接力"], open: ["•", "提出"] },
  en: { disagree: ["✗", "Pushed back"], agree: ["✓", "Agreed"], build: ["↗", "Built on"], co_worked: ["⇄", "Co-worked"], handoff: ["→", "Handoff"], open: ["•", "Opened"] }
};
function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.zh[key] || key;
}
function applyTheme() {
  try { document.documentElement.setAttribute("data-theme", state.theme); } catch { /* ignore */ }
}

// Build the date rail from whatever events exist (seed + local import), newest first.
function computeDateList(events) {
  const seedThemes = new Map(dates().map((d) => [d.date, d.theme]));
  const uniq = [...new Set(events.map((event) => event.date))].sort((a, b) => b.localeCompare(a));
  return uniq.map((date, index) => ({
    date,
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date(`${date}T12:00:00+08:00`)),
    label: index === 0 ? "最新" : "",
    theme: seedThemes.get(date) || "每日同步"
  }));
}

state.dateList = computeDateList(state.events);
state.selectedDate = state.dateList[0]?.date || state.selectedDate;

function enterSetupMode() {
  const ownNotes = state.events.filter((event) => event.sourceInstance === "mock-ui");
  const today = beijingToday();
  state.dataMode = "setup";
  state.events = ownNotes;
  state.importedCount = 0;
  state.humanReport = null;
  state.qualityReport = null;
  state.dateList = [{
    date: today,
    weekday: new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", weekday: "short" }).format(new Date(`${today}T12:00:00+08:00`)),
    label: t("today"),
    theme: "setup"
  }];
  state.selectedDate = today;
  state.dateOffset = 0;
}

// Merge the user's REAL local activity (data/events.local.jsonl) when served over
// http. Stays empty on file:// or when the file is absent — the public build never
// ships real data. Runs after the first render, then re-renders.
async function importLocalFile() {
  try {
    const res = await fetch(LOCAL_IMPORT_FILE, { cache: "no-store" });
    if (!res.ok) throw new Error("missing-local");
    const text = await res.text();
    const imported = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .filter(isJournalEvent);
    if (!imported.length) throw new Error("empty-local");
    // Local view is 100% REAL: drop the seed demo entirely, keep only imported
    // real activity + any notes the user typed here. No fabricated data on screen.
    const ownNotes = state.events.filter((event) => event.sourceInstance === "mock-ui");
    state.events = mergeEvents(imported, ownNotes);
    state.importedCount = imported.length;
    state.dataMode = "real";
    state.dateList = computeDateList(state.events);
    state.selectedDate = pickDefaultDate(imported);
    const idx = state.dateList.findIndex((d) => d.date === state.selectedDate);
    state.dateOffset = idx < 0 ? 0 : Math.floor(idx / 7) * 7;
    await importHumanReport();
    await importQualityReport();
    render();
  } catch {
    if (localDevHost) {
      enterSetupMode();
      render();
      return;
    }
    state.dataMode = "demo";
    /* file:// or public Pages — keep seed demo */
  }
}

async function importHumanReport() {
  try {
    const res = await fetch(HUMAN_REPORT_FILE, { cache: "no-store" });
    if (!res.ok) return;
    const report = await res.json();
    if (report && report.schemaVersion === "1.0" && report.date) {
      state.humanReport = report;
    }
  } catch {
    /* expected when no local generated report exists */
  }
}

async function importQualityReport() {
  try {
    const res = await fetch(QUALITY_REPORT_FILE, { cache: "no-store" });
    if (!res.ok) return;
    const report = await res.json();
    if (report && report.schemaVersion === "1.0" && report.latestDate) {
      state.qualityReport = report;
    }
  } catch {
    /* expected when no local quality report exists */
  }
}

function loadLocalJournal() {
  if (typeof localStorage === "undefined") {
    return { status: "memory-only", events: [] };
  }
  try {
    const raw = localStorage.getItem(JOURNAL_STORAGE_KEY);
    if (!raw) return { status: "ready", events: [] };
    const parsed = JSON.parse(raw);
    const events = Array.isArray(parsed.events) ? parsed.events.filter(isJournalEvent) : [];
    return { status: "ready", events };
  } catch {
    return { status: "storage-error", events: [] };
  }
}

function mergeEvents(seed, localEvents) {
  const byId = new Map();
  [...seed, ...localEvents].forEach((event) => byId.set(event.eventId, event));
  return [...byId.values()];
}

function isJournalEvent(event) {
  return Boolean(
    event &&
    event.schemaVersion === "1.0" &&
    typeof event.eventId === "string" &&
    typeof event.date === "string" &&
    ["codex", "claude_code", "hermes"].includes(event.sourceAgent) &&
    event.payload &&
    typeof event.payload.summary === "string"
  );
}

function localEvents() {
  return state.events.filter((event) => event.sourceInstance === "mock-ui");
}

function persistLocalJournal() {
  if (typeof localStorage === "undefined") {
    state.storageStatus = "memory-only";
    return;
  }
  try {
    localStorage.setItem(JOURNAL_STORAGE_KEY, JSON.stringify({
      schemaVersion: "1.0",
      savedAt: new Date().toISOString(),
      events: localEvents()
    }));
    state.storageStatus = "ready";
  } catch {
    state.storageStatus = "storage-error";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "short",
    day: "numeric"
  }).format(new Date(`${date}T12:00:00+08:00`));
}

function render() {
  applyTheme();
  if (state.dataMode === "loading") {
    app.innerHTML = `
      <div class="setup-shell">
        <div class="setup-card">
          <p class="small-caps">daybook</p>
          <h2>${t("modeLoading")}…</h2>
          <p class="muted">${state.lang === "zh" ? "正在读取本机 events.local.jsonl（可能需要几秒）…" : "Reading local events.local.jsonl (may take a few seconds)…"}</p>
          <p class="muted">${t("setupHint")}</p>
        </div>
      </div>
    `;
    return;
  }
  if (state.dataMode === "setup") {
    app.innerHTML = renderSetup();
    bindEvents();
    return;
  }

  const daily = buildDailyProjection(state.selectedDate, state.events);
  const weekly = buildWeeklyPreview(state.selectedDate, state.events);
  const plan = buildDryRunSyncPlan(state.selectedDate, state.events);

  app.innerHTML = `
    <div class="app-root ${state.rightOpen ? "right-open" : "right-collapsed"} ${state.dryRunOpen ? "drawer-open" : ""}">
      ${renderTopbar(daily)}
      <div class="shell">
        <main class="workspace">
          ${renderDailyHeader(daily)}
          ${state.view === "collab"
            ? renderCollab(buildCollab(state.selectedDate, state.events))
            : `
              ${renderDailyReport(buildDailyReport(state.selectedDate, state.events))}
              ${renderThreads(daily)}
              <section class="agent-grid" aria-label="agents">
                ${daily.agents.filter(hasAgentContent).map((agent) => renderAgentColumn(agent, daily)).join("")}
              </section>
            `}
        </main>
        <aside class="right-panel" aria-label="evidence drawer">
          ${renderRightPanel(daily, weekly)}
        </aside>
      </div>
      ${state.dryRunOpen ? renderDryRunDrawer(plan) : ""}
    </div>
  `;

  bindEvents();
}

function renderSetup() {
  return `
    <div class="setup-shell">
      <div class="setup-card">
        <div class="setup-brand">
          <div class="brand-mark">db</div>
          <div>
            <h1>daybook</h1>
            <p>夜谈台 · ${t("tagline")}</p>
          </div>
          <span class="mode-pill setup">${t("modeSetup")}</span>
        </div>
        <h2>${t("setupTitle")}</h2>
        <p>${t("setupBody")}</p>
        <div class="setup-command">
          <code>${TODAY_COMMAND}</code>
          <button class="primary compact" data-action="copy-today-cmd">${t("setupCopy")}</button>
        </div>
        <p class="muted">${t("setupHint")}</p>
        <div class="capsule" role="group" aria-label="language and theme">
          <button class="capsule-half" data-action="toggle-lang" title="中 / EN">${state.lang === "zh" ? "中" : "EN"}</button>
          <span class="capsule-div"></span>
          <button class="capsule-half" data-action="toggle-theme" title="light / dark">${state.theme === "dark" ? "☾" : "☀"}</button>
        </div>
      </div>
    </div>
  `;
}

function modePill() {
  if (state.dataMode === "real") {
    return `<span class="mode-pill real">${t("modeReal")}${state.importedCount ? ` · ${state.importedCount}` : ""}</span>`;
  }
  if (state.dataMode === "demo") return `<span class="mode-pill demo">${t("modeDemo")}</span>`;
  return `<span class="mode-pill setup">${t("modeSetup")}</span>`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through */ }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-9999px";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function renderSidebar(daily) {
  return `
    <aside class="sidebar">
      <div class="sidebar-section">
        <div class="section-label">${t("dates")}</div>
        <div class="date-list">
          ${state.dateList.slice(0, 30).map((item) => `
            <button class="date-item ${item.date === state.selectedDate ? "active" : ""}" data-date="${item.date}">
              <span>${item.weekday}</span>
              <strong>${fmtDate(item.date)}</strong>
              <em>${item.date === state.dateList[0].date ? t("latest") : ""}</em>
            </button>
          `).join("")}
        </div>
      </div>
      <div class="sidebar-section health-panel">
        <div class="section-label">${t("status")}</div>
        <div class="health-row"><span>${t("imported")}</span><strong>${state.importedCount ? `${state.importedCount}${t("real")}` : "—"}</strong></div>
        <div class="health-row"><span>External calls</span><strong>0</strong></div>
        <button class="secondary full-width" data-action="export-events">${t("exportJson")}</button>
      </div>
      <div class="local-note">
        <strong>${t("boundary")}</strong>
        <p>${t("boundaryText")}</p>
      </div>
    </aside>
  `;
}

function rightPanelIcon() {
  // a panel with a divider on the RIGHT (left/right distinction, not up/down)
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.6"/><line x1="10.2" y1="2.6" x2="10.2" y2="13.4"/></svg>`;
}

function renderTopbar(daily) {
  const langLabel = state.lang === "zh" ? "中" : "EN";
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const maxOffset = Math.max(0, state.dateList.length - 7);
  const offset = Math.min(state.dateOffset, maxOffset);
  // dateList is newest-first; show the week oldest→newest (left→right) so the axis
  // reads like a calendar and ‹ = previous (older) week, › = next (newer) week.
  const week = state.dateList.slice(offset, offset + 7).reverse();
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-mark">db</div>
        <div class="brand-text">
          <h1>daybook</h1>
          <p>夜谈台 · ${t("tagline")}</p>
        </div>
        ${modePill()}
        <div class="capsule" role="group" aria-label="language and theme">
          <button class="capsule-half" data-action="toggle-lang" title="中 / EN">${langLabel}</button>
          <span class="capsule-div"></span>
          <button class="capsule-half" data-action="toggle-theme" title="light / dark">${themeIcon}</button>
        </div>
      </div>
      <div class="topbar-dates">
        <button class="icon-button" data-action="prev-week" title="${t("prevDay")}" ${offset >= maxOffset ? "disabled" : ""}>‹</button>
        <div class="week-strip">
          ${week.map((item) => `
            <button class="day-chip ${item.date === state.selectedDate ? "active" : ""}" data-date="${item.date}">
              <span>${item.weekday}</span>
              <strong>${fmtDate(item.date)}</strong>
            </button>
          `).join("")}
        </div>
        <button class="icon-button" data-action="next-week" title="${t("nextDay")}" ${offset <= 0 ? "disabled" : ""}>›</button>
      </div>
      <div class="topbar-right">
        <div class="segmented view-toggle">
          <button class="${state.view === "report" ? "active" : ""}" data-view="report">${t("viewReport")}</button>
          <button class="${state.view === "collab" ? "active" : ""}" data-view="collab">${t("viewCollab")}</button>
        </div>
        <button class="icon-button ${state.rightOpen ? "on" : ""}" data-action="toggle-right" title="${t("toggleRight")}">${rightPanelIcon()}</button>
      </div>
    </header>
  `;
}

function renderDailyHeader(daily) {
  const dayEvents = state.events.filter((event) => event.date === state.selectedDate);
  const meaningfulEvents = dayEvents.filter((event) => !isDisplayNoise(event) && displayLine(event));
  const projects = new Set(meaningfulEvents.map((e) => e.payload.project).filter(Boolean)).size;
  const activeAgents = new Set(meaningfulEvents.map((e) => e.sourceAgent)).size;
  return `
    <section class="daily-header">
      <div class="daily-headline">
        <p class="small-caps">${t("dailyReview")}</p>
        <h2>${escapeHtml(daily.title)}</h2>
      </div>
      <div class="metrics">
        <div class="metric"><strong>${dayEvents.length}</strong><span>${t("metricReal")}</span></div>
        <div class="metric"><strong>${projects}</strong><span>${t("metricProjects")}</span></div>
        <div class="metric"><strong>${activeAgents}</strong><span>${t("metricAgents")}</span></div>
      </div>
    </section>`;
}

function clip(s, n = 90) {
  const t2 = String(s == null ? "" : s);
  return t2.length > n ? t2.slice(0, n - 1) + "…" : t2;
}

function stripCount(s) {
  return String(s).replace(/^\d+\s*个\s*(Claude Code|Codex)\s*会话[：:]\s*/, "").trim();
}

function composeDiary(agent) {
  const lines = [...agent.done, ...agent.learned];
  if (!lines.length) return "";
  const sep = state.lang === "zh" ? "、" : ", ";
  const ctx = agent.projects.length
    ? `${t("diaryAcross")} ${agent.projects.slice(0, 3).join(sep)}${agent.projects.length > 3 ? "…" : ""}（${agent.sessionCount} ${t("diarySessions")}）。`
    : "";
  const body = lines.slice(0, 2).map((x) => clip(stripCount(x), 88)).join(" ");
  return `${ctx}${body}`.trim();
}

function activeHumanReport() {
  return state.humanReport?.date === state.selectedDate ? state.humanReport : null;
}

function humanAgent(agentId) {
  return activeHumanReport()?.agents?.find((agent) => agent.agentId === agentId) || null;
}

function humanActionsForAgent(agentId) {
  const items = activeHumanReport()?.items || [];
  return items.flatMap((item) =>
    (item.agentActions || [])
      .filter((action) => action.agentId === agentId)
      .map((action) => ({
        folder: item.folder || item.title,
        text: action.text
      }))
  );
}

function hasAgentContent(agent) {
  const human = humanAgent(agent.agentId);
  if (human) return true;
  return Boolean(agent.done.length || agent.learned.length || agent.tomorrow.length || agent.blockers.length);
}

function threadSentence(thread) {
  const names = [...new Set(thread.nodes.map((n) => n.name))];
  const who = state.lang === "zh" ? names.join("、") : names.join(" & ");
  const flag = thread.hasDisagreement ? `（${t("flagDisagree")}）` : "";
  return state.lang === "zh"
    ? `${thread.topic}：${who} 一起推进${flag}`
    : `${thread.topic}: ${who} worked together${flag}`;
}

function reportMarkdown(report) {
  const lines = [`# ${t("reportTitle")} — ${report.title}`, ""];
  report.sections.forEach((a) => {
    lines.push(`## ${a.name} · ${a.projects.length} ${t("diaryProjects")} / ${a.sessionCount} ${t("diarySessions")}`);
    a.projectBreakdown.slice(0, 6).forEach((b) => {
      lines.push(`- ${b.blocker ? "⚠️ " : ""}**${b.project}**${b.samples[0] ? ": " + stripCount(b.samples[0]) : ""}`);
    });
    a.tomorrow.slice(0, 3).forEach((x) => lines.push(`- (${t("tomorrowLabel")}) ${x}`));
    lines.push("");
  });
  if (report.threads.length) {
    lines.push(`## ${t("threadsCap")}`);
    report.threads.forEach((th) => lines.push(`- ${threadSentence(th)}`));
    lines.push("");
  }
  lines.push(`_generated by daybook · ${report.eventCount} events · ${t("mechDraft")}_`);
  return lines.join("\n");
}

function humanMarkdown(human) {
  const lines = [
    `# ${human.date} daybook 人话日报`,
    "",
    human.headline || "",
    "",
    human.overview || "",
    "",
    "## 按项目看"
  ];
  if (human.items?.length) {
    human.items.forEach((item) => {
      lines.push(`${item.index}. **${item.folder || item.title}**（${item.collaborationLabel || "单 agent 推进"} / ${item.statusLabel || humanStatusLabel(item.status)}）：${item.plain}`);
      lines.push(`   - 今日推进：${item.todayProgress?.[0] || "暂无明确推进记录。"}`);
      lines.push(`   - 关键判断：${item.keyJudgments?.[0] || "暂无新的关键判断。"}`);
      lines.push(`   - 明天注意：${item.tomorrowNotes?.[0] || "暂无明确明天事项。"}`);
      lines.push(`   - 需要用户介入：${item.needsUser?.[0] || "暂无需要用户介入的卡点。"}`);
      lines.push(`   - 证据：${item.evidenceCount || 0} 条有效事件；agent：${(item.agents || []).join("、") || "未知"}`);
      (item.agentActions || []).forEach((action) => {
        lines.push(`   - ${action.agent}：${action.text}`);
      });
    });
  } else {
    lines.push("- 暂无可读记录。");
  }
  if (human.agents?.length) {
    lines.push("", "## 按 agent 看");
    human.agents.forEach((agent) => lines.push(`- **${agent.name}**：${agent.plain}`));
  }
  lines.push("", "## 需要继续确认");
  (human.risks?.length ? human.risks : ["暂无需要用户介入的卡点。"]).forEach((risk) => lines.push(`- ${risk}`));
  lines.push("", "## 明天可以接着做");
  (human.next?.length ? human.next : ["暂无明确明天事项。"]).forEach((next) => lines.push(`- ${next}`));
  lines.push(
    "",
    "## 证据计数",
    `- 原始本地事件：${human.evidence?.rawEvents || 0}`,
    `- 进入日报正文：${human.evidence?.usefulEvents || 0}`,
    `- 协作项目：${human.evidence?.collaborationProjects || 0}`,
    `- 真实分歧项目：${human.evidence?.disagreementProjects || 0}`,
    "- 外部写入：0"
  );
  return lines.join("\n");
}

function humanStatusLabel(status) {
  if (status === "needs_attention") return "待确认";
  if (status === "in_progress") return "推进中";
  return "已完成";
}

function publishContent(target, report) {
  const human = state.humanReport?.date === report.date ? state.humanReport : null;
  const md = human ? humanMarkdown(human) : reportMarkdown(report);
  if (target === "markdown") return md;
  if (target === "feishu") return `# Feishu dry-run (not written)\n\n${md}`;
  const cmds = {
    codex: `codex exec --json "$(cat daybook-report-${report.date}.md)"`,
    claude_code: `claude -p "$(cat daybook-report-${report.date}.md)"`,
    hermes: `hermes send --oneshot --file daybook-report-${report.date}.md`
  };
  return `# dry-run command (NOT executed)\n${cmds[target] || target}\n\n# daybook-report-${report.date}.md\n${md}`;
}

function renderReportSection(sec) {
  const open = state.openAgents.has(sec.agentId);
  const breakdown = sec.projectBreakdown.slice(0, 5);
  const raw = [...sec.done, ...sec.learned, ...sec.tomorrow];
  return `
    <div class="report-section" style="--accent:${sec.accent}">
      <div class="report-section-head">
        <span class="agent-dot"></span>
        <strong>${escapeHtml(sec.name)}</strong>
        <span class="report-section-metric">${sec.projects.length} ${t("diaryProjects")} · ${sec.sessionCount} ${t("diarySessions")}</span>
      </div>
      ${breakdown.length
        ? `<ul class="report-skel">${breakdown.map((b) => `<li class="${b.blocker ? "blk" : ""}">${b.blocker ? "⚠️ " : ""}<b>${escapeHtml(b.project)}</b>${b.samples[0] ? "：" + escapeHtml(clip(stripCount(b.samples[0]), 84)) : ""}</li>`).join("")}</ul>`
        : `<p class="muted">${t("noActivity")}</p>`}
      ${raw.length ? `<button class="report-raw-toggle" data-toggle-agent="${sec.agentId}">${open ? t("collapseRaw") : t("expandRaw")}</button>${open ? `<ul class="report-raw">${raw.slice(0, 10).map((x) => `<li>${escapeHtml(clip(stripCount(x), 160))}</li>`).join("")}</ul>` : ""}` : ""}
    </div>
  `;
}

function renderDailyReport(report) {
  const human = state.humanReport?.date === report.date ? state.humanReport : null;
  const quality = state.qualityReport?.latestDate === report.date ? state.qualityReport : null;
  const hasContent = report.sections.length > 0;
  const footerNext = human ? (human.next || []) : report.tomorrow;
  const footerRisks = human ? (human.risks || []) : report.risks;
  const list = (items) => `<ul>${items.slice(0, 5).map((i) => `<li>${escapeHtml(clip(stripCount(i), 120))}</li>`).join("")}</ul>`;
  return `
    <section class="report">
      <div class="report-head-row">
        <div class="report-head-text">
          <p class="small-caps">${t("reportCap")}</p>
          <h3>${t("reportTitle")}</h3>
          <span class="report-badge" title="${t("mechDraftHint")}">${t("mechDraft")}</span>
        </div>
        <button class="primary compact" data-copy-publish="markdown">${t("copyMd")}</button>
      </div>
      ${quality?.latestDay?.sparse ? renderQualityHint(quality) : ""}
      ${human ? renderHumanReport(human) : ""}
      ${!human && hasContent ? `<div class="report-sections">${report.sections.map(renderReportSection).join("")}</div>` : ""}
      ${!human && !hasContent ? `<p class="report-empty">${t("noReport")}</p>` : ""}
      ${state.reportGen ? `
        <div class="publish-preview report-gen">
          <p class="dry-note">${t("dryRunNote")}</p>
          <pre>${escapeHtml(publishContent(state.summarizer, report))}</pre>
          <button class="primary compact" data-copy-publish="${state.summarizer}">${t("copyMd")}</button>
        </div>` : ""}
      <div class="report-footer">
        ${footerNext.length ? `<div class="report-block"><h4>${t("tomorrowLabel")}</h4>${list(footerNext)}</div>` : ""}
        ${footerRisks.length ? `<div class="report-block"><h4>${t("risksLabel")}</h4>${list(footerRisks)}</div>` : ""}
        <div class="report-publish">
          <button class="secondary compact ${state.publishTarget === "feishu" ? "active" : ""}" data-publish="feishu">Feishu dry-run</button>
          ${state.publishTarget === "feishu" ? `<div class="publish-preview"><pre>${escapeHtml(publishContent("feishu", report))}</pre><button class="primary compact" data-copy-publish="feishu">${t("copyMd")}</button></div>` : ""}
        </div>
      </div>
    </section>
  `;
}

function renderQualityHint(quality) {
  return `
    <div class="quality-hint">
      <strong>${t("sparseHint")}</strong>
      <span>${escapeHtml(String(quality.latestDay.usefulEvents || 0))} 条有效事件 · ${escapeHtml(String(quality.latestDay.projectCount || 0))} 个项目 · ${escapeHtml(quality.recommendation || "recent-active-days")}</span>
    </div>
  `;
}

function renderHumanReport(human) {
  const section = (label, values, emptyText) =>
    `<div class="human-section-line"><b>${label}</b><span>${escapeHtml(values?.[0] || emptyText)}</span></div>`;
  return `
    <div class="human-report">
      <p class="human-overview">${escapeHtml(human.headline)} ${escapeHtml(human.overview || "")}</p>
      <ol class="human-items">
        ${(human.items || []).map((item) => `
          <li>
            <div class="human-item-head">
              <span class="folder-pill">${escapeHtml(item.folder || item.title)}</span>
              <span class="human-status">${escapeHtml(item.collaborationLabel || "单 agent 推进")}</span>
              <span class="human-status">${escapeHtml(item.statusLabel || humanStatusLabel(item.status))}</span>
            </div>
            <p>${escapeHtml(item.plain)}</p>
            <div class="human-section-lines">
              ${section("今日推进", item.todayProgress, "暂无明确推进记录。")}
              ${section("关键判断", item.keyJudgments, "暂无新的关键判断。")}
              ${section("明天注意", item.tomorrowNotes, "暂无明确明天事项。")}
              ${section("需要用户介入", item.needsUser, "暂无需要用户介入的卡点。")}
              <div class="human-section-line"><b>证据</b><span>${escapeHtml(String(item.evidenceCount || 0))} 条有效事件</span></div>
            </div>
            ${item.agentActions?.length ? `<ul class="human-actions">
              ${item.agentActions.map((action) => `<li><b>${escapeHtml(action.agent)}</b><span>${escapeHtml(action.text)}</span></li>`).join("")}
            </ul>` : ""}
          </li>
        `).join("")}
      </ol>
      ${(human.agents || []).length ? `
        <div class="human-agents">
          ${(human.agents || []).map((agent) => `
            <article>
              <strong>${escapeHtml(agent.name)}</strong>
              <p>${escapeHtml(agent.plain)}</p>
            </article>
          `).join("")}
        </div>` : ""}
      <p class="human-evidence">依据 ${escapeHtml(String(human.evidence?.rawEvents || 0))} 条本地记录整理，其中 ${escapeHtml(String(human.evidence?.usefulEvents || 0))} 条进入日报正文。</p>
    </div>
  `;
}

function stanceBadge(stance) {
  const map = STANCE_I18N[state.lang] || STANCE_I18N.zh;
  const [icon, label] = map[stance] || map.open;
  return `<span class="stance ${stance || "open"}">${icon} ${label}</span>`;
}

function threadFlag(thread) {
  if (thread.hasDisagreement) return `<span class="thread-flag">${t("flagDisagree")}</span>`;
  if (thread.implicit) return `<span class="thread-flag cowork">${t("flagCowork")}</span>`;
  return `<span class="thread-flag agreed">${t("flagAligned")}</span>`;
}

function renderThreads(daily) {
  const human = activeHumanReport();
  if (human) return renderHumanThreads(human);
  const threads = daily.threads;
  const anyDisagreement = threads.some((thread) => thread.hasDisagreement);
  const heading = anyDisagreement ? t("clash") : t("cowork");
  return `
    <section class="threads" aria-label="cross-agent threads">
      <div class="panel-heading">
        <div>
          <p class="small-caps">${t("threadsCap")}</p>
          <h3>${heading}</h3>
        </div>
        <span class="threads-count">${threads.length} ${t("threadsWord")}</span>
      </div>
      ${threads.length ? `
        <div class="thread-list">
          ${threads.map((thread) => `
            <article class="thread ${thread.hasDisagreement ? "has-disagreement" : ""} ${thread.implicit ? "is-cowork" : ""}">
              <header class="thread-head">
                <h4>${escapeHtml(thread.topic)}</h4>
                <div class="thread-flags">
                  ${thread.demo ? `<span class="thread-demo">Demo</span>` : ""}
                  ${threadFlag(thread)}
                </div>
              </header>
              <p class="thread-sentence">${escapeHtml(threadSentence(thread))}</p>
              <ol class="thread-chain">
                ${thread.nodes.map((node, index) => `
                  <li class="thread-node ${index === 0 ? "root" : "reply"}" style="--accent:${node.accent}">
                    <div class="thread-node-meta">
                      <strong>${escapeHtml(node.name)}</strong>
                      ${index === 0 ? "" : stanceBadge(node.stance)}
                      <time>${node.time}</time>
                    </div>
                    <p>${escapeHtml(clip(stripCount(node.summary), 92))}</p>
                  </li>
                `).join("")}
              </ol>
            </article>
          `).join("")}
        </div>
      ` : `<div class="empty">${t("threadsEmpty")}</div>`}
    </section>
  `;
}

function renderHumanThreads(human) {
  const shared = (human.items || []).filter((item) => (item.agents || []).length >= 2);
  return `
    <section class="threads" aria-label="cross-agent threads">
      <div class="panel-heading">
        <div>
          <p class="small-caps">${t("threadsCap")}</p>
          <h3>${t("cowork")}</h3>
        </div>
        <span class="threads-count">${shared.length} ${t("threadsWord")}</span>
      </div>
      ${shared.length ? `
        <div class="thread-list">
          ${shared.map((item) => `
            <article class="thread is-cowork">
              <header class="thread-head">
                <h4><span class="folder-pill">${escapeHtml(item.folder || item.title)}</span></h4>
                <div class="thread-flags">${threadFlag({ implicit: true, hasDisagreement: false })}</div>
              </header>
              <p class="thread-sentence">${escapeHtml(item.plain)}</p>
              <ol class="thread-chain human-thread-chain">
                ${(item.agentActions || []).map((action) => `
                  <li class="thread-node reply" style="--accent:${AGENTS[action.agentId]?.accent || "#1261d6"}">
                    <div class="thread-node-meta">
                      <strong>${escapeHtml(action.agent)}</strong>
                    </div>
                    <p>${escapeHtml(action.text)}</p>
                  </li>
                `).join("")}
              </ol>
            </article>
          `).join("")}
        </div>
      ` : `<div class="empty">${t("threadsEmpty")}</div>`}
    </section>
  `;
}

function renderCollab(collab) {
  if (!collab.lanes.length) return `<section class="collab"><div class="empty">${t("noCollab")}</div></section>`;
  const span = Math.max(60, collab.axisEnd - collab.axisStart);
  const xpct = (min) => ((min - collab.axisStart) / span) * 100;
  const ticks = [];
  for (let m = collab.axisStart; m <= collab.axisEnd; m += 120) ticks.push(m);
  return `
    <section class="collab">
      <div class="panel-heading">
        <div><p class="small-caps">${t("collabCap")}</p><h3>${t("collabHeading")}</h3></div>
      </div>
      <div class="collab-cards">
        ${collab.cards.map((c) => `
          <div class="collab-card" style="--accent:${c.accent}">
            <div class="collab-card-top"><span class="agent-dot"></span><strong>${escapeHtml(c.name)}</strong></div>
            <div class="collab-card-stat">${c.count} ${t("sessionsUnit")} · ${c.projectCount} ${t("diaryProjects")}</div>
            ${c.convergeWith.length ? `<div class="collab-card-conv">${t("convergeWith")} ${c.convergeWith.map(escapeHtml).join("、")}</div>` : ""}
          </div>
        `).join("")}
      </div>
      <div class="swimlane">
        <div class="swim-axis">${ticks.map((m) => `<span style="left:${xpct(m)}%">${String(Math.floor(m / 60)).padStart(2, "0")}:00</span>`).join("")}</div>
        ${collab.lanes.map((lane) => {
          let last = -Infinity;
          const GAP = 2.2;
          const chips = lane.chips.map((c) => {
            let x = xpct(c.minutes);
            if (x - last < GAP) x = last + GAP;
            last = x;
            x = Math.min(x, 99);
            const tip = `${c.time} · ${c.project}${c.summary ? " — " + clip(stripCount(c.summary), 80) : ""}`;
            return `<button class="swim-chip ${c.converge ? "converge" : ""}" style="left:${x}%; --c:${c.color}" title="${escapeHtml(tip)}"></button>`;
          }).join("");
          return `<div class="swim-row"><div class="swim-label" style="--accent:${lane.accent}"><strong>${escapeHtml(lane.name)}</strong><span>${lane.count}</span></div><div class="swim-track">${chips}</div></div>`;
        }).join("")}
      </div>
      <div class="collab-legend">${collab.legend.map((l) => `<span class="leg"><i style="background:${l.color}"></i>${escapeHtml(l.name)}</span>`).join("")}</div>
      ${collab.convergence.length ? `
        <div class="collab-converge">
          <h4>${t("convergeHeading")}</h4>
          <ul>${collab.convergence.map((c) => `<li><i style="background:${c.color}"></i><b>${escapeHtml(c.project)}</b>：${c.agents.map(escapeHtml).join("、")}</li>`).join("")}</ul>
        </div>` : ""}
      <p class="collab-hint">${t("collabHint")}</p>
    </section>
  `;
}

function renderTimeline(daily) {
  const laneOrder = ["codex", "claude_code", "hermes"];
  const toLeft = (time) => {
    const [h, m] = time.split(":").map(Number);
    let mins = h * 60 + m;
    if (mins < 18 * 60) mins += 24 * 60; // wrap events past midnight onto the 18:00–24:00 axis
    const pct = Math.max(0, Math.min(1, (mins - 18 * 60) / (6 * 60)));
    return pct * 80 + 6; // map to 6%–86%
  };
  const MIN_GAP = 12; // percent — keeps same-lane chips from overlapping
  const byLane = { codex: [], claude_code: [], hermes: [] };
  daily.conversation.forEach((item) => { if (byLane[item.agentId]) byLane[item.agentId].push(item); });
  const items = laneOrder.flatMap((agentId) => {
    const top = 24 + laneOrder.indexOf(agentId) * 44;
    let lastLeft = -Infinity;
    return byLane[agentId]
      .slice()
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((item) => {
        const meta = AGENTS[agentId];
        const event = state.events.find((entry) => `conv-${entry.eventId}` === item.id);
        let left = toLeft(item.time);
        if (left - lastLeft < MIN_GAP) left = lastLeft + MIN_GAP;
        left = Math.min(left, 92);
        lastLeft = left;
        return `<button class="timeline-chip ${event?.state || "accepted"}" style="left:${left}%; top:${top}px; --accent:${meta.accent}" data-open-conversation="${agentId}">
          <span>${item.time}</span>${escapeHtml(event?.payload.title || item.text)}
        </button>`;
      });
  }).join("");

  return `
    <section class="timeline-panel">
      <div class="panel-heading">
        <div>
          <p class="small-caps">Event Projection Timeline</p>
          <h3>第二视角：当天任务流</h3>
        </div>
        <button class="secondary compact" data-action="show-safety">Inspect safety states</button>
      </div>
      <div class="timeline">
        <div class="time-axis"><span>18:00</span><span>20:00</span><span>22:00</span><span>00:00</span></div>
        ${["codex", "claude_code", "hermes"].map((agentId) => `
          <div class="lane-label" style="top:${31 + ["codex", "claude_code", "hermes"].indexOf(agentId) * 44}px; --accent:${AGENTS[agentId].accent}">
            ${AGENTS[agentId].name}
          </div>
        `).join("")}
        <div class="now-line"></div>
        ${items}
      </div>
    </section>
  `;
}

function renderAgentColumn(agent, daily) {
  const meta = AGENTS[agent.agentId];
  const human = humanAgent(agent.agentId);
  if (human) return renderHumanAgentColumn(agent, human, meta);

  const diary = composeDiary(agent);
  const mini = (label, items, warn) => items.length
    ? `<div class="agent-mini ${warn ? "warn" : ""}"><h4>${label}</h4><ul>${items.slice(0, 2).map((x) => `<li>${escapeHtml(clip(stripCount(x), 84))}</li>`).join("")}</ul></div>`
    : "";
  return `
    <article class="agent-column" style="--accent:${meta.accent}; --soft:${meta.soft}">
      <div class="agent-head"><h3>${agent.name}</h3><p>${agent.role}</p></div>
      <p class="agent-diary">${diary ? escapeHtml(diary) : `<span class="muted">${t("noActivity")}</span>`}</p>
      ${mini(t("tomorrowLabel"), agent.tomorrow, false)}
      ${mini(t("blockersLabel"), agent.blockers, true)}
      <form class="composer" data-composer-agent="${agent.agentId}">
        <textarea id="note-${agent.agentId}" name="note" placeholder="${t("composer")}"></textarea>
        <button class="primary full-width" type="submit">${t("addNote")}</button>
      </form>
    </article>
  `;
}

function renderHumanAgentColumn(agent, human, meta) {
  const actions = humanActionsForAgent(agent.agentId);
  const projectText = human.projects?.length
    ? `参与 ${human.projects.length} 个文件夹：${human.projects.join("、")}`
    : "今天没有足够可读的有效记录";
  return `
    <article class="agent-column human-agent-column" style="--accent:${meta.accent}; --soft:${meta.soft}">
      <div class="agent-head"><h3>${agent.name}</h3><p>${agent.role}</p></div>
      <p class="agent-diary">${escapeHtml(human.plain)}</p>
      <div class="agent-summary-meta">${escapeHtml(projectText)}</div>
      ${actions.length ? `
        <ul class="agent-action-list">
          ${actions.map((action) => `
            <li>
              <span class="folder-pill mini">${escapeHtml(action.folder)}</span>
              <p>${escapeHtml(action.text)}</p>
            </li>
          `).join("")}
        </ul>` : ""}
      <form class="composer" data-composer-agent="${agent.agentId}">
        <textarea id="note-${agent.agentId}" name="note" placeholder="${t("composer")}"></textarea>
        <button class="primary full-width" type="submit">${t("addNote")}</button>
      </form>
    </article>
  `;
}

function renderList(label, items) {
  return `
    <div class="agent-list">
      <h4>${label}</h4>
      <ul>
        ${items.slice(0, 4).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function renderRightPanel(daily, weekly) {
  const tabs = [
    ["conversation", t("tabConversation")],
    ["weekly", t("tabWeekly")],
    ["safety", t("tabSafety")]
  ];
  if (!["conversation", "weekly", "safety"].includes(state.rightTab)) state.rightTab = "conversation";
  return `
    <div class="right-tabs">
      ${tabs.map(([id, label]) => `<button class="${state.rightTab === id ? "active" : ""}" data-right-tab="${id}">${label}</button>`).join("")}
    </div>
    <div class="right-content">
      ${state.rightTab === "conversation" ? renderConversation(daily) : ""}
      ${state.rightTab === "weekly" ? renderWeekly(weekly) : ""}
      ${state.rightTab === "safety" ? renderSafety(daily) : ""}
    </div>
  `;
}

function renderSourceIndex(daily) {
  const query = state.search.trim().toLowerCase();
  const allSources = getSources().filter((source) => {
    if (!daily.sourceIds.includes(source.sourceId)) return false;
    if (!query) return true;
    return `${source.title} ${source.tags.join(" ")} ${source.excerpt}`.toLowerCase().includes(query);
  });
  const selected = sourceById(state.selectedSourceId) || allSources[0];
  const groups = {
    [t("feishuMock")]: allSources.filter((source) => source.kind.startsWith("feishu")),
    [t("localEvidence")]: allSources.filter((source) => !source.kind.startsWith("feishu"))
  };

  return `
    <section class="source-index">
      <div class="panel-heading">
        <div>
          <p class="small-caps">Source Map / Index</p>
          <h3>${t("sourceMapHeading")}</h3>
        </div>
        <button class="secondary compact" data-action="open-dry-run">Dry-run</button>
      </div>
      <div class="source-map">
        <div class="source-node">
          <span>Today</span>
          <strong>${fmtDate(state.selectedDate)}</strong>
        </div>
        <div class="brace" aria-hidden="true">}</div>
        <div class="source-groups">
          ${Object.entries(groups).map(([name, sources]) => `
            <div class="source-group">
              <h4>${name}<span>${sources.length}</span></h4>
              ${sources.map((source) => `
                <button class="source-row ${selected?.sourceId === source.sourceId ? "active" : ""}" data-source-id="${source.sourceId}">
                  <span>${kindLabel(source.kind)}</span>
                  <strong>${escapeHtml(source.title)}</strong>
                  <em>${escapeHtml(source.pathOrRef)}</em>
                </button>
              `).join("")}
            </div>
          `).join("")}
        </div>
      </div>
      ${selected ? `
        <div class="source-preview">
          <p class="small-caps">Selected Source</p>
          <h4>${escapeHtml(selected.title)}</h4>
          <p>${escapeHtml(selected.excerpt)}</p>
          <code>${escapeHtml(selected.pathOrRef)}</code>
          <div class="tag-row">${selected.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
        </div>
      ` : `<div class="empty">${t("noSources")}</div>`}
    </section>
  `;
}

function renderConversation(daily) {
  const items = daily.conversation.filter((item) => state.conversationFilter === "all" || item.agentId === state.conversationFilter);
  return `
    <section class="conversation">
      <div class="panel-heading">
        <div>
          <h3>${t("convHeading")}</h3>
        </div>
      </div>
      <div class="segmented thin">
        ${["all", "codex", "claude_code", "hermes"].map((id) => `<button class="${state.conversationFilter === id ? "active" : ""}" data-conversation-filter="${id}">${id === "all" ? t("allAgents") : AGENTS[id].name}</button>`).join("")}
      </div>
      <div class="conversation-list">
        ${items.map((item) => {
          const meta = AGENTS[item.agentId];
          return `<article class="conversation-item" style="--accent:${meta.accent}">
            <time>${item.time}</time>
            <div>
              <strong>${meta.name}</strong>
              <p>${escapeHtml(item.text)}</p>
            </div>
          </article>`;
        }).join("")}
      </div>
    </section>
  `;
}

function renderWeekly(weekly) {
  return `
    <section class="weekly">
      <div class="panel-heading">
        <div>
          <h3>${state.generatedWeekly ? t("weeklyDraft") : t("weeklyPreview")}</h3>
        </div>
        <button class="primary compact" data-action="generate-weekly">${t("weeklyGenerate")}</button>
      </div>
      <p class="preview-range">${weekly.range}</p>
      ${renderWeeklyBlock(t("wWins"), weekly.wins)}
      ${renderWeeklyBlock(t("wLearnings"), weekly.learnings)}
      ${renderWeeklyBlock(t("wRisks"), weekly.risks)}
      ${renderWeeklyBlock(t("wNext"), weekly.nextActions)}
    </section>
  `;
}

function renderWeeklyBlock(title, items) {
  return `
    <div class="weekly-block">
      <h4>${title}</h4>
      <ul>${(items.length ? items : [t("weeklyEmpty")]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderSafety(daily) {
  const summary = [
    [stateLabelT("accepted"), daily.safety.accepted, "accepted"],
    [stateLabelT("duplicate"), daily.safety.duplicates, "duplicate"],
    [stateLabelT("conflict"), daily.safety.conflicts, "conflict"],
    [stateLabelT("quarantined"), daily.safety.quarantined, "quarantined"],
    [stateLabelT("redacted"), daily.safety.redacted, "redacted"],
    [stateLabelT("pending_sync"), daily.safety.pendingSync, "pending_sync"]
  ];
  const selected = daily.safety.items.find((item) => item.id === state.selectedSafetyId) || daily.safety.items[0];

  return `
    <section class="safety">
      <div class="panel-heading">
        <div>
          <h3>${t("safetyHeading")}</h3>
        </div>
      </div>
      <div class="safety-grid">
        ${summary.map(([label, count, kind]) => `<div class="safety-tile ${kind}"><span>${label}</span><strong>${count}</strong></div>`).join("")}
      </div>
      <div class="safety-list">
        ${daily.safety.items.length ? daily.safety.items.map((item) => `
          <button class="safety-row ${selected?.id === item.id ? "active" : ""} ${item.state}" data-safety-id="${item.id}">
            <span>${stateLabelT(item.state)}</span>
            <strong>${escapeHtml(item.title)}</strong>
          </button>
        `).join("") : `<div class="empty">${t("safetyEmpty")}</div>`}
      </div>
      ${selected ? `
        <div class="trace-detail">
          <h4>${escapeHtml(selected.title)}</h4>
          <p>${escapeHtml(safetyExplT(selected.state) || selected.explanation)}</p>
          <code>${escapeHtml(selected.traceId)}</code>
        </div>
      ` : ""}
    </section>
  `;
}

const STATE_LABEL_I18N = {
  zh: { accepted: "已接受", duplicate: "重复忽略", conflict: "冲突", quarantined: "隔离", redacted: "已脱敏", pending_sync: "待 dry-run", failed: "可恢复失败" },
  en: { accepted: "Accepted", duplicate: "Duplicate", conflict: "Conflict", quarantined: "Quarantined", redacted: "Redacted", pending_sync: "Pending", failed: "Recoverable" }
};
function stateLabelT(s) { return (STATE_LABEL_I18N[state.lang] || STATE_LABEL_I18N.zh)[s] || s; }

const SAFETY_EXPL_I18N = {
  zh: { duplicate: "幂等键命中，重复事件被忽略。", conflict: "多个 agent 对同一决策给出不同建议，需人工确认。", quarantined: "schema 校验失败。", redacted: "检测到疑似 secret，已本地脱敏。", pending_sync: "仅进入 dry-run 队列，未调用外部 API。", failed: "模拟失败：可恢复错误。" },
  en: { duplicate: "Idempotency hit — duplicate ignored.", conflict: "Agents disagree on a decision; needs a human.", quarantined: "Schema validation failed.", redacted: "Secret-shaped text detected and redacted locally.", pending_sync: "Queued for dry-run only; no external API called.", failed: "Simulated recoverable failure." }
};
function safetyExplT(s) { return (SAFETY_EXPL_I18N[state.lang] || SAFETY_EXPL_I18N.zh)[s] || ""; }

function renderDryRunDrawer(plan) {
  return `
    <div class="drawer-backdrop" data-action="close-dry-run"></div>
    <aside class="dry-run-drawer" aria-label="Feishu dry-run preview">
      <div class="drawer-head">
        <div>
          <p class="small-caps">External Sync Dry-run</p>
          <h3>${t("dryRunHeading")}</h3>
        </div>
        <button class="icon-button" data-action="close-dry-run" title="${t("close")}">×</button>
      </div>
      <div class="dry-alert">
        <strong>Local-only simulation</strong>
        <p>外部写入：${plan.externalCallsMade ? "需要复查" : "0"}。没有调用飞书 API，没有创建定时任务。</p>
      </div>
      ${plan.targets.map((target) => `
        <article class="dry-target">
          <div class="dry-target-head">
            <span>${kindLabel(target.target)}</span>
            <strong>${escapeHtml(target.title)}</strong>
            <em>${target.mode}</em>
          </div>
          <pre>${escapeHtml(target.preview)}</pre>
          ${target.fields ? `<table>${Object.entries(target.fields).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join("")}</table>` : ""}
        </article>
      `).join("")}
      <button class="primary full-width" data-action="close-dry-run">Close dry-run preview</button>
    </aside>
  `;
}

function kindLabel(kind) {
  const labels = {
    feishu_doc_mock: "Doc",
    feishu_wiki_mock: "Wiki",
    feishu_base_mock: "Base",
    local_session: "Session",
    local_log: "Log",
    code_file: "Code",
    markdown_note: "Note"
  };
  return labels[kind] || kind.replaceAll("_", " ");
}

function storageLabel(status) {
  if (status === "ready") return "localStorage";
  if (status === "memory-only") return "Memory";
  return "Review";
}

function bindEvents() {
  document.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDate = button.dataset.date;
      state.selectedSourceId = buildDailyProjection(state.selectedDate, state.events).sourceIds[0] || state.selectedSourceId;
      render();
    });
  });

  document.querySelectorAll("[data-agent-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.agentFilter = button.dataset.agentFilter;
      render();
    });
  });

  document.querySelectorAll("[data-right-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rightTab = button.dataset.rightTab;
      render();
    });
  });

  document.querySelectorAll("[data-publish]").forEach((button) => {
    button.addEventListener("click", () => {
      const tg = button.dataset.publish;
      state.publishTarget = state.publishTarget === tg ? null : tg;
      render();
    });
  });

  document.querySelectorAll("[data-summarizer]").forEach((button) => {
    button.addEventListener("click", () => {
      state.summarizer = button.dataset.summarizer;
      persistPrefs();
      render();
    });
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      persistPrefs();
      render();
    });
  });

  document.querySelectorAll("[data-toggle-agent]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.toggleAgent;
      if (state.openAgents.has(id)) state.openAgents.delete(id); else state.openAgents.add(id);
      render();
    });
  });

  document.querySelectorAll("[data-copy-publish]").forEach((button) => {
    button.addEventListener("click", async () => {
      const report = buildDailyReport(state.selectedDate, state.events);
      const text = publishContent(button.dataset.copyPublish, report);
      const ok = await copyText(text);
      if (ok) {
        button.textContent = t("copied");
        setTimeout(() => { button.textContent = t("copyMd"); }, 1200);
      }
    });
  });

  document.querySelectorAll("[data-conversation-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.conversationFilter = button.dataset.conversationFilter;
      render();
    });
  });

  document.querySelectorAll("[data-source-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSourceId = button.dataset.sourceId;
      state.rightTab = "sources";
      render();
    });
  });

  document.querySelectorAll("[data-safety-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSafetyId = button.dataset.safetyId;
      render();
    });
  });

  document.querySelectorAll("[data-open-conversation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.rightTab = "conversation";
      state.conversationFilter = button.dataset.openConversation;
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => handleAction(button.dataset.action));
  });

  document.querySelectorAll("[data-composer-agent]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const note = new FormData(form).get("note")?.toString().trim();
      if (!note) return;
      addMockNote(form.dataset.composerAgent, note);
    });
  });

  const search = document.querySelector("#source-search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.search = event.target.value;
      render();
    });
  }
}

function handleAction(action) {
  const maxOffset = Math.max(0, state.dateList.length - 7);
  if (action === "prev-week") state.dateOffset = Math.min(maxOffset, state.dateOffset + 7);
  if (action === "next-week") state.dateOffset = Math.max(0, state.dateOffset - 7);
  if (action === "open-dry-run") state.dryRunOpen = true;
  if (action === "close-dry-run") state.dryRunOpen = false;
  if (action === "gen-report") state.reportGen = !state.reportGen;
  if (action === "toggle-lang") { state.lang = state.lang === "zh" ? "en" : "zh"; persistPrefs(); }
  if (action === "toggle-theme") { state.theme = state.theme === "light" ? "dark" : "light"; persistPrefs(); }
  if (action === "toggle-right") { state.rightOpen = !state.rightOpen; persistPrefs(); }
  if (action === "generate-weekly") {
    state.generatedWeekly = true;
    state.rightTab = "weekly";
  }
  if (action === "export-events") exportEvents();
  if (action === "show-safety") state.rightTab = "safety";
  if (action === "copy-today-cmd") {
    copyText(TODAY_COMMAND).then((ok) => {
      const button = document.querySelector('[data-action="copy-today-cmd"]');
      if (ok && button) {
        button.textContent = t("copyCmdDone");
        setTimeout(() => { button.textContent = t("setupCopy"); }, 1200);
      }
    });
    return;
  }
  render();
}

function exportEvents() {
  const payload = JSON.stringify({
    schemaVersion: "1.0",
    exportedAt: new Date().toISOString(),
    externalCallsMade: false,
    events: state.events
  }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agent-sync-events-${state.selectedDate}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function addMockNote(agentId, note) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const eventId = `ui-${agentId}-${Date.now()}`;
  state.events.push({
    schemaVersion: "1.0",
    eventId,
    idempotencyKey: `${agentId}:${state.selectedDate}:${eventId}`,
    traceId: `trace-local-${eventId}`,
    date: state.selectedDate,
    sourceAgent: agentId,
    sourceInstance: "mock-ui",
    workspace: "agent-sync-demo",
    eventType: "task_update",
    occurredAt: `${state.selectedDate}T${hh}:${mm}:00+08:00`,
    observedAt: `${state.selectedDate}T${hh}:${mm}:05+08:00`,
    state: "accepted",
    payload: {
      title: "本地写入的同步",
      summary: note,
      details: "这条记录只存在当前浏览器会话，没有写入文件或外部系统。",
      project: "Agent Work Journal",
      status: "done",
      priority: "medium",
      tags: ["mock-ui", "local-only"],
      evidencePreview: "sourceInstance=mock-ui"
    },
    privacy: {
      containsSecret: false,
      redactionStatus: "clean"
    },
    sourceIds: ["src-feishu-doc-daily"]
  });
  persistLocalJournal();
  state.rightTab = "conversation";
  state.conversationFilter = agentId;
  render();
}

render();
importLocalFile();
