import type { Env, Monitor } from './types';
import * as db from './db';
import { runCheck } from './checks';
import { sendAlert } from './alerts';

export async function runCronJob(env: Env): Promise<void> {
  const monitors = await db.getMonitors(env.DB);
  const now = Math.floor(Date.now() / 1000);
  const minuteOfDay = Math.floor(now / 60);

  const due = monitors.filter(
    (m) => m.active === 1 && minuteOfDay % m.interval_minutes === 0
  );

  await Promise.allSettled(due.map((m) => checkMonitor(env, m)));

  // Run cleanup once a day (at midnight UTC)
  if (minuteOfDay % 1440 === 0) {
    const cutoff = now - 90 * 86400;
    await env.DB.prepare('DELETE FROM checks WHERE checked_at < ?').bind(cutoff).run();
  }
}

async function checkMonitor(env: Env, monitor: Monitor): Promise<void> {
  const result = await runCheck(monitor);
  await db.createCheck(env.DB, monitor.id, result);

  const openIncident = await db.getOpenIncident(env.DB, monitor.id);

  if (!result.ok && !openIncident) {
    await db.createIncident(
      env.DB,
      monitor.id,
      result.status_code || null,
      result.error
    );
    await sendAlert(monitor, false);
  } else if (result.ok && openIncident) {
    await db.resolveIncident(env.DB, openIncident.id);
    await sendAlert(monitor, true);
  }
}
