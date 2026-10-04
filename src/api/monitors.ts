import type { Context } from 'hono';
import { MONITOR_TYPES, type Env, type ManualStatus, type Monitor, type MonitorType } from '../types';
import * as db from '../db';
import { isPassiveType, isPushType } from '../passive';

const MANUAL_STATUSES: readonly ManualStatus[] = ['up', 'degraded', 'down'];
const PUSH_URL_PLACEHOLDER = 'push://heartbeat';
const MANUAL_URL_PLACEHOLDER = 'manual://status';

function isMonitorType(v: unknown): v is MonitorType {
  return typeof v === 'string' && (MONITOR_TYPES as readonly string[]).includes(v);
}

function isGracePeriod(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1440;
}

function placeholderUrl(type: MonitorType): string | null {
  if (isPushType(type)) return PUSH_URL_PLACEHOLDER;
  if (type === 'manual') return MANUAL_URL_PLACEHOLDER;
  return null;
}

function pushUrl(c: Context<{ Bindings: Env }>, m: Pick<Monitor, 'monitor_type' | 'push_token'>): string | null {
  if (!isPushType(m.monitor_type) || !m.push_token) return null;
  return new URL(`/api/push/${m.push_token}`, c.req.url).toString();
}

export async function listMonitors(c: Context<{ Bindings: Env }>) {
  const monitors = await db.getMonitors(c.env.DB);
  const withStatus = await Promise.all(
    monitors.map(async (m) => {
      const [latest, uptime] = await Promise.all([
        db.getLatestCheck(c.env.DB, m.id),
        db.getUptimePercent(c.env.DB, m.id),
      ]);
      return { ...m, push_url: pushUrl(c, m), latest_check: latest, uptime_30d: uptime };
    })
  );
  return c.json(withStatus);
}

export async function createMonitor(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{
    name: string;
    monitor_type?: MonitorType;
    url?: string;
    interval_minutes?: number;
    timeout_ms?: number;
    alert_webhook?: string;
    expected_status_code?: number;
    retry_count?: number;
    json_path?: string;
    json_status_map?: Record<string, string>;
    keyword?: string;
    manual_status?: ManualStatus;
    grace_period_minutes?: number;
  }>();

  const type = body.monitor_type ?? 'http';
  if (!isMonitorType(type)) {
    return c.json({ error: `monitor_type must be one of: ${MONITOR_TYPES.join(', ')}` }, 400);
  }
  const url = placeholderUrl(type) ?? body.url;
  if (!body.name || !url) {
    return c.json({ error: isPassiveType(type) ? 'name is required' : 'name and url are required' }, 400);
  }

  if (type === 'tcp' && !url.startsWith('tcp://')) return c.json({ error: 'tcp monitors need a tcp://host:port url' }, 400);

  const keyword = type === 'keyword' ? (body.keyword ?? '').trim() : null;
  if (type === 'keyword') {
    if (!keyword) return c.json({ error: 'keyword is required for keyword monitors' }, 400);
    if (!/^https?:\/\//i.test(url)) return c.json({ error: 'keyword monitors need an http(s) url' }, 400);
  }

  const manualStatus = type === 'manual' ? (body.manual_status ?? 'up') : null;
  if (manualStatus !== null && !MANUAL_STATUSES.includes(manualStatus)) {
    return c.json({ error: 'manual_status must be up, degraded, or down' }, 400);
  }

  const gracePeriod = body.grace_period_minutes ?? 5;
  if (!isGracePeriod(gracePeriod)) {
    return c.json({ error: 'grace_period_minutes must be a whole number between 1 and 1440' }, 400);
  }

  if (body.json_status_map) {
    const validStates = new Set(['up', 'degraded', 'down']);
    const invalid = Object.values(body.json_status_map).find((v) => !validStates.has(v));
    if (invalid) return c.json({ error: `json_status_map values must be up, degraded, or down` }, 400);
  }

  const id = crypto.randomUUID();
  const pushToken = isPushType(type) ? crypto.randomUUID() : null;
  await db.createMonitor(c.env.DB, {
    id,
    name: body.name,
    monitor_type: type,
    url,
    interval_minutes: body.interval_minutes ?? 1,
    timeout_ms: body.timeout_ms ?? 5000,
    alert_webhook: body.alert_webhook ?? null,
    expected_status_code: body.expected_status_code ?? null,
    retry_count: body.retry_count ?? 2,
    json_path: body.json_path ?? null,
    json_status_map: body.json_status_map ? JSON.stringify(body.json_status_map) : null,
    keyword,
    manual_status: manualStatus,
    grace_period_minutes: gracePeriod,
    push_token: pushToken,
  });
  return c.json({ id, push_url: pushUrl(c, { monitor_type: type, push_token: pushToken }) }, 201);
}

export async function updateMonitor(c: Context<{ Bindings: Env }>) {
  const id = c.req.param('id');
  if (!id) return c.json({ error: 'missing id' }, 400);
  const existing = await db.getMonitor(c.env.DB, id);
  if (!existing) return c.json({ error: 'Monitor not found' }, 404);

  const body = await c.req.json<Record<string, unknown>>();
  const allowed = ['name', 'url', 'monitor_type', 'interval_minutes', 'timeout_ms', 'alert_webhook', 'active', 'expected_status_code', 'retry_count', 'json_path', 'json_status_map', 'keyword', 'manual_status', 'grace_period_minutes'];
  const updates: Record<string, unknown> = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  // The admin form sends "" for fields that don't apply to the chosen type.
  if (updates.keyword === '') updates.keyword = null;
  if (updates.manual_status === '') updates.manual_status = null;

  const type = updates.monitor_type ?? existing.monitor_type;
  if (!isMonitorType(type)) {
    return c.json({ error: `monitor_type must be one of: ${MONITOR_TYPES.join(', ')}` }, 400);
  }

  const placeholder = placeholderUrl(type);
  const url = placeholder ?? ((updates.url as string | undefined) ?? existing.url);
  if (placeholder) {
    updates.url = placeholder;
  } else if (!url || url === PUSH_URL_PLACEHOLDER || url === MANUAL_URL_PLACEHOLDER) {
    return c.json({ error: 'url is required for this monitor type' }, 400);
  }

  if (type === 'tcp' && !url.startsWith('tcp://')) {
    return c.json({ error: 'tcp monitors need a tcp://host:port url' }, 400);
  }

  if (type === 'keyword') {
    const keyword = ('keyword' in updates ? String(updates.keyword ?? '') : (existing.keyword ?? '')).trim();
    if (!keyword) return c.json({ error: 'keyword is required for keyword monitors' }, 400);
    if (!/^https?:\/\//i.test(url)) return c.json({ error: 'keyword monitors need an http(s) url' }, 400);
    updates.keyword = keyword;
  }

  if (type === 'manual') {
    const status = (updates.manual_status as string | null | undefined) ?? existing.manual_status ?? 'up';
    if (!MANUAL_STATUSES.includes(status as ManualStatus)) {
      return c.json({ error: 'manual_status must be up, degraded, or down' }, 400);
    }
    updates.manual_status = status;
  }

  if (updates.grace_period_minutes !== undefined && !isGracePeriod(updates.grace_period_minutes)) {
    return c.json({ error: 'grace_period_minutes must be a whole number between 1 and 1440' }, 400);
  }

  // A monitor switched to a push type needs its secret URL token.
  if (isPushType(type) && !existing.push_token) updates.push_token = crypto.randomUUID();

  if (updates.json_status_map != null && typeof updates.json_status_map === 'object') {
    updates.json_status_map = JSON.stringify(updates.json_status_map);
  }
  if (Object.keys(updates).length > 0) await db.updateMonitor(c.env.DB, id, updates);
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
