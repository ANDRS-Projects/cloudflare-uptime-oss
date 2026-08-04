CREATE TABLE IF NOT EXISTS worker_health (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  unhealthy INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER
);
INSERT OR IGNORE INTO worker_health (id, unhealthy) VALUES (1, 0);
