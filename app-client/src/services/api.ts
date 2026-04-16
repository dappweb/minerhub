import { getAuthHeaders } from './signature';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://coin-planet-api.dappweb.workers.dev";
const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      signal: controller.signal,
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
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('API request timeout');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

export async function getUser(userId: string): Promise<UserDto | null> {
  try {
    return await request<UserDto>(`/api/users/${userId}`);
  } catch {
    return null;
  }
}

export async function getUserByWallet(wallet: string): Promise<UserDto | null> {
  try {
    return await request<UserDto>(`/api/users?wallet=${encodeURIComponent(wallet)}`);
  } catch {
    return null;
  }
}

export async function getDevices(userId: string): Promise<DeviceDto[]> {
  try {
    const res = await request<{ items: DeviceDto[] }>(`/api/devices/${userId}`);
    return res.items ?? [];
  } catch {
    return [];
  }
}
