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
  options?: { limit?: number; before?: number }
): Promise<Check[]> {
  const limit = options?.limit;
  const before = options?.before;
  // Callers that page (limit set) can reach back to the full 90-day retention
  // window (see cron.ts cleanup); the unpaginated call (public status page,
  // no options) keeps the original 30-day floor it was built around.
  const since = Math.floor(Date.now() / 1000) - (limit ? 90 : 30) * 86400;

  const conditions = ['monitor_id = ?', 'checked_at >= ?'];
  const params: (string | number)[] = [monitorId, since];
  if (before) {
    conditions.push('checked_at < ?');
    params.push(before);
  }
  let query = `SELECT * FROM checks WHERE ${conditions.join(' AND ')} ORDER BY checked_at DESC`;
  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }

  const r = await db.prepare(query).bind(...params).all<Check>();
  return r.results;
}

// Aggregates in SQL instead of fetching raw rows: D1 still scans the same
// checked_at >= since range (rows_read cost is unchanged), but returns at
// most `count` grouped rows instead of up to ~43k raw ones for a
// 1-minute-interval monitor — and D1 query execution isn't counted against
// the Worker's CPU time limit, only what the Worker does with the rows it
// gets back is. Fetching+looping over the raw rows for this was eating into
// the Workers Free plan's 10ms/request CPU budget on status pages with
// several high-frequency monitors.
// Fixed epoch-aligned bucket width backing uptime_bucket_rollups. 30d/8h = 90
// buckets, and 7d/8h = 21 exactly, which is what lets uptime_7d fall out of
// the same 90-bucket scan as uptime_30d with no separate query.
export const UPTIME_BUCKET_SECONDS = 8 * 3600;

export async function deleteOldUptimeBuckets(db: D1Database, cutoff: number): Promise<void> {
  await db.prepare('DELETE FROM uptime_bucket_rollups WHERE bucket_start < ?').bind(cutoff).run();
}

// Combines the 90-bucket uptime bar with uptime_30d/uptime_7d in one read.
// Backed by uptime_bucket_rollups (kept current by cron.ts on every check)
// rather than the raw checks table, so this is always a read of at most
// `count` rows (90) regardless of check volume or visitor count — previously
// this scanned the full 30-day checked_at range per request. `start` must be
// aligned to UPTIME_BUCKET_SECONDS for bucket_idx to come out as a clean
// integer.
export async function getUptimeBucketsAndSummary(
  db: D1Database,
  monitorId: string,
  start: number,
  bucketSize: number,
  count: number
): Promise<{
  bins: Array<{ hasAny: boolean; hasDegraded: boolean }>;
  uptime30: number;
  uptime7: number;
}> {
  const r = await db
    .prepare(
      `SELECT bucket_start, cnt, up_cnt, degraded_cnt
       FROM uptime_bucket_rollups
       WHERE monitor_id = ? AND bucket_start >= ?`
    )
    .bind(monitorId, start)
    .all<{ bucket_start: number; cnt: number; up_cnt: number; degraded_cnt: number }>();

  const byIdx = new Map(r.results.map((row) => [Math.round((row.bucket_start - start) / bucketSize), row]));
  const bins = Array.from({ length: count }, (_, i) => {
    const row = byIdx.get(i);
    if (!row) return { hasAny: false, hasDegraded: false };
    return { hasAny: row.cnt > 0, hasDegraded: row.degraded_cnt > 0 };
  });

  const sevenDayBucketCount = Math.round((7 * 86400) / bucketSize);
  let total30 = 0, up30 = 0, total7 = 0, up7 = 0;
  for (let i = 0; i < count; i++) {
    const row = byIdx.get(i);
    if (!row) continue;
    total30 += row.cnt;
    up30 += row.up_cnt;
    if (i >= count - sevenDayBucketCount) {
      total7 += row.cnt;
      up7 += row.up_cnt;
    }
  }

  return {
    bins,
    uptime30: total30 ? Math.round((up30 / total30) * 1000) / 10 : 100,
    uptime7: total7 ? Math.round((up7 / total7) * 1000) / 10 : 100,
  };
}

// Aggregates in SQL instead of fetching raw rows: D1 still scans the same
// checked_at >= since range (rows_read cost is unchanged), but returns at
// most 24 grouped rows instead of up to ~43k raw ones for a 1-minute-interval
// monitor — and D1 query execution isn't counted against the Worker's CPU
// time limit, only what the Worker does with the rows it gets back is. That
// full raw fetch (plus the JS-side bucketing loop over it) was blowing the
// Workers Free plan's 10ms CPU-time-per-request budget on status pages with
// several high-frequency monitors.
export async function getLatencyBucketsAgg(
  db: D1Database,
  monitorId: string,
  sinceEpoch: number
): Promise<Array<{ avg_ms: number | null; ok: boolean }>> {
  const BUCKET_COUNT = 24;
  const BUCKET_SECONDS = 3600;
  const untilEpoch = sinceEpoch + BUCKET_COUNT * BUCKET_SECONDS;

  const r = await db
    .prepare(
      `SELECT
        CAST((checked_at - ?) / ? AS INTEGER) AS bucket_idx,
        SUM(CASE WHEN ok = 0 THEN 1 ELSE 0 END) AS down_cnt,
        SUM(CASE WHEN ok = 1 AND latency_ms IS NOT NULL THEN latency_ms ELSE 0 END) AS latency_sum,
        SUM(CASE WHEN ok = 1 AND latency_ms IS NOT NULL THEN 1 ELSE 0 END) AS latency_cnt
      FROM checks
      WHERE monitor_id = ? AND checked_at >= ? AND checked_at < ?
      GROUP BY bucket_idx`
    )
    .bind(sinceEpoch, BUCKET_SECONDS, monitorId, sinceEpoch, untilEpoch)
    .all<{ bucket_idx: number; down_cnt: number; latency_sum: number; latency_cnt: number }>();

  const byIdx = new Map(r.results.map((row) => [row.bucket_idx, row]));
  return Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const row = byIdx.get(i);
    if (!row) return { avg_ms: null, ok: true };
    const avg_ms = row.latency_cnt ? Math.round(row.latency_sum / row.latency_cnt) : null;
    return { avg_ms, ok: row.down_cnt === 0 };
  });
}

// Writes the check row and its uptime_bucket_rollups upsert in a single D1
// round-trip via batch(), instead of two separate prepared-statement calls.
// Each D1 call has real Worker-side dispatch overhead (constructing and
// sending the RPC), which counts against CPU time even though D1's own query
// execution doesn't — cron.ts calls this once per due monitor in the same
// invocation, so on an account with several dozen monitors, going from one
// round-trip per monitor to two was enough on its own to push the Worker
// past the free tier's 10ms CPU-time budget on every single cron tick.
export async function recordCheck(
  db: D1Database,
  monitorId: string,
  checkedAt: number,
  result: CheckResult
): Promise<void> {
  await recordChecks(db, [{ monitorId, checkedAt, result }]);
}

// Batched form of recordCheck for cron: combines the check-insert and
// rollup-upsert for every due monitor into a single db.batch() round-trip
// instead of one round-trip pair per monitor. Each D1 call has fixed
// Worker-side dispatch overhead regardless of how fast D1 itself answers, so
// on a tick with N due monitors this turns 2N dispatches into 1 — the
// dominant remaining lever for staying under the Workers Free plan's 10ms
// CPU-time budget once per-monitor waste was already eliminated.
export async function recordChecks(
  db: D1Database,
  entries: Array<{ monitorId: string; checkedAt: number; result: CheckResult }>
): Promise<void> {
  if (entries.length === 0) return;
  const statements = entries.flatMap(({ monitorId, checkedAt, result }) => {
    const bucketStart = Math.floor(checkedAt / UPTIME_BUCKET_SECONDS) * UPTIME_BUCKET_SECONDS;
    return [
      db
        .prepare(
          'INSERT INTO checks (monitor_id, status_code, ok, degraded, latency_ms, error, json_value) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(monitorId, result.status_code, result.ok ? 1 : 0, result.degraded ? 1 : 0, result.latency_ms, result.error, result.json_value ?? null),
      db
        .prepare(
          `INSERT INTO uptime_bucket_rollups (monitor_id, bucket_start, cnt, up_cnt, degraded_cnt)
           VALUES (?, ?, 1, ?, ?)
           ON CONFLICT(monitor_id, bucket_start) DO UPDATE SET
             cnt = cnt + 1,
             up_cnt = up_cnt + excluded.up_cnt,
             degraded_cnt = degraded_cnt + excluded.degraded_cnt`
        )
        .bind(monitorId, bucketStart, result.ok ? 1 : 0, result.degraded ? 1 : 0),
    ];
  });
  await db.batch(statements);
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

// Batched form of getOpenIncident for cron, which needs the open-incident
// state of every due monitor in the same tick. The app only ever creates a
// new incident when getOpenIncident found none, so at most one open row per
// monitor_id can exist — no need to dedupe/rank within the IN() result.
export async function getOpenIncidents(
  db: D1Database,
  monitorIds: string[]
): Promise<Map<string, Incident>> {
  if (monitorIds.length === 0) return new Map();
  const placeholders = monitorIds.map(() => '?').join(',');
  const r = await db
    .prepare(`SELECT * FROM incidents WHERE monitor_id IN (${placeholders}) AND resolved_at IS NULL`)
    .bind(...monitorIds)
    .all<Incident>();
  return new Map(r.results.map((i) => [i.monitor_id, i]));
}

export async function getIncidents(
  db: D1Database,
  monitorId: string,
  limit = 10,
  minDurationMinutes = 0
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
      FROM incidents i
      WHERE i.monitor_id = ?
        AND (i.resolved_at IS NULL OR (i.resolved_at - i.started_at) >= ?)
      ORDER BY i.started_at DESC LIMIT ?
    `)
    .bind(monitorId, minDurationMinutes * 60, limit)
    .all<Incident>();
  return r.results;
}

// Minimal incident spans (no display fields) for coloring the public uptime bar.
// Open incidents always qualify since their eventual duration isn't known yet.
export async function getIncidentSpans(
  db: D1Database,
  monitorId: string,
  since: number,
  minDurationMinutes = 0
): Promise<Array<{ started_at: number; resolved_at: number | null }>> {
  const r = await db
    .prepare(`
      SELECT started_at, resolved_at FROM incidents
      WHERE monitor_id = ?
        AND (resolved_at IS NULL OR resolved_at >= ?)
        AND (resolved_at IS NULL OR (resolved_at - started_at) >= ?)
      ORDER BY started_at ASC
    `)
    .bind(monitorId, since, minDurationMinutes * 60)
    .all<{ started_at: number; resolved_at: number | null }>();
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
  days: number,
  minDurationMinutes = 0
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
        AND (i.resolved_at IS NULL OR (i.resolved_at - i.started_at) >= ?)
      ORDER BY i.started_at DESC
    `)
    .bind(pageId, since, minDurationMinutes * 60)
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

// One row per active monitor with its most recent check timestamp (or null
// if it's never been checked yet), in a single round-trip regardless of
// monitor count. Backing query for the self-monitoring staleness check —
// idx_checks_monitor_checked(monitor_id, checked_at DESC) lets SQLite resolve
// MAX(checked_at) per group without a full table scan.
export async function getMonitorStaleness(
  db: D1Database
): Promise<Array<{ id: string; name: string; interval_minutes: number; last_checked_at: number | null }>> {
  const r = await db
    .prepare(
      `SELECT m.id, m.name, m.interval_minutes, MAX(c.checked_at) AS last_checked_at
       FROM monitors m
       LEFT JOIN checks c ON c.monitor_id = m.id
       WHERE m.active = 1
       GROUP BY m.id`
    )
    .all<{ id: string; name: string; interval_minutes: number; last_checked_at: number | null }>();
  return r.results;
}

export async function getWorkerHealthState(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare('SELECT unhealthy FROM worker_health WHERE id = 1')
    .first<{ unhealthy: number }>();
  return !!row?.unhealthy;
}

export async function setWorkerHealthState(db: D1Database, unhealthy: boolean): Promise<void> {
  await db
    .prepare('UPDATE worker_health SET unhealthy = ?, updated_at = ? WHERE id = 1')
    .bind(unhealthy ? 1 : 0, Math.floor(Date.now() / 1000))
    .run();
}

// Backed by uptime_bucket_rollups (see getUptimeBucketsAndSummary above)
// instead of a raw COUNT/SUM scan over checks — the admin dashboard's
// monitor list calls this once per monitor on every load, uncached (it's an
// authenticated route showing live data), so a raw 30-day scan here was the
// single largest source of D1 rows_read in production: ~44k rows per
// monitor per admin page load.
export async function getUptimePercent(
  db: D1Database,
  monitorId: string,
  days = 30
): Promise<number> {
  // Floor-aligned to the bucket grid so the bucket straddling the cutoff is
  // included rather than dropped — trades a few hours of extra history at
  // the edge for staying consistent with getUptimeBucketsAndSummary's cutoff.
  const since =
    Math.floor((Math.floor(Date.now() / 1000) - days * 86400) / UPTIME_BUCKET_SECONDS) *
    UPTIME_BUCKET_SECONDS;
  const row = await db
    .prepare(
      'SELECT SUM(cnt) as total, SUM(up_cnt) as up FROM uptime_bucket_rollups WHERE monitor_id = ? AND bucket_start >= ?'
    )
    .bind(monitorId, since)
    .first<{ total: number | null; up: number | null }>();
  if (!row || !row.total) return 100;
  return Math.round(((row.up ?? 0) / row.total) * 1000) / 10;
}
