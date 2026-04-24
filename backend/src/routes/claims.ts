import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { tryCreateRelayer } from "../lib/ownerRelayer";
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

async function assertUserOwnedByWallet(env: Env, userId: string, wallet: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND wallet = ?")
    .bind(userId, wallet.toLowerCase())
    .first<{ id: string }>();
  return Boolean(row?.id);
}

export async function handleClaims(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "reward-withdraw") {
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
      amountSuper?: string | number;
      note?: string;
    } | null;

    if (!body?.userId || !body.wallet || body.amountSuper === undefined) {
      return badRequest("userId, wallet, amountSuper are required");
    }
    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }
    if (!(await assertUserOwnedByWallet(env, body.userId, body.wallet))) {
      return unauthorized("User does not belong to signed wallet");
    }

    const amount = Number(body.amountSuper);
    if (!Number.isFinite(amount) || amount <= 0) {
      return badRequest("amountSuper must be a positive number");
    }

    await ensureCustomerProfile(env, body.userId);
    const profile = await env.DB.prepare(
      "SELECT total_reward_super FROM customer_profiles WHERE user_id = ?"
    )
      .bind(body.userId)
      .first<{ total_reward_super: string }>();

    const available = Number(profile?.total_reward_super ?? "0");
    if (!Number.isFinite(available) || available < amount) {
      return badRequest("Insufficient reward SUPER balance");
    }

    const relayer = tryCreateRelayer(env);
    if (!relayer) return json({ error: "OWNER_PRIVATE_KEY not configured" }, 500);

    const now = nowIso();
    const withdrawalId = createId("rwdw");
    try {
      const { txHash } = await relayer.transferSuper(body.wallet.toLowerCase(), amount.toString());

      await env.DB.prepare(
        `INSERT INTO reward_withdrawals (
          id, user_id, wallet, amount_super, tx_hash, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`
      )
        .bind(withdrawalId, body.userId, body.wallet.toLowerCase(), amount, txHash, body.note?.trim() || null, now, now)
        .run();

      await env.DB.prepare(
        `UPDATE customer_profiles
         SET total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) - ?, 6) AS TEXT),
             updated_at = ?
         WHERE user_id = ?`
      )
        .bind(amount, now, body.userId)
        .run();

      return json({ ok: true, id: withdrawalId, amountSuper: amount.toString(), txHash, status: "confirmed", createdAt: now }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "withdraw failed";
      await env.DB.prepare(
        `INSERT INTO reward_withdrawals (
          id, user_id, wallet, amount_super, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)`
      )
        .bind(withdrawalId, body.userId, body.wallet.toLowerCase(), amount, msg, now, now)
        .run();

      return json({ error: msg }, 500);
    }
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "exchange-request" && pathParts[1] === "list") {
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as {
      userId?: string;
      wallet?: string;
      limit?: number;
    } | null;

    if (!body?.userId || !body.wallet) {
      return badRequest("userId and wallet are required");
    }
    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    const limit = Math.min(50, Math.max(1, Number(body.limit ?? 10) || 10));

    const { results } = await env.DB.prepare(
      `SELECT
        id, user_id, wallet, amount_super, amount_usdt, mode, status,
        request_note, tx_hash, created_at, updated_at, completed_at
       FROM exchange_orders
       WHERE user_id = ? AND wallet = ?
       ORDER BY created_at DESC
       LIMIT ?`
    )
      .bind(body.userId, body.wallet.toLowerCase(), limit)
      .all<{
        id: string;
        user_id: string;
        wallet: string;
        amount_super: string;
        amount_usdt: string;
        mode: string;
        status: string;
        request_note: string | null;
        tx_hash: string | null;
        created_at: string;
        updated_at: string;
        completed_at: string | null;
      }>();

    return json({
      items: (results ?? []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        wallet: row.wallet,
        amountSuper: row.amount_super,
        amountUsdt: row.amount_usdt,
        mode: row.mode,
        status: row.status,
        note: row.request_note,
        txHash: row.tx_hash,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
      })),
    });
  }

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
    // 已废弃：旧版 /api/claims 会错误地把 amount 累加到 total_reward_usdt，
    // 现行流程请使用 /api/claims/reward-withdraw（SUPER 提现）或
    // /api/claims/exchange-request（SUPER→USDT 兑换）。
    return json({
      error: "Deprecated endpoint. Use /api/claims/reward-withdraw or /api/claims/exchange-request instead.",
      code: "CLAIMS_LEGACY_DEPRECATED",
    }, 410);
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
