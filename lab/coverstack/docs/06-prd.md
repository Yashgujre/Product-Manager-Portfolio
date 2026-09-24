# PRD — CoverStack v0 (Lab demo)

## What buildable behavior must CoverStack demonstrate for the Lab hero?

Lineage: [Write PRDs] · [User stories] · [FR] · [NFR] · [Acceptance criteria] · [API contracts] · Written: 2026-09-24 PT  
Owner: Christina · Approver: Hououin Kyouma (Yash Gujre) · Version: 0.1-lab

### 1. Problem

Care coordinators must close member OOP gaps by stacking **health-plan benefits**, **manufacturer PAP**, and **foundation grants** — rails with conflicting eligibility rules (insurance class, FPL, drug lists, fund open/closed). Tools today are siloed directories and portals. Separately, the Product-Manager-Portfolio Lab needs a **theme-first** hero sample (judgment, measurement, AI HITL, regulated constraints) that wows in ~60 seconds without cloning résumé processes or leading with FraudFence ML.

### 2. Goals

1. Demonstrate the core loop on five synthetic members with mocked rails.
2. Make Policy A vs B + editable AI draft + hard gate unmistakably clear on first open.
3. Prove H1 trust surface: illegal stacks blocked; legal stacks approvable with audit export.
4. Load-bear hire themes without stickers or process cosplay.

### 3. Non-goals (v0)

1. Live PAP/foundation/plan integrations or submissions.
2. Real PHI, EHR, claims adjudication, prior auth.
3. Patient self-serve product.
4. Multi-tenant SaaS, billing, SSO.
5. Autopilot approval.
6. Building Field Notes.
7. Recreating Centene referral workflows.
8. Replacing FraudFence code deletion — demote in narrative/IA only unless asked.

### 4. Users & fixtures

**User:** Care coordinator (primary).  
**Audience:** Hiring manager evaluating Lab.  
**Fixtures:** Mira Sampleton, Theo Demohope, Luna Ficticia, Axel Placeholder, Nora Prototyke — **obviously fake**; labeled as demo data in UI.

### 5. Hypothesis & success metrics

**Riskiest hypothesis (H1):** Constraint-visible HITL + hard gate drives correct refusal of illegal AI drafts (≥80% block rate) with ≤60s time-to-understand three rails + approve step on cold skim.

| Metric | Type | Target (v0 Lab) | Lever |
|---|---|---|---|
| Time to name 3 rails + HITL | Guardrail / skim | ≤60s | First-open samples, IA, copy |
| Illegal draft block rate | Primary (H1) | ≥80% | Constraint panel, gate rules |
| Lift vs hidden-constraint variant | Primary | ≥50 pp | Same |
| Approve→export completion on Nora | Funnel | ≥90% of guided tasks | Draft quality, edit UX |
| Résumé-clone mentions in feedback | Qualitative guardrail | ~0 dominant | Theme-first framing |
| Implied “live API/PHI” claims | Compliance guardrail | 0 | Mock labels, copy review |

### 6. User stories

1. As a **care coordinator**, I want to open a member need and see plan / PAP / foundation rails with constraints, so that I know what is even possible before allocating money.
2. As a **care coordinator**, I want Policy A vs Policy B side by side with rationales, so that I can exercise judgment instead of accepting a single opaque recommendation.
3. As a **care coordinator**, I want an AI-drafted split I can edit, so that drafting is fast but authority stays human.
4. As a **care coordinator**, I want a hard budget/compliance gate that blocks illegal or over-budget stacks, so that I cannot accidentally “approve” a violated rail.
5. As a **care coordinator**, I want an audit export of draft → edits → approve → gate results, so that the decision is reviewable.
6. As a **hiring manager**, I want samples on first open, so that I see senior PM judgment in ≤60 seconds without a login pilgrimage.

### 7. Functional requirements

| ID | Requirement |
|---|---|
| FR-1 | System lists five synthetic members with fake labels and therapy/coverage/FPL summary. |
| FR-2 | Selecting a member shows three rails: `plan`, `pap`, `foundation`, each with status ∈ {eligible, blocked, waitlist_closed, residual_ok, unknown_mock}. |
| FR-3 | Each rail shows human-readable constraint reasons (e.g. “PAP typically excluded when Medicaid active”, “Foundation fund waitlist”). |
| FR-4 | System presents Policy A and Policy B allocations for the same member (required for Nora; available for Mira). |
| FR-5 | System generates an AI draft split + rationale bullets (mocked LLM OK) referencing visible constraints. |
| FR-6 | User can edit draft line items (amounts per rail) and rationale notes before approve. |
| FR-7 | Approve action runs hard gate: (a) Σ(rail amounts) ≤ member OOP envelope; (b) no amount on a `blocked` rail; (c) foundation amount allowed only if status permits; (d) policy id recorded. |
| FR-8 | Failed gate blocks export and surfaces which rule failed. |
| FR-9 | Passed gate enables audit export (JSON and/or PDF) including member id (fake), policy, draft, edits, actor, timestamps, gate results. |
| FR-10 | UI labels all rail data as **mocked** and members as **synthetic demo fixtures**. |
| FR-11 | Lab entry shows CoverStack samples without requiring auth in v0. |
| FR-12 | Measurement card displays H1 statement + thresholds (read-only). |

### 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | No real PHI; synthetic only. |
| NFR-2 | No production claims of HIPAA certification, fund partnerships, or live submissions. |
| NFR-3 | Gate evaluation is deterministic and unit-testable from fixture rules. |
| NFR-4 | Core loop usable on desktop browser; mobile optional. |
| NFR-5 | AI draft failure falls back to empty editable skeleton — never silent invent of eligibility. |
| NFR-6 | Audit export immutable for the demo session (no silent rewrite after approve). |
| NFR-7 | Performance: member switch + draft render < 2s on mocked data. |

### 9. Acceptance criteria (selected)

1. **Given** Luna Ficticia (Medicaid), **when** AI draft puts amount on PAP, **then** gate fails with PAP/Medicaid constraint reason and export disabled.
2. **Given** Axel Placeholder (Medicare), **when** draft puts amount on PAP, **then** gate fails with Medicare PAP exclusion reason.
3. **Given** Theo Demohope with foundation `waitlist_closed`, **when** draft puts amount on foundation, **then** gate fails or forces zero with waitlist reason.
4. **Given** Nora Prototyke, **when** user compares Policy A vs B and approves a legal edited stack within OOP envelope, **then** export contains policy id, before/after line items, and gate=pass.
5. **Given** Mira Sampleton, **when** stack follows plan→PAP→foundation residual with legal amounts, **then** gate passes.
6. **Given** cold Lab open, **when** samples load, **then** CoverStack fixtures are visible without login and each member is marked synthetic/fake.
7. **Given** AI service error, **when** draft requested, **then** UI shows editable empty allocation and does not fabricate rail eligibility.

### 10. API contracts (mocked OK)

Base: `/api/mock/v0` · All responses include `"demo": true`, `"synthetic": true`.

**GET `/members`**  
→ `{ members: [{ id, name, age, condition, therapyClass, coverage, fplPct, oopEnvelopeUsd }] }`

**GET `/members/{id}/rails`**  
→ `{ rails: [{ id: "plan"|"pap"|"foundation", status, constraints: [string], maxAllocUsd }] }`

**GET `/members/{id}/policies`**  
→ `{ policies: [{ id: "A"|"B", label, lineItems: [{railId, amountUsd}], rationale: [string] }] }`

**POST `/members/{id}/draft`**  
Body: `{ policyId?, hint? }`  
→ `{ draftId, lineItems, rationale[], model: "mock-woz" }`

**POST `/members/{id}/gate`**  
Body: `{ draftId, lineItems, policyId }`  
→ `{ pass: boolean, violations: [{ code, message, railId? }], envelopeUsd, sumUsd }`

**POST `/members/{id}/approve`**  
Body: `{ draftId, lineItems, policyId, actor }`  
→ `{ exportId }` or `409` with gate violations

**GET `/exports/{exportId}`**  
→ audit document JSON (and optional `downloadUrl` for PDF mock)

Fixture rule pack (normative for v0):
- Luna: `pap.status=blocked` reason Medicaid-active
- Axel: `pap.status=blocked` reason Medicare-exclusion-pattern
- Theo: `foundation.status=waitlist_closed`
- Mira/Nora: all three `eligible` or residual_ok with envelope math

### 11. Workflow (happy / failure)

**Happy:** Open Nora → rails green → pick Policy B → AI draft → edit → gate pass → export.  
**Failure:** Open Luna → AI draft includes PAP → gate fail → user zeros PAP → gate pass → export.

### 12. Rollout & rollback (Lab)

- Ship behind Lab CoverStack route; FraudFence linked as backup only.
- Rollback = revert IA default to previous hero only with Hououin Kyouma approval and decision-log entry.
- Kill switch for AI draft: force manual skeleton mode (NFR-5).

### 13. Open questions

1. Exact Policy A vs B philosophy copy (Faris optional).
2. Whether PDF export is required vs JSON-only for v0 skim.
3. How loudly to show H1 measurement card without cluttering 60s skim.

---

## CONFLICT WITH MENTAL MODEL

1. **PRD duty assumes delivery team readiness for production controls.** This PRD is explicitly **v0 Lab / mocked** — still specifies testable behavior so senior judgment is visible, without pretending multi-tenant SaaS.
2. **Experience care-coordination grounding vs résumé-clone ban.** Stories use coordinator JTBD and public rail constraints; they do not encode employer-specific SOPs.
3. **Static portfolio demo vs Drive Execution production language.** Acceptance criteria still executable; integrations deferred.
4. **Caller: do not push GitHub; do not modify `pm-mental-model.md`.**
