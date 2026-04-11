import { getAuthHeaders } from './signature';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8788";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

/**
 * 带签名的请求（用于需要认证的API）
 */
async function signedRequest<T>(
  path: string,
  method: string,
  body: Record<string, any>
): Promise<T> {
  // 获取签名headers
  const authHeaders = await getAuthHeaders(path, body);

  return request<T>(path, {
    method,
    body: JSON.stringify(body),
    headers: authHeaders,
  });
}

export type UserDto = { id: string; wallet: string; email?: string | null };
export type DeviceDto = { id: string; userId: string; deviceId: string; hashrate: number; status: string };

export async function createUser(wallet: string): Promise<UserDto> {
  return signedRequest<UserDto>("/api/users", "POST", { wallet });
}

export async function registerDevice(payload: {
  userId: string;
  deviceId: string;
  hashrate: number;
  wallet?: string;
}): Promise<DeviceDto> {
  return signedRequest<DeviceDto>("/api/devices", "POST", payload);
}

export async function createClaim(payload: { userId: string; amount: string; wallet?: string }) {
  return signedRequest<{ id: string; status: string }>("/api/claims", "POST", payload);
}
