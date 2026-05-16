import type { Address, Hex } from 'viem';
import { createPublicClient, createWalletClient, defineChain, fallback, formatUnits, getAddress, http, parseUnits, zeroAddress } from 'viem';
import { getWalletAddress as getLocalWalletAddress, getWalletAccount } from './wallet';

const chainId = Number(process.env.EXPO_PUBLIC_CHAIN_ID ?? '56');
const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://bsc-dataseed.binance.org/';
// 自有 Worker 代理 RPC，优先走自有域名（Cloudflare 边缘）在中国大陆链路上更稳定
const proxyRpcUrl = process.env.EXPO_PUBLIC_RPC_PROXY_URL ?? 'https://api.coinplanets.net/api/rpc/bsc';
const rpcFallbacks = Array.from(
  new Set(
    [
      proxyRpcUrl,
      rpcUrl,
      'https://bsc-dataseed1.defibit.io/',
      'https://bsc-dataseed1.ninicoin.io/',
      'https://bsc.publicnode.com',
      'https://rpc.ankr.com/bsc',
    ].filter((u): u is string => Boolean(u && u.trim())),
  ),
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
    default: { http: rpcFallbacks },
    public: { http: rpcFallbacks },
  },
});

const miningPoolAddress =
  (process.env.EXPO_PUBLIC_MINING_POOL_ADDRESS as Address | undefined) ??
  (process.env.EXPO_PUBLIC_MINER_CONTRACT_ADDRESS as Address | undefined);
const superTokenAddress =
  (process.env.EXPO_PUBLIC_SUPER_ADDRESS as Address | undefined) ??
  (process.env.EXPO_PUBLIC_SUPER_TOKEN_ADDRESS as Address | undefined);
const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;

function requireAddress(value: Address | undefined, envName: string): Address {
  if (!value) {
    throw new Error(`Missing ${envName}.`);
  }
  return value;
}

function withGasBuffer(gas: bigint): bigint {
  return (gas * GAS_BUFFER_NUMERATOR) / GAS_BUFFER_DENOMINATOR;
}

function firstLine(message: string): string {
  return message.split('\n').map((line) => line.trim()).find(Boolean) ?? message;
}

function normalizeTxError(error: unknown): Error {
  if (error instanceof Error) {
    const raw = error.message || 'Transaction failed';
    const msg = raw.toLowerCase();

    // Try to extract an explicit revert reason if the underlying error carries one.
    // viem errors expose properties like `shortMessage`, `details`, `metaMessages`,
    // or the revert reason after `reverted with the following reason:\n<reason>`.
    let revertReason = '';
    const reasonMatch = raw.match(/reverted with the following reason:\s*\n?\s*([^\n]+)/i);
    if (reasonMatch) {
      revertReason = reasonMatch[1].trim();
    } else {
      const anyErr = error as { shortMessage?: unknown; details?: unknown };
      if (typeof anyErr.shortMessage === 'string' && anyErr.shortMessage) {
        revertReason = anyErr.shortMessage;
      } else if (typeof anyErr.details === 'string' && anyErr.details) {
        revertReason = anyErr.details;
      }
    }

    if (msg.includes('insufficient') || msg.includes('exceeds the balance')) {
      return new Error('Insufficient BNB for gas or transfer value.');
    }
    if (msg.includes('user rejected') || msg.includes('denied') || msg.includes('rejected the request')) {
      return new Error('User rejected the transaction.');
    }
    if (msg.includes('timeout') || msg.includes('took too long')) {
      return new Error('Transaction confirmation timeout.');
    }
    if (msg.includes('execution reverted') || msg.includes('reverted')) {
      return new Error(`Transaction reverted: ${revertReason || firstLine(raw)}`);
    }

    return new Error(revertReason || firstLine(raw));
  }

  return new Error('Transaction failed');
}

async function assertSufficientBalanceForContractTx(params: {
  account: Address;
  contractAddress: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
}) {
  const { account, contractAddress, abi, functionName, args } = params;
  const { publicClient } = await getWalletClients();

  const [balance, gasPrice, estimatedGas] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.getGasPrice(),
    publicClient.estimateContractGas({
      account,
      address: contractAddress,
      abi,
      functionName,
      args,
    }),
  ]);

  const bufferedGas = withGasBuffer(estimatedGas);
  const required = bufferedGas * gasPrice;

  if (balance < required) {
    const requiredBnb = Number(formatUnits(required, 18)).toFixed(6);
    const balanceBnb = Number(formatUnits(balance, 18)).toFixed(6);
    throw new Error(`Insufficient BNB for gas or transfer value. Need ~${requiredBnb} BNB, balance ${balanceBnb} BNB.`);
  }

  return bufferedGas;
}

async function assertSufficientBalanceForTransfer(params: {
  account: Address;
  to: Address;
  value: bigint;
}) {
  const { account, to, value } = params;
  const { publicClient } = await getWalletClients();

  const [balance, gasPrice, estimatedGas] = await Promise.all([
    publicClient.getBalance({ address: account }),
    publicClient.getGasPrice(),
    publicClient.estimateGas({
      account,
      to,
      value,
    }),
  ]);

  const bufferedGas = withGasBuffer(estimatedGas);
  const required = bufferedGas * gasPrice + value;

  if (balance < required) {
    const requiredBnb = Number(formatUnits(required, 18)).toFixed(6);
    const balanceBnb = Number(formatUnits(balance, 18)).toFixed(6);
    throw new Error(`Insufficient BNB for gas or transfer value. Need ~${requiredBnb} BNB, balance ${balanceBnb} BNB.`);
  }

  return bufferedGas;
}

async function getWalletClients() {
  const account = await getWalletAccount();

  const transport = fallback(
    rpcFallbacks.map((url) => http(url, { timeout: 8_000, retryCount: 1 })),
    { rank: false, retryCount: 1 },
  );

  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const publicClient = createPublicClient({
    chain,
    transport,
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
  {
    type: 'function',
    name: 'minSuperStakeForReward',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'registeredMiners',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'stakedSuper',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
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
    name: 'referrerOf',
    stateMutability: 'view',
    inputs: [{ name: 'invitee', type: 'address' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'bindReferral',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_inviter', type: 'address' }],
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
] as const;

export async function getWalletAddress(): Promise<Address> {
  return getLocalWalletAddress();
}

export async function isMinerRegisteredOnChain(wallet?: Address): Promise<boolean> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const { account, publicClient } = await getWalletClients();
  const miner = wallet ?? account.address;
  const registered = await publicClient.readContract({
    address: pool,
    abi: minerAbi,
    functionName: 'registeredMiners',
    args: [miner],
  });

  return Boolean(registered);
}

function normalizeAddressInput(value: string, label: string): Address {
  try {
    return getAddress(value.trim()) as Address;
  } catch {
    throw new Error(`Invalid ${label} address.`);
  }
}

function isZeroAddress(value: string): boolean {
  return value.toLowerCase() === zeroAddress.toLowerCase();
}

export async function getReferrerOnChain(wallet?: Address): Promise<Address | null> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const { account, publicClient } = await getWalletClients();
  const invitee = wallet ?? account.address;
  const referrer = await publicClient.readContract({
    address: pool,
    abi: minerAbi,
    functionName: 'referrerOf',
    args: [invitee],
  });

  const referrerAddress = String(referrer);
  return isZeroAddress(referrerAddress) ? null : getAddress(referrerAddress) as Address;
}

export async function bindReferralOnChain(referralWallet: string): Promise<{
  inviter: Address;
  txHash: Hex | null;
  alreadyBound: boolean;
}> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const inviter = normalizeAddressInput(referralWallet, 'referral wallet');

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    if (inviter.toLowerCase() === account.address.toLowerCase()) {
      throw new Error('Cannot bind self referral.');
    }

    const existing = await publicClient.readContract({
      address: pool,
      abi: minerAbi,
      functionName: 'referrerOf',
      args: [account.address],
    });
    const existingAddress = String(existing);
    if (!isZeroAddress(existingAddress)) {
      if (existingAddress.toLowerCase() === inviter.toLowerCase()) {
        return { inviter: getAddress(existingAddress) as Address, txHash: null, alreadyBound: true };
      }
      throw new Error('Referral already bound to another wallet on-chain.');
    }

    const args = [inviter] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: pool,
      abi: minerAbi,
      functionName: 'bindReferral',
      args,
    });
    const hash = await walletClient.writeContract({
      account,
      address: pool,
      abi: minerAbi,
      functionName: 'bindReferral',
      args,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return { inviter, txHash: hash as Hex, alreadyBound: false };
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function registerMinerOnChain(hashrate: number, deviceId: string) {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const args = [BigInt(hashrate), deviceId] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: miningPoolAddress,
      abi: minerAbi,
      functionName: 'registerMiner',
      args,
    });

    const hash = await walletClient.writeContract({
      account,
      address: miningPoolAddress,
      abi: minerAbi,
      functionName: 'registerMiner',
      args,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function updateHashrateOnChain(hashrate: number) {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const args = [BigInt(hashrate)] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: miningPoolAddress,
      abi: minerAbi,
      functionName: 'updateHashrate',
      args,
    });

    const hash = await walletClient.writeContract({
      account,
      address: miningPoolAddress,
      abi: minerAbi,
      functionName: 'updateHashrate',
      args,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function claimRewardOnChain() {
  if (!miningPoolAddress) {
    throw new Error('缺少 EXPO_PUBLIC_MINING_POOL_ADDRESS。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: miningPoolAddress,
      abi: minerAbi,
      functionName: 'claimReward',
    });

    const hash = await walletClient.writeContract({
      account,
      address: miningPoolAddress,
      abi: minerAbi,
      functionName: 'claimReward',
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function getMiningStakeRequirement(): Promise<{
  minSuperStakeForReward: string;
  stakedSuper: string;
  isRewardEligible: boolean;
}> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const { account, publicClient } = await getWalletClients();

  const [minStake, staked, eligible] = await Promise.all([
    publicClient.readContract({
      address: pool,
      abi: minerAbi,
      functionName: 'minSuperStakeForReward',
    }),
    publicClient.readContract({
      address: pool,
      abi: minerAbi,
      functionName: 'stakedSuper',
      args: [account.address],
    }),
    publicClient.readContract({
      address: pool,
      abi: minerAbi,
      functionName: 'isRewardEligible',
      args: [account.address],
    }).catch(() => false),
  ]);

  return {
    minSuperStakeForReward: formatUnits(minStake as bigint, 18),
    stakedSuper: formatUnits(staked as bigint, 18),
    isRewardEligible: Boolean(eligible),
  };
}

export async function stakeSuperOnChain(amount: string): Promise<Hex[]> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const superToken = requireAddress(superTokenAddress, 'EXPO_PUBLIC_SUPER_ADDRESS');
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 抵押数量。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const parsedAmount = parseUnits(amount, 18);
    const approveArgs = [pool, parsedAmount] as const;
    const approveGas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: superToken,
      abi: erc20Abi,
      functionName: 'approve',
      args: approveArgs,
    });
    const approveHash = await walletClient.writeContract({
      account,
      address: superToken,
      abi: erc20Abi,
      functionName: 'approve',
      args: approveArgs,
      gas: approveGas,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash as Hex, timeout: 120_000 });

    const stakeArgs = [parsedAmount] as const;
    const stakeGas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: pool,
      abi: minerAbi,
      functionName: 'stakeSuper',
      args: stakeArgs,
    });
    const stakeHash = await walletClient.writeContract({
      account,
      address: pool,
      abi: minerAbi,
      functionName: 'stakeSuper',
      args: stakeArgs,
      gas: stakeGas,
    });
    await publicClient.waitForTransactionReceipt({ hash: stakeHash as Hex, timeout: 120_000 });

    return [approveHash as Hex, stakeHash as Hex];
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function unstakeSuperOnChain(amount: string): Promise<Hex> {
  const pool = requireAddress(miningPoolAddress, 'EXPO_PUBLIC_MINING_POOL_ADDRESS');
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 解除抵押数量。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const args = [parseUnits(amount, 18)] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: pool,
      abi: minerAbi,
      functionName: 'unstakeSuper',
      args,
    });
    const hash = await walletClient.writeContract({
      account,
      address: pool,
      abi: minerAbi,
      functionName: 'unstakeSuper',
      args,
      gas,
    });
    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash as Hex;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

export async function sendNativeTokenOnChain(to: Address, amountEth: string) {
  const normalizedAmount = Number(amountEth);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效转账金额。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const value = parseUnits(amountEth, 18);
    const gas = await assertSufficientBalanceForTransfer({
      account: account.address,
      to,
      value,
    });

    const hash = await walletClient.sendTransaction({
      account,
      to,
      value,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

// ===== Balance Queries (余额查询) =====

export async function sendSuperToAddressOnChain(to: Address, amount: string) {
  const superToken = requireAddress(superTokenAddress, 'EXPO_PUBLIC_SUPER_ADDRESS');
  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 SUPER 数量。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const args = [to, parseUnits(amount, 18)] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: superToken,
      abi: erc20Abi,
      functionName: 'transfer',
      args,
    });

    const hash = await walletClient.writeContract({
      account,
      address: superToken,
      abi: erc20Abi,
      functionName: 'transfer',
      args,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
}

const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
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
] as const;

/**
 * Get BNB (native token) balance for the current wallet.
 * Returns balance as a decimal string (e.g., "1.5").
 */
export async function getBNBBalance(): Promise<string> {
  try {
    const address = await getWalletAddress();
    const { publicClient } = await getWalletClients();
    const balance = await publicClient.getBalance({ address });
    return formatUnits(balance, 18);
  } catch (error) {
    console.error('Failed to get BNB balance:', error);
    return '0';
  }
}

/**
 * Get SUPER token balance for the current wallet.
 * Returns balance as a decimal string (e.g., "100.5").
 */
export async function getSUPERBalance(): Promise<string> {
  const superTokenAddress =
    (process.env.EXPO_PUBLIC_SUPER_ADDRESS as Address | undefined) ??
    (process.env.EXPO_PUBLIC_SUPER_TOKEN_ADDRESS as Address | undefined);

  try {
    const tokenAddress = requireAddress(superTokenAddress, 'EXPO_PUBLIC_SUPER_ADDRESS');
    const address = await getWalletAddress();
    const { publicClient } = await getWalletClients();
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return formatUnits(balance as bigint, 18);
  } catch (error) {
    console.error('Failed to get SUPER balance:', error);
    return '0';
  }
}

/**
 * Get USDT token balance for the current wallet.
 * Returns balance as a decimal string (e.g., "50.25").
 */
export async function getUSDTBalance(): Promise<string> {
  const usdtTokenAddress =
    (process.env.EXPO_PUBLIC_USDT_ADDRESS as Address | undefined) ??
    (process.env.EXPO_PUBLIC_USDT_TOKEN_ADDRESS as Address | undefined);

  try {
    const tokenAddress = requireAddress(usdtTokenAddress, 'EXPO_PUBLIC_USDT_ADDRESS');
    const address = await getWalletAddress();
    const { publicClient } = await getWalletClients();
    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [address],
    });
    return formatUnits(balance as bigint, 6); // USDT has 6 decimals
  } catch (error) {
    console.error('Failed to get USDT balance:', error);
    return '0';
  }
}

/**
 * Get all wallet balances (BNB, SUPER, USDT) in parallel.
 * Returns an object with balance strings for each token.
 */
export async function getWalletBalances(): Promise<{
  bnb: string;
  super: string;
  usdt: string;
}> {
  try {
    const [bnb, super_, usdt] = await Promise.all([
      getBNBBalance(),
      getSUPERBalance(),
      getUSDTBalance(),
    ]);
    return { bnb, super: super_, usdt };
  } catch (error) {
    console.error('Failed to get wallet balances:', error);
    return { bnb: '0', super: '0', usdt: '0' };
  }
}

