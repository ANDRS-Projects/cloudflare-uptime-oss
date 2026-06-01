import type { Monitor, Check, Incident, StatusPage, Notice, CheckResult, IncidentHistoryItem } from './types';

export async function getMonitors(db: D1Database): Promise<Monitor[]> {
  const r = await db.prepare('SELECT * FROM monitors ORDER BY created_at ASC').all<Monitor>();
  return r.results;
}

export async function getMonitor(db: D1Database, id: string): Promise<Monitor | null> {
  return db.prepare('SELECT * FROM monitors WHERE id = ?').bind(id).first<Monitor>();
}

export async function createMonitor(
  db: D1Database,
  m: Omit<Monitor, 'created_at' | 'active'>
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO monitors (id, name, url, interval_minutes, timeout_ms, alert_webhook, expected_status_code, retry_count, json_path, json_status_map) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(m.id, m.name, m.url, m.interval_minutes, m.timeout_ms, m.alert_webhook, m.expected_status_code ?? null, m.retry_count, m.json_path ?? null, m.json_status_map ?? null)
    .run();
}

export async function updateMonitor(
  db: D1Database,
  id: string,
  updates: Partial<Omit<Monitor, 'id' | 'created_at'>>
): Promise<void> {
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updates);
  await db.prepare(`UPDATE monitors SET ${fields} WHERE id = ?`).bind(...values, id).run();
}

export async function deleteMonitor(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM monitors WHERE id = ?').bind(id).run();
}

export async function getLatestCheck(db: D1Database, monitorId: string): Promise<Check | null> {
  return db
    .prepare('SELECT * FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT 1')
    .bind(monitorId)
    .first<Check>();
}

export async function getChecks(
  db: D1Database,
  monitorId: string,
  limit = 500
): Promise<Check[]> {
  const r = await db
    .prepare('SELECT * FROM checks WHERE monitor_id = ? ORDER BY checked_at DESC LIMIT ?')
    .bind(monitorId, limit)
    .all<Check>();
  return r.results;
}

export async function createCheck(
  db: D1Database,
  monitorId: string,
  result: CheckResult
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO checks (monitor_id, status_code, ok, degraded, latency_ms, error, json_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    .bind(monitorId, result.status_code, result.ok ? 1 : 0, result.degraded ? 1 : 0, result.latency_ms, result.error, result.json_value ?? null)
    .run();
}

export async function getOpenIncident(
  db: D1Database,
  monitorId: string
): Promise<Incident | null> {
  return db
    .prepare(
      'SELECT * FROM incidents WHERE monitor_id = ? AND resolved_at IS NULL ORDER BY started_at DESC LIMIT 1'
    )
    .bind(monitorId)
    .first<Incident>();
}

export async function getIncidents(
  db: D1Database,
  monitorId: string,
  limit = 10
): Promise<Incident[]> {
  const r = await db
    .prepare(`
      SELECT i.*,
        COALESCE(i.trigger_status_code,
          (SELECT c.status_code FROM checks c
           WHERE c.monitor_id = i.monitor_id AND c.ok = 0
           AND c.checked_at >= i.started_at - 120 AND c.checked_at <= i.started_at + 120
           ORDER BY c.checked_at ASC LIMIT 1)) AS trigger_status_code,
        COALESCE(i.trigger_error,
          (SELECT c.error FROM checks c
           WHERE c.monitor_id = i.monitor_id AND c.ok = 0
           AND c.checked_at >= i.started_at - 120 AND c.checked_at <= i.started_at + 120
           ORDER BY c.checked_at ASC LIMIT 1)) AS trigger_error
      FROM incidents i WHERE i.monitor_id = ? ORDER BY i.started_at DESC LIMIT ?
    `)
    .bind(monitorId, limit)
    .all<Incident>();
  return r.results;
}

export async function createIncident(
  db: D1Database,
  monitorId: string,
  triggerStatusCode: number | null,
  triggerError: string | null
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO incidents (monitor_id, started_at, trigger_status_code, trigger_error) VALUES (?, ?, ?, ?)'
    )
    .bind(monitorId, Math.floor(Date.now() / 1000), triggerStatusCode || null, triggerError)
    .run();
}

export async function resolveIncident(db: D1Database, incidentId: number): Promise<void> {
  await db
    .prepare('UPDATE incidents SET resolved_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), incidentId)
    .run();
}

export async function getIncidentHistory(
  db: D1Database,
  pageId: string,
  days: number
): Promise<IncidentHistoryItem[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const r = await db
    .prepare(`
      SELECT i.id, i.monitor_id, m.name AS monitor_name,
        i.started_at, i.resolved_at,
        COALESCE(i.trigger_status_code,
          (SELECT c.status_code FROM checks c
           WHERE c.monitor_id = i.monitor_id AND c.ok = 0
           AND c.checked_at >= i.started_at - 120 AND c.checked_at <= i.started_at + 120
           ORDER BY c.checked_at ASC LIMIT 1)) AS trigger_status_code,
        COALESCE(i.trigger_error,
          (SELECT c.error FROM checks c
           WHERE c.monitor_id = i.monitor_id AND c.ok = 0
           AND c.checked_at >= i.started_at - 120 AND c.checked_at <= i.started_at + 120
           ORDER BY c.checked_at ASC LIMIT 1)) AS trigger_error
      FROM incidents i
      JOIN status_page_monitors spm ON spm.monitor_id = i.monitor_id
      JOIN monitors m ON m.id = i.monitor_id
      WHERE spm.status_page_id = ? AND i.started_at >= ?
      ORDER BY i.started_at DESC
    `)
    .bind(pageId, since)
    .all<IncidentHistoryItem>();
  return r.results;
}

export async function getStatusPages(db: D1Database): Promise<StatusPage[]> {
  const r = await db
    .prepare('SELECT * FROM status_pages ORDER BY created_at ASC')
    .all<StatusPage>();
  return r.results;
}

export async function getStatusPage(
  db: D1Database,
  idOrSlug: string
): Promise<StatusPage | null> {
  return db
    .prepare('SELECT * FROM status_pages WHERE id = ? OR slug = ?')
    .bind(idOrSlug, idOrSlug)
    .first<StatusPage>();
}

export async function createStatusPage(
  db: D1Database,
  page: Omit<StatusPage, 'created_at'>
): Promise<void> {
  await db
    .prepare('INSERT INTO status_pages (id, name, slug, description) VALUES (?, ?, ?, ?)')
    .bind(page.id, page.name, page.slug, page.description)
    .run();
}

export async function updateStatusPage(
  db: D1Database,
  id: string,
  updates: Partial<Omit<StatusPage, 'id' | 'created_at'>>
): Promise<void> {
  const fields = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(', ');
  const values = Object.values(updates);
  await db.prepare(`UPDATE status_pages SET ${fields} WHERE id = ?`).bind(...values, id).run();
}

export async function deleteStatusPage(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM status_pages WHERE id = ?').bind(id).run();
}

export async function getStatusPageMonitors(
  db: D1Database,
  pageId: string
): Promise<Monitor[]> {
  const r = await db
    .prepare(
      `SELECT m.* FROM monitors m
       JOIN status_page_monitors spm ON spm.monitor_id = m.id
       WHERE spm.status_page_id = ?
       ORDER BY m.name ASC`
    )
    .bind(pageId)
    .all<Monitor>();
  return r.results;
}

export async function addMonitorToPage(
  db: D1Database,
  pageId: string,
  monitorId: string,
  order = 0
): Promise<void> {
  await db
    .prepare(
      'INSERT OR IGNORE INTO status_page_monitors (status_page_id, monitor_id, display_order) VALUES (?, ?, ?)'
    )
    .bind(pageId, monitorId, order)
    .run();
}

export async function removeMonitorFromPage(
  db: D1Database,
  pageId: string,
  monitorId: string
): Promise<void> {
  await db
    .prepare(
      'DELETE FROM status_page_monitors WHERE status_page_id = ? AND monitor_id = ?'
    )
    .bind(pageId, monitorId)
    .run();
}

export async function getLatencyBuckets(
  db: D1Database,
  monitorId: string
): Promise<Array<{ avg_ms: number | null; ok: boolean }>> {
  const now = Math.floor(Date.now() / 1000);
  const since = now - 86400;
  const r = await db
    .prepare('SELECT * FROM checks WHERE monitor_id = ? AND checked_at >= ? ORDER BY checked_at ASC')
    .bind(monitorId, since)
    .all<Check>();
  const checks = r.results;

  return Array.from({ length: 24 }, (_, i) => {
    const start = since + i * 3600;
    const end = start + 3600;
    const inBucket = checks.filter((c) => c.checked_at >= start && c.checked_at < end);
    if (!inBucket.length) return { avg_ms: null, ok: true };
    const hasDown = inBucket.some((c) => c.ok === 0);
    const upChecks = inBucket.filter((c) => c.ok === 1 && c.latency_ms !== null);
    const avg_ms = upChecks.length
      ? Math.round(upChecks.reduce((s, c) => s + (c.latency_ms ?? 0), 0) / upChecks.length)
      : null;
    return { avg_ms, ok: !hasDown };
  });
}

export async function getStatusPageByDomain(
  db: D1Database,
  hostname: string
): Promise<StatusPage | null> {
  return db
    .prepare('SELECT * FROM status_pages WHERE custom_domain = ?')
    .bind(hostname)
    .first<StatusPage>();
}

export async function getActiveNotices(db: D1Database, pageId: string): Promise<Notice[]> {
  const since = Math.floor(Date.now() / 1000) - 86400; // keep resolved notices for 24h
  const r = await db
    .prepare('SELECT * FROM notices WHERE status_page_id = ? AND (resolved_at IS NULL OR resolved_at >= ?) ORDER BY created_at DESC')
    .bind(pageId, since)
    .all<Notice>();
  return r.results;
}

export async function getAllNotices(db: D1Database, pageId: string): Promise<Notice[]> {
  const r = await db
    .prepare('SELECT * FROM notices WHERE status_page_id = ? ORDER BY created_at DESC LIMIT 50')
    .bind(pageId)
    .all<Notice>();
  return r.results;
}

export async function getNoticeHistory(db: D1Database, pageId: string, days: number): Promise<Notice[]> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const r = await db
    .prepare('SELECT * FROM notices WHERE status_page_id = ? AND created_at >= ? ORDER BY created_at DESC')
    .bind(pageId, since)
    .all<Notice>();
  return r.results;
}

export async function createNotice(
  db: D1Database,
  notice: Omit<Notice, 'created_at' | 'resolved_at'>
): Promise<void> {
  await db
    .prepare('INSERT INTO notices (id, status_page_id, message, severity) VALUES (?, ?, ?, ?)')
    .bind(notice.id, notice.status_page_id, notice.message, notice.severity)
    .run();
}

export async function resolveNotice(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE notices SET resolved_at = ? WHERE id = ?')
    .bind(Math.floor(Date.now() / 1000), id)
    .run();
}

export async function deleteNotice(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM notices WHERE id = ?').bind(id).run();
}

export async function getUptimePercent(
  db: D1Database,
  monitorId: string,
  days = 30
): Promise<number> {
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const row = await db
    .prepare(
      'SELECT COUNT(*) as total, SUM(ok) as up FROM checks WHERE monitor_id = ? AND checked_at >= ?'
    )
    .bind(monitorId, since)
    .first<{ total: number; up: number }>();
  if (!row || row.total === 0) return 100;
  return Math.round((row.up / row.total) * 1000) / 10;
}
