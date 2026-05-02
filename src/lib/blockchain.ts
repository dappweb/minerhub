import type { Address, Hex } from 'viem';
import { createPublicClient, createWalletClient, custom, defineChain, fallback, http, parseEther, parseUnits } from 'viem';

export type MiningPoolGlobalStats = {
  totalEmitted: bigint;
  totalActiveHashrate: bigint;
  totalMiners: bigint;
  totalEligibleHashrate: bigint;
  totalStakedSuper: bigint;
  minSuperStakeForReward: bigint;
  availableRewardBalance: bigint;
  stakeGateSupported: boolean;
};

export type MiningPoolMinerInfo = {
  hashrate: bigint;
  pendingReward: bigint;
  totalClaimed: bigint;
  active: boolean;
  suspiciousScore: bigint;
  registered: boolean;
  stakedSuper: bigint;
  rewardEligible: boolean;
};

export type RegisterMinerOptions = {
  hashrate?: bigint;
  deviceId?: string;
};

export type SuperTokenStats = {
  totalSupply: bigint;
  totalMinted: bigint;
  remainingSupply: bigint;
  routerBalance: bigint;
};

export type SwapPoolStats = {
  reserveSuper: bigint;
  reserveUsdt: bigint;
  priceSuperPerUsdt: bigint;
  totalLPShares: bigint;
  accumulatedPlatformFee: bigint;
  accumulatedEcosystemFee: bigint;
  lpFeeShare: bigint;
  platformFeeShare: bigint;
  ecosystemFeeShare: bigint;
};

export type AdminSyncResult = {
  target: Address;
  hashes: Hex[];
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

const minerAbi = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'isAdmin',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getAdmins',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'function',
    name: 'addAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
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
  {
    type: 'function',
    name: 'stakeSuper',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unstakeSuper',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMinSuperStakeForReward',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'minSuperStakeForReward',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalEligibleHashrate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalStakedSuper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'availableRewardBalance',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'isRewardEligible',
    stateMutability: 'view',
    inputs: [{ name: '_miner', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getGlobalStats',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalEm', type: 'uint256' },
      { name: 'totalActive', type: 'uint256' },
      { name: 'minerCount', type: 'uint256' },
      { name: 'totalEligible', type: 'uint256' },
      { name: 'totalStaked', type: 'uint256' },
      { name: 'minStakeForReward', type: 'uint256' },
      { name: 'rewardBalance', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'getMinerInfo',
    stateMutability: 'view',
    inputs: [{ name: '_miner', type: 'address' }],
    outputs: [
      { name: 'hashrate', type: 'uint256' },
      { name: 'pending', type: 'uint256' },
      { name: 'totalClaimed', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'suspiciousScore', type: 'uint256' },
      { name: 'stakedAmount', type: 'uint256' },
      { name: 'rewardEligible', type: 'bool' },
    ],
  },
  {
    type: 'function',
    name: 'registeredMiners',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const swapAbi = [
  {
    type: 'function',
    name: 'superToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'usdtToken',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'reserveSuper',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'reserveUSDT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getPrice',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalLPShares',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'accumulatedPlatformFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'accumulatedEcosystemFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lpFeeShare',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'platformFeeShare',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'ecosystemFeeShare',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'initializeLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_superAmount', type: 'uint256' },
      { name: '_usdtAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'addLiquidity',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_superAmount', type: 'uint256' },
      { name: '_usdtAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'swapSuperToUsdt',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amountIn', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'collectPlatformFee',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'collectEcosystemFee',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_recipient', type: 'address' }],
    outputs: [],
  },
] as const;

const superAbi = [
  {
    type: 'function',
    name: 'isAdmin',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'addAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalMinted',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'remainingSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const legacyGlobalStatsAbi = [
  {
    type: 'function',
    name: 'getGlobalStats',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'totalEm', type: 'uint256' },
      { name: 'totalActive', type: 'uint256' },
      { name: 'minerCount', type: 'uint256' },
    ],
  },
] as const;

const adminAbi = [
  {
    type: 'function',
    name: 'isAdmin',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'addAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'removeAdmin',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
] as const;

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? 56);
const rpcUrl = import.meta.env.VITE_RPC_URL ?? 'https://bsc-dataseed.binance.org/';
const proxyRpcUrl = (import.meta.env.VITE_RPC_PROXY_URL as string | undefined) ?? 'https://api.coinplanets.net/api/rpc/bsc';
const rpcHttpUrls = Array.from(
  new Set(
    [
      proxyRpcUrl,
      rpcUrl,
      'https://bsc-dataseed1.defibit.io/',
      'https://bsc-dataseed1.ninicoin.io/',
      'https://bsc.publicnode.com',
    ].filter((u): u is string => Boolean(u && u.trim()))
  )
);

const chain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: rpcHttpUrls },
    public: { http: rpcHttpUrls },
  },
});

const minerContractAddress =
  (import.meta.env.VITE_MINING_POOL_ADDRESS as Address | undefined) ??
  (import.meta.env.VITE_MINER_CONTRACT_ADDRESS as Address | undefined);
const swapContractAddress =
  (import.meta.env.VITE_SWAP_ROUTER_ADDRESS as Address | undefined) ??
  (import.meta.env.VITE_SWAP_CONTRACT_ADDRESS as Address | undefined);
const superTokenAddress =
  (import.meta.env.VITE_SUPER_ADDRESS as Address | undefined);
const usdtTokenAddress =
  (import.meta.env.VITE_USDT_ADDRESS as Address | undefined);

function getWalletClient() {
  if (!window.ethereum) {
    throw new Error('未检测到钱包，请先安装 MetaMask 或兼容钱包。');
  }
  return createWalletClient({
    chain,
    transport: custom(window.ethereum),
  }) as any;
}

function getPublicClient() {
  return createPublicClient({
    chain,
    transport: fallback(
      rpcHttpUrls.map((url) =>
        http(url, {
          timeout: 10_000,
          retryCount: 1,
        })
      )
    ),
  }) as any;
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

export function getMiningPoolAddress(): Address | undefined {
  return minerContractAddress;
}

export function getSwapRouterAddress(): Address | undefined {
  return swapContractAddress;
}

export function getSuperTokenAddress(): Address | undefined {
  return superTokenAddress;
}

async function waitForTx(hash: Hex) {
  const publicClient = getPublicClient();
  await publicClient.waitForTransactionReceipt({ hash });
}

function requireSwapRouterAddress(): Address {
  if (!swapContractAddress) {
    throw new Error('缺少 VITE_SWAP_ROUTER_ADDRESS（或 VITE_SWAP_CONTRACT_ADDRESS）配置。');
  }
  return swapContractAddress;
}

function requireMiningPoolAddress(): Address {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }
  return minerContractAddress;
}

function requireSuperAddress(): Address {
  if (!superTokenAddress) {
    throw new Error('缺少 VITE_SUPER_ADDRESS 配置。');
  }
  return superTokenAddress;
}

async function requireUsdtAddress(): Promise<Address> {
  if (usdtTokenAddress) {
    return usdtTokenAddress;
  }
  const router = requireSwapRouterAddress();
  const publicClient = getPublicClient();
  return publicClient.readContract({
    address: router,
    abi: swapAbi,
    functionName: 'usdtToken',
  }) as Promise<Address>;
}

export async function getMiningPoolOwnerOnChain(): Promise<Address> {
  const miningPool = requireMiningPoolAddress();

  const publicClient = getPublicClient();
  const owner = await publicClient.readContract({
    address: miningPool,
    abi: minerAbi,
    functionName: 'owner',
  });

  return owner;
}

export async function getMiningPoolAdminsOnChain(): Promise<Address[]> {
  const miningPool = requireMiningPoolAddress();
  const publicClient = getPublicClient();
  const admins = await publicClient.readContract({
    address: miningPool,
    abi: minerAbi,
    functionName: 'getAdmins',
  });

  return admins;
}

export async function isWalletAdminOnChain(account: Address): Promise<boolean> {
  const miningPool = requireMiningPoolAddress();
  const publicClient = getPublicClient();

  return publicClient.readContract({
    address: miningPool,
    abi: minerAbi,
    functionName: 'isAdmin',
    args: [account],
  });
}

async function syncAdminAcrossContracts(target: Address, mode: 'add' | 'remove'): Promise<AdminSyncResult> {
  const account = await ensureConnectedAddress();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const targets = [requireMiningPoolAddress(), requireSuperAddress(), requireSwapRouterAddress()];
  const hashes: Hex[] = [];

  for (const contractAddress of targets) {
    const alreadyAdmin = await publicClient.readContract({
      address: contractAddress,
      abi: adminAbi,
      functionName: 'isAdmin',
      args: [target],
    });

    if ((mode === 'add' && alreadyAdmin) || (mode === 'remove' && !alreadyAdmin)) {
      continue;
    }

    const hash = await walletClient.writeContract({
      account,
      address: contractAddress,
      abi: adminAbi,
      functionName: mode === 'add' ? 'addAdmin' : 'removeAdmin',
      args: [target],
    });

    await waitForTx(hash as Hex);
    hashes.push(hash as Hex);
  }

  return { target, hashes };
}

export async function addAdminOnChain(target: Address): Promise<AdminSyncResult> {
  return syncAdminAcrossContracts(target, 'add');
}

export async function removeAdminOnChain(target: Address): Promise<AdminSyncResult> {
  return syncAdminAcrossContracts(target, 'remove');
}

export async function getGlobalStatsOnChain(): Promise<MiningPoolGlobalStats> {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }

  const publicClient = getPublicClient();
  let stakeGateSupported = true;
  const result = await publicClient.readContract({
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'getGlobalStats',
  }).catch(async () => {
    stakeGateSupported = false;
    const legacy = await publicClient.readContract({
      address: minerContractAddress,
      abi: legacyGlobalStatsAbi,
      functionName: 'getGlobalStats',
    });
    const [totalEmitted, totalActiveHashrate, totalMiners] = legacy;
    return [
      totalEmitted,
      totalActiveHashrate,
      totalMiners,
      0n,
      0n,
      0n,
      0n,
    ] as const;
  });

  const [
    totalEmitted,
    totalActiveHashrate,
    totalMiners,
    totalEligibleHashrate = 0n,
    totalStakedSuper = 0n,
    minSuperStakeForReward = 0n,
    availableRewardBalance = 0n,
  ] = result;

  return {
    totalEmitted,
    totalActiveHashrate,
    totalMiners,
    totalEligibleHashrate,
    totalStakedSuper,
    minSuperStakeForReward,
    availableRewardBalance,
    stakeGateSupported,
  };
}

export async function getMinerInfoOnChain(minerAddress: Address): Promise<MiningPoolMinerInfo> {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }

  const publicClient = getPublicClient();
  const registered = await publicClient.readContract({
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'registeredMiners',
    args: [minerAddress],
  });

  if (!registered) {
    return {
      hashrate: 0n,
      pendingReward: 0n,
      totalClaimed: 0n,
      active: false,
      suspiciousScore: 0n,
      registered: false,
      stakedSuper: 0n,
      rewardEligible: false,
    };
  }

  const result = await publicClient.readContract({
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'getMinerInfo',
    args: [minerAddress],
  });
  const [
    hashrate,
    pendingReward,
    totalClaimed,
    active,
    suspiciousScore,
    stakedSuper = 0n,
    rewardEligible = false,
  ] = result;

  return {
    hashrate,
    pendingReward,
    totalClaimed,
    active,
    suspiciousScore,
    registered: true,
    stakedSuper,
    rewardEligible,
  };
}

export async function setMinSuperStakeForRewardOnChain(superAmount: string) {
  const miningPool = requireMiningPoolAddress();
  const parsedAmount = Number(superAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
    throw new Error('请输入有效的 SUPER 最低抵押额。');
  }

  const publicClient = getPublicClient();
  await publicClient.readContract({
    address: miningPool,
    abi: minerAbi,
    functionName: 'minSuperStakeForReward',
  }).catch(() => {
    throw new Error('当前链上矿池合约尚未升级，不支持 SUPER 抵押收益门槛。请先升级 MiningPool 实现后再保存。');
  });

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: miningPool,
    abi: minerAbi,
    functionName: 'setMinSuperStakeForReward',
    args: [parseUnits(superAmount || '0', 18)],
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function stakeSuperOnChain(superAmount: string): Promise<Hex[]> {
  const miningPool = requireMiningPoolAddress();
  const superToken = requireSuperAddress();
  const parsedAmount = Number(superAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 抵押数量。');
  }

  const amount = parseUnits(superAmount, 18);
  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const hashes: Hex[] = [];

  const approveHash = await walletClient.writeContract({
    account,
    address: superToken,
    abi: superAbi,
    functionName: 'approve',
    args: [miningPool, amount],
  });
  await waitForTx(approveHash as Hex);
  hashes.push(approveHash as Hex);

  const stakeHash = await walletClient.writeContract({
    account,
    address: miningPool,
    abi: minerAbi,
    functionName: 'stakeSuper',
    args: [amount],
  });
  await waitForTx(stakeHash as Hex);
  hashes.push(stakeHash as Hex);

  return hashes;
}

export async function unstakeSuperOnChain(superAmount: string) {
  const miningPool = requireMiningPoolAddress();
  const parsedAmount = Number(superAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 赎回数量。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: miningPool,
    abi: minerAbi,
    functionName: 'unstakeSuper',
    args: [parseUnits(superAmount, 18)],
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function startMiningOnChain(options?: RegisterMinerOptions) {
  if (!minerContractAddress) {
    throw new Error('缺少 VITE_MINING_POOL_ADDRESS（或 VITE_MINER_CONTRACT_ADDRESS）配置。');
  }

  const hashrate = options?.hashrate ?? 1000n;
  if (hashrate <= 0n) {
    throw new Error('算力必须大于 0。');
  }

  const deviceId = options?.deviceId?.trim() || `web-${Date.now()}`;

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    account,
    address: minerContractAddress,
    abi: minerAbi,
    functionName: 'registerMiner',
    args: [hashrate, deviceId],
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

export async function swapSuperToUsdtOnChain(superAmount: string) {
  const router = requireSwapRouterAddress();

  const parsedAmount = Number(superAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 数量。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: swapAbi,
    functionName: 'swapSuperToUsdt',
    args: [parseUnits(superAmount, 18)],
  });

  await publicClient.waitForTransactionReceipt({ hash: hash as Hex });
  return hash;
}

export async function getSwapPoolStatsOnChain(): Promise<SwapPoolStats> {
  const router = requireSwapRouterAddress();
  const publicClient = getPublicClient();

  const [
    reserveSuper,
    reserveUsdt,
    priceSuperPerUsdt,
    totalLPShares,
    accumulatedPlatformFee,
    accumulatedEcosystemFee,
    lpFeeShare,
    platformFeeShare,
    ecosystemFeeShare,
  ] = await Promise.all([
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'reserveSuper' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'reserveUSDT' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'getPrice' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'totalLPShares' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'accumulatedPlatformFee' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'accumulatedEcosystemFee' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'lpFeeShare' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'platformFeeShare' }),
    publicClient.readContract({ address: router, abi: swapAbi, functionName: 'ecosystemFeeShare' }),
  ]);

  return {
    reserveSuper,
    reserveUsdt,
    priceSuperPerUsdt,
    totalLPShares,
    accumulatedPlatformFee,
    accumulatedEcosystemFee,
    lpFeeShare,
    platformFeeShare,
    ecosystemFeeShare,
  };
}

export async function getSuperTokenStatsOnChain(): Promise<SuperTokenStats> {
  const superToken = requireSuperAddress();
  const publicClient = getPublicClient();

  const router = swapContractAddress;
  const [totalSupply, totalMinted, remainingSupply, routerBalance] = await Promise.all([
    publicClient.readContract({ address: superToken, abi: superAbi, functionName: 'totalSupply' }),
    publicClient.readContract({ address: superToken, abi: superAbi, functionName: 'totalMinted' }),
    publicClient.readContract({ address: superToken, abi: superAbi, functionName: 'remainingSupply' }),
    router
      ? publicClient.readContract({
          address: superToken,
          abi: superAbi,
          functionName: 'balanceOf',
          args: [router],
        })
      : Promise.resolve(0n),
  ]);

  return {
    totalSupply,
    totalMinted,
    remainingSupply,
    routerBalance,
  };
}

export async function mintSuperOnChain(to: Address, superAmount: string) {
  const superToken = requireSuperAddress();

  const parsedAmount = Number(superAmount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 增发数量。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    account,
    address: superToken,
    abi: superAbi,
    functionName: 'mint',
    args: [to, parseUnits(superAmount, 18)],
  });

  await waitForTx(hash as Hex);
  return hash;
}

async function approveForRouter(superAmount: bigint, usdtAmount: bigint) {
  const router = requireSwapRouterAddress();
  const superToken = requireSuperAddress();

  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  const account = await ensureConnectedAddress();

  const superApproveHash = await walletClient.writeContract({
    account,
    address: superToken,
    abi: superAbi,
    functionName: 'approve',
    args: [router, superAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: superApproveHash as Hex });

  const usdtAddress = await publicClient.readContract({
    address: router,
    abi: swapAbi,
    functionName: 'usdtToken',
  });

  const usdtApproveHash = await walletClient.writeContract({
    account,
    address: usdtAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [router, usdtAmount],
  });
  await publicClient.waitForTransactionReceipt({ hash: usdtApproveHash as Hex });
}

export async function initializeSwapLiquidityOnChain(superAmount: string, usdtAmount: string) {
  const router = requireSwapRouterAddress();
  const superParsed = Number(superAmount);
  const usdtParsed = Number(usdtAmount);
  if (!Number.isFinite(superParsed) || superParsed <= 0 || !Number.isFinite(usdtParsed) || usdtParsed <= 0) {
    throw new Error('请输入有效的 SUPER / USDT 数量。');
  }

  const superUnits = parseUnits(superAmount, 18);
  const usdtUnits = parseUnits(usdtAmount, 18);

  await approveForRouter(superUnits, usdtUnits);

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: swapAbi,
    functionName: 'initializeLiquidity',
    args: [superUnits, usdtUnits],
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function addSwapLiquidityOnChain(superAmount: string, usdtAmount: string) {
  const router = requireSwapRouterAddress();
  const superParsed = Number(superAmount);
  const usdtParsed = Number(usdtAmount);
  if (!Number.isFinite(superParsed) || superParsed <= 0 || !Number.isFinite(usdtParsed) || usdtParsed <= 0) {
    throw new Error('请输入有效的 SUPER / USDT 数量。');
  }

  const superUnits = parseUnits(superAmount, 18);
  const usdtUnits = parseUnits(usdtAmount, 18);

  await approveForRouter(superUnits, usdtUnits);

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();
  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: swapAbi,
    functionName: 'addLiquidity',
    args: [superUnits, usdtUnits],
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function collectPlatformFeeOnChain() {
  const router = requireSwapRouterAddress();
  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: swapAbi,
    functionName: 'collectPlatformFee',
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function collectEcosystemFeeOnChain(recipient: Address) {
  const router = requireSwapRouterAddress();
  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = await walletClient.writeContract({
    account,
    address: router,
    abi: swapAbi,
    functionName: 'collectEcosystemFee',
    args: [recipient],
  });

  await waitForTx(hash as Hex);
  return hash;
}

export async function sendGasToAddressOnChain(recipient: Address, amount: string) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('请输入有效的 Gas 数量（大于 0）。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = (await walletClient.sendTransaction({
    account,
    to: recipient,
    value: parseEther(amount),
  })) as Hex;

  await waitForTx(hash);
  return hash;
}

export async function sendSuperToAddressOnChain(recipient: Address, amount: string) {
  const superToken = requireSuperAddress();
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('请输入有效的 SUPER 数量（大于 0）。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = (await walletClient.writeContract({
    account,
    address: superToken,
    abi: superAbi,
    functionName: 'transfer',
    args: [recipient, parseUnits(amount, 18)],
  })) as Hex;

  await waitForTx(hash);
  return hash;
}

export async function sendUsdtToAddressOnChain(recipient: Address, amount: string) {
  const usdtToken = await requireUsdtAddress();
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('请输入有效的 USDT 数量（大于 0）。');
  }

  const account = await ensureConnectedAddress();
  const walletClient = getWalletClient();

  const hash = (await walletClient.writeContract({
    account,
    address: usdtToken,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, parseUnits(amount, 18)],
  })) as Hex;

  await waitForTx(hash);
  return hash;
}

