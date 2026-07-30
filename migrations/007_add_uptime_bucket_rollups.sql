CREATE TABLE IF NOT EXISTS uptime_bucket_rollups (
  monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  bucket_start INTEGER NOT NULL,
  cnt INTEGER NOT NULL DEFAULT 0,
  up_cnt INTEGER NOT NULL DEFAULT 0,
  degraded_cnt INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (monitor_id, bucket_start)
);

-- Backfill from existing checks so the uptime bar and uptime% don't show a
-- gap for the 30 days before this table existed. Safe to re-run.
INSERT INTO uptime_bucket_rollups (monitor_id, bucket_start, cnt, up_cnt, degraded_cnt)
SELECT
  monitor_id,
  (checked_at / 28800) * 28800 AS bucket_start,
  COUNT(*) AS cnt,
  SUM(CASE WHEN ok = 1 THEN 1 ELSE 0 END) AS up_cnt,
  SUM(CASE WHEN degraded = 1 THEN 1 ELSE 0 END) AS degraded_cnt
FROM checks
GROUP BY monitor_id, bucket_start
ON CONFLICT(monitor_id, bucket_start) DO NOTHING;
