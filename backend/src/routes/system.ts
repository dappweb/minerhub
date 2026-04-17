import { extractAndVerifyAuth } from "../lib/auth";
import { nowIso } from "../lib/id";
import { badRequest, internalError, json, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

type SystemSettingRow = {
  key: string;
  value: string;
};

type SystemStatus = {
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
};

const DEFAULT_STATUS: SystemStatus = {
  maintenanceEnabled: false,
  maintenanceMessageZh: "系统维护中，请稍后再试。",
  maintenanceMessageEn: "System maintenance in progress. Please try again later.",
  exchangeAutoEnabled: true,
  monthlyCardDays: 30,
  contractTermYearsDefault: 3,
  contractTermDaysDefault: 1095,
  rewardRateUsdtPerHour: 0.084,
  swapPriceSuperPerUsdt: 0,
  payoutWallets: [],
};

function isOwner(request: Request, env: Env): boolean {
  const wallet = request.headers.get("x-wallet") ?? "";
  return Boolean(env.OWNER_ADDRESS) && wallet.toLowerCase() === env.OWNER_ADDRESS!.toLowerCase();
}

async function requireOwner(request: Request, env: Env): Promise<Response | null> {
  const auth = await extractAndVerifyAuth(request, env);
  if (!auth.valid) {
    return unauthorized(auth.error || "Signature verification failed");
  }

  if (!isOwner(request, env)) {
    return unauthorized("Owner wallet required");
  }

  return null;
}

async function readStatus(env: Env): Promise<SystemStatus> {
  const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all<SystemSettingRow>();
  const settings = new Map<string, string>();
  for (const row of results ?? []) {
    settings.set(row.key, row.value);
  }

  const payoutWalletsRaw = settings.get("payout_wallets_json") ?? "[]";
  let payoutWallets: SystemStatus["payoutWallets"] = [];
  try {
    const parsed = JSON.parse(payoutWalletsRaw) as Array<{ walletAddress: string; priority?: number; isPrimary?: boolean }>;
    payoutWallets = parsed.map((item, index) => ({
      walletAddress: item.walletAddress,
      priority: Number.isFinite(item.priority as number) ? Number(item.priority) : index,
      isPrimary: Boolean(item.isPrimary),
    }));
  } catch {
    payoutWallets = [];
  }

  const maintenanceEnabled = (settings.get("maintenance_enabled") ?? "0") === "1";
  const exchangeAutoEnabled = (settings.get("exchange_auto_enabled") ?? "1") === "1";

  return {
    maintenanceEnabled,
    maintenanceMessageZh: settings.get("maintenance_message_zh") ?? DEFAULT_STATUS.maintenanceMessageZh,
    maintenanceMessageEn: settings.get("maintenance_message_en") ?? DEFAULT_STATUS.maintenanceMessageEn,
    exchangeAutoEnabled,
    monthlyCardDays: Number(settings.get("monthly_card_days") ?? DEFAULT_STATUS.monthlyCardDays),
    contractTermYearsDefault: Number(settings.get("contract_term_years_default") ?? DEFAULT_STATUS.contractTermYearsDefault),
    contractTermDaysDefault: Number(settings.get("contract_term_days_default") ?? DEFAULT_STATUS.contractTermDaysDefault),
    rewardRateUsdtPerHour: Number(settings.get("reward_rate_usdt_per_hour") ?? DEFAULT_STATUS.rewardRateUsdtPerHour),
    swapPriceSuperPerUsdt: Number(settings.get("swap_price_super_per_usdt") ?? DEFAULT_STATUS.swapPriceSuperPerUsdt),
    payoutWallets,
  };
}

async function upsertSetting(env: Env, key: string, value: string): Promise<void> {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO system_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  )
    .bind(key, value, now)
    .run();
}

async function handleSettingsRead(env: Env): Promise<Response> {
  return json(await readStatus(env));
}

async function handleSettingsUpdate(request: Request, env: Env): Promise<Response> {
  const ownerCheck = await requireOwner(request, env);
  if (ownerCheck) return ownerCheck;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("Invalid JSON body");

  const updates: Array<[string, string]> = [];

  const booleanFields: Array<[string, string]> = [
    ["maintenanceEnabled", "maintenance_enabled"],
    ["exchangeAutoEnabled", "exchange_auto_enabled"],
  ];
  for (const [sourceKey, targetKey] of booleanFields) {
    if (sourceKey in body) {
      updates.push([targetKey, body[sourceKey] ? "1" : "0"]);
    }
  }

  const stringFields: Array<[string, string]> = [
    ["maintenanceMessageZh", "maintenance_message_zh"],
    ["maintenanceMessageEn", "maintenance_message_en"],
    ["rewardRateUsdtPerHour", "reward_rate_usdt_per_hour"],
    ["swapPriceSuperPerUsdt", "swap_price_super_per_usdt"],
  ];
  for (const [sourceKey, targetKey] of stringFields) {
    const value = body[sourceKey];
    if (typeof value === "string" && value.trim()) {
      updates.push([targetKey, value.trim()]);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      updates.push([targetKey, String(value)]);
    }
  }

  const numericFields: Array<[string, string]> = [
    ["monthlyCardDays", "monthly_card_days"],
    ["contractTermYearsDefault", "contract_term_years_default"],
    ["contractTermDaysDefault", "contract_term_days_default"],
  ];
  for (const [sourceKey, targetKey] of numericFields) {
    const value = body[sourceKey];
    if (typeof value === "number" && Number.isFinite(value)) {
      updates.push([targetKey, String(Math.floor(value))]);
    }
  }

  if (Array.isArray(body.payoutWallets)) {
    const normalized = body.payoutWallets
      .map((item, index) => {
        if (typeof item === "string") {
          return { walletAddress: item, priority: index, isPrimary: index === 0 };
        }
        if (item && typeof item === "object" && "walletAddress" in item && typeof (item as { walletAddress?: unknown }).walletAddress === "string") {
          const walletAddress = (item as { walletAddress: string }).walletAddress.trim();
          return {
            walletAddress,
            priority: Number((item as { priority?: unknown }).priority ?? index),
            isPrimary: Boolean((item as { isPrimary?: unknown }).isPrimary),
          };
        }
        return null;
      })
      .filter((item): item is { walletAddress: string; priority: number; isPrimary: boolean } => Boolean(item) && Boolean(item.walletAddress));

    updates.push(["payout_wallets_json", JSON.stringify(normalized)]);
  }

  for (const [key, value] of updates) {
    await upsertSetting(env, key, value);
  }

  return json({ ok: true, settings: await readStatus(env) });
}

export async function handleSystem(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "status") {
    return json({
      ...(await readStatus(env)),
      timestamp: nowIso(),
    });
  }

  if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "settings") {
    const ownerCheck = await requireOwner(request, env);
    if (ownerCheck) return ownerCheck;
    return handleSettingsRead(env);
  }

  if (request.method === "PUT" && pathParts.length === 1 && pathParts[0] === "settings") {
    return handleSettingsUpdate(request, env);
  }

  return internalError("Unsupported system route");
}