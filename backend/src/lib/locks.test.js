import { describe, expect, it } from "vitest";
import { activatePendingLocksOnAgreement, autoReleaseMaturedLocks, hasActiveLock, } from "./locks";
class InMemoryDb {
    locks = [];
    profiles = new Map();
    prepare(sql) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
            bind: (...args) => ({
                first: async () => this.execFirst(normalized, args),
                all: async () => ({ results: this.execAll(normalized, args) }),
                run: async () => {
                    this.execRun(normalized, args);
                    return { success: true };
                },
            }),
        };
    }
    execFirst(sql, args) {
        if (sql.includes("select id from token_locks") && sql.includes("start_at <= ? and end_at > ?")) {
            const [userId, at1, at2] = args;
            const row = this.locks.find((x) => x.user_id === userId &&
                x.status === "active" &&
                !!x.start_at &&
                !!x.end_at &&
                x.start_at <= at1 &&
                x.end_at > at2 &&
                x.locked_super > x.released_super);
            return ((row && { id: row.id }) || null);
        }
        if (sql.includes("min(start_at) as min_start")) {
            const [userId, at] = args;
            const active = this.locks.filter((x) => x.user_id === userId &&
                x.status === "active" &&
                !!x.start_at &&
                !!x.end_at &&
                x.end_at > at &&
                x.locked_super > x.released_super);
            if (!active.length) {
                return { min_start: null, max_end: null, max_days: null, c: 0 };
            }
            const minStart = active.map((x) => x.start_at).sort()[0];
            const maxEnd = active.map((x) => x.end_at).sort().at(-1) ?? null;
            const maxDays = Math.max(...active.map((x) => x.lock_term_days));
            return { min_start: minStart, max_end: maxEnd, max_days: maxDays, c: active.length };
        }
        return null;
    }
    execAll(sql, args) {
        if (sql.includes("select id, lock_term_days from token_locks")) {
            const [userId] = args;
            return this.locks
                .filter((x) => x.user_id === userId && x.status === "pending_agreement")
                .map((x) => ({ id: x.id, lock_term_days: x.lock_term_days }));
        }
        if (sql.includes("select id, user_id from token_locks") && sql.includes("end_at <= ?")) {
            const [at] = args;
            return this.locks
                .filter((x) => x.status === "active" && !!x.end_at && x.end_at <= at)
                .map((x) => ({ id: x.id, user_id: x.user_id }));
        }
        return [];
    }
    execRun(sql, args) {
        if (sql.startsWith("update token_locks set status = 'active'")) {
            const [startAt, endAt, agreementVersion, updatedAt, lockId] = args;
            const row = this.locks.find((x) => x.id === lockId);
            if (!row)
                return;
            row.status = "active";
            row.start_at = startAt;
            row.end_at = endAt;
            row.agreement_version = agreementVersion;
            row.updated_at = updatedAt;
            return;
        }
        if (sql.startsWith("update token_locks set status = 'released'")) {
            const [releasedAt, updatedAt, lockId] = args;
            const row = this.locks.find((x) => x.id === lockId);
            if (!row)
                return;
            row.status = "released";
            row.released_super = row.locked_super;
            row.released_at = releasedAt;
            row.updated_at = updatedAt;
            return;
        }
        if (sql.startsWith("update customer_profiles set contract_active = 1")) {
            const [start, end, term, updatedAt, userId] = args;
            const row = this.profiles.get(userId);
            if (!row)
                return;
            row.contract_active = 1;
            row.activation_status = "active";
            row.contract_start_at = start ?? row.contract_start_at ?? null;
            row.contract_end_at = end ?? row.contract_end_at ?? null;
            row.contract_term_days = term ?? row.contract_term_days ?? null;
            row.updated_at = updatedAt;
            return;
        }
        if (sql.startsWith("update customer_profiles set contract_active = 0")) {
            const [updatedAt, userId] = args;
            const row = this.profiles.get(userId);
            if (!row)
                return;
            row.contract_active = 0;
            if (row.activation_status === "active")
                row.activation_status = "expired";
            row.updated_at = updatedAt;
        }
    }
}
function createEnv() {
    const DB = new InMemoryDb();
    return { DB, env: { DB } };
}
describe("locks lifecycle", () => {
    it("activates pending locks when agreement is accepted", async () => {
        const { DB, env } = createEnv();
        const now = "2026-04-24T10:00:00.000Z";
        DB.profiles.set("usr_1", {
            user_id: "usr_1",
            contract_active: 0,
            activation_status: "pending",
            updated_at: now,
        });
        DB.locks.push({
            id: "lok_1",
            user_id: "usr_1",
            wallet: "0xabc",
            locked_super: 100,
            released_super: 0,
            status: "pending_agreement",
            lock_term_days: 30,
            created_at: now,
            updated_at: now,
        });
        const result = await activatePendingLocksOnAgreement(env, "usr_1", "v1", now);
        expect(result.activated).toBe(1);
        const lock = DB.locks.find((x) => x.id === "lok_1");
        expect(lock.status).toBe("active");
        expect(lock.agreement_version ?? null).toBe("v1");
        expect(lock.start_at ?? null).toBe(now);
        expect(new Date(lock.end_at ?? now).getTime()).toBeGreaterThan(new Date(now).getTime());
        const profile = DB.profiles.get("usr_1");
        expect(profile.contract_active).toBe(1);
        expect(profile.activation_status).toBe("active");
    });
    it("auto releases matured active locks and syncs profile state", async () => {
        const { DB, env } = createEnv();
        const oldTime = "2026-01-01T00:00:00.000Z";
        const now = "2026-04-24T10:00:00.000Z";
        DB.profiles.set("usr_2", {
            user_id: "usr_2",
            contract_active: 1,
            activation_status: "active",
            contract_start_at: oldTime,
            contract_end_at: oldTime,
            contract_term_days: 1095,
            updated_at: oldTime,
        });
        DB.locks.push({
            id: "lok_2",
            user_id: "usr_2",
            wallet: "0xdef",
            locked_super: 88,
            released_super: 0,
            status: "active",
            lock_term_days: 30,
            start_at: oldTime,
            end_at: oldTime,
            created_at: oldTime,
            updated_at: oldTime,
        });
        const result = await autoReleaseMaturedLocks(env, now);
        expect(result.released).toBe(1);
        const lock = DB.locks.find((x) => x.id === "lok_2");
        expect(lock.status).toBe("released");
        expect(lock.released_super).toBe(88);
        expect(lock.released_at ?? null).toBe(now);
        const profile = DB.profiles.get("usr_2");
        expect(profile.contract_active).toBe(0);
        expect(profile.activation_status).toBe("expired");
    });
    it("checks active lock status with time window", async () => {
        const { DB, env } = createEnv();
        const start = "2026-04-01T00:00:00.000Z";
        const end = "2026-05-01T00:00:00.000Z";
        DB.locks.push({
            id: "lok_3",
            user_id: "usr_3",
            wallet: "0x123",
            locked_super: 50,
            released_super: 0,
            status: "active",
            lock_term_days: 30,
            start_at: start,
            end_at: end,
            created_at: start,
            updated_at: start,
        });
        await expect(hasActiveLock(env, "usr_3", "2026-04-15T00:00:00.000Z")).resolves.toBe(true);
        await expect(hasActiveLock(env, "usr_3", "2026-05-02T00:00:00.000Z")).resolves.toBe(false);
    });
});
