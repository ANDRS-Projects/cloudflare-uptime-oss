import type { CheckResult, Env, Incident, Monitor } from './types';
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

  const settled = await Promise.allSettled(
    due.map(async (m) => ({ monitor: m, result: await checkWithRetry(m) }))
  );
  const checked = settled
    .filter(
      (r): r is PromiseFulfilledResult<{ monitor: Monitor; result: CheckResult }> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value);

  // Every due monitor needs a check row + rollup upsert, and needs its
  // current open-incident state, every single tick — those two reads/writes
  // used to be one D1 round-trip *per monitor*, which is fixed dispatch
  // overhead a Worker pays regardless of how fast D1 answers. Batching them
  // into one round-trip each, covering every monitor in the tick, is what
  // keeps a tick's CPU time from scaling with monitor count. Incident
  // create/resolve stays per-monitor since it only fires on state changes.
  if (checked.length) {
    await db.recordChecks(
      env.DB,
      checked.map(({ monitor, result }) => ({ monitorId: monitor.id, checkedAt: now, result }))
    );
  }

  const openIncidents = await db.getOpenIncidents(
    env.DB,
    checked.map(({ monitor }) => monitor.id)
  );

  await Promise.allSettled(
    checked.map(({ monitor, result }) =>
      handleIncidentState(env, monitor, result, openIncidents.get(monitor.id) ?? null)
    )
  );

  // Run cleanup once a day (at midnight UTC)
  if (minuteOfDay % 1440 === 0) {
    const cutoff = now - 90 * 86400;
    await env.DB.prepare('DELETE FROM checks WHERE checked_at < ?').bind(cutoff).run();
    // Rollups are only ever read over the last 30 days (see api/public.ts),
    // but kept at the same 90-day retention as raw checks for headroom.
    await db.deleteOldUptimeBuckets(env.DB, cutoff);
  }
}

async function handleIncidentState(
  env: Env,
  monitor: Monitor,
  result: CheckResult,
  openIncident: Incident | null
): Promise<void> {
  if (!result.ok && !result.degraded && !openIncident) {
    await db.createIncident(env.DB, monitor.id, result.status_code || null, result.error);
    await sendAlert(monitor, false);
  } else if (result.ok && !result.degraded && openIncident) {
    await db.resolveIncident(env.DB, openIncident.id);
    await sendAlert(monitor, true);
  }
}
