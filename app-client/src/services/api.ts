const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787";

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

export type UserDto = { id: string; wallet: string; email?: string | null };
export type DeviceDto = { id: string; userId: string; deviceId: string; hashrate: number; status: string };

export async function createUser(wallet: string): Promise<UserDto> {
  return request<UserDto>("/api/users", {
    method: "POST",
    body: JSON.stringify({ wallet }),
  });
}

export async function registerDevice(payload: {
  userId: string;
  deviceId: string;
  hashrate: number;
}): Promise<DeviceDto> {
  return request<DeviceDto>("/api/devices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createClaim(payload: { userId: string; amount: string }) {
  return request<{ id: string; status: string }>("/api/claims", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
