import { AGENTS, EVENTS } from "./data.js";
import {
  agentMeta,
  buildDailyProjection,
  buildDryRunSyncPlan,
  buildWeeklyPreview,
  dates,
  getSources,
  sourceById,
  stateLabel
} from "./projection.js";

const app = document.querySelector("#app");
const JOURNAL_STORAGE_KEY = "agent-sync-demo.local-events.v1";
const LOCAL_IMPORT_FILE = "./data/events.local.jsonl";
const PREFS_KEY = "daybook.prefs.v1";
const loadedLocalJournal = loadLocalJournal();
const prefs = loadPrefs();
const state = {
  selectedDate: dates()[0].date,
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
  leftOpen: prefs.leftOpen,
  rightOpen: prefs.rightOpen,
  events: mergeEvents(EVENTS, loadedLocalJournal.events),
  dateList: []
};

// Most recent real date that has a same-project ≥2-agent co-work thread.
function pickDefaultDate(imported) {
  const byDate = {};
  imported.forEach((e) => {
    const p = e.payload.project;
    if (!p || p === "后台 / 杂项") return;
    (byDate[e.date] ||= {});
    (byDate[e.date][p] ||= new Set()).add(e.sourceAgent);
  });
  const allDates = [...new Set(imported.map((e) => e.date))].sort().reverse();
  for (const d of allDates) {
    const projs = byDate[d] || {};
    if (Object.values(projs).some((set) => set.size >= 2)) return d;
  }
  return allDates[0];
}

function loadPrefs() {
  const fallback = { lang: "zh", theme: "light", leftOpen: true, rightOpen: false };
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
      lang: state.lang, theme: state.theme, leftOpen: state.leftOpen, rightOpen: state.rightOpen
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
    prevDay: "前一天", nextDay: "后一天", toggleLeft: "折叠日期栏", toggleRight: "侧栏",
    latest: "最新", imported: "已导入", real: "条真实", exportJson: "导出 JSON", today: "今天"
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
    prevDay: "Previous day", nextDay: "Next day", toggleLeft: "Toggle dates", toggleRight: "Side panel",
    latest: "Latest", imported: "Imported", real: " real", exportJson: "Export JSON", today: "Today"
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

// Merge the user's REAL local activity (data/events.local.jsonl) when served over
// http. Stays empty on file:// or when the file is absent — the public build never
// ships real data. Runs after the first render, then re-renders.
async function importLocalFile() {
  try {
    const res = await fetch(LOCAL_IMPORT_FILE, { cache: "no-store" });
    if (!res.ok) return;
    const text = await res.text();
    const imported = text
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean)
      .filter(isJournalEvent);
    if (!imported.length) return;
    // Local view is 100% REAL: drop the seed demo entirely, keep only imported
    // real activity + any notes the user typed here. No fabricated data on screen.
    const ownNotes = state.events.filter((event) => event.sourceInstance === "mock-ui");
    state.events = mergeEvents(imported, ownNotes);
    state.importedCount = imported.length;
    state.dateList = computeDateList(state.events);
    // Land on the most recent day that actually has a cross-agent co-work thread,
    // so the first screen shows the soul; fall back to most recent real day.
    state.selectedDate = pickDefaultDate(imported);
    render();
  } catch {
    /* file:// or no local file — expected for the standalone/public build */
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
  const daily = buildDailyProjection(state.selectedDate, state.events);
  const weekly = buildWeeklyPreview(state.selectedDate, state.events);
  const plan = buildDryRunSyncPlan(state.selectedDate, state.events);

  app.innerHTML = `
    <div class="app-root ${state.leftOpen ? "" : "left-collapsed"} ${state.rightOpen ? "right-open" : "right-collapsed"} ${state.dryRunOpen ? "drawer-open" : ""}">
      ${renderTopbar(daily)}
      <div class="shell">
        ${renderSidebar(daily)}
        <main class="workspace">
          ${renderDailyHeader(daily)}
          ${renderThreads(daily)}
          <section class="agent-grid" aria-label="agents">
            ${daily.agents.map((agent) => renderAgentColumn(agent, daily)).join("")}
          </section>
        </main>
        <aside class="right-panel" aria-label="side panel">
          ${renderRightPanel(daily, weekly)}
        </aside>
      </div>
      ${state.dryRunOpen ? renderDryRunDrawer(plan) : ""}
    </div>
  `;

  bindEvents();
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

function renderTopbar(daily) {
  const langLabel = state.lang === "zh" ? "中" : "EN";
  const themeIcon = state.theme === "dark" ? "☾" : "☀";
  const weekdayLong = new Intl.DateTimeFormat(state.lang === "zh" ? "zh-CN" : "en-US", { timeZone: "Asia/Shanghai", weekday: "long" })
    .format(new Date(`${state.selectedDate}T12:00:00+08:00`));
  return `
    <header class="topbar">
      <div class="topbar-brand">
        <div class="brand-mark">db</div>
        <div class="brand-text">
          <h1>daybook</h1>
          <p>夜谈台 · ${t("tagline")}</p>
        </div>
        <div class="capsule" role="group" aria-label="language and theme">
          <button class="capsule-half" data-action="toggle-lang" title="中 / EN">${langLabel}</button>
          <span class="capsule-div"></span>
          <button class="capsule-half" data-action="toggle-theme" title="light / dark">${themeIcon}</button>
        </div>
      </div>
      <div class="topbar-center">
        <button class="icon-button" data-action="prev-date" title="${t("prevDay")}">‹</button>
        <div class="topbar-date">
          <strong>${fmtDate(state.selectedDate)}</strong>
          <span>${weekdayLong}</span>
        </div>
        <button class="icon-button" data-action="next-date" title="${t("nextDay")}">›</button>
      </div>
      <div class="topbar-right">
        <button class="icon-button ${state.leftOpen ? "on" : ""}" data-action="toggle-left" title="${t("toggleLeft")}">☰</button>
        <button class="icon-button ${state.rightOpen ? "on" : ""}" data-action="toggle-right" title="${t("toggleRight")}">⊟</button>
      </div>
      <div class="mobile-date-strip">
        ${state.dateList.slice(0, 30).map((item) => `
          <button class="${item.date === state.selectedDate ? "active" : ""}" data-date="${item.date}">${item.weekday}<span>${item.date.slice(5)}</span></button>
        `).join("")}
      </div>
    </header>
  `;
}

function renderDailyHeader(daily) {
  const dayEvents = state.events.filter((event) => event.date === state.selectedDate);
  const projects = new Set(dayEvents.map((e) => e.payload.project).filter((p) => p && p !== "后台 / 杂项")).size;
  const activeAgents = new Set(dayEvents.map((e) => e.sourceAgent)).size;
  return `
    <section class="daily-header">
      <div class="daily-headline">
        <p class="small-caps">${t("dailyReview")}</p>
        <h2>${escapeHtml(daily.title)}</h2>
        <p class="daily-sub">${escapeHtml(daily.summary)}</p>
      </div>
      <div class="metrics">
        <div class="metric"><strong>${dayEvents.length}</strong><span>${t("metricReal")}</span></div>
        <div class="metric"><strong>${projects}</strong><span>${t("metricProjects")}</span></div>
        <div class="metric"><strong>${activeAgents}</strong><span>${t("metricAgents")}</span></div>
      </div>
    </section>
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
              <ol class="thread-chain">
                ${thread.nodes.map((node, index) => `
                  <li class="thread-node ${index === 0 ? "root" : "reply"}" style="--accent:${node.accent}">
                    <div class="thread-node-meta">
                      <strong>${escapeHtml(node.name)}</strong>
                      ${index === 0 ? "" : stanceBadge(node.stance)}
                      <time>${node.time}</time>
                    </div>
                    <p>${escapeHtml(node.summary)}</p>
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
  return `
    <article class="agent-column" style="--accent:${meta.accent}; --soft:${meta.soft}">
      <div class="agent-head">
        <h3>${agent.name}</h3>
        <p>${agent.role}</p>
      </div>
      ${renderList(t("done"), agent.done)}
      ${renderList(t("learned"), agent.learned)}
      ${renderList(t("tomorrow"), agent.tomorrow)}
      ${renderList(t("blockers"), agent.blockers)}
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
    ["sources", t("tabSources")],
    ["safety", t("tabSafety")]
  ];
  return `
    <div class="right-tabs">
      ${tabs.map(([id, label]) => `<button class="${state.rightTab === id ? "active" : ""}" data-right-tab="${id}">${label}</button>`).join("")}
    </div>
    <div class="right-content">
      ${state.rightTab === "sources" ? renderSourceIndex(daily) : ""}
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
    "飞书 Mock": allSources.filter((source) => source.kind.startsWith("feishu")),
    "本地证据": allSources.filter((source) => !source.kind.startsWith("feishu"))
  };

  return `
    <section class="source-index">
      <div class="panel-heading">
        <div>
          <p class="small-caps">Source Map / Index</p>
          <h3>第三视角：信息源纵向并行</h3>
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
      ` : `<div class="empty">没有匹配的信息源。</div>`}
    </section>
  `;
}

function renderConversation(daily) {
  const items = daily.conversation.filter((item) => state.conversationFilter === "all" || item.agentId === state.conversationFilter);
  return `
    <section class="conversation">
      <div class="panel-heading">
        <div>
          <p class="small-caps">Daily Conversation</p>
          <h3>当天对话流</h3>
        </div>
      </div>
      <div class="segmented thin">
        ${["all", "codex", "claude_code", "hermes"].map((id) => `<button class="${state.conversationFilter === id ? "active" : ""}" data-conversation-filter="${id}">${id === "all" ? "All" : AGENTS[id].name}</button>`).join("")}
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
          <p class="small-caps">Weekly Preview</p>
          <h3>${state.generatedWeekly ? "已生成周报草稿" : "周报预览"}</h3>
        </div>
        <button class="primary compact" data-action="generate-weekly">Generate</button>
      </div>
      <p class="preview-range">${weekly.range}</p>
      ${renderWeeklyBlock("Wins", weekly.wins)}
      ${renderWeeklyBlock("Learnings", weekly.learnings)}
      ${renderWeeklyBlock("Risks / conflicts", weekly.risks)}
      ${renderWeeklyBlock("Next actions", weekly.nextActions)}
    </section>
  `;
}

function renderWeeklyBlock(title, items) {
  return `
    <div class="weekly-block">
      <h4>${title}</h4>
      <ul>${(items.length ? items : ["暂无内容，等待更多本地事件。"]).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
  `;
}

function renderSafety(daily) {
  const summary = [
    ["Accepted", daily.safety.accepted, "accepted"],
    ["Duplicate", daily.safety.duplicates, "duplicate"],
    ["Conflict", daily.safety.conflicts, "conflict"],
    ["Quarantined", daily.safety.quarantined, "quarantined"],
    ["Redacted", daily.safety.redacted, "redacted"],
    ["Pending", daily.safety.pendingSync, "pending_sync"]
  ];
  const selected = daily.safety.items.find((item) => item.id === state.selectedSafetyId) || daily.safety.items[0];

  return `
    <section class="safety">
      <div class="panel-heading">
        <div>
          <p class="small-caps">Safety Review</p>
          <h3>第二视角：可信状态</h3>
        </div>
      </div>
      <div class="safety-grid">
        ${summary.map(([label, count, kind]) => `<div class="safety-tile ${kind}"><span>${label}</span><strong>${count}</strong></div>`).join("")}
      </div>
      <div class="safety-list">
        ${daily.safety.items.length ? daily.safety.items.map((item) => `
          <button class="safety-row ${selected?.id === item.id ? "active" : ""} ${item.state}" data-safety-id="${item.id}">
            <span>${stateLabel(item.state)}</span>
            <strong>${escapeHtml(item.title)}</strong>
          </button>
        `).join("") : `<div class="empty">今天没有需要人工确认的安全项。</div>`}
      </div>
      ${selected ? `
        <div class="trace-detail">
          <p class="small-caps">Trace</p>
          <h4>${escapeHtml(selected.title)}</h4>
          <p>${escapeHtml(selected.explanation)}</p>
          <code>${escapeHtml(selected.traceId)}</code>
        </div>
      ` : ""}
    </section>
  `;
}

function renderDryRunDrawer(plan) {
  return `
    <div class="drawer-backdrop" data-action="close-dry-run"></div>
    <aside class="dry-run-drawer" aria-label="Feishu dry-run preview">
      <div class="drawer-head">
        <div>
          <p class="small-caps">External Sync Dry-run</p>
          <h3>飞书写入预览</h3>
        </div>
        <button class="icon-button" data-action="close-dry-run" title="关闭">×</button>
      </div>
      <div class="dry-alert">
        <strong>Local-only simulation</strong>
        <p>externalCallsMade = ${String(plan.externalCallsMade)}。没有调用飞书 API，没有创建定时任务。</p>
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
  const dateItems = state.dateList;
  const index = dateItems.findIndex((item) => item.date === state.selectedDate);
  if (action === "prev-date") {
    state.selectedDate = dateItems[Math.min(dateItems.length - 1, index + 1)].date;
  }
  if (action === "next-date") {
    state.selectedDate = dateItems[Math.max(0, index - 1)].date;
  }
  if (action === "open-dry-run") state.dryRunOpen = true;
  if (action === "close-dry-run") state.dryRunOpen = false;
  if (action === "toggle-lang") { state.lang = state.lang === "zh" ? "en" : "zh"; persistPrefs(); }
  if (action === "toggle-theme") { state.theme = state.theme === "light" ? "dark" : "light"; persistPrefs(); }
  if (action === "toggle-left") { state.leftOpen = !state.leftOpen; persistPrefs(); }
  if (action === "toggle-right") { state.rightOpen = !state.rightOpen; persistPrefs(); }
  if (action === "generate-weekly") {
    state.generatedWeekly = true;
    state.rightTab = "weekly";
  }
  if (action === "export-events") exportEvents();
  if (action === "show-safety") state.rightTab = "safety";
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
