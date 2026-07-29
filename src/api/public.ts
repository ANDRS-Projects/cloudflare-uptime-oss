import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

export async function getPublicIncidentHistory(c: Context<{ Bindings: Env }>) {
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
}

export async function getPublicStatusPage(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug');
  if (!slug) return c.notFound();
  const page = await db.getStatusPage(c.env.DB, slug);

  if (!page) return c.notFound();

  const monitors = await db.getStatusPageMonitors(c.env.DB, page.id);
  const minDurationMinutes = page.min_incident_duration_minutes ?? 0;

  const BUCKET_COUNT = 90;
  const bucketWindowSeconds = 30 * 86400;
  const bucketWindowStart = Math.floor(Date.now() / 1000) - bucketWindowSeconds;
  const bucketSize = bucketWindowSeconds / BUCKET_COUNT;

  const monitorsWithData = await Promise.all(
    monitors.map(async (m) => {
      const [latest, uptime30, uptime7, incidents, uptimeBins, latency_24h, bucketSpans] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getUptimePercent(c.env.DB, m.id, 30),
        db.getUptimePercent(c.env.DB, m.id, 7),
        db.getIncidents(c.env.DB, m.id, 5, minDurationMinutes),
        db.getUptimeBucketBins(c.env.DB, m.id, bucketWindowStart, bucketSize, BUCKET_COUNT),
        db.getLatencyBuckets(c.env.DB, m.id),
        db.getIncidentSpans(c.env.DB, m.id, bucketWindowStart, minDurationMinutes),
      ]);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        current_status: latest ? (latest.ok ? (latest.degraded ? 'degraded' : 'up') : 'down') : 'unknown',
        uptime_30d: uptime30,
        uptime_7d: uptime7,
        latency_ms: latest?.latency_ms ?? null,
        incidents,
        buckets: buildUptimeBuckets(uptimeBins, bucketSpans, bucketWindowStart, bucketSize),
        latency_24h,
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
// against a handful of incident spans, nowhere near the CPU cost of looping
// over every raw check row.
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
