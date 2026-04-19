import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { isOwnerWallet } from "../lib/ownerAuth";
import { badRequest, internalError, json, unauthorized } from "../lib/response";
import { runScheduledTasks } from "../lib/scheduled";
import type { Env } from "../types/env";

type CustomerSummary = {
  id: string;
  wallet: string;
  email: string | null;
  role: string | null;
  status: string | null;
  nickname: string | null;
  machineCode: string | null;
  contractStartAt: string | null;
  contractEndAt: string | null;
  contractActive: number;
  activationStatus: string;
  exchangeAutoEnabled: number;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  deviceCount: number;
  activeDeviceCount: number;
  subAccountCount: number;
};

type CustomerDetail = CustomerSummary & {
  contractTermDays: number;
  monthlyCardDays: number;
  rewardRateUsdtPerHour: string;
  parentUserId: string | null;
  agreementAcceptedAt: string | null;
  offlineAlertedAt: string | null;
  notes: string | null;
  payoutWallets: Array<{ walletAddress: string; priority: number; isPrimary: boolean }>;
  devices: Array<{
    id: string;
    deviceId: string;
    hashrate: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  subAccounts: Array<{
    id: string;
    childUserId: string;
    label: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  rewardLedger: Array<{
    id: string;
    deviceId: string | null;
    rewardUsdt: string;
    rewardSuper: string;
    rateUsdtPerHour: string;
    source: string;
    note: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
};

async function requireOwnerRead(request: Request, env: Env): Promise<Response | null> {
  const wallet = request.headers.get("x-wallet");
  if (!isOwnerWallet(env, wallet)) {
    return unauthorized("Owner wallet required");
  }
  return null;
}

async function requireOwner(request: Request, env: Env): Promise<Response | null> {
  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || "Signature verification failed");
  }

  if (!isOwnerWallet(env, auth.wallet ?? null)) {
    return unauthorized("Owner wallet required");
  }

  return null;
}

async function ensureProfile(env: Env, userId: string): Promise<void> {
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

function parsePayoutWallets(raw: string | null): Array<{ walletAddress: string; priority: number; isPrimary: boolean }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ walletAddress: string; priority?: number; isPrimary?: boolean }>;
    return parsed.map((item, index) => ({
      walletAddress: item.walletAddress,
      priority: Number.isFinite(item.priority as number) ? Number(item.priority) : index,
      isPrimary: Boolean(item.isPrimary),
    }));
  } catch {
    return [];
  }
}

function isNormalizedPayoutWallet(
  item: { walletAddress: string; priority: number; isPrimary: boolean } | null
): item is { walletAddress: string; priority: number; isPrimary: boolean } {
  return item !== null && Boolean(item.walletAddress);
}

async function readCustomerSummaries(env: Env): Promise<CustomerSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT
      u.id AS id, u.wallet AS wallet, u.email AS email, u.role AS role, NULL AS status,
      cp.nickname AS nickname, cp.machine_code AS machineCode, cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COUNT(DISTINCT d.id) AS deviceCount,
      SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS activeDeviceCount,
      COUNT(DISTINCT sa.id) AS subAccountCount
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN devices d ON d.user_id = u.id
    LEFT JOIN sub_accounts sa ON sa.owner_user_id = u.id
    GROUP BY u.id, u.wallet, u.email, u.role, cp.nickname, cp.machine_code, cp.contract_start_at,
             cp.contract_end_at, cp.contract_active, cp.activation_status, cp.exchange_auto_enabled,
             cp.total_reward_usdt, cp.total_reward_super, cp.last_seen_at, cp.online_status,
             cp.reward_rate_usdt_per_hour
    ORDER BY u.created_at DESC`
  ).all<CustomerSummary>();

  return (results ?? []).map((row) => ({
    ...row,
    deviceCount: Number((row as { deviceCount?: number }).deviceCount ?? 0),
    activeDeviceCount: Number((row as { activeDeviceCount?: number }).activeDeviceCount ?? 0),
    subAccountCount: Number((row as { subAccountCount?: number }).subAccountCount ?? 0),
  }));
}

async function getCustomerDetail(env: Env, userId: string): Promise<CustomerDetail | null> {
  await ensureProfile(env, userId);

  const customer = await env.DB.prepare(
    `SELECT
      u.id AS id, u.wallet AS wallet, u.email AS email, u.role AS role, NULL AS status,
      cp.nickname AS nickname, cp.machine_code AS machineCode, cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
      cp.parent_user_id AS parentUserId, cp.agreement_accepted_at AS agreementAcceptedAt, cp.offline_alerted_at AS offlineAlertedAt, cp.notes AS notes,
      COALESCE(cp.contract_term_days, 1095) AS contractTermDays,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COALESCE(cp.payout_wallets_json, '[]') AS payoutWalletsJson
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    WHERE u.id = ?`
  )
    .bind(userId)
    .first<CustomerDetail>();

  if (!customer) return null;

  const devices = await env.DB.prepare(
    `SELECT id, device_id, hashrate, status, created_at, updated_at
     FROM devices WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<{
      id: string;
      device_id: string;
      hashrate: number;
      status: string;
      created_at: string;
      updated_at: string;
    }>();

  const subAccounts = await env.DB.prepare(
    `SELECT id, child_user_id, label, created_at, updated_at
     FROM sub_accounts WHERE owner_user_id = ? ORDER BY created_at DESC`
  )
    .bind(userId)
    .all<{
      id: string;
      child_user_id: string;
      label: string | null;
      created_at: string;
      updated_at: string;
    }>();

  const rewardLedger = await env.DB.prepare(
    `SELECT id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at
     FROM reward_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
  )
    .bind(userId)
    .all<{
      id: string;
      device_id: string | null;
      reward_usdt: string;
      reward_super: string;
      rate_usdt_per_hour: string;
      source: string;
      note: string | null;
      created_at: string;
      updated_at: string;
    }>();

  const walletRows = await env.DB.prepare(
    `SELECT wallet_address, priority, is_primary FROM payout_wallets WHERE user_id = ? ORDER BY priority ASC, created_at ASC`
  )
    .bind(userId)
    .all<{
      wallet_address: string;
      priority: number;
      is_primary: number;
    }>();

  const summary = await env.DB.prepare(
    `SELECT COUNT(DISTINCT id) AS device_count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_device_count
     FROM devices WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ device_count: number; active_device_count: number }>();

  const lastSeenRaw = (customer as { lastSeenAt?: string | null }).lastSeenAt ?? null;
  const lastSeenAt = lastSeenRaw ? new Date(lastSeenRaw) : null;
  const offlineThresholdMs = 15 * 60 * 1000;
  const isOffline = !lastSeenAt || Number.isNaN(lastSeenAt.getTime()) || Date.now() - lastSeenAt.getTime() > offlineThresholdMs;

  return {
    ...customer,
    deviceCount: Number(summary?.device_count ?? devices.results?.length ?? 0),
    activeDeviceCount: Number(summary?.active_device_count ?? 0),
    subAccountCount: Number(subAccounts.results?.length ?? 0),
    payoutWallets: parsePayoutWallets((customer as { payoutWalletsJson?: string | null }).payoutWalletsJson ?? null),
    devices: (devices.results ?? []).map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      hashrate: Number(row.hashrate ?? 0),
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    subAccounts: (subAccounts.results ?? []).map((row) => ({
      id: row.id,
      childUserId: row.child_user_id,
      label: row.label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    rewardLedger: (rewardLedger.results ?? []).map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      rewardUsdt: row.reward_usdt,
      rewardSuper: row.reward_super,
      rateUsdtPerHour: row.rate_usdt_per_hour,
      source: row.source,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    lastSeenAt: lastSeenRaw,
    onlineStatus: isOffline ? "offline" : "online",
  } as CustomerDetail;
}

async function updateProfileField(env: Env, userId: string, key: string, value: string | number | null): Promise<void> {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO customer_profiles (user_id, created_at, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET updated_at = excluded.updated_at`
  )
    .bind(userId, now, now)
    .run();

  await env.DB.prepare(`UPDATE customer_profiles SET ${key} = ?, updated_at = ? WHERE user_id = ?`)
    .bind(value, now, userId)
    .run();
}

function calculateContractEnd(startAt: string, termDays: number): string {
  return new Date(new Date(startAt).getTime() + termDays * 24 * 60 * 60 * 1000).toISOString();
}

async function handleCustomerList(env: Env): Promise<Response> {
  return json({ items: await readCustomerSummaries(env) });
}

async function handleCustomerDetail(env: Env, userId: string): Promise<Response> {
  const detail = await getCustomerDetail(env, userId);
  if (!detail) {
    return json({ error: "Customer not found" }, 404);
  }
  return json(detail);
}

async function handleCustomerUpdate(request: Request, env: Env, userId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  await ensureProfile(env, userId);

  if (typeof body.nickname === "string") {
    await updateProfileField(env, userId, "nickname", body.nickname.trim() || null);
  }

  if (typeof body.machineCode === "string") {
    await updateProfileField(env, userId, "machine_code", body.machineCode.trim() || null);
  }

  if (typeof body.parentUserId === "string" || body.parentUserId === null) {
    await updateProfileField(env, userId, "parent_user_id", body.parentUserId ? String(body.parentUserId).trim() : null);
  }

  if (typeof body.exchangeAutoEnabled === "boolean") {
    await updateProfileField(env, userId, "exchange_auto_enabled", body.exchangeAutoEnabled ? 1 : 0);
  }

  if (typeof body.rewardRateUsdtPerHour === "string" || typeof body.rewardRateUsdtPerHour === "number") {
    await updateProfileField(env, userId, "reward_rate_usdt_per_hour", String(body.rewardRateUsdtPerHour));
  }

  if (typeof body.monthlyCardDays === "number" && Number.isFinite(body.monthlyCardDays)) {
    await updateProfileField(env, userId, "monthly_card_days", Math.max(1, Math.floor(body.monthlyCardDays)));
  }

  if (typeof body.contractTermDays === "number" && Number.isFinite(body.contractTermDays)) {
    await updateProfileField(env, userId, "contract_term_days", Math.max(1, Math.floor(body.contractTermDays)));
  }

  if (typeof body.contractActive === "boolean") {
    await updateProfileField(env, userId, "contract_active", body.contractActive ? 1 : 0);
    await updateProfileField(env, userId, "activation_status", body.contractActive ? "active" : "paused");
  }

  if (typeof body.notes === "string") {
    await updateProfileField(env, userId, "notes", body.notes.trim() || null);
  }

  if (Array.isArray(body.payoutWallets)) {
    const normalized = body.payoutWallets
      .map((item, index) => {
        if (typeof item === "string") {
          return { walletAddress: item, priority: index, isPrimary: index === 0 };
        }
        if (item && typeof item === "object" && typeof (item as { walletAddress?: unknown }).walletAddress === "string") {
          return {
            walletAddress: String((item as { walletAddress: string }).walletAddress).trim(),
            priority: Number((item as { priority?: unknown }).priority ?? index),
            isPrimary: Boolean((item as { isPrimary?: unknown }).isPrimary),
          };
        }
        return null;
      })
      .filter(isNormalizedPayoutWallet);

    await env.DB.prepare("DELETE FROM payout_wallets WHERE user_id = ?").bind(userId).run();
    for (const wallet of normalized) {
      await env.DB.prepare(
        `INSERT INTO payout_wallets (id, user_id, wallet_address, priority, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(createId("pwl"), userId, wallet.walletAddress.toLowerCase(), wallet.priority, wallet.isPrimary ? 1 : 0, nowIso(), nowIso())
        .run();
    }

    await updateProfileField(env, userId, "payout_wallets_json", JSON.stringify(normalized));
  }

  return handleCustomerDetail(env, userId);
}

async function handleCustomerActivate(request: Request, env: Env, userId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    machineCode?: string;
    contractTermYears?: number;
    contractTermDays?: number;
    contractStartAt?: string;
    agreementAccepted?: boolean;
  } | null;

  if (!body) return badRequest("Invalid JSON body");

  await ensureProfile(env, userId);

  const now = body.contractStartAt || nowIso();
  const termDays = Number.isFinite(body.contractTermDays ?? NaN)
    ? Math.max(1, Math.floor(body.contractTermDays as number))
    : Number.isFinite(body.contractTermYears ?? NaN)
      ? Math.max(1, Math.floor((body.contractTermYears as number) * 365))
      : 1095;

  await updateProfileField(env, userId, "machine_code", body.machineCode?.trim() ?? null);
  await updateProfileField(env, userId, "contract_start_at", now);
  await updateProfileField(env, userId, "contract_end_at", calculateContractEnd(now, termDays));
  await updateProfileField(env, userId, "contract_term_days", termDays);
  await updateProfileField(env, userId, "contract_active", 1);
  await updateProfileField(env, userId, "activation_status", "active");
  if (body.agreementAccepted) {
    await updateProfileField(env, userId, "agreement_accepted_at", nowIso());
  }

  return handleCustomerDetail(env, userId);
}

async function handleRewardAdjustment(request: Request, env: Env, userId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    rewardUsdt?: string | number;
    rewardSuper?: string | number;
    rateUsdtPerHour?: string | number;
    deviceId?: string;
    source?: string;
    note?: string;
    accruedFrom?: string;
    accruedTo?: string;
  } | null;

  if (!body) return badRequest("Invalid JSON body");

  const rewardUsdt = Number(body.rewardUsdt ?? 0);
  const rewardSuper = Number(body.rewardSuper ?? 0);
  if (!Number.isFinite(rewardUsdt) && !Number.isFinite(rewardSuper)) {
    return badRequest("rewardUsdt or rewardSuper is required");
  }

  const now = nowIso();
  const id = createId("rwd");
  await env.DB.prepare(
    `INSERT INTO reward_ledger (
      id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
      accrued_from, accrued_to, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      userId,
      body.deviceId ?? null,
      String(Number.isFinite(rewardUsdt) ? rewardUsdt : 0),
      String(Number.isFinite(rewardSuper) ? rewardSuper : 0),
      String(body.rateUsdtPerHour ?? 0),
      body.accruedFrom ?? null,
      body.accruedTo ?? null,
      body.source ?? "manual",
      body.note ?? null,
      now,
      now,
    )
    .run();

  const profile = await env.DB.prepare(
    `SELECT total_reward_usdt, total_reward_super FROM customer_profiles WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ total_reward_usdt: string; total_reward_super: string }>();

  const nextUsdt = (Number(profile?.total_reward_usdt ?? "0") + (Number.isFinite(rewardUsdt) ? rewardUsdt : 0)).toString();
  const nextSuper = (Number(profile?.total_reward_super ?? "0") + (Number.isFinite(rewardSuper) ? rewardSuper : 0)).toString();
  await updateProfileField(env, userId, "total_reward_usdt", nextUsdt);
  await updateProfileField(env, userId, "total_reward_super", nextSuper);

  return json({ ok: true, rewardId: id, totalRewardUsdt: nextUsdt, totalRewardSuper: nextSuper });
}

type RechargeRecord = {
  id: string;
  userId: string | null;
  wallet: string;
  payToken: string;
  payAmount: string;
  bnbAmount: string;
  status: string;
  relayMode: string;
  relayTxHash: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type WithdrawalRecord = {
  id: string;
  source: "claim" | "exchange";
  userId: string;
  wallet: string | null;
  amountUsdt: string;
  amountSuper: string;
  status: string;
  txHash: string | null;
  payoutWallet: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExchangeRecord = {
  id: string;
  userId: string | null;
  wallet: string | null;
  direction: string;
  amountIn: string;
  amountOut: string;
  priceSnapshot: string;
  status: string;
  txHash: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

function clampLimit(raw: string | null, fallback = 100, max = 500): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

async function handleRechargeRecords(env: Env, url: URL): Promise<Response> {
  const limit = clampLimit(url.searchParams.get("limit"));
  const wallet = url.searchParams.get("wallet")?.trim().toLowerCase();
  const status = url.searchParams.get("status")?.trim();

  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (wallet) {
    clauses.push("LOWER(wallet) = ?");
    params.push(wallet);
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, wallet, pay_token, pay_amount, bnb_amount, status, relay_mode,
            relay_tx_hash, error_message, created_at, updated_at
     FROM gas_orders ${where}
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(...params, limit)
    .all<{
      id: string;
      user_id: string | null;
      wallet: string;
      pay_token: string;
      pay_amount: string;
      bnb_amount: string;
      status: string;
      relay_mode: string;
      relay_tx_hash: string | null;
      error_message: string | null;
      created_at: string;
      updated_at: string;
    }>();

  const items: RechargeRecord[] = (results ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    wallet: row.wallet,
    payToken: row.pay_token,
    payAmount: row.pay_amount,
    bnbAmount: row.bnb_amount,
    status: row.status,
    relayMode: row.relay_mode,
    relayTxHash: row.relay_tx_hash,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return json({ items, limit });
}

async function handleWithdrawalRecords(env: Env, url: URL): Promise<Response> {
  const limit = clampLimit(url.searchParams.get("limit"));
  const userIdFilter = url.searchParams.get("userId")?.trim();
  const walletFilter = url.searchParams.get("wallet")?.trim().toLowerCase();
  const statusFilter = url.searchParams.get("status")?.trim();
  const source = url.searchParams.get("source")?.trim(); // 'claim' | 'exchange' | undefined

  const items: WithdrawalRecord[] = [];

  if (!source || source === "exchange") {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (userIdFilter) {
      clauses.push("eo.user_id = ?");
      params.push(userIdFilter);
    }
    if (walletFilter) {
      clauses.push("LOWER(eo.wallet) = ?");
      params.push(walletFilter);
    }
    if (statusFilter) {
      clauses.push("eo.status = ?");
      params.push(statusFilter);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const { results } = await env.DB.prepare(
      `SELECT eo.id AS id, eo.user_id AS user_id, eo.wallet AS wallet,
              eo.amount_super AS amount_super, eo.amount_usdt AS amount_usdt,
              eo.status AS status, eo.tx_hash AS tx_hash, eo.payout_wallet AS payout_wallet,
              eo.request_note AS request_note, eo.created_at AS created_at, eo.updated_at AS updated_at
       FROM exchange_orders eo ${where}
       ORDER BY eo.created_at DESC LIMIT ?`
    )
      .bind(...params, limit)
      .all<{
        id: string;
        user_id: string;
        wallet: string;
        amount_super: string;
        amount_usdt: string;
        status: string;
        tx_hash: string | null;
        payout_wallet: string | null;
        request_note: string | null;
        created_at: string;
        updated_at: string;
      }>();

    for (const row of results ?? []) {
      items.push({
        id: row.id,
        source: "exchange",
        userId: row.user_id,
        wallet: row.wallet,
        amountUsdt: row.amount_usdt,
        amountSuper: row.amount_super,
        status: row.status,
        txHash: row.tx_hash,
        payoutWallet: row.payout_wallet,
        note: row.request_note,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  }

  if (!source || source === "claim") {
    const clauses: string[] = [];
    const params: Array<string | number> = [];
    if (userIdFilter) {
      clauses.push("c.user_id = ?");
      params.push(userIdFilter);
    }
    if (walletFilter) {
      clauses.push("LOWER(u.wallet) = ?");
      params.push(walletFilter);
    }
    if (statusFilter) {
      clauses.push("c.status = ?");
      params.push(statusFilter);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const { results } = await env.DB.prepare(
      `SELECT c.id AS id, c.user_id AS user_id, u.wallet AS wallet,
              c.amount AS amount, c.status AS status, c.tx_hash AS tx_hash,
              c.created_at AS created_at, c.updated_at AS updated_at
       FROM claims c LEFT JOIN users u ON u.id = c.user_id ${where}
       ORDER BY c.created_at DESC LIMIT ?`
    )
      .bind(...params, limit)
      .all<{
        id: string;
        user_id: string;
        wallet: string | null;
        amount: string;
        status: string;
        tx_hash: string | null;
        created_at: string;
        updated_at: string;
      }>();

    for (const row of results ?? []) {
      items.push({
        id: row.id,
        source: "claim",
        userId: row.user_id,
        wallet: row.wallet,
        amountUsdt: row.amount,
        amountSuper: "0",
        status: row.status,
        txHash: row.tx_hash,
        payoutWallet: null,
        note: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  }

  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));

  return json({ items: items.slice(0, limit), limit });
}

async function handleExchangeRecords(env: Env, url: URL): Promise<Response> {
  const limit = clampLimit(url.searchParams.get("limit"));
  const userIdFilter = url.searchParams.get("userId")?.trim();
  const walletFilter = url.searchParams.get("wallet")?.trim().toLowerCase();
  const statusFilter = url.searchParams.get("status")?.trim();
  const direction = url.searchParams.get("direction")?.trim();

  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (userIdFilter) {
    clauses.push("user_id = ?");
    params.push(userIdFilter);
  }
  if (walletFilter) {
    clauses.push("LOWER(wallet) = ?");
    params.push(walletFilter);
  }
  if (statusFilter) {
    clauses.push("status = ?");
    params.push(statusFilter);
  }
  if (direction) {
    clauses.push("direction = ?");
    params.push(direction);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await env.DB.prepare(
    `SELECT id, user_id, wallet, direction, amount_in, amount_out, price_snapshot,
            status, tx_hash, note, created_at, updated_at
     FROM swap_trade_logs ${where}
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(...params, limit)
    .all<{
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

  const items: ExchangeRecord[] = (results ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    wallet: row.wallet,
    direction: row.direction,
    amountIn: row.amount_in,
    amountOut: row.amount_out,
    priceSnapshot: row.price_snapshot,
    status: row.status,
    txHash: row.tx_hash,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return json({ items, limit });
}

async function handleBulkRate(request: Request, env: Env): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    userIds?: string[];
    rewardRateUsdtPerHour?: string | number;
  } | null;
  if (!body?.userIds?.length) return badRequest("userIds required");
  if (body.rewardRateUsdtPerHour === undefined || body.rewardRateUsdtPerHour === null) {
    return badRequest("rewardRateUsdtPerHour required");
  }
  const rate = String(body.rewardRateUsdtPerHour);
  const parsed = Number(rate);
  if (!Number.isFinite(parsed) || parsed < 0) return badRequest("Invalid rate");

  let updated = 0;
  for (const userId of body.userIds) {
    if (!userId) continue;
    await ensureProfile(env, userId);
    await updateProfileField(env, userId, "reward_rate_usdt_per_hour", rate);
    updated += 1;
  }
  return json({ ok: true, updated, rate });
}

async function handleContractExtend(request: Request, env: Env, userId: string): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    extendDays?: number;
  } | null;
  const days = Math.max(1, Math.floor(Number(body?.extendDays ?? 30)));
  await ensureProfile(env, userId);

  const existing = await env.DB.prepare(
    "SELECT contract_end_at FROM customer_profiles WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ contract_end_at: string | null }>();

  const currentEnd = existing?.contract_end_at ? new Date(existing.contract_end_at) : null;
  const baseTime = currentEnd && !Number.isNaN(currentEnd.getTime()) && currentEnd.getTime() > Date.now()
    ? currentEnd.getTime()
    : Date.now();
  const newEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();

  await updateProfileField(env, userId, "contract_end_at", newEnd);
  await updateProfileField(env, userId, "contract_active", 1);
  await updateProfileField(env, userId, "activation_status", "active");

  return json({ ok: true, contractEndAt: newEnd, extendedDays: days });
}

export async function handleAdmin(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  const ownerCheck = request.method === "GET"
    ? await requireOwnerRead(request, env)
    : await requireOwner(request, env);
  if (ownerCheck) return ownerCheck;

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "customers") {
    return handleCustomerList(env);
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "customers" && pathParts[1] === "bulk-rate") {
    return handleBulkRate(request, env);
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "tasks" && pathParts[1] === "run") {
    const result = await runScheduledTasks(env);
    return json({ ok: true, ...result });
  }

  if (request.method === "GET" && pathParts[0] === "records" && pathParts.length === 2) {
    const url = new URL(request.url);
    if (pathParts[1] === "recharges") return handleRechargeRecords(env, url);
    if (pathParts[1] === "withdrawals") return handleWithdrawalRecords(env, url);
    if (pathParts[1] === "exchanges") return handleExchangeRecords(env, url);
  }

  if (pathParts.length >= 2 && pathParts[0] === "customers") {
    const userId = pathParts[1];

    if (request.method === "GET" && pathParts.length === 2) {
      return handleCustomerDetail(env, userId);
    }

    if (request.method === "PUT" && pathParts.length === 2) {
      return handleCustomerUpdate(request, env, userId);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "activate") {
      return handleCustomerActivate(request, env, userId);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "extend") {
      return handleContractExtend(request, env, userId);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "rewards") {
      return handleRewardAdjustment(request, env, userId);
    }
  }

  return internalError("Unsupported admin route");
}