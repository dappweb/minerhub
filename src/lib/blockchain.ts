import { createPublicClient, createWalletClient, custom, defineChain, http, parseUnits } from 'viem';
import type { Address, Hex } from 'viem';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
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

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 8453);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://mainnet.base.org';

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

const minerContractAddress =
  (import.meta.env.VITE_MINING_POOL_ADDRESS as Address | undefined) ??
  (import.meta.env.VITE_MINER_CONTRACT_ADDRESS as Address | undefined);
const swapContractAddress =
  (import.meta.env.VITE_SWAP_ROUTER_ADDRESS as Address | undefined) ??
  (import.meta.env.VITE_SWAP_CONTRACT_ADDRESS as Address | undefined);

function getWalletClient() {
  if (!window.ethereum) {
    throw new Error('未检测到钱包，请先安装 MetaMask 或兼容钱包。');
  }
  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  });
}

function getPublicClient() {
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

async function ensureConnectedAddress(): Promise<Address> {
  const walletClient = getWalletClient();

  const accounts = (await walletClient.requestAddresses()) as Address[];
  const account = accounts[0];

  if (!account) {
    throw new Error('钱包未授权，请先连接钱包。');
  }

  return account;
}

export async function connectWallet() {
  const walletClient = getWalletClient();
  const accounts = (await walletClient.requestAddresses()) as Address[];
  const account = accounts[0];

  if (!account) {
    throw new Error('无法连接钱包账户。');
  }

  return account;
}

export async function startMiningOnChain() {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    account,
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'registerMiner',
    args: [1000n, `web-${Date.now()}`],
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}

export async function claimRewardsOnChain() {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    account,
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'claimReward',
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}

export async function swapMmToUsdtOnChain(mmAmount: string) {
  if (!swapContractAddress) {
    throw new Error('缺少 VITE_SWAP_ROUTER_ADDRESS（或 VITE_SWAP_CONTRACT_ADDRESS）配置。');
  }

  const parsedAmount = Number(mmAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('请输入有效的 MM 数量。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    account,
    address: swapContractAddress,
    abi: swapAbi,
    functionName: 'swapMmToUsdt',
    args: [parseUnits(mmAmount, 18)],
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}
