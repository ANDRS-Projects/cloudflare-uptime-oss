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
      return { ...m, push_url: m.monitor_type === 'push' || m.monitor_type === 'push_down' ? new URL(`/api/push/${m.id}`, c.req.url).toString() : null, latest_check: latest, uptime_30d: uptime };
    })
  );
  return c.json(withStatus);
}

export async function createMonitor(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{
    name: string;
    monitor_type?: 'http' | 'tcp' | 'keyword' | 'push' | 'push_down' | 'manual';
    url: string;
    interval_minutes?: number;
    timeout_ms?: number;
    alert_webhook?: string;
    expected_status_code?: number;
    retry_count?: number;
    json_path?: string;
    json_status_map?: Record<string, string>;
    keyword?: string;
    manual_status?: 'up' | 'degraded' | 'down';
    grace_period_minutes?: number;
  }>();

  if (!body.name || !body.url) {
    return c.json({ error: 'name and url are required' }, 400);
  }
  if (body.monitor_type && !['http', 'tcp', 'push', 'push_down'].includes(body.monitor_type)) {
    return c.json({ error: 'monitor_type must be http, tcp, push, or push_down' }, 400);
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
    monitor_type: body.monitor_type ?? 'http',
    url: body.url,
    interval_minutes: body.interval_minutes ?? 1,
    timeout_ms: body.timeout_ms ?? 5000,
    alert_webhook: body.alert_webhook ?? null,
    expected_status_code: body.expected_status_code ?? null,
    retry_count: body.retry_count ?? 2,
    json_path: body.json_path ?? null,
    json_status_map: body.json_status_map ? JSON.stringify(body.json_status_map) : null,
    keyword: body.keyword ?? null,
    manual_status: body.manual_status ?? null,
    grace_period_minutes: body.grace_period_minutes ?? 1,
  });
  return c.json({ id, push_url: body.monitor_type === 'push' || body.monitor_type === 'push_down' ? new URL(`/api/push/${id}`, c.req.url).toString() : null }, 201);
}

export async function updateMonitor(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'url', 'monitor_type', 'interval_minutes', 'timeout_ms', 'alert_webhook', 'active', 'expected_status_code', 'retry_count', 'json_path', 'json_status_map', 'keyword', 'manual_status', 'grace_period_minutes'];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  // Normalize empty strings to null so the type-specific validations below
  // don't reject benign absent fields sent as "" by the admin form.
  if (updates.keyword === '') updates.keyword = null;
  if (updates.manual_status === '') updates.manual_status = null;
  if (updates.monitor_type != null && !['http', 'tcp', 'keyword', 'push', 'push_down', 'manual'].includes(updates.monitor_type as string)) {
    return c.json({ error: 'monitor_type must be http, tcp, keyword, push, or push_down, or manual' }, 400);
  }
  if (updates.keyword != null && updates.monitor_type !== 'keyword') {
    return c.json({ error: 'keyword is only valid for keyword monitor type' }, 400);
  }
  if (updates.manual_status != null && updates.monitor_type !== 'manual') {
    return c.json({ error: 'manual_status is only valid for manual monitor type' }, 400);
  }
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
  const limitParam = c.req.query('limit');
  const beforeParam = c.req.query('before');
  const limit = limitParam ? Number(limitParam) : undefined;
  const before = beforeParam ? Number(beforeParam) : undefined;
  const checks = await db.getChecks(c.env.DB, id, {
    limit: limit && limit > 0 ? limit : undefined,
    before: before && before > 0 ? before : undefined,
  });
  return c.json(checks);
}
