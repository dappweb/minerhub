import { extractAndVerifyAuth } from "../lib/auth";
import { nowIso } from "../lib/id";
import { isOwnerWallet } from "../lib/ownerAuth";
import { badRequest, internalError, json, unauthorized } from "../lib/response";
const DEFAULT_CONTRACT = {
    required: true,
    version: "1.0.0",
    titleZh: "用户挖矿合同",
    titleEn: "Mining Contract",
    contentZh: "感谢您购买我们的服务。本合同约定：\n\n1. 您已购买月卡并支付相关费用\n2. 激活后，您的账户开始累计挖矿收益\n3. 合同期限为所购周期（默认1095天）\n4. 期间请保持设备在线以持续累计收益\n5. 合同到期后收益停止累计\n6. 本条款由平台管理方解释",
    contentEn: "Thank you for purchasing our service. This contract stipulates:\n\n1. You have purchased a monthly card and paid the relevant fees\n2. After activation, your account begins to accrue mining rewards\n3. The contract term is the purchased period (default 1095 days)\n4. During this period, keep the device online to continue accruing rewards\n5. After the contract expires, reward accrual stops\n6. This clause is interpreted by the platform administrator",
};
const DEFAULT_AGREEMENT = {
    required: false,
    version: "1.0.0",
    titleZh: "用户协议",
    titleEn: "User Agreement",
    contentZh: "欢迎使用本应用。使用本服务即表示您已阅读并同意平台的服务条款、隐私政策以及相关的风险提示。管理员可随时更新本协议内容。",
    contentEn: "Welcome. By using this service you acknowledge that you have read and agreed to the platform terms of service, privacy policy and related risk disclosures. The administrator may update this agreement at any time.",
};
const DEFAULT_STATUS = {
    maintenanceEnabled: false,
    maintenanceMessageZh: "系统维护中，请稍后再试。",
    maintenanceMessageEn: "System maintenance in progress. Please try again later.",
    exchangeAutoEnabled: true,
    monthlyCardDays: 30,
    contractTermYearsDefault: 3,
    contractTermDaysDefault: 1095,
    rewardRateUsdtPerHour: 0.084,
    swapPriceSuperPerUsdt: 0,
    exchangeSuperRecipientAddress: null,
    payoutWallets: [],
    userAgreement: DEFAULT_AGREEMENT,
    contract: DEFAULT_CONTRACT,
    supportContacts: [],
};
const ALLOWED_CONTACT_TYPES = new Set([
    "weixin",
    "telegram",
    "email",
    "qq",
    "phone",
    "whatsapp",
    "line",
    "url",
    "other",
]);
function normalizeSupportContacts(raw) {
    if (!Array.isArray(raw))
        return [];
    const result = [];
    for (let i = 0; i < raw.length; i += 1) {
        const entry = raw[i];
        if (!entry || typeof entry !== "object")
            continue;
        const e = entry;
        const type = typeof e.type === "string" ? e.type.trim().toLowerCase() : "";
        const value = typeof e.value === "string" ? e.value.trim() : "";
        if (!type || !value)
            continue;
        if (!ALLOWED_CONTACT_TYPES.has(type))
            continue;
        const label = typeof e.label === "string" ? e.label.trim() : "";
        const note = typeof e.note === "string" ? e.note.trim() : "";
        const id = typeof e.id === "string" && e.id.trim() ? e.id.trim() : `contact-${Date.now()}-${i}`;
        result.push({ id, type, label, value, note });
    }
    return result;
}
function parseSupportContactsRaw(raw) {
    if (!raw)
        return [];
    try {
        return normalizeSupportContacts(JSON.parse(raw));
    }
    catch {
        return [];
    }
}
function isNormalizedPayoutWallet(item) {
    return item !== null && Boolean(item.walletAddress);
}
async function isOwner(request, env) {
    const wallet = request.headers.get("x-wallet") ?? "";
    return isOwnerWallet(env, wallet);
}
async function requireOwner(request, env) {
    const auth = await extractAndVerifyAuth(request, env);
    if (!auth.valid) {
        return unauthorized(auth.error || "Signature verification failed");
    }
    if (!(await isOwner(request, env))) {
        return unauthorized("Owner wallet required");
    }
    return null;
}
async function readStatus(env) {
    const { results } = await env.DB.prepare("SELECT key, value FROM system_settings").all();
    const settings = new Map();
    for (const row of results ?? []) {
        settings.set(row.key, row.value);
    }
    const payoutWalletsRaw = settings.get("payout_wallets_json") ?? "[]";
    let payoutWallets = [];
    try {
        const parsed = JSON.parse(payoutWalletsRaw);
        payoutWallets = parsed.map((item, index) => ({
            walletAddress: item.walletAddress,
            priority: Number.isFinite(item.priority) ? Number(item.priority) : index,
            isPrimary: Boolean(item.isPrimary),
        }));
    }
    catch {
        payoutWallets = [];
    }
    const maintenanceEnabled = (settings.get("maintenance_enabled") ?? "0") === "1";
    const exchangeAutoEnabled = (settings.get("exchange_auto_enabled") ?? "1") === "1";
    const contract = {
        required: (settings.get("contract_required") ?? "1") === "1",
        version: settings.get("contract_version") ?? DEFAULT_CONTRACT.version,
        titleZh: settings.get("contract_title_zh") ?? DEFAULT_CONTRACT.titleZh,
        titleEn: settings.get("contract_title_en") ?? DEFAULT_CONTRACT.titleEn,
        contentZh: settings.get("contract_content_zh") ?? DEFAULT_CONTRACT.contentZh,
        contentEn: settings.get("contract_content_en") ?? DEFAULT_CONTRACT.contentEn,
    };
    const userAgreement = {
        required: (settings.get("user_agreement_required") ?? "0") === "1",
        version: settings.get("user_agreement_version") ?? DEFAULT_AGREEMENT.version,
        titleZh: settings.get("user_agreement_title_zh") ?? DEFAULT_AGREEMENT.titleZh,
        titleEn: settings.get("user_agreement_title_en") ?? DEFAULT_AGREEMENT.titleEn,
        contentZh: settings.get("user_agreement_content_zh") ?? DEFAULT_AGREEMENT.contentZh,
        contentEn: settings.get("user_agreement_content_en") ?? DEFAULT_AGREEMENT.contentEn,
    };
    const supportContacts = parseSupportContactsRaw(settings.get("support_contacts_json") ?? "[]");
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
        exchangeSuperRecipientAddress: env.OWNER_ADDRESS?.trim() || null,
        payoutWallets,
        contract,
        userAgreement,
        supportContacts,
    };
}
async function upsertSetting(env, key, value) {
    const now = nowIso();
    await env.DB.prepare(`INSERT INTO system_settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
        .bind(key, value, now)
        .run();
}
async function handleSettingsRead(env) {
    return json(await readStatus(env));
}
async function handleSettingsUpdate(request, env) {
    const ownerCheck = await requireOwner(request, env);
    if (ownerCheck)
        return ownerCheck;
    const body = (await request.json().catch(() => null));
    if (!body)
        return badRequest("Invalid JSON body");
    const updates = [];
    const booleanFields = [
        ["maintenanceEnabled", "maintenance_enabled"],
        ["exchangeAutoEnabled", "exchange_auto_enabled"],
        ["userAgreementRequired", "user_agreement_required"],
        ["contractRequired", "contract_required"],
    ];
    for (const [sourceKey, targetKey] of booleanFields) {
        if (!(sourceKey in body))
            continue;
        const raw = body[sourceKey];
        // Strictly require a real boolean so values like string "false" cannot be coerced to true.
        if (typeof raw === "boolean") {
            updates.push([targetKey, raw ? "1" : "0"]);
        }
        else if (typeof raw === "number" && (raw === 0 || raw === 1)) {
            updates.push([targetKey, raw === 1 ? "1" : "0"]);
        }
        else {
            return badRequest(`Field ${sourceKey} must be a boolean`);
        }
    }
    // Fields that must always carry a non-empty value (numeric-as-string etc.).
    const nonEmptyStringFields = [
        ["rewardRateUsdtPerHour", "reward_rate_usdt_per_hour"],
        ["swapPriceSuperPerUsdt", "swap_price_super_per_usdt"],
        ["userAgreementVersion", "user_agreement_version"],
        ["contractVersion", "contract_version"],
    ];
    for (const [sourceKey, targetKey] of nonEmptyStringFields) {
        if (!(sourceKey in body))
            continue;
        const value = body[sourceKey];
        if (typeof value === "string" && value.trim()) {
            updates.push([targetKey, value.trim()]);
        }
        else if (typeof value === "number" && Number.isFinite(value)) {
            updates.push([targetKey, String(value)]);
        }
        else {
            return badRequest(`Field ${sourceKey} must be a non-empty string or finite number`);
        }
    }
    // Fields that may be cleared by the admin (set to empty string).
    const textFields = [
        ["maintenanceMessageZh", "maintenance_message_zh"],
        ["maintenanceMessageEn", "maintenance_message_en"],
        ["userAgreementTitleZh", "user_agreement_title_zh"],
        ["userAgreementTitleEn", "user_agreement_title_en"],
        ["userAgreementContentZh", "user_agreement_content_zh"],
        ["userAgreementContentEn", "user_agreement_content_en"],
        ["contractTitleZh", "contract_title_zh"],
        ["contractTitleEn", "contract_title_en"],
        ["contractContentZh", "contract_content_zh"],
        ["contractContentEn", "contract_content_en"],
    ];
    for (const [sourceKey, targetKey] of textFields) {
        if (!(sourceKey in body))
            continue;
        const value = body[sourceKey];
        if (typeof value !== "string") {
            return badRequest(`Field ${sourceKey} must be a string`);
        }
        updates.push([targetKey, value.trim()]);
    }
    const numericFields = [
        ["monthlyCardDays", "monthly_card_days", 1],
        ["contractTermYearsDefault", "contract_term_years_default", 1],
        ["contractTermDaysDefault", "contract_term_days_default", 1],
    ];
    for (const [sourceKey, targetKey, minValue] of numericFields) {
        if (!(sourceKey in body))
            continue;
        const value = body[sourceKey];
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return badRequest(`Field ${sourceKey} must be a finite number`);
        }
        const intValue = Math.floor(value);
        if (intValue < minValue) {
            return badRequest(`Field ${sourceKey} must be >= ${minValue}`);
        }
        updates.push([targetKey, String(intValue)]);
    }
    if (Array.isArray(body.payoutWallets)) {
        const normalized = body.payoutWallets
            .map((item, index) => {
            if (typeof item === "string") {
                return { walletAddress: item, priority: index, isPrimary: index === 0 };
            }
            if (item && typeof item === "object" && "walletAddress" in item && typeof item.walletAddress === "string") {
                const walletAddress = item.walletAddress.trim();
                return {
                    walletAddress,
                    priority: Number(item.priority ?? index),
                    isPrimary: Boolean(item.isPrimary),
                };
            }
            return null;
        })
            .filter(isNormalizedPayoutWallet);
        updates.push(["payout_wallets_json", JSON.stringify(normalized)]);
    }
    if (Array.isArray(body.supportContacts)) {
        const normalizedContacts = normalizeSupportContacts(body.supportContacts);
        updates.push(["support_contacts_json", JSON.stringify(normalizedContacts)]);
    }
    for (const [key, value] of updates) {
        await upsertSetting(env, key, value);
    }
    return json({ ok: true, settings: await readStatus(env) });
}
export async function handleSystem(request, env, pathParts) {
    if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "status") {
        return json({
            ...(await readStatus(env)),
            timestamp: nowIso(),
        });
    }
    if (request.method === "GET" && pathParts.length === 1 && pathParts[0] === "settings") {
        const ownerCheck = await requireOwner(request, env);
        if (ownerCheck)
            return ownerCheck;
        return handleSettingsRead(env);
    }
    if (request.method === "PUT" && pathParts.length === 1 && pathParts[0] === "settings") {
        return handleSettingsUpdate(request, env);
    }
    return internalError("Unsupported system route");
}
