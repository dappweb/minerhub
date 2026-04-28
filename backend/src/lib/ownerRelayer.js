import { Contract, JsonRpcProvider, Wallet, formatUnits, getAddress, parseUnits } from "ethers";
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
    env;
    provider;
    wallet;
    address;
    constructor(env) {
        this.env = env;
        if (!env.RPC_URL)
            throw new Error("RPC_URL not configured");
        this.provider = new JsonRpcProvider(env.RPC_URL);
        this.wallet = env.OWNER_PRIVATE_KEY ? new Wallet(env.OWNER_PRIVATE_KEY, this.provider) : null;
        this.address = this.wallet?.address ?? "";
    }
    requireWallet() {
        if (!this.wallet)
            throw new Error("OWNER_PRIVATE_KEY not configured");
        return this.wallet;
    }
    superContract() {
        return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.requireWallet());
    }
    superReader() {
        return new Contract(this.env.SUPER_TOKEN_ADDRESS, SUPER_ABI, this.provider);
    }
    usdtContract() {
        if (!this.env.USDT_TOKEN_ADDRESS)
            throw new Error("USDT_TOKEN_ADDRESS not configured");
        return new Contract(this.env.USDT_TOKEN_ADDRESS, ERC20_ABI, this.requireWallet());
    }
    async getNativeBalance(addr) {
        const balance = await this.provider.getBalance(getAddress(addr));
        return { raw: balance.toString(), formatted: formatUnits(balance, 18), decimals: 18 };
    }
    async getSuperBalance(addr) {
        const c = this.superReader();
        const [balRaw, decRaw] = await Promise.all([c.balanceOf(getAddress(addr)), c.decimals()]);
        const decimals = Number(decRaw);
        return { raw: balRaw.toString(), formatted: formatUnits(balRaw, decimals), decimals };
    }
    async getUsdtBalance(addr) {
        if (!this.env.USDT_TOKEN_ADDRESS)
            return null;
        const c = new Contract(this.env.USDT_TOKEN_ADDRESS, ERC20_ABI, this.provider);
        const [balRaw, decRaw] = await Promise.all([c.balanceOf(getAddress(addr)), c.decimals()]);
        const decimals = Number(decRaw);
        return { raw: balRaw.toString(), formatted: formatUnits(balRaw, decimals), decimals };
    }
    async getWalletBalances(addr) {
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
    async mintSuper(to, amountHuman) {
        const c = this.superContract();
        const decimals = Number(await this.superReader().decimals());
        const amount = parseUnits(amountHuman, decimals);
        const tx = await c.mint(getAddress(to), amount);
        const rc = await tx.wait();
        return { txHash: rc?.hash ?? tx.hash };
    }
    async transferSuper(to, amountHuman) {
        const c = this.superContract();
        const decimals = Number(await this.superReader().decimals());
        const amount = parseUnits(amountHuman, decimals);
        const tx = await c.transfer(getAddress(to), amount);
        const rc = await tx.wait();
        return { txHash: rc?.hash ?? tx.hash };
    }
    async burnOwnSuper(amountHuman) {
        const c = this.superContract();
        const decimals = Number(await this.superReader().decimals());
        const amount = parseUnits(amountHuman, decimals);
        const tx = await c.burn(amount);
        const rc = await tx.wait();
        return { txHash: rc?.hash ?? tx.hash };
    }
    async burnFromSuper(from, amountHuman) {
        // Requires `from` to have approved this relayer via ERC20 allowance
        const c = this.superContract();
        const decimals = Number(await this.superReader().decimals());
        const amount = parseUnits(amountHuman, decimals);
        const tx = await c.burnFrom(getAddress(from), amount);
        const rc = await tx.wait();
        return { txHash: rc?.hash ?? tx.hash };
    }
    async transferUsdt(to, amountHuman) {
        const c = this.usdtContract();
        const dec = Number(await new Contract(this.env.USDT_TOKEN_ADDRESS, ERC20_ABI, this.provider).decimals());
        const amount = parseUnits(amountHuman, dec);
        const tx = await c.transfer(getAddress(to), amount);
        const rc = await tx.wait();
        return { txHash: rc?.hash ?? tx.hash };
    }
    async totalSuperSupply() {
        const c = this.superReader();
        const [s, dec] = await Promise.all([c.totalSupply(), c.decimals()]);
        const d = Number(dec);
        return { raw: s.toString(), formatted: formatUnits(s, d), decimals: d };
    }
}
export function tryCreateRelayer(env) {
    try {
        return new OwnerRelayer(env);
    }
    catch {
        return null;
    }
}
