import { Contract, JsonRpcProvider, Wallet, formatUnits, getAddress, parseUnits } from "ethers";
import type { Env } from "../types/env";

const SUPER_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function mint(address to, uint256 amount)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function burn(uint256 amount)",
  "function burnFrom(address from, uint256 amount)",
  "function totalSupply() view returns (uint256)",
  "function isMinter(address) view returns (bool)",
  "function owner() view returns (address)"
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

const MINING_POOL_ABI = [
  "function minSuperStakeForReward() view returns (uint256)",
  "function stakedSuper(address) view returns (uint256)",
  "function getMinerInfo(address _miner) view returns (uint256 hashrate,uint256 pending,uint256 totalClaimed,bool active,uint256 suspiciousScore,uint256 stakedAmount,bool rewardEligible)"
];

export class OwnerRelayer {
  private provider: JsonRpcProvider;
  private wallet: Wallet | null;
  private superDecimals: number | null = null;
  private usdtDecimals: number | null = null;
  readonly address: string;

  constructor(private env: Env) {
    if (!env.RPC_URL) throw new Error("RPC_URL not configured");
    this.provider = this.createProvider(env.RPC_URL);
    this.wallet = env.OWNER_PRIVATE_KEY ? new Wallet(env.OWNER_PRIVATE_KEY, this.provider) : null;
    this.address = this.wallet?.address ?? "";
  }

  private createProvider(url: string): JsonRpcProvider {
    return new JsonRpcProvider(url, undefined, { staticNetwork: true });
  }

  private getRpcUrls(): string[] {
    const urls = [
      this.env.RPC_URL,
      ...(this.env.BSC_RPC_UPSTREAMS ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ].filter(Boolean);
    return Array.from(new Set(urls));
  }

  private async withReadProvider<T>(read: (provider: JsonRpcProvider) => Promise<T>): Promise<T> {
    let lastError: unknown = null;
    for (const url of this.getRpcUrls()) {
      const provider = url === this.env.RPC_URL ? this.provider : this.createProvider(url);
      try {
        return await read(provider);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All BSC RPC upstreams failed");
  }

  private requireWallet(): Wallet {
    if (!this.wallet) throw new Error("OWNER_PRIVATE_KEY not configured");
    return this.wallet;
  }

  private superContract() {
    return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.requireWallet());
  }

  private superReader() {
    return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.provider);
  }

  private usdtContract() {
    if (!this.env.USDT_TOKEN_ADDRESS) throw new Error("USDT_TOKEN_ADDRESS not configured");
    return new Contract(this.env.USDT_TOKEN_ADDRESS, ERC20_ABI, this.requireWallet());
  }

  async getNativeBalance(addr: string): Promise<{ raw: string; formatted: string; decimals: number }> {
    const address = getAddress(addr);
    const balance = await this.withReadProvider((provider) => provider.getBalance(address));
    return { raw: balance.toString(), formatted: formatUnits(balance, 18), decimals: 18 };
  }

  async getSuperBalance(addr: string): Promise<{ raw: string; formatted: string; decimals: number }> {
    const address = getAddress(addr);
    const [balRaw, decimals] = await Promise.all([
      this.withReadProvider((provider) => new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, provider).balanceOf(address)),
      this.getSuperDecimals(),
    ]);
    return { raw: balRaw.toString(), formatted: formatUnits(balRaw, decimals), decimals };
  }

  async getUsdtBalance(addr: string): Promise<{ raw: string; formatted: string; decimals: number } | null> {
    if (!this.env.USDT_TOKEN_ADDRESS) return null;
    const address = getAddress(addr);
    const [balRaw, decimals] = await Promise.all([
      this.withReadProvider((provider) => new Contract(this.env.USDT_TOKEN_ADDRESS!, ERC20_ABI, provider).balanceOf(address)),
      this.getUsdtDecimals(),
    ]);
    return { raw: balRaw.toString(), formatted: formatUnits(balRaw, decimals), decimals };
  }

  private async getSuperDecimals(): Promise<number> {
    if (this.superDecimals !== null) return this.superDecimals;
    const decRaw = await this.withReadProvider((provider) => new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, provider).decimals());
    this.superDecimals = Number(decRaw);
    return this.superDecimals;
  }

  private async getUsdtDecimals(): Promise<number> {
    if (this.usdtDecimals !== null) return this.usdtDecimals;
    if (!this.env.USDT_TOKEN_ADDRESS) return 18;
    const decRaw = await this.withReadProvider((provider) => new Contract(this.env.USDT_TOKEN_ADDRESS!, ERC20_ABI, provider).decimals());
    this.usdtDecimals = Number(decRaw);
    return this.usdtDecimals;
  }

  async getWalletBalances(addr: string): Promise<{ bnb: string | null; usdt: string | null; super: string | null }> {
    const [bnb, usdt, superBalance] = await Promise.all([
      this.getNativeBalance(addr).catch(() => null),
      this.getUsdtBalance(addr).catch(() => null),
      this.getSuperBalance(addr).catch(() => null),
    ]);

    return {
      bnb: bnb?.formatted ?? null,
      usdt: usdt?.formatted ?? null,
      super: superBalance?.formatted ?? null,
    };
  }

  async mintSuper(to: string, amountHuman: string): Promise<{ txHash: string }> {
    const c = this.superContract();
    const decimals: number = Number(await this.superReader().decimals());
    const amount = parseUnits(amountHuman, decimals);
    const tx = await c.mint(getAddress(to), amount);
    const rc = await tx.wait();
    return { txHash: rc?.hash ?? tx.hash };
  }

  async transferSuper(to: string, amountHuman: string): Promise<{ txHash: string }> {
    const c = this.superContract();
    const decimals: number = Number(await this.superReader().decimals());
    const amount = parseUnits(amountHuman, decimals);
    const tx = await c.transfer(getAddress(to), amount);
    const rc = await tx.wait();
    return { txHash: rc?.hash ?? tx.hash };
  }

  async burnOwnSuper(amountHuman: string): Promise<{ txHash: string }> {
    const c = this.superContract();
    const decimals: number = Number(await this.superReader().decimals());
    const amount = parseUnits(amountHuman, decimals);
    const tx = await c.burn(amount);
    const rc = await tx.wait();
    return { txHash: rc?.hash ?? tx.hash };
  }

  async burnFromSuper(from: string, amountHuman: string): Promise<{ txHash: string }> {
    // Requires `from` to have approved this relayer via ERC20 allowance
    const c = this.superContract();
    const decimals: number = Number(await this.superReader().decimals());
    const amount = parseUnits(amountHuman, decimals);
    const tx = await c.burnFrom(getAddress(from), amount);
    const rc = await tx.wait();
    return { txHash: rc?.hash ?? tx.hash };
  }

  async transferUsdt(to: string, amountHuman: string): Promise<{ txHash: string }> {
    const c = this.usdtContract();
    const dec = Number(await new Contract(this.env.USDT_TOKEN_ADDRESS!, ERC20_ABI, this.provider).decimals());
    const amount = parseUnits(amountHuman, dec);
    const tx = await c.transfer(getAddress(to), amount);
    const rc = await tx.wait();
    return { txHash: rc?.hash ?? tx.hash };
  }

  async totalSuperSupply(): Promise<{ raw: string; formatted: string; decimals: number }> {
    const c = this.superReader();
    const [s, dec] = await Promise.all([c.totalSupply(), c.decimals()]);
    const d = Number(dec);
    return { raw: s.toString(), formatted: formatUnits(s, d), decimals: d };
  }

  async getMiningStakeRequirement(addr: string): Promise<{
    minRaw: string;
    minFormatted: string;
    stakedRaw: string;
    stakedFormatted: string;
    eligible: boolean;
    decimals: number;
  }> {
    const address = getAddress(addr);
    const decimals = await this.getSuperDecimals();
    const [minRaw, minerInfo] = await Promise.all([
      this.withReadProvider((provider) => new Contract(this.env.MINING_POOL_ADDRESS, MINING_POOL_ABI, provider).minSuperStakeForReward()),
      this.withReadProvider((provider) => new Contract(this.env.MINING_POOL_ADDRESS, MINING_POOL_ABI, provider).getMinerInfo(address)),
    ]);
    const stakedRaw = minerInfo?.stakedAmount ?? minerInfo?.[5] ?? 0n;
    const eligible = Boolean(minerInfo?.rewardEligible ?? minerInfo?.[6] ?? false);
    return {
      minRaw: minRaw.toString(),
      minFormatted: formatUnits(minRaw, decimals),
      stakedRaw: stakedRaw.toString(),
      stakedFormatted: formatUnits(stakedRaw, decimals),
      eligible,
      decimals,
    };
  }

  async getMiningStakeGate(addr: string): Promise<{
    minRaw: string;
    minFormatted: string;
    stakedRaw: string;
    stakedFormatted: string;
    decimals: number;
  }> {
    const address = getAddress(addr);
    const decimals = await this.getSuperDecimals();
    const [minRaw, stakedRaw] = await Promise.all([
      this.withReadProvider((provider) => new Contract(this.env.MINING_POOL_ADDRESS, MINING_POOL_ABI, provider).minSuperStakeForReward()),
      this.withReadProvider((provider) => new Contract(this.env.MINING_POOL_ADDRESS, MINING_POOL_ABI, provider).stakedSuper(address)),
    ]);
    return {
      minRaw: minRaw.toString(),
      minFormatted: formatUnits(minRaw, decimals),
      stakedRaw: stakedRaw.toString(),
      stakedFormatted: formatUnits(stakedRaw, decimals),
      decimals,
    };
  }
}

export function tryCreateRelayer(env: Env): OwnerRelayer | null {
  try {
    return new OwnerRelayer(env);
  } catch {
    return null;
  }
}
