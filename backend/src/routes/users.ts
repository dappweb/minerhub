import { createId, nowIso } from "../lib/id";
import { badRequest, json } from "../lib/response";
import type { Env } from "../types/env";

export async function handleUsers(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    const body = (await request.json().catch(() => null)) as { wallet?: string; email?: string } | null;
    if (!body?.wallet) return badRequest("wallet is required");

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

  return json({ error: "Unsupported users route" }, 404);
}
