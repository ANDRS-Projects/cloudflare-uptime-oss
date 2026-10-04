ALTER TABLE monitors ADD COLUMN monitor_type TEXT NOT NULL DEFAULT 'http';
ALTER TABLE monitors ADD COLUMN keyword TEXT;
ALTER TABLE monitors ADD COLUMN manual_status TEXT;
ALTER TABLE monitors ADD COLUMN grace_period_minutes INTEGER NOT NULL DEFAULT 5;
ALTER TABLE monitors ADD COLUMN push_token TEXT;
ALTER TABLE monitors ADD COLUMN last_heartbeat_at INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitors_push_token ON monitors(push_token);
