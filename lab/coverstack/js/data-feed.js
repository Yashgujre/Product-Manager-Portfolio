/**
 * CoverStack Lab — HTTP data-feed loader with seed fallback.
 * Feed content is synthetic only (same fake names as fixtures). Not PHI.
 */

const DEFAULT_SEED_URL = "fixtures/demo-seed.json";
const LIVE_SNAPSHOT = "/feed/v1/snapshot";
const LIVE_HEALTH = "/feed/v1/health";

/**
 * Resolve preferred feed URL from window / query / live-server probe.
 * @param {{ feedUrl?: string, fallbackSeedUrl?: string }} opts
 * @returns {Promise<{ url: string, intendedSource: 'live'|'seed' }>}
 */
export async function resolveFeedUrl({ feedUrl, fallbackSeedUrl } = {}) {
  const params =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const fromQuery = params?.get("feed") || null;
  const fromWindow =
    typeof window !== "undefined" && window.COVERSTACK_FEED_URL
      ? String(window.COVERSTACK_FEED_URL)
      : null;

  if (feedUrl) return { url: feedUrl, intendedSource: "live" };
  if (fromWindow) return { url: fromWindow, intendedSource: "live" };
  if (fromQuery) return { url: fromQuery, intendedSource: "live" };

  // Probe live server health only on local Node feed host.
  // Absolute /feed/* would 404 on GitHub Pages project paths — skip and use seed.
  const host =
    typeof window !== "undefined" && window.location ? window.location.hostname : "";
  const isLocalFeedHost =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (isLocalFeedHost) {
    try {
      const health = await fetch(LIVE_HEALTH, { cache: "no-store" });
      if (health.ok) {
        const body = await health.json().catch(() => null);
        if (body?.ok) {
          return { url: LIVE_SNAPSHOT, intendedSource: "live" };
        }
      }
    } catch {
      /* not on live server */
    }
  }

  return {
    url: fallbackSeedUrl || DEFAULT_SEED_URL,
    intendedSource: "seed",
  };
}

/**
 * Normalize a feed / seed JSON pack into app state shape.
 * @param {object} raw
 * @returns {object}
 */
export function normalizeFeedPack(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Feed pack is empty or not an object");
  }
  const members = Array.isArray(raw.members) ? raw.members : [];
  const cases = Array.isArray(raw.cases) ? raw.cases : [];
  const rails = Array.isArray(raw.rails) ? raw.rails : [];
  if (!members.length) throw new Error("Feed pack missing members[]");
  if (!cases.length) throw new Error("Feed pack missing cases[]");
  if (!rails.length) throw new Error("Feed pack missing rails[]");

  return {
    seedVersion: raw.seedVersion || raw.feedVersion || "coverstack-feed",
    feedVersion: raw.feedVersion || null,
    feedId: raw.feedId || null,
    generatedAt: raw.generatedAt || null,
    source: raw.source || null,
    disclaimer:
      raw.disclaimer ||
      "Synthetic Lab history only. Obviously fake names. Not PHI. Not a coverage determination.",
    storageKey: raw.storageKey || "coverstack.demo.seed.v1",
    members,
    cases,
    rails,
    recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
    decisions: Array.isArray(raw.decisions) ? raw.decisions : [],
    metricsSnapshot: raw.metricsSnapshot || {
      seedVersion: raw.seedVersion || raw.feedVersion || "coverstack-feed",
      disclaimer: raw.disclaimer,
      caseCount: cases.length,
      decisionCount: Array.isArray(raw.decisions) ? raw.decisions.length : 0,
      timeToDecisionMsMedian: 0,
      timeToDecisionMsMean: 0,
      trustScoreMean: 0,
      overrideRate: 0,
      gateBlockRate: 0,
      railHitRate: { plan: 0, pap: 0, foundation: 0 },
      aiErrorKillRate: 0,
      aiErrorEventCount: 0,
      highlights: {},
    },
  };
}

/**
 * Load live-shaped feed (or seed). On failure fall back to seed.
 *
 * @param {{ feedUrl?: string, fallbackSeedUrl?: string }} [opts]
 * @returns {Promise<{
 *   pack: object,
 *   dataSource: 'live'|'seed'|'seed-fallback',
 *   reason: string|null,
 *   feedUrl: string|null
 * }>}
 */
export async function loadDataFeed({ feedUrl, fallbackSeedUrl } = {}) {
  const seedUrl = fallbackSeedUrl || DEFAULT_SEED_URL;
  const { url, intendedSource } = await resolveFeedUrl({ feedUrl, fallbackSeedUrl: seedUrl });

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const raw = await res.json();
    const pack = normalizeFeedPack(raw);
    const isLiveEndpoint =
      intendedSource === "live" ||
      url === LIVE_SNAPSHOT ||
      /live-feed|\/feed\//.test(url) ||
      pack.source === "live-feed" ||
      Boolean(pack.feedVersion);
    return {
      pack,
      dataSource: isLiveEndpoint ? "live" : "seed",
      reason: null,
      feedUrl: url,
    };
  } catch (err) {
    const reason = err?.message || String(err);
    // Explicit live URL failed → seed-fallback. Pure seed miss also tries seed once more if different.
    if (url !== seedUrl) {
      try {
        const res = await fetch(seedUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching fallback ${seedUrl}`);
        const pack = normalizeFeedPack(await res.json());
        return {
          pack,
          dataSource: "seed-fallback",
          reason,
          feedUrl: url,
        };
      } catch (fallbackErr) {
        throw new Error(
          `Feed failed (${reason}); seed fallback also failed (${fallbackErr.message})`
        );
      }
    }
    throw err;
  }
}

/**
 * Latest rails for a member from the current feed/store (by most recent case).
 * Used so Policy A/B run against feed rail statuses/amounts.
 */
export function latestFeedRailsForMember(store, memberId) {
  if (!store?.cases?.length || !store?.rails?.length) return null;
  const memberCases = store.cases
    .filter((c) => c.memberId === memberId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  if (!memberCases.length) return null;
  const caseId = memberCases[0].caseId;
  const rails = store.rails.filter((r) => r.caseId === caseId);
  return rails.length ? rails : null;
}

/** Human label for header indicator. */
export function dataSourceLabel(dataSource) {
  if (dataSource === "live") return "live feed";
  if (dataSource === "seed-fallback") return "seed-fallback";
  return "seed";
}
