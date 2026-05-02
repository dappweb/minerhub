import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { isOwnerWallet } from "../lib/ownerAuth";
import { badRequest, internalError, json, unauthorized } from "../lib/response";
import { readSystemStatus } from "../lib/system";
import type { Env } from "../types/env";

type ExchangeOrder = {
  id: string;
  user_id: string;
  wallet: string;
  amount_super: string;
  amount_usdt: string;
  mode: string;
  status: string;
  request_note: string | null;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  payout_wallet: string | null;
  tx_hash: string | null;
  super_tx_hash: string | null;
  usdt_tx_hash: string | null;
  created_at: string;
  updated_at: string;
};

let exchangeOrderColumnsReady = false;

async function ensureExchangeOrderColumns(env: Env): Promise<void> {
  if (exchangeOrderColumnsReady) return;
  const info = await env.DB.prepare("PRAGMA table_info(exchange_orders)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((row) => row.name));
  const statements: string[] = [];
  if (!columns.has("super_tx_hash")) statements.push("ALTER TABLE exchange_orders ADD COLUMN super_tx_hash TEXT");
  if (!columns.has("usdt_tx_hash")) statements.push("ALTER TABLE exchange_orders ADD COLUMN usdt_tx_hash TEXT");
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  exchangeOrderColumnsReady = true;
}

async function requireOwner(request: Request, env: Env): Promise<{ wallet: string } | Response> {
  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || "Signature verification failed");
  }
  if (!(await isOwnerWallet(env, auth.wallet ?? null))) {
    return unauthorized("Owner wallet required");
  }
  return { wallet: auth.wallet!.toLowerCase() };
}

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

async function updateProfileTotalRewards(env: Env, userId: string, rewardUsdtDelta: number, rewardSuperDelta: number): Promise<void> {
  await ensureCustomerProfile(env, userId);
  await env.DB.prepare(
    `UPDATE customer_profiles
     SET total_reward_usdt = CAST(ROUND(CAST(total_reward_usdt AS REAL) + ?, 6) AS TEXT),
         total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) + ?, 6) AS TEXT),
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(rewardUsdtDelta, rewardSuperDelta, nowIso(), userId)
    .run();
}

async function handleBatchRewards(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const body = (await request.json().catch(() => null)) as {
    items?: Array<{
      userId: string;
      deviceId?: string;
      rewardUsdt?: string | number;
      rewardSuper?: string | number;
      rateUsdtPerHour?: string | number;
      source?: string;
      note?: string;
      accruedFrom?: string;
      accruedTo?: string;
    }>;
  } | null;
  if (!body?.items?.length) return badRequest("items is required");

  const now = nowIso();
  const inserted: string[] = [];
  for (const item of body.items) {
    if (!item?.userId) continue;
    const rewardUsdt = Number(item.rewardUsdt ?? 0);
    const rewardSuper = Number(item.rewardSuper ?? 0);
    if (!Number.isFinite(rewardUsdt) && !Number.isFinite(rewardSuper)) continue;
    if ((Number.isFinite(rewardUsdt) && rewardUsdt < 0) || (Number.isFinite(rewardSuper) && rewardSuper < 0)) {
      return badRequest("Batch rewards do not allow negative amounts");
    }

    await ensureCustomerProfile(env, item.userId);

    const source = item.source ?? "batch_manual";
    const dedupe = await env.DB.prepare(
      `SELECT id FROM reward_ledger
       WHERE user_id = ?
         AND COALESCE(device_id, '') = COALESCE(?, '')
         AND COALESCE(accrued_from, '') = COALESCE(?, '')
         AND COALESCE(accrued_to, '') = COALESCE(?, '')
         AND source = ?
       LIMIT 1`
    )
      .bind(item.userId, item.deviceId ?? null, item.accruedFrom ?? null, item.accruedTo ?? null, source)
      .first<{ id: string }>();
    if (dedupe?.id) {
      continue;
    }

    const rowId = createId("rwd");
    await env.DB.prepare(
      `INSERT INTO reward_ledger (
        id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
        accrued_from, accrued_to, source, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        rowId,
        item.userId,
        item.deviceId ?? null,
        String(Number.isFinite(rewardUsdt) ? rewardUsdt : 0),
        String(Number.isFinite(rewardSuper) ? rewardSuper : 0),
        String(item.rateUsdtPerHour ?? 0),
        item.accruedFrom ?? null,
        item.accruedTo ?? null,
        source,
        item.note ?? null,
        now,
        now,
      )
      .run();

    await updateProfileTotalRewards(
      env,
      item.userId,
      Number.isFinite(rewardUsdt) ? rewardUsdt : 0,
      Number.isFinite(rewardSuper) ? rewardSuper : 0,
    );
    inserted.push(rowId);
  }

  return json({ ok: true, count: inserted.length, ids: inserted });
}

async function handleExchangeList(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;
  await ensureExchangeOrderColumns(env);

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const userId = searchParams.get("userId");

  const clauses: string[] = [];
  const binds: string[] = [];
  if (status) {
    clauses.push("status = ?");
    binds.push(status);
  }
  if (userId) {
    clauses.push("user_id = ?");
    binds.push(userId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const query = `SELECT * FROM exchange_orders ${where} ORDER BY created_at DESC LIMIT 300`;
  const stmt = env.DB.prepare(query).bind(...binds);
  const rows = await stmt.all<ExchangeOrder>();
  return json({ items: rows.results ?? [] });
}

async function handleExchangeApprove(request: Request, env: Env, orderId: string): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;
  await ensureExchangeOrderColumns(env);

  const order = await env.DB.prepare("SELECT * FROM exchange_orders WHERE id = ?")
    .bind(orderId)
    .first<ExchangeOrder>();
  if (!order) return json({ error: "Exchange order not found" }, 404);
  if (order.status !== "manual_pending" && order.status !== "auto_processing") {
    return badRequest("Order cannot be approved in current status");
  }

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE exchange_orders
     SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?
     WHERE id = ?`
  )
    .bind(owner.wallet, now, now, orderId)
    .run();

  return json({ ok: true, id: orderId, status: "approved", approvedAt: now, approvedBy: owner.wallet });
}

async function handleExchangeComplete(request: Request, env: Env, orderId: string): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;
  await ensureExchangeOrderColumns(env);

  const body = (await request.json().catch(() => null)) as {
    payoutWallet?: string;
    txHash?: string;
    usdtTxHash?: string;
    amountUsdt?: string | number;
  } | null;
  const payoutWallet = body?.payoutWallet?.trim().toLowerCase();

  const order = await env.DB.prepare("SELECT * FROM exchange_orders WHERE id = ?")
    .bind(orderId)
    .first<ExchangeOrder>();
  if (!order) return json({ error: "Exchange order not found" }, 404);
  if (order.status !== "approved" && order.status !== "auto_processing" && order.status !== "manual_pending") {
    return badRequest("Order cannot be completed in current status");
  }

  const amountUsdt = Number(body?.amountUsdt ?? order.amount_usdt ?? "0");
  if (!Number.isFinite(amountUsdt) || amountUsdt <= 0) {
    return badRequest("Invalid order amountUsdt");
  }

  const now = nowIso();
  const usdtTxHash = body?.usdtTxHash?.trim() || body?.txHash?.trim() || null;
  await env.DB.prepare(
    `UPDATE exchange_orders
     SET status = 'completed',
         amount_usdt = ?,
         payout_wallet = ?,
         tx_hash = ?,
         usdt_tx_hash = ?,
         approved_by = COALESCE(approved_by, ?),
         approved_at = COALESCE(approved_at, ?),
         completed_at = ?,
         updated_at = ?
     WHERE id = ?`
  )
    .bind(String(amountUsdt), payoutWallet ?? null, usdtTxHash, usdtTxHash, owner.wallet, now, now, now, orderId)
    .run();

  await env.DB.prepare(
    `UPDATE swap_trade_logs
     SET status = 'completed', amount_out = ?, tx_hash = ?, note = ?, updated_at = ?
     WHERE id = (
       SELECT id
       FROM swap_trade_logs
       WHERE user_id = ? AND status IN ('manual_pending', 'auto_processing', 'approved', 'submitted')
       ORDER BY created_at DESC
       LIMIT 1
     )`
  )
    .bind(String(amountUsdt), usdtTxHash, `exchange completed; SUPER tx: ${order.super_tx_hash ?? "-"}; USDT tx: ${usdtTxHash ?? "-"}`, now, order.user_id)
    .run();

  return json({ ok: true, id: orderId, status: "completed", amountUsdt: String(amountUsdt), txHash: usdtTxHash, usdtTxHash, completedAt: now });
}

async function handleSwapLogs(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const { results } = await env.DB.prepare(
    "SELECT * FROM swap_trade_logs ORDER BY created_at DESC LIMIT 500"
  ).all<{
    id: string;
    user_id: string | null;
    wallet: string | null;
    direction: string;
    amount_in: string;
    amount_out: string;
    price_snapshot: string;
    status: string;
    tx_hash: string | null;
    note: string | null;
    created_at: string;
    updated_at: string;
  }>();
  return json({ items: results ?? [] });
}

async function handleSwapPriceUpdate(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const body = (await request.json().catch(() => null)) as { priceSuperPerUsdt?: string | number; note?: string } | null;
  const price = Number(body?.priceSuperPerUsdt ?? "0");
  if (!Number.isFinite(price) || price <= 0) {
    return badRequest("priceSuperPerUsdt must be positive");
  }

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES ('swap_price_super_per_usdt', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(String(price), now)
    .run();

  await env.DB.prepare(
    "INSERT INTO swap_price_history (id, price_super_per_usdt, source, operator_wallet, note, created_at) VALUES (?, ?, 'admin', ?, ?, ?)"
  )
    .bind(createId("sph"), String(price), owner.wallet, body?.note?.trim() || null, now)
    .run();

  return json({ ok: true, priceSuperPerUsdt: price, updatedAt: now });
}

async function handlePayoutBatchList(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const { results } = await env.DB.prepare("SELECT * FROM payout_batches ORDER BY created_at DESC LIMIT 200")
    .all<{
      id: string;
      wallet_address: string;
      total_usdt: string;
      status: string;
      note: string | null;
      created_by: string | null;
      created_at: string;
      updated_at: string;
    }>();
  return json({ items: results ?? [] });
}

async function handlePayoutBatchCreate(request: Request, env: Env): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const body = (await request.json().catch(() => null)) as {
    exchangeOrderIds?: string[];
    payoutWallet?: string;
    note?: string;
  } | null;
  if (!body?.exchangeOrderIds?.length) {
    return badRequest("exchangeOrderIds is required");
  }

  const status = await readSystemStatus(env);
  let payoutWallet = body.payoutWallet?.trim().toLowerCase() || "";
  if (!payoutWallet) {
    try {
      const wallets = JSON.parse(status.payoutWalletsJson) as Array<{ walletAddress: string; priority?: number; isPrimary?: boolean }>;
      const sorted = wallets.slice().sort((a, b) => {
        if (Boolean(a.isPrimary) !== Boolean(b.isPrimary)) return Boolean(a.isPrimary) ? -1 : 1;
        return Number(a.priority ?? 0) - Number(b.priority ?? 0);
      });
      payoutWallet = sorted[0]?.walletAddress?.toLowerCase() ?? "";
    } catch {
      payoutWallet = "";
    }
  }
  if (!payoutWallet) {
    return badRequest("No payout wallet available. Configure payout wallets first.");
  }

  let totalUsdt = 0;
  const selected: ExchangeOrder[] = [];
  for (const exchangeOrderId of body.exchangeOrderIds) {
    const order = await env.DB.prepare("SELECT * FROM exchange_orders WHERE id = ?")
      .bind(exchangeOrderId)
      .first<ExchangeOrder>();
    if (!order || order.status !== "approved") continue;
    const amount = Number(order.amount_usdt ?? "0");
    if (!Number.isFinite(amount) || amount <= 0) continue;
    totalUsdt += amount;
    selected.push(order);
  }

  if (!selected.length) {
    return badRequest("No approved exchange orders selected");
  }

  const now = nowIso();
  const batchId = createId("pob");
  await env.DB.prepare(
    "INSERT INTO payout_batches (id, wallet_address, total_usdt, status, note, created_by, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)"
  )
    .bind(batchId, payoutWallet, totalUsdt.toFixed(6), body.note?.trim() || null, owner.wallet, now, now)
    .run();

  for (const order of selected) {
    await env.DB.prepare(
      "INSERT INTO payout_batch_items (id, batch_id, exchange_order_id, user_id, amount_usdt, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)"
    )
      .bind(createId("poi"), batchId, order.id, order.user_id, order.amount_usdt, now, now)
      .run();

    await env.DB.prepare("UPDATE exchange_orders SET status = 'payout_queued', payout_wallet = ?, updated_at = ? WHERE id = ?")
      .bind(payoutWallet, now, order.id)
      .run();
  }

  return json({ ok: true, batchId, payoutWallet, totalUsdt: totalUsdt.toFixed(6), orderCount: selected.length }, 201);
}

async function handlePayoutBatchComplete(request: Request, env: Env, batchId: string): Promise<Response> {
  const owner = await requireOwner(request, env);
  if (owner instanceof Response) return owner;

  const body = (await request.json().catch(() => null)) as { txHash?: string } | null;
  const now = nowIso();

  const batch = await env.DB.prepare("SELECT * FROM payout_batches WHERE id = ?")
    .bind(batchId)
    .first<{ id: string; status: string }>();
  if (!batch) return json({ error: "Payout batch not found" }, 404);
  if (batch.status === "completed") {
    return json({ ok: true, id: batchId, status: "completed", completedAt: now });
  }

  const items = await env.DB.prepare("SELECT id, exchange_order_id FROM payout_batch_items WHERE batch_id = ?")
    .bind(batchId)
    .all<{ id: string; exchange_order_id: string }>();

  await env.DB.prepare("UPDATE payout_batches SET status = 'completed', updated_at = ? WHERE id = ?")
    .bind(now, batchId)
    .run();

  await env.DB.prepare("UPDATE payout_batch_items SET status = 'completed', tx_hash = ?, updated_at = ? WHERE batch_id = ?")
    .bind(body?.txHash ?? null, now, batchId)
    .run();

  for (const item of items.results ?? []) {
    await env.DB.prepare(
      "UPDATE exchange_orders SET status = 'paid', tx_hash = ?, completed_at = ?, updated_at = ? WHERE id = ?"
    )
      .bind(body?.txHash ?? null, now, now, item.exchange_order_id)
      .run();
  }

  return json({ ok: true, id: batchId, status: "completed", completedAt: now, txHash: body?.txHash ?? null });
}

export async function handleOperations(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  try {
    if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "rewards" && pathParts[1] === "batch") {
      return handleBatchRewards(request, env);
    }

    if (request.method === "GET" && pathParts.length === 2 && pathParts[0] === "exchange" && pathParts[1] === "orders") {
      return handleExchangeList(request, env);
    }

    if (request.method === "POST" && pathParts.length === 4 && pathParts[0] === "exchange" && pathParts[1] === "orders" && pathParts[3] === "approve") {
      return handleExchangeApprove(request, env, pathParts[2]);
    }

    if (request.method === "POST" && pathParts.length === 4 && pathParts[0] === "exchange" && pathParts[1] === "orders" && pathParts[3] === "complete") {
      return handleExchangeComplete(request, env, pathParts[2]);
    }

    if (request.method === "GET" && pathParts.length === 2 && pathParts[0] === "swap" && pathParts[1] === "logs") {
      return handleSwapLogs(request, env);
    }

    if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "swap" && pathParts[1] === "price") {
      return handleSwapPriceUpdate(request, env);
    }

    if (request.method === "GET" && pathParts.length === 2 && pathParts[0] === "payout" && pathParts[1] === "batches") {
      return handlePayoutBatchList(request, env);
    }

    if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "payout" && pathParts[1] === "batches") {
      return handlePayoutBatchCreate(request, env);
    }

    if (request.method === "POST" && pathParts.length === 4 && pathParts[0] === "payout" && pathParts[1] === "batches" && pathParts[3] === "complete") {
      return handlePayoutBatchComplete(request, env, pathParts[2]);
    }

    return json({ error: "Unsupported operations route" }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(message);
  }
}
