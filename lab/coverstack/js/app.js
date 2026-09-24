/**
 * CoverStack Lab v0 — main UI controller.
 * Vanilla ES modules; no build step. Boots from live data feed when available,
 * else fixtures/demo-seed.json (with seed-fallback on feed failure).
 */

import {
  mergeStore,
  resetSeedToFixture,
  getAiDraftsEnabled,
  setAiDraftsEnabled,
  appendSessionDecision,
  getSession,
  STORAGE_KEY,
  METRICS_KEY,
} from "./store.js";
import { runGate, reasonLabel } from "./gate.js";
import {
  resolveRailsForMember,
  cloneRailsForCase,
  proposeSplit,
  proposeIllegalAiSplit,
  templateRationale,
  aiSimulatedRationale,
} from "./policy.js";
import {
  loadDataFeed,
  latestFeedRailsForMember,
  dataSourceLabel,
} from "./data-feed.js";
import { computeMetrics, formatMs, formatPct } from "./metrics.js";

const PLAN_LABELS = {
  employer_ppo: "Employer PPO",
  marketplace: "Marketplace",
  medicaid: "Medicaid",
  medicare_advantage: "Medicare Advantage",
  employer_hmo: "Employer HMO",
};

/** @type {object} */
let seed = null;
/** @type {object} */
let store = null;
/** @type {'live'|'seed'|'seed-fallback'} */
let dataSource = "seed";
/** @type {string|null} */
let dataSourceReason = null;

/** Working case state */
const state = {
  memberId: null,
  caseId: null,
  mode: "idle", // idle | historical | new
  policyVariant: "A",
  rails: [],
  proposedSplit: null,
  editSplit: null,
  rationale: "",
  failureModes: [],
  confidence: null,
  modelId: null,
  auditEvents: [],
  caseStatus: "open",
  oopGapUsd: 0,
  slaHours: 48,
  recommendationId: null,
  readonly: false,
  openedAt: null,
};

function $(id) {
  return document.getElementById(id);
}

function money(n) {
  return `$${Number(n || 0).toLocaleString("en-US")}`;
}

function nowIso() {
  // America/Los_Angeles-ish local ISO with offset from box (already PT)
  const d = new Date();
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const hh = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const mm = String(Math.abs(offset) % 60).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 19);
  return `${local}${sign}${hh}:${mm}`;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function memberById(id) {
  return store.members.find((m) => m.memberId === id);
}

function railsForCase(caseId) {
  return store.rails.filter((r) => r.caseId === caseId);
}

function recForCase(caseId) {
  return store.recommendations.find((r) => r.caseId === caseId);
}

function decForCase(caseId) {
  // Prefer session (newer) then seed
  const all = store.decisions.filter((d) => d.caseId === caseId);
  return all[all.length - 1] || null;
}

function pushAudit(event, detail) {
  state.auditEvents.push({ at: nowIso(), event, detail });
  renderAudit();
}

/* ---------- Renderers ---------- */

function renderMembers() {
  const el = $("memberList");
  el.innerHTML = "";
  for (const m of store.members) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "member-card" + (state.memberId === m.memberId && state.mode === "new" ? " active" : "");
    btn.setAttribute("role", "option");
    btn.innerHTML = `
      <div class="name">${escapeHtml(m.displayName)}</div>
      <div class="sub">${escapeHtml(m.condition)} · ${escapeHtml(m.drugClass)}</div>
      <div class="chips">
        <span class="chip synthetic">synthetic</span>
        <span class="chip">${escapeHtml(PLAN_LABELS[m.planType] || m.planType)}</span>
        <span class="chip">${m.incomeBracketFpl}% FPL</span>
      </div>`;
    btn.addEventListener("click", () => openNewDecision(m.memberId));
    el.appendChild(btn);
  }
}

function renderHistory() {
  const el = $("historyList");
  el.innerHTML = "";
  const cases = [...store.cases].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const c of cases) {
    const m = memberById(c.memberId);
    const dec = decForCase(c.caseId);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "history-card" + (state.caseId === c.caseId && state.mode === "historical" ? " active" : "");
    const gate = dec?.gateResult || c.status;
    btn.innerHTML = `
      <div class="left">
        <div class="id">${escapeHtml(c.caseId)}</div>
        <div class="sub">${escapeHtml(m?.displayName || c.memberId)} · Policy ${c.policyVariant} · ${money(c.oopGapUsd)} OOP</div>
      </div>
      <span class="status-pill ${escapeHtml(c.status)}">${escapeHtml(gate === "block" ? "blocked" : c.status)}</span>`;
    btn.addEventListener("click", () => openHistorical(c.caseId));
    el.appendChild(btn);
  }
}

function renderMetrics() {
  const metrics = computeMetrics(store.decisions, seed.metricsSnapshot);
  $("metricsSeedLabel").textContent = metrics.seedVersion || "seed";
  $("seedVersionLabel").textContent = seed.seedVersion;

  const items = [
    { label: "Decisions", value: String(metrics.decisionCount), nonzero: metrics.decisionCount > 0 },
    { label: "Cases", value: String(metrics.caseCount), nonzero: metrics.caseCount > 0 },
    { label: "Median TTD", value: formatMs(metrics.timeToDecisionMsMedian), nonzero: metrics.timeToDecisionMsMedian > 0 },
    { label: "Trust (mean)", value: String(metrics.trustScoreMean), nonzero: metrics.trustScoreMean > 0 },
    { label: "Override rate", value: formatPct(metrics.overrideRate), nonzero: metrics.overrideRate > 0 },
    { label: "Gate block rate", value: formatPct(metrics.gateBlockRate), nonzero: metrics.gateBlockRate > 0 },
    {
      label: "Rail hit (P/PAP/F)",
      value: `${formatPct(metrics.railHitRate?.plan)} / ${formatPct(metrics.railHitRate?.pap)} / ${formatPct(metrics.railHitRate?.foundation)}`,
      nonzero: true,
      wide: true,
      hint: `AI errors: ${metrics.aiErrorEventCount} · kill rate ${formatPct(metrics.aiErrorKillRate)}`,
    },
  ];

  const card = $("metricsCard");
  card.innerHTML = items
    .map(
      (it) => `
    <div class="metric${it.wide ? " wide" : ""}">
      <div class="label">${it.label}</div>
      <div class="value${it.nonzero ? " nonzero" : ""}">${it.value}</div>
      ${it.hint ? `<div class="hint">${it.hint}</div>` : ""}
    </div>`
    )
    .join("");
}

function renderRails() {
  const grid = $("railsGrid");
  grid.innerHTML = "";
  for (const r of state.rails) {
    const card = document.createElement("div");
    card.className = "rail-card";
    const blockers =
      (r.blockers || [])
        .map((b) => `<span class="blocker">${escapeHtml(b)}</span>`)
        .join("") || "";
    card.innerHTML = `
      <div class="rail-top">
        <span class="rail-name">${escapeHtml(r.railId)}</span>
        <span class="rail-status ${escapeHtml(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="summary">${escapeHtml(r.eligibilitySummary || "")}</div>
      <div class="blockers">${blockers}</div>
      <div class="amount">Est. ${money(r.estimatedContributionUsd)}</div>`;
    grid.appendChild(card);
  }
}

function renderPolicySplit() {
  const s = state.proposedSplit || { planUsd: 0, papUsd: 0, foundationUsd: 0, order: [] };
  $("policySplit").innerHTML = `
    <div class="slot"><div class="k">Plan</div><div class="v">${money(s.planUsd)}</div></div>
    <div class="slot"><div class="k">PAP</div><div class="v">${money(s.papUsd)}</div></div>
    <div class="slot"><div class="k">Foundation</div><div class="v">${money(s.foundationUsd)}</div></div>
    <div class="policy-order">Proposed order: <strong>${escapeHtml((s.order || []).join(" → "))}</strong>
      · Policy <strong>${state.policyVariant}</strong></div>`;

  $("policyA").classList.toggle("active", state.policyVariant === "A");
  $("policyB").classList.toggle("active", state.policyVariant === "B");
}

function renderDraft() {
  const aiOn = getAiDraftsEnabled();
  const label = $("aiLabel");
  if (aiOn && state.modelId !== "template-resolver-v0") {
    label.textContent = "AI draft — edit required";
    label.classList.remove("template");
  } else {
    label.textContent = "Template rationale — edit required";
    label.classList.add("template");
  }

  $("rationaleBox").textContent = state.rationale || "—";

  const fm = $("failureModes");
  fm.innerHTML = (state.failureModes || [])
    .map((f) => `<span class="fm-chip">${escapeHtml(f)}</span>`)
    .join("");

  const ed = state.editSplit || { planUsd: 0, papUsd: 0, foundationUsd: 0, order: ["plan", "pap", "foundation"] };
  $("editPlan").value = ed.planUsd;
  $("editPap").value = ed.papUsd;
  $("editFoundation").value = ed.foundationUsd;
  $("editOrder").value = (ed.order || []).join(",");

  const readonly = state.readonly;
  ["editPlan", "editPap", "editFoundation", "editOrder", "btnApprove", "btnRegenDraft"].forEach((id) => {
    const node = $(id);
    if (!node) return;
    if (id.startsWith("btn")) node.disabled = readonly;
    else node.disabled = readonly;
  });

  updateOopBar();
}

function updateOopBar() {
  const plan = Number($("editPlan").value) || 0;
  const pap = Number($("editPap").value) || 0;
  const foundation = Number($("editFoundation").value) || 0;
  const sum = plan + pap + foundation;
  $("oopGap").textContent = money(state.oopGapUsd);
  $("splitSum").textContent = money(sum);
  const hint = $("oopCoverHint");
  if (sum >= state.oopGapUsd) {
    hint.textContent = "covers OOP gap";
    hint.style.color = "var(--success)";
  } else {
    hint.textContent = `short ${money(state.oopGapUsd - sum)}`;
    hint.style.color = "var(--warn)";
  }
}

function renderAudit() {
  const ol = $("auditLog");
  const events = [...state.auditEvents].reverse();
  ol.innerHTML = events
    .map(
      (e) => `<li>
      <span class="at">${escapeHtml(formatAuditTime(e.at))}</span>
      <span class="ev">${escapeHtml(e.event)}</span>
      <span class="detail">${escapeHtml(e.detail || "")}</span>
    </li>`
    )
    .join("");
}

function formatAuditTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }) + " PT";
  } catch {
    return iso;
  }
}

function showWorkspace(show) {
  $("emptyState").hidden = show;
  $("caseWorkspace").hidden = !show;
}

function renderCaseHeader() {
  const m = memberById(state.memberId);
  $("caseEyebrow").textContent =
    state.mode === "historical" ? `Historical · ${state.caseId}` : `New decision · ${state.caseId}`;
  $("caseTitle").textContent = m?.displayName || "—";
  $("caseMeta").textContent = m
    ? `${m.age}y · ${m.condition} · ${m.drugClass} · ${PLAN_LABELS[m.planType] || m.planType} · ${m.incomeBracketFpl}% FPL · SLA ${state.slaHours}h`
    : "";
  const pill = $("caseStatusPill");
  pill.textContent = state.caseStatus;
  pill.className = `status-pill ${state.caseStatus}`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ---------- Case open flows ---------- */

function defaultOopForMember(member) {
  const map = {
    "mira-sampleton": 1600,
    "theo-demohope": 950,
    "luna-ficticia": 2200,
    "axel-placeholder": 3100,
    "nora-prototyke": 1600,
  };
  return map[member.memberId] || 1500;
}

function buildDraft({ intentionalIllegal = false } = {}) {
  const m = memberById(state.memberId);
  const aiOn = getAiDraftsEnabled();
  let split;
  let failureModes = [];
  let confidence = 0.75;
  let modelId = "demo-cheap-tier-v0";
  let rationale;

  const gov =
    m.planType === "medicaid" ||
    m.planType === "medicare_advantage" ||
    m.planType === "medicare";

  if (aiOn) {
    if (intentionalIllegal || (gov && state.mode === "new")) {
      // Simulate AI that sometimes proposes illegal PAP under gov insurance
      split = proposeIllegalAiSplit({
        rails: state.rails,
        oopGapUsd: state.oopGapUsd,
        member: m,
      });
      failureModes = ["illegal_stack", "wrong_rail"];
      confidence = 0.41;
    } else {
      split = proposeSplit({
        rails: state.rails,
        oopGapUsd: state.oopGapUsd,
        policyVariant: state.policyVariant,
      });
      // Prefer estimated contributions on rails for proposed amounts when present
      split = applyRailEstimates(split, state.rails);
    }
    rationale = aiSimulatedRationale({
      member: m,
      rails: state.rails,
      split,
      policyVariant: state.policyVariant,
      failureModes,
    });
    pushAudit("ai_draft", `confidence=${confidence}${failureModes.length ? ` failureModes=${failureModes.join(",")}` : ""}`);
  } else {
    split = proposeSplit({
      rails: state.rails,
      oopGapUsd: state.oopGapUsd,
      policyVariant: state.policyVariant,
    });
    split = applyRailEstimates(split, state.rails);
    modelId = "template-resolver-v0";
    confidence = 0.55;
    rationale = templateRationale({
      member: m,
      rails: state.rails,
      split,
      policyVariant: state.policyVariant,
      oopGapUsd: state.oopGapUsd,
    });
    pushAudit("ai_draft", "template fallback (AI_DRAFTS_ENABLED=false)");
  }

  state.proposedSplit = { ...split };
  state.editSplit = { ...split, order: [...(split.order || [])] };
  state.rationale = rationale;
  state.failureModes = failureModes;
  state.confidence = confidence;
  state.modelId = modelId;
  state.recommendationId = uid("rec");
}

function applyRailEstimates(split, rails) {
  // proposeSplit already folds feed statuses/amounts + Policy A/B bias.
  // Here we only hard-zero red rails so the toggle cannot reintroduce illegal $.
  const out = { ...split, order: [...(split.order || [])] };
  for (const r of rails) {
    if (r.status === "red") {
      if (r.railId === "plan") out.planUsd = 0;
      if (r.railId === "pap") out.papUsd = 0;
      if (r.railId === "foundation") out.foundationUsd = 0;
    }
  }
  return out;
}

function openNewDecision(memberId) {
  const m = memberById(memberId);
  if (!m) return;

  state.memberId = memberId;
  state.caseId = uid(`case-${memberId.split("-")[0]}`);
  state.mode = "new";
  state.policyVariant = m.planType === "marketplace" || memberId === "nora-prototyke" ? "B" : "A";
  state.oopGapUsd = defaultOopForMember(m);
  state.slaHours = 48;
  state.caseStatus = "open";
  state.readonly = false;
  state.openedAt = Date.now();
  state.auditEvents = [];

  // Prefer current feed rail statuses/amounts for this member (Policy A/B compute from them).
  const feedRails = latestFeedRailsForMember(store, memberId);
  if (feedRails?.length) {
    state.rails = cloneRailsForCase(feedRails, state.caseId);
    // Prefer feed case OOP when opening from live/seed pack for that member
    const latestCase = [...store.cases]
      .filter((c) => c.memberId === memberId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
    if (latestCase?.oopGapUsd) state.oopGapUsd = latestCase.oopGapUsd;
    if (latestCase?.slaHours) state.slaHours = latestCase.slaHours;
  } else {
    state.rails = resolveRailsForMember(m, state.caseId);
    // Fill estimated contributions proportionally for display when no feed amounts
    const draftSplit = proposeSplit({
      rails: state.rails,
      oopGapUsd: state.oopGapUsd,
      policyVariant: state.policyVariant,
    });
    for (const r of state.rails) {
      if (r.status === "red") r.estimatedContributionUsd = 0;
      else if (r.railId === "plan") r.estimatedContributionUsd = draftSplit.planUsd;
      else if (r.railId === "pap") r.estimatedContributionUsd = draftSplit.papUsd;
      else if (r.railId === "foundation") r.estimatedContributionUsd = draftSplit.foundationUsd;
    }
  }

  $("gateResult").hidden = true;
  $("gateResult").textContent = "";

  showWorkspace(true);
  pushAudit("case_open", `Loaded ${m.displayName} synthetic fixture (new)`);
  pushAudit(
    "rails_resolved",
    state.rails.map((r) => `${r.railId}=${r.status}`).join(" ")
  );
  buildDraft({ intentionalIllegal: false });
  refreshAll();
}

function openHistorical(caseId) {
  const c = store.cases.find((x) => x.caseId === caseId);
  if (!c) return;
  const m = memberById(c.memberId);
  const rails = railsForCase(caseId);
  const rec = recForCase(caseId);
  const dec = decForCase(caseId);

  state.memberId = c.memberId;
  state.caseId = caseId;
  state.mode = "historical";
  state.policyVariant = c.policyVariant || rec?.policyVariant || "A";
  state.oopGapUsd = c.oopGapUsd;
  state.slaHours = c.slaHours;
  state.caseStatus = c.status;
  state.readonly = true;
  state.openedAt = Date.now();
  state.rails = rails.length ? rails : resolveRailsForMember(m, caseId);
  state.recommendationId = rec?.recommendationId || null;

  if (rec) {
    state.proposedSplit = { ...rec.proposedSplit };
    state.editSplit = dec?.finalSplit
      ? { ...dec.finalSplit }
      : { ...rec.proposedSplit };
    state.rationale = rec.rationaleDraft;
    state.failureModes = rec.failureModes || [];
    state.confidence = rec.confidence;
    state.modelId = rec.modelId;
  } else {
    buildDraft();
  }

  state.auditEvents = dec?.auditEvents ? [...dec.auditEvents] : [];

  const gr = $("gateResult");
  if (dec) {
    gr.hidden = false;
    gr.className = `gate-result ${dec.gateResult}`;
    const reasons =
      (dec.gateReasons || []).map((r) => `<li><code>${escapeHtml(r)}</code> — ${escapeHtml(reasonLabel(r))}</li>`).join("") ||
      "<li>None</li>";
    gr.innerHTML = `<h4>Gate ${escapeHtml(dec.gateResult)} (seeded)</h4>
      <div>Final split: plan ${money(dec.finalSplit.planUsd)} · PAP ${money(dec.finalSplit.papUsd)} · foundation ${money(dec.finalSplit.foundationUsd)}</div>
      <ul>${reasons}</ul>`;
  } else {
    gr.hidden = true;
  }

  showWorkspace(true);
  refreshAll();
}

function refreshAll() {
  renderMembers();
  renderHistory();
  renderMetrics();
  renderCaseHeader();
  renderRails();
  renderPolicySplit();
  renderDraft();
  renderAudit();
}

function readEditSplit() {
  return {
    planUsd: Number($("editPlan").value) || 0,
    papUsd: Number($("editPap").value) || 0,
    foundationUsd: Number($("editFoundation").value) || 0,
    order: ($("editOrder").value || "plan,pap,foundation").split(","),
  };
}

function onApprove() {
  if (state.readonly) return;
  const m = memberById(state.memberId);
  const edit = readEditSplit();
  state.editSplit = edit;

  const proposed = state.proposedSplit || edit;
  const overrideFields = [];
  if (edit.planUsd !== proposed.planUsd) overrideFields.push("planUsd");
  if (edit.papUsd !== proposed.papUsd) overrideFields.push("papUsd");
  if (edit.foundationUsd !== proposed.foundationUsd) overrideFields.push("foundationUsd");
  if ((edit.order || []).join(",") !== (proposed.order || []).join(",")) overrideFields.push("order");
  const isOverride = overrideFields.length > 0;

  if (isOverride) {
    pushAudit("human_edit", `Changed ${overrideFields.join(", ")}`);
  }

  pushAudit("human_approve_attempt", "Coordinator proxy approve");

  const gate = runGate({
    split: edit,
    rails: state.rails,
    member: m,
    oopGapUsd: state.oopGapUsd,
  });

  const ttd = Date.now() - (state.openedAt || Date.now());

  if (gate.pass) {
    pushAudit("gate_pass", "OOP covered; no illegal stack");
    state.caseStatus = "decided";
  } else {
    pushAudit("gate_block", gate.reasons.join(", "));
    state.caseStatus = "blocked";
  }

  const decisionId = uid("dec");
  pushAudit("decision_logged", `${decisionId}${gate.pass ? "" : " blocked"}`);

  const recommendation = {
    recommendationId: state.recommendationId || uid("rec"),
    caseId: state.caseId,
    policyVariant: state.policyVariant,
    proposedSplit: { ...proposed },
    rationaleDraft: state.rationale,
    confidence: state.confidence,
    failureModes: state.failureModes,
    modelId: state.modelId,
    promptHash: "session-demo",
    createdAt: nowIso(),
    state: gate.pass ? "approved" : "rejected",
  };

  const caseObj = {
    caseId: state.caseId,
    memberId: state.memberId,
    oopGapUsd: state.oopGapUsd,
    slaHours: state.slaHours,
    createdAt: nowIso(),
    status: state.caseStatus,
    policyVariant: state.policyVariant,
  };

  const decision = {
    decisionId,
    caseId: state.caseId,
    recommendationId: recommendation.recommendationId,
    finalSplit: { ...edit },
    approverRole: "coordinator_proxy",
    gateResult: gate.result,
    gateReasons: gate.reasons,
    timeToDecisionMs: ttd,
    trustScore: gate.pass ? 4 : 5,
    override: isOverride,
    overrideFields,
    auditEvents: [...state.auditEvents],
  };

  // Persist session rails into store view by attaching to seed.rails clone via session cases only;
  // for display of historical reopen of NEW cases, stash rails on session case
  caseObj._rails = state.rails;

  appendSessionDecision(decision, caseObj, recommendation);

  // Also keep rails for session cases discoverable
  const session = getSession();
  if (!session.rails) session.rails = [];
  for (const r of state.rails) {
    if (!session.rails.some((x) => x.caseId === r.caseId && x.railId === r.railId)) {
      session.rails.push(r);
    }
  }
  localStorage.setItem("coverstack.demo.session.v1", JSON.stringify(session));

  store = mergeStore(seed);
  // Merge session rails
  if (session.rails?.length) {
    store.rails = [...store.rails, ...session.rails.filter((r) => !store.rails.some((s) => s.caseId === r.caseId && s.railId === r.railId))];
  }

  const gr = $("gateResult");
  gr.hidden = false;
  gr.className = `gate-result ${gate.result}`;
  const reasons =
    gate.reasons.map((r) => `<li><code>${escapeHtml(r)}</code> — ${escapeHtml(reasonLabel(r))}</li>`).join("") ||
    "<li>None</li>";
  gr.innerHTML = `<h4>Gate ${escapeHtml(gate.result)}</h4>
    <div>Sum ${money(gate.sumUsd)} vs envelope ${money(gate.envelopeUsd)}</div>
    <ul>${reasons}</ul>
    ${gate.pass ? "<p>Decision logged to session audit. Metrics updated.</p>" : "<p>Export blocked. Zero the illegal rail and retry.</p>"}`;

  state.readonly = true;
  refreshAll();
}

/* ---------- Events ---------- */

function bindEvents() {
  $("policyA").addEventListener("click", () => {
    if (state.readonly) return;
    state.policyVariant = "A";
    buildDraft();
    renderPolicySplit();
    renderDraft();
  });
  $("policyB").addEventListener("click", () => {
    if (state.readonly) return;
    state.policyVariant = "B";
    buildDraft();
    renderPolicySplit();
    renderDraft();
  });

  ["editPlan", "editPap", "editFoundation", "editOrder"].forEach((id) => {
    $(id).addEventListener("input", () => {
      state.editSplit = readEditSplit();
      updateOopBar();
    });
  });

  $("btnApprove").addEventListener("click", onApprove);
  $("btnRegenDraft").addEventListener("click", () => {
    if (state.readonly) return;
    buildDraft({ intentionalIllegal: false });
    renderPolicySplit();
    renderDraft();
  });

  $("btnNewDecision").addEventListener("click", () => {
    if (state.memberId) openNewDecision(state.memberId);
  });

  $("aiDraftsEnabled").checked = getAiDraftsEnabled();
  $("aiDraftsEnabled").addEventListener("change", (e) => {
    setAiDraftsEnabled(e.target.checked);
    if (!state.readonly && state.mode === "new") {
      buildDraft();
      renderDraft();
    } else {
      renderDraft();
    }
  });

  $("btnResetSeed").addEventListener("click", () => {
    if (!confirm("Clear localStorage seed + session and reload from fixtures/demo-seed.json?")) return;
    resetSeedToFixture();
    location.reload();
  });
}

/* ---------- Boot ---------- */

function renderDataSource() {
  const el = $("dataSourceIndicator");
  const label = $("dataSourceLabel");
  if (!el || !label) return;
  label.textContent = dataSourceLabel(dataSource);
  el.dataset.source = dataSource;
  el.title =
    dataSource === "seed-fallback"
      ? `Fell back to seed: ${dataSourceReason || "feed error"}`
      : dataSource === "live"
        ? "Loaded from live HTTP data feed (synthetic)"
        : "Loaded from fixtures/demo-seed.json";
}

/**
 * For seed source only: keep localStorage reproducibility (same as prior loadSeedPack).
 * Live feed always uses the fresh pack so Policy A/B see current feed rails.
 */
function applySeedLocalStorage(pack) {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed?.seedVersion && parsed?.members) {
        globalThis.__COVERSTACK_DEMO_SEED__ = parsed;
        return parsed;
      }
    }
  } catch {
    /* fall through */
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pack));
  localStorage.setItem(METRICS_KEY, JSON.stringify(pack.metricsSnapshot));
  globalThis.__COVERSTACK_DEMO_SEED__ = pack;
  return pack;
}

async function boot() {
  try {
    const feed = await loadDataFeed({ fallbackSeedUrl: "fixtures/demo-seed.json" });
    dataSource = feed.dataSource;
    dataSourceReason = feed.reason;

    if (feed.dataSource === "live") {
      seed = feed.pack;
      globalThis.__COVERSTACK_DEMO_SEED__ = seed;
    } else {
      seed = applySeedLocalStorage(feed.pack);
    }

    store = mergeStore(seed);

    // Merge any session rails
    const session = getSession();
    if (session.rails?.length) {
      store.rails = [
        ...store.rails,
        ...session.rails.filter(
          (r) => !store.rails.some((s) => s.caseId === r.caseId && s.railId === r.railId)
        ),
      ];
    }

    bindEvents();
    renderDataSource();
    renderMembers();
    renderHistory();
    renderMetrics();
    $("seedVersionLabel").textContent = seed.seedVersion;

    console.info(
      "[CoverStack]",
      seed.seedVersion,
      "dataSource=",
      dataSource,
      "feedUrl=",
      feed.feedUrl,
      "decisions=",
      store.decisions.length,
      "metrics.decisionCount=",
      seed.metricsSnapshot.decisionCount,
      dataSourceReason ? `reason=${dataSourceReason}` : ""
    );
  } catch (err) {
    console.error(err);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div class="disclaimer-banner" style="background:#4a1010;border-color:#a03030;color:#ffc0c0">
        Failed to load data feed / fixtures/demo-seed.json. Prefer
        <code>node scripts/serve-live.mjs</code> or <code>npx serve</code> —
        file:// may block fetch. ${escapeHtml(err.message)}
      </div>`
    );
  }
}

boot();
