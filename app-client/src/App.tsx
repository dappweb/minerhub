import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
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
import BottomNav, { type BottomTab } from './components/mobile/BottomNav';
import DeviceTab from './components/mobile/DeviceTab';
import EarningsTab from './components/mobile/EarningsTab';
import ExchangeTab from './components/mobile/ExchangeTab';
import GuideCard from './components/mobile/GuideCard';
import HomeTab from './components/mobile/HomeTab';
import ProfileTab from './components/mobile/ProfileTab';
import {
    createClaim,
    createGasIntent,
    createUser,
    getGasOrder,
    getGasWalletBalance,
    getSystemStatus,
    getUser,
    getUserByWallet,
    getUserDetails,
    purchaseGasPackage,
    quoteGasPackage,
    registerDevice,
    relayGasIntent,
    reportDeviceHeartbeat,
    type GasPayToken
} from './services/api';
import {
    claimRewardOnChain,
    getSwapPriceOnChain,
    getWalletAddress,
    registerMinerOnChain,
    sendNativeTokenOnChain,
    swapUsdtToSuperOnChain,
    updateHashrateOnChain,
} from './services/blockchain';

type Lang = 'en' | 'zh';

type ActionType = 'init' | 'mine' | 'claim' | 'swap' | 'transfer' | 'gas' | '';
type SwapTxStage = 'idle' | 'submitting' | 'confirming' | 'success' | 'failed';

const LANG_KEY = 'coinplanet.lang';
const DEVICE_ID_KEY = 'coinplanet.device_id';
const MINER_READY_KEY = 'coinplanet.miner_ready';
const USER_ID_KEY = 'coinplanet.user_id';
const SWAP_FEE_RATE = 0.005;
const SWAP_SLIPPAGE_RATE = 0.008;
const INIT_RETRY_DELAY_MS = 8_000;

const translations = {
  en: {
    appTitle: 'Coin Planet',
    subtitle: 'Device Center',
    flow1: 'Finish identity setup to unlock on-chain actions',
    flow2: 'Register miner to start rewards',
    flow3: 'Daily mode: swap and claim rewards',
    profileId: 'ID',
    profileVip: 'VIP',
    profileUnbind: 'Unbind',
    profileExpire: 'Expire Date',
    phoneStatus: 'Phone Status',
    online: 'Online',
    offline: 'Offline',
    hashing: 'AI Hashing in Progress',
    totalOnline: 'Total Online Time',
    monthOnline: 'Current Month Online',
    earningsChart: 'Earnings Trend',
    chartYAxis: 'USDT',
    ruleHint: 'Rewards accrue by online duration and settle according to backend policy.',
    maintenanceTitle: 'Maintenance Mode',
    maintenanceBody: 'System maintenance in progress. Please try again later.',
    swapPanelTitle: 'USDT -> SUPER',
    swapAmount: 'Swap Amount (USDT)',
    swapAmountPlaceholder: 'Enter USDT amount',
    refreshPrice: 'Refresh Price',
    quote: 'Estimated SUPER',
    fee: 'Fee (0.5%)',
    minReceive: 'Minimum Received',
    swapButton: 'Swap Now',
    swapConfirmTitle: 'Confirm Swap',
    swapConfirmHint: 'Please verify amount and estimated receive before submitting.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    txProgressTitle: 'Transaction Progress',
    txSubmit: 'Submitting',
    txConfirming: 'On-chain Confirming',
    txSuccess: 'Completed',
    txFailed: 'Failed',
    quickActions: 'Quick Actions',
    claimReward: 'Claim Reward',
    setupMiner: 'Setup Miner',
    syncIdentity: 'Sync Identity',
    advancedSettings: 'Advanced Settings',
    tabHome: 'Home',
    tabEarnings: 'Rewards',
    tabExchange: 'Swap',
    tabDevice: 'Device',
    tabProfile: 'Me',
    guideTitle: 'Getting Started',
    guideReadyTitle: 'Daily Console Ready',
    guideDescInit: 'Create your local identity first, then unlock on-chain operations and account sync.',
    guideDescMine: 'Activate your miner so rewards and online time can start accruing.',
    guideDescReady: 'Identity and miner are ready. Use the bottom menu for daily rewards and swaps.',
    guideStepIdentity: 'Identity Sync',
    guideStepMiner: 'Miner Activation',
    guideStepReward: 'Rewards & Swap',
    guideStepDone: 'Done',
    guideStepTodo: 'Next',
    guideStepLocked: 'Locked',
    homeOverview: 'Overview',
    homePrimaryAction: 'Next Step',
    rewardsSummary: 'Reward Summary',
    deviceSummary: 'Device Console',
    profileSummary: 'Account Center',
    walletCardTitle: 'Wallet',
    contractExpiredTitle: 'Contract Expired',
    contractExpiredBody: 'Renew or update your contract before rewards can continue.',
    hashrate: 'Hashrate',
    hashratePlaceholder: 'e.g. 2600',
    transferTitle: 'Native Transfer',
    transferTo: 'Destination address 0x...',
    transferAmount: 'Amount (ETH)',
    sendTransfer: 'Send Transfer',
    processing: 'Processing, do not resubmit',
    latestTx: 'Latest Tx: ',
    initStatus: 'Initializing local wallet...',
    initDoing: 'Syncing wallet and backend account...',
    initDone: 'Identity is ready.',
    initFail: 'Initialization failed: ',
    identityNotReady: 'Identity not ready. Please sync identity first.',
    invalidHashrate: 'Please enter a valid hashrate (>0)',
    updateHashrate: 'Updating hashrate on-chain...',
    hashrateUpdated: 'Hashrate updated: ',
    registerMiner: 'Registering miner on-chain...',
    minerRegistered: 'Miner registered: ',
    deviceRecord: ', device record ',
    minerRecovered: 'Miner already exists. Hashrate updated: ',
    minerRecoverFail: 'Miner state recovery failed: ',
    minerFail: 'Miner setup failed: ',
    minerNotReady: 'Please setup miner before claiming reward',
    claimDoing: 'Submitting claim transaction...',
    claimSuccess: 'Claim success: ',
    claimFail: 'Claim failed: ',
    invalidSwapAmount: 'Please enter a valid USDT amount',
    swapDoing: 'Submitting swap transaction...',
    swapSuccess: 'Swap success: ',
    swapFail: 'Swap failed: ',
    invalidAddress: 'Please enter a valid destination address',
    invalidAmount: 'Please enter a valid transfer amount',
    transferDoing: 'Submitting transfer...',
    transferSuccess: 'Transfer success: ',
    transferFail: 'Transfer failed: ',
    errInsufficientBnb: 'Insufficient BNB for gas. Please top up testnet BNB and try again.',
    errRejected: 'Transaction was cancelled in wallet.',
    errReverted: 'On-chain execution failed. Please check parameters and contract state.',
    errNetwork: 'Network is unstable. Please retry in a moment.',
    gasAssistTitle: 'Gas Booster',
    gasAssistHint: 'No BNB needed. Use SUPER/USDT to buy BNB from treasury and retry automatically.',
    gasTokenLabel: 'Pay token',
    gasAmountLabel: 'Pay amount',
    gasQuoteLabel: 'Estimated BNB',
    gasBalanceLabel: 'Funded BNB (history)',
    gasBuyAndRetry: 'Buy Gas and Retry',
    gasBuying: 'Purchasing gas package...',
    gasReady: 'Gas package completed. Retrying transaction...',
    gasFailed: 'Gas purchase failed: ',
    gasIntentPhase2: 'Phase-2 relay intent registered.',
    priceUnavailable: 'Pool price unavailable',
    priceFetchFailed: 'Failed to fetch pool price',
    priceFormat: (val: string) => `1 USDT ~= ${val} SUPER`,
    langToggle: '中文',
    notInit: 'Not initialized',
    short: 'Short: ',
  },
  zh: {
    appTitle: 'Coin Planet',
    subtitle: '设备中心',
    flow1: '请先完成身份初始化，解锁链上操作',
    flow2: '请先注册矿机，开始计收益',
    flow3: '日常模式：兑换与领取收益',
    profileId: 'ID',
    profileVip: 'VIP',
    profileUnbind: '解绑',
    profileExpire: '到期时间',
    phoneStatus: '手机状态',
    online: '在线',
    offline: '离线',
    hashing: 'AI算力中',
    totalOnline: '当前设备累计时长',
    monthOnline: '当月收益累计时长',
    earningsChart: '收益数据统计',
    chartYAxis: 'USDT',
    ruleHint: '收益按在线时长累计，并按后台策略实时结算。',
    maintenanceTitle: '系统维护中',
    maintenanceBody: '系统正在维护，请稍后再试。',
    swapPanelTitle: 'USDT -> SUPER',
    swapAmount: '兑换数量（USDT）',
    swapAmountPlaceholder: '输入USDT数量',
    refreshPrice: '刷新价格',
    quote: '预计获得',
    fee: '手续费（0.5%）',
    minReceive: '最少到账',
    swapButton: '立即兑换',
    swapConfirmTitle: '确认兑换',
    swapConfirmHint: '请确认兑换数量与预计到账后再提交。',
    cancel: '取消',
    confirm: '确认',
    txProgressTitle: '交易进度',
    txSubmit: '提交交易',
    txConfirming: '链上确认',
    txSuccess: '完成',
    txFailed: '失败',
    quickActions: '快捷操作',
    claimReward: '领取收益',
    setupMiner: '矿机设置',
    syncIdentity: '身份同步',
    advancedSettings: '高级设置',
    tabHome: '首页',
    tabEarnings: '收益',
    tabExchange: '兑换',
    tabDevice: '设备',
    tabProfile: '我的',
    guideTitle: '启动引导',
    guideReadyTitle: '日常控制台已就绪',
    guideDescInit: '先完成本机身份建立，再解锁链上操作与账户同步。',
    guideDescMine: '完成矿机激活后，收益与在线时长才会开始累计。',
    guideDescReady: '身份和矿机都已准备完成，后续可通过底部菜单进入日常收益与兑换。',
    guideStepIdentity: '身份同步',
    guideStepMiner: '矿机激活',
    guideStepReward: '收益与兑换',
    guideStepDone: '完成',
    guideStepTodo: '下一步',
    guideStepLocked: '待解锁',
    homeOverview: '总览',
    homePrimaryAction: '下一步操作',
    rewardsSummary: '收益总览',
    deviceSummary: '设备控制台',
    profileSummary: '账户中心',
    walletCardTitle: '钱包信息',
    contractExpiredTitle: '合约已过期',
    contractExpiredBody: '请先续期或更新合约，之后才能继续累计收益。',
    hashrate: '算力值',
    hashratePlaceholder: '例如 2600',
    transferTitle: '原生代币转账',
    transferTo: '目标地址 0x...',
    transferAmount: '数量（ETH）',
    sendTransfer: '发起转账',
    processing: '处理中，请勿重复提交',
    latestTx: '最新交易：',
    initStatus: '正在初始化本地钱包...',
    initDoing: '正在同步钱包与后端账户...',
    initDone: '身份初始化完成。',
    initFail: '初始化失败：',
    identityNotReady: '身份未就绪，请先同步身份。',
    invalidHashrate: '请输入有效算力值（>0）',
    updateHashrate: '正在提交链上算力更新...',
    hashrateUpdated: '算力已更新：',
    registerMiner: '正在提交链上矿机注册...',
    minerRegistered: '矿机已注册：',
    deviceRecord: '，设备记录 ',
    minerRecovered: '矿机已存在，算力已更新：',
    minerRecoverFail: '矿机状态恢复失败：',
    minerFail: '矿机设置失败：',
    minerNotReady: '请先完成矿机设置，再领取收益',
    claimDoing: '正在提交领取交易...',
    claimSuccess: '领取成功：',
    claimFail: '领取失败：',
    invalidSwapAmount: '请输入有效的USDT数量',
    swapDoing: '正在提交兑换交易...',
    swapSuccess: '兑换成功：',
    swapFail: '兑换失败：',
    invalidAddress: '请输入有效的目标地址',
    invalidAmount: '请输入有效转账数量',
    transferDoing: '正在提交转账...',
    transferSuccess: '转账成功：',
    transferFail: '转账失败：',
    errInsufficientBnb: 'BNB 余额不足，无法支付 Gas。请先补充测试网 BNB。',
    errRejected: '你已在钱包中取消本次交易。',
    errReverted: '链上执行失败，请检查参数或合约状态。',
    errNetwork: '网络不稳定，请稍后重试。',
    gasAssistTitle: 'Gas 补能',
    gasAssistHint: '无需先买 BNB，可用 SUPER/USDT 兑换平台 BNB，并自动重试交易。',
    gasTokenLabel: '支付代币',
    gasAmountLabel: '支付数量',
    gasQuoteLabel: '预计到账 BNB',
    gasBalanceLabel: '累计补能 BNB',
    gasBuyAndRetry: '兑换并重试',
    gasBuying: '正在购买 Gas 包...',
    gasReady: 'Gas 包购买完成，正在重试交易...',
    gasFailed: 'Gas 兑换失败：',
    gasIntentPhase2: '二期 Relay 意图已登记。',
    priceUnavailable: '池子价格不可用',
    priceFetchFailed: '获取池子价格失败',
    priceFormat: (val: string) => `1 USDT ≈ ${val} SUPER`,
    langToggle: 'English',
    notInit: '未初始化',
    short: '简短：',
  },
} as const;

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

function formatDuration(totalMinutes: number, lang: Lang) {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const minutes = safe % 60;

  if (lang === 'zh') {
    return `${days}天${hours}小时${minutes}分`;
  }
  return `${days}d ${hours}h ${minutes}m`;
}

function formatDate(input: Date) {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, '0');
  const d = `${input.getDate()}`.padStart(2, '0');
  return `${y}.${m}.${d}`;
}

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [swapAmount, setSwapAmount] = useState<string>('10');
  const [transferTo, setTransferTo] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('0.001');
  const [hashrateInput, setHashrateInput] = useState<string>('1000');
  const [deviceId, setDeviceId] = useState<string>('');
  const [minerReady, setMinerReady] = useState<boolean>(false);
  const [status, setStatus] = useState<string>('');
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionType>('');
  const [swapPriceValue, setSwapPriceValue] = useState<number | null>(null);
  const [lang, setLang] = useState<Lang>('zh');
  const [activeTab, setActiveTab] = useState<BottomTab>('home');
  const [swapConfirmVisible, setSwapConfirmVisible] = useState(false);
  const [swapTxStage, setSwapTxStage] = useState<SwapTxStage>('idle');
  const [gasAssistVisible, setGasAssistVisible] = useState(false);
  const [gasPayToken, setGasPayToken] = useState<GasPayToken>('SUPER');
  const [gasPayAmount, setGasPayAmount] = useState<string>('10');
  const [gasQuoteBnb, setGasQuoteBnb] = useState<string>('0');
  const [gasFundedBnbTotal, setGasFundedBnbTotal] = useState<string>('0');
  const [phase2IntentId, setPhase2IntentId] = useState<string>('');
  const [systemStatus, setSystemStatus] = useState<Awaited<ReturnType<typeof getSystemStatus>> | null>(null);
  const [userDetails, setUserDetails] = useState<Awaited<ReturnType<typeof getUserDetails>> | null>(null);
  const swapConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);
  const retryActionNameRef = useRef<ActionType>('');

  const t = translations[lang];
  const isBusy = activeAction !== '';
  const identityReady = Boolean(walletAddress && userId && deviceId);
  const maintenanceEnabled = Boolean(systemStatus?.maintenanceEnabled);
  const contractExpired = Boolean(userDetails?.contractEndAt && new Date(userDetails.contractEndAt).getTime() < Date.now());
  const actionsBlocked = maintenanceEnabled || contractExpired;

  const isInsufficientBnbError = (message: string) => {
    const msg = message.toLowerCase();
    return msg.includes('insufficient bnb') || msg.includes('insufficient funds') || msg.includes('exceeds the balance');
  };

  const toFriendlyErrorMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : '';
    const msg = raw.toLowerCase();

    if (msg.includes('insufficient bnb') || msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
      return t.errInsufficientBnb;
    }
    if (msg.includes('user rejected') || msg.includes('rejected') || msg.includes('denied')) {
      return t.errRejected;
    }
    if (msg.includes('reverted')) {
      return t.errReverted;
    }
    if (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('api unavailable')
    ) {
      return t.errNetwork;
    }

    if (!raw) {
      return t.errNetwork;
    }

    return raw.split('\n').find((line) => line.trim())?.trim() ?? raw;
  };

  const shortAddress = useMemo(() => {
    if (!walletAddress) return t.notInit;
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress, t.notInit]);

  const flowHint = useMemo(() => {
    if (!identityReady) return t.flow1;
    if (!minerReady) return t.flow2;
    return t.flow3;
  }, [identityReady, minerReady, t.flow1, t.flow2, t.flow3]);

  const displayId = useMemo(() => {
    if (!userId) return '----';
    return userId.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0');
  }, [userId]);

  const expireDate = useMemo(() => {
    if (!userDetails?.contractEndAt) {
      return '----';
    }

    const end = new Date(userDetails.contractEndAt);
    if (Number.isNaN(end.getTime())) {
      return '----';
    }

    return formatDate(end);
  }, [userDetails?.contractEndAt]);

  const monthProgressMinutes = useMemo(() => {
    const hashrateNum = Number(hashrateInput);
    if (!Number.isFinite(hashrateNum) || hashrateNum <= 0) {
      return 443;
    }
    return Math.min(24 * 60 * 30, Math.floor(hashrateNum * 0.42));
  }, [hashrateInput]);

  const totalOnlineMinutes = useMemo(() => monthProgressMinutes + 11053, [monthProgressMinutes]);
  const onlineState = identityReady ? t.online : t.offline;

  const swapInputNumber = Number(swapAmount);
  const hasValidSwapInput = Number.isFinite(swapInputNumber) && swapInputNumber > 0;

  const estimatedSuper = useMemo(() => {
    if (!hasValidSwapInput || !swapPriceValue || swapPriceValue <= 0) {
      return 0;
    }
    return swapInputNumber * swapPriceValue;
  }, [hasValidSwapInput, swapInputNumber, swapPriceValue]);

  const feeUsdt = useMemo(() => {
    if (!hasValidSwapInput) return 0;
    return swapInputNumber * SWAP_FEE_RATE;
  }, [hasValidSwapInput, swapInputNumber]);

  const minReceiveSuper = useMemo(() => {
    if (estimatedSuper <= 0) return 0;
    return estimatedSuper * (1 - SWAP_SLIPPAGE_RATE);
  }, [estimatedSuper]);

  const swapPriceText = useMemo(() => {
    if (!swapPriceValue || swapPriceValue <= 0) {
      return t.priceUnavailable;
    }
    return t.priceFormat(swapPriceValue.toFixed(6));
  }, [swapPriceValue, t]);

  const txStageLabels = useMemo(
    () => ({
      submitting: t.txSubmit,
      confirming: t.txConfirming,
      success: t.txSuccess,
      failed: t.txFailed,
    }),
    [t.txSubmit, t.txConfirming, t.txSuccess, t.txFailed]
  );

  const chartValues = useMemo(() => {
    const base = Math.max(800, Math.floor(monthProgressMinutes * 1.6));
    return [
      Math.floor(base * 0.46),
      Math.floor(base * 0.62),
      Math.floor(base * 0.51),
      Math.floor(base * 0.75),
      Math.floor(base * 0.68),
      Math.floor(base * 0.89),
    ];
  }, [monthProgressMinutes]);

  const chartMax = Math.max(...chartValues, 1);
  const totalRewardUsdt = Number(userDetails?.totalRewardUsdt ?? '0');
  const totalRewardSuper = Number(userDetails?.totalRewardSuper ?? '0');

  const refreshGasFundedBalance = async (wallet: string) => {
    const balance = await getGasWalletBalance(wallet);
    if (!balance) return;
    setGasFundedBnbTotal(balance.total_bnb_funded ?? '0');
  };

  const openGasAssist = (actionName: ActionType, retryAction: () => Promise<void>, message?: string) => {
    retryActionRef.current = retryAction;
    retryActionNameRef.current = actionName;
    if (message) {
      setStatus(message);
    }
    setGasAssistVisible(true);
  };

  const refreshGasQuote = async (wallet: string, token: GasPayToken, amount: string) => {
    const quote = await quoteGasPackage({
      wallet,
      payToken: token,
      payAmount: amount,
    });
    setGasQuoteBnb(quote.estimatedBnb);
    return quote;
  };

  const buyGasAndRetry = async () => {
    if (!walletAddress) return;

    const payAmountNum = Number(gasPayAmount);
    if (!Number.isFinite(payAmountNum) || payAmountNum <= 0) {
      setStatus(`${t.gasFailed}${lang === 'zh' ? '请输入有效的兑换数量。' : 'Please enter a valid gas purchase amount.'}`);
      return;
    }

    setActiveAction('gas');
    setStatus(t.gasBuying);

    try {
      const quote = await refreshGasQuote(walletAddress, gasPayToken, gasPayAmount);
      const order = await purchaseGasPackage({
        quoteId: quote.quoteId,
        wallet: walletAddress,
        userId,
      });

      const orderId = order.orderId ?? order.id;
      if (!orderId) {
        throw new Error('Gas order ID missing');
      }

      const finalOrder = await getGasOrder(orderId);
      const finalStatus = finalOrder?.status ?? order.status;
      if (finalStatus !== 'done') {
        throw new Error(finalOrder?.errorMessage ?? finalOrder?.error_message ?? 'Gas order failed');
      }

      // Phase-2 relay intent (MVP placeholder): record user intent for gasless workflow telemetry.
      const intent = await createGasIntent({
        wallet: walletAddress,
        userId,
        payToken: gasPayToken,
        maxTokenSpend: gasPayAmount,
        action: retryActionNameRef.current || 'unknown',
        actionPayload: { source: 'app-gas-assist' },
      });

      const intentId = intent.intentId ?? intent.id;
      if (intentId) {
        setPhase2IntentId(intentId);
        await relayGasIntent({ intentId, wallet: walletAddress });
      }

      await refreshGasFundedBalance(walletAddress);
      setStatus(`${t.gasReady}${intentId ? ` ${t.gasIntentPhase2}` : ''}`);
      setGasAssistVisible(false);

      const retryAction = retryActionRef.current;
      if (retryAction) {
        retryActionRef.current = null;
        await retryAction();
      }
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      setStatus(`${t.gasFailed}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const toggleLang = async () => {
    const next: Lang = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    try {
      await AsyncStorage.setItem(LANG_KEY, next);
    } catch {
      // ignore
    }
  };

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

  useEffect(() => {
    return () => {
      if (swapConfirmTimerRef.current) {
        clearTimeout(swapConfirmTimerRef.current);
      }
      if (initRetryTimerRef.current) {
        clearTimeout(initRetryTimerRef.current);
      }
    };
  }, []);

  const markMinerReady = async () => {
    setMinerReady(true);
    try {
      await AsyncStorage.setItem(MINER_READY_KEY, '1');
    } catch {
      // ignore
    }
  };

  const refreshSwapPrice = async () => {
    try {
      const price = await getSwapPriceOnChain();
      const parsed = Number(price) / 1e18;
      if (Number.isFinite(parsed) && parsed > 0) {
        setSwapPriceValue(parsed);
      } else {
        setSwapPriceValue(null);
      }
    } catch {
      setSwapPriceValue(null);
      setStatus(t.priceFetchFailed);
    }
  };

  const clearSwapConfirmTimer = () => {
    if (swapConfirmTimerRef.current) {
      clearTimeout(swapConfirmTimerRef.current);
      swapConfirmTimerRef.current = null;
    }
  };

  const initializeAccount = async () => {
    if (initRetryTimerRef.current) {
      clearTimeout(initRetryTimerRef.current);
      initRetryTimerRef.current = null;
    }

    setActiveAction('init');
    setLastTxHash('');
    setStatus(t.initDoing);

    try {
      const status = await getSystemStatus();
      setSystemStatus(status);

      const address = await getWalletAddress();
      setWalletAddress(address);

      // 1. 先尝试从本地缓存恢复 userId
      const cachedUserId = await AsyncStorage.getItem(USER_ID_KEY).catch(() => null);
      if (cachedUserId) {
        const existing = await getUser(cachedUserId);
        if (existing) {
          setUserId(existing.id);
          const details = await getUserDetails(existing.id);
          setUserDetails(details);
          await refreshSwapPrice();
          setStatus(t.initDone);
          return;
        }
      }

      // 2. 本地无缓存或服务端已不存在，尝试按钱包地址查找
      const existingByWallet = await getUserByWallet(address);
      if (existingByWallet) {
        setUserId(existingByWallet.id);
        await AsyncStorage.setItem(USER_ID_KEY, existingByWallet.id).catch(() => null);
        const details = await getUserDetails(existingByWallet.id);
        setUserDetails(details);
        await refreshSwapPrice();
        setStatus(t.initDone);
        return;
      }

      // 3. 全新用户，注册并持久化
      const user = await createUser(address);
      setUserId(user.id);
      await AsyncStorage.setItem(USER_ID_KEY, user.id).catch(() => null);
      const details = await getUserDetails(user.id);
      setUserDetails(details);
      await refreshSwapPrice();
      setStatus(t.initDone);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.initFail;
      const lower = message.toLowerCase();
      const isNetworkIssue =
        lower.includes('network request failed') ||
        lower.includes('failed to fetch') ||
        lower.includes('api request timeout') ||
        lower.includes('api unavailable') ||
        lower.includes('timeout');

      if (isNetworkIssue) {
        const retryHint = lang === 'zh' ? '（网络异常，8秒后自动重试）' : ' (Network issue, auto retry in 8s)';
        setStatus(`${t.initFail}${message}${retryHint}`);
        initRetryTimerRef.current = setTimeout(() => {
          void initializeAccount();
        }, INIT_RETRY_DELAY_MS);
      } else {
        setStatus(`${t.initFail}${message}`);
      }
    } finally {
      setActiveAction('');
    }
  };

  useEffect(() => {
    if (!deviceId) return;
    setStatus(translations[lang].initStatus);
    void initializeAccount();
  }, [deviceId]);

  useEffect(() => {
    if (!walletAddress) return;
    void refreshGasFundedBalance(walletAddress);
    void refreshGasQuote(walletAddress, gasPayToken, gasPayAmount).catch(() => null);
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;
    void refreshGasQuote(walletAddress, gasPayToken, gasPayAmount).catch(() => null);
  }, [walletAddress, gasPayToken, gasPayAmount]);

  useEffect(() => {
    if (!walletAddress || !userId || !deviceId) return;

    const sendHeartbeat = async () => {
      const hashrateNum = Number(hashrateInput);
      await reportDeviceHeartbeat({
        deviceId,
        userId,
        wallet: walletAddress,
        status: 'active',
        hashrate: Number.isFinite(hashrateNum) ? Math.max(0, Math.floor(hashrateNum)) : 0,
      });
      const details = await getUserDetails(userId);
      setUserDetails(details);
    };

    void sendHeartbeat();
    const timer = setInterval(() => {
      void sendHeartbeat();
    }, 60_000);

    return () => {
      clearInterval(timer);
    };
  }, [walletAddress, userId, deviceId, hashrateInput]);

  const startMining = async () => {
    if (!identityReady) {
      setStatus(t.identityNotReady);
      return;
    }

    if (actionsBlocked) {
      setStatus(maintenanceEnabled ? `${t.maintenanceTitle}: ${systemStatus?.maintenanceMessageZh ?? t.maintenanceBody}` : `${t.profileExpire}: ${expireDate}`);
      return;
    }

    const parsedHashrate = Number(hashrateInput);
    if (!Number.isFinite(parsedHashrate) || parsedHashrate <= 0) {
      setStatus(t.invalidHashrate);
      return;
    }

    setActiveAction('mine');
    setLastTxHash('');
    const finalHashrate = Math.floor(parsedHashrate);

    try {
      if (minerReady) {
        setStatus(t.updateHashrate);
        const txHash = await updateHashrateOnChain(finalHashrate);
        setLastTxHash(txHash);
        setStatus(`${t.hashrateUpdated}${shortHash(txHash)}`);
        return;
      }

      setStatus(t.registerMiner);
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
      setStatus(`${t.minerRegistered}${shortHash(txHash)}${t.deviceRecord}${device.id}`);
      const details = await getUserDetails(userId);
      setUserDetails(details);
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      const lower = message.toLowerCase();
      const alreadyRegistered = lower.includes('already') && lower.includes('register');

      if (!minerReady && alreadyRegistered) {
        try {
          const txHash = await updateHashrateOnChain(finalHashrate);
          await markMinerReady();
          setLastTxHash(txHash);
          setStatus(`${t.minerRecovered}${shortHash(txHash)}`);
        } catch (fallbackError) {
          const fallbackMsg = toFriendlyErrorMessage(fallbackError);
          setStatus(`${t.minerRecoverFail}${fallbackMsg}`);
        }
      } else {
        if (isInsufficientBnbError(message)) {
          openGasAssist('mine', () => startMining(), `${t.minerFail}${message}`);
          return;
        }
        setStatus(`${t.minerFail}${message}`);
      }
    } finally {
      setActiveAction('');
    }
  };

  const claimReward = async () => {
    if (!identityReady) {
      setStatus(t.identityNotReady);
      return;
    }

    if (actionsBlocked) {
      setStatus(maintenanceEnabled ? `${t.maintenanceTitle}: ${systemStatus?.maintenanceMessageZh ?? t.maintenanceBody}` : `${t.profileExpire}: ${expireDate}`);
      return;
    }

    if (!minerReady) {
      setStatus(t.minerNotReady);
      return;
    }

    setActiveAction('claim');
    setLastTxHash('');
    setStatus(t.claimDoing);

    try {
      const txHash = await claimRewardOnChain();
      setLastTxHash(txHash);
      setStatus(`${t.claimSuccess}${shortHash(txHash)}`);
      const details = await getUserDetails(userId);
      setUserDetails(details);
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        openGasAssist('claim', () => claimReward(), `${t.claimFail}${message}`);
        return;
      }
      setStatus(`${t.claimFail}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const openSwapConfirm = () => {
    if (!identityReady) {
      setStatus(t.identityNotReady);
      return;
    }

    if (!hasValidSwapInput) {
      setStatus(t.invalidSwapAmount);
      return;
    }

    setSwapConfirmVisible(true);
  };

  const swapUsdt = async () => {
    setSwapConfirmVisible(false);

    setActiveAction('swap');
    setLastTxHash('');
    setSwapTxStage('submitting');
    setStatus(t.swapDoing);

    clearSwapConfirmTimer();
    swapConfirmTimerRef.current = setTimeout(() => {
      setSwapTxStage((prev) => (prev === 'submitting' ? 'confirming' : prev));
    }, 1200);

    try {
      const txHash = await swapUsdtToSuperOnChain(swapAmount);
      clearSwapConfirmTimer();
      setLastTxHash(txHash);
      setSwapTxStage('success');
      setStatus(`${t.swapSuccess}${shortHash(txHash)}`);
      await refreshSwapPrice();
    } catch (error) {
      clearSwapConfirmTimer();
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        openGasAssist('swap', () => swapUsdt(), `${t.swapFail}${message}`);
        return;
      }
      setSwapTxStage('failed');
      setStatus(`${t.swapFail}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const transferNativeToken = async () => {
    if (!identityReady) {
      setStatus(t.identityNotReady);
      return;
    }

    if (!isValidEvmAddress(transferTo)) {
      setStatus(t.invalidAddress);
      return;
    }

    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus(t.invalidAmount);
      return;
    }

    setActiveAction('transfer');
    setLastTxHash('');
    setStatus(t.transferDoing);

    try {
      const txHash = await sendNativeTokenOnChain(transferTo.trim() as Address, transferAmount);
      setLastTxHash(txHash);
      setStatus(`${t.transferSuccess}${shortHash(txHash)}`);
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        openGasAssist('transfer', () => transferNativeToken(), `${t.transferFail}${message}`);
        return;
      }
      setStatus(`${t.transferFail}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  const guideTitle = identityReady && minerReady ? t.guideReadyTitle : t.guideTitle;
  const guideDescription = !identityReady
    ? t.guideDescInit
    : !minerReady
      ? t.guideDescMine
      : contractExpired
        ? t.contractExpiredBody
        : t.guideDescReady;
  const guideCtaLabel = !identityReady
    ? t.syncIdentity
    : !minerReady
      ? t.setupMiner
      : t.claimReward;
  const guideAction = !identityReady
    ? initializeAccount
    : !minerReady
      ? startMining
      : claimReward;
  const guideSteps = [
    {
      key: 'identity',
      label: t.guideStepIdentity,
      status: identityReady ? t.guideStepDone : t.guideStepTodo,
      active: !identityReady,
      complete: identityReady,
    },
    {
      key: 'miner',
      label: t.guideStepMiner,
      status: minerReady ? t.guideStepDone : identityReady ? t.guideStepTodo : t.guideStepLocked,
      active: identityReady && !minerReady,
      complete: minerReady,
    },
    {
      key: 'reward',
      label: t.guideStepReward,
      status: identityReady && minerReady ? t.guideStepTodo : t.guideStepLocked,
      active: identityReady && minerReady,
      complete: false,
    },
  ];
  const bottomTabs: Array<{ key: BottomTab; label: string }> = [
    { key: 'home', label: t.tabHome },
    { key: 'earnings', label: t.tabEarnings },
    { key: 'exchange', label: t.tabExchange },
    { key: 'device', label: t.tabDevice },
    { key: 'profile', label: t.tabProfile },
  ];

  if (maintenanceEnabled) {
    const title = lang === 'zh' ? '系统维护中' : 'Maintenance Mode';
    const body = lang === 'zh'
      ? systemStatus?.maintenanceMessageZh ?? '系统正在维护，请稍后再试。'
      : systemStatus?.maintenanceMessageEn ?? 'System maintenance in progress. Please try again later.';

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.maintenanceWrap}>
          <Text style={styles.maintenanceTitle}>{title}</Text>
          <Text style={styles.maintenanceBody}>{body}</Text>
          <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
            <Text style={styles.langBtnText}>{t.langToggle}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.mainShell}>
        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>{t.appTitle}</Text>
              <Text style={styles.subtitle}>{activeTab === 'home' ? t.subtitle : flowHint}</Text>
            </View>
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
              <Text style={styles.langBtnText}>{t.langToggle}</Text>
            </TouchableOpacity>
          </View>

          <GuideCard
            title={guideTitle}
            description={guideDescription}
            buttonLabel={contractExpired ? t.contractExpiredTitle : guideCtaLabel}
            disabled={isBusy || contractExpired}
            steps={guideSteps}
            onPress={guideAction}
          />

          {activeTab === 'home' && (
            <HomeTab
              displayId={displayId}
              expireDate={expireDate}
              walletAddress={walletAddress}
              shortAddress={shortAddress}
              onlineState={onlineState}
              identityReady={identityReady}
              isBusy={isBusy}
              contractExpired={contractExpired}
              totalOnlineMinutes={totalOnlineMinutes}
              monthProgressMinutes={monthProgressMinutes}
              lang={lang}
              guideCtaLabel={guideCtaLabel}
              guideAction={guideAction}
              setActiveTab={setActiveTab}
              t={t}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsTab
              totalRewardUsdt={totalRewardUsdt}
              totalRewardSuper={totalRewardSuper}
              isBusy={isBusy}
              identityReady={identityReady}
              chartValues={chartValues}
              chartMax={chartMax}
              claimReward={claimReward}
              t={t}
            />
          )}

          {activeTab === 'exchange' && (
            <ExchangeTab
              swapAmount={swapAmount}
              setSwapAmount={setSwapAmount}
              swapPriceText={swapPriceText}
              estimatedSuper={estimatedSuper}
              feeUsdt={feeUsdt}
              minReceiveSuper={minReceiveSuper}
              isBusy={isBusy}
              identityReady={identityReady}
              swapTxStage={swapTxStage}
              gasFundedBnbTotal={gasFundedBnbTotal}
              phase2IntentId={phase2IntentId}
              refreshSwapPrice={refreshSwapPrice}
              openSwapConfirm={openSwapConfirm}
              openGasAssist={openGasAssist}
              txStageLabels={txStageLabels}
              t={t}
            />
          )}

          {activeTab === 'device' && (
            <DeviceTab
              onlineState={onlineState}
              deviceId={deviceId}
              hashrateInput={hashrateInput}
              setHashrateInput={setHashrateInput}
              isBusy={isBusy}
              identityReady={identityReady}
              startMining={startMining}
              initializeAccount={initializeAccount}
              t={t}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              walletAddress={walletAddress}
              expireDate={expireDate}
              contractExpired={contractExpired}
              transferTo={transferTo}
              setTransferTo={setTransferTo}
              transferAmount={transferAmount}
              setTransferAmount={setTransferAmount}
              isBusy={isBusy}
              identityReady={identityReady}
              transferNativeToken={transferNativeToken}
              t={t}
            />
          )}

          {isBusy && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#7dd3fc" />
              <Text style={styles.loadingText}>{t.processing}</Text>
            </View>
          )}

          {!!lastTxHash && <Text style={styles.txHash}>{t.latestTx}{lastTxHash}</Text>}
          <Text style={styles.statusText}>{status}</Text>
        </ScrollView>

        <BottomNav activeTab={activeTab} tabs={bottomTabs} onChange={setActiveTab} />
      </View>

      <Modal
        visible={gasAssistVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGasAssistVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setGasAssistVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.gasAssistTitle}</Text>
            <Text style={styles.modalHint}>{t.gasAssistHint}</Text>

            <Text style={styles.label}>{t.gasTokenLabel}</Text>
            <View style={styles.gasTokenRow}>
              <TouchableOpacity
                style={[styles.gasTokenBtn, gasPayToken === 'SUPER' && styles.gasTokenBtnActive]}
                onPress={() => setGasPayToken('SUPER')}
              >
                <Text style={styles.gasTokenBtnText}>SUPER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.gasTokenBtn, gasPayToken === 'USDT' && styles.gasTokenBtnActive]}
                onPress={() => setGasPayToken('USDT')}
              >
                <Text style={styles.gasTokenBtnText}>USDT</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>{t.gasAmountLabel}</Text>
            <TextInput
              style={styles.input}
              value={gasPayAmount}
              onChangeText={setGasPayAmount}
              keyboardType="decimal-pad"
              placeholder="10"
              placeholderTextColor="#93a9d1"
              editable={!isBusy}
            />

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.gasQuoteLabel}</Text>
              <Text style={styles.modalValue}>{gasQuoteBnb} BNB</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setGasAssistVisible(false)}>
                <Text style={styles.modalGhostBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={buyGasAndRetry}>
                <Text style={styles.modalPrimaryBtnText}>{t.gasBuyAndRetry}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={swapConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwapConfirmVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setSwapConfirmVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.swapConfirmTitle}</Text>
            <Text style={styles.modalHint}>{t.swapConfirmHint}</Text>

            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.swapAmount}</Text>
              <Text style={styles.modalValue}>{swapAmount || '0'} USDT</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.quote}</Text>
              <Text style={styles.modalValue}>{estimatedSuper.toFixed(6)} SUPER</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.fee}</Text>
              <Text style={styles.modalValue}>{feeUsdt.toFixed(6)} USDT</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.minReceive}</Text>
              <Text style={styles.modalValue}>{minReceiveSuper.toFixed(6)} SUPER</Text>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setSwapConfirmVisible(false)}>
                <Text style={styles.modalGhostBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={swapUsdt}>
                <Text style={styles.modalPrimaryBtnText}>{t.confirm}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030b1d',
  },
  maintenanceWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  maintenanceTitle: {
    color: '#ecfeff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  maintenanceBody: {
    color: '#9cc6ff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingBottom: 32,
    gap: 10,
  },
  mainShell: {
    flex: 1,
  },
  mainScroll: {
    flex: 1,
  },
  headerRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#ecfeff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: '#9cc6ff',
    marginTop: -2,
    fontSize: 14,
  },
  langBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a6fb8',
    backgroundColor: '#0e2d62',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  langBtnText: {
    color: '#d9f9ff',
    fontSize: 12,
    fontWeight: '700',
  },
  flowHint: {
    color: '#87d9ff',
    fontSize: 12,
    marginBottom: 2,
  },
  guideCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2e90d1',
    backgroundColor: '#071d44',
    padding: 14,
    gap: 14,
  },
  guideHeaderMain: {
    flex: 1,
    gap: 6,
    paddingRight: 12,
  },
  guideTitle: {
    color: '#ecfeff',
    fontSize: 20,
    fontWeight: '800',
  },
  guideBody: {
    color: '#9cc6ff',
    fontSize: 13,
    lineHeight: 19,
  },
  guidePrimaryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#22d3ee',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  guidePrimaryBtnText: {
    color: '#083344',
    fontSize: 13,
    fontWeight: '800',
  },
  guideStepsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  guideStepItem: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#184680',
    backgroundColor: '#082754',
    padding: 10,
    gap: 6,
  },
  guideStepBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1f3e70',
  },
  guideStepBadgeDone: {
    backgroundColor: '#14532d',
  },
  guideStepBadgeActive: {
    backgroundColor: '#0f766e',
  },
  guideStepBadgeText: {
    color: '#dffaff',
    fontSize: 11,
    fontWeight: '800',
  },
  guideStepLabel: {
    color: '#effbff',
    fontSize: 12,
    fontWeight: '700',
  },
  guideStepStatus: {
    color: '#90c8ff',
    fontSize: 11,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d7bc4',
    backgroundColor: '#0b45a1',
    padding: 14,
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileId: {
    color: '#f0fbff',
    fontSize: 22,
    fontWeight: '800',
  },
  vipTag: {
    color: '#ffd6ee',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#7f1d63',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  unbindText: {
    color: '#d5f4ff',
    fontSize: 13,
    fontWeight: '600',
  },
  profileExpire: {
    color: '#c8ebff',
    fontSize: 13,
  },
  walletText: {
    color: '#effbff',
    fontSize: 12,
    fontWeight: '600',
  },
  walletHint: {
    color: '#96cfff',
    fontSize: 12,
  },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f4f96',
    backgroundColor: '#08306f',
    padding: 14,
    gap: 8,
  },
  statusTitle: {
    color: '#e6f4ff',
    fontSize: 19,
    fontWeight: '700',
  },
  dotPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dotOnline: {
    backgroundColor: '#0f766e',
  },
  dotOffline: {
    backgroundColor: '#475569',
  },
  dotPillText: {
    color: '#ecfeff',
    fontSize: 12,
    fontWeight: '700',
  },
  hashingText: {
    color: '#b8ecff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2a63',
    padding: 12,
    gap: 6,
  },
  metricValue: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#9eceff',
    fontSize: 12,
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2554',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#e9f8ff',
    fontSize: 17,
    fontWeight: '800',
  },
  chartAxis: {
    color: '#9cc6ff',
    fontSize: 11,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 126,
    paddingTop: 4,
  },
  barWrap: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#0a1a3d',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#38bdf8',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  ruleHint: {
    color: '#9ec8ff',
    fontSize: 12,
    lineHeight: 18,
  },
  swapCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#36a7ff',
    backgroundColor: '#0a3a7f',
    padding: 14,
    gap: 10,
  },
  refreshText: {
    color: '#d6f6ff',
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    color: '#bcdcff',
    fontSize: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f77bc',
    backgroundColor: '#062656',
    color: '#e8fbff',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hint: {
    color: '#b8dcff',
    fontSize: 12,
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#072f67',
    padding: 10,
    gap: 8,
  },
  previewLabel: {
    color: '#b7dbff',
    fontSize: 12,
  },
  previewValue: {
    color: '#f0fdff',
    fontSize: 13,
    fontWeight: '700',
  },
  primarySwapBtn: {
    borderRadius: 12,
    backgroundColor: '#22d3ee',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  primarySwapBtnText: {
    color: '#083344',
    fontSize: 16,
    fontWeight: '800',
  },
  txStageCard: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#072f67',
    padding: 10,
    gap: 10,
  },
  txStageTitle: {
    color: '#d7f3ff',
    fontSize: 12,
    fontWeight: '700',
  },
  txStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txStageItem: {
    alignItems: 'center',
    gap: 4,
    width: 82,
  },
  txDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#31557f',
  },
  txDotActive: {
    backgroundColor: '#38bdf8',
  },
  txDotSuccess: {
    backgroundColor: '#22c55e',
  },
  txDotFailed: {
    backgroundColor: '#ef4444',
  },
  txStageLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#31557f',
    marginHorizontal: 4,
  },
  txStageLineActive: {
    backgroundColor: '#38bdf8',
  },
  txStageText: {
    color: '#b7dbff',
    fontSize: 11,
    textAlign: 'center',
  },
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2554',
    padding: 14,
    gap: 10,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#143e7a',
    borderWidth: 1,
    borderColor: '#3f77bc',
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#dbf4ff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 10,
    backgroundColor: '#184680',
    borderWidth: 1,
    borderColor: '#3f77bc',
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryBtnText: {
    color: '#dbf4ff',
    fontSize: 14,
    fontWeight: '700',
  },
  gasInfoBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 10,
    gap: 8,
  },
  gasInfoText: {
    color: '#cde8ff',
    fontSize: 12,
    fontWeight: '700',
  },
  gasInfoHint: {
    color: '#8dc6ff',
    fontSize: 11,
  },
  statusCardCompact: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 12,
    gap: 6,
  },
  expiredBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#3f0d17',
    padding: 10,
    gap: 4,
    marginTop: 6,
  },
  expiredBannerTitle: {
    color: '#ffe4e6',
    fontSize: 13,
    fontWeight: '800',
  },
  expiredBannerBody: {
    color: '#fecdd3',
    fontSize: 12,
    lineHeight: 18,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  loadingText: {
    color: '#a9def9',
    fontSize: 12,
  },
  txHash: {
    color: '#dbecff',
    fontSize: 12,
  },
  statusText: {
    color: '#b4d9ff',
    fontSize: 12,
    lineHeight: 18,
    paddingBottom: 8,
  },
  disabledBtn: {
    opacity: 0.55,
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    justifyContent: 'center',
    padding: 18,
  },
  modalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#082a5d',
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    color: '#ecfeff',
    fontSize: 18,
    fontWeight: '800',
  },
  modalHint: {
    color: '#b6dcff',
    fontSize: 12,
    lineHeight: 18,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalLabel: {
    color: '#a9d3ff',
    fontSize: 12,
  },
  modalValue: {
    color: '#ebfbff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  gasTokenRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  gasTokenBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f77bc',
    backgroundColor: '#0a2f66',
    alignItems: 'center',
    paddingVertical: 10,
  },
  gasTokenBtnActive: {
    borderColor: '#22d3ee',
    backgroundColor: '#0a4f78',
  },
  gasTokenBtnText: {
    color: '#e3f7ff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalGhostBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#0a2f66',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalGhostBtnText: {
    color: '#d8f4ff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#22d3ee',
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalPrimaryBtnText: {
    color: '#083344',
    fontSize: 14,
    fontWeight: '800',
  },
  bottomNavWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: '#123565',
    backgroundColor: '#05142f',
  },
  bottomNavItem: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#0a2148',
  },
  bottomNavItemActive: {
    backgroundColor: '#0b45a1',
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  bottomNavLabel: {
    color: '#8fc8ff',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavLabelActive: {
    color: '#ecfeff',
  },
}
);