import { getAddress, isAddress } from "ethers";
import { writeOwnerAudit } from "../lib/audit";
import { contractTypesEqual, ensureContractAccessColumns, normalizeContractTypes, parseAllowedContractTypes, serializeAllowedContractTypes, } from "../lib/contractAccess";
import { createId, nowIso } from "../lib/id";
import { refreshUserContractStateFromLocks } from "../lib/locks";
import { getAdminActorRole, getPrimaryOwnerWallet, isAdminActorWallet, issueOwnerJwt, requireOwnerAuth, verifyLoginSignature } from "../lib/ownerAuth";
import { tryCreateRelayer } from "../lib/ownerRelayer";
import { badRequest, internalError, json, notFound, unauthorized } from "../lib/response";
import { readSystemStatus } from "../lib/system";
async function auth(request, env, sensitive = false) {
    return requireOwnerAuth(request, env, { sensitive });
}
async function parseJson(request) {
    try {
        return (await request.json());
    }
    catch {
        return null;
    }
}
async function ensureSubAdminTable(env) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS owner_sub_admins (
      wallet TEXT PRIMARY KEY,
      note TEXT,
      created_by TEXT,
      updated_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      allowed_contract_types_json TEXT NOT NULL DEFAULT '[]',
      contract_types_locked_at TEXT,
      enabled INTEGER NOT NULL DEFAULT 1
    )`).run();
    await ensureContractAccessColumns(env);
}
function normalizeAddr(addr) {
    try {
        if (!isAddress(addr))
            return null;
        return getAddress(addr).toLowerCase();
    }
    catch {
        return null;
    }
}
function parsePositiveAmount(value, field = "amount") {
    if (value === undefined)
        return { ok: false, response: badRequest(`${field} required`) };
    const amount = String(value).trim();
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return { ok: false, response: badRequest(`${field} must be > 0`) };
    }
    return { ok: true, amount };
}
// ---- Auth: login / logout ----
async function handleLogin(request, env) {
    const body = await parseJson(request);
    if (!body?.wallet || !body?.signature || !body?.nonce || body?.ts === undefined) {
        return badRequest("wallet, signature, nonce, ts required");
    }
    if (!(await isAdminActorWallet(env, body.wallet)))
        return unauthorized("Not admin wallet");
    // Nonce uniqueness (reuse KV)
    const kvKey = `owner-login-nonce:${body.nonce}`;
    if ((await env.CACHE.get(kvKey)) !== null)
        return unauthorized("Nonce already used");
    const v = verifyLoginSignature(body.wallet, body.signature, body.nonce, body.ts);
    if (!v.valid)
        return unauthorized(v.error || "Signature invalid");
    const role = await getAdminActorRole(env, body.wallet);
    if (!role)
        return unauthorized("Not admin wallet");
    await env.CACHE.put(kvKey, "1", { expirationTtl: 600 });
    const sessionId = createId("sess");
    const { token, expiresAt } = await issueOwnerJwt(env, body.wallet, sessionId);
    await env.DB.prepare(`INSERT INTO owner_sessions (id, wallet, issued_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(sessionId, body.wallet.toLowerCase(), nowIso(), expiresAt, request.headers.get("cf-connecting-ip") || null, request.headers.get("user-agent") || null)
        .run();
    await writeOwnerAudit(env, { action: "auth.login", actorWallet: body.wallet, request });
    return json({ token, expiresAt, wallet: body.wallet.toLowerCase(), role });
}
// ---- Overview ----
async function handleOverview(env) {
    const [users, devices, activeDevices, reward, payouts, totalMinted] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) as c FROM users").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM devices").first(),
        env.DB.prepare("SELECT COUNT(*) as c FROM devices WHERE status='active'").first(),
        env.DB.prepare("SELECT COALESCE(SUM(CAST(total_reward_usdt AS REAL)),0) as u, COALESCE(SUM(CAST(total_reward_super AS REAL)),0) as s FROM customer_profiles").first(),
        env.DB.prepare("SELECT COUNT(*) as c, COALESCE(SUM(CAST(total_usdt AS REAL)),0) as total FROM payout_batches WHERE status='completed'").first(),
        env.DB.prepare("SELECT COALESCE(SUM(CAST(payload_json AS TEXT)),0) as c FROM owner_audit_logs WHERE action='super.mint' AND status='ok'").first(),
    ]);
    const relayer = tryCreateRelayer(env);
    let onchain = { enabled: false };
    if (relayer) {
        try {
            const [supply, relayerBal] = await Promise.all([
                relayer.totalSuperSupply(),
                relayer.getSuperBalance(relayer.address),
            ]);
            onchain = {
                enabled: true,
                relayer: relayer.address,
                superTotalSupply: supply.formatted,
                relayerSuperBalance: relayerBal.formatted,
            };
        }
        catch (err) {
            onchain = { enabled: true, relayer: relayer.address, error: err instanceof Error ? err.message : "rpc failed" };
        }
    }
    return json({
        users: users?.c ?? 0,
        devices: devices?.c ?? 0,
        activeDevices: activeDevices?.c ?? 0,
        totalRewardUsdt: reward?.u ?? 0,
        totalRewardSuper: reward?.s ?? 0,
        payoutBatches: payouts?.c ?? 0,
        payoutUsdtTotal: payouts?.total ?? 0,
        onchain,
    });
}
// ---- SUPER token ops ----
async function handleSuperBalance(env, wallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const addr = normalizeAddr(wallet);
    if (!addr)
        return badRequest("Invalid wallet");
    try {
        const bal = await relayer.getSuperBalance(addr);
        return json({ wallet: addr, balance: bal.formatted, raw: bal.raw, decimals: bal.decimals });
    }
    catch (err) {
        return internalError(err instanceof Error ? err.message : "rpc failed");
    }
}
async function enforceMintCap(env, amountHuman) {
    if (!env.OWNER_MINT_DAILY_CAP)
        return { ok: true };
    const cap = Number(env.OWNER_MINT_DAILY_CAP);
    if (!Number.isFinite(cap) || cap <= 0)
        return { ok: true };
    const amount = Number(amountHuman);
    if (!Number.isFinite(amount) || amount < 0)
        return { ok: false, error: "Invalid amount" };
    const day = new Date().toISOString().slice(0, 10);
    const row = await env.DB.prepare("SELECT total_super FROM owner_mint_counters WHERE day=?").bind(day).first();
    const cur = Number(row?.total_super ?? "0");
    if (cur + amount > cap)
        return { ok: false, error: `Daily mint cap exceeded (${cur}+${amount}>${cap})` };
    const next = (cur + amount).toString();
    await env.DB.prepare(`INSERT INTO owner_mint_counters (day, total_super, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET total_super = ?, updated_at = ?`).bind(day, next, nowIso(), next, nowIso()).run();
    return { ok: true };
}
async function handleSuperMint(request, env, actorWallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const body = await parseJson(request);
    if (!body?.to || body?.amount === undefined)
        return badRequest("to, amount required");
    const to = normalizeAddr(body.to);
    if (!to)
        return badRequest("Invalid recipient");
    const parsed = parsePositiveAmount(body.amount);
    if (!parsed.ok)
        return parsed.response;
    const amount = parsed.amount;
    const cap = await enforceMintCap(env, amount);
    if (!cap.ok) {
        await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: cap.error, request });
        return badRequest(cap.error);
    }
    try {
        const { txHash } = await relayer.mintSuper(to, amount);
        await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, txHash, request });
        return json({ ok: true, txHash, to, amount });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "mint failed";
        await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: msg, request });
        return internalError(msg);
    }
}
async function handleSuperTransfer(request, env, actorWallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const body = await parseJson(request);
    if (!body?.to || body?.amount === undefined)
        return badRequest("to, amount required");
    const to = normalizeAddr(body.to);
    if (!to)
        return badRequest("Invalid recipient");
    const parsed = parsePositiveAmount(body.amount);
    if (!parsed.ok)
        return parsed.response;
    const amount = parsed.amount;
    try {
        const { txHash } = await relayer.transferSuper(to, amount);
        await writeOwnerAudit(env, { action: "super.transfer", actorWallet, targetWallet: to, payload: { amount }, txHash, request });
        return json({ ok: true, txHash, to, amount });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "transfer failed";
        await writeOwnerAudit(env, { action: "super.transfer", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: msg, request });
        return internalError(msg);
    }
}
async function handleSuperAirdrop(request, env, actorWallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const body = await parseJson(request);
    if (!body?.items?.length)
        return badRequest("items[] required");
    if (body.items.length > 200)
        return badRequest("Max 200 items per batch");
    const mode = body.mode === "transfer" ? "transfer" : "mint";
    const results = [];
    for (const item of body.items) {
        const w = normalizeAddr(item.wallet);
        const parsed = parsePositiveAmount(item.amount);
        const amount = parsed.ok ? parsed.amount : String(item.amount);
        if (!w) {
            results.push({ wallet: item.wallet, amount, error: "invalid address" });
            continue;
        }
        if (!parsed.ok) {
            results.push({ wallet: w, amount, error: "amount must be > 0" });
            continue;
        }
        try {
            if (mode === "mint") {
                const cap = await enforceMintCap(env, amount);
                if (!cap.ok) {
                    results.push({ wallet: w, amount, error: cap.error });
                    continue;
                }
            }
            const { txHash } = mode === "mint" ? await relayer.mintSuper(w, amount) : await relayer.transferSuper(w, amount);
            results.push({ wallet: w, amount, txHash });
            await writeOwnerAudit(env, {
                action: `super.airdrop.${mode}`,
                actorWallet,
                targetWallet: w,
                payload: { amount },
                txHash,
                request,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "tx failed";
            results.push({ wallet: w, amount, error: msg });
            await writeOwnerAudit(env, {
                action: `super.airdrop.${mode}`,
                actorWallet,
                targetWallet: w,
                payload: { amount },
                status: "failed",
                error: msg,
                request,
            });
        }
    }
    const ok = results.filter((r) => r.txHash).length;
    return json({ ok: true, mode, total: results.length, success: ok, failed: results.length - ok, results });
}
async function handleSuperBurn(request, env, actorWallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const body = await parseJson(request);
    if (body?.amount === undefined)
        return badRequest("amount required");
    const parsed = parsePositiveAmount(body.amount);
    if (!parsed.ok)
        return parsed.response;
    const amount = parsed.amount;
    try {
        if (body.from && normalizeAddr(body.from) !== relayer.address.toLowerCase()) {
            const from = normalizeAddr(body.from);
            const { txHash } = await relayer.burnFromSuper(from, amount);
            await writeOwnerAudit(env, { action: "super.burnFrom", actorWallet, targetWallet: from, payload: { amount }, txHash, request });
            return json({ ok: true, txHash, from, amount });
        }
        const { txHash } = await relayer.burnOwnSuper(amount);
        await writeOwnerAudit(env, { action: "super.burn", actorWallet, payload: { amount }, txHash, request });
        return json({ ok: true, txHash, amount });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "burn failed";
        await writeOwnerAudit(env, { action: "super.burn", actorWallet, payload: { amount }, status: "failed", error: msg, request });
        return internalError(msg);
    }
}
async function handleSuperGrantPriced(request, env, actorWallet) {
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    const body = await parseJson(request);
    if (body?.usdtAmount === undefined)
        return badRequest("usdtAmount required");
    const usdtAmount = Number(body.usdtAmount);
    if (!Number.isFinite(usdtAmount) || usdtAmount <= 0)
        return badRequest("usdtAmount must be > 0");
    let userId = body.userId ?? null;
    let targetWallet = body.wallet ? normalizeAddr(body.wallet) : null;
    if (!userId && !targetWallet)
        return badRequest("userId or wallet required");
    if (userId) {
        const u = await env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?").bind(userId).first();
        if (!u)
            return notFound("User not found");
        targetWallet = normalizeAddr(u.wallet);
    }
    else if (targetWallet) {
        const u = await env.DB.prepare("SELECT id, wallet FROM users WHERE wallet = ?").bind(targetWallet).first();
        if (u)
            userId = u.id;
    }
    if (!targetWallet)
        return badRequest("Invalid target wallet");
    const status = await readSystemStatus(env);
    const price = Number(status.swapPriceSuperPerUsdt ?? "0");
    if (!Number.isFinite(price) || price <= 0)
        return badRequest("swap_price_super_per_usdt must be configured and > 0");
    const superAmountNum = Number((usdtAmount * price).toFixed(6));
    if (!Number.isFinite(superAmountNum) || superAmountNum <= 0)
        return badRequest("Calculated SUPER amount invalid");
    const mode = body.mode === "mint" ? "mint" : "transfer";
    const superAmount = superAmountNum.toString();
    if (mode === "mint") {
        const cap = await enforceMintCap(env, superAmount);
        if (!cap.ok) {
            await writeOwnerAudit(env, {
                action: "super.grantPriced",
                actorWallet,
                targetUserId: userId,
                targetWallet,
                payload: { usdtAmount, superAmount, price, mode },
                status: "failed",
                error: cap.error,
                request,
            });
            return badRequest(cap.error);
        }
    }
    const lockTermDays = Math.max(1, Number(body.lockTermDays ?? Number(status.contractTermDaysDefault ?? "1095")));
    const now = nowIso();
    try {
        const tx = mode === "mint"
            ? await relayer.mintSuper(targetWallet, superAmount)
            : await relayer.transferSuper(targetWallet, superAmount);
        const distId = createId("sdt");
        const lockId = createId("lok");
        if (userId) {
            await env.DB.prepare(`INSERT OR IGNORE INTO customer_profiles (
          user_id, contract_term_days, monthly_card_days, contract_active,
          activation_status, exchange_auto_enabled, payout_wallets_json,
          reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super,
          online_status, created_at, updated_at
        ) VALUES (?, 1095, 30, 0, 'pending', 1, '[]', '0.084', '0', '0', 'offline', ?, ?)`).bind(userId, now, now).run();
        }
        await env.DB.prepare(`INSERT INTO super_distributions (
        id, user_id, wallet, mode, usdt_amount, super_amount, swap_price_super_per_usdt,
        tx_hash, status, lock_term_days, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?)`)
            .bind(distId, userId, targetWallet, mode, usdtAmount, superAmountNum, price, tx.txHash, lockTermDays, body.note ?? null, now)
            .run();
        if (userId) {
            await env.DB.prepare(`INSERT INTO token_locks (
          id, user_id, wallet, source_distribution_id, locked_super, released_super, status,
          lock_term_days, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, 'pending_agreement', ?, ?, ?)`)
                .bind(lockId, userId, targetWallet, distId, superAmountNum, lockTermDays, now, now)
                .run();
        }
        await writeOwnerAudit(env, {
            action: "super.grantPriced",
            actorWallet,
            targetUserId: userId,
            targetWallet,
            payload: { usdtAmount, superAmount: superAmountNum, price, mode, lockTermDays, distributionId: distId },
            txHash: tx.txHash,
            request,
        });
        return json({
            ok: true,
            txHash: tx.txHash,
            userId,
            wallet: targetWallet,
            usdtAmount,
            superAmount: superAmountNum,
            swapPriceSuperPerUsdt: price,
            mode,
            lockTermDays,
            distributionId: distId,
            lockId: userId ? lockId : null,
            lockStatus: userId ? "pending_agreement" : null,
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "grant failed";
        await writeOwnerAudit(env, {
            action: "super.grantPriced",
            actorWallet,
            targetUserId: userId,
            targetWallet,
            payload: { usdtAmount, superAmount: superAmountNum, price, mode },
            status: "failed",
            error: msg,
            request,
        });
        return internalError(msg);
    }
}
async function handleLocksList(request, env) {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const userId = url.searchParams.get("userId");
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    const where = [];
    const binds = [];
    if (status) {
        where.push("status = ?");
        binds.push(status);
    }
    if (userId) {
        where.push("user_id = ?");
        binds.push(userId);
    }
    const sql = `SELECT id, user_id, wallet, source_distribution_id, locked_super, released_super, status,
                      lock_term_days, agreement_version, start_at, end_at, released_at, release_note, created_at, updated_at
               FROM token_locks ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY created_at DESC LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...binds, limit).all();
    return json({ items: results ?? [] });
}
async function handleLockManualUnlock(request, env, lockId, actorWallet) {
    const body = await parseJson(request);
    const row = await env.DB.prepare("SELECT id, user_id, wallet, status, locked_super, released_super FROM token_locks WHERE id = ?").bind(lockId).first();
    if (!row)
        return notFound("Lock not found");
    if (row.status === "released" || row.status === "admin_released") {
        return badRequest("Lock already released");
    }
    const now = nowIso();
    await env.DB.prepare(`UPDATE token_locks
     SET status = 'admin_released',
         released_super = locked_super,
         released_at = ?,
         release_note = ?,
         updated_at = ?
     WHERE id = ?`)
        .bind(now, body?.note ?? "manual unlock by owner", now, lockId)
        .run();
    await refreshUserContractStateFromLocks(env, row.user_id, now);
    await writeOwnerAudit(env, {
        action: "locks.manualUnlock",
        actorWallet,
        targetUserId: row.user_id,
        targetWallet: row.wallet,
        payload: { lockId, note: body?.note ?? null },
        request,
    });
    return json({ ok: true, lockId, status: "admin_released", releasedAt: now });
}
// ---- Earnings ----
async function handleEarningsOverview(env) {
    const { results } = await env.DB.prepare(`SELECT
      u.id AS userId, u.wallet AS wallet, cp.nickname AS nickname,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      COALESCE(cp.reward_rate_usdt_per_hour, '0') AS rateUsdtPerHour,
      COALESCE(cp.online_status, 'offline') AS onlineStatus,
      cp.last_seen_at AS lastSeenAt,
      (SELECT MAX(accrued_to) FROM reward_ledger WHERE reward_ledger.user_id = u.id) AS lastAccruedTo
     FROM users u
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     ORDER BY u.created_at DESC`).all();
    return json({ items: results ?? [] });
}
async function handleEarningsSettle(request, env, userId, actorWallet) {
    const body = await parseJson(request);
    if (!body?.hours || body.hours <= 0)
        return badRequest("hours > 0 required");
    const profile = await env.DB.prepare(`SELECT reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id=?`).bind(userId).first();
    if (!profile)
        return notFound("User not found");
    const rate = Number(body.rateUsdtPerHour ?? profile.reward_rate_usdt_per_hour ?? "0");
    const usdt = Number(body.hours) * rate;
    if (!Number.isFinite(usdt) || usdt < 0)
        return badRequest("Invalid amount");
    const now = nowIso();
    const id = createId("rwd");
    await env.DB.prepare(`INSERT INTO reward_ledger (id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, accrued_from, accrued_to, source, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '0', ?, ?, ?, 'owner.settle', ?, ?, ?)`).bind(id, userId, body.deviceId ?? null, usdt.toString(), rate.toString(), null, now, body.note ?? null, now, now).run();
    const nextUsdt = (Number(profile.total_reward_usdt || "0") + usdt).toString();
    await env.DB.prepare("UPDATE customer_profiles SET total_reward_usdt=?, updated_at=? WHERE user_id=?").bind(nextUsdt, now, userId).run();
    await writeOwnerAudit(env, { action: "earnings.settle", actorWallet, targetUserId: userId, payload: { hours: body.hours, rate, usdt }, request });
    return json({ ok: true, rewardId: id, usdt, rate, totalRewardUsdt: nextUsdt });
}
async function handleEarningsAdjust(request, env, userId, actorWallet) {
    const body = await parseJson(request);
    if (!body || (body.deltaUsdt === undefined && body.deltaSuper === undefined)) {
        return badRequest("deltaUsdt or deltaSuper required");
    }
    const du = Number(body.deltaUsdt ?? 0);
    const ds = Number(body.deltaSuper ?? 0);
    if (!Number.isFinite(du) || !Number.isFinite(ds)) {
        return badRequest("deltaUsdt/deltaSuper invalid");
    }
    const profile = await env.DB.prepare(`SELECT total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id=?`).bind(userId).first();
    if (!profile)
        return notFound("User not found");
    const nextUsdtNum = Number(profile.total_reward_usdt || "0") + du;
    const nextSuperNum = Number(profile.total_reward_super || "0") + ds;
    if (nextUsdtNum < 0 || nextSuperNum < 0) {
        return badRequest("Adjustment would make reward totals negative");
    }
    const nextUsdt = nextUsdtNum.toString();
    const nextSuper = nextSuperNum.toString();
    const now = nowIso();
    const id = createId("rwd");
    await env.DB.prepare(`INSERT INTO reward_ledger (id, user_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '0', 'owner.adjust', ?, ?, ?)`).bind(id, userId, du.toString(), ds.toString(), body.note ?? null, now, now).run();
    await env.DB.prepare("UPDATE customer_profiles SET total_reward_usdt=?, total_reward_super=?, updated_at=? WHERE user_id=?").bind(nextUsdt, nextSuper, now, userId).run();
    await writeOwnerAudit(env, {
        action: "earnings.adjust",
        actorWallet,
        targetUserId: userId,
        payload: { deltaUsdt: du, deltaSuper: ds, note: body.note },
        request,
    });
    return json({ ok: true, rewardId: id, totalRewardUsdt: nextUsdt, totalRewardSuper: nextSuper });
}
// ---- Payouts ----
async function handlePayoutBatch(request, env, actorWallet) {
    const body = await parseJson(request);
    if (!body?.items?.length)
        return badRequest("items[] required");
    if (body.items.length > 100)
        return badRequest("Max 100 items per batch");
    const items = body.items.map((it) => ({
        userId: it.userId ?? null,
        wallet: normalizeAddr(it.wallet),
        amount: String(it.amountUsdt),
        exchangeOrderId: it.exchangeOrderId ?? null,
    }));
    const invalid = items.find((x) => !x.wallet || !Number.isFinite(Number(x.amount)) || Number(x.amount) <= 0);
    if (invalid)
        return badRequest("Invalid item (wallet or amount)");
    const total = items.reduce((s, x) => s + Number(x.amount), 0);
    if (body.dryRun) {
        return json({ ok: true, dryRun: true, total, count: items.length, items });
    }
    const relayer = tryCreateRelayer(env);
    if (!relayer)
        return internalError("OWNER_PRIVATE_KEY not configured");
    if (!env.USDT_TOKEN_ADDRESS)
        return internalError("USDT_TOKEN_ADDRESS not configured");
    const batchId = createId("pbh");
    const now = nowIso();
    await env.DB.prepare(`INSERT INTO payout_batches (id, wallet_address, total_usdt, status, note, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'processing', ?, ?, ?, ?)`).bind(batchId, relayer.address.toLowerCase(), total.toString(), body.note ?? null, actorWallet, now, now).run();
    const outcomes = [];
    for (const it of items) {
        const itemId = createId("pbi");
        await env.DB.prepare(`INSERT INTO payout_batch_items (id, batch_id, exchange_order_id, user_id, amount_usdt, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`).bind(itemId, batchId, it.exchangeOrderId ?? "", it.userId ?? "", it.amount, now, now).run();
        try {
            const { txHash } = await relayer.transferUsdt(it.wallet, it.amount);
            await env.DB.prepare("UPDATE payout_batch_items SET status='completed', tx_hash=?, updated_at=? WHERE id=?").bind(txHash, nowIso(), itemId).run();
            outcomes.push({ wallet: it.wallet, amount: it.amount, txHash });
            await writeOwnerAudit(env, {
                action: "payout.item",
                actorWallet,
                targetUserId: it.userId ?? null,
                targetWallet: it.wallet,
                payload: { amount: it.amount, batchId, itemId },
                txHash,
                request,
            });
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : "tx failed";
            await env.DB.prepare("UPDATE payout_batch_items SET status='failed', updated_at=? WHERE id=?").bind(nowIso(), itemId).run();
            outcomes.push({ wallet: it.wallet, amount: it.amount, error: msg });
            await writeOwnerAudit(env, {
                action: "payout.item",
                actorWallet,
                targetUserId: it.userId ?? null,
                targetWallet: it.wallet,
                payload: { amount: it.amount, batchId, itemId },
                status: "failed",
                error: msg,
                request,
            });
        }
    }
    const anyFailed = outcomes.some((x) => x.error);
    await env.DB.prepare("UPDATE payout_batches SET status=?, updated_at=? WHERE id=?").bind(anyFailed ? "partial" : "completed", nowIso(), batchId).run();
    await writeOwnerAudit(env, {
        action: "payout.batch",
        actorWallet,
        payload: { batchId, total, count: items.length, failedCount: outcomes.filter((x) => x.error).length },
        request,
    });
    return json({ ok: true, batchId, total, count: items.length, outcomes });
}
// ---- Audit query ----
async function handleAuditList(request, env) {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const target = url.searchParams.get("target"); // target_wallet
    const actor = url.searchParams.get("actor");
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
    const cursor = url.searchParams.get("cursor");
    const where = [];
    const binds = [];
    if (action) {
        where.push("action = ?");
        binds.push(action);
    }
    if (target) {
        where.push("target_wallet = ?");
        binds.push(target.toLowerCase());
    }
    if (actor) {
        where.push("actor_wallet = ?");
        binds.push(actor.toLowerCase());
    }
    if (cursor) {
        where.push("created_at < ?");
        binds.push(cursor);
    }
    const sql = `SELECT id, actor_wallet, action, target_user_id, target_wallet, payload_json, tx_hash, status, error_message, ip, user_agent, created_at
               FROM owner_audit_logs ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY created_at DESC LIMIT ?`;
    const { results } = await env.DB.prepare(sql).bind(...binds, limit).all();
    const items = (results ?? []).map((r) => ({
        id: r.id,
        actorWallet: r.actor_wallet,
        action: r.action,
        targetUserId: r.target_user_id,
        targetWallet: r.target_wallet,
        payload: r.payload_json ? safeParse(r.payload_json) : null,
        txHash: r.tx_hash,
        status: r.status,
        errorMessage: r.error_message,
        ip: r.ip,
        userAgent: r.user_agent,
        createdAt: r.created_at,
    }));
    const nextCursor = items.length === limit ? items[items.length - 1].createdAt : null;
    return json({ items, nextCursor });
}
function safeParse(x) {
    try {
        return JSON.parse(x);
    }
    catch {
        return x;
    }
}
// ---- Ownership ----
async function handleOwnershipTransfer(request, env, actorWallet) {
    const body = await parseJson(request);
    if (!body?.newOwnerWallet)
        return badRequest("newOwnerWallet required");
    const nextOwner = normalizeAddr(body.newOwnerWallet);
    if (!nextOwner)
        return badRequest("Invalid newOwnerWallet");
    const currentOwner = await getPrimaryOwnerWallet(env);
    if (!currentOwner)
        return internalError("Primary owner not configured");
    if (actorWallet.toLowerCase() !== currentOwner.toLowerCase()) {
        return unauthorized("Only primary owner can transfer ownership");
    }
    if (nextOwner === currentOwner.toLowerCase()) {
        return badRequest("newOwnerWallet must be different from current owner");
    }
    const now = nowIso();
    await env.DB.batch([
        env.DB.prepare(`INSERT INTO system_settings (key, value, updated_at)
       VALUES ('owner_address', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(nextOwner, now),
        env.DB.prepare(`INSERT INTO system_settings (key, value, updated_at)
       VALUES ('owner_address_updated_at', ?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(now, now),
        env.DB.prepare("UPDATE owner_sessions SET revoked=1 WHERE wallet = ? AND revoked = 0").bind(currentOwner.toLowerCase()),
    ]);
    await writeOwnerAudit(env, {
        action: "owner.transfer",
        actorWallet,
        targetWallet: nextOwner,
        payload: { previousOwner: currentOwner.toLowerCase(), note: body.note ?? null },
        request,
    });
    return json({ ok: true, previousOwner: currentOwner.toLowerCase(), newOwnerWallet: nextOwner, updatedAt: now });
}
async function handleSubAdminList(env) {
    await ensureSubAdminTable(env);
    const dbRows = await env.DB.prepare(`SELECT wallet, note, allowed_contract_types_json, contract_types_locked_at, created_at, updated_at
     FROM owner_sub_admins
     WHERE enabled = 1
     ORDER BY updated_at DESC`).all();
    const items = new Map();
    for (const row of dbRows.results ?? []) {
        const wallet = row.wallet.toLowerCase();
        items.set(wallet, {
            wallet,
            source: "database",
            note: row.note,
            allowedContractTypes: parseAllowedContractTypes(row.allowed_contract_types_json),
            contractTypesLocked: Boolean(row.contract_types_locked_at),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            canRemove: true,
        });
    }
    const envWallets = [env.SUB_ADMIN_ADDRESSES, env.ADMIN_ADDRESSES]
        .filter(Boolean)
        .join(",")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
    for (const wallet of envWallets) {
        if (!items.has(wallet)) {
            items.set(wallet, {
                wallet,
                source: "environment",
                note: "from env",
                allowedContractTypes: null,
                contractTypesLocked: false,
                createdAt: null,
                updatedAt: null,
                canRemove: false,
            });
        }
    }
    return json({ items: Array.from(items.values()) });
}
async function handleSubAdminAdd(request, env, actorWallet) {
    await ensureSubAdminTable(env);
    const body = await parseJson(request);
    if (!body?.wallet)
        return badRequest("wallet required");
    const wallet = normalizeAddr(body.wallet);
    if (!wallet)
        return badRequest("Invalid wallet");
    const allowedContractTypes = normalizeContractTypes(body.allowedContractTypes ?? body.contractTypes);
    if (allowedContractTypes.length === 0) {
        return badRequest("allowedContractTypes required");
    }
    const ownerWallet = await getPrimaryOwnerWallet(env);
    if (ownerWallet && wallet.toLowerCase() === ownerWallet.toLowerCase()) {
        return badRequest("Owner wallet cannot be added as subadmin");
    }
    const now = nowIso();
    const existing = await env.DB.prepare(`SELECT wallet, allowed_contract_types_json, contract_types_locked_at
     FROM owner_sub_admins
     WHERE wallet = ?
     LIMIT 1`)
        .bind(wallet)
        .first();
    if (existing?.contract_types_locked_at) {
        const existingTypes = parseAllowedContractTypes(existing.allowed_contract_types_json);
        if (!contractTypesEqual(existingTypes, allowedContractTypes)) {
            return badRequest("SubAdmin contract types are locked and cannot be changed");
        }
    }
    const contractTypesJson = serializeAllowedContractTypes(allowedContractTypes);
    await env.DB.prepare(`INSERT INTO owner_sub_admins (
       wallet, note, created_by, updated_by, created_at, updated_at,
       allowed_contract_types_json, contract_types_locked_at, enabled
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(wallet) DO UPDATE SET
       note = excluded.note,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at,
       allowed_contract_types_json = CASE
         WHEN owner_sub_admins.contract_types_locked_at IS NULL THEN excluded.allowed_contract_types_json
         ELSE owner_sub_admins.allowed_contract_types_json
       END,
       contract_types_locked_at = COALESCE(owner_sub_admins.contract_types_locked_at, excluded.contract_types_locked_at),
       enabled = 1`)
        .bind(wallet, body.note?.trim() || null, actorWallet.toLowerCase(), actorWallet.toLowerCase(), now, now, contractTypesJson, now)
        .run();
    await env.DB.prepare(`INSERT INTO users (id, wallet, email, role, created_at, updated_at)
     VALUES (?, ?, NULL, 'subadmin', ?, ?)
     ON CONFLICT(wallet) DO UPDATE SET role='subadmin', updated_at=excluded.updated_at`)
        .bind(createId("usr"), wallet, now, now)
        .run();
    await writeOwnerAudit(env, {
        action: "subadmin.add",
        actorWallet,
        targetWallet: wallet,
        payload: { note: body.note?.trim() || null, allowedContractTypes },
        request,
    });
    return json({ ok: true, wallet, allowedContractTypes });
}
async function handleSubAdminRemove(request, env, actorWallet, walletParam) {
    await ensureSubAdminTable(env);
    const wallet = normalizeAddr(decodeURIComponent(walletParam));
    if (!wallet)
        return badRequest("Invalid wallet");
    const ownerWallet = await getPrimaryOwnerWallet(env);
    if (ownerWallet && wallet.toLowerCase() === ownerWallet.toLowerCase()) {
        return badRequest("Owner wallet cannot be removed");
    }
    const now = nowIso();
    const update = await env.DB.prepare(`UPDATE owner_sub_admins
     SET enabled = 0, updated_by = ?, updated_at = ?
     WHERE wallet = ? AND enabled = 1`)
        .bind(actorWallet.toLowerCase(), now, wallet)
        .run();
    await writeOwnerAudit(env, {
        action: "subadmin.remove",
        actorWallet,
        targetWallet: wallet,
        payload: { changed: Number(update.meta?.changes ?? 0) > 0 },
        request,
    });
    return json({ ok: true, wallet, removed: Number(update.meta?.changes ?? 0) > 0 });
}
// ---- Router ----
export async function handleOwner(request, env, pathParts) {
    // public: login
    if (pathParts[0] === "auth" && pathParts[1] === "login" && request.method === "POST") {
        return handleLogin(request, env);
    }
    // Everything else requires auth
    const sensitive = request.method !== "GET"; // sensitive writes require extra signature
    const a = await auth(request, env, sensitive);
    if (!a.ok)
        return a.response;
    const actor = a.wallet;
    const primaryOwner = await getPrimaryOwnerWallet(env);
    const isPrimaryOwner = !primaryOwner || actor.toLowerCase() === primaryOwner.toLowerCase();
    if (pathParts[0] === "auth" && pathParts[1] === "logout" && request.method === "POST") {
        await env.DB.prepare("UPDATE owner_sessions SET revoked=1 WHERE wallet = ? AND revoked = 0").bind(actor).run();
        await writeOwnerAudit(env, { action: "auth.logout", actorWallet: actor, request });
        return json({ ok: true });
    }
    if (!isPrimaryOwner) {
        return unauthorized("Only primary owner can access owner console APIs");
    }
    if (pathParts[0] === "overview" && request.method === "GET")
        return handleOverview(env);
    if (pathParts[0] === "super") {
        if (pathParts[1] === "balance" && request.method === "GET") {
            const url = new URL(request.url);
            const w = url.searchParams.get("wallet");
            if (!w)
                return badRequest("wallet param required");
            return handleSuperBalance(env, w);
        }
        if (pathParts[1] === "mint" && request.method === "POST")
            return handleSuperMint(request, env, actor);
        if (pathParts[1] === "transfer" && request.method === "POST")
            return handleSuperTransfer(request, env, actor);
        if (pathParts[1] === "airdrop" && request.method === "POST")
            return handleSuperAirdrop(request, env, actor);
        if (pathParts[1] === "burn" && request.method === "POST")
            return handleSuperBurn(request, env, actor);
        if (pathParts[1] === "grant-priced" && request.method === "POST")
            return handleSuperGrantPriced(request, env, actor);
        if (pathParts[1] === "supply" && request.method === "GET") {
            const relayer = tryCreateRelayer(env);
            if (!relayer)
                return internalError("OWNER_PRIVATE_KEY not configured");
            const s = await relayer.totalSuperSupply();
            return json(s);
        }
    }
    if (pathParts[0] === "locks") {
        if (request.method === "GET")
            return handleLocksList(request, env);
        if (request.method === "POST" && pathParts[1] && pathParts[2] === "unlock") {
            return handleLockManualUnlock(request, env, pathParts[1], actor);
        }
    }
    if (pathParts[0] === "earnings") {
        if (pathParts[1] === "overview" && request.method === "GET")
            return handleEarningsOverview(env);
        if (pathParts[1] === "settle" && pathParts[2] && request.method === "POST")
            return handleEarningsSettle(request, env, pathParts[2], actor);
        if (pathParts[1] === "adjust" && pathParts[2] && request.method === "POST")
            return handleEarningsAdjust(request, env, pathParts[2], actor);
    }
    if (pathParts[0] === "payouts" && pathParts[1] === "batch" && request.method === "POST") {
        return handlePayoutBatch(request, env, actor);
    }
    if (pathParts[0] === "ownership" && pathParts[1] === "transfer" && request.method === "POST") {
        return handleOwnershipTransfer(request, env, actor);
    }
    if (pathParts[0] === "subadmins") {
        if (request.method === "GET" && pathParts.length === 1)
            return handleSubAdminList(env);
        if (request.method === "POST" && pathParts.length === 1)
            return handleSubAdminAdd(request, env, actor);
        if (request.method === "DELETE" && pathParts.length === 2)
            return handleSubAdminRemove(request, env, actor, pathParts[1]);
    }
    if (pathParts[0] === "audit" && request.method === "GET")
        return handleAuditList(request, env);
    return notFound("Owner route not found");
}
