import type { Context } from 'hono';
import type { Env, Check } from '../types';
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
  const bucketWindowStart = Math.floor(Date.now() / 1000) - 30 * 86400;

  const now = Math.floor(Date.now() / 1000);

  const monitorsWithData = await Promise.all(
    monitors.map(async (m) => {
      // checks already covers the full 30-day window this endpoint needs — uptime
      // percentages and the 24h latency graph are derived from it instead of
      // running 3 more full/partial scans of the same rows (D1 bills per row
      // scanned, so re-querying overlapping ranges multiplies the read cost).
      const [latest, incidents, checks, bucketSpans] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getIncidents(c.env.DB, m.id, 5, minDurationMinutes),
        db.getChecks(c.env.DB, m.id),
        db.getIncidentSpans(c.env.DB, m.id, bucketWindowStart, minDurationMinutes),
      ]);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        current_status: latest ? (latest.ok ? (latest.degraded ? 'degraded' : 'up') : 'down') : 'unknown',
        uptime_30d: computeUptimePercent(checks, now - 30 * 86400),
        uptime_7d: computeUptimePercent(checks, now - 7 * 86400),
        latency_ms: latest?.latency_ms ?? null,
        incidents,
        buckets: buildUptimeBuckets(checks, bucketSpans, 90),
        latency_24h: computeLatencyBuckets(checks, now - 86400),
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

function computeUptimePercent(checks: Check[], sinceEpoch: number): number {
  const inWindow = checks.filter((c) => c.checked_at >= sinceEpoch);
  if (!inWindow.length) return 100;
  const up = inWindow.filter((c) => c.ok === 1).length;
  return Math.round((up / inWindow.length) * 1000) / 10;
}

function computeLatencyBuckets(
  checks: Check[],
  sinceEpoch: number
): Array<{ avg_ms: number | null; ok: boolean }> {
  return Array.from({ length: 24 }, (_, i) => {
    const start = sinceEpoch + i * 3600;
    const end = start + 3600;
    const inBucket = checks.filter((c) => c.checked_at >= start && c.checked_at < end);
    if (!inBucket.length) return { avg_ms: null, ok: true };
    const hasDown = inBucket.some((c) => c.ok === 0);
    const upChecks = inBucket.filter((c) => c.ok === 1 && c.latency_ms !== null);
    const avg_ms = upChecks.length
      ? Math.round(upChecks.reduce((s, c) => s + (c.latency_ms ?? 0), 0) / upChecks.length)
      : null;
    return { avg_ms, ok: !hasDown };
  });
}

function buildUptimeBuckets(
  checks: Check[],
  incidentSpans: Array<{ started_at: number; resolved_at: number | null }>,
  count: number
): string[] {
  const now = Math.floor(Date.now() / 1000);
  const windowSeconds = 30 * 86400; // show 30 days
  const start = now - windowSeconds;
  const bucketSize = windowSeconds / count;

  return Array.from({ length: count }, (_, i) => {
    const bucketStart = start + i * bucketSize;
    const bucketEnd = bucketStart + bucketSize;
    const inBucket = checks.filter(
      (c) => c.checked_at >= bucketStart && c.checked_at < bucketEnd
    );
    if (inBucket.length === 0) return 'unknown';
    const hasDownIncident = incidentSpans.some(
      (s) => s.started_at < bucketEnd && (s.resolved_at === null || s.resolved_at > bucketStart)
    );
    if (hasDownIncident) return 'down';
    if (inBucket.some((c) => c.degraded === 1)) return 'degraded';
    return 'up';
  });
}
