import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

function readOption(name, fallback) {
  const prefix = `${name}=`;
  const hit = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const defaultDbPath = existsSync(resolve('dev.sqlite')) ? 'dev.sqlite' : 'backend/dev.sqlite';
const dbPath = resolve(readOption('--db', defaultDbPath));
const maxGapSeconds = Number(readOption('--max-gap-seconds', '90'));
const offlineThresholdMinutes = Number(readOption('--offline-threshold-minutes', '15'));

if (!existsSync(dbPath)) {
  throw new Error(`Database file not found: ${dbPath}`);
}

if (!Number.isFinite(maxGapSeconds) || maxGapSeconds < 30) {
  throw new Error('--max-gap-seconds must be a finite number >= 30');
}

if (!Number.isFinite(offlineThresholdMinutes) || offlineThresholdMinutes < 1) {
  throw new Error('--offline-threshold-minutes must be a finite number >= 1');
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function tableExists(name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
  return Boolean(row?.name);
}

function columnExists(table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((row) => row.name === column);
}

function toMs(value) {
  if (!value) return NaN;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function numberValue(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

for (const table of ['customer_profiles', 'devices', 'reward_ledger']) {
  if (!tableExists(table)) {
    throw new Error(`Required table missing: ${table}`);
  }
}

const nowIso = new Date().toISOString();
const offlineCutoffIso = new Date(Date.now() - offlineThresholdMinutes * 60_000).toISOString();

const heartbeatRewards = db.prepare(
  `SELECT id, user_id, device_id, reward_usdt, reward_super, accrued_from, accrued_to, created_at
   FROM reward_ledger
   WHERE source = 'heartbeat'`
).all();

const dirtyHeartbeatRewards = heartbeatRewards.filter((row) => {
  const fromMs = toMs(row.accrued_from);
  const toMsValue = toMs(row.accrued_to);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMsValue)) return true;
  const gapSeconds = (toMsValue - fromMs) / 1000;
  return gapSeconds <= 0 || gapSeconds > maxGapSeconds;
});

const staleOnlineProfiles = db.prepare(
  `SELECT user_id, last_seen_at, online_status
   FROM customer_profiles
   WHERE online_status = 'online'
     AND last_seen_at IS NOT NULL
     AND last_seen_at < ?`
).all(offlineCutoffIso);

const expiredProfiles = db.prepare(
  `SELECT user_id, contract_end_at
   FROM customer_profiles
   WHERE contract_active = 1
     AND contract_end_at IS NOT NULL
     AND contract_end_at < ?`
).all(nowIso);

const orphanProfiles = db.prepare(
  `SELECT cp.user_id
   FROM customer_profiles cp
   LEFT JOIN users u ON u.id = cp.user_id
   WHERE u.id IS NULL`
).all();

const orphanDevices = db.prepare(
  `SELECT d.id, d.user_id
   FROM devices d
   LEFT JOIN users u ON u.id = d.user_id
   WHERE u.id IS NULL`
).all();

const orphanRewards = db.prepare(
  `SELECT r.id, r.user_id
   FROM reward_ledger r
   LEFT JOIN users u ON u.id = r.user_id
   WHERE u.id IS NULL`
).all();

const affectedUserIds = new Set([
  ...dirtyHeartbeatRewards.map((row) => row.user_id),
  ...expiredProfiles.map((row) => row.user_id),
  ...staleOnlineProfiles.map((row) => row.user_id),
]);

function recomputeTotalsForUsers(userIds) {
  const sumStmt = db.prepare(
    `SELECT
       COALESCE(SUM(CAST(reward_usdt AS REAL)), 0) AS total_usdt,
       COALESCE(SUM(CAST(reward_super AS REAL)), 0) AS total_super
     FROM reward_ledger
     WHERE user_id = ?`
  );
  const updateStmt = db.prepare(
    `UPDATE customer_profiles
     SET total_reward_usdt = ?,
         total_reward_super = ?,
         updated_at = ?
     WHERE user_id = ?`
  );

  for (const userId of userIds) {
    const totals = sumStmt.get(userId);
    updateStmt.run(
      numberValue(totals?.total_usdt).toFixed(6),
      numberValue(totals?.total_super).toFixed(6),
      nowIso,
      userId,
    );
  }
}

function applyCleanup() {
  const deleteReward = db.prepare('DELETE FROM reward_ledger WHERE id = ?');
  const markOfflineProfile = db.prepare(
    `UPDATE customer_profiles
     SET online_status = 'offline',
         offline_alerted_at = COALESCE(offline_alerted_at, ?),
         updated_at = ?
     WHERE user_id = ?`
  );
  const markInactiveDevices = db.prepare(
    `UPDATE devices
     SET status = CASE WHEN status = 'active' THEN 'inactive' ELSE status END,
         updated_at = ?
     WHERE user_id = ?`
  );
  const expireProfile = db.prepare(
    `UPDATE customer_profiles
     SET contract_active = 0,
         activation_status = 'expired',
         online_status = 'offline',
         updated_at = ?
     WHERE user_id = ?`
  );
  const expireDevices = db.prepare(
    `UPDATE devices
     SET status = CASE WHEN status = 'active' THEN 'expired' ELSE status END,
         updated_at = ?
     WHERE user_id = ?`
  );
  const updateHeartbeatFields = columnExists('customer_profiles', 'last_heartbeat_at')
    && columnExists('customer_profiles', 'last_reward_accrued_at')
    ? db.prepare(
      `UPDATE customer_profiles
       SET last_heartbeat_at = COALESCE(last_heartbeat_at, last_seen_at),
           last_reward_accrued_at = COALESCE(last_reward_accrued_at, last_seen_at),
           updated_at = ?
       WHERE user_id = ?
         AND last_seen_at IS NOT NULL`
    )
    : null;

  const tx = db.transaction(() => {
    for (const row of dirtyHeartbeatRewards) {
      deleteReward.run(row.id);
    }

    for (const row of staleOnlineProfiles) {
      markOfflineProfile.run(nowIso, nowIso, row.user_id);
      markInactiveDevices.run(nowIso, row.user_id);
    }

    for (const row of expiredProfiles) {
      expireProfile.run(nowIso, row.user_id);
      expireDevices.run(nowIso, row.user_id);
    }

    if (updateHeartbeatFields) {
      const users = db.prepare('SELECT user_id FROM customer_profiles').all();
      for (const row of users) updateHeartbeatFields.run(nowIso, row.user_id);
    }

    recomputeTotalsForUsers(Array.from(affectedUserIds));
  });

  tx();
}

if (apply) {
  applyCleanup();
}

const summary = {
  mode: apply ? 'apply' : 'dry-run',
  dbPath,
  policy: {
    maxHeartbeatRewardGapSeconds: maxGapSeconds,
    offlineThresholdMinutes,
  },
  dirtyHeartbeatRewards: {
    count: dirtyHeartbeatRewards.length,
    rewardUsdt: dirtyHeartbeatRewards.reduce((sum, row) => sum + numberValue(row.reward_usdt), 0).toFixed(6),
    rewardSuper: dirtyHeartbeatRewards.reduce((sum, row) => sum + numberValue(row.reward_super), 0).toFixed(6),
    sampleIds: dirtyHeartbeatRewards.slice(0, 10).map((row) => row.id),
  },
  staleOnlineProfiles: {
    count: staleOnlineProfiles.length,
    sampleUserIds: staleOnlineProfiles.slice(0, 10).map((row) => row.user_id),
  },
  expiredProfiles: {
    count: expiredProfiles.length,
    sampleUserIds: expiredProfiles.slice(0, 10).map((row) => row.user_id),
  },
  orphanRowsDetectedOnly: {
    profiles: orphanProfiles.length,
    devices: orphanDevices.length,
    rewards: orphanRewards.length,
  },
  affectedUsersRecomputed: apply ? affectedUserIds.size : 0,
};

console.log(JSON.stringify(summary, null, 2));

db.close();
