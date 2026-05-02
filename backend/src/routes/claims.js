import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { tryCreateRelayer } from "../lib/ownerRelayer";
import { reconcileUserRewardTotals } from "../lib/rewards";
import { badRequest, json, unauthorized } from "../lib/response";
import { isExchangeAutoEnabled, isMaintenanceEnabled } from "../lib/system";
let claimsProfileColumnsReady = false;
let exchangeOrderColumnsReady = false;
async function ensureClaimsProfileColumns(env) {
    if (claimsProfileColumnsReady)
        return;
    const info = await env.DB.prepare("PRAGMA table_info(customer_profiles)").all();
    const columns = new Set((info.results ?? []).map((row) => row.name));
    const statements = [];
    if (!columns.has("monthly_card_end_at"))
        statements.push("ALTER TABLE customer_profiles ADD COLUMN monthly_card_end_at TEXT");
    if (!columns.has("contract_agreement_accepted_version")) {
        statements.push("ALTER TABLE customer_profiles ADD COLUMN contract_agreement_accepted_version TEXT");
    }
    for (const statement of statements) {
        await env.DB.prepare(statement).run();
    }
    claimsProfileColumnsReady = true;
}
async function ensureCustomerProfile(env, userId) {
    await ensureClaimsProfileColumns(env);
    const now = nowIso();
    await env.DB.prepare(`INSERT OR IGNORE INTO customer_profiles (
      user_id, contract_term_days, monthly_card_days, contract_active,
      activation_status, exchange_auto_enabled, payout_wallets_json,
      reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super,
      online_status, created_at, updated_at
    ) VALUES (?, 1095, 30, 0, 'pending', 1, '[]', '0.084', '0', '0', 'offline', ?, ?)`)
        .bind(userId, now, now)
        .run();
}
async function assertUserOwnedByWallet(env, userId, wallet) {
    const row = await env.DB.prepare("SELECT id FROM users WHERE id = ? AND wallet = ?")
        .bind(userId, wallet.toLowerCase())
        .first();
    return Boolean(row?.id);
}
async function readMinimumStakeBlockReason(env, wallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer || !env.MINING_POOL_ADDRESS || !env.SUPER_TOKEN_ADDRESS)
        return null;
    try {
        const gate = await relayer.getMiningStakeGate(wallet);
        const min = Number(gate.minFormatted);
        const staked = Number(gate.stakedFormatted);
        if (!Number.isFinite(min) || min <= 0)
            return null;
        if (!Number.isFinite(staked) || staked < min) {
            return `minimum_super_stake:${Number.isFinite(staked) ? staked : 0}/${min}`;
        }
    }
    catch {
        return null;
    }
    return null;
}
async function reserveRewardSuper(env, userId, amount, at) {
    const result = await env.DB.prepare(`UPDATE customer_profiles
     SET total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) - ?, 6) AS TEXT),
         updated_at = ?
     WHERE user_id = ?
       AND CAST(total_reward_super AS REAL) >= ?`)
        .bind(amount, at, userId, amount)
        .run();
    return Number(result.meta?.changes ?? 0) > 0;
}
async function restoreRewardSuper(env, userId, amount, at) {
    await env.DB.prepare(`UPDATE customer_profiles
     SET total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) + ?, 6) AS TEXT),
         updated_at = ?
     WHERE user_id = ?`)
        .bind(amount, at, userId)
        .run();
}
async function ensureExchangeOrderColumns(env) {
    if (exchangeOrderColumnsReady)
        return;
    const info = await env.DB.prepare("PRAGMA table_info(exchange_orders)").all();
    const columns = new Set((info.results ?? []).map((row) => row.name));
    const statements = [];
    if (!columns.has("super_tx_hash"))
        statements.push("ALTER TABLE exchange_orders ADD COLUMN super_tx_hash TEXT");
    if (!columns.has("usdt_tx_hash"))
        statements.push("ALTER TABLE exchange_orders ADD COLUMN usdt_tx_hash TEXT");
    for (const statement of statements) {
        await env.DB.prepare(statement).run();
    }
    exchangeOrderColumnsReady = true;
}
function parseValidTime(value) {
    if (!value)
        return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}
function deriveClaimBlockReason(input) {
    const contractEndMs = parseValidTime(input.contractEndAt);
    const monthlyEndMs = parseValidTime(input.monthlyCardEndAt);
    const effectiveEndMs = contractEndMs === null && monthlyEndMs === null
        ? null
        : Math.max(contractEndMs ?? 0, monthlyEndMs ?? 0);
    if (Number(input.contractActive ?? 0) !== 1)
        return "contract_inactive";
    if (effectiveEndMs !== null && effectiveEndMs < Date.now())
        return "contract_expired";
    if (input.contractRequired &&
        input.requiredContractVersion &&
        input.acceptedContractVersion !== input.requiredContractVersion) {
        return "contract_agreement_required";
    }
    if (Number(input.deviceCount ?? 0) <= 0)
        return "miner_setup_required";
    return null;
}
async function assertCanClaim(env, userId, wallet) {
    const profile = await env.DB.prepare(`SELECT
       COALESCE(contract_active, 0) AS contractActive,
       contract_end_at AS contractEndAt,
       monthly_card_end_at AS monthlyCardEndAt,
       contract_agreement_accepted_version AS contractAgreementAcceptedVersion
     FROM customer_profiles
     WHERE user_id = ?`)
        .bind(userId)
        .first();
    const deviceRow = await env.DB.prepare("SELECT COUNT(*) AS count FROM devices WHERE user_id = ?")
        .bind(userId)
        .first();
    const systemRows = await env.DB.prepare("SELECT key, value FROM system_settings WHERE key IN ('contract_required', 'contract_version')").all();
    const systemSettings = new Map((systemRows.results ?? []).map((row) => [row.key, row.value]));
    const blockReason = deriveClaimBlockReason({
        contractActive: profile?.contractActive ?? 0,
        contractEndAt: profile?.contractEndAt ?? null,
        monthlyCardEndAt: profile?.monthlyCardEndAt ?? null,
        acceptedContractVersion: profile?.contractAgreementAcceptedVersion ?? null,
        requiredContractVersion: systemSettings.get("contract_version") ?? "1.0.0",
        contractRequired: (systemSettings.get("contract_required") ?? "1") === "1",
        deviceCount: Number(deviceRow?.count ?? 0),
    });
    const stakeBlockReason = await readMinimumStakeBlockReason(env, wallet);
    if (stakeBlockReason) {
        return {
            ok: false,
            response: json({ error: "Claim is blocked", canClaim: false, blockReason: stakeBlockReason }, 403),
        };
    }
    if (!blockReason)
        return { ok: true };
    return {
        ok: false,
        response: json({ error: "Claim is blocked", canClaim: false, blockReason }, 403),
    };
}
export async function handleClaims(request, env, pathParts) {
    if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "reward-withdraw") {
        if (await isMaintenanceEnabled(env)) {
            return json({ error: "System is under maintenance" }, 503);
        }
        const authResult = await extractAndVerifyAuth(request, env);
        if (!authResult.valid) {
            return unauthorized(authResult.error || "Signature verification failed");
        }
        const body = (await request.json().catch(() => null));
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
        const claimAccess = await assertCanClaim(env, body.userId, body.wallet);
        if (!claimAccess.ok)
            return claimAccess.response;
        const now = nowIso();
        const reserved = await reserveRewardSuper(env, body.userId, amount, now);
        if (!reserved) {
            return badRequest("Insufficient reward SUPER balance");
        }
        const withdrawalId = createId("rwdw");
        try {
            const relayer = tryCreateRelayer(env);
            if (!relayer) {
                await restoreRewardSuper(env, body.userId, amount, nowIso());
                return json({ error: "OWNER_PRIVATE_KEY not configured" }, 500);
            }
            const { txHash } = await relayer.transferSuper(body.wallet.toLowerCase(), amount.toString());
            await env.DB.prepare(`INSERT INTO reward_withdrawals (
          id, user_id, wallet, amount_super, tx_hash, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`)
                .bind(withdrawalId, body.userId, body.wallet.toLowerCase(), amount, txHash, body.note?.trim() || null, now, now)
                .run();
            const totals = await reconcileUserRewardTotals(env, body.userId, now);
            return json({
                ok: true,
                id: withdrawalId,
                amountSuper: amount.toString(),
                txHash,
                status: "confirmed",
                createdAt: now,
                totalRewardSuper: totals.totalRewardSuper,
            }, 201);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "withdraw failed";
            await restoreRewardSuper(env, body.userId, amount, nowIso());
            await env.DB.prepare(`INSERT INTO reward_withdrawals (
          id, user_id, wallet, amount_super, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'failed', ?, ?, ?)`)
                .bind(withdrawalId, body.userId, body.wallet.toLowerCase(), amount, msg, now, now)
                .run();
            await reconcileUserRewardTotals(env, body.userId, nowIso());
            return json({ error: msg }, 500);
        }
    }
    if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "exchange-request" && pathParts[1] === "list") {
        const authResult = await extractAndVerifyAuth(request, env);
        if (!authResult.valid) {
            return unauthorized(authResult.error || "Signature verification failed");
        }
        const body = (await request.json().catch(() => null));
        if (!body?.userId || !body.wallet) {
            return badRequest("userId and wallet are required");
        }
        if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
            return badRequest("Wallet mismatch");
        }
        if (!(await assertUserOwnedByWallet(env, body.userId, body.wallet))) {
            return unauthorized("User does not belong to signed wallet");
        }
        const limit = Math.min(50, Math.max(1, Number(body.limit ?? 10) || 10));
        await ensureExchangeOrderColumns(env);
        const { results } = await env.DB.prepare(`SELECT
        id, user_id, wallet, amount_super, amount_usdt, mode, status,
        request_note, tx_hash, super_tx_hash, usdt_tx_hash, created_at, updated_at, completed_at
       FROM exchange_orders
       WHERE user_id = ? AND wallet = ?
       ORDER BY created_at DESC
       LIMIT ?`)
            .bind(body.userId, body.wallet.toLowerCase(), limit)
            .all();
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
                txHash: row.usdt_tx_hash ?? row.tx_hash,
                superTxHash: row.super_tx_hash,
                usdtTxHash: row.usdt_tx_hash,
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
        const body = (await request.json().catch(() => null));
        if (!body?.userId || !body.wallet) {
            return badRequest("userId and wallet are required");
        }
        if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
            return badRequest("Wallet mismatch");
        }
        if (!(await assertUserOwnedByWallet(env, body.userId, body.wallet))) {
            return unauthorized("User does not belong to signed wallet");
        }
        const amountSuper = Number(body.amountSuper ?? "0");
        const amountUsdt = Number(body.amountUsdt ?? "0");
        const superTxHash = body.superTxHash?.trim();
        if (!Number.isFinite(amountSuper) || amountSuper <= 0) {
            return badRequest("amountSuper must be a positive number");
        }
        if (!superTxHash) {
            return badRequest("superTxHash is required");
        }
        await ensureCustomerProfile(env, body.userId);
        await ensureExchangeOrderColumns(env);
        const claimAccess = await assertCanClaim(env, body.userId, body.wallet);
        if (!claimAccess.ok)
            return claimAccess.response;
        const now = nowIso();
        const reserved = await reserveRewardSuper(env, body.userId, amountSuper, now);
        if (!reserved) {
            return badRequest("Insufficient reward SUPER balance");
        }
        const profile = await env.DB.prepare("SELECT exchange_auto_enabled FROM customer_profiles WHERE user_id = ?")
            .bind(body.userId)
            .first();
        const globalAuto = await isExchangeAutoEnabled(env);
        const userAuto = Number(profile?.exchange_auto_enabled ?? 1) === 1;
        const autoEnabled = globalAuto && userAuto;
        const mode = autoEnabled ? "auto" : "manual";
        const status = autoEnabled ? "auto_processing" : "manual_pending";
        const exchangeId = createId("exr");
        try {
            await env.DB.prepare(`INSERT INTO exchange_orders (
          id, user_id, wallet, amount_super, amount_usdt, mode, status,
          request_note, tx_hash, super_tx_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .bind(exchangeId, body.userId, body.wallet.toLowerCase(), amountSuper.toString(), Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0", mode, status, body.note?.trim() || null, superTxHash, superTxHash, now, now)
                .run();
            await env.DB.prepare(`INSERT INTO swap_trade_logs (
          id, user_id, wallet, direction, amount_in, amount_out,
          price_snapshot, status, note, created_at, updated_at
        ) VALUES (?, ?, ?, 'SUPER_TO_USDT', ?, ?, '0', ?, ?, ?, ?)`)
                .bind(createId("swl"), body.userId, body.wallet.toLowerCase(), amountSuper.toString(), Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0", status, `${autoEnabled ? "auto exchange request" : "manual exchange request"}; SUPER tx: ${superTxHash}`, now, now)
                .run();
            const totals = await reconcileUserRewardTotals(env, body.userId, now);
            return json({
                id: exchangeId,
                mode,
                status,
                autoEnabled,
                amountSuper: amountSuper.toString(),
                amountUsdt: Number.isFinite(amountUsdt) ? Math.max(0, amountUsdt).toString() : "0",
                superTxHash,
                totalRewardSuper: totals.totalRewardSuper,
                createdAt: now,
            }, 201);
        }
        catch (err) {
            await restoreRewardSuper(env, body.userId, amountSuper, nowIso());
            await reconcileUserRewardTotals(env, body.userId, nowIso());
            throw err;
        }
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
    if (request.method === "GET") {
        return json({
            error: "Legacy claims history has been retired. Use reward-withdraw or exchange-request records instead.",
            code: "CLAIMS_HISTORY_RETIRED",
        }, 410);
    }
    return json({ error: "Unsupported claims route" }, 404);
}
