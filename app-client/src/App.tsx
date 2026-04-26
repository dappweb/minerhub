import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
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
    bindReferral,
    createExchangeRequest,
    createUser,
    getAnnouncements,
    getExchangeRequests,
    getGasWalletBalance,
    getReferralMembers,
    getReferralSummary,
    getSystemStatus,
    getUser,
    getUserByWallet,
    getUserDetails,
    isExchangeOrderPendingStatus,
    markAnnouncementRead as markAnnouncementReadApi,
    registerDevice,
    reportDeviceHeartbeat,
    type AnnouncementDto,
    type ExchangeRequestDto,
    type ReferralMemberDto,
    type ReferralSummaryDto
} from './services/api';
import {
    claimRewardOnChain,
    getSwapPriceOnChain,
    getWalletAddress,
    getWalletBalances,
    registerMinerOnChain,
    sendNativeTokenOnChain,
} from './services/blockchain';
import { manualCheckForUpdateFull, useAutoUpdate } from './services/updates';
import {
    exportWalletPrivateKey,
    importWalletPrivateKey
} from './services/wallet';
import { copyToClipboard } from './utils/clipboard';

const APP_VERSION = '1.0.0';

type Lang = 'en' | 'zh';

type ActionType = 'init' | 'mine' | 'claim' | 'swap' | 'transfer' | '';
type SwapTxStage = 'idle' | 'submitting' | 'confirming' | 'success' | 'failed';

const LANG_KEY = 'coinplanet.lang';
const DEVICE_ID_KEY = 'coinplanet.device_id';
const DEVICE_INSTALL_SEED_KEY = 'coinplanet.device_install_seed_v1';
const MINER_READY_KEY = 'coinplanet.miner_ready';
const USER_ID_KEY = 'coinplanet.user_id';
const AGREEMENT_ACCEPTED_KEY = 'coinplanet.agreement_accepted_version';
const ONBOARDING_COMPLETED_KEY = 'coinplanet.onboarding_completed_v1';
const ONBOARDING_MINIMIZED_KEY = 'coinplanet.onboarding_minimized_v1';
const ANNOUNCEMENT_READ_KEY = 'coinplanet.announcements.read_ids';
const REFERRAL_WALLET_KEY = 'coinplanet.referral_wallet';
const SWAP_FEE_RATE = 0.005;
const SWAP_SLIPPAGE_RATE = 0.008;
const INIT_RETRY_DELAY_MS = 8_000;
const DEFAULT_DEVICE_HASHRATE = 1000;
const DEFAULT_CONTRACT_TERM_DAYS = 1095;
const REFERRAL_PAGE_SIZE = 20;

const translations = {
  en: {
    appTitle: 'Coin Planet',
    subtitle: 'Device Center · BNB Smart Chain',
    flow1: 'Finish identity sync and inviter binding first',
    flow2: 'Submit machine code for monthly-card activation, then setup miner',
    flow3: 'Keep device online to accrue rewards; claim and swap anytime',
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
    swapPanelTitle: 'SUPER -> USDT',
    swapAmount: 'Swap Amount (SUPER)',
    swapAmountPlaceholder: 'Enter SUPER amount',
    refreshPrice: 'Refresh Price',
    quote: 'Estimated USDT',
    fee: 'Fee (0.5%)',
    minReceive: 'Minimum Received',
    swapButton: 'Submit Exchange',
    swapConfirmTitle: 'Confirm Swap',
    swapConfirmHint: 'Submit to backend exchange workflow (auto/manual by control settings).',
    exchangeOrderMode: 'Mode',
    exchangeOrderHistoryTitle: 'My Exchange Requests',
    exchangeOrderStatus: 'Status',
    exchangeOrderCreatedAt: 'Created At',
    exchangeOrderEmpty: 'No exchange requests yet.',
    cancel: 'Cancel',
    confirm: 'Confirm',
    txProgressTitle: 'Transaction Progress',
    txSubmit: 'Submitting',
    txConfirming: 'Processing',
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
    guideDescInit: 'Complete identity sync and bind inviter wallet first, then unlock miner operations.',
    guideDescMine: 'Send machine code to support to activate monthly card, then setup miner (admin gas top-up if needed).',
    guideDescOnboarding: 'Finish inviter wallet and machine-code setup first. You can minimize the floating setup card and resume anytime.',
    guideDescReady: 'After miner activation, keep your phone online to accrue rewards and use bottom tabs for claim/swap.',
    guideStepIdentity: 'Identity Sync',
    guideStepMiner: 'Miner Activation',
    guideStepReward: 'Rewards & Swap',
    guideStepDone: 'Done',
    guideStepTodo: 'Next',
    guideStepLocked: 'Locked',
    guideStepActivation: 'Monthly Card Activation',
    guideStepActivationStatus: 'Send machine code to support to activate',
    guideStepActivationDone: 'Activated',
    guideContactSupport: '📞 Contact Support',
    guideEyebrow: 'Current Task',
    guideFocusLabel: 'Do this next',
    guideDescActivate: 'Miner registered. Now send your machine code to support to activate the monthly card, then rewards will start accruing.',
    guideCtaOnboarding: 'Continue Setup',
    guideCtaActivate: 'Already Activated – Setup Miner',
    agreementModalTitle: 'User Agreement',
    agreementModalSubtitle: 'Please read and accept the agreement to continue using Coin Planet.',
    agreementAcceptBtn: 'Accept & Continue',
    agreementDeclineBtn: 'Decline',
    agreementDeclinedWarn: 'You must accept the agreement to continue.',
    agreementSubmittingBtn: 'Submitting...',

    homeOverview: 'Overview',
    homePrimaryAction: 'Next Step',
    rewardsSummary: 'Reward Summary',
    marketStatusTitle: 'Market Yield Status',
    marketTrendLabel: 'Market Trend',
    marketRiskLabel: 'Risk Level',
    yieldRateTitle: 'Yield Rate',
    configuredYieldRateLabel: 'Configured Rate',
    effectiveYieldRateLabel: 'Effective Rate',
    estimatedDailyRewardLabel: 'Estimated Daily',
    rewardTokenTitle: 'Reward Token',
    totalRewardLabel: 'Total Reward',
    todayRewardLabel: 'Today Reward',
    claimableRewardLabel: 'Estimated Claimable',
    lockCycleLabel: 'Lock Cycle',
    lockRemainingLabel: 'Remaining',
    lockStatusLabel: 'Status',
    earningsCurveTitle: 'Earnings Curve',
    range7dLabel: '7D',
    deviceSummary: 'Device Console',
    profileSummary: 'Account Center',
    walletCardTitle: 'Wallet',
    contractExpiredTitle: 'Contract Expired',
    contractExpiredBody: 'Renew or update your contract before rewards can continue.',
    hashrate: 'Hashrate',
    hashrateLockedHint: 'Hashrate is managed by admin and cannot be modified on the app side.',
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
    updateHashrate: 'Hashrate is locked. Contact admin to adjust.',
    hashrateUpdated: 'Hashrate: ',
    registerMiner: 'Registering miner on-chain...',
    minerRegistered: 'Miner registered: ',
    deviceRecord: ', device record ',
    minerRecovered: 'Miner already exists and has been synced.',
    minerRecoverFail: 'Miner state recovery failed: ',
    minerFail: 'Miner setup failed: ',
    minerNotReady: 'Please setup miner before claiming reward',
    claimDoing: 'Submitting claim transaction...',
    claimSuccess: 'Claim success: ',
    claimFail: 'Claim failed: ',
    invalidSwapAmount: 'Please enter a valid SUPER amount',
    swapDoing: 'Submitting exchange request...',
    swapSuccess: 'Exchange request submitted: ',
    swapFail: 'Exchange request failed: ',
    invalidAddress: 'Please enter a valid destination address',
    invalidAmount: 'Please enter a valid transfer amount',
    transferDoing: 'Submitting transfer...',
    transferSuccess: 'Transfer success: ',
    transferFail: 'Transfer failed: ',
    errInsufficientBnb: 'Insufficient BNB for gas. Please contact admin for gas top-up.',
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
    errMaintenance: 'System is under maintenance. Please try again later.',
    errAuthInvalid: 'Authentication expired or invalid. Please re-sync identity and retry.',
    errServerBusy: 'Service is busy. Please retry in a moment.',
    errInvalidRequest: 'Request parameters are invalid. Please check your input.',
    gasAssistTitle: 'Gas Top-up',
    gasAssistHint: 'Gas cannot be purchased with tokens. Please request admin recharge.',
    gasTokenLabel: 'Pay token',
    gasAmountLabel: 'Pay amount',
    gasQuoteLabel: 'Estimated BNB',
    gasBalanceLabel: 'Funded BNB (history)',
    gasBuyAndRetry: 'Request Admin Recharge',
    gasAdminHint: 'Gas can only be recharged by admin. Token swap for gas is disabled.',
    gasRequestTopup: 'Contact Admin Recharge',
    gasAdminTopupNeeded: 'Gas can only be provided by admin recharge. Please contact support/admin.',
    gasBuying: 'Purchasing gas package...',
    gasReady: 'Gas package completed. Retrying transaction...',
    gasFailed: 'Gas purchase failed: ',
    gasIntentPhase2: 'Phase-2 relay intent registered.',
    priceUnavailable: 'Pool price unavailable',
    swapBlockedNoPrice: 'Swap is unavailable: pool price is not ready (liquidity may be uninitialized or backend price not configured).',
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
    checkUpdateTitle: 'App Update',
    checkUpdateButton: 'Check for Updates',
    checkUpdateHint: 'Fetches the latest features and fixes without reinstalling.',
    appVersionLabel: 'Current Version',
    inviterTitle: 'My Inviter',
    inviterWallet: 'Inviter Wallet',
    inviterEmpty: 'No inviter bound yet',
    referralTitle: 'Referral Summary',
    referralDirectCount: 'Direct Accounts',
    referralDirectAmount: 'Direct Amount (USDT)',
    referralTeamCount: 'Team Accounts',
    referralTeamAmount: 'Team Amount (USDT)',
    referralMembersTitle: 'Team Members',
    referralMembersDirectTab: 'Direct',
    referralMembersTeamTab: 'Team',
    referralMembersLevel: 'Level',
    referralMembersReward: 'Reward',
    referralMembersJoined: 'Joined',
    referralMembersContract: 'Contract',
    referralMembersContractActive: 'Active',
    referralMembersContractInactive: 'Inactive',
    referralMembersEmpty: 'No members yet',
    referralMembersLoading: 'Loading team members...',
    referralMembersError: 'Failed to load team members',
    referralMembersPage: 'Page',
    referralMembersPrev: 'Prev',
    referralMembersNext: 'Next',
  },
  zh: {
    appTitle: 'Coin Planet',
    subtitle: '设备中心 · BNB 智能链',
    flow1: '请先完成身份同步并绑定推荐人钱包',
    flow2: '提交机器码开通月卡后再进行矿机设置',
    flow3: '保持手机在线累计收益，随时可领取与兑换',
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
    swapPanelTitle: 'SUPER -> USDT',
    swapAmount: '兑换数量（SUPER）',
    swapAmountPlaceholder: '输入SUPER数量',
    refreshPrice: '刷新价格',
    quote: '预计获得USDT',
    fee: '手续费（0.5%）',
    minReceive: '最少到账',
    swapButton: '提交兑换申请',
    swapConfirmTitle: '确认兑换',
    swapConfirmHint: '提交到后台兑换流程（是否自动处理由控制端开关决定）。',
    exchangeOrderMode: '处理模式',
    exchangeOrderHistoryTitle: '我的兑换申请',
    exchangeOrderStatus: '状态',
    exchangeOrderCreatedAt: '创建时间',
    exchangeOrderEmpty: '暂无兑换申请记录。',
    cancel: '取消',
    confirm: '确认',
    txProgressTitle: '交易进度',
    txSubmit: '提交交易',
    txConfirming: '处理中',
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
    guideDescInit: '先完成身份同步并绑定推荐人钱包，再解锁后续矿机操作。',
    guideDescMine: '将机器码提供给客服开通月卡后，再执行矿机设置（如缺 Gas 请联系管理员充值）。',
    guideDescOnboarding: '请先完成推荐人钱包和机器码配置。悬浮框可收起，稍后继续。',
    guideDescReady: '矿机激活后保持手机在线，收益会按在线时长累计，可在底部菜单领取与兑换。',
    guideStepIdentity: '身份同步',
    guideStepMiner: '矿机激活',
    guideStepReward: '收益与兑换',
    guideStepDone: '完成',
    guideStepTodo: '下一步',
    guideStepLocked: '待解锁',
    guideStepActivation: '月卡激活',
    guideStepActivationStatus: '将机器码提交给客服开通月卡',
    guideStepActivationDone: '已激活',
    guideContactSupport: '📞 联系客服',
    guideEyebrow: '当前任务',
    guideFocusLabel: '现在最值得先完成',
    guideDescActivate: '矿机已注册。请将机器码提供给客服申请开通月卡，激活后收益将自动开始累计。',
    guideCtaOnboarding: '继续配置',
    guideCtaActivate: '已开通月卡 → 继续矿机设置',
    agreementModalTitle: '用户协议',
    agreementModalSubtitle: '请阅读并同意协议，方可继续使用 Coin Planet。',
    agreementAcceptBtn: '同意并继续',
    agreementDeclineBtn: '拒绝',
    agreementDeclinedWarn: '需同意用户协议方可继续使用。',
    agreementSubmittingBtn: '提交中...',

    homeOverview: '总览',
    homePrimaryAction: '下一步操作',
    rewardsSummary: '收益总览',
    marketStatusTitle: '市场收益状态',
    marketTrendLabel: '市场趋势',
    marketRiskLabel: '风险等级',
    yieldRateTitle: '收益率',
    configuredYieldRateLabel: '后台配置收益率',
    effectiveYieldRateLabel: '当前设备收益率',
    estimatedDailyRewardLabel: '预计日收益',
    rewardTokenTitle: '收益代币',
    totalRewardLabel: '累计收益',
    todayRewardLabel: '今日收益',
    claimableRewardLabel: '预计可领取',
    lockCycleLabel: '锁定周期',
    lockRemainingLabel: '剩余天数',
    lockStatusLabel: '锁定状态',
    earningsCurveTitle: '收益曲线',
    range7dLabel: '近7天',
    deviceSummary: '设备控制台',
    profileSummary: '账户中心',
    walletCardTitle: '钱包信息',
    contractExpiredTitle: '合约已过期',
    contractExpiredBody: '请先续期或更新合约，之后才能继续累计收益。',
    hashrate: '算力值',
    hashrateLockedHint: '算力由管理员统一配置，APP 端不可修改。',
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
    updateHashrate: '算力已锁定，请联系管理员调整。',
    hashrateUpdated: '当前算力：',
    registerMiner: '正在提交链上矿机注册...',
    minerRegistered: '矿机已注册：',
    deviceRecord: '，设备记录 ',
    minerRecovered: '矿机已存在，已完成状态同步。',
    minerRecoverFail: '矿机状态恢复失败：',
    minerFail: '矿机设置失败：',
    minerNotReady: '请先完成矿机设置，再领取收益',
    claimDoing: '正在提交领取交易...',
    claimSuccess: '领取成功：',
    claimFail: '领取失败：',
    invalidSwapAmount: '请输入有效的SUPER数量',
    swapDoing: '正在提交兑换申请...',
    swapSuccess: '兑换申请已提交：',
    swapFail: '兑换申请失败：',
    invalidAddress: '请输入有效的目标地址',
    invalidAmount: '请输入有效转账数量',
    transferDoing: '正在提交转账...',
    transferSuccess: '转账成功：',
    transferFail: '转账失败：',
    errInsufficientBnb: 'BNB 余额不足，无法支付 Gas。请联系管理员充值。',
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
    errMaintenance: '系统维护中，请稍后再试。',
    errAuthInvalid: '鉴权失效或登录状态过期，请重新同步身份后重试。',
    errServerBusy: '服务繁忙，请稍后重试。',
    errInvalidRequest: '请求参数无效，请检查后重试。',
    gasAssistTitle: 'Gas 充值',
    gasAssistHint: 'Gas 不支持用代币兑换，需由管理员充值。',
    gasTokenLabel: '支付代币',
    gasAmountLabel: '支付数量',
    gasQuoteLabel: '预计到账 BNB',
    gasBalanceLabel: '累计补能 BNB',
    gasBuyAndRetry: '申请管理员充值',
    gasAdminHint: 'Gas 只能由管理员充值，代币兑换入口已关闭。',
    gasRequestTopup: '联系管理员充值',
    gasAdminTopupNeeded: 'Gas 只能通过管理员充值获取，请联系管理员或客服。',
    gasBuying: '正在购买 Gas 包...',
    gasReady: 'Gas 包购买完成，正在重试交易...',
    gasFailed: 'Gas 兑换失败：',
    gasIntentPhase2: '二期 Relay 意图已登记。',
    priceUnavailable: '池子价格不可用',
    swapBlockedNoPrice: '兑换不可用：池子价格未就绪（可能未初始化流动性或后台未配置价格）。',
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
    checkUpdateTitle: '应用更新',
    checkUpdateButton: '检查更新',
    checkUpdateHint: '无需重新安装，在线获取最新功能与修复。',
    appVersionLabel: '当前版本',
    inviterTitle: '我的推荐人',
    inviterWallet: '推荐人钱包',
    inviterEmpty: '暂未绑定推荐人',
    referralTitle: '推荐统计',
    referralDirectCount: '直推账号数',
    referralDirectAmount: '直推金额(USDT)',
    referralTeamCount: '团队账号数',
    referralTeamAmount: '团队金额(USDT)',
    referralMembersTitle: '团队成员',
    referralMembersDirectTab: '直推',
    referralMembersTeamTab: '团队',
    referralMembersLevel: '层级',
    referralMembersReward: '累计收益',
    referralMembersJoined: '加入时间',
    referralMembersContract: '合约',
    referralMembersContractActive: '有效',
    referralMembersContractInactive: '停用',
    referralMembersEmpty: '暂无成员数据',
    referralMembersLoading: '正在加载团队成员...',
    referralMembersError: '加载团队成员失败',
    referralMembersPage: '页码',
    referralMembersPrev: '上一页',
    referralMembersNext: '下一页',
  },
} as const;

function createDeviceId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `mobile-${Date.now()}-${random}`;
}

function createDeviceIdFromSeed(seed: string) {
  if (!seed) return createDeviceId();
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  const hex = hash.toString(16).toLowerCase().padStart(8, '0');
  return `mobile-${hex}`;
}

function isInvalidAndroidId(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'unknown') return true;
  if (normalized === '9774d56d682e549c') return true;
  if (/^0+$/.test(normalized)) return true;
  if (/^f+$/.test(normalized)) return true;
  return false;
}

function createInstallSeed(): string {
  const partA = Math.random().toString(36).slice(2, 10);
  const partB = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${partA}-${partB}`;
}

async function getOrCreateInstallSeed(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_INSTALL_SEED_KEY);
    if (existing && existing.trim()) {
      return existing.trim();
    }

    const created = createInstallSeed();
    await AsyncStorage.setItem(DEVICE_INSTALL_SEED_KEY, created);
    return created;
  } catch {
    return createInstallSeed();
  }
}

async function resolveStableDeviceId(): Promise<string> {
  try {
    const androidId = await Application.getAndroidId();
    if (androidId && !isInvalidAndroidId(androidId)) {
      return createDeviceIdFromSeed(`android:${androidId.trim().toLowerCase()}`);
    }
  } catch {
    // ignore and try next source
  }

  try {
    const iosId = await Application.getIosIdForVendorAsync();
    if (iosId) {
      return createDeviceIdFromSeed(`ios:${iosId}`);
    }
  } catch {
    // ignore and fallback
  }

  try {
    const installSeed = await getOrCreateInstallSeed();
    if (installSeed) {
      return createDeviceIdFromSeed(`install:${installSeed}`);
    }
  } catch {
    // ignore and fallback
  }

  return createDeviceId();
}

function isStableDeviceIdFormat(deviceId: string): boolean {
  return /^mobile-[0-9a-f]{8}$/.test(deviceId.trim());
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
  const [gasFundedBnbTotal, setGasFundedBnbTotal] = useState<string>('0');
  const [systemStatus, setSystemStatus] = useState<Awaited<ReturnType<typeof getSystemStatus>> | null>(null);
  const [userDetails, setUserDetails] = useState<Awaited<ReturnType<typeof getUserDetails>> | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  
  // Wallet balances
  const [bnbBalance, setBnbBalance] = useState<string>('0');
  const [superBalance, setSuperBalance] = useState<string>('0');
  const [usdtBalance, setUsdtBalance] = useState<string>('0');
  
  // Import/Export wallet
  const [importWalletVisible, setImportWalletVisible] = useState(false);
  const [importPrivateKey, setImportPrivateKey] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  // OTA 在线更新：启动时静默检查 EAS Updates，发现新版本自动下载并弹窗请求重启
  useAutoUpdate(lang);
  const [localAgreementVersion, setLocalAgreementVersion] = useState<string | null>(null);
  const [agreementSubmitting, setAgreementSubmitting] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingMinimized, setOnboardingMinimized] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [pendingReferralWallet, setPendingReferralWallet] = useState<string>('');
  const [inviterUser, setInviterUser] = useState<Awaited<ReturnType<typeof getUser>> | null>(null);
  const [referralSummary, setReferralSummary] = useState<ReferralSummaryDto | null>(null);
  const [referralMode, setReferralMode] = useState<'direct' | 'team'>('direct');
  const [referralMembers, setReferralMembers] = useState<ReferralMemberDto[]>([]);
  const [referralMembersTotal, setReferralMembersTotal] = useState(0);
  const [referralMembersPage, setReferralMembersPage] = useState(1);
  const [referralMembersLoading, setReferralMembersLoading] = useState(false);
  const [referralMembersError, setReferralMembersError] = useState('');
  const [agreementDeclined, setAgreementDeclined] = useState(false);
  const [agreementError, setAgreementError] = useState('');
  const [announcements, setAnnouncements] = useState<AnnouncementDto[]>([]);
  const [announcementReadIds, setAnnouncementReadIds] = useState<string[]>([]);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string | null>(null);
  const [exchangeOrders, setExchangeOrders] = useState<ExchangeRequestDto[]>([]);
  const [exchangeOrdersLoading, setExchangeOrdersLoading] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);
  const swapConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcementAutoShownRef = useRef(false);
  const machineCodeSyncedRef = useRef<string>('');

  const t = translations[lang] as typeof translations.en;
  const isBusy = activeAction !== '';
  const serverWalletAddress = (typeof userDetails?.wallet === 'string' && userDetails.wallet.trim())
    ? userDetails.wallet.trim()
    : walletAddress;
  const serverUserId = (typeof userDetails?.id === 'string' && userDetails.id.trim())
    ? userDetails.id.trim()
    : userId;
  const serverDeviceId = (typeof userDetails?.devices?.[0]?.device_id === 'string' && userDetails.devices[0].device_id.trim())
    ? userDetails.devices[0].device_id.trim()
    : deviceId;
  const effectiveDeviceId = (serverDeviceId || deviceId).trim();
  const identityReady = Boolean(walletAddress && userId && effectiveDeviceId);
  const inviterWalletFromServer = (typeof userDetails?.inviterWallet === 'string' && userDetails.inviterWallet.trim())
    ? userDetails.inviterWallet.trim()
    : null;
  const maintenanceEnabled = systemStatus?.maintenanceEnabled === true;
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
    return (
      msg.includes('insufficient bnb')
      || msg.includes('insufficient funds')
      || msg.includes('exceeds the balance')
      || (msg.includes('bnb') && msg.includes('余额不足'))
    );
  };

  const extractKnownErrorText = (raw: string): string => {
    const firstLine = raw
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? '';

    if (!firstLine) return '';

    let normalized = firstLine;
    if (normalized.toLowerCase().startsWith('api unavailable:')) {
      normalized = normalized.slice('api unavailable:'.length).trim();
    }

    if ((normalized.startsWith('{') && normalized.endsWith('}')) || (normalized.startsWith('[') && normalized.endsWith(']'))) {
      try {
        const parsed = JSON.parse(normalized);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const obj = parsed as Record<string, unknown>;
          if (typeof obj.error === 'string' && obj.error.trim()) {
            return obj.error.trim();
          }
          if (typeof obj.message === 'string' && obj.message.trim()) {
            return obj.message.trim();
          }
        }
      } catch {
        // keep normalized as-is when payload is not valid JSON.
      }
    }

    return normalized;
  };

  const toFriendlyErrorMessage = (error: unknown): string => {
    const raw = error instanceof Error ? error.message : '';
    const normalized = extractKnownErrorText(raw);
    const msg = normalized.toLowerCase();

    if (msg.includes('insufficient bnb') || msg.includes('insufficient funds') || msg.includes('exceeds the balance')) {
      return t.errInsufficientBnb;
    }
    if (msg.includes('user rejected') || msg.includes('rejected') || msg.includes('denied')) {
      return t.errRejected;
    }

    // Map well-known contract revert reasons to friendly localized text.
    const revertReasonMatch = normalized.match(/(?:Transaction reverted:|reverted with the following reason:?)\s*([^\n]+)/i);
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
    if (msg.includes('system is under maintenance') || msg.includes('maintenance')) {
      return t.errMaintenance;
    }
    if (
      msg.includes('signature verification failed')
      || msg.includes('missing auth headers')
      || msg.includes('nonce already used')
      || msg.includes('timestamp out of range')
      || msg.includes('invalid token')
      || msg.includes('verification error')
    ) {
      return t.errAuthInvalid;
    }
    if (
      msg.includes('internal server error')
      || msg.includes('all bsc upstreams failed')
      || msg.includes('request failed: 5')
    ) {
      return t.errServerBusy;
    }
    if (
      msg.includes('wallet query param is required')
      || msg.includes('unsupported')
      || msg.includes('invalid json-rpc body')
      || msg.includes('payload too large')
      || msg.includes('method not allowed')
    ) {
      return t.errInvalidRequest;
    }
    if (
      msg.includes('network request failed') ||
      msg.includes('failed to fetch') ||
      msg.includes('timeout') ||
      msg.includes('api unavailable')
    ) {
      return t.errNetwork;
    }

    if (!normalized) {
      return t.errNetwork;
    }

    return normalized;
  };

  const shortAddress = useMemo(() => {
    if (!serverWalletAddress) return t.notInit;
    return `${serverWalletAddress.slice(0, 6)}...${serverWalletAddress.slice(-4)}`;
  }, [serverWalletAddress, t.notInit]);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
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
    if (!serverUserId) return '----';
    return serverUserId.replace(/[^0-9]/g, '').slice(0, 4).padEnd(4, '0');
  }, [serverUserId]);

  const machineCode = useMemo(() => {
    const fromServer = (userDetails as { machineCode?: string | null } | null)?.machineCode;
    if (fromServer && typeof fromServer === 'string' && fromServer.trim()) {
      return fromServer.trim();
    }
    return deriveMachineCode(effectiveDeviceId || '');
  }, [userDetails, effectiveDeviceId]);

  const machineCodeForUpload = useMemo(() => {
    if (!isStableDeviceIdFormat(effectiveDeviceId)) {
      return undefined;
    }
    return machineCode;
  }, [effectiveDeviceId, machineCode]);

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

  const deviceHashrate = useMemo(() => {
    const raw = userDetails?.devices?.[0]?.hashrate;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return DEFAULT_DEVICE_HASHRATE;
    }
    return Math.max(1, Math.floor(parsed));
  }, [userDetails?.devices]);

  const swapInputNumber = Number(swapAmount);
  const hasValidSwapInput = Number.isFinite(swapInputNumber) && swapInputNumber > 0;
  const isSwapPriceReady = Boolean(swapPriceValue && swapPriceValue > 0);

  const estimatedUsdt = useMemo(() => {
    if (!hasValidSwapInput || !swapPriceValue || swapPriceValue <= 0) {
      return 0;
    }
    return swapInputNumber / swapPriceValue;
  }, [hasValidSwapInput, swapInputNumber, swapPriceValue]);

  const feeUsdt = useMemo(() => {
    if (estimatedUsdt <= 0) return 0;
    return estimatedUsdt * SWAP_FEE_RATE;
  }, [estimatedUsdt]);

  const minReceiveUsdt = useMemo(() => {
    if (estimatedUsdt <= 0) return 0;
    return estimatedUsdt * (1 - SWAP_SLIPPAGE_RATE);
  }, [estimatedUsdt]);

  const swapBlockedReason = useMemo(() => {
    if (!identityReady) return t.identityNotReady;
    if (!hasValidSwapInput) return t.invalidSwapAmount;
    if (!isSwapPriceReady || estimatedUsdt <= 0) return t.swapBlockedNoPrice;
    return '';
  }, [estimatedUsdt, hasValidSwapInput, identityReady, isSwapPriceReady, t.identityNotReady, t.invalidSwapAmount, t.swapBlockedNoPrice]);

  const swapSubmitDisabled = isBusy || !identityReady || !hasValidSwapInput || !isSwapPriceReady || estimatedUsdt <= 0;

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
      rateUsdtPerHour: parseFiniteNumber(item.rate_usdt_per_hour),
      source: item.source,
      createdAt: item.created_at,
    }));
  }, [userDetails?.rewards]);
  const recentRewardItems = useMemo(
    () =>
      [...rewardRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3)
        .map((item) => ({
          rewardUsdt: item.rewardUsdt,
          source: item.source,
          createdAt: item.createdAt,
        })),
    [rewardRows],
  );

  const monthProgressMinutes = useMemo(() => {
    const profileRate = parseFiniteNumber(userDetails?.rewardRateUsdtPerHour);
    const systemRate = Number(systemStatus?.rewardRateUsdtPerHour ?? 0);
    const defaultRate = profileRate > 0 ? profileRate : Number.isFinite(systemRate) && systemRate > 0 ? systemRate : 0.084;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthStartMs = monthStart.getTime();

    let minutes = 0;
    for (const row of rewardRows) {
      const ts = new Date(row.createdAt).getTime();
      if (Number.isNaN(ts) || ts < monthStartMs) continue;
      const rate = row.rateUsdtPerHour > 0 ? row.rateUsdtPerHour : defaultRate;
      if (rate <= 0) continue;
      minutes += (row.rewardUsdt / rate) * 60;
    }
    return Math.max(0, Math.floor(minutes));
  }, [rewardRows, systemStatus?.rewardRateUsdtPerHour, userDetails?.rewardRateUsdtPerHour]);

  const totalOnlineMinutes = useMemo(() => {
    const profileRate = parseFiniteNumber(userDetails?.rewardRateUsdtPerHour);
    const systemRate = Number(systemStatus?.rewardRateUsdtPerHour ?? 0);
    const defaultRate = profileRate > 0 ? profileRate : Number.isFinite(systemRate) && systemRate > 0 ? systemRate : 0.084;

    let minutes = 0;
    for (const row of rewardRows) {
      const rate = row.rateUsdtPerHour > 0 ? row.rateUsdtPerHour : defaultRate;
      if (rate <= 0) continue;
      minutes += (row.rewardUsdt / rate) * 60;
    }
    return Math.max(0, Math.floor(minutes));
  }, [rewardRows, systemStatus?.rewardRateUsdtPerHour, userDetails?.rewardRateUsdtPerHour]);

  const onlineState = identityReady && (userDetails?.onlineStatus ?? 'offline') === 'online' ? t.online : t.offline;

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

    return values.map((value) => Number(value.toFixed(3)));
  }, [rewardRows]);

  const chartMax = Math.max(...chartValues, 1);
  const totalRewardUsdt = parseFiniteNumber(userDetails?.totalRewardUsdt);
  const totalRewardSuper = parseFiniteNumber(userDetails?.totalRewardSuper);
  const todayRewardUsdt = chartValues[chartValues.length - 1] ?? 0;
  const yesterdayRewardUsdt = chartValues[chartValues.length - 2] ?? 0;
  const claimableRewardUsdt = Math.max(0, totalRewardUsdt);
  const configuredRewardRateUsdtPerHour = useMemo(() => {
    const profileRate = parseFiniteNumber(userDetails?.rewardRateUsdtPerHour);
    if (profileRate > 0) {
      return profileRate;
    }

    const systemRate = Number(systemStatus?.rewardRateUsdtPerHour ?? 0);
    if (Number.isFinite(systemRate) && systemRate > 0) {
      return systemRate;
    }

    return 0.084;
  }, [systemStatus?.rewardRateUsdtPerHour, userDetails?.rewardRateUsdtPerHour]);
  const effectiveRewardRateUsdtPerHour = useMemo(() => {
    const hashrateFactor = Math.max(1, deviceHashrate / DEFAULT_DEVICE_HASHRATE);
    return configuredRewardRateUsdtPerHour * hashrateFactor;
  }, [configuredRewardRateUsdtPerHour, deviceHashrate]);
  const estimatedRewardUsdtPerDay = useMemo(() => effectiveRewardRateUsdtPerHour * 24, [effectiveRewardRateUsdtPerHour]);
  const exchangeModeLabel = useMemo(() => {
    const globalAuto = Boolean(systemStatus?.exchangeAutoEnabled);
    const userAuto = Number(userDetails?.exchangeAutoEnabled ?? 1) === 1;
    const isAuto = globalAuto && userAuto;
    if (lang === 'zh') {
      return isAuto ? '当前模式：自动处理' : '当前模式：人工审核';
    }
    return isAuto ? 'Current mode: auto' : 'Current mode: manual';
  }, [lang, systemStatus?.exchangeAutoEnabled, userDetails?.exchangeAutoEnabled]);
  const showGasAssist = useMemo(() => parseFiniteNumber(bnbBalance) < 0.0005, [bnbBalance]);

  const lockCycleDays = useMemo(() => {
    const startMs = userDetails?.contractStartAt ? new Date(userDetails.contractStartAt).getTime() : NaN;
    const endMs = userDetails?.contractEndAt ? new Date(userDetails.contractEndAt).getTime() : NaN;

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
      return Math.max(1, Math.ceil((endMs - startMs) / 86400_000));
    }

    const profileTerm = Number(userDetails?.contractTermDays);
    if (Number.isFinite(profileTerm) && profileTerm > 0) {
      return Math.max(1, Math.floor(profileTerm));
    }

    const systemTerm = Number(systemStatus?.contractTermDaysDefault);
    if (Number.isFinite(systemTerm) && systemTerm > 0) {
      return Math.max(1, Math.floor(systemTerm));
    }

    return DEFAULT_CONTRACT_TERM_DAYS;
  }, [systemStatus?.contractTermDaysDefault, userDetails?.contractEndAt, userDetails?.contractStartAt, userDetails?.contractTermDays]);

  const lockRemainingDays = useMemo(() => {
    if (!userDetails?.contractEndAt) return null;
    const endMs = new Date(userDetails.contractEndAt).getTime();
    if (Number.isNaN(endMs)) return null;
    const diff = endMs - Date.now();
    if (diff <= 0) return 0;
    return Math.ceil(diff / 86400_000);
  }, [userDetails?.contractEndAt]);

  const lockStatusText = useMemo(() => {
    if (!userDetails?.contractStartAt || !userDetails?.contractEndAt) {
      return lang === 'zh' ? '未激活' : 'Not Activated';
    }
    if (lockRemainingDays === null) {
      return lang === 'zh' ? '合同信息异常' : 'Contract Info Invalid';
    }
    if (lockRemainingDays > 0) {
      return lang === 'zh' ? `合同有效（剩余 ${lockRemainingDays} 天）` : `Active (${lockRemainingDays} days left)`;
    }
    return lang === 'zh' ? '合同已到期，请续期' : 'Expired, renewal required';
  }, [lang, lockRemainingDays, userDetails?.contractEndAt, userDetails?.contractStartAt]);

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

  const requestAdminGasTopup = (action?: ActionType) => {
    const actionText = action
      ? (lang === 'zh' ? `当前操作：${action}。` : `Current action: ${action}.`)
      : '';
    setStatus(`${actionText}${t.gasAdminTopupNeeded}`);
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

        const stableId = await resolveStableDeviceId();
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) {
          const shouldMigrateToStable = isStableDeviceIdFormat(stableId) && existing !== stableId;
          if (shouldMigrateToStable) {
            await AsyncStorage.setItem(DEVICE_ID_KEY, stableId);
            setDeviceId(stableId);
          } else {
            setDeviceId(existing);
          }
          return;
        }

        if (isStableDeviceIdFormat(stableId)) {
          await AsyncStorage.setItem(DEVICE_ID_KEY, stableId);
        }
        setDeviceId(stableId);
      } catch {
        const fallback = await resolveStableDeviceId();
        if (isStableDeviceIdFormat(fallback)) {
          await AsyncStorage.setItem(DEVICE_ID_KEY, fallback).catch(() => null);
        }
        setDeviceId(fallback);
      }
    };

    void initDeviceId();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const done = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        const savedReferralWallet = await AsyncStorage.getItem(REFERRAL_WALLET_KEY);
        const savedMinimized = await AsyncStorage.getItem(ONBOARDING_MINIMIZED_KEY);
        if (cancelled) return;
        if (savedReferralWallet) {
          setPendingReferralWallet(savedReferralWallet);
        }
        setOnboardingMinimized(savedMinimized === '1');
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

  const handleOnboardingComplete = async (referralWallet: string) => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, new Date().toISOString());
      await AsyncStorage.removeItem(ONBOARDING_MINIMIZED_KEY);
      const normalized = referralWallet.trim().toLowerCase();
      await AsyncStorage.setItem(REFERRAL_WALLET_KEY, normalized);
      setPendingReferralWallet(normalized);
    } catch {}
    setOnboardingMinimized(false);
    setOnboardingVisible(false);
  };

  const handleMinimizeOnboarding = () => {
    setOnboardingMinimized(true);
    void AsyncStorage.setItem(ONBOARDING_MINIMIZED_KEY, '1').catch(() => null);
  };

  const handleExpandOnboarding = () => {
    setOnboardingVisible(true);
    setOnboardingMinimized(false);
    void AsyncStorage.setItem(ONBOARDING_MINIMIZED_KEY, '0').catch(() => null);
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
      const message = toFriendlyErrorMessage(error);
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

  const refreshSwapPrice = async (preferredStatus?: Awaited<ReturnType<typeof getSystemStatus>> | null) => {
    try {
      const price = await getSwapPriceOnChain();
      const parsed = Number(price) / 1e18;
      if (Number.isFinite(parsed) && parsed > 0) {
        setSwapPriceValue(parsed);
        return;
      }
    } catch {
      // Fallback to configured backend price below.
    }

    const configuredPrice = Number(preferredStatus?.swapPriceSuperPerUsdt ?? systemStatus?.swapPriceSuperPerUsdt ?? 0);
    if (Number.isFinite(configuredPrice) && configuredPrice > 0) {
      setSwapPriceValue(configuredPrice);
      return;
    }

    const latestStatus = await getSystemStatus().catch(() => null);
    if (latestStatus) {
      setSystemStatus(latestStatus);
      const latestConfiguredPrice = Number(latestStatus.swapPriceSuperPerUsdt ?? 0);
      if (Number.isFinite(latestConfiguredPrice) && latestConfiguredPrice > 0) {
        setSwapPriceValue(latestConfiguredPrice);
        return;
      }
    }

    setSwapPriceValue(null);
  };

  const refreshReferralSummary = async (nextUserId: string) => {
    if (!nextUserId) return;
    const summary = await getReferralSummary(nextUserId);
    setReferralSummary(summary);
  };

  const refreshReferralMembers = async (
    nextUserId: string,
    mode: 'direct' | 'team',
    page: number,
  ) => {
    if (!nextUserId) return;
    setReferralMembersLoading(true);
    setReferralMembersError('');
    const result = await getReferralMembers(nextUserId, mode, page, REFERRAL_PAGE_SIZE);
    if (!result) {
      setReferralMembers([]);
      setReferralMembersTotal(0);
      setReferralMembersError(t.referralMembersError);
      setReferralMembersLoading(false);
      return;
    }
    setReferralMembers(result.items ?? []);
    setReferralMembersTotal(Number(result.total ?? 0));
    setReferralMembersLoading(false);
  };

  const tryBindReferralIfNeeded = async (wallet: string) => {
    if (!pendingReferralWallet) return;
    if (pendingReferralWallet.toLowerCase() === wallet.toLowerCase()) {
      return;
    }
    try {
      await bindReferral(wallet, pendingReferralWallet);
      setPendingReferralWallet('');
      await AsyncStorage.removeItem(REFERRAL_WALLET_KEY).catch(() => null);
    } catch {
      // keep local referral wallet for future retry
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
          if (existing.wallet.toLowerCase() !== address.toLowerCase()) {
            await AsyncStorage.removeItem(USER_ID_KEY).catch(() => null);
          } else {
          await tryBindReferralIfNeeded(existing.wallet);
          setUserId(existing.id);
          const details = await getUserDetails(existing.id);
          setUserDetails(details);
          await refreshReferralSummary(existing.id);
          await refreshSwapPrice(status);
          // Fetch wallet balances
          const balances = await getWalletBalances();
          setBnbBalance(balances.bnb);
          setSuperBalance(balances.super);
          setUsdtBalance(balances.usdt);
          setStatus(t.initDone);
          return;
          }
        }
      }

      // 2. 本地无缓存或服务端已不存在，尝试按钱包地址查找
      const existingByWallet = await getUserByWallet(address);
      if (existingByWallet) {
        await tryBindReferralIfNeeded(existingByWallet.wallet);
        setUserId(existingByWallet.id);
        await AsyncStorage.setItem(USER_ID_KEY, existingByWallet.id).catch(() => null);
        const details = await getUserDetails(existingByWallet.id);
        setUserDetails(details);
        await refreshReferralSummary(existingByWallet.id);
        await refreshSwapPrice(status);
        // Fetch wallet balances
        const balances = await getWalletBalances();
        setBnbBalance(balances.bnb);
        setSuperBalance(balances.super);
        setUsdtBalance(balances.usdt);
        setStatus(t.initDone);
        return;
      }

      // 3. 全新用户，注册并持久化（并发/重试场景下做幂等兜底）
      if (!pendingReferralWallet.trim()) {
        throw new Error(lang === 'zh' ? '请先绑定推荐人地址后再完成注册。' : 'Please bind an inviter wallet before registration.');
      }

      let user = await createUser(address, pendingReferralWallet || undefined, machineCodeForUpload).catch(async (err) => {
        const message = err instanceof Error ? err.message.toLowerCase() : '';
        if (message.includes('unique') || message.includes('already exists') || message.includes('constraint')) {
          return await getUserByWallet(address);
        }
        throw err;
      });
      if (!user) {
        throw new Error(lang === 'zh' ? '身份同步失败：未找到账户' : 'Identity sync failed: user not found');
      }
      setUserId(user.id);
      await AsyncStorage.setItem(USER_ID_KEY, user.id).catch(() => null);
      setPendingReferralWallet('');
      await AsyncStorage.removeItem(REFERRAL_WALLET_KEY).catch(() => null);
      const details = await getUserDetails(user.id);
      setUserDetails(details);
      await refreshReferralSummary(user.id);
      await refreshSwapPrice(status);
      // Fetch wallet balances
      const balances = await getWalletBalances();
      setBnbBalance(balances.bnb);
      setSuperBalance(balances.super);
      setUsdtBalance(balances.usdt);
      setStatus(t.initDone);
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = toFriendlyErrorMessage(error);
      const lower = rawMessage.toLowerCase();
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
    const canonical = serverDeviceId.trim();
    if (!canonical) return;
    if (!isStableDeviceIdFormat(canonical)) return;
    if (canonical === deviceId) return;
    setDeviceId(canonical);
    void AsyncStorage.setItem(DEVICE_ID_KEY, canonical).catch(() => null);
  }, [serverDeviceId, deviceId]);

  useEffect(() => {
    if (!walletAddress || !userId || !machineCodeForUpload) return;
    const syncKey = `${walletAddress.toLowerCase()}|${machineCodeForUpload}`;
    if (machineCodeSyncedRef.current === syncKey) return;

    let cancelled = false;
    void createUser(walletAddress, undefined, machineCodeForUpload)
      .then(() => {
        if (!cancelled) {
          machineCodeSyncedRef.current = syncKey;
        }
      })
      .catch(() => {
        // Ignore transient sync errors; next polling cycle will retry.
      });

    return () => {
      cancelled = true;
    };
  }, [walletAddress, userId, machineCodeForUpload]);

  useEffect(() => {
    if (!walletAddress) return;
    void refreshGasFundedBalance(walletAddress);
  }, [walletAddress]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      setAppState(nextState);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!walletAddress || !userId || !effectiveDeviceId) return;

    let active = true;
    const sendHeartbeat = async () => {
      if (!active) return;
      try {
        await reportDeviceHeartbeat({
          deviceId: effectiveDeviceId,
          userId,
          wallet: walletAddress,
          status: 'active',
          hashrate: deviceHashrate,
        });
        const details = await getUserDetails(userId);
        if (!active) return;
        setUserDetails(details);
      } catch {
        // Heartbeat failures are surfaced via server offline detection; swallow here.
      }
    };

    void sendHeartbeat();
    // Shorten heartbeat to 30s so the admin dashboard detects offline devices promptly.
    const timer = setInterval(() => {
      void sendHeartbeat();
    }, 30_000);

    // Re-send immediately when the app returns to the foreground so a
    // sleeping device is flagged online without waiting a full interval.
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void sendHeartbeat();
      }
    });

    return () => {
      active = false;
      clearInterval(timer);
      appStateSub.remove();
    };
  }, [walletAddress, userId, effectiveDeviceId, deviceHashrate]);

  useEffect(() => {
    if (!identityReady || !userId || !walletAddress) return;

    let cancelled = false;
    let inFlight = false;

    const syncRealtime = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const [status, details, balances] = await Promise.all([
          getSystemStatus().catch(() => null),
          getUserDetails(userId).catch(() => null),
          getWalletBalances().catch(() => null),
        ]);

        if (cancelled) return;
        if (status) setSystemStatus(status);
        if (details) setUserDetails(details);
        if (balances) {
          setBnbBalance(balances.bnb);
          setSuperBalance(balances.super);
          setUsdtBalance(balances.usdt);
        }

        await refreshSwapPrice(status);
        await refreshGasFundedBalance(walletAddress);

        if (activeTab === 'exchange') {
          const items = await getExchangeRequests({ userId, wallet: walletAddress, limit: 10 }).catch(() => []);
          if (!cancelled) setExchangeOrders(items);
        }
      } finally {
        inFlight = false;
      }
    };

    const pollMs = appState === 'active' ? (activeTab === 'exchange' ? 10_000 : 15_000) : 60_000;

    void syncRealtime();
    const timer = setInterval(() => {
      void syncRealtime();
    }, pollMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeTab, appState, identityReady, userId, walletAddress]);

  useEffect(() => {
    if (!userId) {
      setInviterUser(null);
      setReferralSummary(null);
      setReferralMembers([]);
      setReferralMembersTotal(0);
      setReferralMembersPage(1);
      setReferralMembersError('');
      setExchangeOrders([]);
      return;
    }
    void refreshReferralSummary(userId);
  }, [userId]);

  useEffect(() => {
    const parentUserId = userDetails?.parentUserId?.trim();
    if (!parentUserId) {
      setInviterUser(null);
      return;
    }

    let cancelled = false;
    void getUser(parentUserId).then((user) => {
      if (!cancelled) {
        setInviterUser(user);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userDetails?.parentUserId]);

  const refreshExchangeOrders = async (silent = false) => {
    if (!userId || !walletAddress) {
      setExchangeOrders([]);
      return;
    }
    if (!silent) {
      setExchangeOrdersLoading(true);
    }
    try {
      const items = await getExchangeRequests({ userId, wallet: walletAddress, limit: 10 });
      setExchangeOrders(items);
    } catch {
      setExchangeOrders([]);
    } finally {
      if (!silent) {
        setExchangeOrdersLoading(false);
      }
    }
  };

  const hasPendingExchangeOrder = useMemo(
    () => exchangeOrders.some((item) => isExchangeOrderPendingStatus(item.status)),
    [exchangeOrders]
  );

  useEffect(() => {
    if (!userId || !walletAddress) return;
    if (activeTab !== 'exchange') return;
    void refreshExchangeOrders();
  }, [activeTab, userId, walletAddress]);

  useEffect(() => {
    if (!userId || !walletAddress) return;
    if (activeTab !== 'exchange') return;
    if (!hasPendingExchangeOrder) return;

    const timer = setInterval(() => {
      void refreshExchangeOrders(true);
    }, 12000);

    return () => {
      clearInterval(timer);
    };
  }, [activeTab, hasPendingExchangeOrder, userId, walletAddress]);

  useEffect(() => {
    if (!userId) return;
    void refreshReferralMembers(userId, referralMode, referralMembersPage);
  }, [userId, referralMode, referralMembersPage, t.referralMembersError]);

  const startMining = async () => {
    if (!identityReady) {
      setStatus(t.identityNotReady);
      return;
    }

    if (actionsBlocked) {
      setStatus(maintenanceEnabled ? `${t.maintenanceTitle}: ${systemStatus?.maintenanceMessageZh ?? t.maintenanceBody}` : `${t.profileExpire}: ${expireDate}`);
      return;
    }

    setActiveAction('mine');
    setLastTxHash('');
    const finalHashrate = deviceHashrate;

    try {
      if (minerReady) {
        setStatus(`${t.updateHashrate} ${t.gasAdminTopupNeeded}`);
        return;
      }

      setStatus(t.registerMiner);
      const txHash = await registerMinerOnChain(finalHashrate, effectiveDeviceId);
      const device = await registerDevice({
        userId,
        deviceId: effectiveDeviceId,
        hashrate: finalHashrate,
        wallet: walletAddress,
        machineCode: machineCodeForUpload,
      });

      await markMinerReady();
      setLastTxHash(txHash);
      setStatus(`${t.minerRegistered}${shortHash(txHash)}${t.deviceRecord}${device.id}`);
      const [details, balances] = await Promise.all([
        getUserDetails(userId),
        getWalletBalances().catch(() => null),
      ]);
      setUserDetails(details);
      if (balances) {
        setBnbBalance(balances.bnb);
        setSuperBalance(balances.super);
        setUsdtBalance(balances.usdt);
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : '';
      const message = toFriendlyErrorMessage(error);
      const combined = `${rawMessage} ${message}`.toLowerCase();
      const alreadyRegistered = combined.includes('already') && combined.includes('register');

      if (!minerReady && alreadyRegistered) {
        try {
          await registerDevice({
            userId,
            deviceId: effectiveDeviceId,
            hashrate: finalHashrate,
            wallet: walletAddress,
            machineCode: machineCodeForUpload,
          });
          await markMinerReady();
          setStatus(t.minerRecovered);
        } catch (fallbackError) {
          const fallbackMsg = toFriendlyErrorMessage(fallbackError);
          setStatus(`${t.minerRecoverFail}${fallbackMsg}`);
        }
      } else {
        if (isInsufficientBnbError(message)) {
          setStatus(`${t.minerFail}${message} ${t.gasAdminTopupNeeded}`);
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
      const [details, balances] = await Promise.all([
        getUserDetails(userId),
        getWalletBalances().catch(() => null),
      ]);
      setUserDetails(details);
      if (balances) {
        setBnbBalance(balances.bnb);
        setSuperBalance(balances.super);
        setUsdtBalance(balances.usdt);
      }
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        setStatus(`${t.claimFail}${message} ${t.gasAdminTopupNeeded}`);
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

    if (!isSwapPriceReady || estimatedUsdt <= 0) {
      setStatus(t.swapBlockedNoPrice);
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
      const order = await createExchangeRequest({
        userId,
        wallet: walletAddress,
        amountSuper: swapAmount,
        amountUsdt: minReceiveUsdt.toFixed(6),
        note: 'mobile_exchange_request',
      });
      clearSwapConfirmTimer();
      setLastTxHash(order.id);
      setSwapTxStage('success');
      const modeHint = order.mode === 'auto'
        ? (lang === 'zh' ? '自动处理' : 'auto')
        : (lang === 'zh' ? '人工审核' : 'manual');
      setStatus(`${t.swapSuccess}${order.id} (${modeHint})`);
      await Promise.all([
        refreshExchangeOrders(),
        getUserDetails(userId).then(setUserDetails).catch(() => null),
        getWalletBalances().then((balances) => {
          setBnbBalance(balances.bnb);
          setSuperBalance(balances.super);
          setUsdtBalance(balances.usdt);
        }).catch(() => null),
      ]);
    } catch (error) {
      clearSwapConfirmTimer();
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        setStatus(`${t.swapFail}${message} ${t.gasAdminTopupNeeded}`);
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
      const balances = await getWalletBalances().catch(() => null);
      if (balances) {
        setBnbBalance(balances.bnb);
        setSuperBalance(balances.super);
        setUsdtBalance(balances.usdt);
      }
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      if (isInsufficientBnbError(message)) {
        setStatus(`${t.transferFail}${message} ${t.gasAdminTopupNeeded}`);
        return;
      }
      setStatus(`${t.transferFail}${message}`);
    } finally {
      setActiveAction('');
    }
  };

  /**
   * Import wallet from private key.
   * SECURITY: This replaces the current wallet.
   */
  const handleImportWallet = async () => {
    if (!importPrivateKey.trim()) {
      setImportError(lang === 'zh' ? '请输入私钥' : 'Please enter private key');
      return;
    }

    try {
      setImportError('');
      const address = await importWalletPrivateKey(importPrivateKey.trim());
      setImportWalletVisible(false);
      setImportPrivateKey('');
      setWalletAddress(address);
      setStatus(lang === 'zh' ? '钱包已导入，请重新初始化账户' : 'Wallet imported, please reinitialize account');
      // Reset user only; keep device identity stable on same phone.
      setUserId('');
      await AsyncStorage.removeItem(USER_ID_KEY).catch(() => null);
      setTimeout(() => {
        void initializeAccount();
      }, 500);
    } catch (error) {
      const message = toFriendlyErrorMessage(error);
      setImportError(message || (lang === 'zh' ? '导入失败' : 'Import failed'));
    }
  };

  /**
   * Export wallet private key.
   * SECURITY: This should only be called with explicit user consent.
   */
  const handleExportWallet = async () => {
    try {
      const pk = await exportWalletPrivateKey();
      if (pk) {
        await copyToClipboard(pk);
        setCopyState('copied');
        setStatus(lang === 'zh' ? '私钥已复制到剪贴板' : 'Private key copied');
        setTimeout(() => setCopyState('idle'), 2000);
      }
    } catch (error) {
      setCopyState('failed');
      setStatus(lang === 'zh' ? '导出失败' : 'Export failed');
    }
  };

  // Whether miner is chain-registered but not yet admin-activated (contract not active yet)
  const pendingActivation = identityReady && minerReady && !hasActiveContract && !contractExpired;

  // First available contact from systemStatus that has a link
  const firstSupportContact = useMemo(() => {
    const contacts = systemStatus?.supportContacts ?? [];
    for (const c of contacts) {
      if (!c.value?.trim()) continue;
      const v = c.value.trim();
      switch (c.type) {
        case 'telegram': return `https://t.me/${v.replace(/^@/, '')}`;
        case 'whatsapp': return `https://wa.me/${v.replace(/[^0-9]/g, '')}`;
        case 'email': return `mailto:${v}`;
        case 'phone': return `tel:${v.replace(/\s+/g, '')}`;
        case 'url': return v.startsWith('http') ? v : `https://${v}`;
        default: continue;
      }
    }
    return null;
  }, [systemStatus?.supportContacts]);

  const handleContactSupport = () => {
    if (firstSupportContact) {
      import('react-native').then(({ Linking }) => {
        void Linking.openURL(firstSupportContact).catch(() => undefined);
      });
    } else {
      setActiveTab('profile');
    }
  };

  const guideTitle = identityReady && minerReady ? t.guideReadyTitle : t.guideTitle;
  const guideDescription = onboardingVisible
    ? t.guideDescOnboarding
    : !identityReady
      ? t.guideDescInit
      : !minerReady
        ? t.guideDescMine
        : pendingActivation
          ? t.guideDescActivate
          : contractExpired
            ? t.contractExpiredBody
            : t.guideDescReady;
  const guideCtaLabel = onboardingVisible
    ? t.guideCtaOnboarding
    : !identityReady
      ? t.syncIdentity
      : !minerReady
        ? t.setupMiner
        : pendingActivation
          ? t.guideCtaActivate
          : t.claimReward;
  const guideAction = onboardingVisible
    ? handleExpandOnboarding
    : !identityReady
      ? initializeAccount
      : !minerReady
        ? startMining
        : pendingActivation
          ? startMining  // retry miner setup after admin activates
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
      key: 'activation',
      label: t.guideStepActivation,
      status: hasActiveContract
        ? t.guideStepActivationDone
        : minerReady
          ? t.guideStepActivationStatus
          : identityReady
            ? t.guideStepTodo
            : t.guideStepLocked,
      active: identityReady && !hasActiveContract,
      complete: hasActiveContract,
    },
    {
      key: 'miner',
      label: t.guideStepMiner,
      status: minerReady ? t.guideStepDone : hasActiveContract ? t.guideStepTodo : t.guideStepLocked,
      active: hasActiveContract && !minerReady,
      complete: minerReady,
    },
    {
      key: 'reward',
      label: t.guideStepReward,
      status: identityReady && minerReady && hasActiveContract ? t.guideStepTodo : t.guideStepLocked,
      active: identityReady && minerReady && hasActiveContract,
      complete: false,
    },
  ];
  const bottomTabs: Array<{ key: BottomTab; label: string }> = [
    { key: 'home', label: t.tabHome },
    { key: 'earnings', label: t.tabEarnings },
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

  if (agreementNeedsAcceptance && userAgreement && !onboardingVisible) {
    const agreementTitle = (lang === 'zh' ? userAgreement.titleZh : userAgreement.titleEn) || t.agreementModalTitle;
    const agreementContent = (lang === 'zh' ? userAgreement.contentZh : userAgreement.contentEn) || '';
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.scrollContent, { padding: 24 }]}>
          <Text style={{ color: '#67e8f9', fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            {t.agreementModalTitle}
          </Text>
          <Text style={{ color: '#e2f3ff', fontSize: 20, fontWeight: '800', marginBottom: 6 }}>{agreementTitle}</Text>
          <Text style={{ color: '#9cc6ff', fontSize: 13, marginBottom: 20 }}>{t.agreementModalSubtitle}</Text>
          <View style={{ borderRadius: 12, borderWidth: 1, borderColor: '#225b98', backgroundColor: '#082754', padding: 14, maxHeight: 320, marginBottom: 20 }}>
            <ScrollView>
              <Text style={{ color: '#c9e1ff', fontSize: 13, lineHeight: 20 }}>{agreementContent || '...'}</Text>
            </ScrollView>
          </View>
          {agreementError ? <Text style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{agreementError}</Text> : null}
          {agreementDeclined ? <Text style={{ color: '#fbbf24', fontSize: 13, marginBottom: 12 }}>{t.agreementDeclinedWarn}</Text> : null}
          <TouchableOpacity
            style={{ borderRadius: 14, backgroundColor: '#22d3ee', paddingVertical: 14, alignItems: 'center', marginBottom: 12 }}
            onPress={() => { void handleAcceptAgreement(); }}
            disabled={agreementSubmitting}
          >
            <Text style={{ color: '#083344', fontSize: 15, fontWeight: '800' }}>
              {agreementSubmitting ? t.agreementSubmittingBtn : t.agreementAcceptBtn}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ borderRadius: 14, borderWidth: 1, borderColor: '#384f6e', paddingVertical: 12, alignItems: 'center' }}
            onPress={() => setAgreementDeclined(true)}
          >
            <Text style={{ color: '#64748b', fontSize: 14 }}>{t.agreementDeclineBtn}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <OnboardingFlow
        visible={onboardingChecked && onboardingVisible}
        minimized={onboardingMinimized}
        lang={lang}
        machineCode={machineCode}
        initialReferralWallet={pendingReferralWallet}
        onComplete={handleOnboardingComplete}
        onMinimize={handleMinimizeOnboarding}
        onExpand={handleExpandOnboarding}
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

          {!(identityReady && minerReady && hasActiveContract) && !(onboardingVisible && !onboardingMinimized) && (
            <GuideCard
              title={guideTitle}
              description={guideDescription}
              buttonLabel={contractExpired ? t.contractExpiredTitle : guideCtaLabel}
              disabled={isBusy || contractExpired}
              steps={guideSteps}
              onPress={guideAction}
              eyebrowLabel={t.guideEyebrow}
              focusCardLabel={t.guideFocusLabel}
              contactSupportLabel={pendingActivation ? t.guideContactSupport : undefined}
              onContactSupport={pendingActivation ? handleContactSupport : undefined}
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
              walletAddress={serverWalletAddress}
              shortAddress={shortAddress}
              onlineState={onlineState}
              identityReady={identityReady}
              isBusy={isBusy}
              contractExpired={contractExpired}
              totalOnlineMinutes={totalOnlineMinutes}
              monthProgressMinutes={monthProgressMinutes}
              estimatedRewardUsdtPerDay={estimatedRewardUsdtPerDay}
              lang={lang}
              guideCtaLabel={guideCtaLabel}
              guideDescription={guideDescription}
              guideAction={guideAction}
              setActiveTab={setActiveTab}
              onCopyAddress={handleCopyAddress}
              copyState={copyState}
              machineCode={machineCode}
              bnbBalance={bnbBalance}
              superBalance={superBalance}
              usdtBalance={usdtBalance}
              t={t}
            />
          )}

          {activeTab === 'earnings' && (
            <>
              <View style={styles.inlineActionRow}>
                <TouchableOpacity
                  style={styles.inlineActionBtn}
                  onPress={() => setActiveTab('exchange')}
                >
                  <Text style={styles.inlineActionBtnText}>{lang === 'zh' ? '前往兑换中心' : 'Go to Swap Center'}</Text>
                </TouchableOpacity>
              </View>
              <EarningsTab
                marketTrend={marketTrend}
                marketRisk={marketRisk}
                marketHint={marketHint}
                configuredRewardRateUsdtPerHour={configuredRewardRateUsdtPerHour}
                effectiveRewardRateUsdtPerHour={effectiveRewardRateUsdtPerHour}
                estimatedRewardUsdtPerDay={estimatedRewardUsdtPerDay}
                totalRewardUsdt={totalRewardUsdt}
                totalRewardSuper={totalRewardSuper}
                todayRewardUsdt={todayRewardUsdt}
                yesterdayRewardUsdt={yesterdayRewardUsdt}
                claimableRewardUsdt={claimableRewardUsdt}
                rewardTokenSymbol="SUPER"
                lockCycleDays={lockCycleDays}
                lockRemainingDays={lockRemainingDays}
                lockStatusText={lockStatusText}
                totalOnlineMinutes={totalOnlineMinutes}
                monthProgressMinutes={monthProgressMinutes}
                isBusy={isBusy}
                identityReady={identityReady}
                chartValues={chartValues}
                chartMax={chartMax}
                recentRewards={recentRewardItems}
                claimReward={claimReward}
                t={t}
              />
            </>
          )}

          {activeTab === 'exchange' && (
            <ExchangeTab
              lang={lang}
              swapAmount={swapAmount}
              setSwapAmount={setSwapAmount}
              swapPriceText={swapPriceText}
              swapSubmitDisabled={swapSubmitDisabled}
              swapBlockedReason={swapBlockedReason}
              estimatedUsdt={estimatedUsdt}
              feeUsdt={feeUsdt}
              minReceiveUsdt={minReceiveUsdt}
              isBusy={isBusy}
              identityReady={identityReady}
              swapTxStage={swapTxStage}
              gasFundedBnbTotal={gasFundedBnbTotal}
              showGasAssist={showGasAssist}
              refreshSwapPrice={refreshSwapPrice}
              openSwapConfirm={openSwapConfirm}
              requestAdminGasTopup={() => requestAdminGasTopup('swap')}
              exchangeModeLabel={exchangeModeLabel}
              exchangeOrders={exchangeOrders}
              exchangeOrdersLoading={exchangeOrdersLoading}
              refreshExchangeOrders={refreshExchangeOrders}
              txStageLabels={txStageLabels}
              t={t}
            />
          )}

          {activeTab === 'device' && (
            <DeviceTab
              onlineState={onlineState}
              deviceId={serverDeviceId}
              hashrateDisplay={`${deviceHashrate} H/s`}
              totalOnlineMinutes={totalOnlineMinutes}
              monthProgressMinutes={monthProgressMinutes}
              lastSeenAt={userDetails?.lastSeenAt ?? null}
              isBusy={isBusy}
              identityReady={identityReady}
              startMining={startMining}
              initializeAccount={initializeAccount}
              t={t}
            />
          )}

          {activeTab === 'profile' && (
            <ProfileTab
              walletAddress={serverWalletAddress}
              expireDate={expireDate}
              contractExpired={contractExpired}
              machineCode={machineCode}
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
              bnbBalance={bnbBalance}
              superBalance={superBalance}
              usdtBalance={usdtBalance}
              onExportWallet={handleExportWallet}
              onImportWalletClick={() => setImportWalletVisible(true)}
              t={t}
              appVersion={APP_VERSION}
              inviterInfo={userDetails?.parentUserId ? {
                userId: userDetails.parentUserId,
                wallet: inviterWalletFromServer ?? inviterUser?.wallet ?? null,
              } : null}
              referralSummary={referralSummary}
              referralMembers={referralMembers}
              referralMembersMode={referralMode}
              referralMembersTotal={referralMembersTotal}
              referralMembersPage={referralMembersPage}
              referralMembersPageSize={REFERRAL_PAGE_SIZE}
              referralMembersLoading={referralMembersLoading}
              referralMembersError={referralMembersError}
              onReferralModeChange={(mode) => {
                setReferralMode(mode);
                setReferralMembersPage(1);
              }}
              onReferralPageChange={(nextPage) => setReferralMembersPage(nextPage)}
              onCheckUpdate={() => {
                void manualCheckForUpdateFull(APP_VERSION, lang);
              }}
              agreement={userAgreement && userAgreement.version ? {
                required: Boolean(userAgreement.required),
                accepted: acceptedAgreementVersion === userAgreement.version,
                version: userAgreement.version,
                title: (lang === 'zh' ? userAgreement.titleZh : userAgreement.titleEn) || t.agreementTitleFallback,
                content: (lang === 'zh' ? userAgreement.contentZh : userAgreement.contentEn) || '',
                submitting: agreementSubmitting,
                error: agreementError,
                onAccept: () => { void handleAcceptAgreement(); },
              } : null}
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
              <Text style={styles.modalValue}>{swapAmount || '0'} SUPER</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.quote}</Text>
              <Text style={styles.modalValue}>{estimatedUsdt.toFixed(6)} USDT</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.fee}</Text>
              <Text style={styles.modalValue}>{feeUsdt.toFixed(6)} USDT</Text>
            </View>
            <View style={styles.modalRow}>
              <Text style={styles.modalLabel}>{t.minReceive}</Text>
              <Text style={styles.modalValue}>{minReceiveUsdt.toFixed(6)} USDT</Text>
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

      <Modal
        visible={importWalletVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImportWalletVisible(false)}
      >
        <Pressable style={styles.modalMask} onPress={() => setImportWalletVisible(false)}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{lang === 'zh' ? '导入钱包' : 'Import Wallet'}</Text>
            <Text style={styles.modalHint}>{lang === 'zh' ? '⚠️ 这将替换现有钱包，请确保你有备份' : '⚠️ This will replace your current wallet. Make sure you have a backup'}</Text>
            
            <Text style={styles.label}>{lang === 'zh' ? '私钥' : 'Private Key'}</Text>
            <TextInput
              style={styles.input}
              value={importPrivateKey}
              onChangeText={setImportPrivateKey}
              placeholder="0x..."
              placeholderTextColor="#93a9d1"
              editable={!isBusy}
              multiline
              numberOfLines={3}
              secureTextEntry={false}
            />
            
            {importError && <Text style={styles.errorText}>{importError}</Text>}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setImportWalletVisible(false)}>
                <Text style={styles.modalGhostBtnText}>{t.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimaryBtn} onPress={handleImportWallet} disabled={isBusy}>
                <Text style={styles.modalPrimaryBtnText}>{lang === 'zh' ? '导入' : 'Import'}</Text>
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
  inlineActionRow: {
    marginTop: 2,
    marginBottom: 10,
  },
  inlineActionBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    backgroundColor: '#0a2f66',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  inlineActionBtnText: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700',
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
  errorText: {
    color: '#fca5a5',
    fontSize: 12,
    marginTop: 6,
  },
}
);
