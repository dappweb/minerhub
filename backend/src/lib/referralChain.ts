import { Contract, Interface, JsonRpcProvider, ZeroAddress, getAddress } from "ethers";
import type { Env } from "../types/env";

const MINING_POOL_REFERRAL_ABI = [
  "function referrerOf(address invitee) view returns (address)",
  "function bindReferral(address _inviter)",
];
const REFERRAL_INTERFACE = new Interface(MINING_POOL_REFERRAL_ABI);

function createProvider(url: string): JsonRpcProvider {
  return new JsonRpcProvider(url, undefined, { staticNetwork: true });
}

function getRpcUrls(env: Env): string[] {
  const urls = [
    env.RPC_URL,
    ...(env.BSC_RPC_UPSTREAMS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ].filter(Boolean);
  return Array.from(new Set(urls));
}

async function withReadProvider<T>(env: Env, read: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const url of getRpcUrls(env)) {
    try {
      return await read(createProvider(url));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("All BSC RPC upstreams failed");
}

export function normalizeAddress(raw: string, label: string): string {
  try {
    return getAddress(raw.trim()).toLowerCase();
  } catch {
    throw new Error(`Invalid ${label} address`);
  }
}

export async function readOnChainReferrer(env: Env, inviteeWallet: string): Promise<string | null> {
  if (!env.MINING_POOL_ADDRESS) {
    throw new Error("MINING_POOL_ADDRESS not configured");
  }

  const invitee = normalizeAddress(inviteeWallet, "invitee wallet");
  const pool = getAddress(env.MINING_POOL_ADDRESS);
  const referrer = await withReadProvider(env, async (provider) => {
    const contract = new Contract(pool, MINING_POOL_REFERRAL_ABI, provider);
    return (await contract.referrerOf(invitee)) as string;
  });

  if (!referrer || referrer.toLowerCase() === ZeroAddress.toLowerCase()) {
    return null;
  }

  return getAddress(referrer).toLowerCase();
}

async function verifyReferralTransactionOnChain(
  env: Env,
  params: { txHash: string; invitee: string; inviter: string },
): Promise<void> {
  if (!env.MINING_POOL_ADDRESS) {
    throw new Error("MINING_POOL_ADDRESS not configured");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(params.txHash)) {
    throw new Error("Invalid referral transaction hash");
  }

  const pool = getAddress(env.MINING_POOL_ADDRESS).toLowerCase();
  await withReadProvider(env, async (provider) => {
    const receipt = await provider.getTransactionReceipt(params.txHash);
    if (!receipt) {
      throw new Error("Referral transaction not found");
    }
    if (receipt.status !== 1) {
      throw new Error("Referral transaction failed");
    }
    if (receipt.to && receipt.to.toLowerCase() !== pool) {
      throw new Error("Referral transaction target mismatch");
    }

    const tx = await provider.getTransaction(params.txHash);
    if (!tx) {
      throw new Error("Referral transaction not found");
    }
    if (tx.from.toLowerCase() !== params.invitee.toLowerCase()) {
      throw new Error("Referral transaction sender mismatch");
    }
    if (!tx.to || tx.to.toLowerCase() !== pool) {
      throw new Error("Referral transaction target mismatch");
    }

    let parsed: ReturnType<Interface["parseTransaction"]>;
    try {
      parsed = REFERRAL_INTERFACE.parseTransaction({ data: tx.data, value: tx.value });
    } catch {
      throw new Error("Referral transaction input mismatch");
    }
    if (!parsed || parsed.name !== "bindReferral") {
      throw new Error("Referral transaction input mismatch");
    }

    const txInviter = getAddress(String(parsed.args[0])).toLowerCase();
    if (txInviter !== params.inviter.toLowerCase()) {
      throw new Error("Referral transaction inviter mismatch");
    }
  });
}

export async function verifyReferralBindingOnChain(
  env: Env,
  params: {
    inviteeWallet: string;
    inviterWallet?: string;
    txHash?: string | null;
  },
): Promise<{ invitee: string; inviter: string; txHash: string | null }> {
  const invitee = normalizeAddress(params.inviteeWallet, "invitee wallet");
  const expectedInviter = params.inviterWallet
    ? normalizeAddress(params.inviterWallet, "referral wallet")
    : null;
  const txHash = params.txHash?.trim() || null;

  if (txHash && expectedInviter) {
    await verifyReferralTransactionOnChain(env, { txHash, invitee, inviter: expectedInviter });
  } else if (txHash && !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Invalid referral transaction hash");
  }

  let inviter: string | null;
  try {
    inviter = await readOnChainReferrer(env, invitee);
  } catch (error) {
    if (txHash && expectedInviter) {
      return { invitee, inviter: expectedInviter, txHash };
    }
    throw error;
  }

  if (!inviter) {
    if (txHash && expectedInviter) {
      return { invitee, inviter: expectedInviter, txHash };
    }
    throw new Error("Referral is not bound on-chain");
  }

  if (expectedInviter && inviter !== expectedInviter) {
    throw new Error("On-chain referral wallet does not match request");
  }

  return { invitee, inviter, txHash };
}
