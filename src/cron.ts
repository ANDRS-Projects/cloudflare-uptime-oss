import type { Env, Monitor } from './types';
import * as db from './db';
import { checkWithRetry } from './checks';
import { sendAlert } from './alerts';

// Deterministic per-monitor offset within its own interval, derived from the
// monitor's id (stable across deploys and cron runs). Without this, every
// monitor's "due" cycle is anchored to the same zero point, so monitors on
// intervals that divide evenly into a common multiple (e.g. 1/5/10/30, which
// all divide 30) all land in the same tick every time that multiple comes
// around — the worst-case tick does the combined work of every monitor at
// once instead of the load being spread out. A stable per-monitor offset
// keeps each monitor checked exactly once every interval_minutes, just at a
// different phase, so ticks don't pile up.
function checkOffset(monitorId: string, intervalMinutes: number): number {
  let hash = 0;
  for (let i = 0; i < monitorId.length; i++) {
    hash = (hash * 31 + monitorId.charCodeAt(i)) >>> 0;
  }
  return hash % intervalMinutes;
}

export async function runCronJob(env: Env): Promise<void> {
  const monitors = await db.getMonitors(env.DB);
  const now = Math.floor(Date.now() / 1000);
  const minuteOfDay = Math.floor(now / 60);

  const due = monitors.filter(
    (m) =>
      m.active === 1 &&
      (minuteOfDay + checkOffset(m.id, m.interval_minutes)) % m.interval_minutes === 0
  );

  await Promise.allSettled(due.map((m) => checkMonitor(env, m, now)));

  // Run cleanup once a day (at midnight UTC)
  if (minuteOfDay % 1440 === 0) {
    const cutoff = now - 90 * 86400;
    await env.DB.prepare('DELETE FROM checks WHERE checked_at < ?').bind(cutoff).run();
    // Rollups are only ever read over the last 30 days (see api/public.ts),
    // but kept at the same 90-day retention as raw checks for headroom.
    await db.deleteOldUptimeBuckets(env.DB, cutoff);
  }
}

async function checkMonitor(env: Env, monitor: Monitor, now: number): Promise<void> {
  const result = await checkWithRetry(monitor);
  await db.recordCheck(env.DB, monitor.id, now, result);

  const openIncident = await db.getOpenIncident(env.DB, monitor.id);

  if (!result.ok && !result.degraded && !openIncident) {
    await db.createIncident(
      env.DB,
      monitor.id,
      result.status_code || null,
      result.error
    );
    await sendAlert(monitor, false);
  } else if (result.ok && !result.degraded && openIncident) {
    await db.resolveIncident(env.DB, openIncident.id);
    await sendAlert(monitor, true);
  }
}
