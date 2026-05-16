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

type UserRow = {
  id: string;
  wallet: string;
};

type ReferralBindJob = {
  id: string;
  invitee_wallet: string;
  inviter_wallet: string;
  tx_hash: string | null;
  status: string;
  last_error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
};

class InMemoryDb {
  users = new Map<string, UserRow>();
  jobs = new Map<string, ReferralBindJob>();

  prepare(sql: string): { bind: (...args: unknown[]) => { first: <T>() => Promise<T | null>; run: () => Promise<{ success: true }> } } {
    const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
    return {
      bind: (...args: unknown[]) => ({
        first: async <T>() => this.execFirst<T>(normalized, args),
        run: async () => {
          this.execRun(normalized, args);
          return { success: true as const };
        },
      }),
    };
  }

  private execFirst<T>(sql: string, args: unknown[]): T | null {
    if (sql.startsWith("select id, wallet from users where wallet = ?")) {
      const [wallet] = args as [string];
      return (this.users.get(wallet) ?? null) as T | null;
    }

    if (sql.includes("from referral_bind_jobs") && sql.includes("where invitee_wallet = ? and inviter_wallet = ?")) {
      const [inviteeWallet, inviterWallet] = args as [string, string];
      return (this.jobs.get(`${inviteeWallet}:${inviterWallet}`) ?? null) as T | null;
    }

    return null;
  }

  private execRun(sql: string, args: unknown[]): void {
    if (sql.startsWith("insert into referral_bind_jobs")) {
      const [id, inviteeWallet, inviterWallet, txHash, status, lastError, retryCount, createdAt, updatedAt] = args as [
        string,
        string,
        string,
        string | null,
        string,
        string | null,
        number,
        string,
        string,
      ];
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

    const response = await handleReferrals(
      new Request("https://api.example.test/api/referrals/bind", {
        method: "POST",
        body: JSON.stringify({
          wallet: "0xinvitee",
          referralWallet: "0xinviter",
          referralTxHash: "0xabc",
        }),
      }),
      { DB } as never,
      ["bind"],
    );

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

    const response = await handleReferrals(
      new Request("https://api.example.test/api/referrals/bind", {
        method: "POST",
        body: JSON.stringify({
          wallet: "0xinvitee",
          referralWallet: "0xinviter",
        }),
      }),
      { DB } as never,
      ["bind"],
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Referral transaction not found",
    });
    expect(DB.jobs.size).toBe(0);
  });
});
