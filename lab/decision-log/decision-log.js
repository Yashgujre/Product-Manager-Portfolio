(() => {
  const STORAGE_KEY = "yg-decision-log-v1";
  const SAMPLE_ID = "sample-care-referral";
  const STATUSES = ["proposed", "decided", "validated", "reversed"];

  const root = document.querySelector("[data-dl-app]");
  if (!root) return;

  const els = {
    status: root.querySelector("[data-dl-status]"),
    whenOpen: root.querySelector("[data-dl-when-open]"),
    list: root.querySelector("[data-dl-list]"),
    count: root.querySelector("[data-dl-count]"),
    switcher: root.querySelector("[data-dl-switcher]"),
    empty: root.querySelector("[data-dl-empty]"),
    editor: root.querySelector("[data-dl-editor]"),
    optionList: root.querySelector("[data-dl-option-list]"),
    reading: root.querySelector("[data-dl-reading]"),
    print: document.querySelector("[data-dl-print]"),
    toggleReading: root.querySelector("[data-dl-toggle-reading]"),
    title: document.getElementById("dl-title"),
    context: document.getElementById("dl-context"),
    chosen: document.getElementById("dl-chosen"),
    tags: document.getElementById("dl-tags"),
    rationale: document.getElementById("dl-rationale"),
    metricName: document.getElementById("dl-metric-name"),
    metricTarget: document.getElementById("dl-metric-target"),
    reviewDate: document.getElementById("dl-review-date"),
  };

  const state = {
    decisions: [],
    activeId: null,
    reading: false,
    saveTimer: null,
  };

  const uid = () => {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);

  const daysFromNow = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  };

  const escapeHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const emptyOption = () => ({
    id: uid(),
    name: "",
    pros: "",
    cons: "",
    effort: "",
  });

  const blankDecision = () => ({
    id: uid(),
    title: "",
    context: "",
    options: [emptyOption(), emptyOption()],
    chosenOptionId: "",
    rationale: "",
    metricName: "",
    metricTarget: "",
    reviewDate: "",
    status: "proposed",
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const sampleDecision = () => ({
    id: SAMPLE_ID,
    title: "Replace partner referral coordination with a structured workflow, or keep email plus a dashboard?",
    context:
      "Care coordinators across a Medicaid network still acknowledge member referrals by email. Median acknowledgment is 4.2 days. Partners miss intervention windows, and leadership cannot see SLA risk until a monthly spreadsheet lands.\n\nA dashboard was proposed this quarter because it is cheaper and visible. The process is still the bottleneck: unstructured inboxes, no clock, no escalation path.",
    options: [
      {
        id: "opt-dashboard",
        name: "Email dashboard",
        pros: "Ships in about 6 weeks. No partner integration work. Leadership gets a chart this quarter.",
        cons: "Does not change acknowledgment behavior. Data stays unstructured. SLA is still inferred after the fact.",
        effort: "Low · 1 squad · ~6 weeks",
      },
      {
        id: "opt-queue",
        name: "Structured referral workflow",
        pros: "Creates a system of record with timestamps. Enables SLA clocks and escalation. Reusable for screening and later intervention types.",
        cons: "Partner change management. Needs a secure portal or API. Longer to first chart than a dashboard overlay.",
        effort: "Medium · 1 squad + partner ops · 10–12 weeks",
      },
      {
        id: "opt-staff",
        name: "Staff the gap",
        pros: "Immediate capacity. No build. Familiar operating model for coordinators.",
        cons: "Linear cost. No learning loop. Quality still depends on who is on shift. The next program still starts from email.",
        effort: "High ongoing opex",
      },
    ],
    chosenOptionId: "opt-queue",
    rationale:
      "A dashboard on a broken process still leaves the process broken. The constraint is unstructured work, not missing charts.\n\nA referral queue with timestamps is the smallest change that makes SLA real and lets us add partner types without a new integration each time. We are not optimizing for a leadership slide this quarter; we are optimizing for acknowledgment speed and a reusable coordination model.",
    metricName: "Median referral acknowledgment time",
    metricTarget: "≤ 1.5 days (from 4.2 days) for the first partner cohort",
    reviewDate: daysFromNow(90),
    status: "decided",
    tags: ["architecture", "process", "care-coordination", "GTM"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const parseTags = (value) =>
    String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const formatTags = (tags) => (Array.isArray(tags) ? tags.join(", ") : "");

  const displayTitle = (decision) => decision.title.trim() || "Untitled decision";

  const formatDate = (iso) => {
    if (!iso) return "—";
    const date = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  const slugify = (value) =>
    String(value || "decision")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "decision";

  const loadStore = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.decisions)) return;
      state.decisions = parsed.decisions;
      state.activeId = parsed.activeId || null;
    } catch {
      announce("Could not read saved decisions. Starting fresh.");
    }
  };

  const persist = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: 1,
          activeId: state.activeId,
          decisions: state.decisions,
        })
      );
    } catch {
      announce("Could not save. This browser may be blocking storage.");
    }
  };

  const activeDecision = () => state.decisions.find((item) => item.id === state.activeId) || null;

  const upsert = (decision) => {
    const index = state.decisions.findIndex((item) => item.id === decision.id);
    decision.updatedAt = new Date().toISOString();
    if (index >= 0) state.decisions.splice(index, 1);
    state.decisions.unshift(decision);
    state.activeId = decision.id;
  };

  const announce = (message) => {
    if (els.status) els.status.textContent = message;
  };

  const optionMarkup = (option, index, total) => `
    <article class="dl-option" data-option-id="${escapeHtml(option.id)}">
      <div class="dl-option-head">
        <div class="dl-field">
          <label for="opt-name-${escapeHtml(option.id)}">Option ${index + 1} name</label>
          <input id="opt-name-${escapeHtml(option.id)}" name="option-name" type="text" value="${escapeHtml(option.name)}" placeholder="Named alternative" />
        </div>
        <div class="dl-field">
          <label for="opt-effort-${escapeHtml(option.id)}">Rough cost / effort</label>
          <input id="opt-effort-${escapeHtml(option.id)}" name="option-effort" type="text" value="${escapeHtml(option.effort)}" placeholder="Low · 6 weeks" />
        </div>
        <button type="button" class="dl-remove-option" data-dl-remove-option ${total <= 2 ? "disabled" : ""}>Remove</button>
      </div>
      <div class="dl-option-grid">
        <div class="dl-field">
          <label for="opt-pros-${escapeHtml(option.id)}">Pros</label>
          <textarea id="opt-pros-${escapeHtml(option.id)}" name="option-pros" rows="3">${escapeHtml(option.pros)}</textarea>
        </div>
        <div class="dl-field">
          <label for="opt-cons-${escapeHtml(option.id)}">Cons</label>
          <textarea id="opt-cons-${escapeHtml(option.id)}" name="option-cons" rows="3">${escapeHtml(option.cons)}</textarea>
        </div>
      </div>
    </article>
  `;

  const readOptionsFromDom = () =>
    Array.from(els.optionList.querySelectorAll(".dl-option")).map((row) => ({
      id: row.getAttribute("data-option-id"),
      name: row.querySelector('[name="option-name"]')?.value || "",
      effort: row.querySelector('[name="option-effort"]')?.value || "",
      pros: row.querySelector('[name="option-pros"]')?.value || "",
      cons: row.querySelector('[name="option-cons"]')?.value || "",
    }));

  const readForm = () => {
    const current = activeDecision() || blankDecision();
    const statusInput = els.editor.querySelector('input[name="status"]:checked');
    return {
      ...current,
      title: els.title.value,
      context: els.context.value,
      options: readOptionsFromDom(),
      chosenOptionId: els.chosen.value,
      rationale: els.rationale.value,
      metricName: els.metricName.value,
      metricTarget: els.metricTarget.value,
      reviewDate: els.reviewDate.value,
      status: STATUSES.includes(statusInput?.value) ? statusInput.value : "proposed",
      tags: parseTags(els.tags.value),
    };
  };

  const setStatus = (status) => {
    const value = STATUSES.includes(status) ? status : "proposed";
    els.editor.querySelectorAll('input[name="status"]').forEach((input) => {
      input.checked = input.value === value;
    });
  };

  const syncChosenSelect = (decision) => {
    const selected = decision.chosenOptionId || "";
    const options = decision.options
      .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name.trim() || "Untitled option")}</option>`)
      .join("");
    els.chosen.innerHTML = `<option value="">Select the chosen option</option>${options}`;
    els.chosen.value = decision.options.some((option) => option.id === selected) ? selected : "";
  };

  const fillForm = (decision) => {
    els.title.value = decision.title;
    els.context.value = decision.context;
    els.rationale.value = decision.rationale;
    els.metricName.value = decision.metricName;
    els.metricTarget.value = decision.metricTarget;
    els.reviewDate.value = decision.reviewDate;
    els.tags.value = formatTags(decision.tags);
    setStatus(decision.status);
    els.optionList.innerHTML = decision.options.map((option, index) => optionMarkup(option, index, decision.options.length)).join("");
    syncChosenSelect(decision);
  };

  const readingHtml = (decision) => {
    const chosen = decision.options.find((option) => option.id === decision.chosenOptionId);
    const tags = (decision.tags || [])
      .map((tag) => `<span class="dl-tag">${escapeHtml(tag)}</span>`)
      .join("");
    const options = decision.options
      .map((option) => {
        const isChosen = option.id === decision.chosenOptionId;
        return `
          <article class="dl-reading-option${isChosen ? " chosen" : ""}">
            <h4>${escapeHtml(option.name.trim() || "Untitled option")}${isChosen ? " · chosen" : ""}</h4>
            <p class="dl-list-meta">${escapeHtml(option.effort || "Effort not specified")}</p>
            <p><strong>Pros.</strong> ${escapeHtml(option.pros || "—")}</p>
            <p><strong>Cons.</strong> ${escapeHtml(option.cons || "—")}</p>
          </article>
        `;
      })
      .join("");

    return `
      <p class="dl-reading-kicker">Decision record</p>
      <h2>${escapeHtml(displayTitle(decision))}</h2>
      <div class="dl-reading-meta">
        <span class="dl-badge dl-badge-${escapeHtml(decision.status)}">${escapeHtml(decision.status)}</span>
        <span>Updated ${escapeHtml(formatDate(decision.updatedAt.slice(0, 10)))}</span>
        ${tags ? `<span class="dl-tag-row">${tags}</span>` : ""}
      </div>
      <section class="dl-reading-block">
        <h3>Context</h3>
        <p>${escapeHtml(decision.context || "No context captured.")}</p>
      </section>
      <section class="dl-reading-block">
        <h3>Options considered</h3>
        <div class="dl-reading-options">${options}</div>
      </section>
      <section class="dl-reading-block">
        <h3>Decision</h3>
        <p><strong>Chosen:</strong> ${escapeHtml(chosen?.name || "Not selected yet")}</p>
        <p>${escapeHtml(decision.rationale || "No rationale captured.")}</p>
      </section>
      <section class="dl-reading-block">
        <h3>Success metric</h3>
        <p><strong>${escapeHtml(decision.metricName || "Metric not named")}</strong></p>
        <p>Target: ${escapeHtml(decision.metricTarget || "—")}</p>
        <p>Review: ${escapeHtml(formatDate(decision.reviewDate))}</p>
      </section>
    `;
  };

  const printHtml = (decision) => {
    const inner = readingHtml(decision).replace("<h2>", "<h1>").replace("</h2>", "</h1>");
    return `<article class="dl-reading">${inner}</article>`;
  };

  const toMarkdown = (decision) => {
    const chosen = decision.options.find((option) => option.id === decision.chosenOptionId);
    const optionBlocks = decision.options
      .map((option, index) => {
        const mark = option.id === decision.chosenOptionId ? " (chosen)" : "";
        return `### ${index + 1}. ${option.name.trim() || "Untitled option"}${mark}

- **Effort:** ${option.effort || "Not specified"}
- **Pros:** ${option.pros || "—"}
- **Cons:** ${option.cons || "—"}`;
      })
      .join("\n\n");

    return `# Decision: ${displayTitle(decision)}

- **Status:** ${decision.status}
- **Tags:** ${(decision.tags || []).join(", ") || "—"}
- **Updated:** ${formatDate(decision.updatedAt.slice(0, 10))}

## Context

${decision.context || "No context captured."}

## Options considered

${optionBlocks}

## Decision

**Chosen:** ${chosen?.name || "Not selected yet"}

${decision.rationale || "No rationale captured."}

## Success metric

- **Metric:** ${decision.metricName || "Not named"}
- **Target:** ${decision.metricTarget || "—"}
- **Review date:** ${formatDate(decision.reviewDate)}
`;
  };

  const renderList = () => {
    const count = state.decisions.length;
    els.count.textContent = String(count);
    els.list.innerHTML = state.decisions
      .map((decision) => {
        const current = decision.id === state.activeId;
        return `
          <li>
            <button type="button" data-dl-open="${escapeHtml(decision.id)}" aria-current="${current ? "true" : "false"}">
              <span class="dl-list-title">${escapeHtml(displayTitle(decision))}</span>
              <span class="dl-list-meta">
                <span class="dl-badge dl-badge-${escapeHtml(decision.status)}">${escapeHtml(decision.status)}</span>
                <span>${escapeHtml(formatDate(decision.updatedAt.slice(0, 10)))}</span>
              </span>
            </button>
          </li>
        `;
      })
      .join("");

    els.switcher.innerHTML =
      `<option value="">${count ? "Select a decision" : "No saved decisions"}</option>` +
      state.decisions
        .map(
          (decision) =>
            `<option value="${escapeHtml(decision.id)}" ${decision.id === state.activeId ? "selected" : ""}>${escapeHtml(displayTitle(decision))}</option>`
        )
        .join("");
  };

  const setHash = (value) => {
    const next = `${location.pathname}${location.search}${value ? `#${value}` : ""}`;
    if (`${location.pathname}${location.search}${location.hash}` !== next) {
      history.replaceState(null, "", next);
    }
  };

  const updateHashForActive = (decision) => {
    if (!decision) {
      setHash("");
      return;
    }
    setHash(decision.id === SAMPLE_ID ? "sample" : `id=${encodeURIComponent(decision.id)}`);
  };

  const renderWorkspace = () => {
    const decision = activeDecision();
    const hasActive = Boolean(decision);
    els.empty.hidden = hasActive;
    els.editor.hidden = !hasActive || state.reading;
    els.reading.hidden = !hasActive || !state.reading;
    els.whenOpen.hidden = !hasActive;
    els.toggleReading?.setAttribute("aria-pressed", state.reading ? "true" : "false");
    if (els.toggleReading) els.toggleReading.textContent = state.reading ? "Edit view" : "Reading view";

    if (hasActive) {
      els.reading.innerHTML = readingHtml(decision);
      if (els.print) els.print.innerHTML = printHtml(decision);
    } else if (els.print) {
      els.print.innerHTML = "";
    }
  };

  const saveFromForm = (silent) => {
    if (!state.activeId || els.editor.hidden) return;
    const decision = readForm();
    upsert(decision);
    persist();
    renderList();
    els.reading.innerHTML = readingHtml(decision);
    if (els.print) els.print.innerHTML = printHtml(decision);
    updateHashForActive(decision);
    if (!silent) announce("Saved in this browser");
  };

  const scheduleSave = () => {
    window.clearTimeout(state.saveTimer);
    state.saveTimer = window.setTimeout(() => saveFromForm(false), 280);
  };

  const openDecision = (id, options = {}) => {
    const decision = state.decisions.find((item) => item.id === id);
    if (!decision) return;
    if (state.activeId && !els.editor.hidden) saveFromForm(true);
    state.activeId = decision.id;
    state.reading = Boolean(options.reading);
    fillForm(decision);
    persist();
    renderList();
    renderWorkspace();
    updateHashForActive(decision);
    if (!options.silent) announce(`Opened “${displayTitle(decision)}”`);
  };

  const createDecision = (seed, options = {}) => {
    if (state.activeId && !els.editor.hidden) saveFromForm(true);
    const decision = seed || blankDecision();
    upsert(decision);
    persist();
    state.reading = false;
    fillForm(decision);
    renderList();
    renderWorkspace();
    updateHashForActive(decision);
    if (!options.silent) {
      announce(seed ? "Sample loaded" : "New decision started");
      els.title.focus();
    }
  };

  const loadSample = (options = {}) => {
    createDecision(sampleDecision(), options);
  };

  const deleteActive = () => {
    const decision = activeDecision();
    if (!decision) return;
    const ok = window.confirm(`Delete “${displayTitle(decision)}”? This cannot be undone.`);
    if (!ok) return;
    state.decisions = state.decisions.filter((item) => item.id !== decision.id);
    const next = state.decisions[0] || null;
    state.activeId = next?.id || null;
    state.reading = false;
    persist();
    if (next) {
      fillForm(next);
      updateHashForActive(next);
    } else {
      setHash("");
    }
    renderList();
    renderWorkspace();
    announce("Decision deleted");
  };

  const copyText = async (text, successMessage) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.left = "-9999px";
        document.body.appendChild(area);
        area.select();
        document.execCommand("copy");
        area.remove();
      }
      announce(successMessage);
    } catch {
      announce("Copy failed. You can download the Markdown file instead.");
    }
  };

  const downloadMarkdown = (decision) => {
    const blob = new Blob([toMarkdown(decision)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slugify(displayTitle(decision))}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    announce("Markdown downloaded");
  };

  const shareUrlFor = (decision) => {
    const encoded = encodeURIComponent(JSON.stringify(decision));
    return `${location.origin}${location.pathname}${location.search}#d=${encoded}`;
  };

  const applyHash = () => {
    const hash = location.hash.replace(/^#/, "");
    if (!hash) return false;
    if (hash === "sample") {
      loadSample({ silent: true });
      return true;
    }
    if (hash.startsWith("id=")) {
      let id = hash.slice(3);
      try {
        id = decodeURIComponent(id);
      } catch {
        /* keep raw id */
      }
      if (state.decisions.some((item) => item.id === id)) {
        openDecision(id, { silent: true });
        return true;
      }
    }
    if (hash.startsWith("d=")) {
      try {
        const payload = JSON.parse(decodeURIComponent(hash.slice(2)));
        if (payload && typeof payload === "object" && Array.isArray(payload.options)) {
          if (!payload.id) payload.id = uid();
          if (!payload.createdAt) payload.createdAt = new Date().toISOString();
          upsert(payload);
          persist();
          openDecision(payload.id, { silent: true, reading: true });
          announce("Opened shared decision");
          return true;
        }
      } catch {
        announce("Could not read the shared decision from the URL.");
      }
    }
    return false;
  };

  root.querySelector("[data-dl-new]")?.addEventListener("click", () => createDecision());
  root.querySelector("[data-dl-empty-new]")?.addEventListener("click", () => createDecision());
  root.querySelector("[data-dl-sample]")?.addEventListener("click", () => loadSample());
  root.querySelector("[data-dl-empty-sample]")?.addEventListener("click", () => loadSample());
  root.querySelector("[data-dl-delete]")?.addEventListener("click", deleteActive);
  root.querySelector("[data-dl-copy-md]")?.addEventListener("click", () => {
    const decision = els.editor.hidden ? activeDecision() : readForm();
    if (!decision) return;
    copyText(toMarkdown(decision), "Markdown copied");
  });
  root.querySelector("[data-dl-download]")?.addEventListener("click", () => {
    const decision = els.editor.hidden ? activeDecision() : readForm();
    if (!decision) return;
    saveFromForm(true);
    downloadMarkdown(decision);
  });
  root.querySelector("[data-dl-share]")?.addEventListener("click", () => {
    const decision = els.editor.hidden ? activeDecision() : readForm();
    if (!decision) return;
    saveFromForm(true);
    copyText(shareUrlFor(decision), "Share link copied");
  });
  root.querySelector("[data-dl-print]")?.addEventListener("click", () => {
    saveFromForm(true);
    window.print();
  });
  els.toggleReading?.addEventListener("click", () => {
    if (!state.activeId) return;
    if (!state.reading) saveFromForm(true);
    state.reading = !state.reading;
    renderWorkspace();
    if (!state.reading) els.title.focus();
  });

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dl-open]");
    if (!button) return;
    openDecision(button.getAttribute("data-dl-open"));
  });

  els.switcher.addEventListener("change", () => {
    if (els.switcher.value) openDecision(els.switcher.value);
  });

  root.querySelector("[data-dl-add-option]")?.addEventListener("click", () => {
    const options = readOptionsFromDom();
    options.push(emptyOption());
    const selected = els.chosen.value;
    els.optionList.innerHTML = options.map((option, index) => optionMarkup(option, index, options.length)).join("");
    syncChosenSelect({ options, chosenOptionId: selected });
    const lastName = els.optionList.querySelector(".dl-option:last-child [name='option-name']");
    lastName?.focus();
    scheduleSave();
  });

  els.optionList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-dl-remove-option]");
    if (!button || button.disabled) return;
    const row = button.closest(".dl-option");
    const options = readOptionsFromDom().filter((option) => option.id !== row?.getAttribute("data-option-id"));
    if (options.length < 2) return;
    const selected = els.chosen.value === row?.getAttribute("data-option-id") ? "" : els.chosen.value;
    els.optionList.innerHTML = options.map((option, index) => optionMarkup(option, index, options.length)).join("");
    syncChosenSelect({ options, chosenOptionId: selected });
    scheduleSave();
  });

  els.editor.addEventListener("submit", (event) => {
    event.preventDefault();
    saveFromForm(false);
  });

  els.editor.addEventListener("input", (event) => {
    if (event.target?.name === "option-name") {
      const selected = els.chosen.value;
      syncChosenSelect({ options: readOptionsFromDom(), chosenOptionId: selected });
    }
    scheduleSave();
  });

  els.editor.addEventListener("change", scheduleSave);

  window.addEventListener("beforeprint", () => {
    if (state.activeId && !els.editor.hidden) saveFromForm(true);
  });

  window.addEventListener("hashchange", () => {
    applyHash();
  });

  loadStore();
  const fromHash = applyHash();
  if (!fromHash) {
    if (state.activeId && state.decisions.some((item) => item.id === state.activeId)) {
      openDecision(state.activeId, { silent: true });
    } else {
      state.activeId = null;
      renderList();
      renderWorkspace();
    }
  }
})();
