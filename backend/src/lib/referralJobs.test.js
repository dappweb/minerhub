import { describe, expect, it } from "vitest";
import { createReferralBindJob, markReferralBindJobBound } from "./referralJobs";
class InMemoryDb {
    jobs = new Map();
    prepare(sql) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
            bind: (...args) => ({
                first: async () => this.execFirst(normalized, args),
                run: async () => {
                    this.execRun(normalized, args);
                    return { success: true };
                },
            }),
        };
    }
    execFirst(sql, args) {
        if (sql.includes("select id, invitee_wallet, inviter_wallet, tx_hash, status, last_error, retry_count")) {
            const [inviteeWallet, inviterWallet] = args;
            return (this.jobs.get(`${inviteeWallet}:${inviterWallet}`) ?? null);
        }
        return null;
    }
    execRun(sql, args) {
        if (sql.startsWith("insert into referral_bind_jobs")) {
            const [id, inviteeWallet, inviterWallet, txHash, status, lastError, retryCount, createdAt, updatedAt] = args;
            this.jobs.set(`${inviteeWallet}:${inviterWallet}`, {
                id,
                invitee_wallet: inviteeWallet,
                inviter_wallet: inviterWallet,
                tx_hash: txHash,
                status,
                last_error: lastError,
                retry_count: retryCount,
                created_at: createdAt,
                updated_at: updatedAt,
            });
            return;
        }
        if (sql.startsWith("update referral_bind_jobs set status = 'bound'")) {
            const [updatedAt, inviteeWallet, inviterWallet] = args;
            const row = this.jobs.get(`${inviteeWallet}:${inviterWallet}`);
            if (!row)
                return;
            row.status = "bound";
            row.last_error = null;
            row.updated_at = updatedAt;
        }
    }
}
describe("referral bind jobs", () => {
    it("creates a pending job and marks it bound idempotently", async () => {
        const DB = new InMemoryDb();
        const env = { DB };
        const now = "2026-05-16T01:00:00.000Z";
        const job = await createReferralBindJob(env, {
            inviteeWallet: "0xInvitee",
            inviterWallet: "0xInviter",
            txHash: "0xabc",
            error: "Referral transaction not found",
            now,
        });
        expect(job.status).toBe("pending");
        expect(job.retry_count).toBe(0);
        expect(job.last_error).toBe("Referral transaction not found");
        await markReferralBindJobBound(env, "0xinvitee", "0xinviter", now);
        const updated = DB.jobs.get("0xinvitee:0xinviter");
        expect(updated?.status).toBe("bound");
        expect(updated?.last_error).toBeNull();
    });
});
