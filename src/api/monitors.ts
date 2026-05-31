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
    json_path?: string;
    json_status_map?: Record<string, string>;
  }>();

  if (!body.name || !body.url) {
    return c.json({ error: 'name and url are required' }, 400);
  }

  if (body.json_status_map) {
    const validStates = new Set(['up', 'degraded', 'down']);
    const invalid = Object.values(body.json_status_map).find((v) => !validStates.has(v));
    if (invalid) return c.json({ error: `json_status_map values must be up, degraded, or down` }, 400);
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
    json_path: body.json_path ?? null,
    json_status_map: body.json_status_map ? JSON.stringify(body.json_status_map) : null,
  });
  return c.json({ id }, 201);
}

export async function updateMonitor(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'url', 'interval_minutes', 'timeout_ms', 'alert_webhook', 'active', 'expected_status_code', 'retry_count', 'json_path', 'json_status_map'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  if (updates.json_status_map != null && typeof updates.json_status_map === 'object') {
    updates.json_status_map = JSON.stringify(updates.json_status_map);
  }
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
