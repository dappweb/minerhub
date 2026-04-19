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
import OnboardingFlow from './components/mobile/OnboardingFlow';
import ProfileTab from './components/mobile/ProfileTab';
import {
    acceptUserAgreement,
    createClaim,
    createGasIntent,
    createUser,
    getAnnouncements,
    getGasOrder,
    getGasWalletBalance,
    getSystemStatus,
    getUser,
    getUserByWallet,
    getUserDetails,
    markAnnouncementRead as markAnnouncementReadApi,
    purchaseGasPackage,
    quoteGasPackage,
    registerDevice,
    relayGasIntent,
    reportDeviceHeartbeat,
    type AnnouncementDto,
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
const AGREEMENT_ACCEPTED_KEY = 'coinplanet.agreement_accepted_version';
const ONBOARDING_COMPLETED_KEY = 'coinplanet.onboarding_completed_v1';
const ANNOUNCEMENT_READ_KEY = 'coinplanet.announcements.read_ids';
const SWAP_FEE_RATE = 0.005;
const SWAP_SLIPPAGE_RATE = 0.008;
const INIT_RETRY_DELAY_MS = 8_000;

const translations = {
  en: {
    appTitle: 'Coin Planet',
    subtitle: 'Device Center · BNB Smart Chain',
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
    marketStatusTitle: 'Market Yield Status',
    marketTrendLabel: 'Market Trend',
    marketRiskLabel: 'Risk Level',
    rewardTokenTitle: 'Reward Token',
    totalRewardLabel: 'Total Reward',
    todayRewardLabel: 'Today Reward',
    claimableRewardLabel: 'Estimated Claimable',
    yieldRateTitle: 'Yield Rate',
    rewardRatePerHourLabel: 'Base Rate',
    rewardRateDailyChangeLabel: '24h Change',
    earningsCurveTitle: 'Earnings Curve',
    range7dLabel: '7D',
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
    errClaimCooldown: 'Claim cooldown not reached yet (at least 1 day between claims).',
    errNoReward: 'No reward available yet. The first 7 days after registration is a lockup period.',
    errAlreadyRegistered: 'Miner already registered on this wallet.',
    errMinerNotRegistered: 'Miner not registered yet. Please activate first.',
    errMinerNotActive: 'Miner is not active.',
    errInvalidHashrate: 'Invalid hashrate value.',
    errDeviceIdRequired: 'Device ID is required.',
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
    copyAddress: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    machineCodeTitle: 'Machine Code',
    machineCodeHint: 'Please tell our support this code when purchasing a monthly card.',
    agreementTitleFallback: 'User Agreement',
    agreementIntro: 'Please read and accept the agreement to continue.',
    agreementAccept: 'I have read and agree',
    agreementDecline: 'Decline',
    agreementDeclinedHint: 'You must accept the agreement to use this app.',
    agreementSubmitting: 'Submitting...',
    agreementFailed: 'Failed to submit acceptance: ',
    supportContactsTitle: 'Customer Support',
    supportContactsEmpty: 'Support contact info is not configured yet.',
    announcementCenter: 'Latest Announcements',
    announcementEmpty: 'No announcements right now.',
    announcementPinned: 'Pinned',
    announcementReadMore: 'Read More',
    announcementDismiss: 'Close',
    announcementGotIt: 'Got it',
    announcementPublishedAt: 'Published',
    exportPrivateKeyTitle: 'Export Private Key',
    exportPrivateKeyButton: 'Export Private Key',
    exportPrivateKeyWarning: 'WARNING: Anyone with this key controls your wallet. Never share it. Keep it offline.',
    exportPrivateKeyReveal: 'Reveal Private Key',
    exportPrivateKeyCopy: 'Copy to Clipboard',
    exportPrivateKeyCopied: 'Copied',
    exportPrivateKeyClose: 'Close',
    exportPrivateKeyMissing: 'No local private key found.',
  },
  zh: {
    appTitle: 'Coin Planet',
    subtitle: '设备中心 · BNB 智能链',
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
    marketStatusTitle: '市场收益状态',
    marketTrendLabel: '市场趋势',
    marketRiskLabel: '风险等级',
    rewardTokenTitle: '收益代币',
    totalRewardLabel: '累计收益',
    todayRewardLabel: '今日收益',
    claimableRewardLabel: '预计可领取',
    yieldRateTitle: '收益率',
    rewardRatePerHourLabel: '基础时收益',
    rewardRateDailyChangeLabel: '24小时变化',
    earningsCurveTitle: '收益曲线',
    range7dLabel: '近7天',
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
    errClaimCooldown: '领取冷却时间未到，两次领取需间隔 1 天。',
    errNoReward: '暂无可领取奖励。矿机注册后前 7 天为锁仓期，期间奖励暂不累计。',
    errAlreadyRegistered: '该钱包已注册矿机。',
    errMinerNotRegistered: '矿机尚未注册，请先完成矿机激活。',
    errMinerNotActive: '矿机未激活。',
    errInvalidHashrate: '算力参数不合法。',
    errDeviceIdRequired: '缺少设备 ID。',
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
    copyAddress: '复制',
    copied: '已复制',
    copyFailed: '复制失败',
    machineCodeTitle: '机器码',
    machineCodeHint: '请将此机器码告知客服以购买月卡。',
    agreementTitleFallback: '用户协议',
    agreementIntro: '请阅读并同意以下协议后继续使用。',
    agreementAccept: '我已阅读并同意',
    agreementDecline: '暂不同意',
    agreementDeclinedHint: '需同意用户协议方可继续使用本应用。',
    agreementSubmitting: '正在提交...',
    agreementFailed: '提交同意失败：',
    supportContactsTitle: '客服联系方式',
    supportContactsEmpty: '尚未配置客服联系方式。',
    announcementCenter: '最新公告',
    announcementEmpty: '当前暂无公告。',
    announcementPinned: '置顶',
    announcementReadMore: '查看详情',
    announcementDismiss: '关闭',
    announcementGotIt: '我知道了',
    announcementPublishedAt: '发布时间',
    exportPrivateKeyTitle: '导出账户私钥',
    exportPrivateKeyButton: '导出私钥',
    exportPrivateKeyWarning: '警告：掌握私钥即拥有账户全部权限。请勿截图、拍照或泄露给任何人，建议抄写后离线妥善保管。',
    exportPrivateKeyReveal: '显示私钥',
    exportPrivateKeyCopy: '复制到剪贴板',
    exportPrivateKeyCopied: '已复制',
    exportPrivateKeyClose: '关闭',
    exportPrivateKeyMissing: '本地未找到私钥。',
  },
} as const;

function createDeviceId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `mobile-${Date.now()}-${random}`;
}

function deriveMachineCode(seed: string): string {
  if (!seed) return '--------';
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
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

function toDateKey(input: Date) {
  const y = input.getFullYear();
  const m = `${input.getMonth() + 1}`.padStart(2, '0');
  const d = `${input.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseFiniteNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [localAgreementVersion, setLocalAgreementVersion] = useState<string | null>(null);
  const [agreementSubmitting, setAgreementSubmitting] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [agreementDeclined, setAgreementDeclined] = useState(false);
  const [agreementError, setAgreementError] = useState('');
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [announcementReadIds, setAnnouncementReadIds] = useState<string[]>([]);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const swapConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryActionRef = useRef<(() => Promise<void>) | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryActionNameRef = useRef<ActionType>('');
  const announcementAutoShownRef = useRef(false);

  const t = translations[lang] as typeof translations.en;
  const isBusy = activeAction !== '';
  const identityReady = Boolean(walletAddress && userId && deviceId);
  const maintenanceEnabled = Boolean(systemStatus?.maintenanceEnabled);
  const contractExpired = Boolean(userDetails?.contractEndAt && new Date(userDetails.contractEndAt).getTime() < Date.now());
  const actionsBlocked = maintenanceEnabled || contractExpired;

  const userAgreement = systemStatus?.userAgreement;
  const agreementRequired = Boolean(userAgreement?.required && userAgreement?.version);
  const acceptedAgreementVersion = userDetails?.agreementAcceptedVersion ?? localAgreementVersion ?? null;
  const agreementNeedsAcceptance = agreementRequired
    && userAgreement
    && acceptedAgreementVersion !== userAgreement.version;
  const hasActiveContract = Boolean(userDetails?.contractActive) && !contractExpired;
  const announcementReadSet = useMemo(() => new Set(announcementReadIds), [announcementReadIds]);
  const visibleAnnouncements = useMemo(
    () => announcements.filter((item) => item.target === 'all' || hasActiveContract),
    [announcements, hasActiveContract],
  );
  const selectedAnnouncement = useMemo(
    () => visibleAnnouncements.find((item) => item.id === selectedAnnouncementId) ?? null,
    [visibleAnnouncements, selectedAnnouncementId],
  );
  const unreadAnnouncement = useMemo(
    () => visibleAnnouncements.find((item) => item.isPinned && !announcementReadSet.has(item.id))
      ?? visibleAnnouncements.find((item) => !announcementReadSet.has(item.id))
      ?? null,
    [announcementReadSet, visibleAnnouncements],
  );

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

    // Map well-known contract revert reasons to friendly localized text.
    const revertReasonMatch = raw.match(/(?:Transaction reverted:|reverted with the following reason:?)\s*([^\n]+)/i);
    const revertReason = (revertReasonMatch ? revertReasonMatch[1] : '').trim();
    const reasonLower = revertReason.toLowerCase();
    if (reasonLower) {
      if (reasonLower.includes('claim cooldown')) return t.errClaimCooldown;
      if (reasonLower.includes('no reward')) return t.errNoReward;
      if (reasonLower.includes('miner already registered')) return t.errAlreadyRegistered;
      if (reasonLower.includes('miner not registered')) return t.errMinerNotRegistered;
      if (reasonLower.includes('miner not active')) return t.errMinerNotActive;
      if (reasonLower.includes('invalid hashrate')) return t.errInvalidHashrate;
      if (reasonLower.includes('device id required')) return t.errDeviceIdRequired;
      // Fall back to surfacing the actual revert reason verbatim.
      return `${t.errReverted}（${revertReason}）`;
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

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    const { copyToClipboard } = await import('./utils/clipboard');
    const ok = await copyToClipboard(walletAddress);
    setCopyState(ok ? 'copied' : 'failed');
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopyState('idle'), 1800);
  };

  const flowHint = useMemo(() => {
    if (!identityReady) return t.flow1;
    if (!minerReady) return t.flow2;
    return t.flow3;
  }, [identityReady, minerReady, t.flow1, t.flow2, t.flow3]);

  const displayId = useMemo(() => {
    if (!userId) return '----';
    return userId.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0');
  }, [userId]);

  const machineCode = useMemo(() => {
    const fromServer = (userDetails as { machineCode?: string | null } | null)?.machineCode;
    if (fromServer && typeof fromServer === 'string' && fromServer.trim()) {
      return fromServer.trim();
    }
    return deriveMachineCode(deviceId || walletAddress || userId || '');
  }, [userDetails, deviceId, walletAddress, userId]);

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

  const rewardRows = useMemo(() => {
    return (userDetails?.rewards ?? []).map((item) => ({
      rewardUsdt: parseFiniteNumber(item.reward_usdt),
      createdAt: item.created_at,
    }));
  }, [userDetails?.rewards]);

  const chartValues = useMemo(() => {
    const totalDays = 7;
    const values = new Array<number>(totalDays).fill(0);
    const dayIndexMap = new Map<string, number>();

    for (let idx = totalDays - 1; idx >= 0; idx -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - idx);
      dayIndexMap.set(toDateKey(date), totalDays - 1 - idx);
    }

    rewardRows.forEach((row) => {
      const date = new Date(row.createdAt);
      if (Number.isNaN(date.getTime())) return;
      const bucketIndex = dayIndexMap.get(toDateKey(date));
      if (bucketIndex === undefined) return;
      values[bucketIndex] += row.rewardUsdt;
    });

    const hasRealData = values.some((value) => value > 0);
    if (hasRealData) {
      return values.map((value) => Number(value.toFixed(3)));
    }

    const base = Math.max(80, Math.floor(monthProgressMinutes * 0.18));
    return [
      Number((base * 0.46).toFixed(3)),
      Number((base * 0.62).toFixed(3)),
      Number((base * 0.51).toFixed(3)),
      Number((base * 0.75).toFixed(3)),
      Number((base * 0.68).toFixed(3)),
      Number((base * 0.89).toFixed(3)),
      Number((base * 0.84).toFixed(3)),
    ];
  }, [rewardRows, monthProgressMinutes]);

  const chartMax = Math.max(...chartValues, 1);
  const totalRewardUsdt = parseFiniteNumber(userDetails?.totalRewardUsdt);
  const totalRewardSuper = parseFiniteNumber(userDetails?.totalRewardSuper);
  const todayRewardUsdt = chartValues[chartValues.length - 1] ?? 0;
  const claimableRewardUsdt = Math.max(0, Math.min(totalRewardUsdt, todayRewardUsdt));
  const rewardRatePerHour = parseFiniteNumber(userDetails?.rewardRateUsdtPerHour);
  const yesterdayRewardUsdt = chartValues[chartValues.length - 2] ?? 0;
  const rewardRateDailyChange = yesterdayRewardUsdt > 0
    ? ((todayRewardUsdt - yesterdayRewardUsdt) / yesterdayRewardUsdt) * 100
    : todayRewardUsdt > 0 ? 100 : 0;

  const curveAvg = chartValues.reduce((sum, item) => sum + item, 0) / Math.max(1, chartValues.length);
  const variance = chartValues.reduce((sum, item) => sum + (item - curveAvg) ** 2, 0) / Math.max(1, chartValues.length);
  const volatility = curveAvg > 0 ? (Math.sqrt(variance) / curveAvg) * 100 : 100;

  const marketTrend = rewardRateDailyChange >= 8
    ? (lang === 'zh' ? '上涨' : 'Uptrend')
    : rewardRateDailyChange <= -8
      ? (lang === 'zh' ? '回调' : 'Pullback')
      : (lang === 'zh' ? '震荡' : 'Sideways');

  const marketRisk = volatility >= 40
    ? (lang === 'zh' ? '高风险' : 'High Risk')
    : volatility >= 20
      ? (lang === 'zh' ? '中风险' : 'Medium Risk')
      : (lang === 'zh' ? '低风险' : 'Low Risk');

  const marketHint = lang === 'zh'
    ? `近7天波动率 ${volatility.toFixed(1)}%，建议关注收益稳定性。`
    : `7-day volatility ${volatility.toFixed(1)}%. Keep an eye on yield stability.`;

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
    let cancelled = false;
    const check = async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        if (cancelled) return;
        setOnboardingChecked(true);
        if (!done) {
          setOnboardingVisible(true);
        }
      } catch {
        if (!cancelled) setOnboardingChecked(true);
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOnboardingComplete = async (_years: 1 | 2 | 3) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, new Date().toISOString());
    } catch {}
    setOnboardingVisible(false);
  };

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
    const restoreAgreement = async () => {
      try {
        const stored = await AsyncStorage.getItem(AGREEMENT_ACCEPTED_KEY);
        if (stored) setLocalAgreementVersion(stored);
      } catch {
        // ignore
      }
    };
    void restoreAgreement();
  }, []);

  useEffect(() => {
    const restoreAnnouncementReads = async () => {
      try {
        const stored = await AsyncStorage.getItem(ANNOUNCEMENT_READ_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          setAnnouncementReadIds(parsed.filter((item): item is string => typeof item === 'string'));
        }
      } catch {
        setAnnouncementReadIds([]);
      }
    };
    void restoreAnnouncementReads();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const items = await getAnnouncements();
      if (!cancelled) {
        setAnnouncements(items);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (maintenanceEnabled || agreementNeedsAcceptance || onboardingVisible) return;
    if (announcementAutoShownRef.current) return;
    if (announcementVisible) return;
    if (!unreadAnnouncement) return;
    announcementAutoShownRef.current = true;
    setSelectedAnnouncementId(unreadAnnouncement.id);
    setAnnouncementVisible(true);
  }, [agreementNeedsAcceptance, announcementVisible, maintenanceEnabled, onboardingVisible, unreadAnnouncement]);

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

  const persistAnnouncementReads = async (ids: string[]) => {
    setAnnouncementReadIds(ids);
    try {
      await AsyncStorage.setItem(ANNOUNCEMENT_READ_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  };

  const markAnnouncementAsRead = async (announcementId: string) => {
    if (!announcementId || announcementReadSet.has(announcementId)) return;
    const next = Array.from(new Set([...announcementReadIds, announcementId]));
    await persistAnnouncementReads(next);
    if (userId && walletAddress) {
      try {
        await markAnnouncementReadApi(userId, announcementId, walletAddress);
      } catch {
        // ignore server sync failures, local read state already recorded
      }
    }
  };

  const handleOpenAnnouncement = (announcementId: string) => {
    setSelectedAnnouncementId(announcementId);
    setAnnouncementVisible(true);
  };

  const handleDismissAnnouncement = async () => {
    if (selectedAnnouncementId) {
      await markAnnouncementAsRead(selectedAnnouncementId);
    }
    setAnnouncementVisible(false);
    setSelectedAnnouncementId(null);
  };

  const handleAcceptAgreement = async () => {
    if (!userAgreement || !userAgreement.version) return;
    if (agreementSubmitting) return;
    setAgreementError('');
    setAgreementDeclined(false);

    // If identity not ready yet, accept locally; backend sync happens after init.
    if (!userId || !walletAddress) {
      setLocalAgreementVersion(userAgreement.version);
      try {
        await AsyncStorage.setItem(AGREEMENT_ACCEPTED_KEY, userAgreement.version);
      } catch {
        // ignore
      }
      return;
    }

    setAgreementSubmitting(true);
    try {
      await acceptUserAgreement(userId, userAgreement.version, walletAddress);
      setLocalAgreementVersion(userAgreement.version);
      try {
        await AsyncStorage.setItem(AGREEMENT_ACCEPTED_KEY, userAgreement.version);
      } catch {
        // ignore
      }
      const details = await getUserDetails(userId);
      setUserDetails(details);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      setAgreementError(`${t.agreementFailed}${message}`);
    } finally {
      setAgreementSubmitting(false);
    }
  };

  const handleDeclineAgreement = () => {
    setAgreementDeclined(true);
  };

  // If accepted locally before identity was ready, sync to backend once it becomes ready.
  useEffect(() => {
    if (!userAgreement?.required || !userAgreement.version) return;
    if (!userId || !walletAddress) return;
    if (localAgreementVersion !== userAgreement.version) return;
    if (userDetails?.agreementAcceptedVersion === userAgreement.version) return;

    let cancelled = false;
    (async () => {
      try {
        await acceptUserAgreement(userId, userAgreement.version, walletAddress);
        if (cancelled) return;
        const details = await getUserDetails(userId);
        if (cancelled) return;
        setUserDetails(details);
      } catch {
        // silent — user can retry via modal if status re-renders it
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    userId,
    walletAddress,
    localAgreementVersion,
    userAgreement?.required,
    userAgreement?.version,
    userDetails?.agreementAcceptedVersion,
  ]);

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
      const [status, announcementItems] = await Promise.all([
        getSystemStatus(),
        getAnnouncements(),
      ]);
      setSystemStatus(status);
      setAnnouncements(announcementItems);

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
      const rawMessage = error instanceof Error ? error.message : '';
      const message = toFriendlyErrorMessage(error);
      const combined = `${rawMessage} ${message}`.toLowerCase();
      const alreadyRegistered = combined.includes('already') && combined.includes('register');

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

  if (agreementNeedsAcceptance && userAgreement) {
    const title = (lang === 'zh' ? userAgreement.titleZh : userAgreement.titleEn) || t.agreementTitleFallback;
    const content = lang === 'zh' ? userAgreement.contentZh : userAgreement.contentEn;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.agreementWrap}>
          <View style={styles.agreementHeaderRow}>
            <Text style={styles.agreementTitle}>{title}</Text>
            <TouchableOpacity style={styles.langBtn} onPress={toggleLang}>
              <Text style={styles.langBtnText}>{t.langToggle}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.agreementIntro}>{t.agreementIntro}</Text>
          <Text style={styles.agreementVersion}>v{userAgreement.version}</Text>
          <ScrollView style={styles.agreementScroll} contentContainerStyle={styles.agreementScrollContent}>
            <Text style={styles.agreementBody}>{content}</Text>
          </ScrollView>
          {agreementDeclined && (
            <Text style={styles.agreementDeclined}>{t.agreementDeclinedHint}</Text>
          )}
          {!!agreementError && (
            <Text style={styles.agreementError}>{agreementError}</Text>
          )}
          <View style={styles.agreementBtnRow}>
            <TouchableOpacity
              style={styles.agreementDeclineBtn}
              onPress={handleDeclineAgreement}
              disabled={agreementSubmitting}
            >
              <Text style={styles.agreementDeclineBtnText}>{t.agreementDecline}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.agreementAcceptBtn, agreementSubmitting && styles.agreementAcceptBtnDisabled]}
              onPress={handleAcceptAgreement}
              disabled={agreementSubmitting}
            >
              <Text style={styles.agreementAcceptBtnText}>
                {agreementSubmitting ? t.agreementSubmitting : t.agreementAccept}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <OnboardingFlow
        visible={onboardingChecked && onboardingVisible}
        lang={lang}
        machineCode={machineCode}
        onComplete={handleOnboardingComplete}
      />
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

          {!(identityReady && minerReady) && (
            <GuideCard
              title={guideTitle}
              description={guideDescription}
              buttonLabel={contractExpired ? t.contractExpiredTitle : guideCtaLabel}
              disabled={isBusy || contractExpired}
              steps={guideSteps}
              onPress={guideAction}
            />
          )}

          {visibleAnnouncements.length > 0 && (
            <View style={styles.announcementCard}>
              <View style={styles.announcementCardHeader}>
                <Text style={styles.announcementCardTitle}>{t.announcementCenter}</Text>
                <Text style={styles.announcementCount}>{visibleAnnouncements.length}</Text>
              </View>
              {visibleAnnouncements.slice(0, 3).map((item) => {
                const isRead = announcementReadSet.has(item.id);
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.announcementItem}
                    onPress={() => handleOpenAnnouncement(item.id)}
                  >
                    <View style={styles.announcementItemTop}>
                      <View style={styles.announcementBadgeRow}>
                        {item.isPinned && <Text style={styles.announcementPinned}>{t.announcementPinned}</Text>}
                        <Text style={[styles.announcementLevel, item.level === 'critical' ? styles.announcementLevelCritical : item.level === 'warning' ? styles.announcementLevelWarning : styles.announcementLevelInfo]}>{item.level}</Text>
                      </View>
                      {!isRead && <View style={styles.announcementUnreadDot} />}
                    </View>
                    <Text style={styles.announcementItemTitle}>{lang === 'zh' ? item.titleZh : item.titleEn}</Text>
                    <Text style={styles.announcementItemBody} numberOfLines={2}>{lang === 'zh' ? item.contentZh : item.contentEn}</Text>
                    <View style={styles.announcementItemFooter}>
                      <Text style={styles.announcementMetaText}>
                        {t.announcementPublishedAt}: {new Date(item.publishAt ?? item.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US')}
                      </Text>
                      <Text style={styles.announcementReadMore}>{t.announcementReadMore}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

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
              onCopyAddress={handleCopyAddress}
              copyState={copyState}
              machineCode={machineCode}
              t={t}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsTab
              marketTrend={marketTrend}
              marketRisk={marketRisk}
              marketHint={marketHint}
              totalRewardUsdt={totalRewardUsdt}
              totalRewardSuper={totalRewardSuper}
              todayRewardUsdt={todayRewardUsdt}
              claimableRewardUsdt={claimableRewardUsdt}
              rewardTokenSymbol="SUPER"
              rewardRatePerHour={rewardRatePerHour}
              rewardRateDailyChange={rewardRateDailyChange}
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
              onCopyAddress={handleCopyAddress}
              copyState={copyState}
              supportContacts={systemStatus?.supportContacts ?? []}
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
        visible={announcementVisible && Boolean(selectedAnnouncement)}
        transparent
        animationType="fade"
        onRequestClose={() => void handleDismissAnnouncement()}
      >
        <Pressable style={styles.modalMask} onPress={() => void handleDismissAnnouncement()}>
          <Pressable style={styles.modalCardLarge}>
            <View style={styles.announcementModalHeader}>
              <View style={styles.announcementBadgeRow}>
                {selectedAnnouncement?.isPinned && <Text style={styles.announcementPinned}>{t.announcementPinned}</Text>}
                {selectedAnnouncement && <Text style={[styles.announcementLevel, selectedAnnouncement.level === 'critical' ? styles.announcementLevelCritical : selectedAnnouncement.level === 'warning' ? styles.announcementLevelWarning : styles.announcementLevelInfo]}>{selectedAnnouncement.level}</Text>}
              </View>
              <Text style={styles.announcementMetaText}>
                {selectedAnnouncement ? `${t.announcementPublishedAt}: ${new Date(selectedAnnouncement.publishAt ?? selectedAnnouncement.createdAt).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US')}` : ''}
              </Text>
            </View>

            <Text style={styles.modalTitle}>{selectedAnnouncement ? (lang === 'zh' ? selectedAnnouncement.titleZh : selectedAnnouncement.titleEn) : ''}</Text>
            <ScrollView style={styles.announcementScroll} contentContainerStyle={styles.announcementScrollContent}>
              <Text style={styles.announcementModalBody}>{selectedAnnouncement ? (lang === 'zh' ? selectedAnnouncement.contentZh : selectedAnnouncement.contentEn) : ''}</Text>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => void handleDismissAnnouncement()}>
                <Text style={styles.modalGhostBtnText}>{t.announcementDismiss}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={() => void handleDismissAnnouncement()}>
                <Text style={styles.modalPrimaryBtnText}>{t.announcementGotIt}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
  agreementWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 12,
  },
  agreementHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  agreementTitle: {
    color: '#ecfeff',
    fontSize: 22,
    fontWeight: '800',
    flex: 1,
    marginRight: 12,
  },
  agreementIntro: {
    color: '#9cc6ff',
    fontSize: 13,
    lineHeight: 20,
  },
  agreementVersion: {
    color: '#64748b',
    fontSize: 12,
  },
  agreementScroll: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0b1a36',
  },
  agreementScrollContent: {
    padding: 14,
  },
  agreementBody: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 22,
  },
  agreementDeclined: {
    color: '#fca5a5',
    fontSize: 13,
  },
  agreementError: {
    color: '#f87171',
    fontSize: 12,
  },
  agreementBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  agreementDeclineBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0f172a',
  },
  agreementDeclineBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
  agreementAcceptBtn: {
    flex: 2,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
  },
  agreementAcceptBtnDisabled: {
    opacity: 0.6,
  },
  agreementAcceptBtnText: {
    color: '#04121f',
    fontSize: 14,
    fontWeight: '800',
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
  announcementCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7c3aed',
    backgroundColor: '#160a36',
    padding: 14,
    gap: 10,
  },
  announcementCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  announcementCardTitle: {
    color: '#f5f3ff',
    fontSize: 16,
    fontWeight: '800',
  },
  announcementCount: {
    minWidth: 24,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#7c3aed',
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  announcementItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#312e81',
    backgroundColor: '#1e123f',
    padding: 12,
    gap: 6,
  },
  announcementItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  announcementBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  announcementPinned: {
    borderRadius: 999,
    backgroundColor: '#c026d3',
    color: '#fdf4ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
  },
  announcementLevel: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  announcementLevelInfo: {
    backgroundColor: '#0f3f63',
    color: '#bae6fd',
  },
  announcementLevelWarning: {
    backgroundColor: '#5b3a03',
    color: '#fde68a',
  },
  announcementLevelCritical: {
    backgroundColor: '#5b1020',
    color: '#fecdd3',
  },
  announcementUnreadDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#f59e0b',
  },
  announcementItemTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '800',
  },
  announcementItemBody: {
    color: '#d8d4fe',
    fontSize: 13,
    lineHeight: 19,
  },
  announcementItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  announcementMetaText: {
    color: '#a5b4fc',
    fontSize: 11,
    flex: 1,
  },
  announcementReadMore: {
    color: '#f0abfc',
    fontSize: 12,
    fontWeight: '700',
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
  modalCardLarge: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#8b5cf6',
    backgroundColor: '#120a2e',
    padding: 16,
    gap: 12,
    maxHeight: '80%',
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
  announcementModalHeader: {
    gap: 8,
  },
  announcementScroll: {
    maxHeight: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#312e81',
    backgroundColor: '#1a1040',
  },
  announcementScrollContent: {
    padding: 14,
  },
  announcementModalBody: {
    color: '#ede9fe',
    fontSize: 14,
    lineHeight: 22,
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