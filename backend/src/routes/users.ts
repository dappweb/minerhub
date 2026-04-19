import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import { isMaintenanceEnabled } from "../lib/system";
import type { Env } from "../types/env";

async function ensureCustomerProfile(env: Env, userId: string): Promise<void> {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO customer_profiles (
      user_id, contract_term_days, monthly_card_days, contract_active,
      activation_status, exchange_auto_enabled, payout_wallets_json,
      reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super,
      online_status, created_at, updated_at
    ) VALUES (?, 1095, 30, 0, 'pending', 1, '[]', '0.084', '0', '0', 'offline', ?, ?)`
  )
    .bind(userId, now, now)
    .run();
}

export async function handleUsers(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

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

    await ensureCustomerProfile(env, id);

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

  if (request.method === "GET" && pathParts.length === 2 && pathParts[1] === "details") {
    const userId = pathParts[0];
    await ensureCustomerProfile(env, userId);

    const user = await env.DB.prepare(
      `SELECT
        u.id, u.wallet, u.email, u.role, u.status, u.created_at, u.updated_at,
        cp.nickname, cp.machine_code AS machineCode, cp.parent_user_id AS parentUserId, cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
        COALESCE(cp.contract_term_days, 1095) AS contract_term_days,
        COALESCE(cp.monthly_card_days, 30) AS monthly_card_days,
        COALESCE(cp.contract_active, 0) AS contract_active,
        COALESCE(cp.activation_status, 'pending') AS activation_status,
        COALESCE(cp.exchange_auto_enabled, 1) AS exchange_auto_enabled,
        COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS reward_rate_usdt_per_hour,
        COALESCE(cp.total_reward_usdt, '0') AS total_reward_usdt,
        COALESCE(cp.total_reward_super, '0') AS total_reward_super,
        cp.last_seen_at, COALESCE(cp.online_status, 'offline') AS online_status,
        cp.agreement_accepted_at, cp.offline_alerted_at, cp.notes
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.id = ?`
    )
      .bind(userId)
      .first();

    if (!user) return json({ error: "User not found" }, 404);

    const devices = await env.DB.prepare(
      "SELECT id, device_id, hashrate, status, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all();

    const rewards = await env.DB.prepare(
      "SELECT id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at FROM reward_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    )
      .bind(userId)
      .all();

    const wallets = await env.DB.prepare(
      "SELECT wallet_address, priority, is_primary FROM payout_wallets WHERE user_id = ? ORDER BY priority ASC, created_at ASC"
    )
      .bind(userId)
      .all();

    const acceptance = await env.DB.prepare(
      "SELECT version, accepted_at FROM user_agreement_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1"
    )
      .bind(userId)
      .first<{ version: string; accepted_at: string }>();

    return json({
      ...user,
      devices: devices.results ?? [],
      rewards: rewards.results ?? [],
      payoutWallets: wallets.results ?? [],
      agreementAcceptedVersion: acceptance?.version ?? null,
      agreementAcceptedAt: acceptance?.accepted_at ?? (user as { agreement_accepted_at?: string | null }).agreement_accepted_at ?? null,
    });
  }

  // POST /api/users/:id/agreement — record user's agreement acceptance
  if (request.method === "POST" && pathParts.length === 2 && pathParts[1] === "agreement") {
    const userId = pathParts[0];
    const body = (await request.json().catch(() => null)) as { version?: string; wallet?: string } | null;
    if (!body?.version || typeof body.version !== "string") {
      return badRequest("version is required");
    }

    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const user = await env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; wallet: string }>();
    if (!user) return json({ error: "User not found" }, 404);

    if (authResult.wallet && user.wallet && authResult.wallet.toLowerCase() !== user.wallet.toLowerCase()) {
      return unauthorized("Wallet does not match user");
    }

    await ensureCustomerProfile(env, userId);

    const now = nowIso();
    const version = body.version.trim();
    await env.DB.prepare(
      `INSERT INTO user_agreement_acceptances (user_id, version, accepted_at, wallet)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, version) DO UPDATE SET accepted_at = excluded.accepted_at, wallet = excluded.wallet`
    )
      .bind(userId, version, now, authResult.wallet ?? user.wallet ?? null)
      .run();

    await env.DB.prepare(
      "UPDATE customer_profiles SET agreement_accepted_at = ?, updated_at = ? WHERE user_id = ?"
    )
      .bind(now, now, userId)
      .run();

    return json({ ok: true, version, acceptedAt: now });
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
