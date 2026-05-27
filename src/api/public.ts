import type { Context } from 'hono';
import type { Env, Check } from '../types';
import * as db from '../db';

export async function getPublicIncidentHistory(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug');
  const page = await db.getStatusPage(c.env.DB, slug);
  if (!page) return c.notFound();

  const days = page.incident_history_days ?? 30;
  const incidents = await db.getIncidentHistory(c.env.DB, page.id, days);

  return c.json({ page, incidents, window_days: days, generated_at: Date.now() });
}

export async function getPublicStatusPage(c: Context<{ Bindings: Env }>) {
  const slug = c.req.param('slug');
  const page = await db.getStatusPage(c.env.DB, slug);

  if (!page) return c.notFound();

  const monitors = await db.getStatusPageMonitors(c.env.DB, page.id);

  const monitorsWithData = await Promise.all(
    monitors.map(async (m) => {
      const [latest, uptime30, uptime7, incidents, checks, latency_24h] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getUptimePercent(c.env.DB, m.id, 30),
        db.getUptimePercent(c.env.DB, m.id, 7),
        db.getIncidents(c.env.DB, m.id, 5),
        db.getChecks(c.env.DB, m.id, 500),
        db.getLatencyBuckets(c.env.DB, m.id),
      ]);

      return {
        id: m.id,
        name: m.name,
        url: m.url,
        current_status: latest ? (latest.ok ? 'up' : 'down') : 'unknown',
        uptime_30d: uptime30,
        uptime_7d: uptime7,
        latency_ms: latest?.latency_ms ?? null,
        incidents,
        buckets: buildUptimeBuckets(checks, 90),
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

function buildUptimeBuckets(checks: Check[], count: number): string[] {
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
    return inBucket.some((c) => c.ok === 0) ? 'down' : 'up';
  });
}
