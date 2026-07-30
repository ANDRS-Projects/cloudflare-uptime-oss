import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

// Short edge cache for public GETs: the underlying data changes at most once a
// minute (cron interval), but the status page auto-refreshes client-side every
// 60s and can be viewed by many visitors at once — without this, every one of
// those hits re-runs the full D1 query set below. Must be >= the client's
// refresh interval (60s in src/html/status.ts) — a shorter TTL guarantees a
// cache miss on every single auto-refresh, defeating the cache for the exact
// traffic pattern it exists to absorb.
const CACHE_TTL_SECONDS = 65;

async function withEdgeCache(
  c: Context<{ Bindings: Env }>,
  build: () => Promise<Response>
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(c.req.url, { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const response = await build();
  response.headers.set('Cache-Control', `public, max-age=${CACHE_TTL_SECONDS}`);
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

export async function getPublicIncidentHistory(c: Context<{ Bindings: Env }>) {
  return withEdgeCache(c, async () => {
    const slug = c.req.param('slug');
    if (!slug) return c.notFound();
    const page = await db.getStatusPage(c.env.DB, slug);
    if (!page) return c.notFound();

    const days = page.incident_history_days ?? 30;
    const [incidents, notices] = await Promise.all([
      db.getIncidentHistory(c.env.DB, page.id, days, page.min_incident_duration_minutes ?? 0),
      db.getNoticeHistory(c.env.DB, page.id, days),
    ]);

    return c.json({ page, incidents, notices, window_days: days, generated_at: Date.now() });
  });
}

export async function getPublicStatusPage(c: Context<{ Bindings: Env }>) {
  return withEdgeCache(c, () => buildPublicStatusPage(c));
}

async function buildPublicStatusPage(c: Context<{ Bindings: Env }>): Promise<Response> {
  const slug = c.req.param('slug');
  if (!slug) return c.notFound();
  const page = await db.getStatusPage(c.env.DB, slug);

  if (!page) return c.notFound();

  const monitors = await db.getStatusPageMonitors(c.env.DB, page.id);
  const minDurationMinutes = page.min_incident_duration_minutes ?? 0;

  const now = Math.floor(Date.now() / 1000);
  const bucketSize = db.UPTIME_BUCKET_SECONDS;
  const BUCKET_COUNT = (30 * 86400) / bucketSize;
  // Aligned to the fixed bucket grid uptime_bucket_rollups is keyed on —
  // required for bucket_idx math in getUptimeBucketsAndSummary to line up.
  const bucketWindowStart = Math.floor((now - 30 * 86400) / bucketSize) * bucketSize;

  const monitorsWithData = await Promise.all(
    monitors.map(async (m) => {
      // uptime_30d/uptime_7d and the 90-bucket uptime bar read from
      // uptime_bucket_rollups (kept current by cron.ts on every check),
      // never the raw checks table — a bounded ~90-row read regardless of
      // check volume or visitor count, instead of a full 30-day scan
      // (up to ~43k rows for a 1-minute-interval monitor) on every page view.
      // The latency graph is the one remaining live GROUP BY, since its
      // 24h window is already cheap.
      const [latest, incidents, uptime, latencyBuckets, bucketSpans] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getIncidents(c.env.DB, m.id, 5, minDurationMinutes),
        db.getUptimeBucketsAndSummary(c.env.DB, m.id, bucketWindowStart, bucketSize, BUCKET_COUNT),
        db.getLatencyBucketsAgg(c.env.DB, m.id, now - 86400),
        db.getIncidentSpans(c.env.DB, m.id, bucketWindowStart, minDurationMinutes),
      ]);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        current_status: latest ? (latest.ok ? (latest.degraded ? 'degraded' : 'up') : 'down') : 'unknown',
        uptime_30d: uptime.uptime30,
        uptime_7d: uptime.uptime7,
        latency_ms: latest?.latency_ms ?? null,
        incidents,
        buckets: buildUptimeBuckets(uptime.bins, bucketSpans, bucketWindowStart, bucketSize),
        latency_24h: latencyBuckets,
      };
    })
  );

  const notices = await db.getActiveNotices(c.env.DB, page.id);

  return c.json({
    page,
    monitors: monitorsWithData,
    notices,
    generated_at: Date.now(),
  });
}

// Combines the SQL-aggregated per-bucket bins with incident spans (already a
// small in-memory array) to produce the final up/down/degraded/unknown label
// per bucket — this part stays in JS since it's only `count` (90) iterations
// against a handful of incident spans, nowhere near the CPU cost the raw
// check-row bucketing was.
function buildUptimeBuckets(
  bins: Array<{ hasAny: boolean; hasDegraded: boolean }>,
  incidentSpans: Array<{ started_at: number; resolved_at: number | null }>,
  start: number,
  bucketSize: number
): string[] {
  return bins.map((bin, i) => {
    if (!bin.hasAny) return 'unknown';
    const bucketStart = start + i * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    const hasDownIncident = incidentSpans.some(
      (s) => s.started_at < bucketEnd && (s.resolved_at === null || s.resolved_at > bucketStart)
    );
    if (hasDownIncident) return 'down';
    if (bin.hasDegraded) return 'degraded';
    return 'up';
  });
}
