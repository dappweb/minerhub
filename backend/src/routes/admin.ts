import { createId, nowIso } from "../lib/id";
import {
  addContractScopeClause,
  canAccessCustomerContractType,
  contractTypeFromTerm,
  contractTypeFromYears,
  ensureContractAccessColumns,
  getSubAdminContractScope,
  normalizeContractType,
  resolveServiceContractType,
  setCustomerContractTypeIfEmpty,
  type ContractTypeScope,
} from "../lib/contractAccess";
import { getAdminActorRole, requireOwnerAuth, type AdminActorRole } from "../lib/ownerAuth";
import { tryCreateRelayer } from "../lib/ownerRelayer";
import { badRequest, internalError, json } from "../lib/response";
import { runScheduledTasks } from "../lib/scheduled";
import type { Env } from "../types/env";

type OwnerAuthResult = { ok: true; wallet: string } | { ok: false; response: Response };

type CustomerSummary = {
  id: string;
  wallet: string;
  email: string | null;
  role: string | null;
  status: string | null;
  referrerWallet: string | null;
  nickname: string | null;
  machineCode: string | null;
  contractStartAt: string | null;
  contractEndAt: string | null;
  monthlyCardEndAt: string | null;
  effectiveEndAt: string | null;
  contractType: string | null;
  contractActive: number;
  activationStatus: string;
  canMine: boolean;
  canClaim: boolean;
  needsContractAgreement: boolean;
  needsMinerSetup: boolean;
  blockReason: string | null;
  exchangeAutoEnabled: number;
  monthlyCardDays: number;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  deviceCount: number;
  activeDeviceCount: number;
  subAccountCount: number;
  bnbBalance: string | null;
  usdtBalance: string | null;
  superBalance: string | null;
  devices?: CustomerDeviceSummary[];
};

type CustomerDeviceSummary = {
  id: string;
  deviceId: string;
  machineCode: string | null;
  hashrate: number;
  status: string;
  onlineStatus: string;
  lastSeenAt: string | null;
  contractStatus: string;
  ownerWallet: string;
  ownerNickname: string | null;
  createdAt: string;
  updatedAt: string;
};

type AdminSummary = {
  wallet: string;
  bnbBalance: string | null;
  usdtBalance: string | null;
  superBalance: string | null;
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
    machineCode: string | null;
    hashrate: number;
    status: string;
    onlineStatus: string;
    lastSeenAt: string | null;
    contractStatus: string;
    ownerWallet: string;
    ownerNickname: string | null;
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

type AdminDeviceItem = {
  id: string;
  userId: string;
  wallet: string;
  nickname: string | null;
  machineCode: string | null;
  monthlyCardDays: number;
  notes: string | null;
  deviceId: string;
  hashrate: number;
  deviceStatus: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  contractActive: number;
  effectiveEndAt: string | null;
  contractEndAt: string | null;
  monthlyCardEndAt: string | null;
  contractType: string | null;
  canMine: boolean;
  canClaim: boolean;
  needsContractAgreement: boolean;
  needsMinerSetup: boolean;
  blockReason: string | null;
  rewardRateUsdtPerHour: string;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  bnbBalance: string | null;
  usdtBalance: string | null;
  superBalance: string | null;
};

type AdminDeviceDetail = AdminDeviceItem & {
  deviceStatusHistory: Array<{
    id: string;
    status: string;
    hashrate: number;
    observedAt: string;
    note: string | null;
  }>;
  rewardLedger: Array<{
    id: string;
    rewardUsdt: string;
    rewardSuper: string;
    rateUsdtPerHour: string;
    source: string;
    note: string | null;
    createdAt: string;
  }>;
};

let adminProfileColumnsReady = false;

async function ensureAdminProfileColumns(env: Env): Promise<void> {
  if (adminProfileColumnsReady) return;
  const info = await env.DB.prepare("PRAGMA table_info(customer_profiles)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((row) => row.name));
  if (!columns.has("monthly_card_end_at")) {
    await env.DB.prepare("ALTER TABLE customer_profiles ADD COLUMN monthly_card_end_at TEXT").run();
  }
  adminProfileColumnsReady = true;
}

let collectionRequestsReady = false;

async function ensureCollectionRequestsTable(env: Env): Promise<void> {
  if (collectionRequestsReady) return;
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS fund_collection_requests (
      id TEXT PRIMARY KEY,
      requester_wallet TEXT NOT NULL,
      requester_role TEXT NOT NULL,
      source_user_ids_json TEXT NOT NULL,
      source_device_count INTEGER NOT NULL DEFAULT 0,
      target_wallet TEXT NOT NULL,
      amount_usdt TEXT NOT NULL DEFAULT '0',
      amount_super TEXT NOT NULL DEFAULT '0',
      status TEXT NOT NULL DEFAULT 'pending',
      tx_hash TEXT,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )`
  ).run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fund_collection_requests_time ON fund_collection_requests(created_at DESC)").run();
  await env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_fund_collection_requests_status ON fund_collection_requests(status)").run();
  collectionRequestsReady = true;
}

let exchangeOrderTxColumnsReady = false;

async function ensureExchangeOrderTxColumns(env: Env): Promise<void> {
  if (exchangeOrderTxColumnsReady) return;
  const info = await env.DB.prepare("PRAGMA table_info(exchange_orders)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((row) => row.name));
  const statements: string[] = [];
  if (!columns.has("super_tx_hash")) statements.push("ALTER TABLE exchange_orders ADD COLUMN super_tx_hash TEXT");
  if (!columns.has("usdt_tx_hash")) statements.push("ALTER TABLE exchange_orders ADD COLUMN usdt_tx_hash TEXT");
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  exchangeOrderTxColumnsReady = true;
}

// Heartbeat-driven live status. The `online_status` column is only refreshed by
// scheduled tasks / heartbeat handlers; to react immediately we derive it from
// the freshness of `last_seen_at` on every admin read.
const HEARTBEAT_ONLINE_MS = 90_000; // within 1.5× the client heartbeat (30s)
const HEARTBEAT_STALE_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

function parseValidTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function addDaysFromActiveEnd(endAt: string | null | undefined, days: number, nowMs: number): string {
  const currentTime = parseValidTime(endAt);
  const baseTime = currentTime !== null && currentTime > nowMs ? currentTime : nowMs;
  return new Date(baseTime + days * DAY_MS).toISOString();
}

function laterIsoDate(a: string | null | undefined, b: string): string {
  const aTime = parseValidTime(a);
  const bTime = parseValidTime(b) ?? 0;
  return new Date(Math.max(aTime ?? 0, bTime)).toISOString();
}

const EFFECTIVE_CONTRACT_END_SQL = `CASE
  WHEN cp.contract_end_at IS NULL THEN cp.monthly_card_end_at
  WHEN cp.monthly_card_end_at IS NULL THEN cp.contract_end_at
  WHEN cp.monthly_card_end_at > cp.contract_end_at THEN cp.monthly_card_end_at
  ELSE cp.contract_end_at
END`;

type ContractStateInput = {
  contractActive?: number | boolean | null;
  contractType?: string | null;
  contractEndAt?: string | null;
  monthlyCardEndAt?: string | null;
  activationStatus?: string | null;
  deviceCount?: number | null;
  acceptedContractVersion?: string | null;
  requiredContractVersion?: string | null;
  contractRequired?: boolean | null;
};

function deriveContractState(input: ContractStateInput) {
  const effectiveEndAt = laterNullableIsoDate(input.contractEndAt, input.monthlyCardEndAt);
  const effectiveEndMs = parseValidTime(effectiveEndAt);
  const expired = effectiveEndMs !== null && effectiveEndMs < Date.now();
  const active = Number(input.contractActive ?? 0) === 1;
  const needsMinerSetup = Number(input.deviceCount ?? 0) <= 0;
  const needsContractAgreement = Boolean(
    input.contractRequired &&
    input.requiredContractVersion &&
    input.acceptedContractVersion !== input.requiredContractVersion,
  );

  let blockReason: string | null = null;
  if (!active) blockReason = "contract_inactive";
  else if (expired) blockReason = "contract_expired";
  else if (needsContractAgreement) blockReason = "contract_agreement_required";
  else if (needsMinerSetup) blockReason = "miner_setup_required";

  return {
    contractActive: active,
    contractType: input.contractType ?? null,
    contractEndAt: input.contractEndAt ?? null,
    monthlyCardEndAt: input.monthlyCardEndAt ?? null,
    effectiveEndAt,
    activationStatus: input.activationStatus ?? (active ? "active" : "pending"),
    canMine: active && !expired && !needsContractAgreement && !needsMinerSetup,
    canClaim: active && !expired && !needsContractAgreement && !needsMinerSetup,
    needsContractAgreement,
    needsMinerSetup,
    blockReason,
  };
}

function laterNullableIsoDate(a: string | null | undefined, b: string | null | undefined): string | null {
  const aTime = parseValidTime(a);
  const bTime = parseValidTime(b);
  if (aTime === null && bTime === null) return null;
  return new Date(Math.max(aTime ?? 0, bTime ?? 0)).toISOString();
}

export function deriveLiveOnlineStatus(lastSeenAt: string | null | undefined): "online" | "stale" | "offline" {
  if (!lastSeenAt) return "offline";
  const ts = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ts)) return "offline";
  const diff = Date.now() - ts;
  if (diff <= HEARTBEAT_ONLINE_MS) return "online";
  if (diff <= HEARTBEAT_STALE_MS) return "stale";
  return "offline";
}

async function requireOwnerRead(request: Request, env: Env): Promise<OwnerAuthResult> {
  const auth = await requireOwnerAuth(request, env);
  return auth.ok ? { ok: true, wallet: auth.wallet } : { ok: false, response: auth.response };
}

async function requireOwner(request: Request, env: Env): Promise<OwnerAuthResult> {
  const auth = await requireOwnerAuth(request, env);
  return auth.ok ? { ok: true, wallet: auth.wallet } : { ok: false, response: auth.response };
}

async function findUserIdByWallet(env: Env, wallet: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT id FROM users WHERE wallet = ? LIMIT 1")
    .bind(wallet.toLowerCase())
    .first<{ id: string }>();
  return row?.id ?? null;
}

async function ensureUserIdByWallet(env: Env, wallet: string): Promise<string> {
  const normalized = wallet.toLowerCase();
  const existing = await findUserIdByWallet(env, normalized);
  if (existing) return existing;

  const id = createId("usr");
  const now = nowIso();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, wallet, email, role, created_at, updated_at)
     VALUES (?, ?, NULL, 'subadmin', ?, ?)`
  )
    .bind(id, normalized, now, now)
    .run();

  return (await findUserIdByWallet(env, normalized)) ?? id;
}

async function canManageUserByScope(env: Env, scopeUserId: string | null, targetUserId: string): Promise<boolean> {
  if (!scopeUserId) return true;
  const row = await env.DB.prepare(
    `SELECT 1 AS ok
     FROM referral_closure
     WHERE ancestor_user_id = ? AND descendant_user_id = ? AND depth >= 1
     LIMIT 1`
  )
    .bind(scopeUserId, targetUserId)
    .first<{ ok: number }>();
  return Boolean(row?.ok);
}

async function canAccessUserByScope(
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
  targetUserId: string,
): Promise<boolean> {
  if (!(await canManageUserByScope(env, scopeUserId, targetUserId))) return false;
  return canAccessCustomerContractType(env, allowedTypes, targetUserId);
}

async function canManageDeviceByScope(env: Env, scopeUserId: string | null, deviceRecordId: string): Promise<boolean> {
  if (!scopeUserId) return true;
  const row = await env.DB.prepare(
    `SELECT 1 AS ok
     FROM devices d
     INNER JOIN referral_closure rc ON rc.descendant_user_id = d.user_id
     WHERE d.id = ? AND rc.ancestor_user_id = ? AND rc.depth >= 1
     LIMIT 1`
  )
    .bind(deviceRecordId, scopeUserId)
    .first<{ ok: number }>();
  return Boolean(row?.ok);
}

async function canAccessDeviceByScope(
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
  deviceRecordId: string,
): Promise<boolean> {
  if (!(await canManageDeviceByScope(env, scopeUserId, deviceRecordId))) return false;
  if (allowedTypes === null) return true;
  const row = await env.DB.prepare(
    `SELECT d.user_id AS user_id
     FROM devices d
     WHERE d.id = ?
     LIMIT 1`
  )
    .bind(deviceRecordId)
    .first<{ user_id: string }>();
  return row?.user_id ? canAccessCustomerContractType(env, allowedTypes, row.user_id) : false;
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

async function hydrateRowsWithBalances<T extends { wallet: string }>(
  env: Env,
  rows: T[],
): Promise<Array<T & { bnbBalance: string | null; usdtBalance: string | null; superBalance: string | null }>> {
  const withEmptyBalances = rows.map((row) => ({
    ...row,
    bnbBalance: null,
    usdtBalance: null,
    superBalance: null,
  }));

  const relayer = tryCreateRelayer(env);
  if (!relayer || withEmptyBalances.length === 0) {
    return withEmptyBalances;
  }

  const walletBalances = new Map<string, { bnb: string | null; usdt: string | null; super: string | null }>();
  const uniqueWallets = Array.from(new Set(
    withEmptyBalances
      .map((item) => item.wallet.trim().toLowerCase())
      .filter(Boolean)
  ));
  const batchSize = 5;

  for (let i = 0; i < uniqueWallets.length; i += batchSize) {
    const batch = uniqueWallets.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (wallet) => {
        const balances = await relayer.getWalletBalances(wallet).catch(() => ({ bnb: null, usdt: null, super: null }));
        walletBalances.set(wallet, balances);
      })
    );
  }

  return withEmptyBalances.map((row) => {
    const balances = walletBalances.get(row.wallet.trim().toLowerCase()) ?? { bnb: null, usdt: null, super: null };
    return {
      ...row,
      bnbBalance: balances.bnb,
      usdtBalance: balances.usdt,
      superBalance: balances.super,
    };
  });
}

async function readCustomerSummaries(env: Env): Promise<CustomerSummary[]> {
  const { results } = await env.DB.prepare(
    `SELECT
      u.id AS id, u.wallet AS wallet, u.email AS email, u.role AS role, NULL AS status,
      re.inviter_wallet AS referrerWallet,
      cp.nickname AS nickname,
      COALESCE(NULLIF(TRIM(cp.machine_code), ''), MIN(d.device_id)) AS machineCode,
      cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
      cp.monthly_card_end_at AS monthlyCardEndAt,
      cp.contract_type AS contractType,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COUNT(DISTINCT d.id) AS deviceCount,
      SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS activeDeviceCount,
      0 AS subAccountCount
    FROM users u
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN devices d ON d.user_id = u.id
    LEFT JOIN referral_edges re ON re.invitee_user_id = u.id AND re.status = 'active'
    GROUP BY u.id, u.wallet, u.email, u.role, cp.nickname, cp.machine_code, cp.contract_start_at,
             cp.contract_end_at, cp.monthly_card_end_at, cp.contract_type, cp.contract_active, cp.activation_status, cp.exchange_auto_enabled,
             cp.monthly_card_days, cp.total_reward_usdt, cp.total_reward_super, cp.last_seen_at, cp.online_status,
             cp.reward_rate_usdt_per_hour, re.inviter_wallet
    ORDER BY u.created_at DESC`
  ).all<CustomerSummary>();

  const baseRows = await attachDevicesToCustomerRows(env, results ?? []);
  return hydrateRowsWithBalances(env, baseRows);
}

async function readCustomerSummariesByInviterWallet(
  env: Env,
  inviterWallet: string,
  allowedTypes: ContractTypeScope,
  scopeUserId: string | null = null,
): Promise<CustomerSummary[]> {
  const inviter = await env.DB.prepare("SELECT id FROM users WHERE wallet = ? LIMIT 1")
    .bind(inviterWallet.toLowerCase())
    .first<{ id: string }>();

  if (!inviter?.id) {
    return [];
  }

  const clauses = ["rc.ancestor_user_id = ?", "rc.depth >= 1"];
  const params: Array<string | number> = [inviter.id];
  addContractScopeClause(clauses, params, allowedTypes);
  if (scopeUserId) {
    clauses.push("EXISTS (SELECT 1 FROM referral_closure scope_rc WHERE scope_rc.ancestor_user_id = ? AND scope_rc.descendant_user_id = u.id AND scope_rc.depth >= 1)");
    params.push(scopeUserId);
  }

  const { results } = await env.DB.prepare(
    `SELECT
      u.id AS id, u.wallet AS wallet, u.email AS email, u.role AS role, NULL AS status,
      re.inviter_wallet AS referrerWallet,
      cp.nickname AS nickname,
      COALESCE(NULLIF(TRIM(cp.machine_code), ''), MIN(d.device_id)) AS machineCode,
      cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
      cp.monthly_card_end_at AS monthlyCardEndAt,
      cp.contract_type AS contractType,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COUNT(DISTINCT d.id) AS deviceCount,
      SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS activeDeviceCount,
      0 AS subAccountCount
    FROM referral_closure rc
    INNER JOIN users u ON u.id = rc.descendant_user_id
    LEFT JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN devices d ON d.user_id = u.id
    LEFT JOIN referral_edges re ON re.invitee_user_id = u.id AND re.status = 'active'
    WHERE ${clauses.join(" AND ")}
    GROUP BY u.id, u.wallet, u.email, u.role, cp.nickname, cp.machine_code, cp.contract_start_at,
             cp.contract_end_at, cp.monthly_card_end_at, cp.contract_type, cp.contract_active, cp.activation_status, cp.exchange_auto_enabled,
             cp.monthly_card_days, cp.total_reward_usdt, cp.total_reward_super, cp.last_seen_at, cp.online_status,
             cp.reward_rate_usdt_per_hour, re.inviter_wallet
    ORDER BY u.created_at DESC`
  ).bind(...params).all<CustomerSummary>();

  const baseRows = await attachDevicesToCustomerRows(env, results ?? []);
  return hydrateRowsWithBalances(env, baseRows);
}

async function attachDevicesToCustomerRows(env: Env, rows: CustomerSummary[]): Promise<CustomerSummary[]> {
  if (rows.length === 0) return [];

  const devicesByUserId = await readDeviceSummariesByUserIds(env, rows.map((row) => row.id));

  return rows.map((row) => {
    const devices = devicesByUserId.get(row.id) ?? [];
    const state = deriveContractState({
      contractActive: row.contractActive,
      contractType: row.contractType,
      contractEndAt: row.contractEndAt,
      monthlyCardEndAt: row.monthlyCardEndAt,
      activationStatus: row.activationStatus,
      deviceCount: Number((row as { deviceCount?: number }).deviceCount ?? devices.length),
    });

    return {
      ...row,
      effectiveEndAt: state.effectiveEndAt,
      canMine: state.canMine,
      canClaim: state.canClaim,
      needsContractAgreement: state.needsContractAgreement,
      needsMinerSetup: state.needsMinerSetup,
      blockReason: state.blockReason,
      deviceCount: Number((row as { deviceCount?: number }).deviceCount ?? devices.length),
      activeDeviceCount: Number((row as { activeDeviceCount?: number }).activeDeviceCount ?? 0),
      subAccountCount: Number((row as { subAccountCount?: number }).subAccountCount ?? 0),
      onlineStatus: deriveLiveOnlineStatus((row as { lastSeenAt?: string | null }).lastSeenAt ?? null),
      devices,
    };
  });
}

async function readDeviceSummariesByUserIds(env: Env, userIds: string[]): Promise<Map<string, CustomerDeviceSummary[]>> {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const map = new Map<string, CustomerDeviceSummary[]>();
  if (uniqueUserIds.length === 0) return map;

  for (let i = 0; i < uniqueUserIds.length; i += 80) {
    const batch = uniqueUserIds.slice(i, i + 80);
    const placeholders = batch.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT
        d.user_id AS userId,
        d.id AS id,
        d.device_id AS deviceId,
        d.hashrate AS hashrate,
        d.status AS status,
        d.created_at AS createdAt,
        d.updated_at AS updatedAt,
        u.wallet AS ownerWallet,
        cp.nickname AS ownerNickname,
        cp.machine_code AS machineCode,
        cp.last_seen_at AS lastSeenAt,
        COALESCE(cp.contract_active, 0) AS contractActive,
        cp.contract_end_at AS contractEndAt,
        cp.monthly_card_end_at AS monthlyCardEndAt
       FROM devices d
       INNER JOIN users u ON u.id = d.user_id
       LEFT JOIN customer_profiles cp ON cp.user_id = d.user_id
       WHERE d.user_id IN (${placeholders})
       ORDER BY d.updated_at DESC`
    )
      .bind(...batch)
      .all<{
        userId: string;
        id: string;
        deviceId: string;
        hashrate: number;
        status: string;
        createdAt: string;
        updatedAt: string;
        ownerWallet: string;
        ownerNickname: string | null;
        machineCode: string | null;
        lastSeenAt: string | null;
        contractActive: number;
        contractEndAt: string | null;
        monthlyCardEndAt: string | null;
      }>();

    for (const row of results ?? []) {
      const state = deriveContractState({
        contractActive: row.contractActive,
        contractEndAt: row.contractEndAt,
        monthlyCardEndAt: row.monthlyCardEndAt,
        deviceCount: 1,
      });
      const list = map.get(row.userId) ?? [];
      list.push({
        id: row.id,
        deviceId: row.deviceId,
        machineCode: row.machineCode,
        hashrate: Number(row.hashrate ?? 0),
        status: row.status,
        onlineStatus: deriveLiveOnlineStatus(row.lastSeenAt),
        lastSeenAt: row.lastSeenAt,
        contractStatus: state.canMine ? "active" : state.blockReason ?? "inactive",
        ownerWallet: row.ownerWallet,
        ownerNickname: row.ownerNickname,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      map.set(row.userId, list);
    }
  }

  return map;
}

async function readAdminSummary(env: Env, wallet: string | null): Promise<AdminSummary | null> {
  if (!wallet) return null;
  const relayer = tryCreateRelayer(env);
  if (!relayer) {
    return { wallet, bnbBalance: null, usdtBalance: null, superBalance: null };
  }

  const balances = await relayer.getWalletBalances(wallet).catch(() => ({ bnb: null, usdt: null, super: null }));
  return {
    wallet,
    bnbBalance: balances.bnb,
    usdtBalance: balances.usdt,
    superBalance: balances.super,
  };
}

async function getCustomerDetail(env: Env, userId: string): Promise<CustomerDetail | null> {
  await ensureProfile(env, userId);

  const customer = await env.DB.prepare(
    `SELECT
      u.id AS id, u.wallet AS wallet, u.email AS email, u.role AS role, NULL AS status,
      cp.nickname AS nickname, cp.machine_code AS machineCode, cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
      cp.monthly_card_end_at AS monthlyCardEndAt,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
      cp.parent_user_id AS parentUserId, cp.agreement_accepted_at AS agreementAcceptedAt, cp.offline_alerted_at AS offlineAlertedAt, cp.notes AS notes,
      cp.contract_type AS contractType,
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

  const subAccounts = { results: [] as Array<{
    id: string;
    child_user_id: string;
    label: string | null;
    created_at: string;
    updated_at: string;
  }> };

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
  const liveStatus = deriveLiveOnlineStatus(lastSeenRaw);
  const state = deriveContractState({
    contractActive: customer.contractActive,
    contractType: customer.contractType,
    contractEndAt: customer.contractEndAt,
    monthlyCardEndAt: customer.monthlyCardEndAt,
    activationStatus: customer.activationStatus,
    deviceCount: Number(summary?.device_count ?? devices.results?.length ?? 0),
  });

  return {
    ...customer,
    effectiveEndAt: state.effectiveEndAt,
    canMine: state.canMine,
    canClaim: state.canClaim,
    needsContractAgreement: state.needsContractAgreement,
    needsMinerSetup: state.needsMinerSetup,
    blockReason: state.blockReason,
    deviceCount: Number(summary?.device_count ?? devices.results?.length ?? 0),
    activeDeviceCount: Number(summary?.active_device_count ?? 0),
    subAccountCount: Number(subAccounts.results?.length ?? 0),
    payoutWallets: parsePayoutWallets((customer as { payoutWalletsJson?: string | null }).payoutWalletsJson ?? null),
    devices: (devices.results ?? []).map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      machineCode: customer.machineCode,
      hashrate: Number(row.hashrate ?? 0),
      status: row.status,
      onlineStatus: liveStatus,
      lastSeenAt: lastSeenRaw,
      contractStatus: state.canMine ? "active" : state.blockReason ?? "inactive",
      ownerWallet: customer.wallet,
      ownerNickname: customer.nickname,
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
    onlineStatus: liveStatus,
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

async function applyServiceContractType(
  env: Env,
  allowedTypes: ContractTypeScope,
  userId: string,
  requestedType: string | null | undefined,
): Promise<{ ok: true; contractType: string | null } | { ok: false; response: Response }> {
  const resolved = await resolveServiceContractType(env, allowedTypes, userId, requestedType);
  if (!resolved.ok) {
    return { ok: false, response: resolved.status === 403 ? json({ error: resolved.error }, 403) : badRequest(resolved.error) };
  }
  await setCustomerContractTypeIfEmpty(env, userId, resolved.contractType);
  return resolved;
}

async function handleCustomerList(
  request: Request,
  env: Env,
  requesterWallet: string,
  role: AdminActorRole,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const url = new URL(request.url);
  const referrerWallet = (url.searchParams.get("referrerWallet") ?? "").trim().toLowerCase();
  if (referrerWallet && !/^0x[0-9a-f]{40}$/.test(referrerWallet)) {
    return badRequest("Invalid referrerWallet");
  }

  const mineOnly = role !== "owner";
  const customerReader = referrerWallet
    ? readCustomerSummariesByInviterWallet(env, referrerWallet, allowedTypes, mineOnly ? scopeUserId : null)
    : mineOnly
      ? readCustomerSummariesByInviterWallet(env, requesterWallet, allowedTypes)
      : readCustomerSummaries(env);

  const [items, admin] = await Promise.all([
    customerReader,
    readAdminSummary(env, requesterWallet),
  ]);
  return json({ items, admin });
}

async function readAdminDevices(
  env: Env,
  url: URL,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<{ items: AdminDeviceItem[]; total: number }> {
  const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
  const status = (url.searchParams.get("status") ?? "all").trim().toLowerCase();
  const limit = clampLimit(url.searchParams.get("limit"), 100, 200);

  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (search) {
    clauses.push(
      "(LOWER(d.device_id) LIKE ? OR LOWER(COALESCE(cp.machine_code, '')) LIKE ? OR LOWER(u.wallet) LIKE ? OR LOWER(u.id) LIKE ? OR LOWER(COALESCE(cp.nickname, '')) LIKE ? OR LOWER(d.id) LIKE ?)"
    );
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }

  if (status === "online") {
    clauses.push("COALESCE(cp.online_status, 'offline') = 'online'");
  } else if (status === "offline") {
    clauses.push("COALESCE(cp.online_status, 'offline') <> 'online'");
  } else if (status === "active") {
    clauses.push("d.status = 'active'");
  } else if (status === "inactive") {
    clauses.push("d.status <> 'active'");
  } else if (status === "contract_active") {
    clauses.push("COALESCE(cp.contract_active, 0) = 1");
  } else if (status === "contract_expired") {
    clauses.push(`${EFFECTIVE_CONTRACT_END_SQL} IS NOT NULL AND ${EFFECTIVE_CONTRACT_END_SQL} <= ?`);
    params.push(nowIso());
  }

  if (scopeUserId) {
    clauses.push("EXISTS (SELECT 1 FROM referral_closure rc WHERE rc.ancestor_user_id = ? AND rc.descendant_user_id = d.user_id AND rc.depth >= 1)");
    params.push(scopeUserId);
    addContractScopeClause(clauses, params, allowedTypes);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const { results } = await env.DB.prepare(
    `SELECT
      d.id AS id,
      d.user_id AS userId,
      u.wallet AS wallet,
      cp.nickname AS nickname,
      cp.machine_code AS machineCode,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      cp.notes AS notes,
      d.device_id AS deviceId,
      d.hashrate AS hashrate,
      d.status AS deviceStatus,
      d.created_at AS createdAt,
      d.updated_at AS updatedAt,
      cp.last_seen_at AS lastSeenAt,
      COALESCE(cp.online_status, 'offline') AS onlineStatus,
      COALESCE(cp.contract_active, 0) AS contractActive,
      cp.contract_end_at AS contractEndAt,
      cp.monthly_card_end_at AS monthlyCardEndAt,
      cp.contract_type AS contractType,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper
    FROM devices d
    INNER JOIN users u ON u.id = d.user_id
    LEFT JOIN customer_profiles cp ON cp.user_id = d.user_id
    ${where}
    ORDER BY d.updated_at DESC
    LIMIT ?`
  )
    .bind(...params, limit)
    .all<AdminDeviceItem>();

  const baseRows = (results ?? []).map((row) => ({
    ...row,
    ...deriveContractState({
      contractActive: row.contractActive,
      contractType: row.contractType,
      contractEndAt: row.contractEndAt,
      monthlyCardEndAt: row.monthlyCardEndAt,
      deviceCount: 1,
    }),
    contractActive: Number((row as { contractActive?: number }).contractActive ?? 0),
    hashrate: Number((row as { hashrate?: number }).hashrate ?? 0),
    monthlyCardDays: Number((row as { monthlyCardDays?: number }).monthlyCardDays ?? 30),
    onlineStatus: deriveLiveOnlineStatus((row as { lastSeenAt?: string | null }).lastSeenAt ?? null),
  }));

  const items = await hydrateRowsWithBalances(env, baseRows);

  return { items, total: items.length };
}

async function getAdminDeviceDetail(env: Env, deviceRecordId: string): Promise<AdminDeviceDetail | null> {
  const item = await env.DB.prepare(
    `SELECT
      d.id AS id,
      d.user_id AS userId,
      u.wallet AS wallet,
      cp.nickname AS nickname,
      cp.machine_code AS machineCode,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      cp.notes AS notes,
      d.device_id AS deviceId,
      d.hashrate AS hashrate,
      d.status AS deviceStatus,
      d.created_at AS createdAt,
      d.updated_at AS updatedAt,
      cp.last_seen_at AS lastSeenAt,
      COALESCE(cp.online_status, 'offline') AS onlineStatus,
      COALESCE(cp.contract_active, 0) AS contractActive,
      cp.contract_end_at AS contractEndAt,
      cp.monthly_card_end_at AS monthlyCardEndAt,
      cp.contract_type AS contractType,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper
    FROM devices d
    INNER JOIN users u ON u.id = d.user_id
    LEFT JOIN customer_profiles cp ON cp.user_id = d.user_id
    WHERE d.id = ?`
  )
    .bind(deviceRecordId)
    .first<AdminDeviceItem>();

  if (!item) return null;

  const [historyRows, rewardRows] = await Promise.all([
    env.DB.prepare(
      `SELECT id, status, hashrate, observed_at, note
       FROM device_status_history
       WHERE user_id = ? AND device_id = ?
       ORDER BY observed_at DESC LIMIT 100`
    )
      .bind(item.userId, item.deviceId)
      .all<{ id: string; status: string; hashrate: number; observed_at: string; note: string | null }>(),
    env.DB.prepare(
      `SELECT id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at
       FROM reward_ledger
       WHERE user_id = ? AND (device_id = ? OR device_id IS NULL)
       ORDER BY created_at DESC LIMIT 100`
    )
      .bind(item.userId, item.deviceId)
      .all<{
        id: string;
        reward_usdt: string;
        reward_super: string;
        rate_usdt_per_hour: string;
        source: string;
        note: string | null;
        created_at: string;
      }>(),
  ]);

  const relayer = tryCreateRelayer(env);
  const balances = relayer
    ? await relayer.getWalletBalances(item.wallet).catch(() => ({ bnb: null, usdt: null, super: null }))
    : { bnb: null, usdt: null, super: null };

  return {
    ...item,
    ...deriveContractState({
      contractActive: item.contractActive,
      contractType: item.contractType,
      contractEndAt: item.contractEndAt,
      monthlyCardEndAt: item.monthlyCardEndAt,
      deviceCount: 1,
    }),
    contractActive: Number((item as { contractActive?: number }).contractActive ?? 0),
    hashrate: Number((item as { hashrate?: number }).hashrate ?? 0),
    monthlyCardDays: Number((item as { monthlyCardDays?: number }).monthlyCardDays ?? 30),
    onlineStatus: deriveLiveOnlineStatus((item as { lastSeenAt?: string | null }).lastSeenAt ?? null),
    bnbBalance: balances.bnb,
    usdtBalance: balances.usdt,
    superBalance: balances.super,
    deviceStatusHistory: (historyRows.results ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      hashrate: Number(row.hashrate ?? 0),
      observedAt: row.observed_at,
      note: row.note,
    })),
    rewardLedger: (rewardRows.results ?? []).map((row) => ({
      id: row.id,
      rewardUsdt: row.reward_usdt,
      rewardSuper: row.reward_super,
      rateUsdtPerHour: row.rate_usdt_per_hour,
      source: row.source,
      note: row.note,
      createdAt: row.created_at,
    })),
  };
}

async function handleAdminDeviceList(
  request: Request,
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const data = await readAdminDevices(env, new URL(request.url), scopeUserId, allowedTypes);
  return json(data);
}

async function handleAdminDeviceDetail(env: Env, deviceRecordId: string): Promise<Response> {
  const detail = await getAdminDeviceDetail(env, deviceRecordId);
  if (!detail) return json({ error: "Device not found" }, 404);
  return json(detail);
}

async function handleAdminDeviceUpdate(
  request: Request,
  env: Env,
  deviceRecordId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    hashrate?: number;
    deviceStatus?: string;
    nickname?: string | null;
    machineCode?: string | null;
    notes?: string | null;
    contractType?: string;
    rewardRateUsdtPerHour?: string | number;
    monthlyCardDays?: number;
    contractActive?: boolean;
    contractEndAt?: string | null;
  } | null;
  if (!body) return badRequest("Invalid JSON body");

  const current = await env.DB.prepare("SELECT id, user_id FROM devices WHERE id = ?")
    .bind(deviceRecordId)
    .first<{ id: string; user_id: string }>();
  if (!current) return json({ error: "Device not found" }, 404);

  const now = nowIso();

  if (typeof body.hashrate === "number" && Number.isFinite(body.hashrate)) {
    await env.DB.prepare("UPDATE devices SET hashrate = ?, updated_at = ? WHERE id = ?")
      .bind(Math.max(0, Math.floor(body.hashrate)), now, deviceRecordId)
      .run();
  }

  if (typeof body.deviceStatus === "string" && body.deviceStatus.trim()) {
    await env.DB.prepare("UPDATE devices SET status = ?, updated_at = ? WHERE id = ?")
      .bind(body.deviceStatus.trim(), now, deviceRecordId)
      .run();
  }

  await ensureProfile(env, current.user_id);

  const touchesService =
    allowedTypes !== null &&
    (
      body.contractType !== undefined ||
      body.rewardRateUsdtPerHour !== undefined ||
      body.monthlyCardDays !== undefined ||
      body.contractActive !== undefined ||
      body.contractEndAt !== undefined
    );
  if (touchesService) {
    const service = await applyServiceContractType(env, allowedTypes, current.user_id, body.contractType ?? null);
    if (!service.ok) return service.response;
  } else if (!(await canAccessCustomerContractType(env, allowedTypes, current.user_id))) {
    return json({ error: "Forbidden" }, 403);
  }

  if (typeof body.nickname === "string" || body.nickname === null) {
    await updateProfileField(env, current.user_id, "nickname", body.nickname === null ? null : body.nickname.trim() || null);
  }
  if (typeof body.machineCode === "string" || body.machineCode === null) {
    await updateProfileField(env, current.user_id, "machine_code", body.machineCode === null ? null : body.machineCode.trim() || null);
  }
  if (typeof body.notes === "string" || body.notes === null) {
    await updateProfileField(env, current.user_id, "notes", body.notes === null ? null : body.notes.trim() || null);
  }
  if (typeof body.rewardRateUsdtPerHour === "string" || typeof body.rewardRateUsdtPerHour === "number") {
    await updateProfileField(env, current.user_id, "reward_rate_usdt_per_hour", String(body.rewardRateUsdtPerHour));
  }
  if (typeof body.monthlyCardDays === "number" && Number.isFinite(body.monthlyCardDays)) {
    await updateProfileField(env, current.user_id, "monthly_card_days", Math.max(1, Math.floor(body.monthlyCardDays)));
  }
  if (typeof body.contractActive === "boolean") {
    await updateProfileField(env, current.user_id, "contract_active", body.contractActive ? 1 : 0);
    await updateProfileField(env, current.user_id, "activation_status", body.contractActive ? "active" : "paused");
  }
  if (typeof body.contractEndAt === "string" || body.contractEndAt === null) {
    const normalized = body.contractEndAt ? new Date(body.contractEndAt) : null;
    if (body.contractEndAt && (!normalized || Number.isNaN(normalized.getTime()))) {
      return badRequest("contractEndAt must be a valid datetime");
    }
    await updateProfileField(env, current.user_id, "contract_end_at", normalized ? normalized.toISOString() : null);
  }

  return handleAdminDeviceDetail(env, deviceRecordId);
}

async function handleAdminDeviceDelete(env: Env, deviceRecordId: string): Promise<Response> {
  const current = await env.DB.prepare("SELECT id, user_id, device_id FROM devices WHERE id = ? LIMIT 1")
    .bind(deviceRecordId)
    .first<{ id: string; user_id: string; device_id: string }>();
  if (!current) return json({ error: "Device not found" }, 404);

  await env.DB.prepare("DELETE FROM devices WHERE id = ?")
    .bind(deviceRecordId)
    .run();

  const summary = await env.DB.prepare(
    "SELECT COUNT(*) AS device_count, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_device_count FROM devices WHERE user_id = ?"
  )
    .bind(current.user_id)
    .first<{ device_count: number; active_device_count: number | null }>();

  return json({
    ok: true,
    deleted: true,
    id: current.id,
    deviceId: current.device_id,
    userId: current.user_id,
    deviceCount: Number(summary?.device_count ?? 0),
    activeDeviceCount: Number(summary?.active_device_count ?? 0),
  });
}

async function handleAdminDeviceBulkUpdate(
  request: Request,
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    deviceIds?: string[];
    contractType?: string;
    rewardRateUsdtPerHour?: string | number;
    extendDays?: number;
    mode?: "monthly" | "custom";
    deviceStatus?: string;
  } | null;
  if (!body?.deviceIds?.length) {
    return badRequest("deviceIds required");
  }

  const hasRate = body.rewardRateUsdtPerHour !== undefined && body.rewardRateUsdtPerHour !== null;
  const hasExtend = body.extendDays !== undefined || body.mode === "monthly";
  const hasStatus = typeof body.deviceStatus === "string" && body.deviceStatus.trim().length > 0;
  if (!hasRate && !hasExtend && !hasStatus) {
    return badRequest("No valid bulk action provided");
  }

  const rate = hasRate ? String(body.rewardRateUsdtPerHour) : null;
  if (rate !== null) {
    const parsedRate = Number(rate);
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      return badRequest("Invalid rewardRateUsdtPerHour");
    }
  }

  let updated = 0;
  const now = nowIso();
  const ids = Array.from(new Set(body.deviceIds.filter(Boolean)));

  for (const deviceRecordId of ids) {
    const current = await env.DB.prepare(
      `SELECT d.id AS id, d.user_id AS user_id,
               cp.contract_end_at AS contract_end_at,
               cp.monthly_card_end_at AS monthly_card_end_at,
               COALESCE(cp.monthly_card_days, 30) AS monthly_card_days
       FROM devices d
       LEFT JOIN customer_profiles cp ON cp.user_id = d.user_id
       WHERE d.id = ?`
    )
      .bind(deviceRecordId)
      .first<{ id: string; user_id: string; contract_end_at: string | null; monthly_card_end_at: string | null; monthly_card_days: number }>();

    if (!current) continue;

    if (!(await canManageUserByScope(env, scopeUserId, current.user_id))) {
      continue;
    }

    await ensureProfile(env, current.user_id);

    if (scopeUserId && (hasRate || hasExtend)) {
      const requestedType = normalizeContractType(body.contractType ?? null)
        ?? (hasExtend ? contractTypeFromTerm(body.mode === "monthly" ? current.monthly_card_days : body.extendDays ?? null) : null);
      const service = await applyServiceContractType(env, allowedTypes, current.user_id, requestedType);
      if (!service.ok) continue;
    }

    if (hasStatus) {
      await env.DB.prepare("UPDATE devices SET status = ?, updated_at = ? WHERE id = ?")
        .bind(String(body.deviceStatus).trim(), now, deviceRecordId)
        .run();
    }

    if (rate !== null) {
      await updateProfileField(env, current.user_id, "reward_rate_usdt_per_hour", rate);
    }

    if (hasExtend) {
      const nowMs = Date.now();
      const monthlyDays = Math.max(1, Math.floor(Number(current.monthly_card_days ?? 30)));
      const days = body.mode === "monthly"
        ? monthlyDays
        : Math.max(1, Math.floor(Number(body.extendDays ?? 30)));
      if (body.mode === "monthly") {
        const newMonthlyEnd = addDaysFromActiveEnd(current.monthly_card_end_at, monthlyDays, nowMs);
        const newContractEnd = laterIsoDate(current.contract_end_at, newMonthlyEnd);
        await updateProfileField(env, current.user_id, "monthly_card_end_at", newMonthlyEnd);
        await updateProfileField(env, current.user_id, "contract_end_at", newContractEnd);
      } else {
        const newEnd = addDaysFromActiveEnd(current.contract_end_at, days, nowMs);
        await updateProfileField(env, current.user_id, "contract_end_at", newEnd);
      }
      await updateProfileField(env, current.user_id, "contract_active", 1);
      await updateProfileField(env, current.user_id, "activation_status", "active");
    }

    updated += 1;
  }

  return json({ ok: true, updated });
}

async function handleCustomerDetail(env: Env, userId: string): Promise<Response> {
  const detail = await getCustomerDetail(env, userId);
  if (!detail) {
    return json({ error: "Customer not found" }, 404);
  }
  return json(detail);
}

async function handleCustomerUpdate(
  request: Request,
  env: Env,
  userId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  await ensureProfile(env, userId);

  if (allowedTypes !== null) {
    const allowedKeys = new Set(["nickname", "notes"]);
    const rejectedKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
    if (rejectedKeys.length > 0) {
      return json({ error: "SubAdmin can only update nickname and notes" }, 403);
    }
    if (!(await canAccessCustomerContractType(env, allowedTypes, userId))) {
      return json({ error: "Forbidden" }, 403);
    }
  }

  const touchesService =
    allowedTypes !== null &&
    (
      body.contractType !== undefined ||
      body.rewardRateUsdtPerHour !== undefined ||
      body.monthlyCardDays !== undefined ||
      body.contractTermDays !== undefined ||
      body.contractActive !== undefined
    );
  if (touchesService) {
    const requestedType = normalizeContractType(body.contractType)
      ?? (typeof body.contractTermDays === "number" ? contractTypeFromTerm(body.contractTermDays) : null);
    const service = await applyServiceContractType(env, allowedTypes, userId, requestedType);
    if (!service.ok) return service.response;
  } else if (!(await canAccessCustomerContractType(env, allowedTypes, userId))) {
    return json({ error: "Forbidden" }, 403);
  }

  if (allowedTypes === null && typeof body.contractType === "string") {
    await updateProfileField(env, userId, "contract_type", normalizeContractType(body.contractType));
  }

  if (typeof body.nickname === "string" || body.nickname === null) {
    await updateProfileField(env, userId, "nickname", body.nickname === null ? null : body.nickname.trim() || null);
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

  if (typeof body.notes === "string" || body.notes === null) {
    await updateProfileField(env, userId, "notes", body.notes === null ? null : body.notes.trim() || null);
  }

  if (Array.isArray(body.devices)) {
    const seenIds = new Set<string>();
    for (const item of body.devices) {
      if (!item || typeof item !== "object") {
        return badRequest("devices entries must be objects");
      }

      const device = item as {
        id?: unknown;
        deviceId?: unknown;
        hashrate?: unknown;
        status?: unknown;
      };

      const deviceRecordId = typeof device.id === "string" ? device.id.trim() : "";
      const deviceId = typeof device.deviceId === "string" ? device.deviceId.trim() : "";
      const status = typeof device.status === "string" ? device.status.trim() : "";
      const hashrate = typeof device.hashrate === "number" ? device.hashrate : Number(device.hashrate);

      if (!deviceRecordId) return badRequest("devices[].id is required");
      if (seenIds.has(deviceRecordId)) return badRequest("devices[].id must be unique");
      seenIds.add(deviceRecordId);
      if (!deviceId) return badRequest("devices[].deviceId is required");
      if (!status) return badRequest("devices[].status is required");
      if (!Number.isFinite(hashrate) || hashrate < 0) return badRequest("devices[].hashrate must be >= 0");

      const currentDevice = await env.DB.prepare("SELECT id, user_id FROM devices WHERE id = ? LIMIT 1")
        .bind(deviceRecordId)
        .first<{ id: string; user_id: string }>();
      if (!currentDevice || currentDevice.user_id !== userId) {
        return badRequest(`Device ${deviceRecordId} not found for user`);
      }

      await env.DB.prepare(
        `UPDATE devices
         SET device_id = ?, hashrate = ?, status = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
        .bind(deviceId, Math.max(0, Math.floor(hashrate)), status, nowIso(), deviceRecordId, userId)
        .run();
    }
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

async function handleCustomerDelete(env: Env, userId: string): Promise<Response> {
  const current = await env.DB.prepare("SELECT id, wallet, role FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ id: string; wallet: string; role: string | null }>();
  if (!current) return json({ error: "Customer not found" }, 404);
  if (current.role === "owner" || current.role === "subadmin") {
    return json({ error: "Admin accounts cannot be deleted from customer management" }, 403);
  }

  const deviceSummary = await env.DB.prepare("SELECT COUNT(*) AS count FROM devices WHERE user_id = ?")
    .bind(userId)
    .first<{ count: number }>();

  const deleteByUserId = [
    "DELETE FROM device_status_history WHERE user_id = ?",
    "DELETE FROM reward_ledger WHERE user_id = ?",
    "DELETE FROM payout_wallets WHERE user_id = ?",
    "DELETE FROM user_agreement_acceptances WHERE user_id = ?",
    "DELETE FROM announcement_reads WHERE user_id = ?",
    "DELETE FROM exchange_orders WHERE user_id = ?",
    "DELETE FROM reward_withdrawals WHERE user_id = ?",
    "DELETE FROM payout_batch_items WHERE user_id = ?",
    "DELETE FROM super_distributions WHERE user_id = ?",
    "DELETE FROM token_locks WHERE user_id = ?",
    "DELETE FROM devices WHERE user_id = ?",
    "DELETE FROM customer_profiles WHERE user_id = ?",
  ];

  for (const statement of deleteByUserId) {
    await env.DB.prepare(statement).bind(userId).run();
  }
  for (const statement of [
    "DELETE FROM exchange_trade_logs WHERE user_id = ?",
    "DELETE FROM swap_trade_logs WHERE user_id = ?",
  ]) {
    try {
      await env.DB.prepare(statement).bind(userId).run();
    } catch {
      // Older or freshly migrated databases may only have one of the two table names.
    }
  }

  await env.DB.prepare("DELETE FROM referral_edges WHERE inviter_user_id = ? OR invitee_user_id = ?")
    .bind(userId, userId)
    .run();
  await env.DB.prepare("DELETE FROM referral_closure WHERE ancestor_user_id = ? OR descendant_user_id = ?")
    .bind(userId, userId)
    .run();
  await env.DB.prepare("DELETE FROM users WHERE id = ?")
    .bind(userId)
    .run();

  return json({
    ok: true,
    deleted: true,
    id: current.id,
    wallet: current.wallet,
    deviceCount: Number(deviceSummary?.count ?? 0),
  });
}

async function handleCustomerActivate(
  request: Request,
  env: Env,
  userId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    contractType?: string;
    contractTermYears?: number;
    contractTermDays?: number;
    contractStartAt?: string;
    machineCode?: string | null;
    agreementAccepted?: boolean;
  } | null;

  if (!body) return badRequest("Invalid JSON body");

  await ensureProfile(env, userId);

  const now = body.contractStartAt || nowIso();
  const currentProfile = await env.DB.prepare("SELECT COALESCE(monthly_card_days, 30) AS monthlyCardDays FROM customer_profiles WHERE user_id = ?")
    .bind(userId)
    .first<{ monthlyCardDays: number }>();
  const monthlyDays = Math.max(1, Math.floor(Number(currentProfile?.monthlyCardDays ?? 30)));
  const termDays = Number.isFinite(body.contractTermDays ?? NaN)
    ? Math.max(1, Math.floor(body.contractTermDays as number))
    : Number.isFinite(body.contractTermYears ?? NaN)
      ? Math.max(1, Math.floor((body.contractTermYears as number) * 365))
      : 1095;
  const requestedType = normalizeContractType(body.contractType)
    ?? contractTypeFromTerm(termDays)
    ?? contractTypeFromYears(body.contractTermYears);
  const service = await applyServiceContractType(env, allowedTypes, userId, requestedType);
  if (!service.ok) return service.response;

  await updateProfileField(env, userId, "contract_start_at", now);
  await updateProfileField(env, userId, "contract_end_at", calculateContractEnd(now, termDays));
  await updateProfileField(env, userId, "monthly_card_end_at", calculateContractEnd(now, monthlyDays));
  await updateProfileField(env, userId, "contract_term_days", termDays);
  await updateProfileField(env, userId, "contract_active", 1);
  await updateProfileField(env, userId, "activation_status", "active");
  if (typeof body.machineCode === "string" || body.machineCode === null) {
    await updateProfileField(env, userId, "machine_code", body.machineCode === null ? null : body.machineCode.trim() || null);
  }
  if (body.agreementAccepted) {
    await updateProfileField(env, userId, "agreement_accepted_at", nowIso());
  }

  return handleCustomerDetail(env, userId);
}

async function handleRewardAdjustment(
  request: Request,
  env: Env,
  userId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
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
  const service = await applyServiceContractType(env, allowedTypes, userId, null);
  if (!service.ok) return service.response;

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
  superTxHash?: string | null;
  usdtTxHash?: string | null;
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

type FundCollectionRecord = {
  id: string;
  requesterWallet: string;
  requesterRole: string;
  sourceUserIds: string[];
  sourceDeviceCount: number;
  targetWallet: string;
  amountUsdt: string;
  amountSuper: string;
  status: string;
  txHash: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

function clampLimit(raw: string | null, fallback = 100, max = 500): number {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.min(Math.floor(value), max);
}

function isEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
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
  await ensureExchangeOrderTxColumns(env);
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
              eo.status AS status, eo.tx_hash AS tx_hash, eo.super_tx_hash AS super_tx_hash,
              eo.usdt_tx_hash AS usdt_tx_hash, eo.payout_wallet AS payout_wallet,
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
        super_tx_hash: string | null;
        usdt_tx_hash: string | null;
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
        txHash: row.usdt_tx_hash ?? row.tx_hash,
        superTxHash: row.super_tx_hash,
        usdtTxHash: row.usdt_tx_hash,
        payoutWallet: row.payout_wallet,
        note: row.request_note,
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

  const readExchangeRows = (tableName: "exchange_trade_logs" | "swap_trade_logs") => env.DB.prepare(
    `SELECT id, user_id, wallet, direction, amount_in, amount_out, price_snapshot,
            status, tx_hash, note, created_at, updated_at
     FROM ${tableName} ${where}
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

  let results: Awaited<ReturnType<typeof readExchangeRows>>["results"];
  try {
    results = (await readExchangeRows("exchange_trade_logs")).results;
  } catch {
    results = (await readExchangeRows("swap_trade_logs")).results;
  }

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

async function handleFundCollectionRecords(
  env: Env,
  url: URL,
  requesterWallet: string,
  requesterRole: AdminActorRole,
): Promise<Response> {
  await ensureCollectionRequestsTable(env);
  const limit = clampLimit(url.searchParams.get("limit"));
  const status = url.searchParams.get("status")?.trim();
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  if (requesterRole !== "owner") {
    clauses.push("LOWER(requester_wallet) = ?");
    params.push(requesterWallet.toLowerCase());
  }
  if (status) {
    clauses.push("status = ?");
    params.push(status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { results } = await env.DB.prepare(
    `SELECT id, requester_wallet, requester_role, source_user_ids_json, source_device_count,
            target_wallet, amount_usdt, amount_super, status, tx_hash, note,
            created_at, updated_at, completed_at
     FROM fund_collection_requests ${where}
     ORDER BY created_at DESC LIMIT ?`
  )
    .bind(...params, limit)
    .all<{
      id: string;
      requester_wallet: string;
      requester_role: string;
      source_user_ids_json: string;
      source_device_count: number;
      target_wallet: string;
      amount_usdt: string;
      amount_super: string;
      status: string;
      tx_hash: string | null;
      note: string | null;
      created_at: string;
      updated_at: string;
      completed_at: string | null;
    }>();

  const items: FundCollectionRecord[] = (results ?? []).map((row) => {
    let sourceUserIds: string[] = [];
    try {
      const parsed = JSON.parse(row.source_user_ids_json);
      sourceUserIds = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      sourceUserIds = [];
    }
    return {
      id: row.id,
      requesterWallet: row.requester_wallet,
      requesterRole: row.requester_role,
      sourceUserIds,
      sourceDeviceCount: Number(row.source_device_count ?? 0),
      targetWallet: row.target_wallet,
      amountUsdt: row.amount_usdt,
      amountSuper: row.amount_super,
      status: row.status,
      txHash: row.tx_hash,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
    };
  });

  return json({ items, limit });
}

async function handleFundCollectionCreate(
  request: Request,
  env: Env,
  requesterWallet: string,
  requesterRole: AdminActorRole,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  await ensureCollectionRequestsTable(env);
  const body = (await request.json().catch(() => null)) as {
    userIds?: string[];
    targetWallet?: string;
    note?: string;
  } | null;
  const userIds = Array.from(new Set((body?.userIds ?? []).filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())));
  const targetWallet = body?.targetWallet?.trim().toLowerCase() ?? "";
  if (userIds.length === 0) return badRequest("userIds required");
  if (!isEvmAddress(targetWallet)) return badRequest("targetWallet must be a valid wallet address");

  let amountUsdt = 0;
  let amountSuper = 0;
  let sourceDeviceCount = 0;
  const acceptedUserIds: string[] = [];

  for (const userId of userIds) {
    if (!(await canAccessUserByScope(env, scopeUserId, allowedTypes, userId))) continue;
    const row = await env.DB.prepare(
      `SELECT
         COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
         COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
         COUNT(d.id) AS deviceCount
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.user_id = u.id
       LEFT JOIN devices d ON d.user_id = u.id
       WHERE u.id = ?
       GROUP BY u.id, cp.total_reward_usdt, cp.total_reward_super`
    )
      .bind(userId)
      .first<{ totalRewardUsdt: string; totalRewardSuper: string; deviceCount: number }>();
    if (!row) continue;
    acceptedUserIds.push(userId);
    amountUsdt += Number(row.totalRewardUsdt ?? "0") || 0;
    amountSuper += Number(row.totalRewardSuper ?? "0") || 0;
    sourceDeviceCount += Number(row.deviceCount ?? 0);
  }

  if (acceptedUserIds.length === 0) return json({ error: "No accessible users selected" }, 403);

  const now = nowIso();
  const id = createId("fcr");
  await env.DB.prepare(
    `INSERT INTO fund_collection_requests (
      id, requester_wallet, requester_role, source_user_ids_json, source_device_count,
      target_wallet, amount_usdt, amount_super, status, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
  )
    .bind(
      id,
      requesterWallet.toLowerCase(),
      requesterRole,
      JSON.stringify(acceptedUserIds),
      sourceDeviceCount,
      targetWallet,
      amountUsdt.toFixed(6),
      amountSuper.toFixed(6),
      body?.note?.trim() || null,
      now,
      now,
    )
    .run();

  return json({
    ok: true,
    id,
    requesterWallet: requesterWallet.toLowerCase(),
    requesterRole,
    sourceUserIds: acceptedUserIds,
    sourceDeviceCount,
    targetWallet,
    amountUsdt: amountUsdt.toFixed(6),
    amountSuper: amountSuper.toFixed(6),
    status: "pending",
    createdAt: now,
  }, 201);
}

async function handleFundCollectionAction(
  request: Request,
  env: Env,
  requestId: string,
  action: "approve" | "reject" | "complete",
): Promise<Response> {
  await ensureCollectionRequestsTable(env);
  const current = await env.DB.prepare(
    `SELECT id, status
     FROM fund_collection_requests
     WHERE id = ?`
  )
    .bind(requestId)
    .first<{ id: string; status: string }>();
  if (!current) return json({ error: "Fund collection request not found" }, 404);

  const body = (await request.json().catch(() => null)) as {
    txHash?: string;
    note?: string;
  } | null;
  const now = nowIso();
  const txHash = body?.txHash?.trim() || null;
  const note = body?.note?.trim() || null;

  if (action === "approve") {
    if (current.status !== "pending") return badRequest("Only pending collection requests can be approved");
    await env.DB.prepare(
      `UPDATE fund_collection_requests
       SET status = 'approved',
           note = COALESCE(?, note),
           updated_at = ?
       WHERE id = ?`
    )
      .bind(note, now, requestId)
      .run();
    return json({ ok: true, id: requestId, status: "approved", updatedAt: now });
  }

  if (action === "reject") {
    if (current.status !== "pending") return badRequest("Only pending collection requests can be rejected");
    await env.DB.prepare(
      `UPDATE fund_collection_requests
       SET status = 'rejected',
           note = COALESCE(?, note),
           updated_at = ?,
           completed_at = ?
       WHERE id = ?`
    )
      .bind(note, now, now, requestId)
      .run();
    return json({ ok: true, id: requestId, status: "rejected", updatedAt: now, completedAt: now });
  }

  if (current.status !== "approved") return badRequest("Only approved collection requests can be completed");
  await env.DB.prepare(
    `UPDATE fund_collection_requests
     SET status = 'completed',
         tx_hash = COALESCE(?, tx_hash),
         note = COALESCE(?, note),
         updated_at = ?,
         completed_at = ?
     WHERE id = ?`
  )
    .bind(txHash, note, now, now, requestId)
    .run();
  return json({ ok: true, id: requestId, status: "completed", txHash, updatedAt: now, completedAt: now });
}

async function handleBulkRate(
  request: Request,
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    userIds?: string[];
    contractType?: string;
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
    if (!(await canManageUserByScope(env, scopeUserId, userId))) {
      continue;
    }
    await ensureProfile(env, userId);
    if (scopeUserId) {
      const service = await applyServiceContractType(env, allowedTypes, userId, body.contractType ?? null);
      if (!service.ok) continue;
    }
    await updateProfileField(env, userId, "reward_rate_usdt_per_hour", rate);
    updated += 1;
  }
  return json({ ok: true, updated, rate });
}

async function handleContractExtend(
  request: Request,
  env: Env,
  userId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    contractType?: string;
    extendDays?: number;
    mode?: "monthly" | "custom";
  } | null;

  await ensureProfile(env, userId);

  const existing = await env.DB.prepare(
    "SELECT contract_end_at, monthly_card_end_at, monthly_card_days FROM customer_profiles WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ contract_end_at: string | null; monthly_card_end_at: string | null; monthly_card_days: number | null }>();

  const monthlyDays = Math.max(1, Math.floor(Number(existing?.monthly_card_days ?? 30)));
  const days = body?.mode === "monthly"
    ? monthlyDays
    : Math.max(1, Math.floor(Number(body?.extendDays ?? 30)));
  const requestedType = normalizeContractType(body?.contractType)
    ?? contractTypeFromTerm(body?.mode === "monthly" ? monthlyDays : days);
  const service = await applyServiceContractType(env, allowedTypes, userId, requestedType);
  if (!service.ok) return service.response;

  const nowMs = Date.now();
  const newEnd = addDaysFromActiveEnd(existing?.contract_end_at, days, nowMs);

  let newMonthlyEnd: string | null = null;
  let contractEndAt = newEnd;
  if (body?.mode === "monthly") {
    newMonthlyEnd = addDaysFromActiveEnd(existing?.monthly_card_end_at, monthlyDays, nowMs);
    contractEndAt = laterIsoDate(existing?.contract_end_at, newMonthlyEnd);
    await updateProfileField(env, userId, "monthly_card_end_at", newMonthlyEnd);
    await updateProfileField(env, userId, "contract_end_at", contractEndAt);
  } else {
    contractEndAt = newEnd;
    await updateProfileField(env, userId, "contract_end_at", contractEndAt);
  }
  await updateProfileField(env, userId, "contract_active", 1);
  await updateProfileField(env, userId, "activation_status", "active");

  return json({ ok: true, contractEndAt, monthlyCardEndAt: newMonthlyEnd, extendedDays: days, mode: body?.mode ?? "custom" });
}

async function handleMonthlyCardDelete(
  env: Env,
  userId: string,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  await ensureProfile(env, userId);

  const service = await applyServiceContractType(env, allowedTypes, userId, "monthly");
  if (!service.ok) return service.response;

  const existing = await env.DB.prepare(
    "SELECT contract_end_at, monthly_card_end_at FROM customer_profiles WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ contract_end_at: string | null; monthly_card_end_at: string | null }>();

  await updateProfileField(env, userId, "monthly_card_end_at", null);

  return json({
    ok: true,
    monthlyCardEndAt: null,
    contractEndAt: existing?.contract_end_at ?? null,
    previousMonthlyCardEndAt: existing?.monthly_card_end_at ?? null,
  });
}

type AdminAlertItem = {
  userId: string;
  wallet: string;
  nickname: string | null;
  contractActive: number;
  contractEndAt: string | null;
  lastSeenAt: string | null;
  onlineStatus: "offline" | "stale";
  offlineSeconds: number;
  offlineAlertedAt: string | null;
  deviceCount: number;
  activeDeviceCount: number;
};

type MachineCodeConflictUser = {
  userId: string;
  wallet: string;
  nickname: string | null;
  contractActive: number;
  onlineStatus: "online" | "stale" | "offline";
  deviceCount: number;
  activeDeviceCount: number;
  updatedAt: string;
};

type MachineCodeConflictItem = {
  machineCode: string;
  userCount: number;
  activeContractCount: number;
  users: MachineCodeConflictUser[];
};

async function handleAdminAlerts(env: Env, scopeUserId: string | null, allowedTypes: ContractTypeScope): Promise<Response> {
  // Return customers whose heartbeat stopped while their contract is still active.
  // Uses a broad SQL pre-filter (older than online threshold) and then classifies
  // offline vs stale via the shared derivation to keep a single source of truth.
  const onlineCutoff = new Date(Date.now() - HEARTBEAT_ONLINE_MS).toISOString();

  const clauses: string[] = [
    "COALESCE(cp.contract_active, 0) = 1",
    "(cp.last_seen_at IS NULL OR cp.last_seen_at < ?)"
  ];
  const params: Array<string> = [onlineCutoff];
  if (scopeUserId) {
    clauses.push("EXISTS (SELECT 1 FROM referral_closure rc WHERE rc.ancestor_user_id = ? AND rc.descendant_user_id = u.id AND rc.depth >= 1)");
    params.push(scopeUserId);
    addContractScopeClause(clauses, params, allowedTypes);
  }

  const where = `WHERE ${clauses.join(" AND ")}`;

  const { results } = await env.DB.prepare(
    `SELECT
      u.id AS userId,
      u.wallet AS wallet,
      cp.nickname AS nickname,
      COALESCE(cp.contract_active, 0) AS contractActive,
      cp.contract_end_at AS contractEndAt,
      cp.last_seen_at AS lastSeenAt,
      cp.offline_alerted_at AS offlineAlertedAt,
      COUNT(DISTINCT d.id) AS deviceCount,
      SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS activeDeviceCount
    FROM users u
    INNER JOIN customer_profiles cp ON cp.user_id = u.id
    LEFT JOIN devices d ON d.user_id = u.id
    ${where}
    GROUP BY u.id, u.wallet, cp.nickname, cp.contract_active,
             cp.contract_end_at, cp.last_seen_at, cp.offline_alerted_at
    ORDER BY (CASE WHEN cp.last_seen_at IS NULL THEN 0 ELSE 1 END) ASC, cp.last_seen_at ASC`
  )
    .bind(...params)
    .all<{
      userId: string;
      wallet: string;
      nickname: string | null;
      contractActive: number;
      contractEndAt: string | null;
      lastSeenAt: string | null;
      offlineAlertedAt: string | null;
      deviceCount: number;
      activeDeviceCount: number;
    }>();

  const now = Date.now();
  const items: AdminAlertItem[] = [];
  for (const row of results ?? []) {
    const status = deriveLiveOnlineStatus(row.lastSeenAt);
    if (status === "online") continue;
    const seenMs = row.lastSeenAt ? new Date(row.lastSeenAt).getTime() : 0;
    const offlineSeconds = row.lastSeenAt && !Number.isNaN(seenMs)
      ? Math.max(0, Math.floor((now - seenMs) / 1000))
      : -1;
    items.push({
      userId: row.userId,
      wallet: row.wallet,
      nickname: row.nickname,
      contractActive: Number(row.contractActive ?? 0),
      contractEndAt: row.contractEndAt,
      lastSeenAt: row.lastSeenAt,
      onlineStatus: status,
      offlineSeconds,
      offlineAlertedAt: row.offlineAlertedAt,
      deviceCount: Number(row.deviceCount ?? 0),
      activeDeviceCount: Number(row.activeDeviceCount ?? 0),
    });
  }

  return json({
    items,
    counts: {
      total: items.length,
      stale: items.filter((item) => item.onlineStatus === "stale").length,
      offline: items.filter((item) => item.onlineStatus === "offline").length,
    },
    thresholds: {
      onlineMs: HEARTBEAT_ONLINE_MS,
      staleMs: HEARTBEAT_STALE_MS,
    },
    generatedAt: nowIso(),
  });
}

async function readMachineCodeConflictItems(
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
  machineCode?: string,
): Promise<MachineCodeConflictItem[]> {
  const clauses = ["cp.machine_code IS NOT NULL", "TRIM(cp.machine_code) <> ''"];
  const params: Array<string | number> = [];
  const normalizedMachineCode = machineCode?.trim();

  if (normalizedMachineCode) {
    clauses.push("LOWER(TRIM(cp.machine_code)) = ?");
    params.push(normalizedMachineCode.toLowerCase());
  }

  if (scopeUserId) {
    clauses.push("EXISTS (SELECT 1 FROM referral_closure rc WHERE rc.ancestor_user_id = ? AND rc.descendant_user_id = u.id AND rc.depth >= 1)");
    params.push(scopeUserId);
    addContractScopeClause(clauses, params, allowedTypes);
  }

  const { results } = await env.DB.prepare(
    `SELECT
      TRIM(cp.machine_code) AS machineCode,
      u.id AS userId,
      u.wallet AS wallet,
      cp.nickname AS nickname,
      COALESCE(cp.contract_active, 0) AS contractActive,
      cp.last_seen_at AS lastSeenAt,
      COALESCE(cp.updated_at, u.updated_at) AS updatedAt,
      COUNT(DISTINCT d.id) AS deviceCount,
      SUM(CASE WHEN d.status = 'active' THEN 1 ELSE 0 END) AS activeDeviceCount
    FROM customer_profiles cp
    INNER JOIN users u ON u.id = cp.user_id
    LEFT JOIN devices d ON d.user_id = u.id
    WHERE ${clauses.join(" AND ")}
    GROUP BY cp.machine_code, u.id, u.wallet, cp.nickname, cp.contract_active, cp.last_seen_at, cp.updated_at, u.updated_at
    ORDER BY TRIM(cp.machine_code) ASC, cp.contract_active DESC, COALESCE(cp.updated_at, u.updated_at) DESC`
  )
    .bind(...params)
    .all<{
      machineCode: string;
      userId: string;
      wallet: string;
      nickname: string | null;
      contractActive: number;
      lastSeenAt: string | null;
      updatedAt: string;
      deviceCount: number;
      activeDeviceCount: number;
    }>();

  const grouped = new Map<string, MachineCodeConflictUser[]>();
  for (const row of results ?? []) {
    const code = row.machineCode.trim();
    if (!code) continue;
    const users = grouped.get(code) ?? [];
    users.push({
      userId: row.userId,
      wallet: row.wallet,
      nickname: row.nickname,
      contractActive: Number(row.contractActive ?? 0),
      onlineStatus: deriveLiveOnlineStatus(row.lastSeenAt),
      deviceCount: Number(row.deviceCount ?? 0),
      activeDeviceCount: Number(row.activeDeviceCount ?? 0),
      updatedAt: row.updatedAt,
    });
    grouped.set(code, users);
  }

  return Array.from(grouped.entries())
    .filter(([, users]) => users.length > 1)
    .map(([code, users]) => ({
      machineCode: code,
      userCount: users.length,
      activeContractCount: users.filter((user) => user.contractActive === 1).length,
      users,
    }))
    .sort((a, b) => {
      if (b.activeContractCount !== a.activeContractCount) return b.activeContractCount - a.activeContractCount;
      if (b.userCount !== a.userCount) return b.userCount - a.userCount;
      return a.machineCode.localeCompare(b.machineCode);
    });
}

async function handleMachineCodeConflicts(
  request: Request,
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampLimit(url.searchParams.get("limit"), 30, 100);
  const items = await readMachineCodeConflictItems(env, scopeUserId, allowedTypes);
  return json({
    items: items.slice(0, limit),
    counts: {
      machineCodes: items.length,
      impactedUsers: items.reduce((total, item) => total + item.userCount, 0),
      activeContracts: items.reduce((total, item) => total + item.activeContractCount, 0),
    },
    generatedAt: nowIso(),
  });
}

async function handleMachineCodeConflictResolve(
  request: Request,
  env: Env,
  scopeUserId: string | null,
  allowedTypes: ContractTypeScope,
): Promise<Response> {
  const body = (await request.json().catch(() => null)) as { machineCode?: string; keepUserId?: string } | null;
  const machineCode = body?.machineCode?.trim() ?? "";
  const keepUserId = body?.keepUserId?.trim() ?? "";
  if (!machineCode || !keepUserId) return badRequest("machineCode and keepUserId are required");

  const items = await readMachineCodeConflictItems(env, scopeUserId, allowedTypes, machineCode);
  const item = items.find((entry) => entry.machineCode.toLowerCase() === machineCode.toLowerCase());
  if (!item) {
    return json({
      ok: true,
      resolved: false,
      machineCode,
      keepUserId,
      clearedUserIds: [],
      blockedActiveUserIds: [],
      remainingUserIds: [],
      reason: "no-conflict",
    });
  }

  if (!item.users.some((user) => user.userId === keepUserId)) {
    return badRequest("keepUserId does not belong to this machineCode conflict");
  }

  const now = nowIso();
  const clearedUserIds: string[] = [];
  const blockedActiveUserIds: string[] = [];

  for (const user of item.users) {
    if (user.userId === keepUserId) continue;
    if (user.contractActive === 1) {
      blockedActiveUserIds.push(user.userId);
      continue;
    }

    await env.DB.prepare(
      `UPDATE customer_profiles
       SET machine_code = NULL, updated_at = ?
       WHERE user_id = ? AND LOWER(TRIM(COALESCE(machine_code, ''))) = ?`
    )
      .bind(now, user.userId, machineCode.toLowerCase())
      .run();
    clearedUserIds.push(user.userId);
  }

  return json({
    ok: true,
    resolved: blockedActiveUserIds.length === 0,
    machineCode,
    keepUserId,
    clearedUserIds,
    blockedActiveUserIds,
    remainingUserIds: [keepUserId, ...blockedActiveUserIds],
  });
}

export async function handleAdmin(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  await ensureContractAccessColumns(env);
  await ensureAdminProfileColumns(env);
  const ownerCheck = request.method === "GET"
    ? await requireOwnerRead(request, env)
    : await requireOwner(request, env);
  if (!ownerCheck.ok) return ownerCheck.response;
  const requesterWallet = ownerCheck.wallet;
  const requesterRole = await getAdminActorRole(env, requesterWallet);
  if (!requesterRole) return json({ error: "Not admin wallet" }, 403);
  const isPrimaryOwner = requesterRole === "owner";
  const scopeUserId = isPrimaryOwner ? null : await ensureUserIdByWallet(env, requesterWallet);
  const allowedTypes = isPrimaryOwner ? null : await getSubAdminContractScope(env, requesterWallet);

  const isSubAdminCustomerLabelUpdate =
    !isPrimaryOwner &&
    request.method === "PUT" &&
    pathParts.length === 2 &&
    pathParts[0] === "customers";
  const isSubAdminCustomerDelete =
    !isPrimaryOwner &&
    request.method === "DELETE" &&
    pathParts.length === 2 &&
    pathParts[0] === "customers";
  const isSubAdminDeviceDelete =
    !isPrimaryOwner &&
    request.method === "DELETE" &&
    pathParts.length === 2 &&
    pathParts[0] === "devices";
  const isSubAdminCollectionCreate =
    !isPrimaryOwner &&
    request.method === "POST" &&
    pathParts.length === 1 &&
    pathParts[0] === "collection-requests";
  if (
    !isPrimaryOwner &&
    request.method !== "GET" &&
    !isSubAdminCustomerLabelUpdate &&
    !isSubAdminCustomerDelete &&
    !isSubAdminDeviceDelete &&
    !isSubAdminCollectionCreate
  ) {
    return json({ error: "SubAdmin is read-only. Owner permission is required for renewals and updates." }, 403);
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "customers") {
    return handleCustomerList(request, env, requesterWallet, requesterRole, scopeUserId, allowedTypes);
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "alerts") {
    return handleAdminAlerts(env, scopeUserId, allowedTypes);
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "machine-code-conflicts") {
    return handleMachineCodeConflicts(request, env, scopeUserId, allowedTypes);
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "machine-code-conflicts" && pathParts[1] === "resolve") {
    return handleMachineCodeConflictResolve(request, env, scopeUserId, allowedTypes);
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "devices") {
    return handleAdminDeviceList(request, env, scopeUserId, allowedTypes);
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "collection-requests") {
    return handleFundCollectionRecords(env, new URL(request.url), requesterWallet, requesterRole);
  }

  if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "collection-requests") {
    return handleFundCollectionCreate(request, env, requesterWallet, requesterRole, scopeUserId, allowedTypes);
  }

  if (
    request.method === "POST" &&
    pathParts.length === 3 &&
    pathParts[0] === "collection-requests" &&
    (pathParts[2] === "approve" || pathParts[2] === "reject" || pathParts[2] === "complete")
  ) {
    return handleFundCollectionAction(request, env, pathParts[1], pathParts[2]);
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "devices" && pathParts[1] === "bulk-update") {
    return handleAdminDeviceBulkUpdate(request, env, scopeUserId, allowedTypes);
  }

  if (pathParts.length === 2 && pathParts[0] === "devices") {
    const deviceRecordId = pathParts[1];
    if (!(await canAccessDeviceByScope(env, scopeUserId, allowedTypes, deviceRecordId))) {
      return json({ error: "Forbidden" }, 403);
    }
    if (request.method === "GET") {
      return handleAdminDeviceDetail(env, deviceRecordId);
    }
    if (request.method === "PATCH") {
      return handleAdminDeviceUpdate(request, env, deviceRecordId, allowedTypes);
    }
    if (request.method === "DELETE") {
      return handleAdminDeviceDelete(env, deviceRecordId);
    }
  }

  if (request.method === "POST" && pathParts.length === 2 && pathParts[0] === "customers" && pathParts[1] === "bulk-rate") {
    return handleBulkRate(request, env, scopeUserId, allowedTypes);
  }

  if (!isPrimaryOwner && pathParts[0] === "records") {
    return json({ error: "Forbidden" }, 403);
  }

  if (!isPrimaryOwner && pathParts[0] === "tasks") {
    return json({ error: "Forbidden" }, 403);
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
    if (!(await canAccessUserByScope(env, scopeUserId, allowedTypes, userId))) {
      return json({ error: "Forbidden" }, 403);
    }

    if (request.method === "GET" && pathParts.length === 2) {
      return handleCustomerDetail(env, userId);
    }

    if (request.method === "PUT" && pathParts.length === 2) {
      return handleCustomerUpdate(request, env, userId, allowedTypes);
    }

    if (request.method === "DELETE" && pathParts.length === 2) {
      return handleCustomerDelete(env, userId);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "activate") {
      return handleCustomerActivate(request, env, userId, allowedTypes);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "extend") {
      return handleContractExtend(request, env, userId, allowedTypes);
    }

    if (request.method === "DELETE" && pathParts.length === 3 && pathParts[2] === "monthly-card") {
      return handleMonthlyCardDelete(env, userId, allowedTypes);
    }

    if (request.method === "POST" && pathParts.length === 3 && pathParts[2] === "rewards") {
      return handleRewardAdjustment(request, env, userId, allowedTypes);
    }
  }

  return internalError("Unsupported admin route");
}
