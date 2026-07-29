import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

// Short edge cache for public GETs: the underlying data changes at most once a
// minute (cron interval), but the status page auto-refreshes client-side every
// 60s and can be viewed by many visitors at once — without this, every one of
// those hits re-runs the full D1 query set below.
const CACHE_TTL_SECONDS = 30;

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
  const BUCKET_COUNT = 90;
  const bucketWindowSeconds = 30 * 86400;
  const bucketWindowStart = now - bucketWindowSeconds;
  const bucketSize = bucketWindowSeconds / BUCKET_COUNT;

  const monitorsWithData = await Promise.all(
    monitors.map(async (m) => {
      // Uptime%, the latency graph, and the uptime bar are all bucketed
      // aggregates over the checks table — computed in SQL via GROUP BY on a
      // computed bucket index instead of fetching the raw ~43k rows a
      // 1-minute-interval monitor can have in 30 days and bucketing them in
      // JS. D1 still scans the same rows (rows_read cost unchanged), but
      // returns at most ~90 aggregated rows; and D1 query execution isn't
      // counted against the Worker's CPU-time limit — only what the Worker
      // does with the rows it gets back is. The old full-fetch-and-loop
      // approach was blowing the Workers Free plan's 10ms/request CPU budget
      // on status pages with several high-frequency monitors.
      const [latest, incidents, uptime, latencyBuckets, uptimeBins, bucketSpans] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getIncidents(c.env.DB, m.id, 5, minDurationMinutes),
        db.getUptimeSummary(c.env.DB, m.id, now - 30 * 86400, now - 7 * 86400),
        db.getLatencyBucketsAgg(c.env.DB, m.id, now - 86400),
        db.getUptimeBucketBins(c.env.DB, m.id, bucketWindowStart, bucketSize, BUCKET_COUNT),
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
        buckets: buildUptimeBuckets(uptimeBins, bucketSpans, bucketWindowStart, bucketSize),
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
