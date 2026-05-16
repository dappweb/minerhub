import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/auth", () => ({
    extractAndVerifyAuth: vi.fn(async () => ({ valid: true, wallet: "0xcurrent" })),
}));
vi.mock("../lib/system", () => ({
    getRewardRateUsdtPerHour: vi.fn(async () => "0.084"),
    isMaintenanceEnabled: vi.fn(async () => false),
    readSystemStatus: vi.fn(async () => ({})),
}));
function normalizeDeviceId(value) {
    return value.trim().toLowerCase();
}
class DeviceTestDb {
    users = new Map();
    devices = new Map();
    history = [];
    prepare(sql) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
            bind: (...args) => ({
                first: async () => this.execFirst(normalized, args),
                all: async () => this.execAll(normalized),
                run: async () => {
                    this.execRun(normalized, args);
                    return { success: true };
                },
            }),
            all: async () => this.execAll(normalized),
        };
    }
    execFirst(sql, args) {
        if (sql.startsWith("select id from users where id = ? and wallet = ?")) {
            const [id, wallet] = args;
            const row = this.users.get(id);
            return row?.wallet === wallet ? { id: row.id } : null;
        }
        if (sql.startsWith("select id, status from devices where user_id = ? and device_id = ?")) {
            const [userId, deviceId] = args;
            return (Array.from(this.devices.values()).find((row) => row.user_id === userId && row.device_id === deviceId) ?? null);
        }
        if (sql.includes("from devices") && sql.includes("device_id_normalized = ?")) {
            const [deviceIdNormalized] = args;
            return (this.devices.get(deviceIdNormalized) ?? null);
        }
        return null;
    }
    execAll(sql) {
        if (sql.startsWith("pragma table_info(devices)")) {
            return {
                results: [
                    { name: "id" },
                    { name: "user_id" },
                    { name: "device_id" },
                    { name: "device_id_normalized" },
                    { name: "hashrate" },
                    { name: "status" },
                    { name: "created_at" },
                    { name: "updated_at" },
                ],
            };
        }
        if (sql.startsWith("pragma table_info(customer_profiles)")) {
            return { results: [{ name: "last_heartbeat_at" }, { name: "last_reward_accrued_at" }, { name: "total_online_seconds" }, { name: "monthly_card_end_at" }] };
        }
        return { results: [] };
    }
    execRun(sql, args) {
        if (sql.startsWith("insert into devices")) {
            const [id, userId, deviceId, hashrate, status, createdAt, updatedAt] = args;
            const normalizedDeviceId = normalizeDeviceId(deviceId);
            if (this.devices.has(normalizedDeviceId)) {
                throw new Error("D1_ERROR: UNIQUE constraint failed: index 'uq_devices_device_id_normalized'");
            }
            this.devices.set(normalizedDeviceId, {
                id,
                user_id: userId,
                device_id: deviceId,
                device_id_normalized: normalizedDeviceId,
                hashrate,
                status,
                created_at: createdAt,
                updated_at: updatedAt,
            });
            return;
        }
        if (sql.startsWith("insert into device_status_history")) {
            this.history.push(args);
        }
    }
}
describe("devices route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns a friendly conflict when a normalized device is already bound to another user", async () => {
        const { handleDevices } = await import("./devices");
        const DB = new DeviceTestDb();
        DB.users.set("usr_current", { id: "usr_current", wallet: "0xcurrent" });
        DB.devices.set("mobile-abc12345", {
            id: "dev_existing",
            user_id: "usr_other",
            device_id: " MOBILE-ABC12345 ",
            device_id_normalized: "mobile-abc12345",
            hashrate: 1000,
            status: "active",
            created_at: "2026-05-16T00:00:00.000Z",
            updated_at: "2026-05-16T00:00:00.000Z",
        });
        const response = await handleDevices(new Request("https://api.example.test/api/devices", {
            method: "POST",
            body: JSON.stringify({
                userId: "usr_current",
                deviceId: "mobile-abc12345",
                hashrate: 1000,
                wallet: "0xcurrent",
            }),
        }), { DB }, []);
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            error: "device_already_bound",
            message: "该设备已绑定其他账号，请联系客服解绑或迁移",
        });
        expect(DB.history).toHaveLength(0);
    });
});
