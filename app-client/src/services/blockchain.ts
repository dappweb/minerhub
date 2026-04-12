import type { Address, Hex } from 'viem';
import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from 'viem';
import { getWalletAddress as getLocalWalletAddress, getWalletAccount } from './wallet';

const chainId = Number(process.env.EXPO_PUBLIC_CHAIN_ID ?? '11155111');
const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://sepolia.infura.io/v3/replace';

const chain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

const miningPoolAddress = process.env.EXPO_PUBLIC_MINING_POOL_ADDRESS as Address | undefined;
const swapRouterAddress = process.env.EXPO_PUBLIC_SWAP_ROUTER_ADDRESS as Address | undefined;

async function getWalletClients() {
  const account = await getWalletAccount();

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  return { account, walletClient, publicClient };
}

const minerAbi = [
  {
    type: 'function',
    name: 'registerMiner',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_hashrate', type: 'uint256' },
      { name: '_deviceId', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'updateHashrate',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_newHashrate', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimReward',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

const swapAbi = [
  {
    type: 'function',
    name: 'getPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'swapSuperToUsdt',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amountIn', type: 'uint256' }],
    outputs: [],
  },
] as const;

export async function getWalletAddress(): Promise<Address> {
  return getLocalWalletAddress();
}

export async function registerMinerOnChain(hashrate: number, deviceId: string) {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  const { account, walletClient, publicClient } = await getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: miningPoolAddress,
    abi: minerAbi,
    functionName: 'registerMiner',
    args: [BigInt(hashrate), deviceId],
  });

  // 等待交易确认（最多 120 秒，Sepolia 测试网可能较慢）
  await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  return hash;
}

export async function updateHashrateOnChain(hashrate: number) {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  const { account, walletClient, publicClient } = await getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: miningPoolAddress,
    abi: minerAbi,
    functionName: 'updateHashrate',
    args: [BigInt(hashrate)],
  });

  // 等待交易确认（最多 120 秒，Sepolia 测试网可能较慢）
  await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  return hash;
}

export async function claimRewardOnChain() {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  const { account, walletClient, publicClient } = await getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: miningPoolAddress,
    abi: minerAbi,
    functionName: 'claimReward',
  });

  // 等待交易确认（最多 120 秒，Sepolia 测试网可能较慢）
  await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  return hash;
}

export async function swapSuperToUsdtOnChain(amount: string) {
  if (!swapRouterAddress) {
    throw new Error('缺少 EXPO_PUBLIC_SWAP_ROUTER_ADDRESS。');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 数量。');
  }

  const { account, walletClient, publicClient } = await getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: swapRouterAddress,
    abi: swapAbi,
    functionName: 'swapSuperToUsdt',
    args: [parseUnits(amount, 18)],
  });

  // 等待交易确认（最多 120 秒，Sepolia 测试网可能较慢）
  await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  return hash;
}

export async function getSwapPriceOnChain() {
  if (!swapRouterAddress) {
    throw new Error('缺少 EXPO_PUBLIC_SWAP_ROUTER_ADDRESS。');
  }

  const { publicClient } = await getWalletClients();
  return publicClient.readContract({
    address: swapRouterAddress,
    abi: swapAbi,
    functionName: 'getPrice',
  });
}

export async function sendNativeTokenOnChain(to: Address, amountEth: string) {
  const normalizedAmount = Number(amountEth);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效转账金额。');
  }

  const { account, walletClient, publicClient } = await getWalletClients();
  const hash = await walletClient.sendTransaction({
    account,
    to,
    value: parseUnits(amountEth, 18),
  });

  // 等待交易确认（最多 120 秒，Sepolia 测试网可能较慢）
  await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
  return hash;
}

