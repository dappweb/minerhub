import { getAuthHeaders } from './signature';

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const DEFAULT_API_BASE_URL = 'https://coin-planet-api.dappweb.workers.dev';
const FALLBACK_API_BASE_URLS = [
  DEFAULT_API_BASE_URL,
];
const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_RETRY_COUNT = 2;
const RETRY_BACKOFF_MS = 800;

let activeApiBaseUrl: string | null = null;

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function parseEnvBaseUrls(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);
}

function getApiBaseUrls(): string[] {
  const preferred = parseEnvBaseUrls(ENV_API_BASE_URL);
  const all = [activeApiBaseUrl ?? '', ...preferred, ...FALLBACK_API_BASE_URLS.map(normalizeBaseUrl)].filter(Boolean);
  return Array.from(new Set(all));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    err.name === 'AbortError' ||
    message.includes('network request failed') ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('timeout') ||
    message.includes('api unavailable')
  );
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrls = getApiBaseUrls();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    for (let attempt = 1; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}${path}`, {
          headers: {
            'content-type': 'application/json',
            ...(init?.headers ?? {}),
          },
          ...init,
        });

        if (!response.ok) {
          const text = await response.text();
          const message = text || `Request failed: ${response.status}`;

          if (isRetryableStatus(response.status) && attempt < REQUEST_RETRY_COUNT) {
            await delay(RETRY_BACKOFF_MS * attempt);
            continue;
          }

          throw new Error(message);
        }

        activeApiBaseUrl = baseUrl;
        return (await response.json()) as T;
      } catch (err) {
        const normalizedError = err instanceof Error && err.name === 'AbortError'
          ? new Error('API request timeout')
          : err;

        lastError = normalizedError;

        if (isRetryableError(normalizedError) && attempt < REQUEST_RETRY_COUNT) {
          await delay(RETRY_BACKOFF_MS * attempt);
          continue;
        }

        break;
      }
    }
  }

  const fallbackMessage =
    lastError instanceof Error
      ? lastError.message
      : 'API unavailable';

  throw new Error(`API unavailable: ${fallbackMessage}`);
}

export function getCurrentApiBaseUrl(): string {
  const first = getApiBaseUrls()[0];
  return first || DEFAULT_API_BASE_URL;
}

export async function pingApiHealth(): Promise<boolean> {
  try {
    await request<{ status: string; timestamp?: string }>('/api/health', {
      method: 'GET',
    });
    return true;
  } catch {
    return false;
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
export type GasPayToken = 'SUPER' | 'USDT';

export type GasQuoteDto = {
  quoteId: string;
  wallet: string;
  payToken: GasPayToken;
  payAmount: string;
  estimatedBnb: string;
  feeRate: number;
  expiresAt: string;
  quoteVersion: string;
};

export type GasOrderDto = {
  orderId?: string;
  id?: string;
  quoteId?: string;
  quote_id?: string;
  wallet: string;
  status: string;
  relayMode?: string;
  relay_mode?: string;
  relayTxHash?: string | null;
  relay_tx_hash?: string | null;
  errorMessage?: string | null;
  error_message?: string | null;
  fundedBnb?: string;
  bnb_amount?: string;
};

export type GasWalletBalanceDto = {
  wallet: string;
  total_bnb_funded: string;
  total_orders: number;
  updated_at: string;
};

export type GasIntentDto = {
  intentId?: string;
  id?: string;
  status: string;
  relayType?: string;
  relay_order_id?: string | null;
};

export type SystemStatusDto = {
  maintenanceEnabled: boolean;
  maintenanceMessageZh: string;
  maintenanceMessageEn: string;
  exchangeAutoEnabled: boolean;
  monthlyCardDays: number;
  contractTermYearsDefault: number;
  contractTermDaysDefault: number;
  rewardRateUsdtPerHour: number;
  swapPriceSuperPerUsdt: number;
  payoutWallets: Array<{ walletAddress: string; priority: number; isPrimary: boolean }>;
  userAgreement?: {
    required: boolean;
    version: string;
    titleZh: string;
    titleEn: string;
    contentZh: string;
    contentEn: string;
  };
  supportContacts?: Array<{
    id: string;
    type: string;
    label: string;
    value: string;
    note: string;
  }>;
  timestamp?: string;
};

export type UserDetailsDto = UserDto & {
  status?: string | null;
  nickname?: string | null;
  machineCode?: string | null;
  parentUserId?: string | null;
  contractStartAt?: string | null;
  contractEndAt?: string | null;
  contractTermDays?: number;
  monthlyCardDays?: number;
  contractActive?: number;
  activationStatus?: string;
  exchangeAutoEnabled?: number;
  rewardRateUsdtPerHour?: string;
  totalRewardUsdt?: string;
  totalRewardSuper?: string;
  lastSeenAt?: string | null;
  onlineStatus?: string;
  agreementAcceptedAt?: string | null;
  offlineAlertedAt?: string | null;
  notes?: string | null;
  agreementAcceptedVersion?: string | null;
  devices?: Array<{
    id: string;
    device_id: string;
    hashrate: number;
    status: string;
    created_at: string;
    updated_at: string;
  }>;
  rewards?: Array<{
    id: string;
    device_id: string | null;
    reward_usdt: string;
    reward_super: string;
    rate_usdt_per_hour: string;
    source: string;
    note: string | null;
    created_at: string;
    updated_at: string;
  }>;
  payoutWallets?: Array<{ wallet_address: string; priority: number; is_primary: number }>;
};

export async function createUser(wallet: string): Promise<UserDto> {
  return signedRequest<UserDto>("/api/users", "POST", { wallet });
}

export async function getSystemStatus(): Promise<SystemStatusDto | null> {
  try {
    return await request<SystemStatusDto>("/api/system/status");
  } catch {
    return null;
  }
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

export async function createExchangeRequest(payload: {
  userId: string;
  wallet: string;
  amountSuper: string;
  amountUsdt?: string;
  note?: string;
}) {
  return signedRequest<{
    id: string;
    mode: "auto" | "manual";
    status: string;
    autoEnabled: boolean;
    amountSuper: string;
    amountUsdt: string;
    createdAt: string;
  }>("/api/claims/exchange-request", "POST", payload);
}

export async function getUser(userId: string): Promise<UserDto | null> {
  try {
    return await request<UserDto>(`/api/users/${userId}`);
  } catch {
    return null;
  }
}

export async function getUserDetails(userId: string): Promise<UserDetailsDto | null> {
  try {
    return await request<UserDetailsDto>(`/api/users/${userId}/details`);
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

export async function quoteGasPackage(payload: {
  wallet: string;
  payToken: GasPayToken;
  payAmount: string;
}): Promise<GasQuoteDto> {
  return request<GasQuoteDto>('/api/gas/quote', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function purchaseGasPackage(payload: {
  quoteId: string;
  wallet: string;
  userId?: string;
}): Promise<GasOrderDto> {
  return signedRequest<GasOrderDto>('/api/gas/purchase', 'POST', payload);
}

export async function getGasOrder(orderId: string): Promise<GasOrderDto | null> {
  try {
    return await request<GasOrderDto>(`/api/gas/orders/${orderId}`);
  } catch {
    return null;
  }
}

export async function getGasWalletBalance(wallet: string): Promise<GasWalletBalanceDto | null> {
  try {
    return await request<GasWalletBalanceDto>(`/api/gas/balance?wallet=${encodeURIComponent(wallet)}`);
  } catch {
    return null;
  }
}

export async function createGasIntent(payload: {
  wallet: string;
  userId?: string;
  payToken: GasPayToken;
  maxTokenSpend: string;
  action: string;
  actionPayload?: Record<string, unknown>;
}): Promise<GasIntentDto> {
  return signedRequest<GasIntentDto>('/api/gas/intent', 'POST', payload);
}

export async function relayGasIntent(payload: {
  intentId: string;
  wallet: string;
}): Promise<GasIntentDto> {
  return signedRequest<GasIntentDto>('/api/gas/relay', 'POST', payload);
}

export async function getGasIntent(intentId: string): Promise<GasIntentDto | null> {
  try {
    return await request<GasIntentDto>(`/api/gas/intent/${intentId}`);
  } catch {
    return null;
  }
}

export async function reportDeviceHeartbeat(payload: {
  deviceId: string;
  userId: string;
  wallet?: string;
  status?: string;
  hashrate?: number;
}): Promise<{ ok: boolean; deviceId: string; userId: string; heartbeatAt: string } | null> {
  try {
    return await signedRequest<{ ok: boolean; deviceId: string; userId: string; heartbeatAt: string }>(`/api/devices/${payload.deviceId}/heartbeat`, 'POST', payload);
  } catch {
    return null;
  }
}

export async function acceptUserAgreement(userId: string, version: string, wallet: string): Promise<{ ok: boolean; version: string; acceptedAt: string }> {
  return signedRequest<{ ok: boolean; version: string; acceptedAt: string }>(`/api/users/${userId}/agreement`, 'POST', { version, wallet });
}

