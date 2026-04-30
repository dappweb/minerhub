-- Clean dirty operational data.
-- Run dirty-data-audit.sql first. This file mutates data.
--
-- Policy:
-- - Remove heartbeat reward rows whose accrued interval is invalid or > 90 seconds.
-- - Recompute customer reward totals from remaining ledger rows.
-- - Mark stale online profiles/devices offline/inactive after 15 minutes without heartbeat.
-- - Expire active profiles whose effective contract/monthly-card end time has passed.
-- - Backfill heartbeat bookkeeping fields from last_seen_at when missing.

BEGIN TRANSACTION;

DELETE FROM reward_ledger
WHERE source = 'heartbeat'
  AND (
    accrued_from IS NULL
    OR accrued_to IS NULL
    OR ((julianday(accrued_to) - julianday(accrued_from)) * 86400.0) <= 0
    OR ((julianday(accrued_to) - julianday(accrued_from)) * 86400.0) > 90
  );

UPDATE customer_profiles
SET
  total_reward_usdt = COALESCE((
    SELECT CAST(ROUND(SUM(CAST(reward_usdt AS REAL)), 6) AS TEXT)
    FROM reward_ledger
    WHERE reward_ledger.user_id = customer_profiles.user_id
  ), '0'),
  total_reward_super = COALESCE((
    SELECT CAST(ROUND(SUM(CAST(reward_super AS REAL)), 6) AS TEXT)
    FROM reward_ledger
    WHERE reward_ledger.user_id = customer_profiles.user_id
  ), '0'),
  updated_at = datetime('now');

UPDATE customer_profiles
SET
  online_status = 'offline',
  offline_alerted_at = COALESCE(offline_alerted_at, datetime('now')),
  updated_at = datetime('now')
WHERE online_status = 'online'
  AND last_seen_at IS NOT NULL
  AND last_seen_at < datetime('now', '-15 minutes');

UPDATE devices
SET
  status = CASE WHEN status = 'active' THEN 'inactive' ELSE status END,
  updated_at = datetime('now')
WHERE user_id IN (
  SELECT user_id
  FROM customer_profiles
  WHERE online_status = 'offline'
    AND last_seen_at IS NOT NULL
    AND last_seen_at < datetime('now', '-15 minutes')
);

UPDATE customer_profiles
SET
  contract_active = 0,
  activation_status = 'expired',
  online_status = 'offline',
  updated_at = datetime('now')
WHERE contract_active = 1
  AND (
    CASE
      WHEN contract_end_at IS NULL THEN monthly_card_end_at
      WHEN monthly_card_end_at IS NULL THEN contract_end_at
      WHEN monthly_card_end_at > contract_end_at THEN monthly_card_end_at
      ELSE contract_end_at
    END
  ) IS NOT NULL
  AND (
    CASE
      WHEN contract_end_at IS NULL THEN monthly_card_end_at
      WHEN monthly_card_end_at IS NULL THEN contract_end_at
      WHEN monthly_card_end_at > contract_end_at THEN monthly_card_end_at
      ELSE contract_end_at
    END
  ) < datetime('now');

UPDATE devices
SET
  status = CASE WHEN status = 'active' THEN 'expired' ELSE status END,
  updated_at = datetime('now')
WHERE user_id IN (
  SELECT user_id
  FROM customer_profiles
  WHERE contract_active = 0
    AND activation_status = 'expired'
);

UPDATE customer_profiles
SET
  last_heartbeat_at = COALESCE(last_heartbeat_at, last_seen_at),
  last_reward_accrued_at = COALESCE(last_reward_accrued_at, last_seen_at),
  updated_at = datetime('now')
WHERE last_seen_at IS NOT NULL;

COMMIT;
