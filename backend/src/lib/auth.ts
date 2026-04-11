import { verifyMessage } from 'viem';
import type { Address, Hex } from 'viem';

/**
 * 签名验证流程：
 * 1. 前端获取nonce：GET /api/nonce
 * 2. 前端用钱包签名：signMessage("coinplanet|{nonce}|{path}|{payload}")
 * 3. 前端提交：headers { x-signature, x-nonce, x-wallet }
 * 4. 后台验证签名 + nonce唯一性 + 钱包一致性
 */

// 简单的内存nonce存储（生产使用KV或DB）
const usedNonces = new Set<string>();

export async function getNonce(): Promise<string> {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return nonce;
}

export async function verifySignature(
  wallet: string, // 前端传来的钱包地址
  signature: string, // 签名值 (0x开头)
  nonce: string, // nonce (防重放)
  path: string, // 请求路径 e.g. "/api/users"
  payload?: Record<string, any> // 请求体
): Promise<{ valid: boolean; error?: string }> {
  try {
    // 1. 检查nonce是否已用过
    if (usedNonces.has(nonce)) {
      return { valid: false, error: 'Nonce already used (replay attack detected)' };
    }

    // 2. 构造签名消息（必须与前端一致）
    const message = `coinplanet|${nonce}|${path}|${JSON.stringify(payload ?? {})}`;

    // 3. 验证签名
    const isValid = await verifyMessage({
      address: wallet as Address,
      message,
      signature: signature as Hex,
    });

    if (!isValid) {
      return { valid: false, error: 'Signature verification failed' };
    }

    // 4. 标记nonce已使用
    usedNonces.add(nonce);

    // 清理过期nonce（可选，防内存泄漏）
    if (usedNonces.size > 10000) {
      usedNonces.clear();
    }

    return { valid: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { valid: false, error: `Verification error: ${message}` };
  }
}

/**
 * 中间件：从请求头提取并验证签名
 */
export async function extractAndVerifyAuth(request: Request): Promise<{
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

  const result = await verifySignature(wallet, signature, nonce, path, body);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  return { valid: true, wallet };
}
