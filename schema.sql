CREATE TABLE IF NOT EXISTS monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  interval_minutes INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL DEFAULT 10000,
  alert_webhook TEXT,
  expected_status_code INTEGER,
  retry_count INTEGER DEFAULT 2,
  json_path TEXT,
  json_status_map TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status_code INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL,
  degraded INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  error TEXT,
  json_value TEXT,
  checked_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked ON checks(monitor_id, checked_at DESC);

-- Incrementally maintained by cron.ts on every check insert: one row per
-- monitor per fixed 8-hour epoch-aligned window. The public status page and
-- the admin dashboard's uptime% both read only this table, instead of
-- scanning the full checks table (which can be tens of thousands of rows per
-- monitor over 30 days) on every request.
CREATE TABLE IF NOT EXISTS uptime_bucket_rollups (
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  bucket_start INTEGER NOT NULL,
  cnt INTEGER NOT NULL DEFAULT 0,
  up_cnt INTEGER NOT NULL DEFAULT 0,
  degraded_cnt INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (monitor_id, bucket_start)
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at INTEGER NOT NULL,
  resolved_at INTEGER,
  trigger_status_code INTEGER,
  trigger_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id, started_at DESC);

CREATE TABLE IF NOT EXISTS status_pages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  custom_domain TEXT UNIQUE,
  logo_url TEXT,
  incident_history_days INTEGER NOT NULL DEFAULT 30,
  min_incident_duration_minutes INTEGER NOT NULL DEFAULT 0,
  header_template TEXT NOT NULL DEFAULT 'centered',
  brand_color TEXT,
  show_latency INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS status_page_monitors (
  status_page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (status_page_id, monitor_id)
);

CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  status_page_id TEXT NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_notices_page ON notices(status_page_id, created_at DESC);

-- Singleton row tracking whether the self-monitoring health check currently
-- considers the Worker unhealthy (checks not landing on schedule). Read and
-- written by the separate */15 cron tick in health.ts, kept apart from the
-- monitors/checks tables so it never touches the 1-minute check loop.
CREATE TABLE IF NOT EXISTS worker_health (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  unhealthy INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
INSERT OR IGNORE INTO worker_health (id, unhealthy) VALUES (1, 0);
