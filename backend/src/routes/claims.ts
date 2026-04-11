import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import { extractAndVerifyAuth } from "../lib/auth";
import type { Env } from "../types/env";

export async function handleClaims(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    // 验证签名
    const authResult = await extractAndVerifyAuth(request);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { userId?: string; amount?: string; wallet?: string } | null;
    if (!body?.userId || !body.amount) return badRequest("userId and amount are required");

    // 验证用户钱包一致性
    if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    const id = createId("clm");
    const now = nowIso();

    await env.DB.prepare(
      "INSERT INTO claims (id, user_id, amount, status, tx_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, body.userId, body.amount, "pending", null, now, now)
      .run();

    return json({ id, userId: body.userId, amount: body.amount, status: "pending", createdAt: now }, 201);
  }

  if (request.method === "GET" && pathParts.length === 1) {
    const claimId = pathParts[0];
    const claim = await env.DB.prepare(
      "SELECT id, user_id, amount, status, tx_hash, created_at, updated_at FROM claims WHERE id = ?"
    )
      .bind(claimId)
      .first();

    if (!claim) return json({ error: "Claim not found" }, 404);
    return json(claim);
  }

  if (request.method === "GET" && pathParts.length === 2 && pathParts[0] === "user") {
    const userId = pathParts[1];
    const { results } = await env.DB.prepare(
      "SELECT id, user_id, amount, status, tx_hash, created_at, updated_at FROM claims WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all();

    return json({ items: results ?? [] });
  }

  return json({ error: "Unsupported claims route" }, 404);
}
