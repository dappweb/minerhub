import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../lib/auth", () => ({
    extractAndVerifyAuth: vi.fn(async () => ({ valid: true, wallet: "0xinvitee" })),
}));
vi.mock("../lib/referralChain", () => ({
    readOnChainReferrer: vi.fn(),
    verifyReferralBindingOnChain: vi.fn(async () => {
        throw new Error("Referral transaction not found");
    }),
}));
class InMemoryDb {
    users = new Map();
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
        if (sql.startsWith("select id, wallet from users where wallet = ?")) {
            const [wallet] = args;
            return (this.users.get(wallet) ?? null);
        }
        if (sql.includes("from referral_bind_jobs") && sql.includes("where invitee_wallet = ? and inviter_wallet = ?")) {
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
        }
    }
}
describe("referrals route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("returns a pending bind job when a submitted referral transaction is not readable yet", async () => {
        const { handleReferrals } = await import("./referrals");
        const DB = new InMemoryDb();
        DB.users.set("0xinvitee", { id: "usr_invitee", wallet: "0xinvitee" });
        const response = await handleReferrals(new Request("https://api.example.test/api/referrals/bind", {
            method: "POST",
            body: JSON.stringify({
                wallet: "0xinvitee",
                referralWallet: "0xinviter",
                referralTxHash: "0xabc",
            }),
        }), { DB }, ["bind"]);
        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toMatchObject({
            ok: true,
            pending: true,
            inviteeUserId: "usr_invitee",
            referralTxHash: "0xabc",
        });
        expect(DB.jobs.get("0xinvitee:0xinviter")?.status).toBe("pending");
    });
    it("rejects backend-only referral binding when no chain binding is available", async () => {
        const { handleReferrals } = await import("./referrals");
        const DB = new InMemoryDb();
        DB.users.set("0xinvitee", { id: "usr_invitee", wallet: "0xinvitee" });
        const response = await handleReferrals(new Request("https://api.example.test/api/referrals/bind", {
            method: "POST",
            body: JSON.stringify({
                wallet: "0xinvitee",
                referralWallet: "0xinviter",
            }),
        }), { DB }, ["bind"]);
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: "Referral transaction not found",
        });
        expect(DB.jobs.size).toBe(0);
    });
});
