import { verifyMessage } from 'ethers';
import type { Env } from '../types/env';

/**
 * 签名验证流程：
 * 1. 前端获取nonce：GET /api/nonce
 * 2. 前端用钱包签名：signMessage("coinplanet|{nonce}|{path}|{payload}")
 * 3. 前端提交：headers { x-signature, x-nonce, x-wallet }
 * 4. 后台验证签名 + nonce唯一性（KV持久化，防重放）+ 钱包一致性
 */

// Nonce TTL：5 分钟（300 秒），超时后不可重放
const NONCE_TTL_SECONDS = 300;

export async function getNonce(): Promise<string> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return nonce;
}

export async function verifySignature(
  wallet: string,
  signature: string,
  nonce: string,
  path: string,
  cache: KVNamespace,
  payload?: Record<string, any>
): Promise<{ valid: boolean; error?: string }> {
  try {
    const kvKey = `nonce:${nonce}`;

    // 1. 检查nonce是否已用过（KV中存在则表示已使用）
    const existing = await cache.get(kvKey);
    if (existing !== null) {
      return { valid: false, error: 'Nonce already used (replay attack detected)' };
    }

    // 2. 构造签名消息（必须与前端一致）
    const message = `coinplanet|${nonce}|${path}|${JSON.stringify(payload ?? {})}`;

    // 3. 验证签名 (ethers v6: verifyMessage 返回恢复出的地址)
    const recovered = verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return { valid: false, error: 'Signature verification failed' };
    }

    // 4. 标记nonce已使用，TTL 后自动过期
    await cache.put(kvKey, '1', { expirationTtl: NONCE_TTL_SECONDS });

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: `Verification error: ${message}` };
  }
}

/**
 * 中间件：从请求头提取并验证签名
 */
export async function extractAndVerifyAuth(request: Request, env: Env): Promise<{
  valid: boolean;
  wallet?: string;
  error?: string;
}> {
  const signature = request.headers.get('x-signature');
  const nonce = request.headers.get('x-nonce');
  const wallet = request.headers.get('x-wallet');

  if (!signature || !nonce || !wallet) {
    return {
      valid: false,
      error: 'Missing auth headers (x-signature, x-nonce, x-wallet)',
    };
  }

  // 获取请求体用于签名验证
  const body = await request.clone().json().catch(() => ({})) as Record<string, any>;
  const path = new URL(request.url).pathname;

  const result = await verifySignature(wallet, signature, nonce, path, env.CACHE, body);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  return { valid: true, wallet };
}
