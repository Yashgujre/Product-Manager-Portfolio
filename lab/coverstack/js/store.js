/**
 * CoverStack Lab — seed + session store (localStorage).
 * Key: coverstack.demo.seed.v1 — if empty, write seed; if present, use it.
 */

export const STORAGE_KEY = "coverstack.demo.seed.v1";
export const METRICS_KEY = "coverstack.demo.metrics.v1";
export const SESSION_KEY = "coverstack.demo.session.v1";
export const AI_FLAG_KEY = "coverstack.demo.aiDraftsEnabled.v1";

/** @typedef {import('./types.js').SeedPack} SeedPack */

/**
 * @returns {Promise<object>}
 */
export async function loadSeedPack() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (parsed?.seedVersion && parsed?.members) {
        globalThis.__COVERSTACK_DEMO_SEED__ = parsed;
        return parsed;
      }
    } catch {
      /* fall through to fetch */
    }
  }

  const res = await fetch("fixtures/demo-seed.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load demo-seed.json (${res.status})`);
  const seed = await res.json();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  localStorage.setItem(METRICS_KEY, JSON.stringify(seed.metricsSnapshot));
  globalThis.__COVERSTACK_DEMO_SEED__ = seed;
  return seed;
}

export function resetSeedToFixture() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(METRICS_KEY);
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Session overlay: new decisions / cases created in this browser.
 * @returns {{ decisions: object[], cases: object[], recommendations: object[], auditExtras: object[] }}
 */
export function getSession() {
  const empty = { decisions: [], cases: [], recommendations: [], auditExtras: [], rails: [] };
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { ...empty };
    return {
      ...empty,
      ...JSON.parse(raw),
    };
  } catch {
    return { ...empty };
  }
}

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function appendSessionDecision(decision, caseObj, recommendation) {
  const s = getSession();
  s.decisions.push(decision);
  if (caseObj) {
    const idx = s.cases.findIndex((c) => c.caseId === caseObj.caseId);
    if (idx >= 0) s.cases[idx] = caseObj;
    else s.cases.push(caseObj);
  }
  if (recommendation) s.recommendations.push(recommendation);
  saveSession(s);
  return s;
}

export function getAiDraftsEnabled() {
  const v = localStorage.getItem(AI_FLAG_KEY);
  if (v === null) return true;
  return v === "true";
}

export function setAiDraftsEnabled(on) {
  localStorage.setItem(AI_FLAG_KEY, String(!!on));
}

/**
 * Merge seed + session into a working store view.
 */
export function mergeStore(seed) {
  const session = getSession();
  const cases = [...seed.cases];
  for (const c of session.cases) {
    const i = cases.findIndex((x) => x.caseId === c.caseId);
    if (i >= 0) cases[i] = c;
    else cases.push(c);
  }
  return {
    ...seed,
    cases,
    decisions: [...seed.decisions, ...session.decisions],
    recommendations: [...seed.recommendations, ...session.recommendations],
    rails: seed.rails,
    session,
  };
}
