ALTER TABLE monitors ADD COLUMN monitor_type TEXT NOT NULL DEFAULT 'http';
ALTER TABLE monitors ADD COLUMN last_heartbeat_at INTEGER;