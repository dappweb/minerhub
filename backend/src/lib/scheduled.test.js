import { describe, expect, it } from "vitest";
import { expireOverdueContracts } from "./scheduled";
class InMemoryDb {
    profiles = new Map();
    prepare(sql) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
            all: async () => ({ results: this.execAll(normalized, []) }),
            run: async () => {
                this.execRun(normalized, []);
                return { success: true };
            },
            bind: (...args) => ({
                first: async () => this.execFirst(),
                all: async () => ({ results: this.execAll(normalized, args) }),
                run: async () => {
                    this.execRun(normalized, args);
                    return { success: true };
                },
            }),
        };
    }
    execFirst() {
        return null;
    }
    execAll(sql, args) {
        if (sql.startsWith("pragma table_info(customer_profiles)")) {
            return [
                { name: "user_id" },
                { name: "contract_active" },
                { name: "activation_status" },
                { name: "contract_end_at" },
                { name: "monthly_card_end_at" },
            ];
        }
        if (sql.startsWith("select user_id from customer_profiles")) {
            const [now] = args;
            return Array.from(this.profiles.values())
                .filter((profile) => profile.contract_active === 1 && this.effectiveEnd(profile) !== null && this.effectiveEnd(profile) < now)
                .map((profile) => ({ user_id: profile.user_id }));
        }
        return [];
    }
    execRun(sql, args) {
        if (sql.startsWith("update customer_profiles set contract_active = 0")) {
            const [now, userId] = args;
            const profile = this.profiles.get(userId);
            if (!profile)
                return;
            profile.contract_active = 0;
            profile.activation_status = "expired";
            profile.online_status = "offline";
            profile.updated_at = now;
            return;
        }
    }
    effectiveEnd(profile) {
        const ends = [profile.contract_end_at, profile.monthly_card_end_at].filter((value) => Boolean(value));
        if (!ends.length)
            return null;
        return ends.sort().at(-1) ?? null;
    }
}
function createEnv() {
    const DB = new InMemoryDb();
    return { DB, env: { DB } };
}
describe("scheduled contract expiry", () => {
    it("keeps active profiles alive when monthly card end is still valid", async () => {
        const { DB, env } = createEnv();
        DB.profiles.set("usr_monthly", {
            user_id: "usr_monthly",
            contract_active: 1,
            activation_status: "active",
            contract_end_at: "2020-01-01T00:00:00.000Z",
            monthly_card_end_at: "2999-01-01T00:00:00.000Z",
            online_status: "online",
        });
        const result = await expireOverdueContracts(env);
        expect(result.expired).toBe(0);
        expect(DB.profiles.get("usr_monthly")?.contract_active).toBe(1);
        expect(DB.profiles.get("usr_monthly")?.activation_status).toBe("active");
    });
    it("expires profiles only after both contract and monthly card windows are over", async () => {
        const { DB, env } = createEnv();
        DB.profiles.set("usr_expired", {
            user_id: "usr_expired",
            contract_active: 1,
            activation_status: "active",
            contract_end_at: "2020-01-01T00:00:00.000Z",
            monthly_card_end_at: "2020-02-01T00:00:00.000Z",
            online_status: "online",
        });
        const result = await expireOverdueContracts(env);
        expect(result.expired).toBe(1);
        expect(DB.profiles.get("usr_expired")?.contract_active).toBe(0);
        expect(DB.profiles.get("usr_expired")?.activation_status).toBe("expired");
    });
});
