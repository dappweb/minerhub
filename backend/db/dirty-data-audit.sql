-- Audit dirty operational data. This file is read-only.
-- Policy:
-- - Heartbeat reward rows are dirty if the accrued interval is invalid or > 90 seconds.
-- - Online profiles are stale if last_seen_at is older than 15 minutes.
-- - Active contracts are dirty if contract_end_at is already in the past.

SELECT
  COUNT(*) AS dirty_heartbeat_reward_rows,
  COALESCE(ROUND(SUM(CAST(reward_usdt AS REAL)), 6), 0) AS dirty_reward_usdt,
  COALESCE(ROUND(SUM(CAST(reward_super AS REAL)), 6), 0) AS dirty_reward_super
FROM reward_ledger
WHERE source = 'heartbeat'
  AND (
    accrued_from IS NULL
    OR accrued_to IS NULL
    OR ((julianday(accrued_to) - julianday(accrued_from)) * 86400.0) <= 0
    OR ((julianday(accrued_to) - julianday(accrued_from)) * 86400.0) > 90
  );

SELECT
  COUNT(*) AS stale_online_profiles
FROM customer_profiles
WHERE online_status = 'online'
  AND last_seen_at IS NOT NULL
  AND last_seen_at < datetime('now', '-15 minutes');

SELECT
  COUNT(*) AS expired_active_profiles
FROM customer_profiles
WHERE contract_active = 1
  AND contract_end_at IS NOT NULL
  AND contract_end_at < datetime('now');

SELECT
  COUNT(*) AS orphan_profiles
FROM customer_profiles cp
LEFT JOIN users u ON u.id = cp.user_id
WHERE u.id IS NULL;

SELECT
  COUNT(*) AS orphan_devices
FROM devices d
LEFT JOIN users u ON u.id = d.user_id
WHERE u.id IS NULL;

SELECT
  COUNT(*) AS orphan_rewards
FROM reward_ledger r
LEFT JOIN users u ON u.id = r.user_id
WHERE u.id IS NULL;
