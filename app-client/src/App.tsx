import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Address } from 'viem';
import { createClaim, createUser, registerDevice } from './services/api';
import {
  claimRewardOnChain,
  getSwapPriceOnChain,
  getWalletAddress,
  registerMinerOnChain,
  sendNativeTokenOnChain,
  swapSuperToUsdtOnChain,
  updateHashrateOnChain,
} from './services/blockchain';

const DEVICE_ID_KEY = 'coinplanet.device_id';
const MINER_READY_KEY = 'coinplanet.miner_ready';

type ActionType = 'init' | 'mine' | 'claim' | 'swap' | 'transfer' | '';

function createDeviceId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `mobile-${Date.now()}-${random}`;
}

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function isValidEvmAddress(address: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [superAmount, setSuperAmount] = useState<string>('10');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('0.001');
  const [hashrateInput, setHashrateInput] = useState<string>('1000');
  const [deviceId, setDeviceId] = useState<string>('');
  const [minerReady, setMinerReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('Initializing local wallet...');
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionType>('');
  const [swapPrice, setSwapPrice] = useState<string>('');

  const shortAddress = useMemo(() => {
    if (!walletAddress) return 'Initializing...';
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const isBusy = activeAction !== '';
  const identityReady = Boolean(walletAddress && userId && deviceId);

  const flowHint = useMemo(() => {
    if (!identityReady) {
      return 'Step 1/3: complete identity setup first';
    }
    if (!minerReady) {
      return 'Step 2/3: register your miner to unlock rewards';
    }
    return 'Step 3/3: claim, swap, and transfer';
  }, [identityReady, minerReady]);

  useEffect(() => {
    const initDeviceId = async () => {
      try {
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) {
          setDeviceId(existing);
          return;
        }

        const next = createDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, next);
        setDeviceId(next);
      } catch {
        setDeviceId(createDeviceId());
      }
    };

    void initDeviceId();
  }, []);

  useEffect(() => {
    const restoreMinerReady = async () => {
      try {
        const stored = await AsyncStorage.getItem(MINER_READY_KEY);
        setMinerReady(stored === '1');
      } catch {
        setMinerReady(false);
      }
    };

    void restoreMinerReady();
  }, []);

  const markMinerReady = async () => {
    setMinerReady(true);
    try {
      await AsyncStorage.setItem(MINER_READY_KEY, '1');
    } catch {
      // Ignore storage failures and keep in-memory state.
    }
  };

  const refreshSwapPrice = async () => {
    try {
      const price = await getSwapPriceOnChain();
      const parsed = Number(price) / 1e18;
      if (Number.isFinite(parsed) && parsed > 0) {
        setSwapPrice(`1 USDT ~= ${parsed.toFixed(6)} SUPER`);
      } else {
        setSwapPrice('Current pool price is unavailable');
      }
    } catch {
      setSwapPrice('Unable to fetch pool price right now');
    }
  };

  const initializeAccount = async () => {
    setActiveAction('init');
    setLastTxHash('');
    setStatus('Initializing wallet and binding backend account...');
    try {
      const address = await getWalletAddress();
      setWalletAddress(address);
      const user = await createUser(address);
      setUserId(user.id);
      await refreshSwapPrice();
      setStatus('Identity initialized. Next: set up miner.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Initialization failed';
      setStatus(`Initialization failed: ${message}`);
    } finally {
      setActiveAction('');
    }
  };

  useEffect(() => {
    if (!deviceId) {
      return;
    }
    void initializeAccount();
  }, [deviceId]);

  const startMining = async () => {
    if (!identityReady) {
      setStatus('Identity is not ready. Please initialize first.');
      return;
    }

    const parsedHashrate = Number(hashrateInput);
    if (!Number.isFinite(parsedHashrate) || parsedHashrate <= 0) {
      setStatus('Please enter a valid hashrate (> 0)');
      return;
    }

    setActiveAction('mine');
    setLastTxHash('');

    const finalHashrate = Math.floor(parsedHashrate);

    try {
      if (minerReady) {
        setStatus('Submitting on-chain hashrate update...');
        const txHash = await updateHashrateOnChain(finalHashrate);
        setLastTxHash(txHash);
        setStatus(`Hashrate updated: ${shortHash(txHash)}`);
        return;
      }

      setStatus('Submitting on-chain miner registration...');
      const txHash = await registerMinerOnChain(finalHashrate, deviceId);
      const device = await registerDevice({
        userId,
        deviceId,
        hashrate: finalHashrate,
        wallet: walletAddress,
      });

      await createClaim({ userId, amount: '10', wallet: walletAddress });
      await markMinerReady();
      setLastTxHash(txHash);
      setStatus(`Miner registered: ${shortHash(txHash)}, device record ${device.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Miner setup failed';
      const lower = message.toLowerCase();
      const alreadyRegistered = lower.includes('already') && lower.includes('register');

      if (!minerReady && alreadyRegistered) {
        try {
          const txHash = await updateHashrateOnChain(finalHashrate);
          await markMinerReady();
          setLastTxHash(txHash);
          setStatus(`Miner already registered on-chain. Hashrate updated: ${shortHash(txHash)}`);
        } catch (fallbackError) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : 'Hashrate update failed';
          setStatus(`Miner state recovery failed: ${fallbackMsg}`);
        }
      } else {
        setStatus(`Miner setup failed: ${message}`);
      }
    } finally {
      setActiveAction('');
    }
  };

  const claimReward = async () => {
    if (!identityReady) {
      setStatus('Identity is not ready. Please initialize first.');
      return;
    }

    if (!minerReady) {
      setStatus('Please register miner before claiming rewards');
      return;
    }

    setActiveAction('claim');
    setLastTxHash('');
    setStatus('Submitting reward claim transaction...');
    try {
      const txHash = await claimRewardOnChain();
      setLastTxHash(txHash);
      setStatus(`Claim success: ${shortHash(txHash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Claim failed';
      setStatus(`Claim failed: ${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const swapSuper = async () => {
    if (!identityReady) {
      setStatus('Identity is not ready. Please initialize first.');
      return;
    }

    const parsedAmount = Number(superAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setStatus('Please enter a valid SUPER amount');
      return;
    }

    setActiveAction('swap');
    setLastTxHash('');
    setStatus('Submitting swap transaction...');
    try {
      const txHash = await swapSuperToUsdtOnChain(superAmount);
      setLastTxHash(txHash);
      setStatus(`Swap success: ${shortHash(txHash)}`);
      await refreshSwapPrice();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap failed';
      setStatus(`Swap failed: ${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const transferNativeToken = async () => {
    if (!identityReady) {
      setStatus('Identity is not ready. Please initialize first.');
      return;
    }

    if (!isValidEvmAddress(transferTo)) {
      setStatus('Please enter a valid destination address (0x + 40 hex chars)');
      return;
    }

    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus('Please enter a valid transfer amount');
      return;
    }

    setActiveAction('transfer');
    setLastTxHash('');
    setStatus('Submitting native token transfer...');
    try {
      const txHash = await sendNativeTokenOnChain(transferTo.trim() as Address, transferAmount);
      setLastTxHash(txHash);
      setStatus(`Transfer success: ${shortHash(txHash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transfer failed';
      setStatus(`Transfer failed: ${message}`);
    } finally {
      setActiveAction('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>Coin Planet</Text>
          <Text style={styles.subtitle}>Built-in wallet mode (no external wallet)</Text>
          <Text style={styles.flowHint}>{flowHint}</Text>

          <View style={styles.stepRow}>
            <View style={[styles.stepTag, identityReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, identityReady && styles.stepTagTextDone]}>1. Identity</Text>
            </View>
            <View style={[styles.stepTag, minerReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, minerReady && styles.stepTagTextDone]}>2. Miner</Text>
            </View>
            <View style={[styles.stepTag, minerReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, minerReady && styles.stepTagTextDone]}>3. Actions</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 1: Identity Setup</Text>
            <Text style={styles.label}>Wallet Address</Text>
            <Text style={styles.value}>{walletAddress || 'Initializing...'}</Text>
            {!!walletAddress && <Text style={styles.hint}>Short: {shortAddress}</Text>}

            <Text style={styles.label}>Backend User ID</Text>
            <Text style={styles.value}>{userId || 'Not initialized'}</Text>

            <Text style={styles.label}>Device ID (stable tracking)</Text>
            <Text style={styles.value}>{deviceId || 'Initializing...'}</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={initializeAccount} disabled={isBusy}>
              <Text style={styles.primaryBtnText}>Resync Identity</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 2: Miner Setup</Text>
            <Text style={styles.label}>Hashrate (raw contract value)</Text>
            <TextInput
              style={styles.input}
              value={hashrateInput}
              onChangeText={setHashrateInput}
              keyboardType="number-pad"
              placeholder="e.g. 2600"
              placeholderTextColor="#475569"
              editable={!isBusy}
            />
            <Text style={styles.hint}>
              {minerReady ? 'Already registered. Submitting again will update hashrate.' : 'First submit will register miner and create reward record.'}
            </Text>
            <TouchableOpacity style={styles.secondaryBtn} onPress={startMining} disabled={isBusy || !identityReady}>
              <Text style={styles.secondaryBtnText}>{minerReady ? 'Update Hashrate' : 'Register Miner and Start'}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Step 3: Daily On-chain Actions</Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={claimReward} disabled={isBusy || !identityReady}>
              <Text style={styles.secondaryBtnText}>Claim Reward</Text>
            </TouchableOpacity>

            <View style={styles.groupBox}>
              <Text style={styles.label}>SUPER Amount to Swap</Text>
              <TextInput
                style={styles.input}
                value={superAmount}
                onChangeText={setSuperAmount}
                keyboardType="decimal-pad"
                placeholder="Enter SUPER amount"
                placeholderTextColor="#475569"
                editable={!isBusy}
              />
              <View style={styles.rowBetween}>
                <Text style={styles.hint}>{swapPrice || 'Price available after identity setup'}</Text>
                <TouchableOpacity onPress={refreshSwapPrice} disabled={isBusy}>
                  <Text style={styles.refreshText}>Refresh Price</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.secondaryBtn} onPress={swapSuper} disabled={isBusy || !identityReady}>
                <Text style={styles.secondaryBtnText}>Swap to USDT</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupBox}>
              <Text style={styles.label}>Native Token Transfer</Text>
              <TextInput
                style={styles.input}
                value={transferTo}
                onChangeText={setTransferTo}
                placeholder="Destination address 0x..."
                placeholderTextColor="#475569"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isBusy}
              />
              <TextInput
                style={styles.input}
                value={transferAmount}
                onChangeText={setTransferAmount}
                keyboardType="decimal-pad"
                placeholder="Amount (ETH)"
                placeholderTextColor="#475569"
                editable={!isBusy}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={transferNativeToken} disabled={isBusy || !identityReady}>
                <Text style={styles.secondaryBtnText}>Send Transfer</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#22d3ee" />
              <Text style={styles.loadingText}>Processing, please do not resubmit</Text>
            </View>
          )}

          {!!lastTxHash && <Text style={styles.txHash}>Latest Tx: {lastTxHash}</Text>}
          <Text style={styles.status}>{status}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  flowHint: {
    color: '#67e8f9',
    fontSize: 13,
    marginTop: 2,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stepTag: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    paddingVertical: 8,
    alignItems: 'center',
  },
  stepTagDone: {
    borderColor: '#0891b2',
    backgroundColor: '#083344',
  },
  stepTagText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  stepTagTextDone: {
    color: '#67e8f9',
  },
  section: {
    marginTop: 4,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
    gap: 8,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  value: {
    color: '#22d3ee',
    fontSize: 15,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#082f49',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 12,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryBtnText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '600',
  },
  groupBox: {
    marginTop: 8,
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    color: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  status: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  hint: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  refreshText: {
    color: '#22d3ee',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  loadingText: {
    color: '#67e8f9',
    fontSize: 12,
  },
  txHash: {
    color: '#cbd5e1',
    fontSize: 12,
  },
});
