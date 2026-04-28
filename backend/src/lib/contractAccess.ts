import type { Env } from "../types/env";

export const CONTRACT_TYPE_OPTIONS = [
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "one_year", label: "1 year", days: 365 },
  { id: "two_year", label: "2 years", days: 730 },
  { id: "three_year", label: "3 years", days: 1095 },
] as const;

export type ContractTypeScope = string[] | null;

const BUILTIN_IDS = new Set(CONTRACT_TYPE_OPTIONS.map((item) => item.id));

let columnsReady = false;

export async function ensureContractAccessColumns(env: Env): Promise<void> {
  if (columnsReady) return;

  const [profileInfo, subAdminInfo] = await Promise.all([
    env.DB.prepare("PRAGMA table_info(customer_profiles)").all<{ name: string }>(),
    env.DB.prepare("PRAGMA table_info(owner_sub_admins)").all<{ name: string }>().catch(() => ({ results: [] as { name: string }[] })),
  ]);

  const profileColumns = new Set((profileInfo.results ?? []).map((row) => row.name));
  const subAdminRows = subAdminInfo.results ?? [];
  const subAdminColumns = new Set(subAdminRows.map((row) => row.name));
  const hasSubAdminTable = subAdminRows.length > 0;
  const statements: string[] = [];

  if (!profileColumns.has("contract_type")) {
    statements.push("ALTER TABLE customer_profiles ADD COLUMN contract_type TEXT");
  }
  if (hasSubAdminTable && !subAdminColumns.has("allowed_contract_types_json")) {
    statements.push("ALTER TABLE owner_sub_admins ADD COLUMN allowed_contract_types_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (hasSubAdminTable && !subAdminColumns.has("contract_types_locked_at")) {
    statements.push("ALTER TABLE owner_sub_admins ADD COLUMN contract_types_locked_at TEXT");
  }

  for (const statement of statements) {
    await env.DB.prepare(statement).run();
  }
  columnsReady = true;
}

export function normalizeContractType(value: unknown): string | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;

  const aliases = new Map<string, string>([
    ["month", "monthly"],
    ["monthly_card", "monthly"],
    ["30", "monthly"],
    ["30d", "monthly"],
    ["1", "one_year"],
    ["1y", "one_year"],
    ["365", "one_year"],
    ["365d", "one_year"],
    ["one-year", "one_year"],
    ["year_1", "one_year"],
    ["2", "two_year"],
    ["2y", "two_year"],
    ["730", "two_year"],
    ["730d", "two_year"],
    ["two-year", "two_year"],
    ["year_2", "two_year"],
    ["3", "three_year"],
    ["3y", "three_year"],
    ["1095", "three_year"],
    ["1095d", "three_year"],
    ["three-year", "three_year"],
    ["year_3", "three_year"],
  ]);

  const aliased = aliases.get(raw);
  if (aliased) return aliased;

  const normalized = raw.replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  return normalized || null;
}

export function normalizeContractTypes(value: unknown): string[] {
  const input = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const ids = new Set<string>();
  for (const item of input) {
    const normalized = normalizeContractType(item);
    if (normalized) ids.add(normalized);
  }
  return Array.from(ids);
}

export function parseAllowedContractTypes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    return normalizeContractTypes(JSON.parse(raw));
  } catch {
    return normalizeContractTypes(raw);
  }
}

export function serializeAllowedContractTypes(types: string[]): string {
  return JSON.stringify(normalizeContractTypes(types));
}

export function contractTypeFromTerm(termDays: number | null | undefined): string | null {
  if (!Number.isFinite(Number(termDays))) return null;
  const days = Math.max(1, Math.floor(Number(termDays)));
  const exact = CONTRACT_TYPE_OPTIONS.find((item) => item.days === days);
  if (exact) return exact.id;
  return `${days}d`;
}

export function contractTypeFromYears(years: number | null | undefined): string | null {
  if (!Number.isFinite(Number(years))) return null;
  return contractTypeFromTerm(Math.max(1, Math.floor(Number(years) * 365)));
}

export function contractTypeLabel(type: string | null | undefined): string {
  if (!type) return "";
  const option = CONTRACT_TYPE_OPTIONS.find((item) => item.id === type);
  return option?.label ?? type;
}

export function contractTypesEqual(a: string[], b: string[]): boolean {
  const left = normalizeContractTypes(a).sort();
  const right = normalizeContractTypes(b).sort();
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export function builtInContractTypeIds(): string[] {
  return Array.from(BUILTIN_IDS);
}

export function addContractScopeClause(
  clauses: string[],
  params: Array<string | number>,
  allowedTypes: ContractTypeScope,
  profileAlias = "cp",
): void {
  if (allowedTypes === null) return;
  if (allowedTypes.length === 0) {
    clauses.push(`(${profileAlias}.contract_type IS NULL OR TRIM(${profileAlias}.contract_type) = '')`);
    return;
  }
  clauses.push(
    `(${profileAlias}.contract_type IS NULL OR TRIM(${profileAlias}.contract_type) = '' OR ${profileAlias}.contract_type IN (${allowedTypes.map(() => "?").join(",")}))`
  );
  params.push(...allowedTypes);
}

export async function getSubAdminContractScope(env: Env, wallet: string | null | undefined): Promise<ContractTypeScope> {
  if (!wallet) return [];
  await ensureContractAccessColumns(env);

  let row: { allowed_contract_types_json: string | null } | null = null;
  try {
    row = await env.DB.prepare(
      `SELECT allowed_contract_types_json
       FROM owner_sub_admins
       WHERE wallet = ? AND enabled = 1
       LIMIT 1`
    )
      .bind(wallet.toLowerCase())
      .first<{ allowed_contract_types_json: string | null }>();
  } catch {
    row = null;
  }

  if (!row) {
    // Environment-configured subadmins predate this setting; keep them unrestricted
    // until they are moved into the DB-backed owner console.
    return null;
  }
  return parseAllowedContractTypes(row.allowed_contract_types_json);
}

export async function readCustomerContractType(env: Env, userId: string): Promise<string | null> {
  await ensureContractAccessColumns(env);
  const row = await env.DB.prepare("SELECT contract_type FROM customer_profiles WHERE user_id = ?")
    .bind(userId)
    .first<{ contract_type: string | null }>();
  return normalizeContractType(row?.contract_type ?? null);
}

export function isContractTypeInScope(allowedTypes: ContractTypeScope, contractType: string | null): boolean {
  if (allowedTypes === null) return true;
  if (!contractType) return true;
  return allowedTypes.includes(contractType);
}

export async function canAccessCustomerContractType(env: Env, allowedTypes: ContractTypeScope, userId: string): Promise<boolean> {
  return isContractTypeInScope(allowedTypes, await readCustomerContractType(env, userId));
}

export async function resolveServiceContractType(
  env: Env,
  allowedTypes: ContractTypeScope,
  userId: string,
  requestedType: string | null | undefined,
): Promise<{ ok: true; contractType: string | null } | { ok: false; status: 400 | 403; error: string }> {
  const requested = normalizeContractType(requestedType ?? null);
  const existing = await readCustomerContractType(env, userId);

  if (allowedTypes === null) {
    return { ok: true, contractType: requested ?? existing };
  }

  if (requested && !allowedTypes.includes(requested)) {
    return { ok: false, status: 403, error: "SubAdmin cannot use this contract type" };
  }
  if (existing && !allowedTypes.includes(existing)) {
    return { ok: false, status: 403, error: "Customer contract type is outside SubAdmin scope" };
  }
  if (existing && requested && existing !== requested) {
    return { ok: false, status: 400, error: "Customer contract type is already fixed" };
  }

  const next = existing ?? requested ?? (allowedTypes.length === 1 ? allowedTypes[0] : null);
  if (!next) {
    return { ok: false, status: 400, error: "contractType is required for this SubAdmin" };
  }
  return { ok: true, contractType: next };
}

export async function setCustomerContractTypeIfEmpty(env: Env, userId: string, contractType: string | null): Promise<void> {
  const normalized = normalizeContractType(contractType);
  if (!normalized) return;
  await ensureContractAccessColumns(env);
  await env.DB.prepare(
    `UPDATE customer_profiles
     SET contract_type = COALESCE(NULLIF(TRIM(contract_type), ''), ?),
         updated_at = ?
     WHERE user_id = ?`
  )
    .bind(normalized, new Date().toISOString(), userId)
    .run();
}
