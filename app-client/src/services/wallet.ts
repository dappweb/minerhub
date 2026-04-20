import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

// Native uses expo-secure-store (Keystore/Keychain).
// Web falls back to localStorage since SecureStore is not implemented on web.
const isSecureStoreAvailable =
  Platform.OS !== 'web' && typeof SecureStore.getItemAsync === 'function';

async function storageGet(key: string): Promise<string | null> {
  if (isSecureStoreAvailable) {
    return SecureStore.getItemAsync(key);
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    return (globalThis as any).localStorage.getItem(key);
  }
  return null;
}

async function storageSet(key: string, value: string): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    (globalThis as any).localStorage.setItem(key, value);
  }
}

async function getOrCreatePrivateKey(): Promise<Hex> {
  const stored = await storageGet(WALLET_PRIVATE_KEY);
  if (stored) {
    return normalizePrivateKey(stored);
  }

  const generated = generatePrivateKey();
  await storageSet(WALLET_PRIVATE_KEY, generated);
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

/**
 * Export the raw private key for the local wallet.
 * SECURITY: Only use inside a user-initiated export flow with an explicit warning UI.
 * Returned value is the 0x-prefixed 32-byte hex string.
 */
export async function exportWalletPrivateKey(): Promise<Hex | null> {
  const stored = await storageGet(WALLET_PRIVATE_KEY);
  if (!stored) return null;
  return normalizePrivateKey(stored);
}

/**
 * Import a wallet from a private key.
 * SECURITY: Only use inside a user-initiated import flow with an explicit warning UI.
 * This will REPLACE the current wallet - the user should understand this.
 * @param privateKey - The private key to import (0x-prefixed or not)
 */
export async function importWalletPrivateKey(privateKey: string): Promise<Hex> {
  const normalized = normalizePrivateKey(privateKey);
  await storageSet(WALLET_PRIVATE_KEY, normalized);
  // Validate by creating account
  const account = privateKeyToAccount(normalized);
  return account.address;
}

/**
 * Clear the wallet (delete stored private key).
 * SECURITY: Only use inside a user-initiated account reset/clear flow.
 */
export async function clearWallet(): Promise<void> {
  if (isSecureStoreAvailable) {
    await SecureStore.deleteItemAsync(WALLET_PRIVATE_KEY);
    return;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    (globalThis as any).localStorage.removeItem(WALLET_PRIVATE_KEY);
  }
}
