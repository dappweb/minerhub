import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

export async function handleUsers(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    // 验证签名
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { wallet?: string; email?: string } | null;
    if (!body?.wallet) return badRequest("wallet is required");

    // 检查请求中的wallet与签名wallet是否一致
    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch: body wallet must match signed wallet");
    }

    const id = createId("usr");
    const now = nowIso();
    await env.DB.prepare(
      "INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(id, body.wallet.toLowerCase(), body.email ?? null, now, now)
      .run();

    return json({ id, wallet: body.wallet.toLowerCase(), email: body.email ?? null, createdAt: now }, 201);
  }

  if (request.method === "GET" && pathParts.length === 1) {
    const userId = pathParts[0];
    const user = await env.DB.prepare("SELECT id, wallet, email, role, created_at, updated_at FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!user) return json({ error: "User not found" }, 404);
    return json(user);
  }

  // GET /api/users?wallet=0x... — look up user by wallet address (for app re-install recovery)
  if (request.method === "GET" && pathParts.length === 0) {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet) return json({ error: "wallet query param is required" }, 400);
    const user = await env.DB.prepare("SELECT id, wallet, email, role, created_at, updated_at FROM users WHERE wallet = ?")
      .bind(wallet.toLowerCase())
      .first();
    if (!user) return json({ error: "User not found" }, 404);
    return json(user);
  }

  return json({ error: "Unsupported users route" }, 404);
}
