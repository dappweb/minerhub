import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { activatePendingLocksOnAgreement } from "../lib/locks";
import { badRequest, json, unauthorized } from "../lib/response";
import { isMaintenanceEnabled } from "../lib/system";
import type { Env } from "../types/env";

const HEARTBEAT_ONLINE_MS = 90_000;
let heartbeatColumnsReady = false;

function deriveLiveOnlineStatus(lastSeenAt: string | null | undefined): "online" | "offline" {
  if (!lastSeenAt) return "offline";
  const ts = new Date(lastSeenAt).getTime();
  if (Number.isNaN(ts)) return "offline";
  return Date.now() - ts <= HEARTBEAT_ONLINE_MS ? "online" : "offline";
}

async function ensureHeartbeatColumns(env: Env): Promise<void> {
  if (heartbeatColumnsReady) return;
  const info = await env.DB.prepare("PRAGMA table_info(customer_profiles)").all<{ name: string }>();
  const columns = new Set((info.results ?? []).map((row) => row.name));
  const statements: string[] = [];
  if (!columns.has("last_heartbeat_at")) statements.push("ALTER TABLE customer_profiles ADD COLUMN last_heartbeat_at TEXT");
  if (!columns.has("last_reward_accrued_at")) statements.push("ALTER TABLE customer_profiles ADD COLUMN last_reward_accrued_at TEXT");
  if (!columns.has("total_online_seconds")) statements.push("ALTER TABLE customer_profiles ADD COLUMN total_online_seconds INTEGER NOT NULL DEFAULT 0");
  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  heartbeatColumnsReady = true;
}

async function ensureCustomerProfile(env: Env, userId: string): Promise<void> {
  await ensureHeartbeatColumns(env);
  const now = nowIso();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO customer_profiles (
      user_id, contract_term_days, monthly_card_days, contract_active,
      activation_status, exchange_auto_enabled, payout_wallets_json,
      reward_rate_usdt_per_hour, total_reward_usdt, total_reward_super,
      total_online_seconds, online_status, created_at, updated_at
    ) VALUES (?, 1095, 30, 0, 'pending', 1, '[]', '0.084', '0', '0', 0, 'offline', ?, ?)`
  )
    .bind(userId, now, now)
    .run();
}

async function findUserByWallet(env: Env, wallet: string): Promise<{ id: string; wallet: string } | null> {
  return env.DB.prepare("SELECT id, wallet FROM users WHERE wallet = ?")
    .bind(wallet.toLowerCase())
    .first<{ id: string; wallet: string }>();
}

async function ensureReferrerUser(env: Env, referralWalletRaw: string): Promise<{ id: string; wallet: string } | null> {
  const referralWallet = referralWalletRaw.trim().toLowerCase();
  if (!referralWallet) return null;

  const existing = await findUserByWallet(env, referralWallet);
  if (existing) return existing;

  const now = nowIso();
  const id = createId("usr");
  await env.DB.prepare(
    "INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)"
  )
    .bind(id, referralWallet, now, now)
    .run();

  return { id, wallet: referralWallet };
}

async function bindReferralRelation(env: Env, inviteeId: string, inviteeWallet: string, referralWalletRaw: string): Promise<void> {
  const referralWallet = referralWalletRaw.trim().toLowerCase();
  if (!referralWallet) return;
  if (inviteeWallet.toLowerCase() === referralWallet) return;

  const inviter = await ensureReferrerUser(env, referralWallet);
  if (!inviter) return;

  const existing = await env.DB.prepare("SELECT id FROM referral_edges WHERE invitee_user_id = ?")
    .bind(inviteeId)
    .first<{ id: string }>();
  if (existing) return;

  const cycle = await env.DB.prepare(
    `SELECT ancestor_user_id
     FROM referral_closure
     WHERE ancestor_user_id = ? AND descendant_user_id = ?`
  )
    .bind(inviteeId, inviter.id)
    .first<{ ancestor_user_id: string }>();
  if (cycle) return;

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO referral_edges (
      id, inviter_user_id, invitee_user_id, inviter_wallet, invitee_wallet, status, bound_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(createId("ref"), inviter.id, inviteeId, inviter.wallet.toLowerCase(), inviteeWallet.toLowerCase(), now, now, now)
    .run();

  const ancestors = await env.DB.prepare(
    `SELECT ancestor_user_id, depth FROM referral_closure WHERE descendant_user_id = ?`
  )
    .bind(inviter.id)
    .all<{ ancestor_user_id: string; depth: number }>();

  const descendantChain: Array<{ id: string; depthFromInvitee: number }> = [{ id: inviteeId, depthFromInvitee: 0 }];
  const ancestorChain: Array<{ id: string; depthToInviter: number }> = [
    { id: inviter.id, depthToInviter: 0 },
    ...(ancestors.results ?? []).map((row) => ({ id: row.ancestor_user_id, depthToInviter: Number(row.depth ?? 0) })),
  ];

  for (const ancestor of ancestorChain) {
    for (const descendant of descendantChain) {
      const depth = ancestor.depthToInviter + 1 + descendant.depthFromInvitee;
      await env.DB.prepare(
        `INSERT OR IGNORE INTO referral_closure (ancestor_user_id, descendant_user_id, depth, created_at)
         VALUES (?, ?, ?, ?)`
      )
        .bind(ancestor.id, descendant.id, depth, now)
        .run();
    }
  }

  await env.DB.prepare(
    `UPDATE customer_profiles
     SET parent_user_id = ?, updated_at = ?
     WHERE user_id = ? AND (parent_user_id IS NULL OR TRIM(parent_user_id) = '')`
  )
    .bind(inviter.id, now, inviteeId)
    .run();
}

export async function handleUsers(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 0) {
    if (await isMaintenanceEnabled(env)) {
      return json({ error: "System is under maintenance" }, 503);
    }

    // 验证签名
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { wallet?: string; email?: string; referralWallet?: string } | null;
    if (!body?.wallet) return badRequest("wallet is required");

    // 检查请求中的wallet与签名wallet是否一致
    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch: body wallet must match signed wallet");
    }

    const normalizedWallet = body.wallet.toLowerCase();
    const existing = await env.DB.prepare("SELECT id, wallet, email FROM users WHERE wallet = ?")
      .bind(normalizedWallet)
      .first<{ id: string; wallet: string; email: string | null }>();
    if (existing) {
      await ensureCustomerProfile(env, existing.id);
      return json({ id: existing.id, wallet: existing.wallet, email: existing.email ?? null });
    }

    const id = createId("usr");
    const now = nowIso();
    try {
      await env.DB.prepare(
        "INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
      )
        .bind(id, normalizedWallet, body.email ?? null, now, now)
        .run();
    } catch {
      // Idempotency fallback: if another request just created the same wallet, return that user.
      const raced = await env.DB.prepare("SELECT id, wallet, email FROM users WHERE wallet = ?")
        .bind(normalizedWallet)
        .first<{ id: string; wallet: string; email: string | null }>();
      if (!raced) {
        throw new Error("Failed to create user");
      }
      await ensureCustomerProfile(env, raced.id);
      return json({ id: raced.id, wallet: raced.wallet, email: raced.email ?? null });
    }

    await ensureCustomerProfile(env, id);
    if (typeof body.referralWallet === "string" && body.referralWallet.trim()) {
      await bindReferralRelation(env, id, normalizedWallet, body.referralWallet);
    }

    return json({ id, wallet: normalizedWallet, email: body.email ?? null, createdAt: now }, 201);
  }

  if (request.method === "GET" && pathParts.length === 1) {
    const userId = pathParts[0];
    const user = await env.DB.prepare("SELECT id, wallet, email, role, created_at, updated_at FROM users WHERE id = ?")
      .bind(userId)
      .first();

    if (!user) return json({ error: "User not found" }, 404);
    return json(user);
  }

  if (request.method === "GET" && pathParts.length === 2 && pathParts[1] === "details") {
    const userId = pathParts[0];
    await ensureCustomerProfile(env, userId);

    const user = await env.DB.prepare(
      `SELECT
        u.id, u.wallet, u.email, u.role, NULL AS status, u.created_at, u.updated_at,
        cp.nickname, cp.parent_user_id AS parentUserId, re.inviter_wallet AS inviterWallet, cp.contract_start_at AS contractStartAt, cp.contract_end_at AS contractEndAt,
        COALESCE(cp.contract_term_days, 1095) AS contractTermDays,
        COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
        COALESCE(cp.contract_active, 0) AS contractActive,
        COALESCE(cp.activation_status, 'pending') AS activationStatus,
        COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
        COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
        COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
        COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
        COALESCE(cp.total_online_seconds, 0) AS totalOnlineSeconds,
        cp.last_seen_at AS lastSeenAt, COALESCE(cp.online_status, 'offline') AS onlineStatus,
        cp.agreement_accepted_at AS agreementAcceptedAt, cp.offline_alerted_at AS offlineAlertedAt, cp.notes
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      LEFT JOIN referral_edges re ON re.invitee_user_id = u.id AND re.status = 'active'
      WHERE u.id = ?`
    )
      .bind(userId)
      .first();

    if (!user) return json({ error: "User not found" }, 404);

    const devices = await env.DB.prepare(
      "SELECT id, device_id, hashrate, status, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC"
    )
      .bind(userId)
      .all();

    const rewards = await env.DB.prepare(
      "SELECT id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at FROM reward_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    )
      .bind(userId)
      .all();

    const wallets = await env.DB.prepare(
      "SELECT wallet_address, priority, is_primary FROM payout_wallets WHERE user_id = ? ORDER BY priority ASC, created_at ASC"
    )
      .bind(userId)
      .all();

    const acceptance = await env.DB.prepare(
      "SELECT version, accepted_at FROM user_agreement_acceptances WHERE user_id = ? ORDER BY accepted_at DESC LIMIT 1"
    )
      .bind(userId)
      .first<{ version: string; accepted_at: string }>();

    const lockSummary = await env.DB.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'pending_agreement' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
         SUM(CASE WHEN status IN ('released','admin_released') THEN 1 ELSE 0 END) AS released
       FROM token_locks WHERE user_id = ?`
    )
      .bind(userId)
      .first<{ total: number; pending: number; active: number; released: number }>();

    return json({
      ...user,
      onlineStatus: deriveLiveOnlineStatus((user as { lastSeenAt?: string | null }).lastSeenAt ?? null),
      devices: devices.results ?? [],
      rewards: rewards.results ?? [],
      payoutWallets: wallets.results ?? [],
      agreementAcceptedVersion: acceptance?.version ?? null,
      agreementAcceptedAt: acceptance?.accepted_at ?? (user as { agreementAcceptedAt?: string | null }).agreementAcceptedAt ?? null,
      contractAgreementAcceptedVersion: (user as { contract_agreement_accepted_version?: string | null }).contract_agreement_accepted_version ?? null,
      lockSummary: {
        total: Number(lockSummary?.total ?? 0),
        pending: Number(lockSummary?.pending ?? 0),
        active: Number(lockSummary?.active ?? 0),
        released: Number(lockSummary?.released ?? 0),
      },
    });
  }

  // POST /api/users/:id/agreement — record user's agreement acceptance
  if (request.method === "POST" && pathParts.length === 2 && pathParts[1] === "agreement") {
    const userId = pathParts[0];

    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { version?: string; wallet?: string } | null;
    if (!body?.version || typeof body.version !== "string") {
      return badRequest("version is required");
    }

    const user = await env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; wallet: string }>();
    if (!user) return json({ error: "User not found" }, 404);

    if (authResult.wallet && user.wallet && authResult.wallet.toLowerCase() !== user.wallet.toLowerCase()) {
      return unauthorized("Wallet does not match user");
    }

    await ensureCustomerProfile(env, userId);

    const now = nowIso();
    const version = body.version.trim();
    await env.DB.prepare(
      `INSERT INTO user_agreement_acceptances (user_id, version, accepted_at, wallet)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, version) DO UPDATE SET accepted_at = excluded.accepted_at, wallet = excluded.wallet`
    )
      .bind(userId, version, now, authResult.wallet ?? user.wallet ?? null)
      .run();

    await env.DB.prepare(
      "UPDATE customer_profiles SET agreement_accepted_at = ?, updated_at = ? WHERE user_id = ?"
    )
      .bind(now, now, userId)
      .run();

    const activated = await activatePendingLocksOnAgreement(env, userId, version, now);

    return json({ ok: true, version, acceptedAt: now, activatedLocks: activated.activated });
  }

  // POST /api/users/:id/contract-agreement — record user's contract agreement acceptance
  if (request.method === "POST" && pathParts.length === 2 && pathParts[1] === "contract-agreement") {
    const userId = pathParts[0];

    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { version?: string; wallet?: string } | null;
    if (!body?.version || typeof body.version !== "string") {
      return badRequest("version is required");
    }

    const user = await env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?")
      .bind(userId)
      .first<{ id: string; wallet: string }>();
    if (!user) return json({ error: "User not found" }, 404);

    if (authResult.wallet && user.wallet && authResult.wallet.toLowerCase() !== user.wallet.toLowerCase()) {
      return unauthorized("Wallet does not match user");
    }

    await ensureCustomerProfile(env, userId);

    const now = nowIso();
    const version = body.version.trim();
    await env.DB.prepare(
      "UPDATE customer_profiles SET contract_agreement_accepted_version = ?, updated_at = ? WHERE user_id = ?"
    )
      .bind(version, now, userId)
      .run();

    return json({ ok: true, version, acceptedAt: now });
  }

  // GET /api/users?wallet=0x... — look up user by wallet address (for app re-install recovery)
  if (request.method === "GET" && pathParts.length === 0) {
    const wallet = new URL(request.url).searchParams.get("wallet");
    if (!wallet) return json({ error: "wallet query param is required" }, 400);
    const user = await env.DB.prepare("SELECT id, wallet, email, role, created_at, updated_at FROM users WHERE wallet = ?")
      .bind(wallet.toLowerCase())
      .first();
    if (!user) return json({ error: "User not found" }, 404);
    return json(user);
  }

  return json({ error: "Unsupported users route" }, 404);
}
