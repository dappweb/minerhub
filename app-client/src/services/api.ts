import { getAuthHeaders } from './signature';

const ENV_API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;
const DEFAULT_API_BASE_URL = 'https://api.coinplanets.net';
// 可通过 EXPO_PUBLIC_API_BASE_URL 配置多个地址（逗号分隔）实现可控回退（如备用域名）。
const FALLBACK_API_BASE_URLS = [
  DEFAULT_API_BASE_URL,
];
// 中国大陆网络下 CF 握手偶发 5-10s，设 12s 让慢链路能完成一次重试，又不至于让 UI 永远卡住。
const REQUEST_TIMEOUT_MS = 12_000;
const REQUEST_RETRY_COUNT = 3;
const RETRY_BACKOFF_MS = 800;

function generateRequestId(): string {
  // 轻量 reqId，用于请求幂等与服务端日志追踪。不依赖 crypto.randomUUID（老 RN 环境兼容）。
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  // 单次请求生命周期内复用同一个 reqId：跨重试/跨 baseUrl 都带上，便于服务端幂等与日志串联。
  const requestId = generateRequestId();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    for (let attempt = 1; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}${path}`, {
          headers: {
            'content-type': 'application/json',
            'x-request-id': requestId,
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
  const baseUrls = getApiBaseUrls();
  const requestId = generateRequestId();
  let lastError: unknown = null;

  for (const baseUrl of baseUrls) {
    for (let attempt = 1; attempt <= REQUEST_RETRY_COUNT; attempt += 1) {
      try {
        // Signed requests must use a fresh nonce/signature on each retry.
        const authHeaders = await getAuthHeaders(path, body);

        const response = await fetchWithTimeout(`${baseUrl}${path}`, {
          method,
          body: JSON.stringify(body),
          headers: {
            'content-type': 'application/json',
            'x-request-id': requestId,
            ...authHeaders,
          },
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

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error('API unavailable');
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

type AgreementDocumentDto = {
  required: boolean;
  version: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
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
  userAgreement?: AgreementDocumentDto;
  contract?: AgreementDocumentDto;
  supportContacts?: Array<{
    id: string;
    type: string;
    label: string;
    value: string;
    note: string;
  }>;
  timestamp?: string;
};

export type AnnouncementDto = {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  level: 'info' | 'warning' | 'critical';
  target: 'all' | 'active_contract';
  isPublished: boolean;
  isPinned: boolean;
  publishAt: string | null;
  expireAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UserDetailsDto = UserDto & {
  status?: string | null;
  nickname?: string | null;
  parentUserId?: string | null;
  inviterWallet?: string | null;
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
  totalOnlineSeconds?: number;
  lastSeenAt?: string | null;
  onlineStatus?: string;
  agreementAcceptedAt?: string | null;
  offlineAlertedAt?: string | null;
  notes?: string | null;
  agreementAcceptedVersion?: string | null;
  contractAgreementAcceptedVersion?: string | null;
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

export type ReferralSummaryDto = {
  userId: string;
  wallet: string;
  directCount: number;
  directAmountUsdt: string;
  teamCount: number;
  teamAmountUsdt: string;
};

export type ReferralMemberDto = {
  userId: string;
  wallet: string;
  nickname: string | null;
  level: number;
  totalRewardUsdt: string;
  contractActive: number;
  createdAt: string;
};

export type ReferralMembersPageDto = {
  mode: 'direct' | 'team';
  limit: number;
  offset: number;
  items: ReferralMemberDto[];
  total: number;
};

export type ExchangeOrderMode = 'auto' | 'manual' | string;
export type ExchangeOrderStatus =
  | 'manual_pending'
  | 'auto_processing'
  | 'approved'
  | 'submitted'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | string;

export type ExchangeRequestDto = {
  id: string;
  userId: string;
  wallet: string;
  amountSuper: string;
  amountUsdt: string;
  mode: ExchangeOrderMode;
  status: ExchangeOrderStatus;
  note: string | null;
  txHash: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export function isExchangeOrderPendingStatus(status: string): boolean {
  return status === 'manual_pending' || status === 'auto_processing' || status === 'approved' || status === 'submitted';
}

export type BindReferralResultDto = {
  ok: boolean;
  inviterUserId: string;
  inviteeUserId: string;
  inviterSummary: ReferralSummaryDto;
};

export async function createUser(wallet: string, referralWallet?: string): Promise<UserDto> {
  return signedRequest<UserDto>("/api/users", "POST", {
    wallet,
    ...(referralWallet ? { referralWallet } : {}),
  });
}

export async function bindReferral(wallet: string, referralWallet: string): Promise<BindReferralResultDto> {
  return signedRequest<BindReferralResultDto>('/api/referrals/bind', 'POST', {
    wallet,
    referralWallet,
  });
}

export async function getReferralSummary(userId: string): Promise<ReferralSummaryDto | null> {
  try {
    return await request<ReferralSummaryDto>(`/api/referrals/${userId}/summary`);
  } catch {
    return null;
  }
}

export async function getReferralMembers(
  userId: string,
  mode: 'direct' | 'team',
  page: number,
  pageSize: number,
): Promise<ReferralMembersPageDto | null> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
  const offset = (safePage - 1) * safePageSize;
  try {
    return await request<ReferralMembersPageDto>(
      `/api/referrals/${userId}/${mode}?limit=${safePageSize}&offset=${offset}`
    );
  } catch {
    return null;
  }
}

export async function getSystemStatus(): Promise<SystemStatusDto | null> {
  try {
    return await request<SystemStatusDto>("/api/system/status");
  } catch {
    return null;
  }
}

export async function getAnnouncements(): Promise<AnnouncementDto[]> {
  try {
    const result = await request<{ items: AnnouncementDto[] }>("/api/announcements");
    return result.items ?? [];
  } catch {
    return [];
  }
}

export async function markAnnouncementRead(userId: string, announcementId: string, wallet: string): Promise<{ ok: boolean; announcementId: string; readAt: string }> {
  return signedRequest<{ ok: boolean; announcementId: string; readAt: string }>(`/api/announcements/users/${userId}/read/${announcementId}`, 'POST', { wallet });
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

export async function getExchangeRequests(payload: {
  userId: string;
  wallet: string;
  limit?: number;
}): Promise<ExchangeRequestDto[]> {
  const res = await signedRequest<{ items: ExchangeRequestDto[] }>(
    '/api/claims/exchange-request/list',
    'POST',
    payload,
  );
  return res.items ?? [];
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

export async function acceptContractAgreement(userId: string, version: string, wallet: string): Promise<{ ok: boolean; version: string; acceptedAt: string }> {
  return signedRequest<{ ok: boolean; version: string; acceptedAt: string }>(`/api/users/${userId}/contract-agreement`, 'POST', { version, wallet });
}

export interface AppDownloadInfo {
  android: {
    available: boolean;
    version?: string;
    size?: number;
    uploadedAt?: string;
    downloadUrl?: string;
  };
  ios: {
    available: boolean;
    downloadUrl?: string;
  };
}

export async function getAppDownloadInfo(): Promise<AppDownloadInfo | null> {
  try {
    return await request<AppDownloadInfo>('/api/downloads');
  } catch {
    return null;
  }
}

