ALTER TABLE monitors ADD COLUMN last_checked_at INTEGER;

-- One-time backfill so existing monitors don't show as "never checked" right
-- after migrating — a correlated subquery here (not a JOIN+GROUP BY) is the
-- SQLite-recommended form for a per-row MAX() index lookup, and this only
-- ever runs once, not on a recurring cron tick.
UPDATE monitors SET last_checked_at = (
  SELECT MAX(c.checked_at) FROM checks c WHERE c.monitor_id = monitors.id
);
