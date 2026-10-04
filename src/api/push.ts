import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';
import { handleIncidentState } from '../cron';
import { heartbeatResult, MIN_HEARTBEAT_GAP_SECONDS } from '../passive';

// Unauthenticated by design: the secret push_token in the URL is the
// credential. It is deliberately separate from the monitor id, which public
// status pages expose.
export async function receivePush(c: Context<{ Bindings: Env }>) {
  const token = c.req.param('token');
  const monitor = token ? await db.getMonitorByPushToken(c.env.DB, token) : null;
  if (!monitor || (monitor.monitor_type !== 'push' && monitor.monitor_type !== 'push_down')) {
    return c.json({ error: 'Push monitor not found' }, 404);
  }

  const pingParam = c.req.query('ping');
  const latency = pingParam == null || pingParam === '' ? 0 : Number(pingParam);
  if (!Number.isFinite(latency) || latency < 0) {
    return c.json({ error: 'ping must be a non-negative number of milliseconds' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  if (monitor.active !== 1) return c.json({ ok: true, ignored: 'monitor is paused' });
  if (monitor.last_heartbeat_at != null && now - monitor.last_heartbeat_at < MIN_HEARTBEAT_GAP_SECONDS) {
    return c.json({ ok: true, ignored: 'heartbeat received too soon after the previous one' });
  }

  const result = heartbeatResult(monitor.monitor_type, Math.round(latency));
  const openIncident = await db.recordPushHeartbeat(c.env.DB, monitor.id, now, result);
  await handleIncidentState(c.env, monitor, result, openIncident);

  return c.json({ ok: true, received_at: now });
}
