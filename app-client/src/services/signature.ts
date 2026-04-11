import { getWalletAccount } from './wallet';

/**
 * 前端签名服务
 * 
 * 使用场景：
 * 1. 用户操作（注册、提交挖矿申请等）需要签名验证
 * 2. 签名格式：`coinplanet|{nonce}|{path}|{payload}`
 * 3. 返回签名 + nonce + wallet，在headers中传递给后台
 */

/**
 * 生成nonce（前端本地）
 */
export function generateNonce(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * 签名一个API请求
 * @param path API路径 (e.g., "/api/users")
 * @param payload 请求体
 * @param nonce 可选，不提供时自动生成
 */
export async function signRequest(
  path: string,
  payload: Record<string, any> = {},
  nonce?: string
): Promise<{
  wallet: string;
  signature: string;
  nonce: string;
}> {
  const finalNonce = nonce || generateNonce();
  const account = await getWalletAccount();
  
  // 2. 构造签名消息
  const message = `coinplanet|${finalNonce}|${path}|${JSON.stringify(payload)}`;
  
  const signature = await account.signMessage({
    message,
  });
  
  return {
    wallet: account.address,
    signature,
    nonce: finalNonce,
  };
}


/**
 * 辅助函数：为请求构建认证headers
 */
export async function getAuthHeaders(
  path: string,
  payload?: Record<string, any>
): Promise<Record<string, string>> {
  const { wallet, signature, nonce } = await signRequest(path, payload || {});
  
  return {
    'x-wallet': wallet,
    'x-signature': signature,
    'x-nonce': nonce,
  };
}
