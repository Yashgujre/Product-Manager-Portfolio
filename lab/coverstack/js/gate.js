/**
 * CoverStack Lab — hard HITL gate (deterministic).
 * Blocks illegal stacks: PAP $ > 0 when pap rail red; Medicaid/Medicare traps;
 * foundation $ when foundation red; overspend vs OOP gap (soft warn if sum < gap).
 */

/**
 * @param {object} opts
 * @param {{ planUsd: number, papUsd: number, foundationUsd: number, order: string[] }} opts.split
 * @param {Array<{ railId: string, status: string, blockers?: string[] }>} opts.rails
 * @param {object} opts.member
 * @param {number} opts.oopGapUsd
 * @returns {{ pass: boolean, reasons: string[], result: 'pass'|'block' }}
 */
export function runGate({ split, rails, member, oopGapUsd }) {
  const reasons = [];
  const byId = Object.fromEntries(rails.map((r) => [r.railId, r]));
  const plan = Number(split.planUsd) || 0;
  const pap = Number(split.papUsd) || 0;
  const foundation = Number(split.foundationUsd) || 0;
  const sum = plan + pap + foundation;

  const papRail = byId.pap;
  const foundationRail = byId.foundation;
  const planRail = byId.plan;

  if (pap > 0 && papRail?.status === "red") {
    reasons.push("wrong_rail:pap_red");
  }
  if (foundation > 0 && foundationRail?.status === "red") {
    reasons.push("wrong_rail:foundation_red");
  }
  if (plan > 0 && planRail?.status === "red") {
    reasons.push("wrong_rail:plan_red");
  }

  const planType = member?.planType || "";
  const gov = planType === "medicaid" || planType === "medicare_advantage" || planType === "medicare";
  if (pap > 0 && gov) {
    if (planType === "medicaid") {
      reasons.push("illegal_stack:pap_under_medicaid");
    } else {
      reasons.push("illegal_stack:pap_under_medicare");
    }
  }
  if (pap > 0 && papRail?.blockers?.includes("gov_insurance_blocks_copay_card")) {
    if (!reasons.some((r) => r.startsWith("illegal_stack:"))) {
      reasons.push("illegal_stack:gov_insurance_blocks_copay_card");
    }
  }

  if (foundation > 0 && foundationRail?.blockers?.includes("fund_closed")) {
    reasons.push("wrong_rail:foundation_fund_closed");
  }

  // Soft: sum may exceed OOP slightly for residual stacking demos, but huge overspend blocks
  if (sum > oopGapUsd * 1.25 + 50) {
    reasons.push("incomplete_oop:overspend");
  }

  // Deduplicate
  const unique = [...new Set(reasons)];
  const pass = unique.length === 0;
  return {
    pass,
    reasons: unique,
    result: pass ? "pass" : "block",
    sumUsd: sum,
    envelopeUsd: oopGapUsd,
  };
}

export function reasonLabel(code) {
  const map = {
    "wrong_rail:pap_red": "PAP amount > $0 while PAP rail is red",
    "wrong_rail:foundation_red": "Foundation amount > $0 while foundation rail is red",
    "wrong_rail:plan_red": "Plan amount > $0 while plan rail is red",
    "illegal_stack:pap_under_medicaid": "Illegal stack: PAP under Medicaid (demo trap)",
    "illegal_stack:pap_under_medicare": "Illegal stack: PAP under Medicare (demo trap)",
    "illegal_stack:gov_insurance_blocks_copay_card": "Gov insurance blocks copay-card-style PAP",
    "wrong_rail:foundation_fund_closed": "Foundation fund closed / waitlist — amount must be $0",
    "incomplete_oop:overspend": "Split substantially exceeds OOP envelope",
  };
  return map[code] || code;
}
