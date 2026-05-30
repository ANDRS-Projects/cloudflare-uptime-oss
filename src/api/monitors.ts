import type { Context } from 'hono';
import type { Env } from '../types';
import * as db from '../db';

export async function listMonitors(c: Context<{ Bindings: Env }>) {
  const monitors = await db.getMonitors(c.env.DB);
  const withStatus = await Promise.all(
    monitors.map(async (m) => {
      const [latest, uptime] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getUptimePercent(c.env.DB, m.id),
      ]);
      return { ...m, latest_check: latest, uptime_30d: uptime };
    })
  );
  return c.json(withStatus);
}

export async function createMonitor(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{
    name: string;
    url: string;
    interval_minutes?: number;
    timeout_ms?: number;
    alert_webhook?: string;
    expected_status_code?: number;
    retry_count?: number;
  }>();

  if (!body.name || !body.url) {
    return c.json({ error: 'name and url are required' }, 400);
  }

  const id = crypto.randomUUID();
  await db.createMonitor(c.env.DB, {
    id,
    name: body.name,
    url: body.url,
    interval_minutes: body.interval_minutes ?? 1,
    timeout_ms: body.timeout_ms ?? 10000,
    alert_webhook: body.alert_webhook ?? null,
    expected_status_code: body.expected_status_code ?? null,
    retry_count: body.retry_count ?? 3,
  });
  return c.json({ id }, 201);
}

export async function updateMonitor(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'url', 'interval_minutes', 'timeout_ms', 'alert_webhook', 'active', 'expected_status_code', 'retry_count'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  await db.updateMonitor(c.env.DB, id, updates);
  return c.json({ ok: true });
}

export async function deleteMonitor(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  await db.deleteMonitor(c.env.DB, id);
  return c.json({ ok: true });
}

export async function getMonitorChecks(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const limit = parseInt(c.req.query('limit') ?? '100', 10);
  const checks = await db.getChecks(c.env.DB, id, limit);
  return c.json(checks);
}
