# CoverStack Lab v0

**Stack legal rails under this insurance type** — a static Lab demo of care-coordination judgment: plan benefits + manufacturer PAP + foundation grants, with deterministic Policy A/B splits, optional AI draft rationale, and a hard HITL gate.

Synthetic data only. Obviously fake names. **Not PHI. Not a coverage determination.**

## What this is

CoverStack is a product-shaped Lab sample (not a live eligibility engine). Coordinators open a member need, see three rails with status chips and blockers, compare **Policy A (plan-first)** vs **Policy B (PAP-first)**, edit an AI/template draft, and approve through a gate that blocks illegal stacks (e.g. PAP dollars under Medicaid/Medicare patterns).

Hire themes on display: regulated judgment, AI-with-HITL, measurement (experiment readout), constraint-visible refusal.

## Open locally

No build step. Prefer a tiny static server so `fetch('fixtures/demo-seed.json')` works:

```bash
cd /workspace/coverstack   # or this repo root
npx --yes serve -p 4173 .
# → http://localhost:4173
```

Or Python:

```bash
python3 -m http.server 4173
```

Opening `index.html` via `file://` may fail the seed fetch in some browsers; use `serve` if that happens.


## GitHub Pages

Hosted static under this portfolio at `lab/coverstack/` (seed-only). There is no `/feed` Node server on Pages; the app loads [`fixtures/demo-seed.json`](fixtures/demo-seed.json). Live feed probing only runs on localhost.

## Live data feed

Replace bundled-only boot with the Lab HTTP feed (still **synthetic** — same fake names; not PHI):

```bash
node scripts/serve-live.mjs
# → http://127.0.0.1:4173/
# → GET /feed/v1/snapshot  (fixtures/live-feed.json, Cache-Control: no-store)
# → GET /feed/v1/health    → { ok: true, source: "live-feed" }
```

Header indicator: **Data source: live feed** | **seed** | **seed-fallback**.

Override the feed URL with `window.COVERSTACK_FEED_URL` or `?feed=…`. On failure the app falls back to [`fixtures/demo-seed.json`](fixtures/demo-seed.json) (never deleted). Policy A/B splits are computed from the current feed’s rail statuses/amounts; HITL gate + AI kill switch stay intact.

Details: [docs/08-live-data-feed.md](docs/08-live-data-feed.md).

## Seed pack

| Item | Value |
|------|--------|
| Seed version | `coverstack-demo-seed-v1` |
| Canonical file | [`fixtures/demo-seed.json`](fixtures/demo-seed.json) |
| localStorage key | `coverstack.demo.seed.v1` |
| Loader | [`scripts/seed-demo.mjs`](scripts/seed-demo.mjs) |

On first Lab boot the app fetches the seed JSON and writes it to localStorage (if empty). If the key is already present, that copy is reused for reproducibility. Use **Reset seed** in the header to clear and reload from fixtures.

Pre-seeded history includes six decisions across five members (override, gate block on Luna, AI circuit-breaker fallback on Mira follow-up). Metrics are **non-zero on first paint**.

## Sample members (synthetic)

| Name | Plan | Demo trap / path |
|------|------|------------------|
| Mira Sampleton | Employer PPO | Legal stack; override example |
| Theo Demohope | Marketplace | Foundation fund closed |
| Luna Ficticia | Medicaid | PAP illegal → gate block |
| Axel Placeholder | Medicare Advantage | PAP excluded |
| Nora Prototyke | Employer HMO | Happy-path approve |

## Kill switch

`AI_DRAFTS_ENABLED` (header toggle, default **on**). When on, rationale is a **simulated** AI draft from seed/template patterns — **no live LLM API**. When off, template-only rationale from the resolver.

## Layout

```
coverstack/
  index.html          # Lab entry
  css/app.css
  js/                 # app, store, gate, policy, metrics, data-feed
  fixtures/           # demo-seed, live-feed, members, metrics-snapshot
  scripts/seed-demo.mjs
  scripts/serve-live.mjs
  docs/               # PM lineage (PRD, architecture, research, …)
  README.md
  .gitignore
```

## Docs

Start with:

- [docs/06-prd.md](docs/06-prd.md) — Lab PRD
- [docs/03-system-architecture.md](docs/03-system-architecture.md) — components & models
- [docs/07-decision-log.md](docs/07-decision-log.md) — product decisions

## Disclaimer

Demo rules are extracted summaries of **public** page patterns (SBC / RxAssist / NeedyMeds / HealthWell / PAN / TotalAssist style). Nothing here is a coverage determination, fund partnership, or PHI-capable system.
