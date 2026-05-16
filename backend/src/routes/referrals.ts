import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
import { createReferralBindJob, markReferralBindJobBound } from "../lib/referralJobs";
import { readOnChainReferrer, verifyReferralBindingOnChain } from "../lib/referralChain";
import { badRequest, json, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

type UserRow = {
  id: string;
  wallet: string;
};

type ReferralSummary = {
  userId: string;
  wallet: string;
  directCount: number;
  directAmountUsdt: string;
  teamCount: number;
  teamAmountUsdt: string;
};

type ReferralMemberItem = {
  userId: string;
  wallet: string;
  nickname: string | null;
  level: number;
  totalRewardUsdt: string;
  contractActive: number;
  createdAt: string;
};

function clamp(raw: string | null, fallback: number, max: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}

async function findUserByWallet(env: Env, wallet: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT id, wallet FROM users WHERE wallet = ?")
    .bind(wallet.toLowerCase())
    .first<UserRow>();
}

async function findUserById(env: Env, userId: string): Promise<UserRow | null> {
  return env.DB.prepare("SELECT id, wallet FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
}

function isPendingChainVerificationError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("transaction not found") ||
    lower.includes("all bsc rpc upstreams failed") ||
    lower.includes("timeout") ||
    lower.includes("network") ||
    lower.includes("rate limit") ||
    lower.includes("temporarily")
  );
}

async function ensureReferrerUser(env: Env, walletRaw: string): Promise<UserRow> {
  const wallet = walletRaw.trim().toLowerCase();
  if (!wallet) {
    throw new Error("Referral wallet is required");
  }

  const existing = await findUserByWallet(env, wallet);
  if (existing) {
    return existing;
  }

  const now = nowIso();
  const id = createId("usr");
  await env.DB.prepare(
    "INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)"
  )
    .bind(id, wallet, now, now)
    .run();

  return { id, wallet };
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

async function bindReferral(env: Env, invitee: UserRow, inviter: UserRow): Promise<void> {
  if (invitee.id === inviter.id) {
    throw new Error("Cannot bind self referral");
  }

  await ensureCustomerProfile(env, invitee.id);
  await ensureCustomerProfile(env, inviter.id);

  const existingInvitee = await env.DB.prepare(
    "SELECT id, inviter_user_id, inviter_wallet FROM referral_edges WHERE invitee_user_id = ?"
  )
    .bind(invitee.id)
    .first<{ id: string; inviter_user_id: string; inviter_wallet: string }>();
  if (existingInvitee) {
    if (
      existingInvitee.inviter_user_id === inviter.id ||
      existingInvitee.inviter_wallet.toLowerCase() === inviter.wallet.toLowerCase()
    ) {
      return;
    }
    throw new Error("Referral already bound");
  }

  const cycle = await env.DB.prepare(
    `SELECT ancestor_user_id
     FROM referral_closure
     WHERE ancestor_user_id = ? AND descendant_user_id = ?`
  )
    .bind(invitee.id, inviter.id)
    .first<{ ancestor_user_id: string }>();
  if (cycle) {
    throw new Error("Referral cycle detected");
  }

  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO referral_edges (
      id, inviter_user_id, invitee_user_id, inviter_wallet, invitee_wallet, status, bound_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  )
    .bind(createId("ref"), inviter.id, invitee.id, inviter.wallet.toLowerCase(), invitee.wallet.toLowerCase(), now, now, now)
    .run();

  const ancestors = await env.DB.prepare(
    `SELECT ancestor_user_id, depth FROM referral_closure WHERE descendant_user_id = ?`
  )
    .bind(inviter.id)
    .all<{ ancestor_user_id: string; depth: number }>();

  const descendants = await env.DB.prepare(
    `SELECT descendant_user_id, depth FROM referral_closure WHERE ancestor_user_id = ?`
  )
    .bind(invitee.id)
    .all<{ descendant_user_id: string; depth: number }>();

  const ancestorChain: Array<{ id: string; depthToInviter: number }> = [
    { id: inviter.id, depthToInviter: 0 },
    ...(ancestors.results ?? []).map((row) => ({ id: row.ancestor_user_id, depthToInviter: Number(row.depth ?? 0) })),
  ];

  const descendantChain: Array<{ id: string; depthFromInvitee: number }> = [
    { id: invitee.id, depthFromInvitee: 0 },
    ...(descendants.results ?? []).map((row) => ({ id: row.descendant_user_id, depthFromInvitee: Number(row.depth ?? 0) })),
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
    .bind(inviter.id, now, invitee.id)
    .run();
}

async function getReferralSummary(env: Env, user: UserRow): Promise<ReferralSummary> {
  const direct = await env.DB.prepare(
    `SELECT
      COUNT(*) AS direct_count,
      COALESCE(SUM(COALESCE(cp.total_reward_usdt, '0')), 0) AS direct_amount
     FROM referral_closure rc
     LEFT JOIN customer_profiles cp ON cp.user_id = rc.descendant_user_id
     WHERE rc.ancestor_user_id = ? AND rc.depth = 1`
  )
    .bind(user.id)
    .first<{ direct_count: number; direct_amount: string }>();

  const team = await env.DB.prepare(
    `SELECT
      COUNT(*) AS team_count,
      COALESCE(SUM(COALESCE(cp.total_reward_usdt, '0')), 0) AS team_amount
     FROM referral_closure rc
     LEFT JOIN customer_profiles cp ON cp.user_id = rc.descendant_user_id
     WHERE rc.ancestor_user_id = ? AND rc.depth >= 1`
  )
    .bind(user.id)
    .first<{ team_count: number; team_amount: string }>();

  return {
    userId: user.id,
    wallet: user.wallet,
    directCount: Number(direct?.direct_count ?? 0),
    directAmountUsdt: String(direct?.direct_amount ?? "0"),
    teamCount: Number(team?.team_count ?? 0),
    teamAmountUsdt: String(team?.team_amount ?? "0"),
  };
}

async function getReferralMembers(
  env: Env,
  userId: string,
  mode: "direct" | "team",
  limit: number,
  offset: number,
): Promise<{ items: ReferralMemberItem[]; total: number }> {
  const whereDepth = mode === "direct" ? "rc.depth = 1" : "rc.depth >= 1";

  const totalRow = await env.DB.prepare(
    `SELECT COUNT(*) AS total
     FROM referral_closure rc
     WHERE rc.ancestor_user_id = ? AND ${whereDepth}`
  )
    .bind(userId)
    .first<{ total: number }>();

  const rows = await env.DB.prepare(
    `SELECT
      u.id AS userId,
      u.wallet AS wallet,
      cp.nickname AS nickname,
      rc.depth AS level,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.contract_active, 0) AS contractActive,
      u.created_at AS createdAt
     FROM referral_closure rc
     INNER JOIN users u ON u.id = rc.descendant_user_id
     LEFT JOIN customer_profiles cp ON cp.user_id = rc.descendant_user_id
     WHERE rc.ancestor_user_id = ? AND ${whereDepth}
     ORDER BY rc.depth ASC, u.created_at DESC
     LIMIT ? OFFSET ?`
  )
    .bind(userId, limit, offset)
    .all<ReferralMemberItem>();

  return {
    items: (rows.results ?? []).map((row) => ({
      ...row,
      level: Number(row.level ?? 1),
      contractActive: Number(row.contractActive ?? 0),
    })),
    total: Number(totalRow?.total ?? 0),
  };
}

export async function handleReferrals(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "bind") {
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as {
      wallet?: string;
      referralWallet?: string;
      referralTxHash?: string;
      txHash?: string;
    } | null;

    if (!body?.wallet || !body.referralWallet) {
      return badRequest("wallet and referralWallet are required");
    }

    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch: body wallet must match signed wallet");
    }

    const invitee = await findUserByWallet(env, body.wallet);
    if (!invitee) return json({ error: "Invitee user not found" }, 404);

    const requestedTxHash = body.referralTxHash ?? body.txHash ?? null;
    let chainBinding: { invitee: string; inviter: string; txHash: string | null };
    try {
      chainBinding = await verifyReferralBindingOnChain(env, {
        inviteeWallet: body.wallet,
        inviterWallet: body.referralWallet,
        txHash: requestedTxHash,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Referral chain verification failed";
      if (requestedTxHash && isPendingChainVerificationError(message)) {
        const job = await createReferralBindJob(env, {
          inviteeWallet: body.wallet,
          inviterWallet: body.referralWallet,
          txHash: requestedTxHash,
          error: message,
        });

        return json({
          ok: true,
          pending: true,
          onChain: false,
          referralTxHash: requestedTxHash,
          inviteeUserId: invitee.id,
          jobId: job.id,
          message,
        }, 202);
      }
      return badRequest(message);
    }

    let inviter: UserRow;
    try {
      inviter = await ensureReferrerUser(env, chainBinding.inviter);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid referral wallet";
      return badRequest(message);
    }

    try {
      await bindReferral(env, invitee, inviter);
      await markReferralBindJobBound(env, invitee.wallet, inviter.wallet);
    } catch (error) {
      const message = error instanceof Error ? error.message : "bind referral failed";
      if (message.includes("already bound")) {
        return badRequest("Referral already bound");
      }
      if (message.includes("self")) {
        return badRequest("Cannot bind self referral");
      }
      if (message.includes("cycle")) {
        return badRequest("Referral cycle detected");
      }
      return json({ error: message }, 500);
    }

    const summary = await getReferralSummary(env, inviter);
    return json({
      ok: true,
      onChain: true,
      bound: true,
      referralTxHash: chainBinding.txHash,
      inviterUserId: inviter.id,
      inviteeUserId: invitee.id,
      inviterSummary: summary,
    });
  }

  if (request.method === "POST" && pathParts.length === 1 && pathParts[0] === "sync") {
    const authResult = await extractAndVerifyAuth(request, env);
    if (!authResult.valid) {
      return unauthorized(authResult.error || "Signature verification failed");
    }

    const body = (await request.json().catch(() => null)) as { wallet?: string } | null;
    if (!body?.wallet) {
      return badRequest("wallet is required");
    }

    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch: body wallet must match signed wallet");
    }

    const invitee = await findUserByWallet(env, body.wallet);
    if (!invitee) return json({ error: "Invitee user not found" }, 404);

    let inviterWallet: string | null;
    try {
      inviterWallet = await readOnChainReferrer(env, body.wallet);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Referral chain sync failed";
      return json({ error: message }, 503);
    }

    if (!inviterWallet) {
      return json({ ok: true, onChain: true, bound: false, inviteeUserId: invitee.id });
    }

    const inviter = await ensureReferrerUser(env, inviterWallet);
    try {
      await bindReferral(env, invitee, inviter);
      await markReferralBindJobBound(env, invitee.wallet, inviter.wallet);
    } catch (error) {
      const message = error instanceof Error ? error.message : "sync referral failed";
      if (message.includes("self")) {
        return badRequest("Cannot bind self referral");
      }
      if (message.includes("cycle")) {
        return badRequest("Referral cycle detected");
      }
      return json({ error: message }, 500);
    }

    const summary = await getReferralSummary(env, inviter);
    return json({
      ok: true,
      onChain: true,
      bound: true,
      inviterUserId: inviter.id,
      inviteeUserId: invitee.id,
      inviterSummary: summary,
    });
  }

  if (request.method === "GET" && pathParts.length === 2 && pathParts[1] === "summary") {
    const user = await findUserById(env, pathParts[0]);
    if (!user) return json({ error: "User not found" }, 404);
    const summary = await getReferralSummary(env, user);
    return json(summary);
  }

  if (request.method === "GET" && pathParts.length === 2 && (pathParts[1] === "direct" || pathParts[1] === "team")) {
    const user = await findUserById(env, pathParts[0]);
    if (!user) return json({ error: "User not found" }, 404);

    const url = new URL(request.url);
    const limit = clamp(url.searchParams.get("limit"), 50, 200);
    const offset = clamp(url.searchParams.get("offset"), 0, 10_000);
    const mode = pathParts[1] === "direct" ? "direct" : "team";
    const result = await getReferralMembers(env, user.id, mode, limit, offset);
    return json({ mode, limit, offset, ...result });
  }

  return json({ error: "Unsupported referrals route" }, 404);
}
