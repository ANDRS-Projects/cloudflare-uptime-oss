-- The daily retention cleanup in cron.ts (DELETE FROM checks WHERE checked_at < ?)
-- can't use idx_checks_monitor_checked because monitor_id is its leading column,
-- so it scanned the entire checks table every night. This index lets it seek
-- straight to the expired rows.
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
