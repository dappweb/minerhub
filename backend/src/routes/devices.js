import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { badRequest, json, unauthorized } from "../lib/response";
import { getRewardRateUsdtPerHour, isMaintenanceEnabled, readSystemStatus } from "../lib/system";
const HEARTBEAT_CONTINUITY_MS = 90_000;
const MAX_HEARTBEAT_REWARD_MS = 90_000;
let heartbeatColumnsReady = false;
function isContractExpiredAt(profile, referenceMs) {
    const endTimes = [profile.contract_end_at, profile.monthly_card_end_at]
        .map((value) => (value ? new Date(value).getTime() : NaN))
        .filter((value) => Number.isFinite(value));
    return endTimes.length > 0 && Math.max(...endTimes) < referenceMs;
}
async function ensureHeartbeatColumns(env) {
    if (heartbeatColumnsReady)
        return;
    const info = await env.DB.prepare("PRAGMA table_info(customer_profiles)").all();
    const columns = new Set((info.results ?? []).map((row) => row.name));
    const statements = [];
    if (!columns.has("last_heartbeat_at"))
        statements.push("ALTER TABLE customer_profiles ADD COLUMN last_heartbeat_at TEXT");
    if (!columns.has("last_reward_accrued_at"))
        statements.push("ALTER TABLE customer_profiles ADD COLUMN last_reward_accrued_at TEXT");
    if (!columns.has("total_online_seconds"))
        statements.push("ALTER TABLE customer_profiles ADD COLUMN total_online_seconds INTEGER NOT NULL DEFAULT 0");
    if (!columns.has("monthly_card_end_at"))
        statements.push("ALTER TABLE customer_profiles ADD COLUMN monthly_card_end_at TEXT");
    for (const statement of statements) {
        await env.DB.prepare(statement).run();
    }
    heartbeatColumnsReady = true;
}
async function ensureCustomerProfile(env, userId) {
    await ensureHeartbeatColumns(env);
    const now = nowIso();
    await env.DB.prepare(`INSERT OR IGNORE INTO customer_profiles (
      user_id, contract_term_days, monthly_card_days, contract_active,
      activation_status, exchange_auto_enabled, payout_wallets_json,
      reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super,
      total_online_seconds, online_status, created_at, updated_at
    ) VALUES (?, 1095, 30, 0, 'pending', 1, '[]', '0.084', '0', '0', 0, 'offline', ?, ?)`)
        .bind(userId, now, now)
        .run();
}
async function assertUserOwnedByWallet(env, userId, wallet) {
    const row = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND wallet = ?")
        .bind(userId, wallet.toLowerCase())
        .first();
    return Boolean(row?.id);
}
async function accrueHourlyReward(env, userId, deviceId) {
    const device = await env.DB.prepare(`SELECT id, hashrate, updated_at FROM devices WHERE user_id = ? AND device_id = ?`)
        .bind(userId, deviceId)
        .first();
    if (!device)
        return;
    const profile = await env.DB.prepare(`SELECT contract_active, contract_end_at, monthly_card_end_at, reward_rate_usdt_per_hour FROM customer_profiles WHERE user_id = ?`)
        .bind(userId)
        .first();
    // 收益累计仅依赖"合约态"：contract_active=1 且未到期。
    // token_locks 只管 SUPER 代币锁仓/释放，不再作为心跳收益的前置条件，
    // 以避免后台手动激活（未下发 SUPER）的客户静默失败。
    if (!profile || Number(profile.contract_active ?? 0) !== 1)
        return;
    if (isContractExpiredAt(profile, Date.now()))
        return;
    const lastAt = new Date(device.updated_at).getTime();
    const now = Date.now();
    const elapsedHours = Math.max(0, (now - lastAt) / 3_600_000);
    if (elapsedHours <= 0)
        return;
    const rate = Number(profile.reward_rate_usdt_per_hour ?? await getRewardRateUsdtPerHour(env));
    const hashrateFactor = Math.max(1, Number(device.hashrate ?? 0) / 1000);
    const rewardUsdt = elapsedHours * rate * hashrateFactor;
    if (!Number.isFinite(rewardUsdt) || rewardUsdt <= 0)
        return;
    const systemStatus = await readSystemStatus(env);
    const superPerUsdt = Math.max(0, Number(systemStatus.swapPriceSuperPerUsdt ?? "0"));
    const rewardSuper = rewardUsdt * superPerUsdt;
    const nowIsoValue = new Date(now).toISOString();
    await env.DB.prepare(`INSERT INTO reward_ledger (
      id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
      accrued_from, accrued_to, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'heartbeat', ?, ?, ?)`)
        .bind(createId("rwd"), userId, deviceId, rewardUsdt.toFixed(6), rewardSuper.toFixed(6), String(rate), device.updated_at, nowIsoValue, `hourly reward from device heartbeat (hashrate=${device.hashrate}, price=${superPerUsdt})`, nowIsoValue, nowIsoValue)
        .run();
    await env.DB.prepare(`UPDATE customer_profiles
     SET total_reward_usdt = CAST(ROUND(CAST(total_reward_usdt AS REAL) + ?, 6) AS TEXT),
         total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) + ?, 6) AS TEXT),
         last_seen_at = ?,
         online_status = 'online',
         updated_at = ?
     WHERE user_id = ?`)
        .bind(rewardUsdt, rewardSuper, nowIsoValue, nowIsoValue, userId)
        .run();
    await env.DB.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
        .bind(nowIsoValue, device.id)
        .run();
    await env.DB.prepare(`INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`)
        .bind(createId("dst"), deviceId, userId, Number(device.hashrate ?? 0), nowIsoValue, "heartbeat")
        .run();
}
function normalizeHeartbeatHashrate(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return 1000;
    return Math.max(1, Math.floor(parsed));
}
async function updateHeartbeatPresence(env, userId, deviceId, deviceRecordId, hashrate, heartbeatAt, note, markDeviceActive = true, observedStatus = "active") {
    await env.DB.prepare(`UPDATE customer_profiles
     SET last_seen_at = ?,
         last_heartbeat_at = ?,
         last_reward_accrued_at = ?,
         online_status = 'online',
         updated_at = ?
     WHERE user_id = ?`)
        .bind(heartbeatAt, heartbeatAt, heartbeatAt, heartbeatAt, userId)
        .run();
    if (deviceRecordId) {
        if (markDeviceActive) {
            await env.DB.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
                .bind(heartbeatAt, deviceRecordId)
                .run();
        }
        else {
            await env.DB.prepare("UPDATE devices SET updated_at = ? WHERE id = ?")
                .bind(heartbeatAt, deviceRecordId)
                .run();
        }
    }
    await env.DB.prepare(`INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(createId("dst"), deviceId, userId, observedStatus, Number(hashrate ?? 0), heartbeatAt, note)
        .run();
}
async function accrueHeartbeatReward(env, userId, deviceId, heartbeatAt, reportedHashrate) {
    let device = await env.DB.prepare(`SELECT id, hashrate, status, updated_at FROM devices WHERE user_id = ? AND device_id = ?`)
        .bind(userId, deviceId)
        .first();
    if (!device) {
        const newDeviceId = createId("dev");
        const hashrate = normalizeHeartbeatHashrate(reportedHashrate);
        await env.DB.prepare(`INSERT INTO devices (id, user_id, device_id, hashrate, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?)`)
            .bind(newDeviceId, userId, deviceId, hashrate, heartbeatAt, heartbeatAt)
            .run();
        await updateHeartbeatPresence(env, userId, deviceId, newDeviceId, hashrate, heartbeatAt, "heartbeat:device_created");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: "device_created" };
    }
    const profile = await env.DB.prepare(`SELECT
       contract_active,
       contract_end_at,
       monthly_card_end_at,
       reward_rate_usdt_per_hour,
       last_heartbeat_at,
       COALESCE(total_online_seconds, 0) AS total_online_seconds
     FROM customer_profiles WHERE user_id = ?`)
        .bind(userId)
        .first();
    if (!profile) {
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: "profile_not_found" };
    }
    if (device.status !== "active") {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:device_inactive", false, device.status);
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: "device_inactive" };
    }
    const heartbeatMs = new Date(heartbeatAt).getTime();
    const previousHeartbeatAt = device.updated_at;
    const previousHeartbeatMs = previousHeartbeatAt ? new Date(previousHeartbeatAt).getTime() : NaN;
    if (!previousHeartbeatAt || Number.isNaN(previousHeartbeatMs)) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:first_seen");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: "first_heartbeat" };
    }
    const heartbeatGapMs = Math.max(0, heartbeatMs - previousHeartbeatMs);
    if (heartbeatGapMs <= 0) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:duplicate");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: "duplicate_heartbeat" };
    }
    if (heartbeatGapMs > HEARTBEAT_CONTINUITY_MS) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:reconnected");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: "reconnected_after_gap" };
    }
    if (Number(profile.contract_active ?? 0) !== 1) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:contract_inactive");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: "contract_inactive" };
    }
    if (isContractExpiredAt(profile, heartbeatMs)) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:contract_expired");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: "contract_expired" };
    }
    const accruedMs = Math.min(heartbeatGapMs, MAX_HEARTBEAT_REWARD_MS);
    const elapsedHours = accruedMs / 3_600_000;
    const rate = Number(profile.reward_rate_usdt_per_hour ?? await getRewardRateUsdtPerHour(env));
    const hashrateFactor = Math.max(1, Number(device.hashrate ?? 0) / 1000);
    const rewardUsdt = elapsedHours * rate * hashrateFactor;
    if (!Number.isFinite(rewardUsdt) || rewardUsdt <= 0) {
        await updateHeartbeatPresence(env, userId, deviceId, device.id, device.hashrate, heartbeatAt, "heartbeat:no_reward");
        return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: "no_reward" };
    }
    const systemStatus = await readSystemStatus(env);
    const superPerUsdt = Math.max(0, Number(systemStatus.swapPriceSuperPerUsdt ?? "0"));
    const rewardSuper = rewardUsdt * superPerUsdt;
    const accruedSeconds = Math.max(0, Math.floor(accruedMs / 1000));
    await env.DB.prepare(`INSERT INTO reward_ledger (
      id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
      accrued_from, accrued_to, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'heartbeat', ?, ?, ?)`)
        .bind(createId("rwd"), userId, deviceId, rewardUsdt.toFixed(6), rewardSuper.toFixed(6), String(rate), previousHeartbeatAt, heartbeatAt, `continuous heartbeat reward (${accruedSeconds}s, hashrate=${device.hashrate}, price=${superPerUsdt})`, heartbeatAt, heartbeatAt)
        .run();
    await env.DB.prepare(`UPDATE customer_profiles
     SET total_reward_usdt = CAST(ROUND(CAST(total_reward_usdt AS REAL) + ?, 6) AS TEXT),
         total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) + ?, 6) AS TEXT),
         last_seen_at = ?,
         last_heartbeat_at = ?,
         last_reward_accrued_at = ?,
         total_online_seconds = COALESCE(total_online_seconds, 0) + ?,
         online_status = 'online',
         updated_at = ?
     WHERE user_id = ?`)
        .bind(rewardUsdt, rewardSuper, heartbeatAt, heartbeatAt, heartbeatAt, accruedSeconds, heartbeatAt, userId)
        .run();
    await env.DB.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
        .bind(heartbeatAt, device.id)
        .run();
    await env.DB.prepare(`INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`)
        .bind(createId("dst"), deviceId, userId, Number(device.hashrate ?? 0), heartbeatAt, "heartbeat:reward")
        .run();
    return { rewardUsdt, rewardSuper, accruedSeconds, continuous: true, reason: "reward_accrued" };
}
export async function handleDevices(request, env, pathParts) {
    if (request.method === "POST" && pathParts.length === 0) {
        if (await isMaintenanceEnabled(env)) {
            return json({ error: "System is under maintenance" }, 503);
        }
        // 验证签名
        const authResult = await extractAndVerifyAuth(request, env);
        if (!authResult.valid) {
            return unauthorized(authResult.error || "Signature verification failed");
        }
        const body = (await request.json().catch(() => null));
        if (!body?.userId || !body.deviceId || typeof body.hashrate !== "number") {
            return badRequest("userId, deviceId, hashrate are required");
        }
        if (!(await assertUserOwnedByWallet(env, body.userId, authResult.wallet))) {
            return unauthorized("User does not belong to signed wallet");
        }
        // 验证用户钱包一致性（可选，增强安全）
        if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
            return badRequest("Wallet mismatch");
        }
        const id = createId("dev");
        const now = nowIso();
        const existingDevice = await env.DB.prepare("SELECT id, status FROM devices WHERE user_id = ? AND device_id = ?")
            .bind(body.userId, body.deviceId)
            .first();
        if (existingDevice) {
            await env.DB.prepare(existingDevice.status === "inactive"
                ? "UPDATE devices SET hashrate = ?, updated_at = ? WHERE id = ?"
                : "UPDATE devices SET hashrate = ?, status = 'active', updated_at = ? WHERE id = ?")
                .bind(body.hashrate, now, existingDevice.id)
                .run();
        }
        else {
            await env.DB.prepare("INSERT INTO devices (id, user_id, device_id, hashrate, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
                .bind(id, body.userId, body.deviceId, body.hashrate, "active", now, now)
                .run();
        }
        await ensureCustomerProfile(env, body.userId);
        await env.DB.prepare(`INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
       VALUES (?, ?, ?, 'active', ?, ?, ?)`)
            .bind(createId("dst"), body.deviceId, body.userId, body.hashrate, now, "register")
            .run();
        await env.DB.prepare(`UPDATE customer_profiles SET last_seen_at = ?, online_status = 'online', updated_at = ? WHERE user_id = ?`)
            .bind(now, now, body.userId)
            .run();
        return json({
            id: existingDevice?.id ?? id,
            userId: body.userId,
            deviceId: body.deviceId,
            hashrate: body.hashrate,
            status: existingDevice?.status === "inactive" ? "inactive" : "active",
        }, existingDevice ? 200 : 201);
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
        const body = (await request.json().catch(() => null));
        if (!body?.userId)
            return badRequest("userId is required");
        if (!(await assertUserOwnedByWallet(env, body.userId, authResult.wallet))) {
            return unauthorized("User does not belong to signed wallet");
        }
        if (body.wallet && body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
            return badRequest("Wallet mismatch");
        }
        await ensureCustomerProfile(env, body.userId);
        const heartbeatAt = nowIso();
        const reward = await accrueHeartbeatReward(env, body.userId, deviceId, heartbeatAt, body.hashrate);
        if (typeof body.status === "string") {
            const current = await env.DB.prepare("SELECT id, status FROM devices WHERE user_id = ? AND device_id = ?")
                .bind(body.userId, deviceId)
                .first();
            if (current && current.status !== "inactive") {
                const parts = [];
                const values = [];
                if (typeof body.status === "string") {
                    parts.push("status = ?");
                    values.push(body.status);
                }
                parts.push("updated_at = ?");
                values.push(heartbeatAt);
                values.push(current.id);
                await env.DB.prepare(`UPDATE devices SET ${parts.join(", ")} WHERE id = ?`).bind(...values).run();
            }
        }
        return json({ ok: true, deviceId, userId: body.userId, heartbeatAt, reward });
    }
    if (request.method === "GET" && pathParts.length === 1) {
        const userId = pathParts[0];
        const { results } = await env.DB.prepare("SELECT id, user_id, device_id, hashrate, status, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC")
            .bind(userId)
            .all();
        return json({ items: results ?? [] });
    }
    return json({ error: "Unsupported devices route" }, 404);
}
