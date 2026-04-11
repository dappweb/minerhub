import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Hex, PrivateKeyAccount } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

const WALLET_PRIVATE_KEY = 'coinplanet.wallet.private_key';

function normalizePrivateKey(privateKey: string): Hex {
  const normalized = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
  if (normalized.length !== 66) {
    throw new Error('钱包私钥格式不正确');
  }
  return normalized as Hex;
}

async function getOrCreatePrivateKey(): Promise<Hex> {
  const stored = await AsyncStorage.getItem(WALLET_PRIVATE_KEY);
  if (stored) {
    return normalizePrivateKey(stored);
  }

  const generated = generatePrivateKey();
  await AsyncStorage.setItem(WALLET_PRIVATE_KEY, generated);
  return normalizePrivateKey(generated);
}

export async function getWalletAccount(): Promise<PrivateKeyAccount> {
  const privateKey = await getOrCreatePrivateKey();
  return privateKeyToAccount(privateKey);
}

export async function getWalletAddress(): Promise<`0x${string}`> {
  const account = await getWalletAccount();
  return account.address;
}
