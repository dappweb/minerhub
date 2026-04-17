import type { Address, Hex } from 'viem';
import { createPublicClient, createWalletClient, defineChain, formatUnits, http, parseUnits } from 'viem';
import { getWalletAddress as getLocalWalletAddress, getWalletAccount } from './wallet';

const chainId = Number(process.env.EXPO_PUBLIC_CHAIN_ID ?? '97');
const rpcUrl = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://data-seed-prebsc-1-s1.binance.org:8545/';

const chain = defineChain({
  id: chainId,
  name: 'Coin Planet Chain',
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
});

const miningPoolAddress = process.env.EXPO_PUBLIC_MINING_POOL_ADDRESS as Address | undefined;
const swapRouterAddress = process.env.EXPO_PUBLIC_SWAP_ROUTER_ADDRESS as Address | undefined;
const GAS_BUFFER_NUMERATOR = 12n;
const GAS_BUFFER_DENOMINATOR = 10n;

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
      return new Error(`Transaction reverted: ${firstLine(raw)}`);
    }

    return new Error(firstLine(raw));
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
    name: 'swapUsdtToSuper',
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

export async function swapUsdtToSuperOnChain(amount: string) {
  if (!swapRouterAddress) {
    throw new Error('缺少 EXPO_PUBLIC_SWAP_ROUTER_ADDRESS。');
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    throw new Error('请输入有效的 USDT 数量。');
  }

  try {
    const { account, walletClient, publicClient } = await getWalletClients();
    const args = [parseUnits(amount, 18)] as const;
    const gas = await assertSufficientBalanceForContractTx({
      account: account.address,
      contractAddress: swapRouterAddress,
      abi: swapAbi,
      functionName: 'swapUsdtToSuper',
      args,
    });

    const hash = await walletClient.writeContract({
      account,
      address: swapRouterAddress,
      abi: swapAbi,
      functionName: 'swapUsdtToSuper',
      args,
      gas,
    });

    await publicClient.waitForTransactionReceipt({ hash: hash as Hex, timeout: 120_000 });
    return hash;
  } catch (error) {
    throw normalizeTxError(error);
  }
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

