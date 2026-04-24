import type { Env } from "../types/env";
import { nowIso } from "./id";

type LockRow = {
  id: string;
  lock_term_days: number;
};

function addDaysIso(baseIso: string, days: number): string {
  const base = new Date(baseIso).getTime();
  const ms = Math.max(1, Math.floor(days)) * 24 * 60 * 60 * 1000;
  return new Date(base + ms).toISOString();
}

export async function hasActiveLock(env: Env, userId: string, atIso = nowIso()): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT id FROM token_locks
     WHERE user_id = ?
       AND status = 'active'
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND start_at <= ? AND end_at > ?
       AND CAST(locked_super AS REAL) > CAST(released_super AS REAL)
     LIMIT 1`
  )
    .bind(userId, atIso, atIso)
    .first<{ id: string }>();

  return Boolean(row?.id);
}

export async function refreshUserContractStateFromLocks(env: Env, userId: string, atIso = nowIso()): Promise<void> {
  const active = await env.DB.prepare(
    `SELECT
       MIN(start_at) AS min_start,
       MAX(end_at) AS max_end,
       MAX(lock_term_days) AS max_days,
       COUNT(*) AS c
     FROM token_locks
     WHERE user_id = ?
       AND status = 'active'
       AND start_at IS NOT NULL
       AND end_at IS NOT NULL
       AND end_at > ?
       AND CAST(locked_super AS REAL) > CAST(released_super AS REAL)`
  )
    .bind(userId, atIso)
    .first<{ min_start: string | null; max_end: string | null; max_days: number | null; c: number }>();

  const count = Number(active?.c ?? 0);
  if (count > 0) {
    await env.DB.prepare(
      `UPDATE customer_profiles
       SET contract_active = 1,
           activation_status = 'active',
           contract_start_at = COALESCE(?, contract_start_at),
           contract_end_at = COALESCE(?, contract_end_at),
           contract_term_days = COALESCE(?, contract_term_days),
           updated_at = ?
       WHERE user_id = ?`
    )
      .bind(active?.min_start ?? atIso, active?.max_end ?? atIso, active?.max_days ?? null, atIso, userId)
      .run();
    return;
  }

  await env.DB.prepare(
    `UPDATE customer_profiles
     SET contract_active = 0,
         activation_status = CASE WHEN activation_status = 'active' THEN 'expired' ELSE activation_status END,
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(atIso, userId)
    .run();
}

export async function activatePendingLocksOnAgreement(
  env: Env,
  userId: string,
  agreementVersion: string,
  acceptedAt = nowIso()
): Promise<{ activated: number }> {
  const { results } = await env.DB.prepare(
    `SELECT id, lock_term_days
     FROM token_locks
     WHERE user_id = ? AND status = 'pending_agreement'`
  )
    .bind(userId)
    .all<LockRow>();

  const rows = results ?? [];
  if (!rows.length) {
    return { activated: 0 };
  }

  for (const row of rows) {
    const days = Math.max(1, Number(row.lock_term_days ?? 1));
    const endAt = addDaysIso(acceptedAt, days);
    await env.DB.prepare(
      `UPDATE token_locks
       SET status = 'active',
           start_at = ?,
           end_at = ?,
           agreement_version = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(acceptedAt, endAt, agreementVersion, acceptedAt, row.id)
      .run();
  }

  await refreshUserContractStateFromLocks(env, userId, acceptedAt);
  return { activated: rows.length };
}

export async function autoReleaseMaturedLocks(env: Env, atIso = nowIso()): Promise<{ released: number }> {
  const { results } = await env.DB.prepare(
    `SELECT id, user_id
     FROM token_locks
     WHERE status = 'active'
       AND end_at IS NOT NULL
       AND end_at <= ?`
  )
    .bind(atIso)
    .all<{ id: string; user_id: string }>();

  const rows = results ?? [];
  if (!rows.length) return { released: 0 };

  for (const row of rows) {
    await env.DB.prepare(
      `UPDATE token_locks
       SET status = 'released',
           released_super = locked_super,
           released_at = ?,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(atIso, atIso, row.id)
      .run();
  }

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  for (const userId of userIds) {
    await refreshUserContractStateFromLocks(env, userId, atIso);
  }

  return { released: rows.length };
}
