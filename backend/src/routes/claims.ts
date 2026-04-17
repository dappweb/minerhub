import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import { isExchangeAutoEnabled, isMaintenanceEnabled } from "../lib/system";
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

export async function handleClaims(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "exchange-request") {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      wallet?: string;
      amountSuper?: string;
      amountUsdt?: string;
      note?: string;
    } | null;

    if (!body?.userId || !body.wallet) {
      return badRequest("userId and wallet are required");
    }
    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    const amountSuper = Number(body.amountSuper ?? "0");
    const amountUsdt = Number(body.amountUsdt ?? "0");
    if (!Number.isFinite(amountSuper) || amountSuper <= 0) {
      return badRequest("amountSuper must be a positive number");
    }

    await ensureCustomerProfile(env, body.userId);
    const profile = await env.DB.prepare(
      "SELECT exchange_auto_enabled FROM customer_profiles WHERE user_id = ?"
    )
      .bind(body.userId)
      .first<{ exchange_auto_enabled: number }>();

    const globalAuto = await isExchangeAutoEnabled(env);
    const userAuto = Number(profile?.exchange_auto_enabled ?? 1) === 1;
    const autoEnabled = globalAuto && userAuto;
    const mode = autoEnabled ? "auto" : "manual";
    const status = autoEnabled ? "auto_processing" : "manual_pending";

    const now = nowIso();
    const exchangeId = createId("exr");
    await env.DB.prepare(
      `INSERT INTO exchange_orders (
        id, user_id, wallet, amount_super, amount_usdt, mode, status,
        request_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        exchangeId,
        body.userId,
        body.wallet.toLowerCase(),
        amountSuper.toString(),
        Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0",
        mode,
        status,
        body.note?.trim() || null,
        now,
        now,
      )
      .run();

    await env.DB.prepare(
      `INSERT INTO swap_trade_logs (
        id, user_id, wallet, direction, amount_in, amount_out,
        price_snapshot, status, note, created_at, updated_at
      ) VALUES (?, ?, ?, 'SUPER_TO_USDT', ?, ?, '0', ?, ?, ?, ?)`
    )
      .bind(
        createId("swl"),
        body.userId,
        body.wallet.toLowerCase(),
        amountSuper.toString(),
        Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0",
        status,
        autoEnabled ? "auto exchange request" : "manual exchange request",
        now,
        now,
      )
      .run();

    return json({
      id: exchangeId,
      mode,
      status,
      autoEnabled,
      amountSuper: amountSuper.toString(),
      amountUsdt: Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0",
      createdAt: now,
    }, 201);
  }

  if (request.method === "POST" && pathParts.length === 0) {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

    // 验证签名
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { userId?: string; amount?: string; wallet?: string } | null;
    if (!body?.userId || !body.amount) return badRequest("userId and amount are required");

    // 验证用户钱包一致性
    if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    await ensureCustomerProfile(env, body.userId);
    const profile = await env.DB.prepare(
      "SELECT contract_active, contract_end_at, total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id = ?"
    )
      .bind(body.userId)
      .first<{ contract_active: number; contract_end_at: string | null; total_reward_usdt: string; total_reward_super: string }>();

    if (!profile || Number(profile.contract_active ?? 0) !== 1) {
      return badRequest("Contract is not active");
    }

    if (profile.contract_end_at && new Date(profile.contract_end_at).getTime() < Date.now()) {
      return badRequest("Contract has expired");
    }

    const claimAmount = Number(body.amount);
    if (!Number.isFinite(claimAmount) || claimAmount <= 0) {
      return badRequest("amount must be a positive number");
    }

    const id = createId("clm");
    const now = nowIso();

    await env.DB.prepare(
      "INSERT INTO claims (id, user_id, amount, status, tx_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, body.userId, body.amount, "pending", null, now, now)
      .run();

    const nextTotal = (Number(profile.total_reward_usdt ?? "0") + claimAmount).toFixed(6);
    await env.DB.prepare("UPDATE customer_profiles SET total_reward_usdt = ?, updated_at = ? WHERE user_id = ?")
      .bind(nextTotal, now, body.userId)
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
