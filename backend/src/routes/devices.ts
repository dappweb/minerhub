import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

export async function handleDevices(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    // 验证签名
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as
      | { userId?: string; deviceId?: string; hashrate?: number; wallet?: string }
      | null;

    if (!body?.userId || !body.deviceId || typeof body.hashrate !== "number") {
      return badRequest("userId, deviceId, hashrate are required");
    }

    // 验证用户钱包一致性（可选，增强安全）
    if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    const id = createId("dev");
    const now = nowIso();

    await env.DB.prepare(
      "INSERT INTO devices (id, user_id, device_id, hashrate, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, body.userId, body.deviceId, body.hashrate, "active", now, now)
      .run();

    return json({ id, userId: body.userId, deviceId: body.deviceId, hashrate: body.hashrate, status: "active" }, 201);
  }

  if (request.method === "GET" && pathParts.length === 1) {
    const userId = pathParts[0];
    const { results } = await env.DB.prepare(
      "SELECT id, user_id, device_id, hashrate, status, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all();

    return json({ items: results ?? [] });
  }

  return json({ error: "Unsupported devices route" }, 404);
}
