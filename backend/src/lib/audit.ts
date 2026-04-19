import type { Env } from "../types/env";
import { createId, nowIso } from "./id";

export type OwnerAuditEntry = {
  action: string;
  actorWallet: string;
  targetUserId?: string | null;
  targetWallet?: string | null;
  payload?: Record<string, unknown> | null;
  txHash?: string | null;
  status?: "ok" | "failed";
  error?: string | null;
  request?: Request;
};

export async function writeOwnerAudit(env: Env, entry: OwnerAuditEntry): Promise<string> {
  const id = createId("aud");
  const now = nowIso();
  const ip = entry.request?.headers.get("cf-connecting-ip") || entry.request?.headers.get("x-forwarded-for") || null;
  const ua = entry.request?.headers.get("user-agent") || null;

  try {
    await env.DB.prepare(
      `INSERT INTO owner_audit_logs (
        id, actor_wallet, action, target_user_id, target_wallet, payload_json,
        tx_hash, status, error_message, ip, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        entry.actorWallet.toLowerCase(),
        entry.action,
        entry.targetUserId ?? null,
        entry.targetWallet ? entry.targetWallet.toLowerCase() : null,
        entry.payload ? JSON.stringify(entry.payload) : null,
        entry.txHash ?? null,
        entry.status ?? "ok",
        entry.error ?? null,
        ip,
        ua,
        now
      )
      .run();
  } catch (err) {
    // never let audit failure break the primary operation
    console.warn("owner audit write failed", err);
  }
  return id;
}
