import { createPublicClient, createWalletClient, defineChain, http, parseUnits } from 'viem';
import type { Address, Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const chainId = Number(process.env.EXPO_PUBLIC_CHAIN_ID ?? '11155111');
const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://sepolia.infura.io/v3/replace';

const chain = defineChain({
  id: chainId,
  name: 'MinerHub Chain',
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

function requirePrivateKey() {
  const privateKey = process.env.EXPO_PUBLIC_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('缺少 EXPO_PUBLIC_WALLET_PRIVATE_KEY，无法发起链上交易。');
  }

  const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  if (normalized.length !== 66) {
    throw new Error('EXPO_PUBLIC_WALLET_PRIVATE_KEY 格式不正确。');
  }

  return normalized as Hex;
}

function getWalletClients() {
  const account = privateKeyToAccount(requirePrivateKey());

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
    name: 'claimReward',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

const swapAbi = [
  {
    type: 'function',
    name: 'swapMmToUsdt',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amountIn', type: 'uint256' }],
    outputs: [],
  },
] as const;

export function getWalletAddress(): Address {
  const { account } = getWalletClients();
  return account.address;
}

export async function registerMinerOnChain(hashrate: number, deviceId: string) {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  const { account, walletClient, publicClient } = getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: miningPoolAddress,
    abi: minerAbi,
    functionName: 'registerMiner',
    args: [BigInt(hashrate), deviceId],
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}

export async function claimRewardOnChain() {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  const { account, walletClient, publicClient } = getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: miningPoolAddress,
    abi: minerAbi,
    functionName: 'claimReward',
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}

export async function swapMmToUsdtOnChain(amount: string) {
  if (!swapRouterAddress) {
    throw new Error('缺少 EXPO_PUBLIC_SWAP_ROUTER_ADDRESS。');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 MM 数量。');
  }

  const { account, walletClient, publicClient } = getWalletClients();

  const hash = await walletClient.writeContract({
    account,
    address: swapRouterAddress,
    abi: swapAbi,
    functionName: 'swapMmToUsdt',
    args: [parseUnits(amount, 18)],
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}
