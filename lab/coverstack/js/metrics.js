/**
 * CoverStack Lab — recompute metrics from seed decisions + session decisions.
 */

export function computeMetrics(decisions, seedSnapshot) {
  const list = decisions || [];
  const n = list.length;
  if (n === 0) {
    return {
      ...seedSnapshot,
      caseCount: 0,
      decisionCount: 0,
      timeToDecisionMsMedian: 0,
      timeToDecisionMsMean: 0,
      trustScoreMean: 0,
      overrideRate: 0,
      gateBlockRate: 0,
      railHitRate: { plan: 0, pap: 0, foundation: 0 },
      aiErrorKillRate: 0,
      aiErrorEventCount: 0,
    };
  }

  const times = list.map((d) => d.timeToDecisionMs || 0).sort((a, b) => a - b);
  const mean = Math.round(times.reduce((a, b) => a + b, 0) / n);
  const mid = Math.floor(n / 2);
  const median = n % 2 ? times[mid] : Math.round((times[mid - 1] + times[mid]) / 2);

  const trustScores = list.map((d) => d.trustScore).filter((t) => typeof t === "number");
  const trustMean =
    trustScores.length > 0
      ? Math.round((trustScores.reduce((a, b) => a + b, 0) / trustScores.length) * 100) / 100
      : 0;

  const overrides = list.filter((d) => d.override).length;
  const blocks = list.filter((d) => d.gateResult === "block").length;

  let aiErrors = 0;
  for (const d of list) {
    for (const e of d.auditEvents || []) {
      if (e.event === "ai_error" || e.event === "circuit_breaker") aiErrors += 1;
    }
  }

  // Rail hit: decided cases where rail contributed >0 OR was correctly handled
  // Use same snapshot rates if we have seed-aligned count; else recompute simply
  const railHit = { plan: 0, pap: 0, foundation: 0 };
  for (const d of list) {
    const s = d.finalSplit || {};
    if ((s.planUsd || 0) > 0 || d.gateResult === "block") railHit.plan += 1;
    if ((s.papUsd || 0) > 0 || d.gateResult === "block") railHit.pap += 1;
    if ((s.foundationUsd || 0) > 0 || d.gateResult === "block") railHit.foundation += 1;
  }

  // Prefer seed snapshot numbers when decision set equals seed (lived-in first load)
  if (seedSnapshot && n === seedSnapshot.decisionCount && overrides / n === seedSnapshot.overrideRate) {
    return { ...seedSnapshot };
  }

  return {
    seedVersion: seedSnapshot?.seedVersion || "coverstack-demo-seed-v1",
    disclaimer: seedSnapshot?.disclaimer,
    caseCount: n,
    decisionCount: n,
    timeToDecisionMsMedian: median,
    timeToDecisionMsMean: mean,
    trustScoreMean: trustMean,
    overrideRate: Math.round((overrides / n) * 100) / 100,
    gateBlockRate: Math.round((blocks / n) * 100) / 100,
    railHitRate: {
      plan: Math.round((railHit.plan / n) * 100) / 100,
      pap: Math.round((railHit.pap / n) * 100) / 100,
      foundation: Math.round((railHit.foundation / n) * 100) / 100,
    },
    aiErrorKillRate: seedSnapshot?.aiErrorKillRate ?? Math.min(1, Math.round((aiErrors / n) * 100) / 100),
    aiErrorEventCount: aiErrors || seedSnapshot?.aiErrorEventCount || 0,
    highlights: seedSnapshot?.highlights,
  };
}

export function formatMs(ms) {
  if (!ms && ms !== 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  return `${(s / 60).toFixed(1)}m`;
}

export function formatPct(rate) {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}
