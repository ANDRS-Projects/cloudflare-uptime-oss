import type { Env } from './types';
import * as db from './db';
import { sendHealthAlert } from './alerts';

// A monitor is "stale" once it's gone this many of its own intervals without
// a check landing, with a floor so 1-minute-interval monitors don't false-
// positive on ordinary jitter (retry delays, a slow tick, etc.).
const STALE_MULTIPLIER = 3;
const MIN_STALE_SECONDS = 300;

// Runs on its own low-frequency cron tick (see wrangler.toml), fully
// decoupled from the 1-minute check loop in cron.ts — it must never add cost
// to that hot path, since that's exactly the budget this feature exists to
// watch over. Detects staleness from data the check loop already writes
// (checks.checked_at) rather than needing the check loop to report on its
// own health, since a Worker too CPU-exhausted to finish its checks may also
// be too exhausted to reliably self-report.
export async function runHealthCheck(env: Env): Promise<void> {
  const monitors = await db.getMonitorStaleness(env.DB);
  const now = Math.floor(Date.now() / 1000);

  const stale = monitors.filter((m) => {
    if (m.last_checked_at == null) return false;
    const threshold = Math.max(m.interval_minutes * 60 * STALE_MULTIPLIER, MIN_STALE_SECONDS);
    return now - m.last_checked_at > threshold;
  });

  const isUnhealthy = stale.length > 0;
  const wasUnhealthy = await db.getWorkerHealthState(env.DB);
  if (isUnhealthy === wasUnhealthy) return;

  await db.setWorkerHealthState(env.DB, isUnhealthy);
  await sendHealthAlert(env, isUnhealthy, stale.map((m) => m.name));
}
