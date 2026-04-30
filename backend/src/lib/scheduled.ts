import type { Env } from "../types/env";
import { nowIso } from "./id";
import { autoReleaseMaturedLocks } from "./locks";

type ExpiredRow = { user_id: string };
type OfflineRow = {
  user_id: string;
  wallet: string | null;
  nickname: string | null;
  last_seen_at: string | null;
};
let scheduledProfileColumnsReady = false;

async function ensureScheduledProfileColumns(env: Env): Promise<void> {
  if (scheduledProfileColumnsReady) return;
  const info = await env.DB.prepare("PRAGMA table_info(customer_profiles)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((row) => row.name));
  if (!columns.has("monthly_card_end_at")) {
    await env.DB.prepare("ALTER TABLE customer_profiles ADD COLUMN monthly_card_end_at TEXT").run();
  }
  scheduledProfileColumnsReady = true;
}

const EFFECTIVE_CONTRACT_END_SQL = `CASE
  WHEN contract_end_at IS NULL THEN monthly_card_end_at
  WHEN monthly_card_end_at IS NULL THEN contract_end_at
  WHEN monthly_card_end_at > contract_end_at THEN monthly_card_end_at
  ELSE contract_end_at
END`;

/**
 * Expire contracts whose effective contract/monthly-card end time passed, and mark devices inactive.
 * Returns number of profiles updated.
 */
export async function expireOverdueContracts(env: Env): Promise<{ expired: number }> {
  await ensureScheduledProfileColumns(env);
  const now = nowIso();

  const { results: expiredProfiles } = await env.DB.prepare(
    `SELECT user_id FROM customer_profiles
     WHERE contract_active = 1
       AND ${EFFECTIVE_CONTRACT_END_SQL} IS NOT NULL
       AND ${EFFECTIVE_CONTRACT_END_SQL} < ?`
  )
    .bind(now)
    .all<ExpiredRow>();

  if (!expiredProfiles?.length) return { expired: 0 };

  const ids = expiredProfiles.map((row) => row.user_id);

  for (const userId of ids) {
    await env.DB.prepare(
      `UPDATE customer_profiles
       SET contract_active = 0,
           activation_status = 'expired',
           online_status = 'offline',
           updated_at = ?
       WHERE user_id = ?`
    )
      .bind(now, userId)
      .run();

    await env.DB.prepare(
      `UPDATE devices SET status = 'expired', updated_at = ? WHERE user_id = ? AND status = 'active'`
    )
      .bind(now, userId)
      .run();
  }

  return { expired: ids.length };
}

/**
 * Detect newly-offline customers (no heartbeat for > thresholdMinutes) and
 * fire-and-forget a webhook notification (if configured) once per offline event.
 */
export async function notifyOfflineCustomers(
  env: Env,
  thresholdMinutes = 15
): Promise<{ notified: number }> {
  const thresholdIso = new Date(Date.now() - thresholdMinutes * 60_000).toISOString();
  const now = nowIso();

  const { results } = await env.DB.prepare(
    `SELECT cp.user_id AS user_id, u.wallet AS wallet, cp.nickname AS nickname, cp.last_seen_at AS last_seen_at
     FROM customer_profiles cp
     LEFT JOIN users u ON u.id = cp.user_id
     WHERE cp.contract_active = 1
       AND cp.last_seen_at IS NOT NULL
       AND cp.last_seen_at < ?
       AND (cp.offline_alerted_at IS NULL OR cp.offline_alerted_at < cp.last_seen_at)`
  )
    .bind(thresholdIso)
    .all<OfflineRow>();

  const rows = results ?? [];
  if (!rows.length) return { notified: 0 };

  const webhook = (env as unknown as { ALERT_WEBHOOK_URL?: string }).ALERT_WEBHOOK_URL;

  for (const row of rows) {
    if (webhook) {
      try {
        await fetch(webhook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            event: "customer.offline",
            userId: row.user_id,
            wallet: row.wallet,
            nickname: row.nickname,
            lastSeenAt: row.last_seen_at,
            thresholdMinutes,
            detectedAt: now,
          }),
        });
      } catch {
        // swallow - scheduled task should not throw
      }
    }

    await env.DB.prepare(
      `UPDATE customer_profiles SET offline_alerted_at = ?, online_status = 'offline', updated_at = ? WHERE user_id = ?`
    )
      .bind(now, now, row.user_id)
      .run();
  }

  return { notified: rows.length };
}

/**
 * Clean up old historical records (device status history, reward ledger, operation logs).
 * Retains records from the last 90 days; removes older entries for database hygiene.
 * Returns number of records deleted across all tables.
 */
export async function cleanupOldHistoryRecords(env: Env, retentionDays = 90): Promise<{ deleted: number }> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  let totalDeleted = 0;

  // Clean device_status_history
  const deviceHistoryResult = await env.DB.prepare(
    `DELETE FROM device_status_history WHERE observed_at < ?`
  )
    .bind(cutoffDate)
    .run();
  totalDeleted += deviceHistoryResult.success ? (deviceHistoryResult.meta.changes ?? 0) : 0;

  // Clean reward_ledger
  const rewardLedgerResult = await env.DB.prepare(
    `DELETE FROM reward_ledger WHERE created_at < ?`
  )
    .bind(cutoffDate)
    .run();
  totalDeleted += rewardLedgerResult.success ? (rewardLedgerResult.meta.changes ?? 0) : 0;

  // Clean operation_logs (if exists)
  try {
    const opLogsResult = await env.DB.prepare(
      `DELETE FROM operation_logs WHERE created_at < ?`
    )
      .bind(cutoffDate)
      .run();
    totalDeleted += opLogsResult.success ? (opLogsResult.meta.changes ?? 0) : 0;
  } catch {
    // table may not exist, skip
  }

  return { deleted: totalDeleted };
}

export async function runScheduledTasks(env: Env): Promise<{
  expired: number;
  notified: number;
  releasedLocks: number;
  cleaned: number;
}> {
  const [expired, notified, released, cleanup] = await Promise.all([
    expireOverdueContracts(env),
    notifyOfflineCustomers(env),
    autoReleaseMaturedLocks(env),
    cleanupOldHistoryRecords(env),
  ]);
  return {
    expired: expired.expired,
    notified: notified.notified,
    releasedLocks: released.released,
    cleaned: cleanup.deleted,
  };
}
