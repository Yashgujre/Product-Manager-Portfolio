# Live data feed (Lab)

CoverStack Lab can boot from an HTTP data feed instead of the bundled seed alone. The feed is **synthetic only** — same obviously fake member names as [`fixtures/demo-seed.json`](../fixtures/demo-seed.json). **Not PHI. Not EHR. Not claims. Not Epic.**

The disclaimer banner stays on every page. `AI_DRAFTS_ENABLED` kill-switch behavior is unchanged.

## Schema

`GET /feed/v1/snapshot` returns a JSON pack with the same core arrays as the demo seed:

| Field | Required | Notes |
|-------|----------|--------|
| `members[]` | yes | Synthetic member fixtures (`memberId`, `displayName`, `planType`, …) |
| `cases[]` | yes | Case envelopes (`caseId`, `memberId`, `oopGapUsd`, `policyVariant`, …) |
| `rails[]` | yes | Per-case `plan` / `pap` / `foundation` with `status`, `blockers`, `estimatedContributionUsd` |
| `recommendations[]` | optional | Seeded HITL drafts |
| `decisions[]` | optional | Seeded audit / gate history |
| `metricsSnapshot` | optional | Experiment readout |
| `feedVersion` / `feedId` / `generatedAt` / `source` | optional | Live metadata (`source: "live-feed"`) |
| `disclaimer` | recommended | Same Lab disclaimer string |

Canonical live pack: [`fixtures/live-feed.json`](../fixtures/live-feed.json) (derived from demo-seed; demo-seed is never deleted and remains the fallback).

## How to run

```bash
cd /path/to/coverstack-lab   # this repo
node scripts/serve-live.mjs
# → http://127.0.0.1:4173/
# → http://127.0.0.1:4173/feed/v1/snapshot
# → http://127.0.0.1:4173/feed/v1/health
```

`PORT` / `HOST` env vars override defaults (`4173` / `127.0.0.1`).

Open the Lab UI at the server root. Header shows **Data source: live feed** when the snapshot loaded. Policy A (plan-first) vs B (PAP-first) recomputes from **current feed rail statuses and amounts**.

### Curl checks

```bash
curl -sS http://127.0.0.1:4173/feed/v1/health
curl -sS http://127.0.0.1:4173/feed/v1/snapshot | head -c 200
```

Health response: `{ "ok": true, "source": "live-feed" }`. Snapshot uses `Content-Type: application/json` and `Cache-Control: no-store`.

## Pointing FEED_URL

Resolution order in [`js/data-feed.js`](../js/data-feed.js) `loadDataFeed()`:

1. Explicit `loadDataFeed({ feedUrl })` argument (tests / embeds)
2. `window.COVERSTACK_FEED_URL` (set before the module boots)
3. Query `?feed=` (absolute or relative URL to a JSON pack)
4. If `GET /feed/v1/health` is ok → `/feed/v1/snapshot`
5. Else `fixtures/demo-seed.json` → header **Data source: seed**

On fetch/normalize failure after an intended live URL: load seed and set **Data source: seed-fallback** with a reason (console + indicator title).

Examples:

```html
<script>window.COVERSTACK_FEED_URL = "/feed/v1/snapshot";</script>
```

```
http://127.0.0.1:4173/?feed=/fixtures/live-feed.json
http://127.0.0.1:4173/?feed=https://example.invalid/pack.json
```

## Policy A / B vs feed

`proposeSplit` in [`js/policy.js`](../js/policy.js) reads each rail’s `status` and `estimatedContributionUsd` from the current feed (or cloned feed rails for a new decision). Red rails stay `$0`. Toggle A/B changes order and dollar bias; it does not invent PAP dollars when the feed marks PAP red (Luna Medicaid / Axel Medicare patterns).

## Gate still applies

HITL edit → approve → [`js/gate.js`](../js/gate.js) still blocks illegal PAP stacks (e.g. PAP $ under Medicaid/Medicare or PAP red). Audit + metrics session overlay unchanged.

## PHI non-goal

This feed path is a **Lab integration seam**, not a clinical system:

- No real patient identifiers, EHR pulls, claims files, or payer APIs
- Fake names only (Mira Sampleton, Theo Demohope, Luna Ficticia, Axel Placeholder, Nora Prototyke)
- Public-pattern eligibility summaries only — **not a coverage determination**

Do not point `COVERSTACK_FEED_URL` at real PHI.
