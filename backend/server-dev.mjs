/**
 * 本地开发替代服务器（替代 wrangler dev，解决 Windows workerd 崩溃问题）
 * 使用方式: node server-dev.mjs
 * 监听端口: 8788
 */

import Database from 'better-sqlite3';
import { verifyMessage } from 'ethers';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 9088;
const CHAIN_ID = process.env.CHAIN_ID || '56';
const HEARTBEAT_CONTINUITY_MS = 90_000;
const MAX_HEARTBEAT_REWARD_MS = 90_000;

function isContractExpiredAt(profile, referenceMs) {
  const endTimes = [profile?.contract_end_at, profile?.monthly_card_end_at]
    .map((value) => (value ? new Date(value).getTime() : NaN))
    .filter((value) => Number.isFinite(value));
  return endTimes.length > 0 && Math.max(...endTimes) < referenceMs;
}

// ─── 数据库初始化 ──────────────────────────────────────────────────────────────
const dbPath = join(__dirname, 'dev.sqlite');
const db = new Database(dbPath);
const schema = readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((row) => row.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureHeartbeatColumns() {
  ensureColumn('customer_profiles', 'last_heartbeat_at', 'TEXT');
  ensureColumn('customer_profiles', 'last_reward_accrued_at', 'TEXT');
  ensureColumn('customer_profiles', 'total_online_seconds', 'INTEGER NOT NULL DEFAULT 0');
}

ensureHeartbeatColumns();

// ─── 工具函数 ──────────────────────────────────────────────────────────────────
function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/** 已用 nonce 集合（防重放） */
const usedNonces = new Set();

/**
 * 验证请求签名
 * 前端签名格式: coinplanet|{nonce}|{path}|{JSON.stringify(payload)}
 */
function verifyAuth(headers, path, payload) {
  const sig = headers['x-signature'];
  const nonce = headers['x-nonce'];
  const wallet = headers['x-wallet'];
  if (!sig || !nonce || !wallet) return { valid: false, error: 'Missing auth headers' };
  if (usedNonces.has(nonce)) return { valid: false, error: 'Nonce already used' };
  try {
    const message = `coinplanet|${nonce}|${path}|${JSON.stringify(payload ?? {})}`;
    const recovered = verifyMessage(message, sig);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return { valid: false, error: 'Signature mismatch' };
    }
    usedNonces.add(nonce);
    if (usedNonces.size > 10000) usedNonces.clear();
    return { valid: true, wallet };
  } catch (e) {
    return { valid: false, error: `Verification error: ${e.message}` };
  }
}

function sendJson(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-signature, x-nonce, x-wallet',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve(null); }
    });
  });
}

function findUserByWallet(wallet) {
  return db.prepare('SELECT id, wallet, email FROM users WHERE wallet = ?').get(wallet.toLowerCase()) ?? null;
}

function findUserById(userId) {
  return db.prepare('SELECT id, wallet, email FROM users WHERE id = ?').get(userId) ?? null;
}

function ensureCustomerProfile(userId, machineCode = null) {
  ensureHeartbeatColumns();
  const now = nowIso();
  db.prepare(
    `INSERT OR IGNORE INTO customer_profiles (
      user_id, machine_code, contract_term_days, monthly_card_days, contract_active,
      activation_status, exchange_auto_enabled, reward_rate_usdt_per_hour,
      total_reward_usdt, total_reward_super, total_online_seconds, online_status, created_at, updated_at
    ) VALUES (?, ?, 1095, 30, 0, 'pending', 1, '0.084', '0', '0', 0, 'offline', ?, ?)`
  ).run(userId, machineCode, now, now);

  if (machineCode) {
    db.prepare('UPDATE customer_profiles SET machine_code = COALESCE(machine_code, ?), updated_at = ? WHERE user_id = ?')
      .run(machineCode, now, userId);
  }
}

function bindReferralRelation(invitee, inviter) {
  if (!invitee || !inviter) return;
  if (invitee.id === inviter.id) {
    throw new Error('Cannot bind self referral');
  }

  const existingInvitee = db.prepare('SELECT id FROM referral_edges WHERE invitee_user_id = ?').get(invitee.id);
  if (existingInvitee) {
    throw new Error('Referral already bound');
  }

  const cycle = db.prepare(
    `SELECT ancestor_user_id
     FROM referral_closure
     WHERE ancestor_user_id = ? AND descendant_user_id = ?`
  ).get(invitee.id, inviter.id);
  if (cycle) {
    throw new Error('Referral cycle detected');
  }

  const now = nowIso();
  db.prepare(
    `INSERT INTO referral_edges (
      id, inviter_user_id, invitee_user_id, inviter_wallet, invitee_wallet, status, bound_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`
  ).run(createId('ref'), inviter.id, invitee.id, inviter.wallet.toLowerCase(), invitee.wallet.toLowerCase(), now, now, now);

  const ancestors = db.prepare(
    'SELECT ancestor_user_id, depth FROM referral_closure WHERE descendant_user_id = ?'
  ).all(inviter.id);
  const descendants = db.prepare(
    'SELECT descendant_user_id, depth FROM referral_closure WHERE ancestor_user_id = ?'
  ).all(invitee.id);

  const ancestorChain = [
    { id: inviter.id, depthToInviter: 0 },
    ...ancestors.map((row) => ({ id: row.ancestor_user_id, depthToInviter: Number(row.depth ?? 0) })),
  ];
  const descendantChain = [
    { id: invitee.id, depthFromInvitee: 0 },
    ...descendants.map((row) => ({ id: row.descendant_user_id, depthFromInvitee: Number(row.depth ?? 0) })),
  ];

  for (const ancestor of ancestorChain) {
    for (const descendant of descendantChain) {
      const depth = ancestor.depthToInviter + 1 + descendant.depthFromInvitee;
      db.prepare(
        `INSERT OR IGNORE INTO referral_closure (ancestor_user_id, descendant_user_id, depth, created_at)
         VALUES (?, ?, ?, ?)`
      ).run(ancestor.id, descendant.id, depth, now);
    }
  }

  db.prepare(
    `UPDATE customer_profiles
     SET parent_user_id = ?, updated_at = ?
     WHERE user_id = ? AND (parent_user_id IS NULL OR TRIM(parent_user_id) = '')`
  ).run(inviter.id, now, invitee.id);
}

function getReferralSummary(user) {
  const direct = db.prepare(
    `SELECT
      COUNT(*) AS direct_count,
      COALESCE(SUM(COALESCE(cp.total_reward_usdt, '0')), 0) AS direct_amount
     FROM referral_closure rc
     LEFT JOIN customer_profiles cp ON cp.user_id = rc.descendant_user_id
     WHERE rc.ancestor_user_id = ? AND rc.depth = 1`
  ).get(user.id);

  const team = db.prepare(
    `SELECT
      COUNT(*) AS team_count,
      COALESCE(SUM(COALESCE(cp.total_reward_usdt, '0')), 0) AS team_amount
     FROM referral_closure rc
     LEFT JOIN customer_profiles cp ON cp.user_id = rc.descendant_user_id
     WHERE rc.ancestor_user_id = ? AND rc.depth >= 1`
  ).get(user.id);

  return {
    userId: user.id,
    wallet: user.wallet,
    directCount: Number(direct?.direct_count ?? 0),
    directAmountUsdt: String(direct?.direct_amount ?? '0'),
    teamCount: Number(team?.team_count ?? 0),
    teamAmountUsdt: String(team?.team_amount ?? '0'),
  };
}

function getReferralMembers(userId, mode, limit, offset) {
  const whereDepth = mode === 'direct' ? 'rc.depth = 1' : 'rc.depth >= 1';
  const totalRow = db.prepare(
    `SELECT COUNT(*) AS total
     FROM referral_closure rc
     WHERE rc.ancestor_user_id = ? AND ${whereDepth}`
  ).get(userId);

  const items = db.prepare(
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
  ).all(userId, limit, offset);

  return {
    items: items.map((row) => ({
      ...row,
      level: Number(row.level ?? 1),
      contractActive: Number(row.contractActive ?? 0),
    })),
    total: Number(totalRow?.total ?? 0),
  };
}

function getUserDetails(userId) {
  ensureCustomerProfile(userId);

  const user = db.prepare(
    `SELECT
      u.id, u.wallet, u.email, NULL AS status, u.created_at, u.updated_at,
      cp.nickname AS nickname,
      cp.machine_code AS machineCode,
      cp.parent_user_id AS parentUserId,
      cp.contract_start_at AS contractStartAt,
      cp.contract_end_at AS contractEndAt,
      COALESCE(cp.contract_term_days, 1095) AS contractTermDays,
      COALESCE(cp.monthly_card_days, 30) AS monthlyCardDays,
      COALESCE(cp.contract_active, 0) AS contractActive,
      COALESCE(cp.activation_status, 'pending') AS activationStatus,
      COALESCE(cp.exchange_auto_enabled, 1) AS exchangeAutoEnabled,
      COALESCE(cp.reward_rate_usdt_per_hour, '0.084') AS rewardRateUsdtPerHour,
      COALESCE(cp.total_reward_usdt, '0') AS totalRewardUsdt,
      COALESCE(cp.total_reward_super, '0') AS totalRewardSuper,
      COALESCE(cp.total_online_seconds, 0) AS totalOnlineSeconds,
      cp.last_seen_at AS lastSeenAt,
      COALESCE(cp.online_status, 'offline') AS onlineStatus,
      cp.agreement_accepted_at AS agreementAcceptedAt,
      cp.offline_alerted_at AS offlineAlertedAt,
      cp.notes AS notes
     FROM users u
     LEFT JOIN customer_profiles cp ON cp.user_id = u.id
     WHERE u.id = ?`
  ).get(userId);

  if (!user) return null;

  const devices = db.prepare(
    'SELECT id, device_id, hashrate, status, created_at, updated_at FROM devices WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
  const rewards = db.prepare(
    'SELECT id, device_id, reward_usdt, reward_super, rate_usdt_per_hour, source, note, created_at, updated_at FROM reward_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(userId);
  const payoutWallets = db.prepare(
    'SELECT wallet_address, priority, is_primary FROM payout_wallets WHERE user_id = ? ORDER BY priority ASC, created_at ASC'
  ).all(userId);

  return {
    ...user,
    devices,
    rewards,
    payoutWallets,
    agreementAcceptedVersion: null,
  };
}

function updateHeartbeatPresence(userId, deviceId, deviceRecordId, hashrate, heartbeatAt, note) {
  db.prepare(
    `UPDATE customer_profiles
     SET last_seen_at = ?,
         last_heartbeat_at = ?,
         last_reward_accrued_at = ?,
         online_status = 'online',
         updated_at = ?
     WHERE user_id = ?`
  ).run(heartbeatAt, heartbeatAt, heartbeatAt, heartbeatAt, userId);

  if (deviceRecordId) {
    db.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
      .run(heartbeatAt, deviceRecordId);
  }

  db.prepare(
    `INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  ).run(createId('dst'), deviceId, userId, Number(hashrate ?? 0), heartbeatAt, note);
}

function accrueHeartbeatReward(userId, deviceId, heartbeatAt) {
  ensureCustomerProfile(userId);
  const device = db.prepare('SELECT id, hashrate FROM devices WHERE user_id = ? AND device_id = ?')
    .get(userId, deviceId);

  if (!device) {
    db.prepare(
      `UPDATE customer_profiles
       SET last_seen_at = ?, last_heartbeat_at = ?, online_status = 'online', updated_at = ?
       WHERE user_id = ?`
    ).run(heartbeatAt, heartbeatAt, heartbeatAt, userId);
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: 'device_not_found' };
  }

  const profile = db.prepare(
    `SELECT contract_active, contract_end_at, monthly_card_end_at, reward_rate_usdt_per_hour, last_heartbeat_at
     FROM customer_profiles WHERE user_id = ?`
  ).get(userId);

  const heartbeatMs = new Date(heartbeatAt).getTime();
  const previousHeartbeatMs = profile?.last_heartbeat_at ? new Date(profile.last_heartbeat_at).getTime() : NaN;
  if (!profile?.last_heartbeat_at || Number.isNaN(previousHeartbeatMs)) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:first_seen');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: 'first_heartbeat' };
  }

  const heartbeatGapMs = Math.max(0, heartbeatMs - previousHeartbeatMs);
  if (heartbeatGapMs <= 0) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:duplicate');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: 'duplicate_heartbeat' };
  }

  if (heartbeatGapMs > HEARTBEAT_CONTINUITY_MS) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:reconnected');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: false, reason: 'reconnected_after_gap' };
  }

  if (Number(profile.contract_active ?? 0) !== 1) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:contract_inactive');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: 'contract_inactive' };
  }

  if (isContractExpiredAt(profile, heartbeatMs)) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:contract_expired');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: 'contract_expired' };
  }

  const accruedMs = Math.min(heartbeatGapMs, MAX_HEARTBEAT_REWARD_MS);
  const accruedSeconds = Math.max(0, Math.floor(accruedMs / 1000));
  const rate = Number(profile.reward_rate_usdt_per_hour ?? 0.084);
  const hashrateFactor = Math.max(1, Number(device.hashrate ?? 0) / 1000);
  const rewardUsdt = (accruedMs / 3_600_000) * rate * hashrateFactor;
  if (!Number.isFinite(rewardUsdt) || rewardUsdt <= 0) {
    updateHeartbeatPresence(userId, deviceId, device.id, device.hashrate, heartbeatAt, 'heartbeat:no_reward');
    return { rewardUsdt: 0, rewardSuper: 0, accruedSeconds: 0, continuous: true, reason: 'no_reward' };
  }

  const rewardSuper = 0;
  db.prepare(
    `INSERT INTO reward_ledger (
      id, user_id, device_id, reward_usdt, reward_super, rate_usdt_per_hour,
      accrued_from, accrued_to, source, note, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'heartbeat', ?, ?, ?)`
  ).run(
    createId('rwd'),
    userId,
    deviceId,
    rewardUsdt.toFixed(6),
    rewardSuper.toFixed(6),
    String(rate),
    profile.last_heartbeat_at,
    heartbeatAt,
    `continuous heartbeat reward (${accruedSeconds}s, hashrate=${device.hashrate})`,
    heartbeatAt,
    heartbeatAt,
  );

  db.prepare(
    `UPDATE customer_profiles
     SET total_reward_usdt = CAST(ROUND(CAST(total_reward_usdt AS REAL) + ?, 6) AS TEXT),
         total_reward_super = CAST(ROUND(CAST(total_reward_super AS REAL) + ?, 6) AS TEXT),
         last_seen_at = ?,
         last_heartbeat_at = ?,
         last_reward_accrued_at = ?,
         total_online_seconds = COALESCE(total_online_seconds, 0) + ?,
         online_status = 'online',
         updated_at = ?
     WHERE user_id = ?`
  ).run(rewardUsdt, rewardSuper, heartbeatAt, heartbeatAt, heartbeatAt, accruedSeconds, heartbeatAt, userId);

  db.prepare("UPDATE devices SET updated_at = ?, status = 'active' WHERE id = ?")
    .run(heartbeatAt, device.id);
  db.prepare(
    `INSERT INTO device_status_history (id, device_id, user_id, status, hashrate, observed_at, note)
     VALUES (?, ?, ?, 'active', ?, ?, ?)`
  ).run(createId('dst'), deviceId, userId, Number(device.hashrate ?? 0), heartbeatAt, 'heartbeat:reward');

  return { rewardUsdt, rewardSuper, accruedSeconds, continuous: true, reason: 'reward_accrued' };
}

// ─── HTTP 服务 ─────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'content-type, x-signature, x-nonce, x-wallet',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);

  // GET / — 服务状态
  if (parts.length === 0) {
    return sendJson(res, { service: 'coin-planet-api-dev', status: 'ok', timestamp: nowIso() });
  }

  if (parts[0] !== 'api') return sendJson(res, { error: 'Not found' }, 404);

  const scope = parts[1];
  const pathParts = parts.slice(2);

  // GET /api/health
  if (scope === 'health' && req.method === 'GET') {
    return sendJson(res, { status: 'healthy', chainId: CHAIN_ID, timestamp: nowIso() });
  }

  // ── /api/users ──────────────────────────────────────────────────────────────
  if (scope === 'users') {
    if (req.method === 'POST' && pathParts.length === 0) {
      const body = await readBody(req);
      const auth = verifyAuth(req.headers, url.pathname, body);
      if (!auth.valid) return sendJson(res, { error: auth.error }, 401);
      if (!body?.wallet) return sendJson(res, { error: 'wallet is required' }, 400);
      if (body.wallet.toLowerCase() !== auth.wallet.toLowerCase()) {
        return sendJson(res, { error: 'Wallet mismatch' }, 400);
      }
      try {
        const id = createId('usr');
        const now = nowIso();
        // 如果 wallet 已存在则返回已有用户
        const existing = findUserByWallet(body.wallet);
        if (existing) return sendJson(res, existing, 200);
        db.prepare('INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(id, body.wallet.toLowerCase(), body.email ?? null, now, now);
        ensureCustomerProfile(id, body.machineCode ?? null);
        if (typeof body.referralWallet === 'string' && body.referralWallet.trim()) {
          const inviter = findUserByWallet(body.referralWallet);
          if (inviter) {
            bindReferralRelation({ id, wallet: body.wallet.toLowerCase(), email: body.email ?? null }, inviter);
          }
        }
        return sendJson(res, { id, wallet: body.wallet.toLowerCase(), email: body.email ?? null }, 201);
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }
    if (req.method === 'GET' && pathParts.length === 0 && url.searchParams.get('wallet')) {
      const wallet = url.searchParams.get('wallet');
      const user = wallet ? findUserByWallet(wallet) : null;
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      return sendJson(res, user);
    }
    if (req.method === 'GET' && pathParts.length === 1) {
      const user = findUserById(pathParts[0]);
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      return sendJson(res, user);
    }
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'details') {
      const details = getUserDetails(pathParts[0]);
      if (!details) return sendJson(res, { error: 'User not found' }, 404);
      return sendJson(res, details);
    }
    return sendJson(res, { error: 'Unsupported users route' }, 404);
  }

  // ── /api/referrals ─────────────────────────────────────────────────────────
  if (scope === 'referrals') {
    if (req.method === 'POST' && pathParts.length === 1 && pathParts[0] === 'bind') {
      const body = await readBody(req);
      const auth = verifyAuth(req.headers, url.pathname, body);
      if (!auth.valid) return sendJson(res, { error: auth.error }, 401);
      if (!body?.wallet || !body.referralWallet) {
        return sendJson(res, { error: 'wallet and referralWallet are required' }, 400);
      }
      if (body.wallet.toLowerCase() !== auth.wallet.toLowerCase()) {
        return sendJson(res, { error: 'Wallet mismatch' }, 400);
      }

      const invitee = findUserByWallet(body.wallet);
      const inviter = findUserByWallet(body.referralWallet);
      if (!invitee) return sendJson(res, { error: 'Invitee user not found' }, 404);
      if (!inviter) return sendJson(res, { error: 'Referral wallet does not exist' }, 400);

      try {
        ensureCustomerProfile(invitee.id);
        ensureCustomerProfile(inviter.id);
        bindReferralRelation(invitee, inviter);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'bind referral failed';
        return sendJson(res, { error: message }, message.includes('already') || message.includes('self') || message.includes('cycle') ? 400 : 500);
      }

      return sendJson(res, {
        ok: true,
        inviterUserId: inviter.id,
        inviteeUserId: invitee.id,
        inviterSummary: getReferralSummary(inviter),
      });
    }

    if (req.method === 'GET' && pathParts.length === 2 && pathParts[1] === 'summary') {
      const user = findUserById(pathParts[0]);
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      return sendJson(res, getReferralSummary(user));
    }

    if (req.method === 'GET' && pathParts.length === 2 && (pathParts[1] === 'direct' || pathParts[1] === 'team')) {
      const user = findUserById(pathParts[0]);
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50) || 50, 1), 200);
      const offset = Math.max(Number(url.searchParams.get('offset') ?? 0) || 0, 0);
      const mode = pathParts[1] === 'direct' ? 'direct' : 'team';
      const result = getReferralMembers(user.id, mode, limit, offset);
      return sendJson(res, { mode, limit, offset, ...result });
    }

    return sendJson(res, { error: 'Unsupported referrals route' }, 404);
  }

  // ── /api/devices ────────────────────────────────────────────────────────────
  if (scope === 'devices') {
    if (req.method === 'POST' && pathParts.length === 0) {
      const body = await readBody(req);
      const auth = verifyAuth(req.headers, url.pathname, body);
      if (!auth.valid) return sendJson(res, { error: auth.error }, 401);
      if (!body?.userId || !body.deviceId || typeof body.hashrate !== 'number') {
        return sendJson(res, { error: 'userId, deviceId, hashrate are required' }, 400);
      }
      try {
        const id = createId('dev');
        const now = nowIso();
        ensureCustomerProfile(body.userId);
        const existing = db.prepare('SELECT id FROM devices WHERE user_id = ? AND device_id = ?')
          .get(body.userId, body.deviceId);
        if (existing) {
          db.prepare("UPDATE devices SET hashrate = ?, status = 'active', updated_at = ? WHERE id = ?")
            .run(body.hashrate, now, existing.id);
        } else {
          db.prepare('INSERT INTO devices (id, user_id, device_id, hashrate, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(id, body.userId, body.deviceId, body.hashrate, 'active', now, now);
        }
        db.prepare(
          `UPDATE customer_profiles
           SET last_seen_at = ?, online_status = 'online', updated_at = ?
           WHERE user_id = ?`
        ).run(now, now, body.userId);
        return sendJson(res, { id: existing?.id ?? id, userId: body.userId, deviceId: body.deviceId, hashrate: body.hashrate, status: 'active' }, existing ? 200 : 201);
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }
    if (req.method === 'POST' && pathParts.length === 2 && pathParts[1] === 'heartbeat') {
      const body = await readBody(req);
      const auth = verifyAuth(req.headers, url.pathname, body);
      if (!auth.valid) return sendJson(res, { error: auth.error }, 401);
      if (!body?.userId) return sendJson(res, { error: 'userId is required' }, 400);
      const user = findUserById(body.userId);
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      if (user.wallet.toLowerCase() !== auth.wallet.toLowerCase()) {
        return sendJson(res, { error: 'User does not belong to signed wallet' }, 401);
      }
      if (body.wallet && body.wallet.toLowerCase() !== auth.wallet.toLowerCase()) {
        return sendJson(res, { error: 'Wallet mismatch' }, 400);
      }

      const heartbeatAt = nowIso();
      const reward = accrueHeartbeatReward(body.userId, pathParts[0], heartbeatAt);
      if (typeof body.status === 'string') {
        const device = db.prepare('SELECT id FROM devices WHERE user_id = ? AND device_id = ?')
          .get(body.userId, pathParts[0]);
        if (device) {
          db.prepare('UPDATE devices SET status = ?, updated_at = ? WHERE id = ?')
            .run(body.status, heartbeatAt, device.id);
        }
      }
      return sendJson(res, { ok: true, deviceId: pathParts[0], userId: body.userId, heartbeatAt, reward });
    }
    if (req.method === 'GET' && pathParts.length === 1) {
      const items = db.prepare('SELECT id, user_id, device_id, hashrate, status FROM devices WHERE user_id = ? ORDER BY created_at DESC')
        .all(pathParts[0]);
      return sendJson(res, { items });
    }
    return sendJson(res, { error: 'Unsupported devices route' }, 404);
  }

  // ── /api/claims ─────────────────────────────────────────────────────────────
  if (scope === 'claims') {
    if (req.method === 'POST' && pathParts.length === 0) {
      return sendJson(res, {
        error: 'Deprecated endpoint. Use /api/claims/reward-withdraw or /api/claims/exchange-request instead.',
        code: 'CLAIMS_LEGACY_DEPRECATED',
      }, 410);
    }
    if (req.method === 'GET') {
      return sendJson(res, {
        error: 'Legacy claims history has been retired. Use reward-withdraw or exchange-request records instead.',
        code: 'CLAIMS_HISTORY_RETIRED',
      }, 410);
    }
    return sendJson(res, { error: 'Unsupported claims route' }, 404);
  }

  return sendJson(res, { error: 'Not found' }, 404);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Dev backend running on http://0.0.0.0:${PORT}`);
  console.log(`   Health: http://127.0.0.1:${PORT}/api/health`);
  console.log(`   DB:     ${dbPath}`);
});
