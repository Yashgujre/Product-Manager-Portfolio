/**
 * CoverStack Lab — deterministic Policy A vs B splits + rail rules for new cases.
 * When feed rails carry statuses/amounts, splits are computed from those values
 * (not ignored). Policy toggle still changes order and dollar bias.
 */

/** Plan-type → default rail statuses for a NEW open case (matches seed patterns). */
export function resolveRailsForMember(member, caseId) {
  const planType = member.planType;
  const base = {
    plan: {
      railId: "plan",
      caseId,
      status: "green",
      eligibilitySummary: "Plan specialty tier / coinsurance leaves residual OOP (demo SBC pattern).",
      blockers: [],
      sourceRefs: [
        "https://www.uhc.com/understanding-health-insurance/how-does-health-insurance-work/summary-of-benefits-and-coverage",
      ],
      estimatedContributionUsd: 0,
      editable: true,
    },
    pap: {
      railId: "pap",
      caseId,
      status: "green",
      eligibilitySummary: "Manufacturer PAP directory pattern (RxAssist / NeedyMeds).",
      blockers: [],
      sourceRefs: ["https://www.rxassist.org/", "https://www.needymeds.org/"],
      estimatedContributionUsd: 0,
      editable: true,
    },
    foundation: {
      railId: "foundation",
      caseId,
      status: "green",
      eligibilitySummary: "Disease fund may assist residual if open (HealthWell / TotalAssist / PAN pattern).",
      blockers: [],
      sourceRefs: [
        "https://www.healthwellfoundation.org/patients/",
        "https://totalassist.org/how-totalassist-helps-you/",
      ],
      estimatedContributionUsd: 0,
      editable: true,
    },
  };

  if (planType === "medicaid") {
    base.plan.status = "yellow";
    base.plan.eligibilitySummary = "Medicaid covers drug with prior-auth / specialty delay (demo).";
    base.plan.blockers = ["prior_auth_delay"];
    base.pap.status = "red";
    base.pap.eligibilitySummary = "Manufacturer PAP often ineligible while Medicaid active (demo trap).";
    base.pap.blockers = ["gov_insurance_blocks_copay_card"];
    base.pap.estimatedContributionUsd = 0;
    base.foundation.status = "green";
    base.foundation.eligibilitySummary =
      "TotalAssist/PAN-style funds may accept Medicaid when fund open (demo).";
  } else if (planType === "medicare_advantage" || planType === "medicare") {
    base.plan.status = "yellow";
    base.plan.eligibilitySummary = "MA + Part D coinsurance / coverage stages leave high OOP (EOB pattern).";
    base.plan.blockers = ["part_d_stage_oop"];
    base.pap.status = "red";
    base.pap.eligibilitySummary = "Many oncology/specialty PAPs exclude Medicare or push to foundation (demo).";
    base.pap.blockers = ["gov_insurance_blocks_copay_card"];
    base.pap.estimatedContributionUsd = 0;
    base.foundation.status = "green";
    base.foundation.eligibilitySummary =
      "Foundation residual path for insured Medicare under income cap (demo).";
  } else if (planType === "marketplace") {
    base.plan.status = "yellow";
    base.plan.blockers = ["high_deductible"];
    base.plan.eligibilitySummary = "Marketplace silver: deductible/specialty tier creates OOP (SBC pattern).";
    base.pap.status = "yellow";
    base.pap.blockers = ["insured_pap_strict"];
    base.pap.eligibilitySummary = "Insured commercial PAP rules stricter (demo).";
    base.foundation.status = "red";
    base.foundation.blockers = ["fund_closed"];
    base.foundation.eligibilitySummary = "Disease fund closed / waitlist (demo).";
    base.foundation.estimatedContributionUsd = 0;
  } else if (planType === "employer_ppo") {
    base.foundation.status = "yellow";
    base.foundation.blockers = ["fund_capacity_limited"];
    base.foundation.eligibilitySummary =
      "Breast-cancer / oncology fund may assist residual if open; fund status demo=yellow.";
  }

  return [base.plan, base.pap, base.foundation];
}

/**
 * Clone feed rails onto a new caseId, preserving status / blockers / amounts.
 */
export function cloneRailsForCase(feedRails, caseId) {
  return (feedRails || []).map((r) => ({
    ...r,
    caseId,
    blockers: [...(r.blockers || [])],
    sourceRefs: [...(r.sourceRefs || [])],
  }));
}

function railWeight(status) {
  if (!status || status === "red") return 0;
  if (status === "yellow") return 0.7;
  return 1;
}

function policyOrder(byId, policyVariant) {
  const can = (id) => byId[id] && byId[id].status !== "red";
  if (policyVariant === "B") {
    if (can("pap")) return ["pap", "plan", "foundation"];
    if (can("foundation")) return ["foundation", "plan", "pap"];
    return ["plan", "foundation", "pap"];
  }
  // A plan-first
  if (can("pap")) return ["plan", "pap", "foundation"];
  return ["plan", "foundation", "pap"];
}

/**
 * Deterministic proposed split from rails + OOP + policy variant.
 * Policy A: plan-first order + plan bias. Policy B: PAP-first (or foundation-first if PAP red).
 * Feed estimatedContributionUsd and statuses are inputs — never ignored when present.
 */
export function proposeSplit({ rails, oopGapUsd, policyVariant }) {
  const byId = Object.fromEntries(rails.map((r) => [r.railId, r]));
  const gap = Number(oopGapUsd) || 0;
  const order = policyOrder(byId, policyVariant);

  const can = (id) => byId[id] && byId[id].status !== "red";

  const feedAmt = (id) => {
    if (!can(id)) return 0;
    const n = Number(byId[id]?.estimatedContributionUsd);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const feedPlan = feedAmt("plan");
  const feedPap = feedAmt("pap");
  const feedFound = feedAmt("foundation");
  const feedSum = feedPlan + feedPap + feedFound;
  const hasFeedAmounts = feedSum > 0;

  let planUsd = 0;
  let papUsd = 0;
  let foundationUsd = 0;

  if (hasFeedAmounts) {
    // Start from feed amounts (red already zeroed), then re-bias toward policy primary.
    planUsd = feedPlan;
    papUsd = feedPap;
    foundationUsd = feedFound;

    const biasPrimary = policyVariant === "B" ? (can("pap") ? "pap" : can("foundation") ? "foundation" : "plan") : "plan";
    const secondary = biasPrimary === "pap" ? "plan" : biasPrimary === "foundation" ? "plan" : can("pap") ? "pap" : "foundation";

    // Shift ~15% of secondary toward primary when both eligible (shows A vs B dollar difference).
    const bucket = { plan: planUsd, pap: papUsd, foundation: foundationUsd };
    const shift = Math.round((bucket[secondary] || 0) * 0.15);
    if (shift > 0 && can(biasPrimary) && can(secondary)) {
      bucket[secondary] -= shift;
      bucket[biasPrimary] += shift;
    }
    planUsd = bucket.plan;
    papUsd = bucket.pap;
    foundationUsd = bucket.foundation;

    // If feed sum undershoots gap, top up primary; if overshoots, scale down eligible rails.
    const sum = planUsd + papUsd + foundationUsd;
    if (gap > 0 && sum < gap) {
      const top = gap - sum;
      if (can(biasPrimary)) {
        if (biasPrimary === "plan") planUsd += top;
        else if (biasPrimary === "pap") papUsd += top;
        else foundationUsd += top;
      } else if (can("plan")) planUsd += top;
      else if (can("foundation")) foundationUsd += top;
    } else if (gap > 0 && sum > gap * 1.25 + 50) {
      const scale = gap / sum;
      planUsd = Math.round(planUsd * scale);
      papUsd = Math.round(papUsd * scale);
      foundationUsd = Math.max(0, gap - planUsd - papUsd);
    }
  } else {
    // No feed amounts — weight by status and policy bias.
    let wPlan = railWeight(byId.plan?.status);
    let wPap = railWeight(byId.pap?.status);
    let wFound = railWeight(byId.foundation?.status);

    if (policyVariant === "B" && wPap > 0) {
      wPap *= 1.4;
      wPlan *= 0.9;
    } else if (wPlan > 0) {
      wPlan *= 1.4;
      wPap *= 0.9;
    }

    const wSum = wPlan + wPap + wFound || 1;
    planUsd = Math.round((gap * wPlan) / wSum);
    papUsd = Math.round((gap * wPap) / wSum);
    foundationUsd = Math.max(0, gap - planUsd - papUsd);

    if (wFound === 0) {
      const leftover = foundationUsd;
      foundationUsd = 0;
      if (wPlan > 0) planUsd += leftover;
      else if (wPap > 0) papUsd += leftover;
    }
  }

  // Force red rails to 0 (hard)
  if (!can("plan")) planUsd = 0;
  if (!can("pap")) papUsd = 0;
  if (!can("foundation")) foundationUsd = 0;

  const sum = planUsd + papUsd + foundationUsd;
  if (sum === 0 && gap > 0) {
    if (can("plan")) planUsd = gap;
    else if (can("foundation")) foundationUsd = gap;
    else if (can("pap")) papUsd = gap;
  }

  return {
    planUsd,
    papUsd,
    foundationUsd,
    order,
  };
}

/**
 * Illegal AI draft for demo traps (Luna/Axel) — puts PAP $ so gate can fire.
 * Only used when simulating a "bad" AI draft for gov insurance to show failure modes.
 */
export function proposeIllegalAiSplit({ rails, oopGapUsd, member }) {
  const legal = proposeSplit({ rails, oopGapUsd, policyVariant: "A" });
  const gov =
    member.planType === "medicaid" ||
    member.planType === "medicare_advantage" ||
    member.planType === "medicare";
  if (gov) {
    return {
      ...legal,
      papUsd: Math.max(400, Math.round(oopGapUsd * 0.18)),
      planUsd: Math.max(0, legal.planUsd - 200),
      order: ["plan", "pap", "foundation"],
    };
  }
  return legal;
}

export function templateRationale({ member, rails, split, policyVariant, oopGapUsd = 0 }) {
  const statuses = rails.map((r) => `${r.railId}=${r.status}`).join(" ");
  const order = (split.order || []).join(" → ");
  return `TEMPLATE (resolver): Policy ${policyVariant} · order ${order}. Rails ${statuses}. Allocate plan $${split.planUsd}, PAP $${split.papUsd}, foundation $${split.foundationUsd} against ${member.displayName}'s $${oopGapUsd} OOP gap. Edit required — not a coverage determination.`;
}

export function aiSimulatedRationale({ member, rails, split, policyVariant, failureModes }) {
  const pap = rails.find((r) => r.railId === "pap");
  const fm =
    failureModes?.length > 0
      ? ` FAILURE MODE ${failureModes.join(",")} expected.`
      : "";
  if (policyVariant === "B") {
    return `AI DRAFT (demo): Policy B PAP-first for ${member.displayName}; order ${(split.order || []).join(" → ")}. PAP $${split.papUsd}, plan $${split.planUsd}, foundation $${split.foundationUsd}.${pap?.status === "red" ? " Note: PAP rail red — do not allocate." : ""} Edit required.${fm}`;
  }
  return `AI DRAFT (demo): Policy A plan-first for ${member.displayName}; order ${(split.order || []).join(" → ")}. Plan $${split.planUsd}, PAP $${split.papUsd}, foundation $${split.foundationUsd}.${fm} Edit required.`;
}
