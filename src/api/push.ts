import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';
import { handleIncidentState } from '../cron';

export async function receivePush(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing monitor id' }, 400);

  const monitor = await db.getMonitor(c.env.DB, id);
  if (!monitor || (monitor.monitor_type !== 'push' && monitor.monitor_type !== 'push_down')) return c.json({ error: 'Push monitor not found' }, 404);

  const now = Math.floor(Date.now() / 1000);
  const pingParam = c.req.query('ping');
  const latency = pingParam == null ? 0 : Number(pingParam);
  if (!Number.isFinite(latency) || latency < 0) {
    return c.json({ error: 'ping must be a non-negative number of milliseconds' }, 400);
  }
  const result = monitor.monitor_type === 'push_down'
    ? { ok: false, degraded: false, status_code: 0, latency_ms: latency, error: 'Push event active', json_value: null }
    : { ok: true, degraded: false, status_code: 200, latency_ms: latency, error: null, json_value: null };
  await db.recordPushHeartbeat(c.env.DB, id, now, result);
  const openIncident = await db.getOpenIncident(c.env.DB, id);
  await handleIncidentState(c.env, monitor, result, openIncident);

  return c.json({ ok: true, monitor_id: id, received_at: now });
}