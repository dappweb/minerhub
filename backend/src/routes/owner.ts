import { getAddress, isAddress } from "ethers";
import { writeOwnerAudit } from "../lib/audit";
import { createId, nowIso } from "../lib/id";
import { isOwnerWallet, issueOwnerJwt, requireOwnerAuth, verifyLoginSignature } from "../lib/ownerAuth";
import { tryCreateRelayer } from "../lib/ownerRelayer";
import { badRequest, internalError, json, notFound, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

type OwnerAuthResult = { ok: true; wallet: string } | { ok: false; response: Response };

async function auth(request: Request, env: Env, sensitive = false): Promise<OwnerAuthResult> {
  return requireOwnerAuth(request, env, { sensitive });
}

async function parseJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

function normalizeAddr(addr: string): string | null {
  try {
    if (!isAddress(addr)) return null;
    return getAddress(addr).toLowerCase();
  } catch {
    return null;
  }
}

// ---- Auth: login / logout ----

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const body = await parseJson<{ wallet?: string; signature?: string; nonce?: string; ts?: number | string }>(request);
  if (!body?.wallet || !body?.signature || !body?.nonce || body?.ts === undefined) {
    return badRequest("wallet, signature, nonce, ts required");
  }
  if (!isOwnerWallet(env, body.wallet)) return unauthorized("Not owner wallet");

  // Nonce uniqueness (reuse KV)
  const kvKey = `owner-login-nonce:${body.nonce}`;
  if ((await env.CACHE.get(kvKey)) !== null) return unauthorized("Nonce already used");

  const v = verifyLoginSignature(body.wallet, body.signature, body.nonce, body.ts);
  if (!v.valid) return unauthorized(v.error || "Signature invalid");

  await env.CACHE.put(kvKey, "1", { expirationTtl: 600 });

  const { token, expiresAt } = await issueOwnerJwt(env, body.wallet);

  await env.DB.prepare(
    `INSERT INTO owner_sessions (id, wallet, issued_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      createId("sess"),
      body.wallet.toLowerCase(),
      nowIso(),
      expiresAt,
      request.headers.get("cf-connecting-ip") || null,
      request.headers.get("user-agent") || null
    )
    .run();

  await writeOwnerAudit(env, { action: "auth.login", actorWallet: body.wallet, request });
  return json({ token, expiresAt, wallet: body.wallet.toLowerCase() });
}

// ---- Overview ----

async function handleOverview(env: Env): Promise<Response> {
  const [users, devices, activeDevices, reward, payouts, totalMinted] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) as c FROM users").first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) as c FROM devices").first<{ c: number }>(),
    env.DB.prepare("SELECT COUNT(*) as c FROM devices WHERE status='active'").first<{ c: number }>(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(CAST(total_reward_usdt AS REAL)),0) as u, COALESCE(SUM(CAST(total_reward_super AS REAL)),0) as s FROM customer_profiles"
    ).first<{ u: number; s: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as c, COALESCE(SUM(CAST(total_usdt AS REAL)),0) as total FROM payout_batches WHERE status='completed'"
    ).first<{ c: number; total: number }>(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(CAST(payload_json AS TEXT)),0) as c FROM owner_audit_logs WHERE action='super.mint' AND status='ok'"
    ).first<{ c: number }>(),
  ]);

  const relayer = tryCreateRelayer(env);
  let onchain: Record<string, unknown> = { enabled: false };
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
    } catch (err) {
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

async function handleSuperBalance(env: Env, wallet: string): Promise<Response> {
  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  const addr = normalizeAddr(wallet);
  if (!addr) return badRequest("Invalid wallet");
  try {
    const bal = await relayer.getSuperBalance(addr);
    return json({ wallet: addr, balance: bal.formatted, raw: bal.raw, decimals: bal.decimals });
  } catch (err) {
    return internalError(err instanceof Error ? err.message : "rpc failed");
  }
}

async function enforceMintCap(env: Env, amountHuman: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.OWNER_MINT_DAILY_CAP) return { ok: true };
  const cap = Number(env.OWNER_MINT_DAILY_CAP);
  if (!Number.isFinite(cap) || cap <= 0) return { ok: true };
  const amount = Number(amountHuman);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: "Invalid amount" };
  const day = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare("SELECT total_super FROM owner_mint_counters WHERE day=?").bind(day).first<{ total_super: string }>();
  const cur = Number(row?.total_super ?? "0");
  if (cur + amount > cap) return { ok: false, error: `Daily mint cap exceeded (${cur}+${amount}>${cap})` };
  const next = (cur + amount).toString();
  await env.DB.prepare(
    `INSERT INTO owner_mint_counters (day, total_super, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET total_super = ?, updated_at = ?`
  ).bind(day, next, nowIso(), next, nowIso()).run();
  return { ok: true };
}

async function handleSuperMint(request: Request, env: Env, actorWallet: string): Promise<Response> {
  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  const body = await parseJson<{ to?: string; amount?: string | number }>(request);
  if (!body?.to || body?.amount === undefined) return badRequest("to, amount required");
  const to = normalizeAddr(body.to);
  if (!to) return badRequest("Invalid recipient");
  const amount = String(body.amount);
  const cap = await enforceMintCap(env, amount);
  if (!cap.ok) {
    await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: cap.error, request });
    return badRequest(cap.error);
  }
  try {
    const { txHash } = await relayer.mintSuper(to, amount);
    await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, txHash, request });
    return json({ ok: true, txHash, to, amount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "mint failed";
    await writeOwnerAudit(env, { action: "super.mint", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: msg, request });
    return internalError(msg);
  }
}

async function handleSuperTransfer(request: Request, env: Env, actorWallet: string): Promise<Response> {
  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  const body = await parseJson<{ to?: string; amount?: string | number }>(request);
  if (!body?.to || body?.amount === undefined) return badRequest("to, amount required");
  const to = normalizeAddr(body.to);
  if (!to) return badRequest("Invalid recipient");
  const amount = String(body.amount);
  try {
    const { txHash } = await relayer.transferSuper(to, amount);
    await writeOwnerAudit(env, { action: "super.transfer", actorWallet, targetWallet: to, payload: { amount }, txHash, request });
    return json({ ok: true, txHash, to, amount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "transfer failed";
    await writeOwnerAudit(env, { action: "super.transfer", actorWallet, targetWallet: to, payload: { amount }, status: "failed", error: msg, request });
    return internalError(msg);
  }
}

async function handleSuperAirdrop(request: Request, env: Env, actorWallet: string): Promise<Response> {
  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  const body = await parseJson<{ mode?: "mint" | "transfer"; items?: Array<{ wallet: string; amount: string | number }> }>(request);
  if (!body?.items?.length) return badRequest("items[] required");
  if (body.items.length > 200) return badRequest("Max 200 items per batch");
  const mode = body.mode === "transfer" ? "transfer" : "mint";
  const results: Array<{ wallet: string; amount: string; txHash?: string; error?: string }> = [];

  for (const item of body.items) {
    const w = normalizeAddr(item.wallet);
    const amount = String(item.amount);
    if (!w) {
      results.push({ wallet: item.wallet, amount, error: "invalid address" });
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
    } catch (err) {
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

async function handleSuperBurn(request: Request, env: Env, actorWallet: string): Promise<Response> {
  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  const body = await parseJson<{ from?: string; amount?: string | number }>(request);
  if (body?.amount === undefined) return badRequest("amount required");
  const amount = String(body.amount);
  try {
    if (body.from && normalizeAddr(body.from) !== relayer.address.toLowerCase()) {
      const from = normalizeAddr(body.from)!;
      const { txHash } = await relayer.burnFromSuper(from, amount);
      await writeOwnerAudit(env, { action: "super.burnFrom", actorWallet, targetWallet: from, payload: { amount }, txHash, request });
      return json({ ok: true, txHash, from, amount });
    }
    const { txHash } = await relayer.burnOwnSuper(amount);
    await writeOwnerAudit(env, { action: "super.burn", actorWallet, payload: { amount }, txHash, request });
    return json({ ok: true, txHash, amount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "burn failed";
    await writeOwnerAudit(env, { action: "super.burn", actorWallet, payload: { amount }, status: "failed", error: msg, request });
    return internalError(msg);
  }
}

// ---- Earnings ----

async function handleEarningsOverview(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT
      u.id AS userId, u.wallet AS wallet, cp.nickname AS nickname,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      COALESCE(cp.reward_rate_usdt_per_hour, '0') AS rateUsdtPerHour,
      COALESCE(cp.online_status, 'offline') AS onlineStatus,
      cp.last_seen_at AS lastSeenAt,
      (SELECT MAX(accrued_to) FROM reward_ledger WHERE reward_ledger.user_id = u.id) AS lastAccruedTo
     FROM users u
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     ORDER BY u.created_at DESC`
  ).all();
  return json({ items: results ?? [] });
}

async function handleEarningsSettle(request: Request, env: Env, userId: string, actorWallet: string): Promise<Response> {
  const body = await parseJson<{ hours?: number; rateUsdtPerHour?: string | number; deviceId?: string | null; note?: string }>(request);
  if (!body?.hours || body.hours <= 0) return badRequest("hours > 0 required");
  const profile = await env.DB.prepare(
    `SELECT reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id=?`
  ).bind(userId).first<{ reward_rate_usdt_per_hour: string; total_reward_usdt: string; total_reward_super: string }>();
  if (!profile) return notFound("User not found");

  const rate = Number(body.rateUsdtPerHour ?? profile.reward_rate_usdt_per_hour ?? "0");
  const usdt = Number(body.hours) * rate;
  if (!Number.isFinite(usdt) || usdt < 0) return badRequest("Invalid amount");

  const now = nowIso();
  const id = createId("rwd");
  await env.DB.prepare(
    `INSERT INTO reward_ledger (id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, accrued_from, accrued_to, source, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '0', ?, ?, ?, 'owner.settle', ?, ?, ?)`
  ).bind(id, userId, body.deviceId ?? null, usdt.toString(), rate.toString(), null, now, body.note ?? null, now, now).run();

  const nextUsdt = (Number(profile.total_reward_usdt || "0") + usdt).toString();
  await env.DB.prepare("UPDATE customer_profiles SET total_reward_usdt=?, updated_at=? WHERE user_id=?").bind(nextUsdt, now, userId).run();

  await writeOwnerAudit(env, { action: "earnings.settle", actorWallet, targetUserId: userId, payload: { hours: body.hours, rate, usdt }, request });
  return json({ ok: true, rewardId: id, usdt, rate, totalRewardUsdt: nextUsdt });
}

async function handleEarningsAdjust(request: Request, env: Env, userId: string, actorWallet: string): Promise<Response> {
  const body = await parseJson<{ deltaUsdt?: string | number; deltaSuper?: string | number; note?: string }>(request);
  if (!body || (body.deltaUsdt === undefined && body.deltaSuper === undefined)) {
    return badRequest("deltaUsdt or deltaSuper required");
  }
  const du = Number(body.deltaUsdt ?? 0);
  const ds = Number(body.deltaSuper ?? 0);
  const profile = await env.DB.prepare(
    `SELECT total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id=?`
  ).bind(userId).first<{ total_reward_usdt: string; total_reward_super: string }>();
  if (!profile) return notFound("User not found");

  const nextUsdt = (Number(profile.total_reward_usdt || "0") + du).toString();
  const nextSuper = (Number(profile.total_reward_super || "0") + ds).toString();

  const now = nowIso();
  const id = createId("rwd");
  await env.DB.prepare(
    `INSERT INTO reward_ledger (id, user_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, '0', 'owner.adjust', ?, ?, ?)`
  ).bind(id, userId, du.toString(), ds.toString(), body.note ?? null, now, now).run();

  await env.DB.prepare(
    "UPDATE customer_profiles SET total_reward_usdt=?, total_reward_super=?, updated_at=? WHERE user_id=?"
  ).bind(nextUsdt, nextSuper, now, userId).run();

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

async function handlePayoutBatch(request: Request, env: Env, actorWallet: string): Promise<Response> {
  const body = await parseJson<{
    dryRun?: boolean;
    note?: string;
    items?: Array<{ userId?: string; wallet: string; amountUsdt: string | number; exchangeOrderId?: string }>;
  }>(request);
  if (!body?.items?.length) return badRequest("items[] required");
  if (body.items.length > 100) return badRequest("Max 100 items per batch");

  const items = body.items.map((it) => ({
    userId: it.userId ?? null,
    wallet: normalizeAddr(it.wallet),
    amount: String(it.amountUsdt),
    exchangeOrderId: it.exchangeOrderId ?? null,
  }));
  const invalid = items.find((x) => !x.wallet || !Number.isFinite(Number(x.amount)) || Number(x.amount) <= 0);
  if (invalid) return badRequest("Invalid item (wallet or amount)");

  const total = items.reduce((s, x) => s + Number(x.amount), 0);

  if (body.dryRun) {
    return json({ ok: true, dryRun: true, total, count: items.length, items });
  }

  const relayer = tryCreateRelayer(env);
  if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
  if (!env.USDT_TOKEN_ADDRESS) return internalError("USDT_TOKEN_ADDRESS not configured");

  const batchId = createId("pbh");
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO payout_batches (id, wallet_address, total_usdt, status, note, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'processing', ?, ?, ?, ?)`
  ).bind(batchId, relayer.address.toLowerCase(), total.toString(), body.note ?? null, actorWallet, now, now).run();

  const outcomes: Array<{ wallet: string; amount: string; txHash?: string; error?: string }> = [];
  for (const it of items) {
    const itemId = createId("pbi");
    await env.DB.prepare(
      `INSERT INTO payout_batch_items (id, batch_id, exchange_order_id, user_id, amount_usdt, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'processing', ?, ?)`
    ).bind(itemId, batchId, it.exchangeOrderId ?? "", it.userId ?? "", it.amount, now, now).run();

    try {
      const { txHash } = await relayer.transferUsdt(it.wallet as string, it.amount);
      await env.DB.prepare(
        "UPDATE payout_batch_items SET status='completed', tx_hash=?, updated_at=? WHERE id=?"
      ).bind(txHash, nowIso(), itemId).run();
      outcomes.push({ wallet: it.wallet as string, amount: it.amount, txHash });
      await writeOwnerAudit(env, {
        action: "payout.item",
        actorWallet,
        targetUserId: it.userId ?? null,
        targetWallet: it.wallet,
        payload: { amount: it.amount, batchId, itemId },
        txHash,
        request,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "tx failed";
      await env.DB.prepare(
        "UPDATE payout_batch_items SET status='failed', updated_at=? WHERE id=?"
      ).bind(nowIso(), itemId).run();
      outcomes.push({ wallet: it.wallet as string, amount: it.amount, error: msg });
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
  await env.DB.prepare(
    "UPDATE payout_batches SET status=?, updated_at=? WHERE id=?"
  ).bind(anyFailed ? "partial" : "completed", nowIso(), batchId).run();

  await writeOwnerAudit(env, {
    action: "payout.batch",
    actorWallet,
    payload: { batchId, total, count: items.length, failedCount: outcomes.filter((x) => x.error).length },
    request,
  });

  return json({ ok: true, batchId, total, count: items.length, outcomes });
}

// ---- Audit query ----

async function handleAuditList(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const action = url.searchParams.get("action");
  const target = url.searchParams.get("target"); // target_wallet
  const actor = url.searchParams.get("actor");
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") || 100)));
  const cursor = url.searchParams.get("cursor");

  const where: string[] = [];
  const binds: unknown[] = [];
  if (action) { where.push("action = ?"); binds.push(action); }
  if (target) { where.push("target_wallet = ?"); binds.push(target.toLowerCase()); }
  if (actor)  { where.push("actor_wallet = ?"); binds.push(actor.toLowerCase()); }
  if (cursor) { where.push("created_at < ?"); binds.push(cursor); }

  const sql = `SELECT id, actor_wallet, action, target_user_id, target_wallet, payload_json, tx_hash, status, error_message, ip, user_agent, created_at
               FROM owner_audit_logs ${where.length ? "WHERE " + where.join(" AND ") : ""}
               ORDER BY created_at DESC LIMIT ?`;
  const { results } = await env.DB.prepare(sql).bind(...binds, limit).all();
  const items = (results ?? []).map((r: any) => ({
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

function safeParse(x: string): unknown {
  try { return JSON.parse(x); } catch { return x; }
}

// ---- Router ----

export async function handleOwner(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  // public: login
  if (pathParts[0] === "auth" && pathParts[1] === "login" && request.method === "POST") {
    return handleLogin(request, env);
  }

  // Everything else requires auth
  const sensitive = request.method !== "GET"; // sensitive writes require extra signature
  const a = await auth(request, env, sensitive);
  if (!a.ok) return a.response;
  const actor = a.wallet;

  if (pathParts[0] === "auth" && pathParts[1] === "logout" && request.method === "POST") {
    await writeOwnerAudit(env, { action: "auth.logout", actorWallet: actor, request });
    return json({ ok: true });
  }

  if (pathParts[0] === "overview" && request.method === "GET") return handleOverview(env);

  if (pathParts[0] === "super") {
    if (pathParts[1] === "balance" && request.method === "GET") {
      const url = new URL(request.url);
      const w = url.searchParams.get("wallet");
      if (!w) return badRequest("wallet param required");
      return handleSuperBalance(env, w);
    }
    if (pathParts[1] === "mint"     && request.method === "POST") return handleSuperMint(request, env, actor);
    if (pathParts[1] === "transfer" && request.method === "POST") return handleSuperTransfer(request, env, actor);
    if (pathParts[1] === "airdrop"  && request.method === "POST") return handleSuperAirdrop(request, env, actor);
    if (pathParts[1] === "burn"     && request.method === "POST") return handleSuperBurn(request, env, actor);
    if (pathParts[1] === "supply"   && request.method === "GET") {
      const relayer = tryCreateRelayer(env);
      if (!relayer) return internalError("OWNER_PRIVATE_KEY not configured");
      const s = await relayer.totalSuperSupply();
      return json(s);
    }
  }

  if (pathParts[0] === "earnings") {
    if (pathParts[1] === "overview" && request.method === "GET") return handleEarningsOverview(env);
    if (pathParts[1] === "settle" && pathParts[2] && request.method === "POST") return handleEarningsSettle(request, env, pathParts[2], actor);
    if (pathParts[1] === "adjust" && pathParts[2] && request.method === "POST") return handleEarningsAdjust(request, env, pathParts[2], actor);
  }

  if (pathParts[0] === "payouts" && pathParts[1] === "batch" && request.method === "POST") {
    return handlePayoutBatch(request, env, actor);
  }

  if (pathParts[0] === "audit" && request.method === "GET") return handleAuditList(request, env);

  return notFound("Owner route not found");
}
