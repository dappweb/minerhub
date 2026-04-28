import { describe, expect, it } from "vitest";
import { isSubAdminWallet } from "./ownerAuth";

function createEnv(dbWallets: string[] = [], envWallets = ""): any {
  return {
    SUB_ADMIN_ADDRESSES: envWallets,
    ADMIN_ADDRESSES: "",
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
        return {
          all: async () => {
            if (normalized.includes("from owner_sub_admins")) {
              return { results: dbWallets.map((wallet) => ({ wallet })) };
            }
            return { results: [] };
          },
          bind: () => ({
            first: async () => ({ ok: 1 }),
          }),
        };
      },
    },
  };
}

describe("isSubAdminWallet", () => {
  it("accepts configured SubAdmin wallets", async () => {
    await expect(isSubAdminWallet(createEnv([], "0xabc"), "0xAbC")).resolves.toBe(true);
  });

  it("accepts DB-backed SubAdmin wallets", async () => {
    await expect(isSubAdminWallet(createEnv(["0xdef"]), "0xDef")).resolves.toBe(true);
  });

  it("does not grant SubAdmin access just because the wallet has referrals", async () => {
    await expect(isSubAdminWallet(createEnv(), "0x123")).resolves.toBe(false);
  });
});
