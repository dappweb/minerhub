import type { Env } from "../types/env";
import { nowIso } from "./id";

const RESERVED_EXCHANGE_STATUSES = [
  "manual_pending",
  "auto_processing",
  "approved",
  "completed",
  "payout_queued",
  "paid",
];

function round6(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.max(0, Number(value.toFixed(6))).toString();
}

export async function reconcileUserRewardTotals(
  env: Env,
  userId: string,
  atIso = nowIso(),
): Promise<{ totalRewardUsdt: string; totalRewardSuper: string }> {
  const earned = await env.DB.prepare(
    `SELECT
       COUNT(*) AS ledger_count,
       COALESCE(SUM(CAST(reward_usdt AS REAL)), 0) AS total_usdt,
       COALESCE(SUM(CAST(reward_super AS REAL)), 0) AS total_super
     FROM reward_ledger
     WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ ledger_count: number; total_usdt: number; total_super: number }>();

  if (Number(earned?.ledger_count ?? 0) === 0) {
    const current = await env.DB.prepare(
      `SELECT
         COALESCE(total_reward_usdt, '0') AS total_reward_usdt,
         COALESCE(total_reward_super, '0') AS total_reward_super
       FROM customer_profiles
       WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ total_reward_usdt: string; total_reward_super: string }>();

    return {
      totalRewardUsdt: current?.total_reward_usdt ?? "0",
      totalRewardSuper: current?.total_reward_super ?? "0",
    };
  }

  const withdrawn = await env.DB.prepare(
    `SELECT COALESCE(SUM(amount_super), 0) AS amount_super
     FROM reward_withdrawals
     WHERE user_id = ? AND status = 'confirmed'`
  )
    .bind(userId)
    .first<{ amount_super: number }>();

  const statusPlaceholders = RESERVED_EXCHANGE_STATUSES.map(() => "?").join(", ");
  const exchanged = await env.DB.prepare(
    `SELECT COALESCE(SUM(CAST(amount_super AS REAL)), 0) AS amount_super
     FROM exchange_orders
     WHERE user_id = ? AND status IN (${statusPlaceholders})`
  )
    .bind(userId, ...RESERVED_EXCHANGE_STATUSES)
    .first<{ amount_super: number }>();

  const totalRewardUsdt = round6(Number(earned?.total_usdt ?? 0));
  const totalRewardSuper = round6(
    Number(earned?.total_super ?? 0)
      - Number(withdrawn?.amount_super ?? 0)
      - Number(exchanged?.amount_super ?? 0),
  );

  await env.DB.prepare(
    `UPDATE customer_profiles
     SET total_reward_usdt = ?,
         total_reward_super = ?,
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(totalRewardUsdt, totalRewardSuper, atIso, userId)
    .run();

  return { totalRewardUsdt, totalRewardSuper };
}
