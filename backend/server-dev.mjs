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

// ─── 数据库初始化 ──────────────────────────────────────────────────────────────
const dbPath = join(__dirname, 'dev.sqlite');
const db = new Database(dbPath);
const schema = readFileSync(join(__dirname, 'db', 'schema.sql'), 'utf8');
db.exec(schema);

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
    return sendJson(res, { status: 'healthy', chainId: '11155111', timestamp: nowIso() });
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
        const existing = db.prepare('SELECT id, wallet, email FROM users WHERE wallet = ?')
          .get(body.wallet.toLowerCase());
        if (existing) return sendJson(res, existing, 200);
        db.prepare('INSERT INTO users (id, wallet, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(id, body.wallet.toLowerCase(), body.email ?? null, now, now);
        return sendJson(res, { id, wallet: body.wallet.toLowerCase(), email: body.email ?? null }, 201);
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }
    if (req.method === 'GET' && pathParts.length === 1) {
      const user = db.prepare('SELECT id, wallet, email FROM users WHERE id = ?').get(pathParts[0]);
      if (!user) return sendJson(res, { error: 'User not found' }, 404);
      return sendJson(res, user);
    }
    return sendJson(res, { error: 'Unsupported users route' }, 404);
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
        db.prepare('INSERT INTO devices (id, user_id, device_id, hashrate, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, body.userId, body.deviceId, body.hashrate, 'active', now, now);
        return sendJson(res, { id, userId: body.userId, deviceId: body.deviceId, hashrate: body.hashrate, status: 'active' }, 201);
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
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
      const body = await readBody(req);
      const auth = verifyAuth(req.headers, url.pathname, body);
      if (!auth.valid) return sendJson(res, { error: auth.error }, 401);
      if (!body?.userId || !body.amount) {
        return sendJson(res, { error: 'userId and amount are required' }, 400);
      }
      try {
        const id = createId('clm');
        const now = nowIso();
        db.prepare('INSERT INTO claims (id, user_id, amount, status, tx_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .run(id, body.userId, body.amount, 'pending', null, now, now);
        return sendJson(res, { id, userId: body.userId, amount: body.amount, status: 'pending' }, 201);
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }
    if (req.method === 'GET' && pathParts.length === 1) {
      const claim = db.prepare('SELECT id, user_id, amount, status, tx_hash FROM claims WHERE id = ?').get(pathParts[0]);
      if (!claim) return sendJson(res, { error: 'Claim not found' }, 404);
      return sendJson(res, claim);
    }
    if (req.method === 'GET' && pathParts.length === 2 && pathParts[0] === 'user') {
      const items = db.prepare('SELECT id, user_id, amount, status, tx_hash FROM claims WHERE user_id = ? ORDER BY created_at DESC')
        .all(pathParts[1]);
      return sendJson(res, { items });
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
