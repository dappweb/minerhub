import type { Env } from "../types/env";
import { nowIso } from "./id";

type ExpiredRow = { user_id: string };
type OfflineRow = {
  user_id: string;
  wallet: string | null;
  nickname: string | null;
  last_seen_at: string | null;
};

/**
 * Expire contracts whose contract_end_at passed, and mark devices inactive.
 * Returns number of profiles updated.
 */
export async function expireOverdueContracts(env: Env): Promise<{ expired: number }> {
  const now = nowIso();

  const { results: expiredProfiles } = await env.DB.prepare(
    `SELECT user_id FROM customer_profiles
     WHERE contract_active = 1 AND contract_end_at IS NOT NULL AND contract_end_at < ?`
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

export async function runScheduledTasks(env: Env): Promise<{
  expired: number;
  notified: number;
}> {
  const [expired, notified] = await Promise.all([
    expireOverdueContracts(env),
    notifyOfflineCustomers(env),
  ]);
  return { expired: expired.expired, notified: notified.notified };
}
