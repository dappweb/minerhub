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

type Lang = 'en' | 'zh';

const LANG_KEY = 'coinplanet.lang';

const translations = {
  en: {
    appTitle: 'Coin Planet',
    subtitle: 'Built-in wallet mode (no external wallet)',
    flow1: 'Step 1/3: complete identity setup first',
    flow2: 'Step 2/3: register your miner to unlock rewards',
    flow3: 'Step 3/3: claim, swap, and transfer',
    stepIdentity: '1. Identity',
    stepMiner: '2. Miner',
    stepActions: '3. Actions',
    sec1Title: 'Step 1: Identity Setup',
    labelWallet: 'Wallet Address',
    labelUserId: 'Backend User ID',
    labelDeviceId: 'Device ID (stable tracking)',
    initializing: 'Initializing...',
    notInitialized: 'Not initialized',
    short: 'Short: ',
    resyncIdentity: 'Resync Identity',
    sec2Title: 'Step 2: Miner Setup',
    labelHashrate: 'Hashrate (raw contract value)',
    phHashrate: 'e.g. 2600',
    hintMinerReady: 'Already registered. Submitting again will update hashrate.',
    hintMinerNew: 'First submit will register miner and create reward record.',
    hintMinerLocked: 'Complete Step 1 first: initialize wallet, user, and device.',
    hintMinerWorking: 'Miner setup in progress. This can take 10-30 seconds on testnet.',
    btnUpdateHashrate: 'Update Hashrate',
    btnRegisterMiner: 'Register Miner and Start',
    sec3Title: 'Step 3: Daily On-chain Actions',
    btnClaimReward: 'Claim Reward',
    labelSuperAmount: 'SUPER Amount to Swap',
    phSuperAmount: 'Enter SUPER amount',
    pricePlaceholder: 'Price available after identity setup',
    refreshPrice: 'Refresh Price',
    btnSwap: 'Swap to USDT',
    labelTransfer: 'Native Token Transfer',
    phTransferTo: 'Destination address 0x...',
    phTransferAmount: 'Amount (ETH)',
    btnTransfer: 'Send Transfer',
    processing: 'Processing, please do not resubmit',
    latestTx: 'Latest Tx: ',
    statusInit: 'Initializing local wallet...',
    statusInitializing: 'Initializing wallet and binding backend account...',
    statusInitDone: 'Identity initialized. Next: set up miner.',
    statusInitFailed: 'Initialization failed: ',
    errIdentityNotReady: 'Identity is not ready. Please initialize first.',
    errInvalidHashrate: 'Please enter a valid hashrate (> 0)',
    statusUpdatingHashrate: 'Submitting on-chain hashrate update...',
    statusHashrateUpdated: 'Hashrate updated: ',
    statusRegisteringMiner: 'Submitting on-chain miner registration...',
    statusMinerRegistered: 'Miner registered: ',
    statusDeviceRecord: ', device record ',
    statusMinerAlreadyRegistered: 'Miner already registered on-chain. Hashrate updated: ',
    statusRecoveryFailed: 'Miner state recovery failed: ',
    statusMinerFailed: 'Miner setup failed: ',
    errMinerNotReady: 'Please register miner before claiming rewards',
    statusClaiming: 'Submitting reward claim transaction...',
    statusClaimSuccess: 'Claim success: ',
    statusClaimFailed: 'Claim failed: ',
    errInvalidSuperAmount: 'Please enter a valid SUPER amount',
    statusSwapping: 'Submitting swap transaction...',
    statusSwapSuccess: 'Swap success: ',
    statusSwapFailed: 'Swap failed: ',
    errInvalidAddress: 'Please enter a valid destination address (0x + 40 hex chars)',
    errInvalidAmount: 'Please enter a valid transfer amount',
    statusTransferring: 'Submitting native token transfer...',
    statusTransferSuccess: 'Transfer success: ',
    statusTransferFailed: 'Transfer failed: ',
    priceUnavailable: 'Current pool price is unavailable',
    priceFetchFailed: 'Unable to fetch pool price right now',
    priceFormat: (val: string) => `1 USDT ~= ${val} SUPER`,
    langToggle: '中文',
  },
  zh: {
    appTitle: 'Coin Planet',
    subtitle: '内置钱包模式（无需外部钱包）',
    flow1: '第 1/3 步：请先完成身份初始化',
    flow2: '第 2/3 步：注册矿机以解锁奖励',
    flow3: '第 3/3 步：领取奖励、兑换、转账',
    stepIdentity: '1. 身份',
    stepMiner: '2. 矿机',
    stepActions: '3. 操作',
    sec1Title: '第一步：身份初始化',
    labelWallet: '钱包地址',
    labelUserId: '后端用户 ID',
    labelDeviceId: '设备 ID（稳定追踪）',
    initializing: '初始化中...',
    notInitialized: '未初始化',
    short: '简短：',
    resyncIdentity: '重新同步身份',
    sec2Title: '第二步：矿机设置',
    labelHashrate: '算力（合约原始值）',
    phHashrate: '例如 2600',
    hintMinerReady: '已注册。再次提交将更新算力。',
    hintMinerNew: '首次提交将注册矿机并创建奖励记录。',
    hintMinerLocked: '请先完成第一步：钱包、用户和设备都要初始化完成。',
    hintMinerWorking: '矿机注册进行中，测试网通常需要 10-30 秒。',
    btnUpdateHashrate: '更新算力',
    btnRegisterMiner: '注册矿机并开始',
    sec3Title: '第三步：日常链上操作',
    btnClaimReward: '领取奖励',
    labelSuperAmount: '兑换的 SUPER 数量',
    phSuperAmount: '输入 SUPER 数量',
    pricePlaceholder: '完成身份初始化后显示价格',
    refreshPrice: '刷新价格',
    btnSwap: '兑换为 USDT',
    labelTransfer: '原生代币转账',
    phTransferTo: '目标地址 0x...',
    phTransferAmount: '数量（ETH）',
    btnTransfer: '发起转账',
    processing: '处理中，请勿重复提交',
    latestTx: '最新交易：',
    statusInit: '正在初始化本地钱包...',
    statusInitializing: '正在初始化钱包并绑定后端账户...',
    statusInitDone: '身份已初始化，下一步：设置矿机。',
    statusInitFailed: '初始化失败：',
    errIdentityNotReady: '身份未就绪，请先完成初始化。',
    errInvalidHashrate: '请输入有效的算力值（> 0）',
    statusUpdatingHashrate: '正在提交链上算力更新...',
    statusHashrateUpdated: '算力已更新：',
    statusRegisteringMiner: '正在提交链上矿机注册...',
    statusMinerRegistered: '矿机已注册：',
    statusDeviceRecord: '，设备记录 ',
    statusMinerAlreadyRegistered: '矿机已在链上注册。算力已更新：',
    statusRecoveryFailed: '矿机状态恢复失败：',
    statusMinerFailed: '矿机设置失败：',
    errMinerNotReady: '请先注册矿机后再领取奖励',
    statusClaiming: '正在提交奖励领取交易...',
    statusClaimSuccess: '领取成功：',
    statusClaimFailed: '领取失败：',
    errInvalidSuperAmount: '请输入有效的 SUPER 数量',
    statusSwapping: '正在提交兑换交易...',
    statusSwapSuccess: '兑换成功：',
    statusSwapFailed: '兑换失败：',
    errInvalidAddress: '请输入有效的目标地址（0x + 40位十六进制字符）',
    errInvalidAmount: '请输入有效的转账数量',
    statusTransferring: '正在提交原生代币转账...',
    statusTransferSuccess: '转账成功：',
    statusTransferFailed: '转账失败：',
    priceUnavailable: '当前池子价格不可用',
    priceFetchFailed: '暂时无法获取池子价格',
    priceFormat: (val: string) => `1 USDT ≈ ${val} SUPER`,
    langToggle: 'English',
  },
} as const;

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
  const [status, setStatus] = useState<string>('');
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionType>('');
  const [swapPrice, setSwapPrice] = useState<string>('');
  const [lang, setLang] = useState<Lang>('zh');

  const t = translations[lang];

  const toggleLang = async () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    try {
      await AsyncStorage.setItem(LANG_KEY, next);
    } catch {
      // ignore
    }
  };

  const shortAddress = useMemo(() => {
    if (!walletAddress) return t.initializing;
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress, lang]);

  const isBusy = activeAction !== '';
  const identityReady = Boolean(walletAddress && userId && deviceId);

  const minerHintText = useMemo(() => {
    if (!identityReady) return t.hintMinerLocked;
    if (activeAction === 'mine') return t.hintMinerWorking;
    return minerReady ? t.hintMinerReady : t.hintMinerNew;
  }, [identityReady, activeAction, minerReady, lang]);

  const flowHint = useMemo(() => {
    if (!identityReady) return t.flow1;
    if (!minerReady) return t.flow2;
    return t.flow3;
  }, [identityReady, minerReady, lang]);

  useEffect(() => {
    const initDeviceId = async () => {
      try {
        const storedLang = await AsyncStorage.getItem(LANG_KEY);
        if (storedLang === 'en' || storedLang === 'zh') {
          setLang(storedLang);
        }
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
        setSwapPrice(t.priceFormat(parsed.toFixed(6)));
      } else {
        setSwapPrice(t.priceUnavailable);
      }
    } catch {
      setSwapPrice(t.priceFetchFailed);
    }
  };

  const initializeAccount = async () => {
    setActiveAction('init');
    setLastTxHash('');
    setStatus(t.statusInitializing);
    try {
      const address = await getWalletAddress();
      setWalletAddress(address);
      const user = await createUser(address);
      setUserId(user.id);
      await refreshSwapPrice();
      setStatus(t.statusInitDone);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.statusInitFailed;
      setStatus(`${t.statusInitFailed}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  useEffect(() => {
    if (!deviceId) {
      return;
    }
    setStatus(translations[lang].statusInit);
    void initializeAccount();
  }, [deviceId]);

  const startMining = async () => {
    if (!identityReady) {
      setStatus(t.errIdentityNotReady);
      return;
    }

    const parsedHashrate = Number(hashrateInput);
    if (!Number.isFinite(parsedHashrate) || parsedHashrate <= 0) {
      setStatus(t.errInvalidHashrate);
      return;
    }

    setActiveAction('mine');
    setLastTxHash('');

    const finalHashrate = Math.floor(parsedHashrate);

    try {
      if (minerReady) {
        setStatus(t.statusUpdatingHashrate);
        const txHash = await updateHashrateOnChain(finalHashrate);
        setLastTxHash(txHash);
        setStatus(`${t.statusHashrateUpdated}${shortHash(txHash)}`);
        return;
      }

      setStatus(t.statusRegisteringMiner);
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
      setStatus(`${t.statusMinerRegistered}${shortHash(txHash)}${t.statusDeviceRecord}${device.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.statusMinerFailed;
      const lower = message.toLowerCase();
      const alreadyRegistered = lower.includes('already') && lower.includes('register');
      const isTimeout = lower.includes('timeout') || lower.includes('took too long');

      // 超时提示：可能是网络慢或 RPC 不稳定
      const displayMessage = isTimeout 
        ? `${t.statusMinerFailed}Sepolia network is busy. Waited 2+ minutes. Please check connection and try again later.`
        : message;

      if (!minerReady && alreadyRegistered) {
        try {
          const txHash = await updateHashrateOnChain(finalHashrate);
          await markMinerReady();
          setLastTxHash(txHash);
          setStatus(`${t.statusMinerAlreadyRegistered}${shortHash(txHash)}`);
        } catch (fallbackError) {
          const fallbackMsg = fallbackError instanceof Error ? fallbackError.message : t.statusRecoveryFailed;
          setStatus(`${t.statusRecoveryFailed}${fallbackMsg}`);
        }
      } else {
        setStatus(displayMessage);
      }
    } finally {
      setActiveAction('');
    }
  };

  const claimReward = async () => {
    if (!identityReady) {
      setStatus(t.errIdentityNotReady);
      return;
    }

    if (!minerReady) {
      setStatus(t.errMinerNotReady);
      return;
    }

    setActiveAction('claim');
    setLastTxHash('');
    setStatus(t.statusClaiming);
    try {
      const txHash = await claimRewardOnChain();
      setLastTxHash(txHash);
      setStatus(`${t.statusClaimSuccess}${shortHash(txHash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.statusClaimFailed;
      setStatus(`${t.statusClaimFailed}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const swapSuper = async () => {
    if (!identityReady) {
      setStatus(t.errIdentityNotReady);
      return;
    }

    const parsedAmount = Number(superAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setStatus(t.errInvalidSuperAmount);
      return;
    }

    setActiveAction('swap');
    setLastTxHash('');
    setStatus(t.statusSwapping);
    try {
      const txHash = await swapSuperToUsdtOnChain(superAmount);
      setLastTxHash(txHash);
      setStatus(`${t.statusSwapSuccess}${shortHash(txHash)}`);
      await refreshSwapPrice();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.statusSwapFailed;
      setStatus(`${t.statusSwapFailed}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const transferNativeToken = async () => {
    if (!identityReady) {
      setStatus(t.errIdentityNotReady);
      return;
    }

    if (!isValidEvmAddress(transferTo)) {
      setStatus(t.errInvalidAddress);
      return;
    }

    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus(t.errInvalidAmount);
      return;
    }

    setActiveAction('transfer');
    setLastTxHash('');
    setStatus(t.statusTransferring);
    try {
      const txHash = await sendNativeTokenOnChain(transferTo.trim() as Address, transferAmount);
      setLastTxHash(txHash);
      setStatus(`${t.statusTransferSuccess}${shortHash(txHash)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.statusTransferFailed;
      setStatus(`${t.statusTransferFailed}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{t.appTitle}</Text>
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
              <Text style={styles.langBtnText}>{t.langToggle}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
          <Text style={styles.flowHint}>{flowHint}</Text>

          <View style={styles.stepRow}>
            <View style={[styles.stepTag, identityReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, identityReady && styles.stepTagTextDone]}>{t.stepIdentity}</Text>
            </View>
            <View style={[styles.stepTag, minerReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, minerReady && styles.stepTagTextDone]}>{t.stepMiner}</Text>
            </View>
            <View style={[styles.stepTag, minerReady && styles.stepTagDone]}>
              <Text style={[styles.stepTagText, minerReady && styles.stepTagTextDone]}>{t.stepActions}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.sec1Title}</Text>
            <Text style={styles.label}>{t.labelWallet}</Text>
            <Text style={styles.value}>{walletAddress || t.initializing}</Text>
            {!!walletAddress && <Text style={styles.hint}>{t.short}{shortAddress}</Text>}

            <Text style={styles.label}>{t.labelUserId}</Text>
            <Text style={styles.value}>{userId || t.notInitialized}</Text>

            <Text style={styles.label}>{t.labelDeviceId}</Text>
            <Text style={styles.value}>{deviceId || t.initializing}</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={initializeAccount} disabled={isBusy}>
              <Text style={styles.primaryBtnText}>{t.resyncIdentity}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.sec2Title}</Text>
            <Text style={styles.label}>{t.labelHashrate}</Text>
            <TextInput
              style={styles.input}
              value={hashrateInput}
              onChangeText={setHashrateInput}
              keyboardType="number-pad"
              placeholder={t.phHashrate}
              placeholderTextColor="#475569"
              editable={!isBusy}
            />
            <Text style={styles.hint}>
              {minerHintText}
            </Text>
            <TouchableOpacity
              style={[styles.secondaryBtn, (isBusy || !identityReady) && styles.disabledBtn]}
              onPress={startMining}
              disabled={isBusy || !identityReady}
            >
              <Text style={styles.secondaryBtnText}>{minerReady ? t.btnUpdateHashrate : t.btnRegisterMiner}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.sec3Title}</Text>

            <TouchableOpacity style={styles.secondaryBtn} onPress={claimReward} disabled={isBusy || !identityReady}>
              <Text style={styles.secondaryBtnText}>{t.btnClaimReward}</Text>
            </TouchableOpacity>

            <View style={styles.groupBox}>
              <Text style={styles.label}>{t.labelSuperAmount}</Text>
              <TextInput
                style={styles.input}
                value={superAmount}
                onChangeText={setSuperAmount}
                keyboardType="decimal-pad"
                placeholder={t.phSuperAmount}
                placeholderTextColor="#475569"
                editable={!isBusy}
              />
              <View style={styles.rowBetween}>
                <Text style={styles.hint}>{swapPrice || t.pricePlaceholder}</Text>
                <TouchableOpacity onPress={refreshSwapPrice} disabled={isBusy}>
                  <Text style={styles.refreshText}>{t.refreshPrice}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.secondaryBtn} onPress={swapSuper} disabled={isBusy || !identityReady}>
                <Text style={styles.secondaryBtnText}>{t.btnSwap}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.groupBox}>
              <Text style={styles.label}>{t.labelTransfer}</Text>
              <TextInput
                style={styles.input}
                value={transferTo}
                onChangeText={setTransferTo}
                placeholder={t.phTransferTo}
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
                placeholder={t.phTransferAmount}
                placeholderTextColor="#475569"
                editable={!isBusy}
              />
              <TouchableOpacity style={styles.secondaryBtn} onPress={transferNativeToken} disabled={isBusy || !identityReady}>
                <Text style={styles.secondaryBtnText}>{t.btnTransfer}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#22d3ee" />
              <Text style={styles.loadingText}>{t.processing}</Text>
            </View>
          )}

          {!!lastTxHash && <Text style={styles.txHash}>{t.latestTx}{lastTxHash}</Text>}
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
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  langBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1e293b',
  },
  langBtnText: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '600',
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
  disabledBtn: {
    opacity: 0.55,
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
