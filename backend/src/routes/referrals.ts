import { extractAndVerifyAuth } from "../lib/auth";
import { createId, nowIso } from "../lib/id";
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

async function bindReferral(env: Env, invitee: UserRow, inviter: UserRow): Promise<void> {
  if (invitee.id === inviter.id) {
    throw new Error("Cannot bind self referral");
  }

  const existingInvitee = await env.DB.prepare("SELECT id FROM referral_edges WHERE invitee_user_id = ?")
    .bind(invitee.id)
    .first<{ id: string }>();
  if (existingInvitee) {
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
    } | null;

    if (!body?.wallet || !body.referralWallet) {
      return badRequest("wallet and referralWallet are required");
    }

    if (body.wallet.toLowerCase() !== authResult.wallet?.toLowerCase()) {
      return badRequest("Wallet mismatch: body wallet must match signed wallet");
    }

    const invitee = await findUserByWallet(env, body.wallet);
    if (!invitee) return json({ error: "Invitee user not found" }, 404);

    const inviter = await findUserByWallet(env, body.referralWallet);
    if (!inviter) return badRequest("Referral wallet does not exist");

    try {
      await bindReferral(env, invitee, inviter);
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
    return json({ ok: true, inviterUserId: inviter.id, inviteeUserId: invitee.id, inviterSummary: summary });
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
