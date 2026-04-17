import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import { getRewardRateUsdtPerHour, isMaintenanceEnabled } from "../lib/system";
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

async function accrueHourlyReward(env: Env, userId: string, deviceId: string): Promise<void> {
  const device = await env.DB.prepare(
    `SELECT id, hashrate, updated_at FROM devices WHERE user_id = ? AND device_id = ?`
  )
    .bind(userId, deviceId)
    .first<{ id: string; hashrate: number; updated_at: string }>();

  if (!device) return;

  const profile = await env.DB.prepare(
    `SELECT contract_active, contract_end_at, reward_rate_usdt_per_hour, total_reward_usdt FROM customer_profiles WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ contract_active: number; contract_end_at: string | null; reward_rate_usdt_per_hour: string | null; total_reward_usdt: string | null }>();

  if (!profile || Number(profile.contract_active ?? 0) !== 1) return;
  if (profile.contract_end_at && new Date(profile.contract_end_at).getTime() < Date.now()) return;

  const lastAt = new Date(device.updated_at).getTime();
  const now = Date.now();
  const elapsedHours = Math.max(0, (now - lastAt) / 3_600_000);
  if (elapsedHours <= 0) return;

  const rate = Number(profile.reward_rate_usdt_per_hour ?? await getRewardRateUsdtPerHour(env));
  const hashrateFactor = Math.max(1, Number(device.hashrate ?? 0) / 1000);
  const rewardUsdt = elapsedHours * rate * hashrateFactor;
  if (!Number.isFinite(rewardUsdt) || rewardUsdt <= 0) return;

  const nowIsoValue = new Date(now).toISOString();
  await env.DB.prepare(
    `INSERT INTO reward_ledger (
      id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
      accrued_from, accrued_to, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, '0', ?, ?, ?, 'heartbeat', ?, ?, ?)`
  )
    .bind(
      createId("rwd"),
      userId,
      deviceId,
      rewardUsdt.toFixed(6),
      String(rate),
      device.updated_at,
      nowIsoValue,
      `hourly reward from device heartbeat (hashrate=${device.hashrate})`,
      nowIsoValue,
      nowIsoValue,
    )
    .run();

  const nextTotal = (Number(profile.total_reward_usdt ?? "0") + rewardUsdt).toFixed(6);
  await env.DB.prepare(
    `UPDATE customer_profiles SET total_reward_usdt = ?, last_seen_at = ?, online_status = 'online', updated_at = ? WHERE user_id = ?`
  )
    .bind(nextTotal, nowIsoValue, nowIsoValue, userId)
    .run();

  await env.DB.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
    .bind(nowIsoValue, device.id)
    .run();

  await env.DB.prepare(
    `INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(createId("dst"), deviceId, userId, Number(device.hashrate ?? 0), nowIsoValue, "heartbeat")
    .run();
}

export async function handleDevices(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

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

    await ensureCustomerProfile(env, body.userId);
    await env.DB.prepare(
      `INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`
    )
      .bind(createId("dst"), body.deviceId, body.userId, body.hashrate, now, "register")
      .run();

    await env.DB.prepare(
      `UPDATE customer_profiles SET last_seen_at = ?, online_status = 'online', updated_at = ? WHERE user_id = ?`
    )
      .bind(now, now, body.userId)
      .run();

    return json({ id, userId: body.userId, deviceId: body.deviceId, hashrate: body.hashrate, status: "active" }, 201);
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[1] === "heartbeat") {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const deviceId = pathParts[0];
    const body = (await request.json().catch(() => null)) as { userId?: string; wallet?: string; status?: string; hashrate?: number } | null;
    if (!body?.userId) return badRequest("userId is required");
    if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch");
    }

    await ensureCustomerProfile(env, body.userId);
    await accrueHourlyReward(env, body.userId, deviceId);

    if (typeof body.status === "string" || typeof body.hashrate === "number") {
      const now = nowIso();
      const current = await env.DB.prepare("SELECT id FROM devices WHERE user_id = ? AND device_id = ?")
        .bind(body.userId, deviceId)
        .first<{ id: string }>();

      if (current) {
        const parts: string[] = [];
        const values: unknown[] = [];
        if (typeof body.status === "string") {
          parts.push("status = ?");
          values.push(body.status);
        }
        if (typeof body.hashrate === "number" && Number.isFinite(body.hashrate)) {
          parts.push("hashrate = ?");
          values.push(Math.max(0, Math.floor(body.hashrate)));
        }
        parts.push("updated_at = ?");
        values.push(now);
        values.push(current.id);
        await env.DB.prepare(`UPDATE devices SET ${parts.join(", ")} WHERE id = ?`).bind(...values).run();
      }
    }

    return json({ ok: true, deviceId, userId: body.userId, heartbeatAt: nowIso() });
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
