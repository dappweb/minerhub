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

export class OwnerRelayer {
  private provider: JsonRpcProvider;
  private wallet: Wallet;
  readonly address: string;

  constructor(private env: Env) {
    if (!env.OWNER_PRIVATE_KEY) throw new Error("OWNER_PRIVATE_KEY not configured");
    if (!env.RPC_URL) throw new Error("RPC_URL not configured");
    this.provider = new JsonRpcProvider(env.RPC_URL);
    this.wallet = new Wallet(env.OWNER_PRIVATE_KEY, this.provider);
    this.address = this.wallet.address;
  }

  private superContract() {
    return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.wallet);
  }

  private superReader() {
    return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.provider);
  }

  private usdtContract() {
    if (!this.env.USDT_TOKEN_ADDRESS) throw new Error("USDT_TOKEN_ADDRESS not configured");
    return new Contract(this.env.USDT_TOKEN_ADDRESS, ERC20_ABI, this.wallet);
  }

  async getSuperBalance(addr: string): Promise<{ raw: string; formatted: string; decimals: number }> {
    const c = this.superReader();
    const [balRaw, decRaw] = await Promise.all([c.balanceOf(getAddress(addr)), c.decimals()]);
    const decimals = Number(decRaw);
    return { raw: balRaw.toString(), formatted: formatUnits(balRaw, decimals), decimals };
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
}

export function tryCreateRelayer(env: Env): OwnerRelayer | null {
  try {
    return new OwnerRelayer(env);
  } catch {
    return null;
  }
}
