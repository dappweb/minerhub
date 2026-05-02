import { Activity, AlertTriangle, CheckCircle2, Eye, EyeOff, LayoutDashboard, Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUnits, isAddress } from 'viem';
import {
    addSwapLiquidityOnChain,
    collectEcosystemFeeOnChain,
    collectPlatformFeeOnChain,
    getGlobalStatsOnChain,
    getMinerInfoOnChain,
    getMiningPoolAddress,
    getMiningPoolAdminsOnChain,
    getMiningPoolOwnerOnChain,
    getSuperTokenAddress,
    getSuperTokenStatsOnChain,
    getSwapPoolStatsOnChain,
    getSwapRouterAddress,
    initializeSwapLiquidityOnChain,
    mintSuperOnChain,
    sendGasToAddressOnChain,
    sendSuperToAddressOnChain,
    sendUsdtToAddressOnChain,
    setMinSuperStakeForRewardOnChain,
    startMiningOnChain,
    type MiningPoolGlobalStats,
    type MiningPoolMinerInfo,
    type SuperTokenStats,
    type SwapPoolStats
} from '../lib/blockchain';
import { useI18n, type TranslationKey } from '../lib/i18n';
import OwnerConsole from './OwnerConsole';

type AdminDashboardProps = {
  fullScreen?: boolean;
  adminWallet: string;
  signMessageAsync: (walletAddress: string, message: string) => Promise<string>;
};

type AdminSessionRole = 'owner' | 'subadmin';

type OwnerSubAdminItem = {
  wallet: string;
  source: 'database' | 'environment';
  note: string | null;
  allowedContractTypes: string[] | null;
  contractTypesLocked: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  canRemove: boolean;
};

const CONTRACT_TYPE_OPTIONS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'one_year', label: '1 year' },
  { id: 'two_year', label: '2 years' },
  { id: 'three_year', label: '3 years' },
] as const;

function formatContractTypes(types: string[] | null | undefined): string {
  if (types === null) return 'Unrestricted';
  if (!types?.length) return 'Not set';
  return types
    .map((type) => CONTRACT_TYPE_OPTIONS.find((option) => option.id === type)?.label ?? type)
    .join(' / ');
}

const HASHRATE_UNIT = 1000;

function formatHashrate(hashrate: bigint): string {
  const mh = Number(hashrate) / HASHRATE_UNIT;
  if (!Number.isFinite(mh)) {
    return '0.000 MH/s';
  }
  return `${mh.toFixed(3)} MH/s`;
}

function formatTokenAmount(amount: bigint): string {
  const parsed = Number(formatUnits(amount, 18));
  if (!Number.isFinite(parsed)) {
    return '0';
  }
  return parsed.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

function formatUsdtAmount(amount: bigint): string {
  const parsed = Number(formatUnits(amount, 18));
  if (!Number.isFinite(parsed)) {
    return '0';
  }
  return parsed.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
}

function formatDecimalString(value?: string | null, digits = 4): string {
  if (value == null || value === '') {
    return '--';
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return parsed.toLocaleString('zh-CN', { maximumFractionDigits: digits });
}

function parseNumberOrDefault(value?: string | null, defaultValue = 0): number {
  if (value == null || value === '') return defaultValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function shortWallet(wallet: string): string {
  if (!wallet) return '--';
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 10)}...${wallet.slice(-6)}`;
}

function isWalletSignRejected(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes('user rejected')
    || message.includes('user denied')
    || message.includes('rejected the request')
    || message.includes('cancelled')
    || message.includes('canceled')
  );
}

function isPrimaryOwnerAccessError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Only primary owner can access owner console APIs');
}

type SupportContact = {
  id: string;
  type: string;
  label: string;
  value: string;
  note: string;
};

type AnnouncementItem = {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  level: 'info' | 'warning' | 'critical';
  target: 'all' | 'active_contract';
  isPublished: boolean;
  isPinned: boolean;
  publishAt: string | null;
  expireAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementFormState = {
  titleZh: string;
  titleEn: string;
  contentZh: string;
  contentEn: string;
  level: 'info' | 'warning' | 'critical';
  target: 'all' | 'active_contract';
  isPinned: boolean;
  isPublished: boolean;
  publishAt: string;
  expireAt: string;
};

function formatDateTimeLocalInput(value?: string | null): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const offset = parsed.getTimezoneOffset();
  const local = new Date(parsed.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function parseDateTimeLocalInput(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '--';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '--';
  return parsed.toLocaleDateString('zh-CN');
}

function formatMonthlyCardEndDate(monthlyCardEndAt?: string | null, contractStartAt?: string | null, monthlyCardDays?: number | null): string {
  if (monthlyCardEndAt) return formatDateOnly(monthlyCardEndAt);
  if (!contractStartAt) return '--';
  const parsedStart = new Date(contractStartAt);
  const parsedDays = Number(monthlyCardDays ?? 30);
  if (Number.isNaN(parsedStart.getTime()) || !Number.isFinite(parsedDays) || parsedDays <= 0) return '--';
  return new Date(parsedStart.getTime() + Math.floor(parsedDays) * 86_400_000).toLocaleDateString('zh-CN');
}

function createEmptyAnnouncementForm(): AnnouncementFormState {
  return {
    titleZh: '',
    titleEn: '',
    contentZh: '',
    contentEn: '',
    level: 'info',
    target: 'all',
    isPinned: false,
    isPublished: false,
    publishAt: '',
    expireAt: '',
  };
}

const CONTACT_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'weixin', label: '微信 WeChat' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: '邮箱 Email' },
  { value: 'qq', label: 'QQ' },
  { value: 'phone', label: '电话 Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'line', label: 'LINE' },
  { value: 'url', label: '网址 URL' },
  { value: 'other', label: '其他 Other' },
];

type SystemStatus = {
  maintenanceEnabled: boolean;
  maintenanceMessageZh: string;
  maintenanceMessageEn: string;
  exchangeAutoEnabled: boolean;
  monthlyCardDays: number;
  contractTermYearsDefault: number;
  contractTermDaysDefault: number;
  rewardRateUsdtPerHour: number;
  payoutWallets: Array<{ walletAddress: string; priority: number; isPrimary: boolean }>;
  supportContacts?: SupportContact[];
  userAgreement?: {
    required: boolean;
    version: string;
    titleZh: string;
    titleEn: string;
    contentZh: string;
    contentEn: string;
  };
};

type CustomerItem = {
  id: string;
  wallet: string;
  email: string | null;
  role: string | null;
  status: string | null;
  referrerWallet?: string | null;
  nickname: string | null;
  machineCode: string | null;
  contractStartAt: string | null;
  contractEndAt: string | null;
  monthlyCardEndAt: string | null;
  contractActive: number;
  activationStatus: string;
  exchangeAutoEnabled: number;
  monthlyCardDays?: number;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  deviceCount: number;
  activeDeviceCount: number;
  subAccountCount: number;
  rewardRateUsdtPerHour?: string | null;
  bnbBalance?: string | null;
  usdtBalance?: string | null;
  superBalance?: string | null;
};

type CustomerRecommendation = {
  customer: CustomerItem;
  score: number;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  actionLabel: string;
  reasons: string[];
  remainDays: number | null;
  expiring: boolean;
  expired: boolean;
  lowGas: boolean;
  offline: boolean;
  missingMachineCode: boolean;
  inactiveDevice: boolean;
  rewardTotal: number;
};

type CustomerDetail = CustomerItem & {
  contractTermDays: number;
  rewardRateUsdtPerHour: string;
  parentUserId: string | null;
  agreementAcceptedAt: string | null;
  offlineAlertedAt: string | null;
  notes: string | null;
};

type CustomerDetailFormState = {
  nickname: string;
  notes: string;
  rewardRateUsdtPerHour: string;
  monthlyCardDays: string;
  devices: Array<{
    id: string;
    deviceId: string;
    hashrate: string;
    status: string;
  }>;
};

function getMinerRegisterBadge(customer: CustomerItem): { text: string; className: string } {
  if (customer.deviceCount <= 0) {
    return {
      text: '未注册',
      className: 'bg-slate-700/60 text-slate-200 border border-slate-600/70',
    };
  }
  if (customer.activeDeviceCount > 0) {
    return {
      text: `已注册(${customer.activeDeviceCount})`,
      className: 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40',
    };
  }
  return {
    text: `已注册(${customer.deviceCount})·停用`,
    className: 'bg-amber-500/20 text-amber-200 border border-amber-500/40',
  };
}

type AdminWalletSummary = {
  wallet: string;
  bnbBalance: string | null;
  usdtBalance: string | null;
  superBalance: string | null;
};

type AdminAlertItem = {
  userId: string;
  wallet: string;
  nickname: string | null;
  machineCode: string | null;
  contractActive: number;
  contractEndAt: string | null;
  lastSeenAt: string | null;
  onlineStatus: 'offline' | 'stale';
  offlineSeconds: number;
  offlineAlertedAt: string | null;
  deviceCount: number;
  activeDeviceCount: number;
};

type AdminAlertResponse = {
  items: AdminAlertItem[];
  counts: { total: number; stale: number; offline: number };
  thresholds: { onlineMs: number; staleMs: number };
  generatedAt: string;
};

type MachineCodeConflictUser = {
  userId: string;
  wallet: string;
  nickname: string | null;
  contractActive: number;
  onlineStatus: 'online' | 'stale' | 'offline';
  deviceCount: number;
  activeDeviceCount: number;
  updatedAt: string;
};

type MachineCodeConflictItem = {
  machineCode: string;
  userCount: number;
  activeContractCount: number;
  users: MachineCodeConflictUser[];
};

type MachineCodeConflictResponse = {
  items: MachineCodeConflictItem[];
  counts: {
    machineCodes: number;
    impactedUsers: number;
    activeContracts: number;
  };
  generatedAt: string;
};

type MachineCodeConflictResolveResponse = {
  ok: boolean;
  resolved: boolean;
  machineCode: string;
  keepUserId: string;
  clearedUserIds: string[];
  blockedActiveUserIds: string[];
  remainingUserIds: string[];
  reason?: string;
};

function formatOfflineDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '未知';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}时${minutes % 60}分`;
  const days = Math.floor(hours / 24);
  return `${days}天${hours % 24}时`;
}

type RechargeRecord = {
  id: string;
  userId: string | null;
  wallet: string;
  payToken: string;
  payAmount: string;
  bnbAmount: string;
  status: string;
  relayMode: string;
  relayTxHash: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type WithdrawalRecord = {
  id: string;
  source: 'claim' | 'exchange';
  userId: string;
  wallet: string | null;
  amountUsdt: string;
  amountSuper: string;
  status: string;
  txHash: string | null;
  payoutWallet: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type ExchangeRecord = {
  id: string;
  userId: string | null;
  wallet: string | null;
  direction: string;
  amountIn: string;
  amountOut: string;
  priceSnapshot: string;
  status: string;
  txHash: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type FundCollectionRecord = {
  id: string;
  requesterWallet: string;
  requesterRole: string;
  sourceUserIds: string[];
  sourceDeviceCount: number;
  targetWallet: string;
  amountUsdt: string;
  amountSuper: string;
  status: string;
  txHash: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type AdminDeviceItem = {
  id: string;
  userId: string;
  wallet: string;
  nickname: string | null;
  machineCode: string | null;
  monthlyCardDays: number;
  notes: string | null;
  deviceId: string;
  hashrate: number;
  deviceStatus: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  contractActive: number;
  contractEndAt: string | null;
  rewardRateUsdtPerHour: string;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  bnbBalance: string | null;
  usdtBalance: string | null;
  superBalance: string | null;
};

type AdminDeviceDetail = AdminDeviceItem & {
  deviceStatusHistory: Array<{
    id: string;
    status: string;
    hashrate: number;
    observedAt: string;
    note: string | null;
  }>;
  rewardLedger: Array<{
    id: string;
    rewardUsdt: string;
    rewardSuper: string;
    rateUsdtPerHour: string;
    source: string;
    note: string | null;
    createdAt: string;
  }>;
};

type DeviceDetailFormState = {
  hashrate: string;
  deviceStatus: string;
  nickname: string;
  machineCode: string;
  notes: string;
  monthlyCardDays: string;
  rewardRateUsdtPerHour: string;
  contractActive: boolean;
  contractEndAt: string;
};

type AdminSection = 'overview' | 'owner' | 'onchain' | 'tokens' | 'funding' | 'customers' | 'records' | 'system' | 'docs';

const SECTION_LABELS: Array<{ id: AdminSection; labelKey: TranslationKey; descKey: TranslationKey }> = [
  { id: 'overview',  labelKey: 'admin.section.overview',  descKey: 'admin.section.overview.desc' },
  { id: 'owner',     labelKey: 'admin.section.owner',     descKey: 'admin.section.owner.desc' },
  { id: 'onchain',   labelKey: 'admin.section.onchain',   descKey: 'admin.section.onchain.desc' },
  { id: 'tokens',    labelKey: 'admin.section.tokens',    descKey: 'admin.section.tokens.desc' },
  { id: 'funding',   labelKey: 'admin.section.funding',   descKey: 'admin.section.funding.desc' },
  { id: 'customers', labelKey: 'admin.section.customers', descKey: 'admin.section.customers.desc' },
  { id: 'records',   labelKey: 'admin.section.records',   descKey: 'admin.section.records.desc' },
  { id: 'system',    labelKey: 'admin.section.system',    descKey: 'admin.section.system.desc' },
  { id: 'docs',      labelKey: 'admin.section.docs',      descKey: 'admin.section.docs.desc' },
];

const BASIC_SECTION_IDS: AdminSection[] = ['overview', 'customers', 'records', 'system'];
const ADVANCED_SECTION_IDS: AdminSection[] = ['owner', 'onchain', 'tokens', 'funding', 'docs'];
const OWNER_ONLY_SECTION_IDS = new Set<AdminSection>(['owner', 'tokens', 'funding', 'records', 'system']);

export default function AdminDashboard({ fullScreen = false, adminWallet, signMessageAsync }: AdminDashboardProps) {
  const { t, locale, setLocale } = useI18n();
  const [section, setSection] = useState<AdminSection>('overview');
  const [showAdvancedNav, setShowAdvancedNav] = useState<boolean>(false);
  const [globalStats, setGlobalStats] = useState<MiningPoolGlobalStats | null>(null);
  const [minerInfo, setMinerInfo] = useState<MiningPoolMinerInfo | null>(null);
  const [superStats, setSuperStats] = useState<SuperTokenStats | null>(null);
  const [swapStats, setSwapStats] = useState<SwapPoolStats | null>(null);
  const [chainOwnerAddress, setChainOwnerAddress] = useState<string>('');
  const [chainAdminAddresses, setChainAdminAddresses] = useState<readonly string[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminWalletSummary | null>(null);
  const [adminAlerts, setAdminAlerts] = useState<AdminAlertResponse | null>(null);
  const [machineCodeConflicts, setMachineCodeConflicts] = useState<MachineCodeConflictResponse | null>(null);
  const [machineCodeKeepUserByCode, setMachineCodeKeepUserByCode] = useState<Record<string, string>>({});
  const [machineCodeResolveLoading, setMachineCodeResolveLoading] = useState<string>('');
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecord[]>([]);
  const [withdrawalRecords, setWithdrawalRecords] = useState<WithdrawalRecord[]>([]);
  const [exchangeRecords, setExchangeRecords] = useState<ExchangeRecord[]>([]);
  const [collectionRecords, setCollectionRecords] = useState<FundCollectionRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState<boolean>(false);
  const [recordsError, setRecordsError] = useState<string>('');
  const [showRecordsDetail, setShowRecordsDetail] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendLoading, setBackendLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [backendError, setBackendError] = useState<string>('');
  const [registering, setRegistering] = useState<boolean>(false);
  const [adminActionLoading, setAdminActionLoading] = useState<string>('');
  const [registerDeviceId, setRegisterDeviceId] = useState<string>(() => `web-${Date.now()}`);
  const [registerHashrate, setRegisterHashrate] = useState<string>('1000');
  const [mintRecipient, setMintRecipient] = useState<string>(adminWallet);
  const [mintAmount, setMintAmount] = useState<string>('1000');
  const [minSuperStakeForReward, setMinSuperStakeForReward] = useState<string>('0');
  const [liquiditySuper, setLiquiditySuper] = useState<string>('1000');
  const [liquidityUsdt, setLiquidityUsdt] = useState<string>('1');
  const [ecosystemRecipient, setEcosystemRecipient] = useState<string>(adminWallet);
  const [deviceFundingAddress, setDeviceFundingAddress] = useState<string>('');
  const [deviceFundingGas, setDeviceFundingGas] = useState<string>('0.01');
  const [deviceFundingSuper, setDeviceFundingSuper] = useState<string>('100');
  const [collectionTargetWallet, setCollectionTargetWallet] = useState<string>('');
  const [collectionNote, setCollectionNote] = useState<string>('');
  const [customerRenewSuperAmount, setCustomerRenewSuperAmount] = useState<string>('100');
  const [activateCustomerId, setActivateCustomerId] = useState<string>('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(() => new Set());
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [customerReferrerFilter, setCustomerReferrerFilter] = useState<string>('');
  const [appliedCustomerReferrerFilter, setAppliedCustomerReferrerFilter] = useState<string>('');
  const [customerStatusFilter, setCustomerStatusFilter] = useState<'all' | 'needs_action' | 'expired' | 'expiring' | 'offline' | 'low_gas'>('needs_action');
  const [customerSortBy, setCustomerSortBy] = useState<'recommend' | 'expiry' | 'reward' | 'rate'>('recommend');
  const [bulkRate, setBulkRate] = useState<string>('0.084');
  const [extendDays, setExtendDays] = useState<string>('30');
  const [selectedCustomerDetailId, setSelectedCustomerDetailId] = useState<string>('');
  const [customerDetailLoading, setCustomerDetailLoading] = useState<boolean>(false);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState<CustomerDetail | null>(null);
  const [customerDetailForm, setCustomerDetailForm] = useState<CustomerDetailFormState | null>(null);
  const [activateMachineCode, setActivateMachineCode] = useState<string>('');
  const [activateTermYears, setActivateTermYears] = useState<'1' | '2' | '3'>('3');
  const [maintenanceMessageZh, setMaintenanceMessageZh] = useState<string>('系统维护中，请稍后再试。');
  const [maintenanceMessageEn, setMaintenanceMessageEn] = useState<string>('System maintenance in progress. Please try again later.');
  const [monthlyCardDays, setMonthlyCardDays] = useState<string>('30');
  const [contractTermDays, setContractTermDays] = useState<string>('1095');
  const [rewardRatePerHour, setRewardRatePerHour] = useState<string>('0.084');
  const [agreementRequired, setAgreementRequired] = useState<boolean>(false);
  const [agreementVersion, setAgreementVersion] = useState<string>('1.0.0');
  const [agreementTitleZh, setAgreementTitleZh] = useState<string>('用户协议');
  const [agreementTitleEn, setAgreementTitleEn] = useState<string>('User Agreement');
  const [agreementContentZh, setAgreementContentZh] = useState<string>('');
  const [agreementContentEn, setAgreementContentEn] = useState<string>('');
  const [contractRequired, setContractRequired] = useState<boolean>(false);
  const [contractVersion, setContractVersion] = useState<string>('1.0.0');
  const [contractTitleZh, setContractTitleZh] = useState<string>('用户挖矿合同');
  const [contractTitleEn, setContractTitleEn] = useState<string>('Mining Contract');
  const [contractContentZh, setContractContentZh] = useState<string>('');
  const [contractContentEn, setContractContentEn] = useState<string>('');
  const [supportContacts, setSupportContacts] = useState<SupportContact[]>([]);
  const [systemSettingsDirty, setSystemSettingsDirty] = useState<boolean>(false);
  const [ownerSubAdmins, setOwnerSubAdmins] = useState<OwnerSubAdminItem[]>([]);
  const [newSubAdminWallet, setNewSubAdminWallet] = useState<string>('');
  const [newSubAdminNote, setNewSubAdminNote] = useState<string>('');
  const [newSubAdminContractTypes, setNewSubAdminContractTypes] = useState<string[]>(['three_year']);
  const [subAdminAccessLoading, setSubAdminAccessLoading] = useState<boolean>(false);
  const [subAdminAccessMessage, setSubAdminAccessMessage] = useState<string>('');
  const [subAdminManagementAllowed, setSubAdminManagementAllowed] = useState<boolean>(true);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [announcementForm, setAnnouncementForm] = useState<AnnouncementFormState>(() => createEmptyAnnouncementForm());
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string>('');
  const [announcementFilter, setAnnouncementFilter] = useState<'all' | 'active' | 'published' | 'draft' | 'expired'>('all');
  const [devices, setDevices] = useState<AdminDeviceItem[]>([]);
  const [devicesLoading, setDevicesLoading] = useState<boolean>(false);
  const [deviceSearch, setDeviceSearch] = useState<string>('');
  const deviceSearchRef = useRef<string>('');
  useEffect(() => {
    deviceSearchRef.current = deviceSearch;
  }, [deviceSearch]);
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<'all' | 'online' | 'offline' | 'active' | 'inactive' | 'contract_active' | 'contract_expired'>('all');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<string>>(() => new Set());
  const [bulkDeviceRate, setBulkDeviceRate] = useState<string>('0.084');
  const [bulkDeviceExtendDays, setBulkDeviceExtendDays] = useState<string>('30');
  const [bulkDeviceStatus, setBulkDeviceStatus] = useState<string>('active');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [deviceDetail, setDeviceDetail] = useState<AdminDeviceDetail | null>(null);
  const [deviceDetailForm, setDeviceDetailForm] = useState<DeviceDetailFormState | null>(null);
  const [ownerSessionToken, setOwnerSessionToken] = useState<string>(() => sessionStorage.getItem('ownerJwt') || '');
  const [ownerSessionExpiresAt, setOwnerSessionExpiresAt] = useState<string>(() => sessionStorage.getItem('ownerJwtExp') || '');
  const [ownerSessionRole, setOwnerSessionRole] = useState<AdminSessionRole | ''>(() => {
    const raw = sessionStorage.getItem('ownerJwtRole');
    return raw === 'owner' || raw === 'subadmin' ? raw : '';
  });
  const [ownerSessionAutoLoginPaused, setOwnerSessionAutoLoginPaused] = useState(false);
  const ownerLoginPromiseRef = useRef<Promise<string> | null>(null);
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://api.coinplanets.net';

  const poolAddress = getMiningPoolAddress();
  const superAddress = getSuperTokenAddress();
  const swapRouterAddress = getSwapRouterAddress();
  const isSubAdminReadOnly = ownerSessionRole === 'subadmin';
  const canOperateCustomers = ownerSessionRole === 'owner';

  const hasValidOwnerSession = useCallback(() => {
    if (!ownerSessionToken || !ownerSessionExpiresAt) return false;
    return new Date(ownerSessionExpiresAt).getTime() > Date.now() + 5_000;
  }, [ownerSessionExpiresAt, ownerSessionToken]);

  const markSystemSettingsDirty = useCallback(() => {
    setSystemSettingsDirty(true);
  }, []);

  const persistOwnerSession = useCallback((token: string, expiresAt: string, role?: AdminSessionRole) => {
    sessionStorage.setItem('ownerJwt', token);
    sessionStorage.setItem('ownerJwtExp', expiresAt);
    if (role === 'owner' || role === 'subadmin') {
      sessionStorage.setItem('ownerJwtRole', role);
      setOwnerSessionRole(role);
    }
    setOwnerSessionToken(token);
    setOwnerSessionExpiresAt(expiresAt);
    setOwnerSessionAutoLoginPaused(false);
  }, []);

  const clearOwnerSession = useCallback(() => {
    sessionStorage.removeItem('ownerJwt');
    sessionStorage.removeItem('ownerJwtExp');
    sessionStorage.removeItem('ownerJwtWallet');
    sessionStorage.removeItem('ownerJwtRole');
    setOwnerSessionToken('');
    setOwnerSessionExpiresAt('');
    setOwnerSessionRole('');
  }, []);

  const ensureOwnerSession = useCallback(async (opts?: { force?: boolean }): Promise<string> => {
    if (hasValidOwnerSession()) {
      return ownerSessionToken;
    }

    if (ownerSessionAutoLoginPaused && !opts?.force) {
      throw new Error('管理员会话已暂停自动签名，请点击“重新钱包登录”后重试。');
    }

    if (ownerLoginPromiseRef.current) {
      return ownerLoginPromiseRef.current;
    }

    const loginPromise = (async () => {
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ts = Date.now();
      const message = `coinplanet-owner|login|${nonce}|${ts}`;
      const signature = await signMessageAsync(adminWallet, message);
      const response = await fetch(`${apiBaseUrl}/api/owner/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: adminWallet, signature, nonce, ts }),
      });

      if (!response.ok) {
        throw new Error((await response.text()) || `Owner login failed: ${response.status}`);
      }

      const data = (await response.json()) as { token: string; expiresAt: string; role?: AdminSessionRole };
      persistOwnerSession(data.token, data.expiresAt, data.role);
      return data.token;
    })();

    ownerLoginPromiseRef.current = loginPromise;
    try {
      return await loginPromise;
    } catch (error) {
      if (isWalletSignRejected(error)) {
        setOwnerSessionAutoLoginPaused(true);
      }
      clearOwnerSession();
      throw error;
    } finally {
      ownerLoginPromiseRef.current = null;
    }
  }, [adminWallet, apiBaseUrl, clearOwnerSession, hasValidOwnerSession, ownerSessionAutoLoginPaused, ownerSessionToken, persistOwnerSession, signMessageAsync]);

  const buildSignedHeaders = useCallback(async (path: string, body: Record<string, unknown>) => {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    // Backend verifies signature against URL pathname only (query string is stripped),
    // so we must sign pathname only — otherwise GETs with query parameters fail.
    const pathnameForSig = path.split('?')[0];
    const message = `coinplanet|${nonce}|${pathnameForSig}|${JSON.stringify(body)}`;
    const signature = await signMessageAsync(adminWallet, message);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-wallet': adminWallet,
      'x-nonce': nonce,
      'x-signature': signature,
    };

    if (hasValidOwnerSession()) {
      headers.authorization = `Bearer ${ownerSessionToken}`;
    }

    return headers;
  }, [adminWallet, hasValidOwnerSession, ownerSessionToken, signMessageAsync]);

  const signedRequest = useCallback(async <T,>(path: string, method: string, body: Record<string, unknown> = {}): Promise<T> => {
    let token = await ensureOwnerSession({ force: true });
    const makeHeaders = async (t: string): Promise<Record<string, string>> => {
      const signedBody = method === 'GET' || method === 'HEAD' ? {} : body;
      const headers = await buildSignedHeaders(path, signedBody);
      headers.authorization = `Bearer ${t}`;
      return headers;
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const requestInit: RequestInit = {
        method,
        headers: await makeHeaders(token),
      };
      if (method !== 'GET' && method !== 'HEAD') {
        requestInit.body = JSON.stringify(body);
      }
      const response = await fetch(`${apiBaseUrl}${path}`, requestInit);

      if (response.status === 401 && attempt === 0) {
        clearOwnerSession();
        token = await ensureOwnerSession({ force: true });
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }
      return (await response.json()) as T;
    }

    throw new Error('Owner write retry exhausted');
  }, [apiBaseUrl, buildSignedHeaders, clearOwnerSession, ensureOwnerSession]);

  const ownerReadRequest = useCallback(async <T,>(path: string): Promise<T> => {
    if (!hasValidOwnerSession()) {
      throw new Error('管理数据未登录，请点击“重新钱包登录”。');
    }

    let token = ownerSessionToken;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 && attempt === 0) {
        clearOwnerSession();
        setOwnerSessionAutoLoginPaused(true);
        throw new Error('管理会话已过期，请点击“重新钱包登录”。');
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    }

    throw new Error('Owner read retry exhausted');
  }, [apiBaseUrl, clearOwnerSession, hasValidOwnerSession, ownerSessionToken]);

  const loadBackendData = useCallback(async () => {
    if (!adminWallet) return;
    if (!hasValidOwnerSession()) {
      setBackendLoading(false);
      setBackendError('管理数据未登录，请点击右上角“重新钱包登录”。');
      return;
    }

    try {
      setBackendError('');
      setBackendLoading(true);

      const customerQuery = new URLSearchParams();
      if (appliedCustomerReferrerFilter) {
        customerQuery.set('referrerWallet', appliedCustomerReferrerFilter);
      }
      const customersPath = `/api/admin/customers${customerQuery.toString() ? `?${customerQuery.toString()}` : ''}`;
      const announcementsPath = `/api/announcements/admin${announcementFilter === 'all' ? '' : `?status=${announcementFilter}`}`;
      const warnings: string[] = [];
      const announcementsPromise = ownerReadRequest<{ items: AnnouncementItem[] }>(announcementsPath)
        .catch((err: unknown) => {
          warnings.push(`公告列表同步失败: ${err instanceof Error ? err.message : String(err)}`);
          return { items: [] as AnnouncementItem[] };
        });

      const statusPromise = fetch(`${apiBaseUrl}/api/system/status`)
        .then(async (response) => {
          if (!response.ok) {
            const text = await response.text().catch(() => '');
            warnings.push(`系统状态同步失败(${response.status}) ${text || ''}`.trim());
            return null;
          }
          return (await response.json()) as SystemStatus;
        })
        .catch((err: unknown) => {
          warnings.push(`系统状态同步失败: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        });

      const [statusResponse, customersResponse, announcementsResponse, alertsResponse, machineCodeConflictsResponse] = await Promise.all([
        statusPromise,
        ownerReadRequest<{ items: CustomerItem[]; admin: AdminWalletSummary | null }>(customersPath),
        announcementsPromise,
        ownerReadRequest<AdminAlertResponse>('/api/admin/alerts').catch((err: unknown) => {
          warnings.push(`掉线告警同步失败: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }),
        ownerReadRequest<MachineCodeConflictResponse>('/api/admin/machine-code-conflicts?limit=30').catch((err: unknown) => {
          warnings.push(`设备标识冲突同步失败: ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }),
      ]);

      setSystemStatus(statusResponse);
      setCustomers(customersResponse.items ?? []);
      setAdminSummary(customersResponse.admin ?? null);
      setAnnouncements(announcementsResponse.items ?? []);
      setAdminAlerts(alertsResponse);
      setMachineCodeConflicts(machineCodeConflictsResponse);
      if (warnings.length > 0) {
        setBackendError(warnings.join('；'));
      }
    } catch (loadError) {
      setBackendError(loadError instanceof Error ? loadError.message : '读取后台数据失败');
    } finally {
      setBackendLoading(false);
    }
  }, [adminWallet, apiBaseUrl, announcementFilter, appliedCustomerReferrerFilter, hasValidOwnerSession, ownerReadRequest]);

  const reloginOwnerSession = useCallback(async () => {
    try {
      setBackendError('');
      await ensureOwnerSession({ force: true });
      await loadBackendData();
    } catch (error) {
      const message = error instanceof Error ? error.message : '管理员登录失败';
      setBackendError(`管理员重新登录失败：${message}`);
    }
  }, [ensureOwnerSession, loadBackendData]);

  const loadRecords = useCallback(async () => {
    if (!adminWallet) return;
    if (!hasValidOwnerSession()) {
      setRecordsError('管理数据未登录，请先重新钱包登录。');
      return;
    }

    try {
      setRecordsError('');
      setRecordsLoading(true);
      const collections = await ownerReadRequest<{ items: FundCollectionRecord[] }>('/api/admin/collection-requests?limit=200');
      setCollectionRecords(collections.items ?? []);
      if (ownerSessionRole === 'owner') {
        const [recharges, withdrawals, exchanges] = await Promise.all([
          ownerReadRequest<{ items: RechargeRecord[] }>('/api/admin/records/recharges?limit=200'),
          ownerReadRequest<{ items: WithdrawalRecord[] }>('/api/admin/records/withdrawals?limit=200'),
          ownerReadRequest<{ items: ExchangeRecord[] }>('/api/admin/records/exchanges?limit=200'),
        ]);
        setRechargeRecords(recharges.items ?? []);
        setWithdrawalRecords(withdrawals.items ?? []);
        setExchangeRecords(exchanges.items ?? []);
      } else {
        setRechargeRecords([]);
        setWithdrawalRecords([]);
        setExchangeRecords([]);
      }
    } catch (loadError) {
      setRecordsError(loadError instanceof Error ? loadError.message : '读取交易记录失败');
    } finally {
      setRecordsLoading(false);
    }
  }, [adminWallet, hasValidOwnerSession, ownerReadRequest, ownerSessionRole]);

  const loadDevices = useCallback(async () => {
    if (!adminWallet) return;
    if (!hasValidOwnerSession()) {
      setBackendError('管理数据未登录，请先重新钱包登录。');
      return;
    }

    try {
      setDevicesLoading(true);
      const query = new URLSearchParams();
      const searchValue = deviceSearchRef.current.trim();
      if (searchValue) query.set('search', searchValue);
      if (deviceStatusFilter !== 'all') query.set('status', deviceStatusFilter);
      query.set('limit', '200');
      const path = `/api/admin/devices${query.toString() ? `?${query.toString()}` : ''}`;
      const response = await ownerReadRequest<{ items: AdminDeviceItem[]; total: number }>(path);
      setDevices(response.items ?? []);
      setSelectedDeviceIds((prev) => {
        const existing = new Set((response.items ?? []).map((item) => item.id));
        const next = new Set<string>();
        prev.forEach((id) => {
          if (existing.has(id)) next.add(id);
        });
        return next;
      });
    } catch (loadError) {
      setBackendError(loadError instanceof Error ? loadError.message : '读取设备列表失败');
    } finally {
      setDevicesLoading(false);
    }
  }, [adminWallet, deviceStatusFilter, hasValidOwnerSession, ownerReadRequest]);

  const toggleDeviceSelection = useCallback((deviceId: string) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }, []);

  const loadDeviceDetail = useCallback(async (deviceRecordId: string) => {
    if (!deviceRecordId) return;
    if (!hasValidOwnerSession()) {
      setBackendError('管理数据未登录，请先重新钱包登录。');
      return;
    }

    try {
      const detail = await ownerReadRequest<AdminDeviceDetail>(`/api/admin/devices/${deviceRecordId}`);
      setDeviceDetail(detail);
      setDeviceDetailForm({
        hashrate: String(detail.hashrate ?? 0),
        deviceStatus: detail.deviceStatus ?? 'active',
        nickname: detail.nickname ?? '',
        machineCode: detail.machineCode ?? '',
        notes: detail.notes ?? '',
        monthlyCardDays: String(detail.monthlyCardDays ?? 30),
        rewardRateUsdtPerHour: detail.rewardRateUsdtPerHour ?? '0.084',
        contractActive: detail.contractActive === 1,
        contractEndAt: formatDateTimeLocalInput(detail.contractEndAt),
      });
    } catch (loadError) {
      setBackendError(loadError instanceof Error ? loadError.message : '读取设备详情失败');
    }
  }, [hasValidOwnerSession, ownerReadRequest]);

  const handleSaveDeviceDetail = async () => {
    if (!deviceDetail || !deviceDetailForm) return;
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能保存设备设置。');
      return;
    }
    const hashrateNum = Number(deviceDetailForm.hashrate);
    const monthlyDaysNum = Number(deviceDetailForm.monthlyCardDays);
    const rateNum = Number(deviceDetailForm.rewardRateUsdtPerHour);
    if (!Number.isFinite(hashrateNum) || hashrateNum < 0) {
      setBackendError('设备算力必须是大于等于 0 的数字');
      return;
    }
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setBackendError('收益率必须是非负数');
      return;
    }
    if (!Number.isFinite(monthlyDaysNum) || monthlyDaysNum < 1) {
      setBackendError('月卡天数必须大于等于 1');
      return;
    }
    try {
      setAdminActionLoading(`device-save-${deviceDetail.id}`);
      setBackendError('');
      const payload = {
        hashrate: Math.floor(hashrateNum),
        deviceStatus: deviceDetailForm.deviceStatus,
        nickname: deviceDetailForm.nickname,
        machineCode: deviceDetailForm.machineCode,
        notes: deviceDetailForm.notes,
        monthlyCardDays: Math.floor(monthlyDaysNum),
        rewardRateUsdtPerHour: String(rateNum),
        contractActive: deviceDetailForm.contractActive,
        contractEndAt: parseDateTimeLocalInput(deviceDetailForm.contractEndAt),
      };
      const updated = await signedRequest<AdminDeviceDetail>(`/api/admin/devices/${deviceDetail.id}`, 'PATCH', payload);
      setDeviceDetail(updated);
      setDeviceDetailForm({
        hashrate: String(updated.hashrate ?? 0),
        deviceStatus: updated.deviceStatus ?? 'active',
        nickname: updated.nickname ?? '',
        machineCode: updated.machineCode ?? '',
        notes: updated.notes ?? '',
        monthlyCardDays: String(updated.monthlyCardDays ?? 30),
        rewardRateUsdtPerHour: updated.rewardRateUsdtPerHour ?? '0.084',
        contractActive: updated.contractActive === 1,
        contractEndAt: formatDateTimeLocalInput(updated.contractEndAt),
      });
      await loadDevices();
      await loadBackendData();
    } catch (saveError) {
      setBackendError(saveError instanceof Error ? saveError.message : '保存设备信息失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleBulkDeviceUpdate = useCallback(async (mode: 'rate' | 'extend' | 'monthlyRenew' | 'status') => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能批量修改设备或续月卡。');
      return;
    }
    const deviceIds = Array.from(selectedDeviceIds);
    if (deviceIds.length === 0) {
      setBackendError('请先勾选至少一个设备');
      return;
    }

    const payload: Record<string, unknown> = { deviceIds };
    if (mode === 'rate') {
      const rateNum = Number(bulkDeviceRate);
      if (!Number.isFinite(rateNum) || rateNum < 0) {
        setBackendError('批量收益率必须是非负数');
        return;
      }
      payload.rewardRateUsdtPerHour = String(rateNum);
    }
    if (mode === 'extend') {
      const days = Number(bulkDeviceExtendDays);
      if (!Number.isFinite(days) || days < 1) {
        setBackendError('续期天数必须大于等于 1');
        return;
      }
      payload.mode = 'custom';
      payload.extendDays = Math.floor(days);
    }
    if (mode === 'monthlyRenew') {
      payload.mode = 'monthly';
    }
    if (mode === 'status') {
      payload.deviceStatus = bulkDeviceStatus;
    }

    const actionLabel =
      mode === 'rate'
        ? `将 ${deviceIds.length} 台设备收益率改为 ${bulkDeviceRate} USDT/h`
        : mode === 'extend'
          ? `为 ${deviceIds.length} 台设备续期 ${Math.floor(Number(bulkDeviceExtendDays))} 天`
          : mode === 'monthlyRenew'
            ? `为 ${deviceIds.length} 台设备按月续期`
            : `将 ${deviceIds.length} 台设备状态改为 ${bulkDeviceStatus}`;
    if (!window.confirm(`确认${actionLabel}？`)) return;

    try {
      setBackendError('');
      setAdminActionLoading(`bulk-device-${mode}`);
      await signedRequest<{ ok: boolean; updated: number }>('/api/admin/devices/bulk-update', 'POST', payload);
      await loadDevices();
      if (selectedDeviceId) {
        await loadDeviceDetail(selectedDeviceId);
      }
      await loadBackendData();
    } catch (actionError) {
      setBackendError(actionError instanceof Error ? actionError.message : '批量设备操作失败');
    } finally {
      setAdminActionLoading('');
    }
  }, [
    selectedDeviceIds,
    bulkDeviceRate,
    bulkDeviceExtendDays,
    bulkDeviceStatus,
    signedRequest,
    loadDevices,
    selectedDeviceId,
    loadDeviceDetail,
    loadBackendData,
    canOperateCustomers,
  ]);

  const handleResolveMachineCodeConflict = useCallback(async (item: MachineCodeConflictItem) => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能处理设备标识冲突。');
      return;
    }
    const fallbackKeepUser =
      item.users.find((user) => user.contractActive === 1)?.userId
      ?? item.users[0]?.userId
      ?? '';
    const keepUserId = machineCodeKeepUserByCode[item.machineCode] || fallbackKeepUser;
    if (!keepUserId) {
      setBackendError('缺少保留账号，无法处理设备标识冲突');
      return;
    }

    const keepUser = item.users.find((user) => user.userId === keepUserId);
    const keepLabel = keepUser?.nickname || `${keepUser?.wallet.slice(0, 10)}...${keepUser?.wallet.slice(-6)}` || keepUserId;
    if (!window.confirm(`确认将设备标识 ${item.machineCode} 保留给 ${keepLabel}，并清理其余账号绑定？`)) {
      return;
    }

    try {
      setBackendError('');
      setMachineCodeResolveLoading(item.machineCode);
      const response = await signedRequest<MachineCodeConflictResolveResponse>('/api/admin/machine-code-conflicts/resolve', 'POST', {
        machineCode: item.machineCode,
        keepUserId,
      });

      if (response.blockedActiveUserIds.length > 0) {
        setBackendError(`已部分处理：${response.clearedUserIds.length} 个账号已清理，${response.blockedActiveUserIds.length} 个有效合约账号被保护未清理。`);
      }
      await loadBackendData();
    } catch (error) {
      setBackendError(error instanceof Error ? error.message : '处理设备标识冲突失败');
    } finally {
      setMachineCodeResolveLoading('');
    }
  }, [canOperateCustomers, loadBackendData, machineCodeKeepUserByCode, signedRequest]);

  const refreshOnChainData = useCallback(async () => {
    if (!poolAddress || !adminWallet) {
      setError('未配置矿池合约地址，无法读取链上数据。');
      setLoading(false);
      return;
    }

    try {
      setError('');
      setLoading(true);
      const [global, miner] = await Promise.all([
        getGlobalStatsOnChain(),
        getMinerInfoOnChain(adminWallet as `0x${string}`),
      ]);

      const [superToken, swapPool, chainOwner, chainAdmins] = await Promise.all([
        superAddress ? getSuperTokenStatsOnChain().catch(() => null) : Promise.resolve(null),
        swapRouterAddress ? getSwapPoolStatsOnChain().catch(() => null) : Promise.resolve(null),
        getMiningPoolOwnerOnChain().catch(() => '' as `0x${string}`),
        getMiningPoolAdminsOnChain().catch(() => [] as `0x${string}`[]),
      ]);

      setGlobalStats(global);
      setMinerInfo(miner);
      setSuperStats(superToken);
      setSwapStats(swapPool);
      setChainOwnerAddress(chainOwner);
      setChainAdminAddresses(chainAdmins);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '读取链上数据失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [adminWallet, poolAddress, superAddress, swapRouterAddress]);

  useEffect(() => {
    if (!globalStats?.stakeGateSupported) return;
    setMinSuperStakeForReward(formatTokenAmount(globalStats.minSuperStakeForReward).replace(/,/g, ''));
  }, [globalStats?.minSuperStakeForReward, globalStats?.stakeGateSupported]);

  useEffect(() => {
    setMintRecipient(adminWallet);
    setEcosystemRecipient(adminWallet);
  }, [adminWallet]);

  useEffect(() => {
    const storedWallet = sessionStorage.getItem('ownerJwtWallet') || '';
    const normalizedWallet = adminWallet.toLowerCase();
    if (!normalizedWallet) {
      clearOwnerSession();
      sessionStorage.removeItem('ownerJwtWallet');
      return;
    }
    if (storedWallet && storedWallet !== normalizedWallet) {
      clearOwnerSession();
    }
    sessionStorage.setItem('ownerJwtWallet', normalizedWallet);
  }, [adminWallet, clearOwnerSession]);

  useEffect(() => {
    if (!systemStatus) return;
    if (systemSettingsDirty) return;
    setMaintenanceMessageZh(systemStatus.maintenanceMessageZh);
    setMaintenanceMessageEn(systemStatus.maintenanceMessageEn);
    setMonthlyCardDays(systemStatus.monthlyCardDays.toString());
    setContractTermDays(systemStatus.contractTermDaysDefault.toString());
    setRewardRatePerHour(systemStatus.rewardRateUsdtPerHour.toString());
    if (systemStatus.userAgreement) {
      setAgreementRequired(Boolean(systemStatus.userAgreement.required));
      setAgreementVersion(systemStatus.userAgreement.version ?? '1.0.0');
      setAgreementTitleZh(systemStatus.userAgreement.titleZh ?? '用户协议');
      setAgreementTitleEn(systemStatus.userAgreement.titleEn ?? 'User Agreement');
      setAgreementContentZh(systemStatus.userAgreement.contentZh ?? '');
      setAgreementContentEn(systemStatus.userAgreement.contentEn ?? '');
    }
    if (systemStatus.contract) {
      setContractRequired(Boolean(systemStatus.contract.required));
      setContractVersion(systemStatus.contract.version ?? '1.0.0');
      setContractTitleZh(systemStatus.contract.titleZh ?? '用户挖矿合同');
      setContractTitleEn(systemStatus.contract.titleEn ?? 'Mining Contract');
      setContractContentZh(systemStatus.contract.contentZh ?? '');
      setContractContentEn(systemStatus.contract.contentEn ?? '');
    }
    setSupportContacts(
      Array.isArray(systemStatus.supportContacts)
        ? systemStatus.supportContacts.map((item) => ({
            id: item.id || `contact-${Math.random().toString(36).slice(2)}`,
            type: item.type || 'other',
            label: item.label || '',
            value: item.value || '',
            note: item.note || '',
          }))
        : [],
    );
  }, [systemSettingsDirty, systemStatus]);

  useEffect(() => {
    void refreshOnChainData();
    const timer = window.setInterval(() => {
      void refreshOnChainData();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshOnChainData]);

  useEffect(() => {
    if (ownerSessionAutoLoginPaused && !hasValidOwnerSession()) {
      return;
    }

    void loadBackendData();
    // Refresh backend snapshot + offline alerts frequently so admins see
    // device dropout within ~1 heartbeat interval.
    const timer = window.setInterval(() => {
      if (ownerSessionAutoLoginPaused && !hasValidOwnerSession()) {
        return;
      }
      void loadBackendData();
    }, 15000);

    return () => {
      window.clearInterval(timer);
    };
  }, [hasValidOwnerSession, loadBackendData, ownerSessionAutoLoginPaused]);

  useEffect(() => {
    if (section !== 'records') return;
    void loadRecords();
  }, [section, loadRecords]);

  useEffect(() => {
    if (section !== 'customers') return;
    void loadDevices();
  }, [section, loadDevices]);

  useEffect(() => {
    if (!selectedDeviceId) {
      setDeviceDetail(null);
      setDeviceDetailForm(null);
      return;
    }
    void loadDeviceDetail(selectedDeviceId);
  }, [selectedDeviceId, loadDeviceDetail]);

  const stats = useMemo(() => {
    return [
      {
        label: '注册矿工总数',
        value: globalStats ? globalStats.totalMiners.toString() : '--',
        trend: '链上实时',
        color: 'text-green-400',
      },
      {
        label: '全网活跃算力',
        value: globalStats ? formatHashrate(globalStats.totalActiveHashrate) : '--',
        trend: 'MiningPool.getGlobalStats',
        color: 'text-cyan-400',
      },
      {
        label: '累计发放 (SUPER)',
        value: globalStats ? formatTokenAmount(globalStats.totalEmitted) : '--',
        trend: '链上累计',
        color: 'text-blue-400',
      },
      {
        label: '当前地址待领取',
        value: minerInfo ? formatTokenAmount(minerInfo.pendingReward) : '--',
        trend: 'MiningPool.getMinerInfo',
        color: 'text-amber-400',
      },
    ];
  }, [globalStats, minerInfo]);

  const minerStatusLabel = !minerInfo
    ? '加载中'
    : !minerInfo.registered
      ? '未注册'
      : minerInfo.active
        ? '在线'
        : '离线';

  const minerStatusClass = !minerInfo
    ? 'text-slate-300 bg-slate-700/40'
    : !minerInfo.registered
      ? 'text-amber-300 bg-amber-400/10'
      : minerInfo.active
        ? 'text-green-400 bg-green-400/10'
        : 'text-slate-300 bg-slate-700/40';

  const isCurrentWalletChainAdmin = Boolean(
    adminWallet && chainAdminAddresses.some((address) => address.toLowerCase() === adminWallet.toLowerCase())
  );

  const quickAdminCards = useMemo(() => {
    return [
      {
        label: '链上管理员数',
        value: chainAdminAddresses.length || '--',
        detail: 'MiningPool.getAdmins',
      },
      {
        label: '链上 Owner',
        value: chainOwnerAddress ? shortWallet(chainOwnerAddress) : '--',
        detail: chainOwnerAddress || 'owner()',
      },
      {
        label: '当前钱包角色',
        value: !adminWallet ? '--' : isCurrentWalletChainAdmin ? 'Admin' : '未授权',
        detail: adminWallet ? shortWallet(adminWallet) : '请先连接钱包',
      },
    ];
  }, [adminWallet, chainAdminAddresses, chainOwnerAddress, isCurrentWalletChainAdmin]);

  const handleRegisterMiner = async () => {
    const parsedHashrate = Number(registerHashrate);
    if (!Number.isFinite(parsedHashrate) || parsedHashrate <= 0) {
      setError('请输入有效算力（大于 0 的整数）。');
      return;
    }

    if (!registerDeviceId.trim()) {
      setError('设备 ID 不能为空。');
      return;
    }

    try {
      setRegistering(true);
      setError('');
      await startMiningOnChain({
        hashrate: BigInt(Math.floor(parsedHashrate)),
        deviceId: registerDeviceId.trim(),
      });
      await refreshOnChainData();
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : '矿工注册失败';
      setError(message);
    } finally {
      setRegistering(false);
    }
  };

  const handleMintSuper = async () => {
    if (!isAddress(mintRecipient)) {
      setError('增发接收地址不合法。');
      return;
    }

    const parsed = Number(mintAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('请输入有效的 SUPER 增发数量。');
      return;
    }

    try {
      setAdminActionLoading('mint');
      setError('');
      await mintSuperOnChain(mintRecipient as `0x${string}`, mintAmount);
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'SUPER 增发失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleSaveMinSuperStakeForReward = async () => {
    const parsed = Number(minSuperStakeForReward);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('请输入有效的挖矿最小抵押 SUPER 数量。');
      return;
    }
    if (!globalStats?.stakeGateSupported) {
      setError('当前矿池合约不支持 SUPER 抵押门槛配置，请先升级合约。');
      return;
    }
    if (!window.confirm(`确认将 SUPER 抵押挖矿最小额设置为 ${minSuperStakeForReward || '0'} SUPER？`)) return;

    try {
      setAdminActionLoading('minSuperStakeForReward');
      setError('');
      await setMinSuperStakeForRewardOnChain(minSuperStakeForReward || '0');
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : '保存 SUPER 抵押挖矿最小额失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleManageLiquidity = async () => {
    const parsedSuper = Number(liquiditySuper);
    const parsedUsdt = Number(liquidityUsdt);
    if (!Number.isFinite(parsedSuper) || parsedSuper <= 0 || !Number.isFinite(parsedUsdt) || parsedUsdt <= 0) {
      setError('请输入有效的 SUPER / USDT 流动性数量。');
      return;
    }

    try {
      setAdminActionLoading('liquidity');
      setError('');
      if (swapStats && swapStats.reserveSuper === 0n && swapStats.reserveUsdt === 0n) {
        await initializeSwapLiquidityOnChain(liquiditySuper, liquidityUsdt);
      } else {
        await addSwapLiquidityOnChain(liquiditySuper, liquidityUsdt);
      }
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : '流动性管理失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleCollectPlatformFee = async () => {
    try {
      setAdminActionLoading('platformFee');
      setError('');
      await collectPlatformFeeOnChain();
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : '提取平台手续费失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleCollectEcosystemFee = async () => {
    if (!isAddress(ecosystemRecipient)) {
      setError('生态手续费接收地址不合法。');
      return;
    }

    try {
      setAdminActionLoading('ecosystemFee');
      setError('');
      await collectEcosystemFeeOnChain(ecosystemRecipient as `0x${string}`);
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : '提取生态手续费失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleSendGasToDevice = async () => {
    if (!isAddress(deviceFundingAddress)) {
      setError('设备绑定地址不合法。');
      return;
    }
    const parsed = Number(deviceFundingGas);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('请输入有效的 Gas 数量（大于 0）。');
      return;
    }

    try {
      setAdminActionLoading('deviceGas');
      setError('');
      await sendGasToAddressOnChain(deviceFundingAddress as `0x${string}`, deviceFundingGas);
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Gas 转账失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleSendSuperToDevice = async () => {
    if (!isAddress(deviceFundingAddress)) {
      setError('设备绑定地址不合法。');
      return;
    }
    const parsed = Number(deviceFundingSuper);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('请输入有效的 SUPER 数量（大于 0）。');
      return;
    }

    try {
      setAdminActionLoading('deviceSuper');
      setError('');
      await sendSuperToAddressOnChain(deviceFundingAddress as `0x${string}`, deviceFundingSuper);
      await refreshOnChainData();
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'SUPER 转账失败';
      setError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const saveSystemSettings = async (payload: Record<string, unknown>) => {
    if (ownerSessionRole !== 'owner') {
      setBackendError('当前角色无权修改系统设置，请使用 Owner 钱包登录。');
      return;
    }
    setAdminActionLoading('systemSettings');
    setBackendError('');
    try {
      await signedRequest<{ ok: boolean }>('/api/system/settings', 'PUT', payload);
      setSystemSettingsDirty(false);
      await loadBackendData();
    } catch (saveError) {
      setBackendError(saveError instanceof Error ? saveError.message : '保存系统设置失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const loadSubAdminAccess = useCallback(async () => {
    if (ownerSessionRole !== 'owner') {
      setOwnerSubAdmins([]);
      return;
    }

    try {
      setSubAdminAccessLoading(true);
      setSubAdminAccessMessage('');
      const response = await ownerReadRequest<{ items: OwnerSubAdminItem[] }>('/api/owner/subadmins');
      setSubAdminManagementAllowed(true);
      setOwnerSubAdmins(response.items ?? []);
    } catch (loadError) {
      if (isPrimaryOwnerAccessError(loadError)) {
        setSubAdminManagementAllowed(false);
        setOwnerSubAdmins([]);
        setSubAdminAccessMessage('');
        return;
      }
      setSubAdminAccessMessage(loadError instanceof Error ? loadError.message : 'Failed to load SubAdmin list');
    } finally {
      setSubAdminAccessLoading(false);
    }
  }, [ownerReadRequest, ownerSessionRole]);

  const handleAddSubAdmin = useCallback(async () => {
    if (ownerSessionRole !== 'owner') {
      setSubAdminAccessMessage('Only the Owner wallet can manage SubAdmins.');
      return;
    }
    if (!subAdminManagementAllowed) {
      setSubAdminAccessMessage('Only the primary owner wallet can manage SubAdmins.');
      return;
    }

    const wallet = newSubAdminWallet.trim();
    if (!isAddress(wallet)) {
      setSubAdminAccessMessage('Enter a valid SubAdmin wallet address.');
      return;
    }

    if (newSubAdminContractTypes.length === 0) {
      setSubAdminAccessMessage('请选择 SubAdmin 可使用的合同类型。');
      return;
    }

    try {
      setSubAdminAccessLoading(true);
      setSubAdminAccessMessage('');
      await signedRequest<{ ok: boolean; wallet: string }>('/api/owner/subadmins', 'POST', {
        wallet,
        note: newSubAdminNote.trim() || undefined,
        allowedContractTypes: newSubAdminContractTypes,
      });
      setNewSubAdminWallet('');
      setNewSubAdminNote('');
      setNewSubAdminContractTypes(['three_year']);
      setSubAdminAccessMessage('SubAdmin added.');
      await loadSubAdminAccess();
    } catch (error) {
      setSubAdminAccessMessage(error instanceof Error ? error.message : 'Failed to add SubAdmin');
    } finally {
      setSubAdminAccessLoading(false);
    }
  }, [loadSubAdminAccess, newSubAdminContractTypes, newSubAdminNote, newSubAdminWallet, ownerSessionRole, signedRequest, subAdminManagementAllowed]);

  const handleRemoveSubAdmin = useCallback(async (item: OwnerSubAdminItem) => {
    if (ownerSessionRole !== 'owner') {
      setSubAdminAccessMessage('Only the Owner wallet can manage SubAdmins.');
      return;
    }
    if (!subAdminManagementAllowed) {
      setSubAdminAccessMessage('Only the primary owner wallet can manage SubAdmins.');
      return;
    }
    if (!item.canRemove) {
      setSubAdminAccessMessage('This SubAdmin comes from environment config and cannot be removed here.');
      return;
    }
    if (!window.confirm(`Remove SubAdmin ${item.wallet}?`)) return;

    try {
      setSubAdminAccessLoading(true);
      setSubAdminAccessMessage('');
      await signedRequest<{ ok: boolean; removed: boolean }>(
        `/api/owner/subadmins/${encodeURIComponent(item.wallet)}`,
        'DELETE'
      );
      setSubAdminAccessMessage('SubAdmin removed.');
      await loadSubAdminAccess();
    } catch (error) {
      setSubAdminAccessMessage(error instanceof Error ? error.message : 'Failed to remove SubAdmin');
    } finally {
      setSubAdminAccessLoading(false);
    }
  }, [loadSubAdminAccess, ownerSessionRole, signedRequest, subAdminManagementAllowed]);

  useEffect(() => {
    if (section !== 'system') return;
    if (ownerSessionRole !== 'owner') return;
    if (!hasValidOwnerSession()) return;
    void loadSubAdminAccess();
  }, [hasValidOwnerSession, loadSubAdminAccess, ownerSessionRole, section]);

  const buildSystemNumericFields = (): Record<string, number> => {
    const fields: Record<string, number> = {};
    const monthly = Number(monthlyCardDays);
    if (Number.isFinite(monthly) && monthly >= 1) fields.monthlyCardDays = Math.floor(monthly);
    const termDays = Number(contractTermDays);
    if (Number.isFinite(termDays) && termDays >= 1) fields.contractTermDaysDefault = Math.floor(termDays);
    const rate = Number(rewardRatePerHour);
    if (Number.isFinite(rate) && rate > 0) fields.rewardRateUsdtPerHour = rate;
    return fields;
  };

  const handleToggleMaintenance = async () => {
    if (!systemStatus) {
      setBackendError('系统状态尚未同步，请稍后重试。');
      return;
    }
    const nextLabel = systemStatus.maintenanceEnabled ? '关闭维护模式' : '开启维护模式';
    if (!window.confirm(`确认${nextLabel}？该操作会立即影响线上 App 用户。`)) return;
    await saveSystemSettings({
      maintenanceEnabled: !systemStatus.maintenanceEnabled,
      maintenanceMessageZh,
      maintenanceMessageEn,
      ...buildSystemNumericFields(),
      exchangeAutoEnabled: systemStatus.exchangeAutoEnabled,
      payoutWallets: systemStatus.payoutWallets,
    });
  };

  const handleToggleExchange = async () => {
    if (!systemStatus) {
      setBackendError('系统状态尚未同步，请稍后重试。');
      return;
    }
    const nextLabel = systemStatus.exchangeAutoEnabled ? '关闭自动兑换' : '开启自动兑换';
    if (!window.confirm(`确认${nextLabel}？该操作会立即影响用户兑换流程。`)) return;
    await saveSystemSettings({
      maintenanceEnabled: systemStatus.maintenanceEnabled,
      maintenanceMessageZh,
      maintenanceMessageEn,
      ...buildSystemNumericFields(),
      exchangeAutoEnabled: !systemStatus.exchangeAutoEnabled,
      payoutWallets: systemStatus.payoutWallets,
    });
  };

  const handleSaveSystemParameters = async () => {
    if (!systemStatus) {
      setBackendError('系统状态尚未同步，请稍后重试。');
      return;
    }
    const numericFields = buildSystemNumericFields();
    if (
      numericFields.monthlyCardDays === undefined ||
      numericFields.contractTermDaysDefault === undefined ||
      numericFields.rewardRateUsdtPerHour === undefined
    ) {
      setBackendError('月卡天数 / 合同默认天数 / 小时收益单价 必须为有效数值。');
      return;
    }
    await saveSystemSettings({
      maintenanceEnabled: systemStatus.maintenanceEnabled,
      maintenanceMessageZh,
      maintenanceMessageEn,
      ...numericFields,
      exchangeAutoEnabled: systemStatus.exchangeAutoEnabled,
      payoutWallets: systemStatus.payoutWallets,
    });
  };

  const handleSaveUserAgreement = async () => {
    await saveSystemSettings({
      userAgreementRequired: agreementRequired,
      userAgreementVersion: agreementVersion.trim() || '1.0.0',
      userAgreementTitleZh: agreementTitleZh,
      userAgreementTitleEn: agreementTitleEn,
      userAgreementContentZh: agreementContentZh,
      userAgreementContentEn: agreementContentEn,
    });
  };

  const handleToggleUserAgreement = async () => {
    await saveSystemSettings({
      userAgreementRequired: !agreementRequired,
      userAgreementVersion: agreementVersion.trim() || '1.0.0',
      userAgreementTitleZh: agreementTitleZh,
      userAgreementTitleEn: agreementTitleEn,
      userAgreementContentZh: agreementContentZh,
      userAgreementContentEn: agreementContentEn,
    });
  };

  const handleSaveContract = async () => {
    await saveSystemSettings({
      contractRequired: contractRequired,
      contractVersion: contractVersion.trim() || '1.0.0',
      contractTitleZh: contractTitleZh,
      contractTitleEn: contractTitleEn,
      contractContentZh: contractContentZh,
      contractContentEn: contractContentEn,
    });
  };

  const handleToggleContract = async () => {
    await saveSystemSettings({
      contractRequired: !contractRequired,
      contractVersion: contractVersion.trim() || '1.0.0',
      contractTitleZh: contractTitleZh,
      contractTitleEn: contractTitleEn,
      contractContentZh: contractContentZh,
      contractContentEn: contractContentEn,
    });
  };

  const handleAddSupportContact = () => {
    markSystemSettingsDirty();
    setSupportContacts((prev) => [
      ...prev,
      {
        id: `contact-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type: 'weixin',
        label: '',
        value: '',
        note: '',
      },
    ]);
  };

  const handleUpdateSupportContact = (id: string, field: keyof SupportContact, value: string) => {
    markSystemSettingsDirty();
    setSupportContacts((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleRemoveSupportContact = (id: string) => {
    markSystemSettingsDirty();
    setSupportContacts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSaveSupportContacts = async () => {
    setAdminActionLoading('supportContacts');
    setBackendError('');
    try {
      const payload = supportContacts
        .map((item) => ({
          id: item.id,
          type: item.type.trim(),
          label: item.label.trim(),
          value: item.value.trim(),
          note: item.note.trim(),
        }))
        .filter((item) => item.type && item.value);
      await signedRequest<{ ok: boolean }>('/api/system/settings', 'PUT', { supportContacts: payload });
      setSystemSettingsDirty(false);
      await loadBackendData();
    } catch (saveError) {
      setBackendError(saveError instanceof Error ? saveError.message : '保存联系方式失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const resetAnnouncementForm = () => {
    setEditingAnnouncementId('');
    setAnnouncementForm(createEmptyAnnouncementForm());
  };

  const handleAnnouncementFieldChange = <K extends keyof AnnouncementFormState>(field: K, value: AnnouncementFormState[K]) => {
    setAnnouncementForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditAnnouncement = (item: AnnouncementItem) => {
    setEditingAnnouncementId(item.id);
    setAnnouncementForm({
      titleZh: item.titleZh,
      titleEn: item.titleEn,
      contentZh: item.contentZh,
      contentEn: item.contentEn,
      level: item.level,
      target: item.target,
      isPinned: item.isPinned,
      isPublished: item.isPublished,
      publishAt: formatDateTimeLocalInput(item.publishAt),
      expireAt: formatDateTimeLocalInput(item.expireAt),
    });
  };

  const handleSaveAnnouncement = async () => {
    if (!announcementForm.titleZh.trim() || !announcementForm.titleEn.trim() || !announcementForm.contentZh.trim() || !announcementForm.contentEn.trim()) {
      setBackendError('公告标题和正文（中英文）都不能为空');
      return;
    }

    const publishAtIso = parseDateTimeLocalInput(announcementForm.publishAt);
    const expireAtIso = parseDateTimeLocalInput(announcementForm.expireAt);
    if (publishAtIso && expireAtIso && publishAtIso >= expireAtIso) {
      setBackendError('过期时间必须晚于发布时间');
      return;
    }

    setAdminActionLoading('announcementSave');
    setBackendError('');
    try {
      const payload = {
        titleZh: announcementForm.titleZh.trim(),
        titleEn: announcementForm.titleEn.trim(),
        contentZh: announcementForm.contentZh.trim(),
        contentEn: announcementForm.contentEn.trim(),
        level: announcementForm.level,
        target: announcementForm.target,
        isPinned: announcementForm.isPinned,
        isPublished: announcementForm.isPublished,
        publishAt: publishAtIso,
        expireAt: expireAtIso,
      };

      if (editingAnnouncementId) {
        await signedRequest(`/api/announcements/admin/${editingAnnouncementId}`, 'PUT', payload);
      } else {
        await signedRequest('/api/announcements/admin', 'POST', payload);
      }
      resetAnnouncementForm();
      await loadBackendData();
    } catch (saveError) {
      setBackendError(saveError instanceof Error ? saveError.message : '保存公告失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleToggleAnnouncementPublish = async (item: AnnouncementItem) => {
    setAdminActionLoading(`announcement-${item.id}`);
    setBackendError('');
    try {
      await signedRequest(`/api/announcements/admin/${item.id}/${item.isPublished ? 'unpublish' : 'publish'}`, 'POST', {});
      await loadBackendData();
    } catch (actionError) {
      setBackendError(actionError instanceof Error ? actionError.message : '更新公告状态失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleDeleteAnnouncement = async (item: AnnouncementItem) => {
    if (!window.confirm(`确认删除公告「${item.titleZh}」？`)) return;
    setAdminActionLoading(`announcement-delete-${item.id}`);
    setBackendError('');
    try {
      await signedRequest(`/api/announcements/admin/${item.id}`, 'DELETE', {});
      if (editingAnnouncementId === item.id) {
        resetAnnouncementForm();
      }
      await loadBackendData();
    } catch (actionError) {
      setBackendError(actionError instanceof Error ? actionError.message : '删除公告失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleActivateCustomer = async () => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能激活客户或续月卡。');
      return;
    }
    if (!activateCustomerId) {
      setBackendError('请先选择客户');
      return;
    }
    try {
      setAdminActionLoading('activateCustomer');
      await signedRequest(`/api/admin/customers/${activateCustomerId}/activate`, 'POST', {
        machineCode: activateMachineCode.trim() || undefined,
        contractTermYears: Number(activateTermYears),
        agreementAccepted: true,
      });
      await loadBackendData();
      setActivateMachineCode('');
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '激活客户失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleBulkRate = async () => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能修改收益率或续月卡。');
      return;
    }
    const ids = Array.from(selectedCustomerIds);
    if (ids.length === 0) {
      setBackendError('请先勾选客户');
      return;
    }
    const rateNum = Number(bulkRate);
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setBackendError('收益率必须是非负数');
      return;
    }
    if (!window.confirm(`确认将 ${ids.length} 位客户的收益率改为 ${bulkRate} USDT/h？`)) return;
    try {
      setAdminActionLoading('bulkRate');
      await signedRequest('/api/admin/customers/bulk-rate', 'POST', {
        userIds: ids,
        rewardRateUsdtPerHour: rateNum,
      });
      setSelectedCustomerIds(new Set());
      await loadBackendData();
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '批量修改失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleExtendContract = async (userId: string) => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能执行合约续期。');
      return;
    }
    const daysNum = Math.max(1, Math.floor(Number(extendDays) || 30));
    if (!window.confirm(`确认为该客户续期 ${daysNum} 天？`)) return;
    try {
      setAdminActionLoading(`extend-${userId}`);
      await signedRequest(`/api/admin/customers/${userId}/extend`, 'POST', { extendDays: daysNum });
      await loadBackendData();
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '续期失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleMonthlyRenew = async (userId: string, userMonthlyDays?: number) => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能续月卡。');
      return;
    }
    const fallbackDays = Math.max(1, Math.floor(Number(monthlyCardDays) || 30));
    const targetDays = Math.max(1, Math.floor(Number(userMonthlyDays) || fallbackDays));
    if (!window.confirm(`确认为该客户按月续期 ${targetDays} 天？`)) return;
    try {
      setAdminActionLoading(`extend-monthly-${userId}`);
      await signedRequest(`/api/admin/customers/${userId}/extend`, 'POST', { mode: 'monthly' });
      await loadBackendData();
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '按月续期失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleRenew30AndFundSuper = async (customer: CustomerItem) => {
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能续期或充值 SUPER。');
      return;
    }
    const parsed = Number(customerRenewSuperAmount);
    if (!isAddress(customer.wallet)) {
      setBackendError('客户钱包地址不合法，无法充值 SUPER');
      return;
    }
    if (!superAddress) {
      setBackendError('未配置 SUPER 合约地址，无法充值 SUPER');
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBackendError('请输入有效的 SUPER 充值数量');
      return;
    }

    const label = customer.nickname || shortWallet(customer.wallet);
    if (!window.confirm(`确认为 ${label} 续期 30 天，并向 ${customer.wallet} 转入 ${customerRenewSuperAmount} SUPER？`)) return;

    try {
      setAdminActionLoading(`renew-fund-${customer.id}`);
      setBackendError('');
      await signedRequest(`/api/admin/customers/${customer.id}/extend`, 'POST', { extendDays: 30 });
      await sendSuperToAddressOnChain(customer.wallet as `0x${string}`, customerRenewSuperAmount);
      await loadBackendData();
      await refreshOnChainData();
      if (selectedCustomerDetailId === customer.id) {
        await openCustomerDetailPanel(customer.id);
      }
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '续期并充值 SUPER 失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const openCustomerDetailPanel = async (userId: string) => {
    if (!userId) return;
    try {
      setCustomerDetailLoading(true);
      const detail = await ownerReadRequest<CustomerDetail>(`/api/admin/customers/${userId}`);
      setSelectedCustomerDetailId(userId);
      setSelectedCustomerDetail(detail);
      setCustomerDetailForm({
        nickname: detail.nickname ?? '',
        notes: detail.notes ?? '',
        rewardRateUsdtPerHour: detail.rewardRateUsdtPerHour ?? '0.084',
        monthlyCardDays: String(detail.monthlyCardDays ?? 30),
        devices: (detail.devices ?? []).map((device) => ({
          id: device.id,
          deviceId: device.deviceId ?? '',
          hashrate: String(device.hashrate ?? 0),
          status: device.status ?? 'active',
        })),
      });
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '读取客户详情失败');
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const handleSaveCustomerDetail = async () => {
    if (!selectedCustomerDetailId || !customerDetailForm) return;
    if (!canOperateCustomers) {
      setBackendError('SubAdmin 当前为只读权限，不能保存运营设置。');
      return;
    }
    const rateNum = Number(customerDetailForm.rewardRateUsdtPerHour);
    const monthlyDaysNum = Math.max(1, Math.floor(Number(customerDetailForm.monthlyCardDays) || 30));
    if (!Number.isFinite(rateNum) || rateNum < 0) {
      setBackendError('收益率必须是非负数');
      return;
    }

    const normalizedDevices = customerDetailForm.devices.map((device, index) => {
      const hashrateNum = Number(device.hashrate);
      if (!device.deviceId.trim()) {
        throw new Error(`设备 ${index + 1} 的设备 ID 不能为空`);
      }
      if (!Number.isFinite(hashrateNum) || hashrateNum < 0) {
        throw new Error(`设备 ${index + 1} 的算力必须是大于等于 0 的数字`);
      }
      if (!device.status.trim()) {
        throw new Error(`设备 ${index + 1} 的状态不能为空`);
      }
      return {
        id: device.id,
        deviceId: device.deviceId.trim(),
        hashrate: Math.floor(hashrateNum),
        status: device.status.trim(),
      };
    });

    try {
      setAdminActionLoading(`save-customer-${selectedCustomerDetailId}`);
      const updated = await signedRequest<CustomerDetail>(`/api/admin/customers/${selectedCustomerDetailId}`, 'PUT', {
        nickname: customerDetailForm.nickname.trim() || null,
        notes: customerDetailForm.notes.trim() || null,
        rewardRateUsdtPerHour: rateNum,
        monthlyCardDays: monthlyDaysNum,
        devices: normalizedDevices,
      });
      await loadBackendData();
      await loadDevices();
      setSelectedCustomerDetail(updated);
      setCustomerDetailForm({
        nickname: updated.nickname ?? '',
        notes: updated.notes ?? '',
        rewardRateUsdtPerHour: updated.rewardRateUsdtPerHour ?? '0.084',
        monthlyCardDays: String(updated.monthlyCardDays ?? 30),
        devices: (updated.devices ?? []).map((device) => ({
          id: device.id,
          deviceId: device.deviceId ?? '',
          hashrate: String(device.hashrate ?? 0),
          status: device.status ?? 'active',
        })),
      });
      setBackendError('');
    } catch (err) {
      setBackendError(err instanceof Error ? err.message : '保存客户设置失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleApproveExchange = async (orderId: string) => {
    if (ownerSessionRole !== 'owner') {
      setRecordsError('当前角色无权审批兑换订单，请使用 Owner 钱包登录。');
      return;
    }
    if (!window.confirm(`确认批准兑换订单 ${orderId}？`)) return;
    try {
      setAdminActionLoading(`approve-${orderId}`);
      await signedRequest(`/api/operations/exchange/orders/${orderId}/approve`, 'POST', {});
      await loadRecords();
      setRecordsError('');
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : '批准失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleCompleteExchange = async (orderId: string, defaultWallet: string | null, amountUsdt: string) => {
    if (ownerSessionRole !== 'owner') {
      setRecordsError('当前角色无权完成兑换订单，请使用 Owner 钱包登录。');
      return;
    }
    const payoutWallet = window.prompt('请输入实际收款钱包（留空使用原 payout_wallet）：', defaultWallet ?? '');
    if (payoutWallet === null) return;
    const txHash = window.prompt('请输入链上 tx hash（可留空）：', '') ?? '';
    try {
      setAdminActionLoading(`complete-${orderId}`);
      await signedRequest(`/api/operations/exchange/orders/${orderId}/complete`, 'POST', {
        payoutWallet: payoutWallet.trim() || undefined,
        txHash: txHash.trim() || undefined,
        amountUsdt,
      });
      await loadRecords();
      setRecordsError('');
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : '完成失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleCreateCollectionRequest = async () => {
    const userIds = Array.from(selectedCustomerIds);
    if (userIds.length === 0) {
      setBackendError('请先在客户列表勾选需要归集资金的客户。');
      return;
    }
    if (!isAddress(collectionTargetWallet)) {
      setBackendError('请输入有效的归集目标账户。');
      return;
    }

    try {
      setBackendError('');
      setRecordsError('');
      setAdminActionLoading('collection-create');
      await signedRequest<{ ok: boolean; id: string }>('/api/admin/collection-requests', 'POST', {
        userIds,
        targetWallet: collectionTargetWallet,
        note: collectionNote.trim() || null,
      });
      setCollectionNote('');
      await loadRecords();
      setBackendError(`归集申请已创建：${userIds.length} 位客户，目标 ${shortWallet(collectionTargetWallet)}。`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建归集申请失败';
      setBackendError(message);
      setRecordsError(message);
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleApproveCollectionRequest = async (requestId: string) => {
    if (ownerSessionRole !== 'owner') {
      setRecordsError('只有 Owner 可以批准归集申请。');
      return;
    }
    if (!window.confirm(`确认批准归集申请 ${requestId}？`)) return;
    try {
      setAdminActionLoading(`collection-approve-${requestId}`);
      await signedRequest(`/api/admin/collection-requests/${requestId}/approve`, 'POST', {});
      await loadRecords();
      setRecordsError('');
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : '批准归集申请失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleRejectCollectionRequest = async (requestId: string) => {
    if (ownerSessionRole !== 'owner') {
      setRecordsError('只有 Owner 可以拒绝归集申请。');
      return;
    }
    const note = window.prompt('拒绝原因，可留空：', '');
    if (note === null) return;
    try {
      setAdminActionLoading(`collection-reject-${requestId}`);
      await signedRequest(`/api/admin/collection-requests/${requestId}/reject`, 'POST', {
        note: note.trim() || undefined,
      });
      await loadRecords();
      setRecordsError('');
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : '拒绝归集申请失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleCompleteCollectionRequest = async (record: FundCollectionRecord) => {
    if (ownerSessionRole !== 'owner') {
      setRecordsError('只有 Owner 可以完成归集打款。');
      return;
    }
    const amountUsdt = parseNumberOrDefault(record.amountUsdt);
    const amountSuper = parseNumberOrDefault(record.amountSuper);
    if (amountUsdt <= 0 && amountSuper <= 0) {
      setRecordsError('归集金额为 0，无法完成打款。');
      return;
    }
    const transferSummary = [
      amountUsdt > 0 ? `${record.amountUsdt} USDT` : null,
      amountSuper > 0 ? `${record.amountSuper} SUPER` : null,
    ].filter(Boolean).join(' / ');
    if (!window.confirm(`确认从当前 Owner 钱包向 ${shortWallet(record.targetWallet)} 转出 ${transferSummary} 并完成归集？`)) return;

    try {
      setAdminActionLoading(`collection-complete-${record.id}`);
      const txHashes: Array<{ token: string; hash: string }> = [];
      if (amountUsdt > 0) {
        const hash = await sendUsdtToAddressOnChain(record.targetWallet as `0x${string}`, record.amountUsdt);
        txHashes.push({ token: 'USDT', hash });
      }
      if (amountSuper > 0) {
        const hash = await sendSuperToAddressOnChain(record.targetWallet as `0x${string}`, record.amountSuper);
        txHashes.push({ token: 'SUPER', hash });
      }
      const primaryTx = txHashes[txHashes.length - 1]?.hash;
      const note = txHashes.map((item) => `${item.token}: ${item.hash}`).join('\n');
      await signedRequest(`/api/admin/collection-requests/${record.id}/complete`, 'POST', {
        txHash: primaryTx,
        note: note || undefined,
      });
      await loadRecords();
      setRecordsError('');
    } catch (err) {
      setRecordsError(err instanceof Error ? err.message : '完成归集打款失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const toggleCustomerSelection = (id: string) => {
    setSelectedCustomerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const priceSuperPerUsdt = swapStats ? Number(formatUnits(swapStats.priceSuperPerUsdt, 18)) : 0;
  const priceUsdtPerSuper = priceSuperPerUsdt > 0 ? 1 / priceSuperPerUsdt : 0;

  const customerInsights = useMemo<CustomerRecommendation[]>(() => {
    const now = Date.now();
    return customers.map((customer) => {
      const endMs = customer.contractEndAt ? new Date(customer.contractEndAt).getTime() : 0;
      const remainDays = endMs > 0 ? Math.ceil((endMs - now) / 86400_000) : null;
      const expiring = remainDays !== null && remainDays > 0 && remainDays <= 30;
      const expired = remainDays !== null && remainDays <= 0;
      const lowGas = parseNumberOrDefault(customer.bnbBalance, 0) > 0 && parseNumberOrDefault(customer.bnbBalance, 0) < 0.003;
      const offline = customer.onlineStatus !== 'online';
      const missingMachineCode = !customer.machineCode || !customer.machineCode.trim();
      const inactiveDevice = customer.deviceCount > 0 && customer.activeDeviceCount === 0;
      const rewardTotal = parseNumberOrDefault(customer.totalRewardUsdt, 0);

      let score = 0;
      const reasons: string[] = [];
      let actionLabel = '观察';

      if (customer.contractActive !== 1) {
        score += 55;
        reasons.push('合同停用');
        actionLabel = '激活合同';
      }
      if (expired) {
        score += 95;
        reasons.push('合同已到期');
        actionLabel = '立即续期';
      } else if (expiring && remainDays !== null) {
        if (remainDays <= 7) {
          score += 75;
          reasons.push('7 天内到期');
        } else {
          score += 45;
          reasons.push('30 天内到期');
        }
        actionLabel = '提前续期';
      }
      if (customer.contractActive === 1 && offline) {
        score += 35;
        reasons.push('有效合同但离线');
        actionLabel = actionLabel === '观察' ? '排查离线' : actionLabel;
      }
      if (inactiveDevice) {
        score += 25;
        reasons.push('设备全离线');
        actionLabel = actionLabel === '观察' ? '检查设备' : actionLabel;
      }
      if (missingMachineCode) {
        score += 20;
        reasons.push('缺少设备标识');
        actionLabel = actionLabel === '观察' ? '补录设备标识' : actionLabel;
      }
      if (lowGas) {
        score += 25;
        reasons.push('BNB 余额偏低');
        actionLabel = actionLabel === '观察' ? '补充 Gas' : actionLabel;
      }
      if (rewardTotal >= 300) {
        score += 10;
        reasons.push('高价值客户');
      }

      const priority: CustomerRecommendation['priority'] = score >= 100
        ? 'P0'
        : score >= 70
          ? 'P1'
          : score >= 35
            ? 'P2'
            : 'P3';

      return {
        customer,
        score,
        priority,
        actionLabel,
        reasons,
        remainDays,
        expiring,
        expired,
        lowGas,
        offline,
        missingMachineCode,
        inactiveDevice,
        rewardTotal,
      };
    });
  }, [customers]);

  const recommendedCustomers = useMemo(() => {
    return customerInsights
      .filter((item) => item.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.rewardTotal - a.rewardTotal;
      })
      .slice(0, 6);
  }, [customerInsights]);

  const visibleCustomers = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    const filtered = customerInsights.filter((entry) => {
      const customer = entry.customer;
      const haystack = [
        customer.id,
        customer.wallet,
        customer.nickname ?? '',
        customer.email ?? '',
        customer.machineCode ?? '',
      ].join(' ').toLowerCase();

      if (keyword && !haystack.includes(keyword)) return false;

      if (customerStatusFilter === 'needs_action') return entry.score >= 35;
      if (customerStatusFilter === 'expired') return entry.expired;
      if (customerStatusFilter === 'expiring') return entry.expiring;
      if (customerStatusFilter === 'offline') return entry.offline;
      if (customerStatusFilter === 'low_gas') return entry.lowGas;
      return true;
    });

    filtered.sort((a, b) => {
      if (customerSortBy === 'recommend') {
        if (b.score !== a.score) return b.score - a.score;
        return b.rewardTotal - a.rewardTotal;
      }
      if (customerSortBy === 'reward') {
        return b.rewardTotal - a.rewardTotal;
      }
      if (customerSortBy === 'rate') {
        return parseNumberOrDefault(b.customer.rewardRateUsdtPerHour, 0) - parseNumberOrDefault(a.customer.rewardRateUsdtPerHour, 0);
      }
      const aRemain = a.remainDays ?? Number.POSITIVE_INFINITY;
      const bRemain = b.remainDays ?? Number.POSITIVE_INFINITY;
      return aRemain - bRemain;
    });

    return filtered;
  }, [customerInsights, customerSearch, customerSortBy, customerStatusFilter]);

  const referrerOptions = useMemo(() => {
    return Array.from(new Set(
      customers
        .map((customer) => customer.referrerWallet?.trim().toLowerCase() ?? '')
        .filter((wallet) => wallet && isAddress(wallet))
    )).sort();
  }, [customers]);

  const selectedCollectionEstimate = useMemo(() => {
    let customerCount = 0;
    let deviceCount = 0;
    let amountUsdt = 0;
    let amountSuper = 0;

    for (const customer of customers) {
      if (!selectedCustomerIds.has(customer.id)) continue;
      customerCount += 1;
      deviceCount += Number(customer.deviceCount ?? 0);
      amountUsdt += Number(customer.totalRewardUsdt ?? '0') || 0;
      amountSuper += Number(customer.totalRewardSuper ?? '0') || 0;
    }

    return { customerCount, deviceCount, amountUsdt, amountSuper };
  }, [customers, selectedCustomerIds]);

  const deviceMetricsByUserId = useMemo(() => {
    const map = new Map<string, {
      totalHashrate: number;
      lastSeenAt: string | null;
      lastSeenMs: number;
      statusCounts: Record<string, number>;
    }>();

    for (const device of devices) {
      const existing = map.get(device.userId) ?? {
        totalHashrate: 0,
        lastSeenAt: null,
        lastSeenMs: 0,
        statusCounts: {},
      };

      existing.totalHashrate += Number(device.hashrate ?? 0);

      const statusKey = (device.deviceStatus || 'unknown').toLowerCase();
      existing.statusCounts[statusKey] = (existing.statusCounts[statusKey] ?? 0) + 1;

      if (device.lastSeenAt) {
        const ts = new Date(device.lastSeenAt).getTime();
        if (Number.isFinite(ts) && ts > existing.lastSeenMs) {
          existing.lastSeenMs = ts;
          existing.lastSeenAt = device.lastSeenAt;
        }
      }

      map.set(device.userId, existing);
    }

    return map;
  }, [devices]);

  const recordsSummary = useMemo(() => {
    const pendingApprove = withdrawalRecords.filter(
      (item) => item.source === 'exchange' && (item.status === 'manual_pending' || item.status === 'auto_processing')
    ).length;
    const pendingComplete = withdrawalRecords.filter(
      (item) => item.source === 'exchange' && (item.status === 'approved' || item.status === 'auto_processing')
    ).length;

    return {
      rechargeCount: rechargeRecords.length,
      withdrawalCount: withdrawalRecords.length,
      exchangeCount: exchangeRecords.length,
      pendingApprove,
      pendingComplete,
    };
  }, [exchangeRecords.length, rechargeRecords.length, withdrawalRecords]);

  const isPrimaryOwnerSession = ownerSessionRole === 'owner';
  const canAccessSection = useCallback(
    (id: AdminSection) => isPrimaryOwnerSession || !OWNER_ONLY_SECTION_IDS.has(id),
    [isPrimaryOwnerSession]
  );
  const availableBasicSectionIds = useMemo(
    () => BASIC_SECTION_IDS.filter(canAccessSection),
    [canAccessSection]
  );
  const availableAdvancedSectionIds = useMemo(
    () => ADVANCED_SECTION_IDS.filter(canAccessSection),
    [canAccessSection]
  );

  useEffect(() => {
    if (availableBasicSectionIds.includes(section)) return;
    if (showAdvancedNav && availableAdvancedSectionIds.includes(section)) return;
    setSection('overview');
  }, [availableAdvancedSectionIds, availableBasicSectionIds, section, showAdvancedNav]);

  useEffect(() => {
    if (section === 'owner' && !isPrimaryOwnerSession) {
      setSection('overview');
    }
  }, [isPrimaryOwnerSession, section]);

  return (
    <section
      id="admin-dashboard"
      className={fullScreen ? 'min-h-screen bg-slate-900/30' : 'py-24 bg-slate-900/30'}
    >
      <div className={fullScreen ? 'w-full px-0' : 'max-w-7xl mx-auto px-6'}>
        {!fullScreen && <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium mb-6"
          >
            B 端运营控制台
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">管理员后台与设备管理</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            为运营团队提供设备与用户的统一管理入口，实时监控全网算力、设备状态与风控告警。
          </p>
        </div>}

        {/* Dashboard */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className={
            fullScreen
              ? 'bg-slate-950 rounded-none md:rounded-none border-y md:border border-slate-800 shadow-2xl overflow-hidden flex flex-col min-h-screen'
              : 'bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col'
          }
        >
          {/* Top Nav */}
          <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4">
            <div className="flex items-center gap-3 mb-3">
              <LayoutDashboard className="text-purple-400" />
              <span className="font-bold text-lg text-white">Coin Planet Admin</span>
              {ownerSessionRole && (
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${ownerSessionRole === 'owner' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' : 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30'}`}>
                  {ownerSessionRole === 'owner' ? 'Owner' : 'SubAdmin'}
                </span>
              )}
              <span className="text-xs text-slate-500 hidden md:inline">
                {t(SECTION_LABELS.find((s) => s.id === section)?.descKey ?? 'admin.section.overview.desc')}
              </span>
              <div className="ml-auto flex items-center gap-1 text-xs">
                <span className="text-slate-500">{t('common.language')}:</span>
                <button
                  onClick={() => setLocale('zh')}
                  className={`px-2 py-1 rounded ${locale === 'zh' ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >中</button>
                <button
                  onClick={() => setLocale('en')}
                  className={`px-2 py-1 rounded ${locale === 'en' ? 'bg-purple-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                >EN</button>
                {ownerSessionAutoLoginPaused && (
                  <button
                    onClick={() => void reloginOwnerSession()}
                    className="ml-2 px-2 py-1 rounded bg-amber-500 text-slate-950 hover:bg-amber-400"
                  >
                    重新钱包登录
                  </button>
                )}
              </div>
            </div>
            <nav className="flex flex-wrap gap-2">
              {SECTION_LABELS.filter((item) => availableBasicSectionIds.includes(item.id)).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    section === item.id
                      ? 'bg-purple-500 text-slate-950 border-purple-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {t(item.labelKey)}
                </button>
              ))}
              <button
                onClick={() => setShowAdvancedNav((prev) => !prev)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  showAdvancedNav
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                }`}
              >
                {showAdvancedNav ? (locale === 'zh' ? '收起高级' : 'Hide Advanced') : (locale === 'zh' ? '高级操作' : 'Advanced')}
              </button>
            </nav>
            {showAdvancedNav && (
              <nav className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-800">
                {SECTION_LABELS.filter((item) => availableAdvancedSectionIds.includes(item.id)).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSection(item.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      section === item.id
                        ? 'bg-amber-400/90 text-slate-950 border-amber-300'
                        : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {t(item.labelKey)}
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 md:p-8">
            {/* Owner Console section */}
            {section === 'owner' && isPrimaryOwnerSession && (
              <OwnerConsole adminWallet={adminWallet} signMessageAsync={signMessageAsync} />
            )}

            {/* Top Stats (Overview) */}
            {section === 'overview' && (
            <>
              {isPrimaryOwnerSession ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRecordsDetail((prev) => !prev)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-xs text-indigo-200 hover:bg-indigo-500/30"
                  >
                    {showRecordsDetail ? '收起明细' : '展开明细'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadRecords()}
                    disabled={recordsLoading}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-xs text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
                  >
                    {recordsLoading ? '刷新中…' : '刷新'}
                  </button>
                </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">充值订单</div>
                  <div className="text-lg font-semibold text-indigo-200">{recordsSummary.rechargeCount}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">提现记录</div>
                  <div className="text-lg font-semibold text-rose-200">{recordsSummary.withdrawalCount}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-[11px] text-slate-400">兑换记录</div>
                  <div className="text-lg font-semibold text-cyan-200">{recordsSummary.exchangeCount}</div>
                </div>
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="text-[11px] text-amber-100/80">待批准</div>
                  <div className="text-lg font-semibold text-amber-200">{recordsSummary.pendingApprove}</div>
                </div>
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="text-[11px] text-emerald-100/80">待完成</div>
                  <div className="text-lg font-semibold text-emerald-200">{recordsSummary.pendingComplete}</div>
                </div>
              </div>
              </>
              ) : (
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                  当前以 SubAdmin 身份登录，仅可查看你邀请范围内且合同类型允许的客户与设备；续月卡、续合约、充值和运营设置保存仅 Owner 可操作。
                </div>
              )}

              {isPrimaryOwnerSession && showRecordsDetail && (
              <>
            <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.65fr] gap-6 mb-8">
              <div className="rounded-2xl border border-cyan-500/20 bg-slate-900/70 p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-sm font-semibold text-cyan-200">管理员权限快照</div>
                    <div className="text-xs text-slate-400 mt-1">总览直接查看链上管理员状态，详细增删仍在管理员控制台。</div>
                  </div>
                  {isPrimaryOwnerSession && (
                    <button
                      onClick={() => setSection('owner')}
                      className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-semibold hover:bg-cyan-400 transition-colors"
                    >
                      打开管理员控制台
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  {quickAdminCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="text-xs text-slate-400 mb-2">{card.label}</div>
                      <div className="text-lg font-bold text-slate-100 mb-1 break-all">{card.value}</div>
                      <div className="text-xs text-slate-500 break-all">{card.detail}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <div className="text-xs text-slate-400 mb-2">管理员名单</div>
                  <div className="flex flex-wrap gap-2">
                    {chainAdminAddresses.length > 0 ? chainAdminAddresses.map((address) => {
                      const isOwner = chainOwnerAddress && address.toLowerCase() === chainOwnerAddress.toLowerCase();
                      const isCurrent = adminWallet && address.toLowerCase() === adminWallet.toLowerCase();
                      return (
                        <span key={address} className={`rounded-full px-3 py-1 text-xs border ${isOwner ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-200'}`}>
                          {shortWallet(address)}{isOwner ? ' · Owner' : isCurrent ? ' · Current' : ''}
                        </span>
                      );
                    }) : (
                      <span className="text-xs text-slate-500">暂无链上管理员数据</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <div className="text-sm font-semibold text-slate-200 mb-3">管理规则</div>
                <div className="space-y-3 text-xs text-slate-400 leading-6">
                  <p>所有链上管理员与 owner 拥有同等业务管理权限。</p>
                  <p>管理员增删会同步写入 MiningPool、SUPER、SwapRouter 三份核心合约。</p>
                  <p>Owner 作为永久管理员保留，不能从管理员列表移除。</p>
                </div>
              </div>
            </div>
            </>
            )}

            </>
            )}

            {/* Toolbar + Miner register (On-chain) */}
            {section === 'onchain' && (
            <>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <h3 className="text-xl font-bold">链上数据面板</h3>
              <div className="flex gap-3 w-full sm:w-auto justify-end">
                {!minerInfo?.registered && (
                  <button
                    onClick={handleRegisterMiner}
                    disabled={registering || loading}
                    className="bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-slate-950"
                  >
                    {registering ? '注册中...' : '注册矿工'}
                  </button>
                )}
                <button
                  onClick={() => {
                    void refreshOnChainData();
                  }}
                  disabled={loading}
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700"
                >
                  {loading ? '同步中...' : '刷新'}
                </button>
              </div>
            </div>

            {!minerInfo?.registered && (
              <div className="mb-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="text-sm font-medium text-cyan-200 mb-3">矿工注册参数（链上管理口径）</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-300">设备 ID</span>
                    <input
                      value={registerDeviceId}
                      onChange={(event) => setRegisterDeviceId(event.target.value)}
                      placeholder="例如 web-device-001"
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-slate-300">上报算力（合约原始值）</span>
                    <input
                      value={registerHashrate}
                      onChange={(event) => setRegisterHashrate(event.target.value)}
                      inputMode="numeric"
                      placeholder="例如 2600"
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                    />
                  </label>
                </div>
                <p className="mt-3 text-xs text-cyan-100/80">
                  说明：面板按 {HASHRATE_UNIT} 为换算单位显示 MH/s，例如 2600 会显示为 2.600 MH/s。
                </p>
              </div>
            )}
            </>
            )}

            {poolAddress && section !== 'docs' && (
              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-400 break-all">
                合约地址: {poolAddress}
              </div>
            )}

            {backendLoading && (
              <div className="mb-6 rounded-xl px-4 py-3 text-sm border border-slate-800 bg-slate-900/50 text-slate-400">
                {'正在同步后台系统数据...'}
              </div>
            )}

            {adminAlerts && adminAlerts.items.length > 0 && (
              <div className="mb-6 rounded-2xl border border-red-500/60 bg-red-500/10 p-4 animate-pulse-slow">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-red-200 font-semibold">
                    <AlertTriangle size={18} className="text-red-400" />
                    设备掉线告警（{adminAlerts.counts.total}）
                    <span className="text-xs font-normal text-red-300/80">
                      离线 {adminAlerts.counts.offline} · 延迟 {adminAlerts.counts.stale}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSection('customers')}
                      className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-xs text-red-100 hover:bg-red-500/30"
                    >
                      前往客户列表处理
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadBackendData()}
                      className="px-3 py-1.5 rounded-lg border border-red-500/40 text-xs text-red-200 hover:bg-red-500/20"
                    >
                      立即刷新
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                  {adminAlerts.items.slice(0, 10).map((alert) => (
                    <div
                      key={alert.userId}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                        alert.onlineStatus === 'offline'
                          ? 'border-red-500/50 bg-red-500/15 text-red-100'
                          : 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-block h-2 w-2 rounded-full ${alert.onlineStatus === 'offline' ? 'bg-red-400' : 'bg-amber-400'}`} />
                        <span className="font-mono truncate">
                          {alert.nickname ? `${alert.nickname} · ` : ''}{shortWallet(alert.wallet)}
                        </span>
                        {alert.machineCode && <span className="text-slate-300/70 truncate">[{alert.machineCode}]</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span>
                          {alert.onlineStatus === 'offline' ? '已离线' : '心跳延迟'} {alert.lastSeenAt ? formatOfflineDuration(alert.offlineSeconds) : '未上报'}
                        </span>
                        <span className="text-slate-300/70">设备 {alert.activeDeviceCount}/{alert.deviceCount}</span>
                        <span className="text-slate-300/70">
                          {alert.lastSeenAt ? `最后心跳 ${new Date(alert.lastSeenAt).toLocaleTimeString('zh-CN')}` : '无心跳'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {adminAlerts.items.length > 10 && (
                    <div className="text-[11px] text-red-200/80 text-center pt-1">
                      还有 {adminAlerts.items.length - 10} 条告警，点击「前往客户列表处理」查看全部
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'system' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="text-sm font-semibold text-cyan-200 mb-3">系统维护与收益设置</div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">维护状态</div>
                    <div className="text-slate-100 mt-1">{
                      !systemStatus ? '未同步' : (systemStatus.maintenanceEnabled ? '开启' : '关闭')
                    }</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">自动兑换</div>
                    <div className="text-slate-100 mt-1">{
                      !systemStatus ? '未同步' : (systemStatus.exchangeAutoEnabled ? '开启' : '关闭')
                    }</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">月卡天数</div>
                    <div className="text-slate-100 mt-1">{systemStatus?.monthlyCardDays ?? '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">合同默认天数</div>
                    <div className="text-slate-100 mt-1">{systemStatus?.contractTermDaysDefault ?? '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 col-span-2">
                    <div className="text-slate-400">小时收益单价</div>
                    <div className="text-slate-100 mt-1">{systemStatus?.rewardRateUsdtPerHour ?? '--'} USDT / hour</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input value={maintenanceMessageZh} onChange={(event) => { markSystemSettingsDirty(); setMaintenanceMessageZh(event.target.value); }} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="维护文案（中文）" />
                  <input value={maintenanceMessageEn} onChange={(event) => { markSystemSettingsDirty(); setMaintenanceMessageEn(event.target.value); }} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="Maintenance message (EN)" />
                  <input value={monthlyCardDays} onChange={(event) => { markSystemSettingsDirty(); setMonthlyCardDays(event.target.value); }} inputMode="numeric" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="月卡天数" />
                  <input value={contractTermDays} onChange={(event) => { markSystemSettingsDirty(); setContractTermDays(event.target.value); }} inputMode="numeric" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="合同默认天数" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={rewardRatePerHour} onChange={(event) => { markSystemSettingsDirty(); setRewardRatePerHour(event.target.value); }} inputMode="decimal" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="每小时收益 USDT" />
                  <div className="flex gap-2">
                    <button onClick={handleToggleMaintenance} disabled={adminActionLoading === 'systemSettings' || !systemStatus} className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950">
                      {adminActionLoading === 'systemSettings' ? '保存中...' : '切换维护'}
                    </button>
                    <button onClick={handleToggleExchange} disabled={adminActionLoading === 'systemSettings' || !systemStatus} className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700">
                      切换自动兑换
                    </button>
                  </div>
                </div>
                <button onClick={handleSaveSystemParameters} disabled={adminActionLoading === 'systemSettings' || !systemStatus} className="mt-3 w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700">
                  保存系统参数
                </button>
              </div>

              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-amber-200">SubAdmin 管理</div>
                    <p className="mt-1 text-xs text-amber-100/80">
                      添加 SubAdmin 时必须指定可使用的合同类型；保存后合同类型不可修改。SubAdmin 只能管理自己推荐范围内且合同类型匹配的客户。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadSubAdminAccess()}
                    disabled={subAdminAccessLoading || !subAdminManagementAllowed}
                    className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                  >
                    {subAdminAccessLoading ? '刷新中...' : '刷新'}
                  </button>
                </div>

                {!subAdminManagementAllowed && (
                  <div className="mb-3 rounded-lg border border-amber-500/30 bg-slate-950/70 px-3 py-2 text-xs text-amber-100">
                    当前钱包不是 Primary Owner，已隐藏 SubAdmin 管理；系统参数、协议、公告和客服配置仍可正常使用。
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    value={newSubAdminWallet}
                    onChange={(event) => setNewSubAdminWallet(event.target.value)}
                    disabled={!subAdminManagementAllowed}
                    placeholder="SubAdmin 钱包地址 0x..."
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                  <input
                    value={newSubAdminNote}
                    onChange={(event) => setNewSubAdminNote(event.target.value)}
                    disabled={!subAdminManagementAllowed}
                    placeholder="备注（可选）"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                </div>
                <div className="mt-3 rounded-xl border border-amber-500/20 bg-slate-950/40 p-3">
                  <div className="mb-2 text-xs font-medium text-amber-100">允许使用的合同类型</div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {CONTRACT_TYPE_OPTIONS.map((option) => (
                      <label key={option.id} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200">
                        <input
                          type="checkbox"
                          disabled={!subAdminManagementAllowed}
                          checked={newSubAdminContractTypes.includes(option.id)}
                          onChange={(event) => {
                            setNewSubAdminContractTypes((current) => {
                              if (event.target.checked) return Array.from(new Set([...current, option.id]));
                              return current.filter((item) => item !== option.id);
                            });
                          }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddSubAdmin()}
                  disabled={!subAdminManagementAllowed || subAdminAccessLoading || !newSubAdminWallet.trim() || newSubAdminContractTypes.length === 0}
                  className="mt-2 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-60"
                >
                  {subAdminAccessLoading ? '处理中...' : '添加 SubAdmin'}
                </button>

                {subAdminAccessMessage && (
                  <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-cyan-200 break-all">
                    {subAdminAccessMessage}
                  </div>
                )}

                <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400">
                      <tr>
                        <th className="px-3 py-2 font-medium">钱包</th>
                        <th className="px-3 py-2 font-medium">来源</th>
                        <th className="px-3 py-2 font-medium">合同类型</th>
                        <th className="px-3 py-2 font-medium">备注</th>
                        <th className="px-3 py-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {ownerSubAdmins.map((item) => (
                        <tr key={`${item.source}-${item.wallet}`} className="align-top">
                          <td className="px-3 py-2 font-mono text-slate-200 break-all">{item.wallet}</td>
                          <td className="px-3 py-2 text-slate-400">
                            {item.source === 'database' ? '面板添加' : '环境变量'}
                          </td>
                          <td className="px-3 py-2 text-slate-400">{formatContractTypes(item.allowedContractTypes)}</td>
                          <td className="px-3 py-2 text-slate-400">{item.note || '--'}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => void handleRemoveSubAdmin(item)}
                              disabled={!subAdminManagementAllowed || subAdminAccessLoading || !item.canRemove}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              <Trash2 size={12} />
                              删除
                            </button>
                          </td>
                        </tr>
                      ))}
                      {ownerSubAdmins.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                            暂无 SubAdmin
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-emerald-200">APP 用户协议</div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>强制同意</span>
                    <button
                      type="button"
                      onClick={handleToggleUserAgreement}
                      disabled={adminActionLoading === 'systemSettings'}
                      className={`px-3 py-1 rounded-full border text-xs ${agreementRequired ? 'bg-emerald-500/80 text-slate-950 border-emerald-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                    >
                      {agreementRequired ? '开启' : '关闭'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  开启后，用户打开 APP 必须同意当前版本的协议才能继续使用。修改版本号会触发所有用户重新同意。
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    value={agreementVersion}
                    onChange={(event) => { markSystemSettingsDirty(); setAgreementVersion(event.target.value); }}
                    placeholder="版本号 (如 1.0.0)"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <input
                    value={agreementTitleZh}
                    onChange={(event) => { markSystemSettingsDirty(); setAgreementTitleZh(event.target.value); }}
                    placeholder="协议标题（中文）"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <input
                    value={agreementTitleEn}
                    onChange={(event) => { markSystemSettingsDirty(); setAgreementTitleEn(event.target.value); }}
                    placeholder="Agreement title (EN)"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <textarea
                    value={agreementContentZh}
                    onChange={(event) => { markSystemSettingsDirty(); setAgreementContentZh(event.target.value); }}
                    placeholder="协议正文（中文）"
                    rows={8}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 font-mono"
                  />
                  <textarea
                    value={agreementContentEn}
                    onChange={(event) => { markSystemSettingsDirty(); setAgreementContentEn(event.target.value); }}
                    placeholder="Agreement content (EN)"
                    rows={8}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400 font-mono"
                  />
                </div>
                <button
                  onClick={handleSaveUserAgreement}
                  disabled={adminActionLoading === 'systemSettings'}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950"
                >
                  {adminActionLoading === 'systemSettings' ? '保存中...' : '保存用户协议'}
                </button>
              </div>

              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 xl:col-span-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-semibold text-cyan-200">挖矿合同设置</div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span>强制同意</span>
                    <button
                      type="button"
                      onClick={handleToggleContract}
                      disabled={adminActionLoading === 'systemSettings'}
                      className={`px-3 py-1 rounded-full border text-xs ${contractRequired ? 'bg-cyan-500/80 text-slate-950 border-cyan-400' : 'bg-slate-800 text-slate-300 border-slate-700'}`}
                    >
                      {contractRequired ? '开启' : '关闭'}
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mb-3">
                  开启后，用户激活挖矿账户后需要阅读并同意当前版本的合同才能获得收益。修改版本号会触发所有活跃用户重新同意。
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <input
                    value={contractVersion}
                    onChange={(event) => { markSystemSettingsDirty(); setContractVersion(event.target.value); }}
                    placeholder="版本号 (如 1.0.0)"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                  <input
                    value={contractTitleZh}
                    onChange={(event) => { markSystemSettingsDirty(); setContractTitleZh(event.target.value); }}
                    placeholder="合同标题（中文）"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                  <input
                    value={contractTitleEn}
                    onChange={(event) => { markSystemSettingsDirty(); setContractTitleEn(event.target.value); }}
                    placeholder="Contract title (EN)"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <textarea
                    value={contractContentZh}
                    onChange={(event) => { markSystemSettingsDirty(); setContractContentZh(event.target.value); }}
                    placeholder="合同正文（中文）"
                    rows={8}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 font-mono"
                  />
                  <textarea
                    value={contractContentEn}
                    onChange={(event) => { markSystemSettingsDirty(); setContractContentEn(event.target.value); }}
                    placeholder="Contract content (EN)"
                    rows={8}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
                <button
                  onClick={handleSaveContract}
                  disabled={adminActionLoading === 'systemSettings'}
                  className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950"
                >
                  {adminActionLoading === 'systemSettings' ? '保存中...' : '保存合同设置'}
                </button>
              </div>

              <div className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4 xl:col-span-2">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-fuchsia-200">
                      <Megaphone size={16} />
                      APP 公告管理
                    </div>
                    <p className="mt-2 text-xs text-fuchsia-100/80">
                      管理员可创建、发布、下线公告。APP 会拉取当前有效公告，并对未读置顶公告弹窗提醒。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={announcementFilter}
                      onChange={(event) => setAnnouncementFilter(event.target.value as 'all' | 'active' | 'published' | 'draft' | 'expired')}
                      className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                    >
                      <option value="all">全部</option>
                      <option value="active">当前生效</option>
                      <option value="published">已发布</option>
                      <option value="draft">草稿</option>
                      <option value="expired">已过期</option>
                    </select>
                    <button
                      type="button"
                      onClick={resetAnnouncementForm}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 hover:bg-slate-800"
                    >
                      <Plus size={14} />
                      新建公告
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1.4fr]">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">{editingAnnouncementId ? '编辑公告' : '创建公告'}</div>
                      {editingAnnouncementId && (
                        <button type="button" onClick={resetAnnouncementForm} className="text-xs text-slate-400 hover:text-slate-200">
                          取消编辑
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <input
                        value={announcementForm.titleZh}
                        onChange={(event) => handleAnnouncementFieldChange('titleZh', event.target.value)}
                        placeholder="公告标题（中文）"
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                      />
                      <input
                        value={announcementForm.titleEn}
                        onChange={(event) => handleAnnouncementFieldChange('titleEn', event.target.value)}
                        placeholder="Announcement title (EN)"
                        className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={announcementForm.level}
                          onChange={(event) => handleAnnouncementFieldChange('level', event.target.value as AnnouncementFormState['level'])}
                          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                        >
                          <option value="info">普通公告</option>
                          <option value="warning">提醒公告</option>
                          <option value="critical">重要公告</option>
                        </select>
                        <select
                          value={announcementForm.target}
                          onChange={(event) => handleAnnouncementFieldChange('target', event.target.value as AnnouncementFormState['target'])}
                          className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                        >
                          <option value="all">全部用户</option>
                          <option value="active_contract">仅有效合约用户</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                          <input
                            type="checkbox"
                            checked={announcementForm.isPinned}
                            onChange={(event) => handleAnnouncementFieldChange('isPinned', event.target.checked)}
                            className="accent-fuchsia-500"
                          />
                          置顶
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                          <input
                            type="checkbox"
                            checked={announcementForm.isPublished}
                            onChange={(event) => handleAnnouncementFieldChange('isPublished', event.target.checked)}
                            className="accent-fuchsia-500"
                          />
                          立即发布
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label className="text-xs text-slate-400">
                          发布时间
                          <input
                            type="datetime-local"
                            value={announcementForm.publishAt}
                            onChange={(event) => handleAnnouncementFieldChange('publishAt', event.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                          />
                        </label>
                        <label className="text-xs text-slate-400">
                          过期时间
                          <input
                            type="datetime-local"
                            value={announcementForm.expireAt}
                            onChange={(event) => handleAnnouncementFieldChange('expireAt', event.target.value)}
                            className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                          />
                        </label>
                      </div>
                      <textarea
                        value={announcementForm.contentZh}
                        onChange={(event) => handleAnnouncementFieldChange('contentZh', event.target.value)}
                        placeholder="公告正文（中文）"
                        rows={6}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                      />
                      <textarea
                        value={announcementForm.contentEn}
                        onChange={(event) => handleAnnouncementFieldChange('contentEn', event.target.value)}
                        placeholder="Announcement content (EN)"
                        rows={6}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-fuchsia-400"
                      />
                      <button
                        type="button"
                        onClick={handleSaveAnnouncement}
                        disabled={adminActionLoading === 'announcementSave'}
                        className="rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-fuchsia-400 disabled:opacity-60"
                      >
                        {adminActionLoading === 'announcementSave' ? '保存中...' : editingAnnouncementId ? '保存公告修改' : '创建公告'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm font-semibold text-white">公告列表</div>
                      <div className="text-xs text-slate-400">共 {announcements.length} 条</div>
                    </div>

                    <div className="space-y-3 max-h-176 overflow-y-auto pr-1">
                      {announcements.length === 0 && (
                        <div className="rounded-lg border border-dashed border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                          当前筛选下暂无公告。
                        </div>
                      )}

                      {announcements.map((item) => (
                        <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-slate-100">{item.titleZh}</span>
                                {item.isPinned && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/20 px-2 py-1 text-[11px] text-fuchsia-200">
                                    <Pin size={11} />
                                    置顶
                                  </span>
                                )}
                                <span className={`rounded-full px-2 py-1 text-[11px] ${item.level === 'critical' ? 'bg-red-500/20 text-red-200' : item.level === 'warning' ? 'bg-amber-500/20 text-amber-200' : 'bg-sky-500/20 text-sky-200'}`}>
                                  {item.level}
                                </span>
                                <span className={`rounded-full px-2 py-1 text-[11px] ${item.isPublished ? 'bg-emerald-500/20 text-emerald-200' : 'bg-slate-700 text-slate-300'}`}>
                                  {item.isPublished ? '已发布' : '草稿'}
                                </span>
                              </div>
                              <div className="mt-2 text-xs text-slate-400">{item.titleEn}</div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleEditAnnouncement(item)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700"
                              >
                                <Pencil size={12} />
                                编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleAnnouncementPublish(item)}
                                disabled={adminActionLoading === `announcement-${item.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                              >
                                {item.isPublished ? <EyeOff size={12} /> : <Eye size={12} />}
                                {item.isPublished ? '下线' : '发布'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteAnnouncement(item)}
                                disabled={adminActionLoading === `announcement-delete-${item.id}`}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                              >
                                <Trash2 size={12} />
                                删除
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-slate-400 md:grid-cols-3">
                            <div>目标用户：{item.target === 'active_contract' ? '有效合约用户' : '全部用户'}</div>
                            <div>发布时间：{item.publishAt ? new Date(item.publishAt).toLocaleString('zh-CN') : '未设置'}</div>
                            <div>过期时间：{item.expireAt ? new Date(item.expireAt).toLocaleString('zh-CN') : '不过期'}</div>
                          </div>

                          <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-300">
                            <div className="line-clamp-3 whitespace-pre-wrap">{item.contentZh}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}

            {section === 'customers' && (
            <div className="grid grid-cols-1 gap-6 mb-6">
              {/* Activation Panel */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-200 mb-1">客户激活 / 续期（线下收款后录入）</div>
                <p className="text-xs text-emerald-100/80 mb-3">
                  选择客户 → 录入 App 设备标识（可选）→ 选择合同期 (1/2/3 年)，系统自动计算 contract_end_at 并开启收益。到期后 devices 心跳将自动停发。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <select
                    value={activateCustomerId}
                    onChange={(e) => setActivateCustomerId(e.target.value)}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  >
                    <option value="">-- 选择客户 --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nickname ? `${c.nickname} · ` : ''}{c.wallet.slice(0, 10)}...{c.wallet.slice(-6)}
                      </option>
                    ))}
                  </select>
                  <input
                    value={activateMachineCode}
                    onChange={(e) => setActivateMachineCode(e.target.value)}
                    placeholder="设备标识（可选）"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <select
                    value={activateTermYears}
                    onChange={(e) => setActivateTermYears(e.target.value as '1' | '2' | '3')}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  >
                    <option value="1">合同期 1 年（365 天）</option>
                    <option value="2">合同期 2 年（730 天）</option>
                    <option value="3">合同期 3 年（1095 天）</option>
                  </select>
                  <button
                    onClick={handleActivateCustomer}
                    disabled={adminActionLoading === 'activateCustomer' || !activateCustomerId}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-semibold text-slate-950"
                  >
                    {adminActionLoading === 'activateCustomer' ? '激活中...' : '激活 / 重置合同'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                <div className="text-sm font-semibold text-purple-200 mb-3">客户概览</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">客户总数</div>
                    <div className="text-slate-100 mt-1">{customers.length}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">在线客户</div>
                    <div className="text-slate-100 mt-1">{customers.filter((item) => item.onlineStatus === 'online').length}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">合同有效</div>
                    <div className="text-slate-100 mt-1">{customers.filter((item) => item.contractActive === 1).length}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">即将到期 (&le;30天)</div>
                    <div className="text-slate-100 mt-1">
                      {customers.filter((c) => {
                        if (!c.contractEndAt) return false;
                        const ms = new Date(c.contractEndAt).getTime() - Date.now();
                        return ms > 0 && ms < 30 * 86400_000;
                      }).length}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-amber-200">设备标识冲突检测</div>
                      <p className="text-xs text-amber-100/80 mt-1">同一设备标识对应多个账户时，会影响客服核对与合同归属，请优先处理。</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadBackendData()}
                      disabled={backendLoading}
                      className="px-3 py-1.5 rounded border border-amber-500/40 bg-amber-500/20 text-xs text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                    >
                      刷新冲突
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mb-3">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">冲突设备标识</div>
                      <div className="text-slate-100 mt-1">{machineCodeConflicts?.counts.machineCodes ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">影响账户数</div>
                      <div className="text-slate-100 mt-1">{machineCodeConflicts?.counts.impactedUsers ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">其中有效合同</div>
                      <div className="text-slate-100 mt-1">{machineCodeConflicts?.counts.activeContracts ?? 0}</div>
                    </div>
                  </div>

                  {machineCodeConflicts?.items?.length ? (
                    <div className="space-y-2 max-h-56 overflow-auto pr-1">
                      {machineCodeConflicts.items.slice(0, 12).map((item) => {
                        const fallbackKeepUser =
                          item.users.find((user) => user.contractActive === 1)?.userId
                          ?? item.users[0]?.userId
                          ?? '';
                        const selectedKeepUserId = machineCodeKeepUserByCode[item.machineCode] || fallbackKeepUser;
                        return (
                        <div key={item.machineCode} className="rounded-lg border border-amber-500/30 bg-slate-950/60 p-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="font-mono text-amber-100">{item.machineCode}</span>
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-200">{item.userCount} 个账户</span>
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-emerald-200">有效合同 {item.activeContractCount}</span>
                          </div>
                          <div className="text-slate-300/90">
                            {item.users.slice(0, 4).map((user) => (
                              <div key={user.userId} className="flex flex-wrap items-center gap-2">
                                <span>{user.nickname || user.wallet.slice(0, 10)}</span>
                                <span className="font-mono text-slate-400">{user.wallet.slice(0, 10)}...{user.wallet.slice(-6)}</span>
                                <span className={user.onlineStatus === 'online' ? 'text-emerald-300' : user.onlineStatus === 'stale' ? 'text-amber-300' : 'text-red-300'}>
                                  {user.onlineStatus === 'online' ? '在线' : user.onlineStatus === 'stale' ? '延迟' : '离线'}
                                </span>
                                <span className="text-slate-500">设备 {user.activeDeviceCount}/{user.deviceCount}</span>
                              </div>
                            ))}
                          </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                value={selectedKeepUserId}
                                onChange={(e) => setMachineCodeKeepUserByCode((prev) => ({ ...prev, [item.machineCode]: e.target.value }))}
                                className="h-8 rounded border border-amber-500/40 bg-slate-900 px-2 text-[11px] text-slate-100 outline-none focus:border-amber-300"
                              >
                                {item.users.map((user) => (
                                  <option key={user.userId} value={user.userId}>
                                    {user.contractActive === 1 ? '有效合同' : '停用合同'} · {user.nickname || `${user.wallet.slice(0, 10)}...${user.wallet.slice(-6)}`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => void handleResolveMachineCodeConflict(item)}
                                disabled={machineCodeResolveLoading === item.machineCode || !selectedKeepUserId}
                                className="px-2.5 py-1 rounded border border-amber-400/50 bg-amber-500/20 text-[11px] text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
                              >
                                {machineCodeResolveLoading === item.machineCode ? '处理中…' : '保留所选账号并清理其余'}
                              </button>
                            </div>
                        </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
                      当前未发现设备标识冲突。
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 mb-4">
                  <div className="text-sm font-semibold text-amber-200 mb-2">系统管理员</div>
                  <div className="text-[11px] text-amber-100/80 mb-2">
                    当前角色：{ownerSessionRole === 'owner' ? 'Owner 超级管理员（可见全部账户，可操作续费）' : ownerSessionRole === 'subadmin' ? 'SubAdmin 子管理员（只读查看，不可续月卡）' : '未识别（请重新钱包登录）'}
                  </div>
                  <div className="text-xs text-slate-300 break-all font-mono mb-3">{adminSummary?.wallet ?? adminWallet}</div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">BNB</div>
                      <div className="text-slate-100 mt-1">{formatDecimalString(adminSummary?.bnbBalance, 6)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">USDT</div>
                      <div className="text-slate-100 mt-1">{formatDecimalString(adminSummary?.usdtBalance, 4)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                      <div className="text-slate-400">SUPER</div>
                      <div className="text-slate-100 mt-1">{formatDecimalString(adminSummary?.superBalance, 4)}</div>
                    </div>
                  </div>
                </div>

                {/* Bulk actions toolbar */}
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs">
                  <span className="text-slate-300">已选 {selectedCustomerIds.size} 位</span>
                  <input
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="搜索钱包 / 昵称 / ID / 设备标识"
                    className="h-8 w-56 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                  />
                  <select
                    value={customerReferrerFilter}
                    onChange={(e) => setCustomerReferrerFilter(e.target.value)}
                    className="h-8 w-52 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                  >
                    <option value="">推荐人列表</option>
                    {referrerOptions.map((wallet) => (
                      <option key={wallet} value={wallet}>{shortWallet(wallet)}</option>
                    ))}
                  </select>
                  <input
                    value={customerReferrerFilter}
                    onChange={(e) => setCustomerReferrerFilter(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      const value = customerReferrerFilter.trim();
                      if (value && !isAddress(value)) {
                        setBackendError('请输入有效的推荐人钱包地址。');
                        return;
                      }
                      setBackendError('');
                      setAppliedCustomerReferrerFilter(value.toLowerCase());
                      setSelectedCustomerIds(new Set());
                    }}
                    placeholder="推荐人钱包 0x..."
                    className="h-8 w-48 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const value = customerReferrerFilter.trim();
                      if (value && !isAddress(value)) {
                        setBackendError('请输入有效的推荐人钱包地址。');
                        return;
                      }
                      setBackendError('');
                      setAppliedCustomerReferrerFilter(value.toLowerCase());
                      setSelectedCustomerIds(new Set());
                    }}
                    className="px-2 py-1 rounded border border-indigo-500/40 bg-indigo-500/20 text-indigo-100 hover:bg-indigo-500/30"
                  >
                    筛选推荐人
                  </button>
                  {appliedCustomerReferrerFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerReferrerFilter('');
                        setAppliedCustomerReferrerFilter('');
                        setSelectedCustomerIds(new Set());
                      }}
                      className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                    >
                      清除推荐人
                    </button>
                  )}
                  <select
                    value={customerStatusFilter}
                    onChange={(e) => setCustomerStatusFilter(e.target.value as 'all' | 'needs_action' | 'expired' | 'expiring' | 'offline' | 'low_gas')}
                    className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                  >
                    <option value="all">全部客户</option>
                    <option value="needs_action">需优先处理</option>
                    <option value="expired">合同已到期</option>
                    <option value="expiring">30天内到期</option>
                    <option value="offline">离线客户</option>
                    <option value="low_gas">低 Gas 客户</option>
                  </select>
                  <select
                    value={customerSortBy}
                    onChange={(e) => setCustomerSortBy(e.target.value as 'recommend' | 'expiry' | 'reward' | 'rate')}
                    className="h-8 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                  >
                    <option value="recommend">按推荐分</option>
                    <option value="expiry">按到期时间</option>
                    <option value="reward">按累计收益</option>
                    <option value="rate">按收益率</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerIds(new Set(visibleCustomers.map((entry) => entry.customer.id)))}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    全选筛选结果
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCustomerIds(new Set())}
                    className="px-2 py-1 rounded border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
                  >
                    清空
                  </button>
                  <div className="flex flex-wrap items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                    <span className="text-emerald-100">
                      归集 {selectedCollectionEstimate.customerCount} 客户 / {selectedCollectionEstimate.deviceCount} 设备
                    </span>
                    <span className="text-emerald-200">
                      {selectedCollectionEstimate.amountUsdt.toFixed(3)} USDT / {selectedCollectionEstimate.amountSuper.toFixed(3)} SUPER
                    </span>
                    <input
                      value={collectionTargetWallet}
                      onChange={(event) => setCollectionTargetWallet(event.target.value)}
                      placeholder="目标账户 0x..."
                      className="h-8 w-56 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateCollectionRequest()}
                      disabled={adminActionLoading === 'collection-create' || selectedCustomerIds.size === 0}
                      className="px-2 py-1 rounded bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 disabled:opacity-50"
                    >
                      {adminActionLoading === 'collection-create' ? '创建中...' : '创建归集申请'}
                    </button>
                  </div>
                  {canOperateCustomers ? (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">批量收益率</span>
                        <input
                          value={bulkRate}
                          onChange={(e) => setBulkRate(e.target.value)}
                          placeholder="0.084"
                          className="h-8 w-24 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-purple-400"
                        />
                        <span className="text-slate-400">USDT/h</span>
                        <button
                          type="button"
                          onClick={handleBulkRate}
                          disabled={adminActionLoading === 'bulkRate' || selectedCustomerIds.size === 0}
                          className="px-2 py-1 rounded bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold disabled:opacity-50"
                        >
                          {adminActionLoading === 'bulkRate' ? '提交中…' : '应用'}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">续期天数</span>
                        <input
                          value={extendDays}
                          onChange={(e) => setExtendDays(e.target.value)}
                          placeholder="30"
                          className="h-8 w-16 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-emerald-400"
                        />
                        <span className="text-slate-400">天（点行末按钮）</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">续期+充值</span>
                        <input
                          value={customerRenewSuperAmount}
                          onChange={(e) => setCustomerRenewSuperAmount(e.target.value)}
                          placeholder="100"
                          className="h-8 w-20 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-amber-400"
                        />
                        <span className="text-slate-400">SUPER</span>
                      </div>
                    </>
                  ) : (
                    <span className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-400">
                      SubAdmin 只读：不可批量修改或续月卡
                    </span>
                  )}
                  <span className="ml-auto text-slate-400">当前显示 {visibleCustomers.length} / {customers.length}</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-120">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-2 py-2 font-medium w-8"></th>
                        <th className="px-3 py-2 font-medium">钱包</th>
                        <th className="px-3 py-2 font-medium">设备标识</th>
                        <th className="px-3 py-2 font-medium">合同开始</th>
                        <th className="px-3 py-2 font-medium">合同结束</th>
                        <th className="px-3 py-2 font-medium">月卡到期</th>
                        <th className="px-3 py-2 font-medium">状态</th>
                        <th className="px-3 py-2 font-medium">矿机注册</th>
                        <th className="px-3 py-2 font-medium">在线</th>
                        <th className="px-3 py-2 font-medium">设备</th>
                        <th className="px-3 py-2 font-medium">设备状态明细</th>
                        <th className="px-3 py-2 font-medium">总算力</th>
                        <th className="px-3 py-2 font-medium">最近心跳</th>
                        <th className="px-3 py-2 font-medium">BNB</th>
                        <th className="px-3 py-2 font-medium">USDT</th>
                        <th className="px-3 py-2 font-medium">SUPER</th>
                        <th className="px-3 py-2 font-medium">收益率</th>
                        <th className="px-3 py-2 font-medium">累计 USDT</th>
                        <th className="px-3 py-2 font-medium">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {visibleCustomers.map((entry) => {
                        const { customer, remainDays, expiring, expired } = entry;
                        const registerBadge = getMinerRegisterBadge(customer);
                        const deviceMetrics = deviceMetricsByUserId.get(customer.id);
                        const statusSummary = deviceMetrics
                          ? Object.entries(deviceMetrics.statusCounts)
                            .sort((a, b) => Number(b[1]) - Number(a[1]))
                            .map(([status, count]) => `${status}:${count}`)
                            .join(' / ')
                          : '--';
                        const checked = selectedCustomerIds.has(customer.id);
                        const isOfflineAlert = customer.contractActive === 1 && customer.onlineStatus !== 'online';
                        const rowClass = isOfflineAlert
                          ? 'bg-red-500/10 hover:bg-red-500/20 border-l-2 border-red-500'
                          : 'hover:bg-slate-800/40';
                        return (
                          <tr key={customer.id} className={rowClass}>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCustomerSelection(customer.id)}
                                className="accent-purple-500"
                              />
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-200 break-all">
                              {customer.nickname && <div className="text-slate-100 text-[11px] mb-0.5">{customer.nickname}</div>}
                              {customer.wallet}
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-300">{customer.machineCode ?? '--'}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-300">{formatDateOnly(customer.contractStartAt)}</td>
                            <td className={`px-3 py-2 whitespace-nowrap ${expired ? 'text-red-300' : expiring ? 'text-amber-300' : 'text-slate-300'}`}>
                              {customer.contractEndAt
                                ? `${formatDateOnly(customer.contractEndAt)}${remainDays !== null ? ` (${remainDays}天)` : ''}`
                                : '未激活'}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-slate-300">
                              {formatMonthlyCardEndDate(customer.monthlyCardEndAt, customer.contractStartAt, customer.monthlyCardDays)}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{customer.contractActive ? '有效' : '停用'}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${registerBadge.className}`}>
                                {registerBadge.text}
                              </span>
                            </td>
                            <td className={`px-3 py-2 font-medium ${customer.onlineStatus === 'online' ? 'text-emerald-300' : customer.onlineStatus === 'stale' ? 'text-amber-300' : 'text-red-300'}`}>
                              {customer.onlineStatus === 'online' ? '在线' : customer.onlineStatus === 'stale' ? '延迟' : '离线'}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{customer.activeDeviceCount}/{customer.deviceCount}</td>
                            <td className="px-3 py-2 text-slate-400">{statusSummary || '--'}</td>
                            <td className="px-3 py-2 text-slate-300">
                              {deviceMetrics ? formatHashrate(BigInt(Math.max(0, Math.floor(deviceMetrics.totalHashrate)))) : '--'}
                            </td>
                            <td className="px-3 py-2 text-slate-400">
                              {deviceMetrics?.lastSeenAt ? new Date(deviceMetrics.lastSeenAt).toLocaleString('zh-CN') : '--'}
                            </td>
                            <td className="px-3 py-2 text-slate-300">{formatDecimalString(customer.bnbBalance, 6)}</td>
                            <td className="px-3 py-2 text-slate-300">{formatDecimalString(customer.usdtBalance, 4)}</td>
                            <td className="px-3 py-2 text-slate-300">{formatDecimalString(customer.superBalance, 4)}</td>
                            <td className="px-3 py-2 text-slate-300">{customer.rewardRateUsdtPerHour ?? '-'}</td>
                            <td className="px-3 py-2 text-slate-300">{Number(customer.totalRewardUsdt || '0').toFixed(3)}</td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                {canOperateCustomers && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleMonthlyRenew(customer.id, customer.monthlyCardDays)}
                                      disabled={adminActionLoading === `extend-monthly-${customer.id}`}
                                      className="px-2 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50"
                                    >
                                      {adminActionLoading === `extend-monthly-${customer.id}` ? '…' : '按月续期'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleExtendContract(customer.id)}
                                      disabled={adminActionLoading === `extend-${customer.id}`}
                                      className="px-2 py-1 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                                    >
                                      {adminActionLoading === `extend-${customer.id}` ? '…' : `+${extendDays || 30}天`}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleRenew30AndFundSuper(customer)}
                                      disabled={adminActionLoading === `renew-fund-${customer.id}` || !superAddress}
                                      className="px-2 py-1 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                                    >
                                      {adminActionLoading === `renew-fund-${customer.id}` ? '…' : '+30天+SUPER'}
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void openCustomerDetailPanel(customer.id)}
                                  disabled={customerDetailLoading && selectedCustomerDetailId === customer.id}
                                  className="px-2 py-1 rounded bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-500/30 disabled:opacity-50"
                                >
                                  {customerDetailLoading && selectedCustomerDetailId === customer.id ? '加载中…' : '运营设置'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {selectedCustomerDetailId && customerDetailForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm">
                    <div className="max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-indigo-500/30 bg-slate-950 shadow-2xl shadow-indigo-950/60">
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-950/95 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-indigo-100">用户运营设置</div>
                        <div className="mt-1 text-[11px] text-slate-400">
                          {isSubAdminReadOnly ? 'SubAdmin 只读查看，不可续月卡或保存修改' : '核对用户信息后，可保存标签、收益率和设备参数'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomerDetailId('');
                          setSelectedCustomerDetail(null);
                          setCustomerDetailForm(null);
                        }}
                        className="px-2 py-1 rounded border border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
                      >
                        关闭
                      </button>
                    </div>

                    <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs mb-3">
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-300">标签（昵称）</span>
                        <input
                          value={customerDetailForm.nickname}
                          onChange={(e) => setCustomerDetailForm((prev) => prev ? { ...prev, nickname: e.target.value } : prev)}
                          readOnly={isSubAdminReadOnly}
                          placeholder="例如：高净值 / 重点跟进"
                          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-300">运营备注（打标签说明）</span>
                        <input
                          value={customerDetailForm.notes}
                          onChange={(e) => setCustomerDetailForm((prev) => prev ? { ...prev, notes: e.target.value } : prev)}
                          readOnly={isSubAdminReadOnly}
                          placeholder="例如：本周回访 / 重点续费"
                          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-300">收益率 (USDT/h)</span>
                        <input
                          value={customerDetailForm.rewardRateUsdtPerHour}
                          onChange={(e) => setCustomerDetailForm((prev) => prev ? { ...prev, rewardRateUsdtPerHour: e.target.value } : prev)}
                          readOnly={isSubAdminReadOnly}
                          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-slate-300">月卡天数</span>
                        <input
                          value={customerDetailForm.monthlyCardDays}
                          onChange={(e) => setCustomerDetailForm((prev) => prev ? { ...prev, monthlyCardDays: e.target.value } : prev)}
                          readOnly={isSubAdminReadOnly}
                          className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 mb-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-200">账户设备参数</div>
                        <div className="text-[11px] text-slate-500">
                          {selectedCustomerDetail?.devices?.length ?? customerDetailForm.devices.length} 台设备
                        </div>
                      </div>
                      <div className="space-y-3">
                        {customerDetailForm.devices.length > 0 ? customerDetailForm.devices.map((device, index) => (
                          <div key={device.id} className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-300">设备 ID #{index + 1}</span>
                              <input
                                value={device.deviceId}
                                onChange={(e) => setCustomerDetailForm((prev) => prev ? {
                                  ...prev,
                                  devices: prev.devices.map((item) => item.id === device.id ? { ...item, deviceId: e.target.value } : item),
                                } : prev)}
                                readOnly={isSubAdminReadOnly}
                                className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-300">设备算力</span>
                              <input
                                value={device.hashrate}
                                onChange={(e) => setCustomerDetailForm((prev) => prev ? {
                                  ...prev,
                                  devices: prev.devices.map((item) => item.id === device.id ? { ...item, hashrate: e.target.value } : item),
                                } : prev)}
                                inputMode="numeric"
                                readOnly={isSubAdminReadOnly}
                                className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                              />
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="text-slate-300">设备状态</span>
                              <select
                                value={device.status}
                                onChange={(e) => setCustomerDetailForm((prev) => prev ? {
                                  ...prev,
                                  devices: prev.devices.map((item) => item.id === device.id ? { ...item, status: e.target.value } : item),
                                } : prev)}
                                disabled={isSubAdminReadOnly}
                                className="h-9 rounded border border-slate-700 bg-slate-900 px-2 text-slate-100 outline-none focus:border-indigo-400"
                              >
                                <option value="active">active</option>
                                <option value="inactive">inactive</option>
                                <option value="paused">paused</option>
                              </select>
                            </label>
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-300">记录 ID</span>
                              <div className="h-9 rounded border border-slate-800 bg-slate-950 px-2 text-[11px] leading-9 text-slate-500">
                                {device.id}
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
                            该账户下暂无设备记录
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {canOperateCustomers ? (
                        <>
                          <button
                            type="button"
                            onClick={handleSaveCustomerDetail}
                            disabled={adminActionLoading === `save-customer-${selectedCustomerDetailId}`}
                            className="px-3 py-1.5 rounded bg-indigo-500 text-slate-950 text-xs font-semibold hover:bg-indigo-400 disabled:opacity-50"
                          >
                            {adminActionLoading === `save-customer-${selectedCustomerDetailId}` ? '保存中…' : '保存设置'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMonthlyRenew(selectedCustomerDetailId, Number(customerDetailForm.monthlyCardDays) || undefined)}
                            disabled={adminActionLoading === `extend-monthly-${selectedCustomerDetailId}`}
                            className="px-3 py-1.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs hover:bg-cyan-500/30 disabled:opacity-50"
                          >
                            {adminActionLoading === `extend-monthly-${selectedCustomerDetailId}` ? '处理中…' : '按月续费'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtendContract(selectedCustomerDetailId)}
                            disabled={adminActionLoading === `extend-${selectedCustomerDetailId}`}
                            className="px-3 py-1.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs hover:bg-emerald-500/30 disabled:opacity-50"
                          >
                            {adminActionLoading === `extend-${selectedCustomerDetailId}` ? '处理中…' : `合约续期 +${extendDays || 30}天`}
                          </button>
                          {selectedCustomerDetail && (
                            <button
                              type="button"
                              onClick={() => void handleRenew30AndFundSuper(selectedCustomerDetail)}
                              disabled={adminActionLoading === `renew-fund-${selectedCustomerDetailId}` || !superAddress}
                              className="px-3 py-1.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs hover:bg-amber-500/30 disabled:opacity-50"
                            >
                              {adminActionLoading === `renew-fund-${selectedCustomerDetailId}` ? '处理中…' : `续期30天并充值 ${customerRenewSuperAmount || 0} SUPER`}
                            </button>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300">
                          SubAdmin 仅可查看，月卡续费和保存修改请联系 Owner 操作。
                        </div>
                      )}
                    </div>
                    </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
            )}

            {section === 'tokens' && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                <div className="text-sm font-semibold text-blue-200 mb-3">SUPER 代币管理</div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">总供应</div>
                    <div className="text-slate-100 mt-1">{superStats ? formatTokenAmount(superStats.totalSupply) : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">已增发</div>
                    <div className="text-slate-100 mt-1">{superStats ? formatTokenAmount(superStats.totalMinted) : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">可增发余额</div>
                    <div className="text-slate-100 mt-1">{superStats ? formatTokenAmount(superStats.remainingSupply) : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">Swap 池内 SUPER</div>
                    <div className="text-slate-100 mt-1">{superStats ? formatTokenAmount(superStats.routerBalance) : '--'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    value={mintRecipient}
                    onChange={(event) => setMintRecipient(event.target.value)}
                    placeholder="增发接收地址 0x..."
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-blue-400"
                  />
                  <input
                    value={mintAmount}
                    onChange={(event) => setMintAmount(event.target.value)}
                    inputMode="decimal"
                    placeholder="增发 SUPER 数量"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-blue-400"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={handleMintSuper}
                    disabled={adminActionLoading === 'mint' || !superAddress}
                    className="bg-blue-500 hover:bg-blue-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950"
                  >
                    {adminActionLoading === 'mint' ? '增发中...' : '执行 SUPER 增发'}
                  </button>
                  {!superAddress && <span className="text-xs text-amber-200">缺少 VITE_SUPER_ADDRESS，暂不可管理。</span>}
                </div>

                <div className="mt-4 rounded-xl border border-blue-400/30 bg-slate-950/50 p-3">
                  <div className="mb-2 text-xs font-semibold text-blue-100">SUPER 抵押挖矿最小额</div>
                  <div className="mb-2 text-[11px] text-slate-400">
                    当前门槛：{globalStats?.stakeGateSupported ? `${formatTokenAmount(globalStats.minSuperStakeForReward)} SUPER` : '当前矿池合约不支持'}
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row">
                    <input
                      value={minSuperStakeForReward}
                      onChange={(event) => setMinSuperStakeForReward(event.target.value)}
                      inputMode="decimal"
                      placeholder="例如 100"
                      className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={handleSaveMinSuperStakeForReward}
                      disabled={adminActionLoading === 'minSuperStakeForReward' || !globalStats?.stakeGateSupported}
                      className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-400 disabled:opacity-60"
                    >
                      {adminActionLoading === 'minSuperStakeForReward' ? '保存中...' : '保存最小额'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-200 mb-3">Swap 资金池与兑换比例管理</div>

                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">池内 SUPER</div>
                    <div className="text-slate-100 mt-1">{swapStats ? formatTokenAmount(swapStats.reserveSuper) : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">池内 USDT</div>
                    <div className="text-slate-100 mt-1">{swapStats ? formatUsdtAmount(swapStats.reserveUsdt) : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">1 USDT 约等于</div>
                    <div className="text-slate-100 mt-1">{priceSuperPerUsdt > 0 ? `${priceSuperPerUsdt.toFixed(6)} SUPER` : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">1 SUPER 约等于</div>
                    <div className="text-slate-100 mt-1">{priceUsdtPerSuper > 0 ? `${priceUsdtPerSuper.toFixed(6)} USDT` : '--'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 col-span-2">
                    <div className="text-slate-400">手续费分配 (LP / 平台 / 生态)</div>
                    <div className="text-slate-100 mt-1">
                      {swapStats
                        ? `${swapStats.lpFeeShare.toString()}% / ${swapStats.platformFeeShare.toString()}% / ${swapStats.ecosystemFeeShare.toString()}%`
                        : '--'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    value={liquiditySuper}
                    onChange={(event) => setLiquiditySuper(event.target.value)}
                    inputMode="decimal"
                    placeholder="注入 SUPER"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <input
                    value={liquidityUsdt}
                    onChange={(event) => setLiquidityUsdt(event.target.value)}
                    inputMode="decimal"
                    placeholder="注入 USDT"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="flex flex-wrap gap-3 mb-3">
                  <button
                    onClick={handleManageLiquidity}
                    disabled={adminActionLoading === 'liquidity' || !swapRouterAddress || !superAddress}
                    className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950"
                  >
                    {adminActionLoading === 'liquidity'
                      ? '提交中...'
                      : swapStats && swapStats.reserveSuper === 0n && swapStats.reserveUsdt === 0n
                        ? '初始化资金池'
                        : '注入流动性（影响兑换比例）'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={handleCollectPlatformFee}
                    disabled={adminActionLoading === 'platformFee' || !swapRouterAddress}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700"
                  >
                    {adminActionLoading === 'platformFee' ? '提取中...' : '提取平台手续费'}
                  </button>
                  <div className="flex gap-2">
                    <input
                      value={ecosystemRecipient}
                      onChange={(event) => setEcosystemRecipient(event.target.value)}
                      placeholder="生态手续费接收地址"
                      className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                    />
                    <button
                      onClick={handleCollectEcosystemFee}
                      disabled={adminActionLoading === 'ecosystemFee' || !swapRouterAddress}
                      className="bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 rounded-lg text-sm font-medium border border-slate-700"
                    >
                      {adminActionLoading === 'ecosystemFee' ? '处理中...' : '提取生态费'}
                    </button>
                  </div>
                </div>

                {!swapRouterAddress && <div className="mt-3 text-xs text-amber-200">缺少 VITE_SWAP_ROUTER_ADDRESS，暂不可管理。</div>}
              </div>
            </div>
            )}

            {/* Device Funding */}
            {section === 'funding' && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 mb-6">
              <div className="text-sm font-semibold text-amber-200 mb-3">设备地址充值（Gas / SUPER）</div>
              <p className="text-xs text-amber-100/80 mb-3">
                向设备绑定的钱包地址转入原生 Gas（BNB）用于支付链上手续费，或直接转入 SUPER 代币。请从下方客户列表选择，或手动输入地址。
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-300">选择客户钱包</span>
                  <select
                    value={customers.some((c) => c.wallet.toLowerCase() === deviceFundingAddress.toLowerCase()) ? deviceFundingAddress : ''}
                    onChange={(event) => setDeviceFundingAddress(event.target.value)}
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  >
                    <option value="">-- 选择客户 --</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.wallet}>
                        {customer.nickname ? `${customer.nickname} · ` : ''}{customer.wallet}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-slate-300">设备绑定地址（可手动输入）</span>
                  <input
                    value={deviceFundingAddress}
                    onChange={(event) => setDeviceFundingAddress(event.target.value)}
                    placeholder="0x..."
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400 mb-2">转入 Gas（原生币 BNB）</div>
                  <div className="flex gap-2">
                    <input
                      value={deviceFundingGas}
                      onChange={(event) => setDeviceFundingGas(event.target.value)}
                      inputMode="decimal"
                      placeholder="例如 0.01"
                      className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleSendGasToDevice}
                      disabled={adminActionLoading === 'deviceGas' || !deviceFundingAddress}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950"
                    >
                      {adminActionLoading === 'deviceGas' ? '转账中...' : '转入 Gas'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">使用当前已连接管理员钱包发起原生币转账。</p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <div className="text-xs text-slate-400 mb-2">转入 SUPER 代币</div>
                  <div className="flex gap-2">
                    <input
                      value={deviceFundingSuper}
                      onChange={(event) => setDeviceFundingSuper(event.target.value)}
                      inputMode="decimal"
                      placeholder="例如 100"
                      className="h-10 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                    />
                    <button
                      onClick={handleSendSuperToDevice}
                      disabled={adminActionLoading === 'deviceSuper' || !deviceFundingAddress || !superAddress}
                      className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950"
                    >
                      {adminActionLoading === 'deviceSuper' ? '转账中...' : '转入 SUPER'}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    需要当前管理员钱包持有足够 SUPER 余额。{!superAddress && '（缺少 VITE_SUPER_ADDRESS）'}
                  </p>
                </div>
              </div>
            </div>
            )}

            {/* Records: 充值 / 提现 / 兑换 */}
            {section === 'records' && (
            <div className="space-y-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">交易记录</h3>
                  <p className="text-xs text-slate-400 mt-1">充值（Gas 购买）、提现（SUPER→USDT）、兑换（链上 Swap）</p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadRecords()}
                  disabled={recordsLoading}
                  className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-500/40 text-xs text-sky-200 hover:bg-sky-500/30 disabled:opacity-50"
                >
                  {recordsLoading ? '刷新中…' : '刷新'}
                </button>
              </div>


              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="text-sm font-semibold text-emerald-200 mb-2">客户资金归集申请（{collectionRecords.length}）</div>
                <p className="mb-3 text-xs text-emerald-100/80">
                  SubAdmin 可在客户列表勾选客户并提交归集申请；Owner 在这里批准、拒绝或完成 USDT / SUPER 打款到指定账户。
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <input
                    value={collectionTargetWallet}
                    onChange={(event) => setCollectionTargetWallet(event.target.value)}
                    placeholder="目标账户 0x..."
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <input
                    value={collectionNote}
                    onChange={(event) => setCollectionNote(event.target.value)}
                    placeholder="备注，可选"
                    className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCreateCollectionRequest()}
                    disabled={adminActionLoading === 'collection-create' || selectedCustomerIds.size === 0}
                    className="h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {adminActionLoading === 'collection-create' ? '创建中...' : `创建申请（${selectedCustomerIds.size} 客户）`}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">创建时间</th>
                        <th className="px-2 py-1.5">申请人</th>
                        <th className="px-2 py-1.5">范围</th>
                        <th className="px-2 py-1.5">目标账户</th>
                        <th className="px-2 py-1.5">USDT</th>
                        <th className="px-2 py-1.5">SUPER</th>
                        <th className="px-2 py-1.5">状态</th>
                        <th className="px-2 py-1.5">Tx</th>
                        <th className="px-2 py-1.5">操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {collectionRecords.length === 0 ? (
                        <tr><td colSpan={9} className="px-2 py-3 text-slate-500">暂无归集申请</td></tr>
                      ) : collectionRecords.map((record) => (
                        <tr key={record.id} className="border-t border-slate-700/50">
                          <td className="px-2 py-1.5 whitespace-nowrap">{record.createdAt}</td>
                          <td className="px-2 py-1.5 font-mono">{shortWallet(record.requesterWallet)} / {record.requesterRole}</td>
                          <td className="px-2 py-1.5">{record.sourceUserIds.length} 客户 / {record.sourceDeviceCount} 设备</td>
                          <td className="px-2 py-1.5 font-mono">{shortWallet(record.targetWallet)}</td>
                          <td className="px-2 py-1.5">{record.amountUsdt}</td>
                          <td className="px-2 py-1.5">{record.amountSuper}</td>
                          <td className="px-2 py-1.5">{record.status}</td>
                          <td className="px-2 py-1.5 font-mono">{record.txHash ? `${record.txHash.slice(0, 8)}...` : '-'}</td>
                          <td className="px-2 py-1.5">
                            {ownerSessionRole === 'owner' && record.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => void handleApproveCollectionRequest(record.id)}
                                  disabled={adminActionLoading === `collection-approve-${record.id}`}
                                  className="rounded border border-emerald-500/50 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                                >
                                  {adminActionLoading === `collection-approve-${record.id}` ? '...' : '批准'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleRejectCollectionRequest(record.id)}
                                  disabled={adminActionLoading === `collection-reject-${record.id}`}
                                  className="rounded border border-rose-500/50 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
                                >
                                  {adminActionLoading === `collection-reject-${record.id}` ? '...' : '拒绝'}
                                </button>
                              </div>
                            )}
                            {ownerSessionRole === 'owner' && record.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => void handleCompleteCollectionRequest(record)}
                                disabled={adminActionLoading === `collection-complete-${record.id}`}
                                className="rounded border border-sky-500/50 px-2 py-1 text-[11px] text-sky-200 hover:bg-sky-500/10 disabled:opacity-50"
                              >
                                {adminActionLoading === `collection-complete-${record.id}` ? '...' : '完成'}
                              </button>
                            )}
                            {!(ownerSessionRole === 'owner' && (record.status === 'pending' || record.status === 'approved')) && (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recharge */}
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <div className="text-sm font-semibold text-indigo-200 mb-3">充值记录 · Gas 订单（{rechargeRecords.length}）</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">创建时间</th>
                        <th className="px-2 py-1.5">钱包</th>
                        <th className="px-2 py-1.5">支付代币</th>
                        <th className="px-2 py-1.5">支付金额</th>
                        <th className="px-2 py-1.5">获得 BNB</th>
                        <th className="px-2 py-1.5">状态</th>
                        <th className="px-2 py-1.5">Tx</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {rechargeRecords.length === 0 ? (
                        <tr><td colSpan={7} className="px-2 py-3 text-slate-500">暂无记录</td></tr>
                      ) : rechargeRecords.map((r) => (
                        <tr key={r.id} className="border-t border-slate-700/50">
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.createdAt}</td>
                          <td className="px-2 py-1.5 font-mono">{r.wallet.slice(0,6)}…{r.wallet.slice(-4)}</td>
                          <td className="px-2 py-1.5">{r.payToken}</td>
                          <td className="px-2 py-1.5">{r.payAmount}</td>
                          <td className="px-2 py-1.5">{r.bnbAmount}</td>
                          <td className="px-2 py-1.5">{r.status}</td>
                          <td className="px-2 py-1.5 font-mono">{r.relayTxHash ? `${r.relayTxHash.slice(0,8)}…` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Withdrawal */}
              <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
                <div className="text-sm font-semibold text-rose-200 mb-3">提现记录 · SUPER→USDT / Claim（{withdrawalRecords.length}）</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">创建时间</th>
                        <th className="px-2 py-1.5">类型</th>
                        <th className="px-2 py-1.5">钱包</th>
                        <th className="px-2 py-1.5">SUPER</th>
                        <th className="px-2 py-1.5">USDT</th>
                        <th className="px-2 py-1.5">状态</th>
                        <th className="px-2 py-1.5">收款地址</th>
                        <th className="px-2 py-1.5">Tx</th>
                        <th className="px-2 py-1.5">审核操作</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {withdrawalRecords.length === 0 ? (
                        <tr><td colSpan={9} className="px-2 py-3 text-slate-500">暂无记录</td></tr>
                      ) : withdrawalRecords.map((r) => {
                        const canApprove = r.source === 'exchange' && (r.status === 'manual_pending' || r.status === 'auto_processing');
                        const canComplete = r.source === 'exchange' && (r.status === 'approved' || r.status === 'auto_processing');
                        return (
                        <tr key={`${r.source}-${r.id}`} className="border-t border-slate-700/50">
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.createdAt}</td>
                          <td className="px-2 py-1.5">{r.source === 'exchange' ? '兑换提现' : '奖励提现'}</td>
                          <td className="px-2 py-1.5 font-mono">{r.wallet ? `${r.wallet.slice(0,6)}…${r.wallet.slice(-4)}` : '-'}</td>
                          <td className="px-2 py-1.5">{r.amountSuper}</td>
                          <td className="px-2 py-1.5">{r.amountUsdt}</td>
                          <td className="px-2 py-1.5">{r.status}</td>
                          <td className="px-2 py-1.5 font-mono">{r.payoutWallet ? `${r.payoutWallet.slice(0,6)}…${r.payoutWallet.slice(-4)}` : '-'}</td>
                          <td className="px-2 py-1.5 font-mono">{r.txHash ? `${r.txHash.slice(0,8)}…` : '-'}</td>
                          <td className="px-2 py-1.5 space-x-1 whitespace-nowrap">
                            {canApprove && (
                              <button
                                type="button"
                                onClick={() => handleApproveExchange(r.id)}
                                disabled={adminActionLoading === `approve-${r.id}`}
                                className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
                              >
                                {adminActionLoading === `approve-${r.id}` ? '…' : '批准'}
                              </button>
                            )}
                            {canComplete && (
                              <button
                                type="button"
                                onClick={() => handleCompleteExchange(r.id, r.payoutWallet, r.amountUsdt)}
                                disabled={adminActionLoading === `complete-${r.id}`}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/30 disabled:opacity-50"
                              >
                                {adminActionLoading === `complete-${r.id}` ? '…' : '完成'}
                              </button>
                            )}
                            {!canApprove && !canComplete && <span className="text-slate-500">-</span>}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Exchange */}
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="text-sm font-semibold text-cyan-200 mb-3">兑换记录 · 链上 Swap（{exchangeRecords.length}）</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="px-2 py-1.5">创建时间</th>
                        <th className="px-2 py-1.5">钱包</th>
                        <th className="px-2 py-1.5">方向</th>
                        <th className="px-2 py-1.5">输入</th>
                        <th className="px-2 py-1.5">输出</th>
                        <th className="px-2 py-1.5">价格</th>
                        <th className="px-2 py-1.5">状态</th>
                        <th className="px-2 py-1.5">Tx</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {exchangeRecords.length === 0 ? (
                        <tr><td colSpan={8} className="px-2 py-3 text-slate-500">暂无记录</td></tr>
                      ) : exchangeRecords.map((r) => (
                        <tr key={r.id} className="border-t border-slate-700/50">
                          <td className="px-2 py-1.5 whitespace-nowrap">{r.createdAt}</td>
                          <td className="px-2 py-1.5 font-mono">{r.wallet ? `${r.wallet.slice(0,6)}…${r.wallet.slice(-4)}` : '-'}</td>
                          <td className="px-2 py-1.5">{r.direction}</td>
                          <td className="px-2 py-1.5">{r.amountIn}</td>
                          <td className="px-2 py-1.5">{r.amountOut}</td>
                          <td className="px-2 py-1.5">{r.priceSnapshot}</td>
                          <td className="px-2 py-1.5">{r.status}</td>
                          <td className="px-2 py-1.5 font-mono">{r.txHash ? `${r.txHash.slice(0,8)}…` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

            {/* Support Contacts */}
            {section === 'system' && (
            <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-pink-200">客服联系方式（App 展示）</div>
                <button
                  onClick={handleAddSupportContact}
                  className="bg-pink-500 hover:bg-pink-400 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-950"
                >
                  + 添加联系方式
                </button>
              </div>
              <p className="text-xs text-pink-100/80 mb-3">
                配置微信、Telegram、邮箱等联系方式，保存后将在用户端 App 中展示给客户作为客服入口。
              </p>

              {supportContacts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-center text-xs text-slate-400">
                  暂未配置联系方式，点击上方「+ 添加联系方式」开始配置。
                </div>
              ) : (
                <div className="space-y-3">
                  {supportContacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3"
                    >
                      <select
                        value={contact.type}
                        onChange={(event) => handleUpdateSupportContact(contact.id, 'type', event.target.value)}
                        className="md:col-span-2 h-10 rounded-lg border border-slate-700 bg-slate-900 px-2 text-sm text-slate-100 outline-none focus:border-pink-400"
                      >
                        {CONTACT_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <input
                        value={contact.label}
                        onChange={(event) => handleUpdateSupportContact(contact.id, 'label', event.target.value)}
                        placeholder="显示标签（如 官方微信）"
                        className="md:col-span-3 h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-pink-400"
                      />
                      <input
                        value={contact.value}
                        onChange={(event) => handleUpdateSupportContact(contact.id, 'value', event.target.value)}
                        placeholder="联系方式内容（账号 / 邮箱 / 链接）"
                        className="md:col-span-4 h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-pink-400"
                      />
                      <input
                        value={contact.note}
                        onChange={(event) => handleUpdateSupportContact(contact.id, 'note', event.target.value)}
                        placeholder="备注（可选）"
                        className="md:col-span-2 h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-pink-400"
                      />
                      <button
                        onClick={() => handleRemoveSupportContact(contact.id)}
                        className="md:col-span-1 h-10 rounded-lg bg-slate-800 hover:bg-red-500/80 border border-slate-700 text-xs text-slate-200"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleSaveSupportContacts}
                  disabled={adminActionLoading === 'supportContacts'}
                  className="bg-pink-500 hover:bg-pink-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950"
                >
                  {adminActionLoading === 'supportContacts' ? '保存中...' : '保存联系方式'}
                </button>
              </div>
            </div>
            )}

            {/* Table */}
            {section === 'onchain' && (
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">钱包地址</th>
                    <th className="px-4 py-3 font-medium">注册状态</th>
                    <th className="px-4 py-3 font-medium">当前算力</th>
                    <th className="px-4 py-3 font-medium">待领取 SUPER</th>
                    <th className="px-4 py-3 font-medium">累计领取 SUPER</th>
                    <th className="px-4 py-3 font-medium">风险分</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-300 break-all">{adminWallet}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${minerStatusClass}`}>
                        {minerInfo?.registered && minerInfo.active ? <CheckCircle2 size={12} /> : <Activity size={12} />}
                        {minerStatusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {minerInfo ? formatHashrate(minerInfo.hashrate) : '--'}
                    </td>
                    <td className="px-4 py-3 text-cyan-300">
                      {minerInfo ? formatTokenAmount(minerInfo.pendingReward) : '--'}
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {minerInfo ? formatTokenAmount(minerInfo.totalClaimed) : '--'}
                    </td>
                    <td className="px-4 py-3 text-amber-300">
                      {minerInfo ? minerInfo.suspiciousScore.toString() : '--'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            )}

            {loading && section === 'onchain' && (
              <div className="mt-4 text-xs text-slate-500">正在同步链上数据...</div>
            )}

        {/* ────────────────────────── 使用手册 / Admin Docs ────────────────────────── */}
        {section === 'docs' && (
          <motion.div
            key="docs"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* 业务功能概览 */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
                {locale === 'zh' ? '业务功能概览' : 'Business Feature Overview'}
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                {locale === 'zh'
                  ? 'Coin Planet 是一套「挖矿+代币+Swap」一体化运营平台，核心链路如下：'
                  : 'Coin Planet is an integrated mining + token + swap operating platform. The core flow is:'}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    icon: '📱',
                    title: locale === 'zh' ? '用户侧 APP' : 'User App',
                    items: locale === 'zh'
                      ? ['用户在 APP 完成实名 / 钱包绑定', '注册矿机并提交链上 hashrate', '按在线时长自动累计 USDT/SUPER 收益', '每日可领取（Claim）或兑换（Swap）']
                      : ['User completes KYC / wallet binding in app', 'Registers miner & submits on-chain hashrate', 'Earnings accrue by online duration (USDT/SUPER)', 'Daily claim or swap rewards'],
                  },
                  {
                    icon: '⛓️',
                    title: locale === 'zh' ? '链上合约' : 'Smart Contracts',
                    items: locale === 'zh'
                      ? ['MiningPool：矿机注册 / 收益分发 / 领取', 'SUPER ERC-20：收益代币增发与授权', 'SwapRouter：USDT ↔ SUPER 内盘兑换', '链上数据所有人为 owner 钱包控制']
                      : ['MiningPool: registration / reward distribution / claim', 'SUPER ERC-20: mint & approve', 'SwapRouter: USDT ↔ SUPER swap', 'Owner wallet controls all on-chain data'],
                  },
                  {
                    icon: '🖥️',
                    title: locale === 'zh' ? '后台管理' : 'Admin Backend',
                    items: locale === 'zh'
                      ? ['激活 / 续期 / 批量修改客户合同', '系统维护模式 / 参数配置', '公告发布与客服联系方式管理', '充值 / 提现 / 兑换记录审查']
                      : ['Activate / extend / bulk-modify customer contracts', 'Maintenance mode & parameter config', 'Announcements & support contact management', 'Review recharge / withdrawal / exchange records'],
                  },
                ].map((card) => (
                  <div key={card.title} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700">
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <div className="text-sm font-semibold text-white mb-2">{card.title}</div>
                    <ul className="space-y-1">
                      {card.items.map((item) => (
                        <li key={item} className="text-xs text-slate-300 flex gap-1.5">
                          <span className="text-purple-400 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            {/* 各导航功能说明 */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-cyan-400" />
                {locale === 'zh' ? '导航功能说明' : 'Navigation Sections'}
              </h3>
              <div className="space-y-3">
                {(locale === 'zh' ? [
                  { section: '概览', icon: '📊', desc: '展示链上 KPI（矿工数、算力、已发 SUPER）和当前钱包矿工状态。数据来自链上合约，每 15 秒自动刷新。' },
                  { section: 'Owner 控制台', icon: '🔑', desc: '包含链上安全操作：转账、费率调整、出款审核等，均需 owner 钱包签名。' },
                  { section: '链上数据', icon: '⛓️', desc: '链上全局数据与当前 owner 矿工的注册/算力/待领取收益明细。' },
                  { section: '代币 & Swap', icon: '🪙', desc: 'SUPER 代币增发（mint），Swap 资金池初始化与流动性管理，平台手续费 / 生态费收取。' },
                  { section: '设备充值', icon: '⛽', desc: '向指定用户钱包转入测试 Gas（BNB）或 SUPER 代币，用于用户 Gas 费补贴。' },
                  { section: '客户列表', icon: '👥', desc: '查看所有用户合同状态、收益率和在线情况；支持激活、续期、批量修改收益率。' },
                  { section: '交易记录', icon: '📋', desc: '查看充值（Gas 购买）、提现（SUPER→USDT）、兑换记录；支持批准和完成操作。' },
                  { section: '系统设置', icon: '⚙️', desc: '维护模式开关、系统参数、用户协议、公告管理、客服联系方式配置。' },
                  { section: '使用手册', icon: '📖', desc: '即本页，包含参数配置说明、操作手册和业务功能说明，仅管理员可见。' },
                ] : [
                  { section: 'Overview', icon: '📊', desc: 'On-chain KPIs (miner count, hashrate, SUPER emitted) and current owner miner status. Auto-refreshes every 15s.' },
                  { section: 'Owner Console', icon: '🔑', desc: 'Secure on-chain operations: transfers, fee adjustments, payout review — all require owner wallet signature.' },
                  { section: 'On-chain', icon: '⛓️', desc: 'Global on-chain stats and current owner miner registration / hashrate / pending reward.' },
                  { section: 'Tokens & Swap', icon: '🪙', desc: 'SUPER mint, swap pool initialization & liquidity management, platform and ecosystem fee collection.' },
                  { section: 'Device Funding', icon: '⛽', desc: 'Transfer test gas (BNB) or SUPER tokens to specified user wallets as gas subsidies.' },
                  { section: 'Customers', icon: '👥', desc: 'View all user contract status, yield rates and online status; support activation, extension, bulk rate changes.' },
                  { section: 'Transactions', icon: '📋', desc: 'View recharge (gas purchase), withdrawal (SUPER→USDT) and exchange records; support approve and complete.' },
                  { section: 'System', icon: '⚙️', desc: 'Maintenance toggle, system parameters, user agreement, announcements, and support contact config.' },
                  { section: 'Admin Docs', icon: '📖', desc: 'This page. Contains parameter config guide, operation manual, and business overview. Admin-only.' },
                ]).map((row) => (
                  <div key={row.section} className="flex gap-3 py-2 border-b border-slate-800 last:border-0">
                    <span className="text-lg w-7 shrink-0">{row.icon}</span>
                    <div>
                      <span className="text-sm font-semibold text-white mr-2">{row.section}</span>
                      <span className="text-xs text-slate-400">{row.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 参数配置说明 */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
                {locale === 'zh' ? '参数配置说明' : 'Parameter Configuration Guide'}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 pr-4 text-slate-400 font-medium w-48">
                        {locale === 'zh' ? '参数名' : 'Parameter'}
                      </th>
                      <th className="text-left py-2 pr-4 text-slate-400 font-medium w-28">
                        {locale === 'zh' ? '默认值' : 'Default'}
                      </th>
                      <th className="text-left py-2 text-slate-400 font-medium">
                        {locale === 'zh' ? '说明' : 'Description'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {(locale === 'zh' ? [
                      { name: 'rewardRateUsdtPerHour', default: '0.084', desc: '每台设备每小时的基础 USDT 收益率。调整此值会立即影响新结算周期的收益。' },
                      { name: 'monthlyCardDays', default: '30', desc: '月卡对应的合同有效天数，客服激活时以此为基准延长合同期限。' },
                      { name: 'contractTermDaysDefault', default: '1095', desc: '新用户激活时默认的合同期限（天），1095 ≈ 3 年。' },
                      { name: 'maintenanceEnabled', default: 'false', desc: '维护模式开关，开启后 APP 用户会看到维护提示，所有业务操作暂停。' },
                      { name: 'maintenanceMessageZh/En', default: '系统维护中', desc: '维护模式下展示给用户的中英文提示语。' },
                      { name: 'exchangeAutoEnabled', default: 'true', desc: '自动兑换开关（预留），当前控制 APP 内 Swap 功能是否对用户可见。' },
                      { name: 'payoutWallets', default: '[]', desc: '出款钱包列表，用于 SUPER→USDT 提现的目标钱包，priority 越小优先级越高。' },
                      { name: 'userAgreementRequired', default: 'false', desc: '用户协议强制阅读开关，开启后新用户首次进入 APP 必须同意协议。' },
                      { name: 'userAgreementVersion', default: '1.0.0', desc: '协议版本号，更新版本号后所有用户会被要求重新阅读并同意。' },
                      { name: 'supportContacts', default: '[]', desc: '客服联系方式列表，APP 个人中心页展示，每条包含类型、标签、内容和备注。' },
                    ] : [
                      { name: 'rewardRateUsdtPerHour', default: '0.084', desc: 'Base USDT reward rate per device per hour. Changes take effect in the next settlement cycle.' },
                      { name: 'monthlyCardDays', default: '30', desc: 'Contract days per monthly card activation. Used as the base extension when support activates a user.' },
                      { name: 'contractTermDaysDefault', default: '1095', desc: 'Default contract duration in days for new users (1095 ≈ 3 years).' },
                      { name: 'maintenanceEnabled', default: 'false', desc: 'Maintenance mode toggle. When on, app users see a maintenance notice and all operations are paused.' },
                      { name: 'maintenanceMessageZh/En', default: 'System maintenance', desc: 'Localized maintenance message shown to users in Chinese and English.' },
                      { name: 'exchangeAutoEnabled', default: 'true', desc: 'Auto-exchange toggle (reserved). Controls whether the Swap feature is visible to users in the app.' },
                      { name: 'payoutWallets', default: '[]', desc: 'Payout wallet list for SUPER→USDT withdrawals. Lower priority number = higher priority.' },
                      { name: 'userAgreementRequired', default: 'false', desc: 'Mandatory user agreement toggle. When enabled, new users must accept the agreement on first launch.' },
                      { name: 'userAgreementVersion', default: '1.0.0', desc: 'Agreement version. Bumping the version will require all users to re-read and re-accept.' },
                      { name: 'supportContacts', default: '[]', desc: 'Support contact list shown in the app profile page. Each entry has type, label, value, and note.' },
                    ]).map((row) => (
                      <tr key={row.name} className="hover:bg-slate-800/30">
                        <td className="py-2.5 pr-4 font-mono text-xs text-cyan-300 align-top">{row.name}</td>
                        <td className="py-2.5 pr-4 text-xs text-amber-300 align-top">{row.default}</td>
                        <td className="py-2.5 text-xs text-slate-300">{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 操作手册 */}
            <div className="bg-slate-900/60 rounded-2xl border border-slate-700 p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                {locale === 'zh' ? '操作手册' : 'Operation Manual'}
              </h3>
              <div className="space-y-5">
                {(locale === 'zh' ? [
                  {
                    title: '🆕 激活新用户',
                    steps: [
                      '在「客户列表」找到目标用户（按钱包地址或 ID 搜索）',
                      '点击「激活」，填入设备标识（可选）和合同年限',
                      '确认后系统自动设置 contract_start_at / contract_end_at，并将 activation_status 改为 active',
                      '激活成功后用户 APP 将显示正常收益状态',
                    ],
                  },
                  {
                    title: '🔄 续期合同',
                    steps: [
                      '在「客户列表」找到目标用户',
                      '填写「续期天数」输入框（默认 30 天）',
                      '点击行末「续期」按钮，系统在现有 contract_end_at 基础上累加天数',
                      '若合同已过期，续期将从当前时间开始计算',
                    ],
                  },
                  {
                    title: '📢 发布公告',
                    steps: [
                      '进入「系统设置」→「公告管理」',
                      '填写中英文标题和正文，选择级别（info/warning/critical）和推送对象（全员/有效合同）',
                      '勾选「立即发布」或设置定时发布时间',
                      '保存后 APP 用户首页将收到公告推送',
                    ],
                  },
                  {
                    title: '💰 修改收益率',
                    steps: [
                      '单个修改：「客户列表」找到目标用户，暂无单独入口，请用批量功能选中一人操作',
                      '批量修改：在「客户列表」勾选多个用户 → 填写「批量收益率」→ 点击「应用」',
                      '修改后下一个结算周期自动生效',
                      '全局默认收益率在「系统设置」→「每小时 USDT 收益率」修改',
                    ],
                  },
                  {
                    title: '🔧 开启/关闭维护模式',
                    steps: [
                      '进入「系统设置」→「维护模式」区块',
                      '编辑中英文维护提示语后点击「开启维护」',
                      '维护模式下 APP 所有操作暂停，用户看到维护提示',
                      '完成维护后点击「关闭维护」恢复正常',
                    ],
                  },
                  {
                    title: '🪙 提现/兑换审批',
                    steps: [
                      '进入「交易记录」→「提现记录」或「兑换记录」',
                      '状态为 pending 的记录可点击「批准」进入审批流程',
                      '确认链上打款后点击「完成」，填写实际收款钱包和 tx hash',
                      '完成后记录状态更新为 done',
                    ],
                  },
                ] : [
                  {
                    title: '🆕 Activate a New User',
                    steps: [
                      'Find the target user in "Customers" (search by wallet or ID)',
                      'Click "Activate", enter device id (optional) and contract term in years',
                      'System sets contract_start_at / contract_end_at and changes activation_status to active',
                      "After activation the user's app will show normal reward status",
                    ],
                  },
                  {
                    title: '🔄 Extend a Contract',
                    steps: [
                      'Find the target user in "Customers"',
                      'Fill the "Extend" days input (default 30)',
                      'Click the "Extend" button at the end of the row — days are added to existing contract_end_at',
                      'If the contract has already expired, extension starts from the current time',
                    ],
                  },
                  {
                    title: '📢 Publish an Announcement',
                    steps: [
                      'Go to "System" → "Announcement Management"',
                      'Fill in Chinese and English title/content, select level and audience',
                      'Check "Publish Immediately" or set a scheduled publish time',
                      'After saving, users will see the announcement on the app home page',
                    ],
                  },
                  {
                    title: '💰 Change Reward Rate',
                    steps: [
                      'Single change: use the bulk feature in "Customers" with only one user selected',
                      'Bulk change: check multiple users → fill "Bulk Rate" → click "Apply"',
                      'The new rate takes effect in the next settlement cycle',
                      'Global default rate: change "Reward Rate per Hour" in "System" settings',
                    ],
                  },
                  {
                    title: '🔧 Toggle Maintenance Mode',
                    steps: [
                      'Go to "System" → "Maintenance Mode" block',
                      'Edit Chinese and English messages, then click "Enable Maintenance"',
                      'All app operations are paused and users see the maintenance notice',
                      'Click "Disable Maintenance" to restore normal operation',
                    ],
                  },
                  {
                    title: '🪙 Approve Withdrawal / Exchange',
                    steps: [
                      'Go to "Transactions" → "Withdrawal" or "Exchange" records',
                      'Records with status "pending" can be clicked to "Approve"',
                      'After confirming on-chain transfer, click "Complete" and enter payout wallet and tx hash',
                      'Status updates to "done" after completion',
                    ],
                  },
                ]).map((item) => (
                  <div key={item.title} className="border border-slate-700 rounded-xl p-4">
                    <div className="text-sm font-semibold text-white mb-2">{item.title}</div>
                    <ol className="space-y-1 list-decimal list-inside">
                      {item.steps.map((step, idx) => (
                        <li key={idx} className="text-xs text-slate-300">{step}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>

            {/* 安全提示 */}
            <div className="bg-amber-900/20 rounded-2xl border border-amber-700/40 p-5">
              <h3 className="text-sm font-bold text-amber-300 mb-2 flex items-center gap-2">
                <span>⚠️</span>
                {locale === 'zh' ? '安全注意事项' : 'Security Notice'}
              </h3>
              <ul className="space-y-1.5">
                {(locale === 'zh' ? [
                  '本后台仅 owner 钱包（链上合约部署者）可访问，请勿将 owner 私钥托管给第三方。',
                  '所有敏感操作均需链上钱包签名验证，签名消息包含 nonce 防重放。',
                  '批量修改收益率为不可逆操作，请在确认数量和数值后再提交。',
                  '维护模式会立即影响所有在线用户，请提前发布公告并在低峰期操作。',
                  '私钥 / 助记词请勿以任何形式出现在本系统中，链上操作通过浏览器钱包签名完成。',
                ] : [
                  'This admin panel is only accessible by the owner wallet (the contract deployer). Never entrust your private key to third parties.',
                  'All sensitive operations require on-chain wallet signature. Messages include a nonce to prevent replay attacks.',
                  'Bulk rate changes are irreversible — double-check the count and value before submitting.',
                  'Enabling maintenance mode immediately affects all online users. Post an announcement and operate during off-peak hours.',
                  'Never input private keys or seed phrases into this system. All on-chain actions go through browser wallet signing.',
                ]).map((item) => (
                  <li key={item} className="text-xs text-amber-200/80 flex gap-2">
                    <span className="text-amber-400 shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

