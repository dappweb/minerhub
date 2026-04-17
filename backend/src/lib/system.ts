import type { Env } from "../types/env";

export type RuntimeSystemStatus = {
  maintenanceEnabled: boolean;
  maintenanceMessageZh: string;
  maintenanceMessageEn: string;
  exchangeAutoEnabled: boolean;
  monthlyCardDays: number;
  contractTermYearsDefault: number;
  contractTermDaysDefault: number;
  rewardRateUsdtPerHour: number;
  swapPriceSuperPerUsdt: number;
  payoutWalletsJson: string;
};

const DEFAULT_STATUS: RuntimeSystemStatus = {
  maintenanceEnabled: false,
  maintenanceMessageZh: "系统维护中，请稍后再试。",
  maintenanceMessageEn: "System maintenance in progress. Please try again later.",
  exchangeAutoEnabled: true,
  monthlyCardDays: 30,
  contractTermYearsDefault: 3,
  contractTermDaysDefault: 1095,
  rewardRateUsdtPerHour: 0.084,
  swapPriceSuperPerUsdt: 0,
  payoutWalletsJson: "[]",
};

export async function readSystemStatus(env: Env): Promise<RuntimeSystemStatus> {
  const rows = await env.DB.prepare("SELECT key, value FROM system_settings").all<{ key: string; value: string }>();
  const settings = new Map<string, string>();
  for (const row of rows.results ?? []) {
    settings.set(row.key, row.value);
  }

  return {
    maintenanceEnabled: (settings.get("maintenance_enabled") ?? "0") === "1",
    maintenanceMessageZh: settings.get("maintenance_message_zh") ?? DEFAULT_STATUS.maintenanceMessageZh,
    maintenanceMessageEn: settings.get("maintenance_message_en") ?? DEFAULT_STATUS.maintenanceMessageEn,
    exchangeAutoEnabled: (settings.get("exchange_auto_enabled") ?? "1") === "1",
    monthlyCardDays: Number(settings.get("monthly_card_days") ?? DEFAULT_STATUS.monthlyCardDays),
    contractTermYearsDefault: Number(settings.get("contract_term_years_default") ?? DEFAULT_STATUS.contractTermYearsDefault),
    contractTermDaysDefault: Number(settings.get("contract_term_days_default") ?? DEFAULT_STATUS.contractTermDaysDefault),
    rewardRateUsdtPerHour: Number(settings.get("reward_rate_usdt_per_hour") ?? DEFAULT_STATUS.rewardRateUsdtPerHour),
    swapPriceSuperPerUsdt: Number(settings.get("swap_price_super_per_usdt") ?? DEFAULT_STATUS.swapPriceSuperPerUsdt),
    payoutWalletsJson: settings.get("payout_wallets_json") ?? DEFAULT_STATUS.payoutWalletsJson,
  };
}

export async function isMaintenanceEnabled(env: Env): Promise<boolean> {
  return (await readSystemStatus(env)).maintenanceEnabled;
}

export async function getRewardRateUsdtPerHour(env: Env): Promise<number> {
  return (await readSystemStatus(env)).rewardRateUsdtPerHour;
}

export async function getContractTermDaysDefault(env: Env): Promise<number> {
  return (await readSystemStatus(env)).contractTermDaysDefault;
}

export async function isExchangeAutoEnabled(env: Env): Promise<boolean> {
  return (await readSystemStatus(env)).exchangeAutoEnabled;
}