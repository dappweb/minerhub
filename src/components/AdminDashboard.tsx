import { Activity, CheckCircle2, Database, LayoutDashboard, ShieldAlert, Smartphone, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatUnits, isAddress } from 'viem';
import {
    addSwapLiquidityOnChain,
    collectEcosystemFeeOnChain,
    collectPlatformFeeOnChain,
    getGlobalStatsOnChain,
    getMinerInfoOnChain,
    getMiningPoolAddress,
    getSuperTokenAddress,
    getSuperTokenStatsOnChain,
    getSwapPoolStatsOnChain,
    getSwapRouterAddress,
    initializeSwapLiquidityOnChain,
    mintSuperOnChain,
    startMiningOnChain,
    type MiningPoolGlobalStats,
    type MiningPoolMinerInfo,
    type SuperTokenStats,
    type SwapPoolStats,
} from '../lib/blockchain';

type AdminDashboardProps = {
  fullScreen?: boolean;
  adminWallet: string;
  signMessageAsync: (walletAddress: string, message: string) => Promise<string>;
};

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
};

type CustomerItem = {
  id: string;
  wallet: string;
  email: string | null;
  role: string | null;
  status: string | null;
  nickname: string | null;
  machineCode: string | null;
  contractStartAt: string | null;
  contractEndAt: string | null;
  contractActive: number;
  activationStatus: string;
  exchangeAutoEnabled: number;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  lastSeenAt: string | null;
  onlineStatus: string;
  deviceCount: number;
  activeDeviceCount: number;
  subAccountCount: number;
};

export default function AdminDashboard({ fullScreen = false, adminWallet, signMessageAsync }: AdminDashboardProps) {
  const [globalStats, setGlobalStats] = useState<MiningPoolGlobalStats | null>(null);
  const [minerInfo, setMinerInfo] = useState<MiningPoolMinerInfo | null>(null);
  const [superStats, setSuperStats] = useState<SuperTokenStats | null>(null);
  const [swapStats, setSwapStats] = useState<SwapPoolStats | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
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
  const [liquiditySuper, setLiquiditySuper] = useState<string>('1000');
  const [liquidityUsdt, setLiquidityUsdt] = useState<string>('1');
  const [ecosystemRecipient, setEcosystemRecipient] = useState<string>(adminWallet);
  const [maintenanceMessageZh, setMaintenanceMessageZh] = useState<string>('系统维护中，请稍后再试。');
  const [maintenanceMessageEn, setMaintenanceMessageEn] = useState<string>('System maintenance in progress. Please try again later.');
  const [monthlyCardDays, setMonthlyCardDays] = useState<string>('30');
  const [contractTermDays, setContractTermDays] = useState<string>('1095');
  const [rewardRatePerHour, setRewardRatePerHour] = useState<string>('0.084');
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://coin-planet-api.dappweb.workers.dev';

  const poolAddress = getMiningPoolAddress();
  const superAddress = getSuperTokenAddress();
  const swapRouterAddress = getSwapRouterAddress();

  const buildSignedHeaders = useCallback(async (path: string, body: Record<string, unknown>) => {
    const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const message = `coinplanet|${nonce}|${path}|${JSON.stringify(body)}`;
    const signature = await signMessageAsync(adminWallet, message);

    return {
      'content-type': 'application/json',
      'x-wallet': adminWallet,
      'x-nonce': nonce,
      'x-signature': signature,
    };
  }, [adminWallet, signMessageAsync]);

  const signedRequest = useCallback(async <T,>(path: string, method: string, body: Record<string, unknown> = {}): Promise<T> => {
    const headers = await buildSignedHeaders(path, body);
    const requestInit: RequestInit = {
      method,
      headers,
    };

    if (method !== 'GET' && method !== 'HEAD') {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(`${apiBaseUrl}${path}`, requestInit);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  }, [apiBaseUrl, buildSignedHeaders]);

  const loadBackendData = useCallback(async () => {
    if (!adminWallet) return;
    try {
      setBackendError('');
      setBackendLoading(true);

      const [statusResponse, customersResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/system/status`).then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as SystemStatus;
        }).catch(() => null),
        signedRequest<{ items: CustomerItem[] }>('/api/admin/customers', 'GET', {}),
      ]);

      setSystemStatus(statusResponse);
      setCustomers(customersResponse.items ?? []);
    } catch (loadError) {
      setBackendError(loadError instanceof Error ? loadError.message : '读取后台数据失败');
    } finally {
      setBackendLoading(false);
    }
  }, [adminWallet, apiBaseUrl, signedRequest]);

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

      const [superToken, swapPool] = await Promise.all([
        superAddress ? getSuperTokenStatsOnChain().catch(() => null) : Promise.resolve(null),
        swapRouterAddress ? getSwapPoolStatsOnChain().catch(() => null) : Promise.resolve(null),
      ]);

      setGlobalStats(global);
      setMinerInfo(miner);
      setSuperStats(superToken);
      setSwapStats(swapPool);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '读取链上数据失败';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [adminWallet, poolAddress, superAddress, swapRouterAddress]);

  useEffect(() => {
    setMintRecipient(adminWallet);
    setEcosystemRecipient(adminWallet);
  }, [adminWallet]);

  useEffect(() => {
    if (!systemStatus) return;
    setMaintenanceMessageZh(systemStatus.maintenanceMessageZh);
    setMaintenanceMessageEn(systemStatus.maintenanceMessageEn);
    setMonthlyCardDays(systemStatus.monthlyCardDays.toString());
    setContractTermDays(systemStatus.contractTermDaysDefault.toString());
    setRewardRatePerHour(systemStatus.rewardRateUsdtPerHour.toString());
  }, [systemStatus]);

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
    void loadBackendData();
    const timer = window.setInterval(() => {
      void loadBackendData();
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadBackendData]);

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

  const saveSystemSettings = async (payload: Record<string, unknown>) => {
    setAdminActionLoading('systemSettings');
    setBackendError('');
    try {
      await signedRequest<{ ok: boolean }>('/api/system/settings', 'PUT', payload);
      await loadBackendData();
    } catch (saveError) {
      setBackendError(saveError instanceof Error ? saveError.message : '保存系统设置失败');
    } finally {
      setAdminActionLoading('');
    }
  };

  const handleToggleMaintenance = async () => {
    await saveSystemSettings({
      maintenanceEnabled: !systemStatus?.maintenanceEnabled,
      maintenanceMessageZh,
      maintenanceMessageEn,
      monthlyCardDays: Number(monthlyCardDays),
      contractTermDaysDefault: Number(contractTermDays),
      rewardRateUsdtPerHour: Number(rewardRatePerHour),
      exchangeAutoEnabled: systemStatus?.exchangeAutoEnabled ?? true,
      payoutWallets: systemStatus?.payoutWallets ?? [],
    });
  };

  const handleToggleExchange = async () => {
    await saveSystemSettings({
      maintenanceEnabled: systemStatus?.maintenanceEnabled ?? false,
      maintenanceMessageZh,
      maintenanceMessageEn,
      monthlyCardDays: Number(monthlyCardDays),
      contractTermDaysDefault: Number(contractTermDays),
      rewardRateUsdtPerHour: Number(rewardRatePerHour),
      exchangeAutoEnabled: !(systemStatus?.exchangeAutoEnabled ?? true),
      payoutWallets: systemStatus?.payoutWallets ?? [],
    });
  };

  const handleSaveSystemParameters = async () => {
    await saveSystemSettings({
      maintenanceEnabled: systemStatus?.maintenanceEnabled ?? false,
      maintenanceMessageZh,
      maintenanceMessageEn,
      monthlyCardDays: Number(monthlyCardDays),
      contractTermDaysDefault: Number(contractTermDays),
      rewardRateUsdtPerHour: Number(rewardRatePerHour),
      exchangeAutoEnabled: systemStatus?.exchangeAutoEnabled ?? true,
      payoutWallets: systemStatus?.payoutWallets ?? [],
    });
  };

  const priceSuperPerUsdt = swapStats ? Number(formatUnits(swapStats.priceSuperPerUsdt, 18)) : 0;
  const priceUsdtPerSuper = priceSuperPerUsdt > 0 ? 1 / priceSuperPerUsdt : 0;

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
              ? 'bg-slate-950 rounded-none md:rounded-none border-y md:border border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row min-h-screen'
              : 'bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row'
          }
        >
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-slate-900/50 border-r border-slate-800 p-6 hidden md:block">
            <div className="flex items-center gap-2 mb-10 text-white">
              <LayoutDashboard className="text-purple-400" />
              <span className="font-bold text-lg">Coin Planet Admin</span>
            </div>
            <nav className="space-y-2">
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">
                <Smartphone size={18} /> 设备管理
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Users size={18} /> 用户账户
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Activity size={18} /> 全网算力
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Database size={18} /> 资金池监控
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <ShieldAlert size={18} /> 风控中心
              </a>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 md:p-8">
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {stats.map((stat, i) => (
                <div key={i} className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                  <div className="text-slate-400 text-sm mb-2">{stat.label}</div>
                  <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.trend}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
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

            {error && (
              <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            )}

            {poolAddress && (
              <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 text-xs text-slate-400 break-all">
                合约地址: {poolAddress}
              </div>
            )}

            {(backendError || backendLoading) && (
              <div className={`mb-6 rounded-xl px-4 py-3 text-sm ${backendError ? 'border border-amber-500/30 bg-amber-500/10 text-amber-100' : 'border border-slate-800 bg-slate-900/50 text-slate-400'}`}>
                {backendError || (backendLoading ? '正在同步后台系统数据...' : '后台系统数据已更新')}
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4">
                <div className="text-sm font-semibold text-cyan-200 mb-3">系统维护与收益设置</div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">维护状态</div>
                    <div className="text-slate-100 mt-1">{systemStatus?.maintenanceEnabled ? '开启' : '关闭'}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">自动兑换</div>
                    <div className="text-slate-100 mt-1">{systemStatus?.exchangeAutoEnabled ? '开启' : '关闭'}</div>
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
                  <input value={maintenanceMessageZh} onChange={(event) => setMaintenanceMessageZh(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="维护文案（中文）" />
                  <input value={maintenanceMessageEn} onChange={(event) => setMaintenanceMessageEn(event.target.value)} className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="Maintenance message (EN)" />
                  <input value={monthlyCardDays} onChange={(event) => setMonthlyCardDays(event.target.value)} inputMode="numeric" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="月卡天数" />
                  <input value={contractTermDays} onChange={(event) => setContractTermDays(event.target.value)} inputMode="numeric" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="合同默认天数" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input value={rewardRatePerHour} onChange={(event) => setRewardRatePerHour(event.target.value)} inputMode="decimal" className="h-10 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none focus:border-cyan-400" placeholder="每小时收益 USDT" />
                  <div className="flex gap-2">
                    <button onClick={handleToggleMaintenance} disabled={adminActionLoading === 'systemSettings'} className="flex-1 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium text-slate-950">
                      {adminActionLoading === 'systemSettings' ? '保存中...' : '切换维护'}
                    </button>
                    <button onClick={handleToggleExchange} disabled={adminActionLoading === 'systemSettings'} className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700">
                      切换自动兑换
                    </button>
                  </div>
                </div>
                <button onClick={handleSaveSystemParameters} disabled={adminActionLoading === 'systemSettings'} className="mt-3 w-full bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700">
                  保存系统参数
                </button>
              </div>

              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                <div className="text-sm font-semibold text-purple-200 mb-3">客户概览</div>
                <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">客户总数</div>
                    <div className="text-slate-100 mt-1">{customers.length}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
                    <div className="text-slate-400">在线客户</div>
                    <div className="text-slate-100 mt-1">{customers.filter((item) => item.onlineStatus === 'online').length}</div>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-85">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2 font-medium">钱包</th>
                        <th className="px-3 py-2 font-medium">合同</th>
                        <th className="px-3 py-2 font-medium">在线</th>
                        <th className="px-3 py-2 font-medium">设备</th>
                        <th className="px-3 py-2 font-medium">收益</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {customers.slice(0, 8).map((customer) => (
                        <tr key={customer.id} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-mono text-slate-200 break-all">{customer.wallet}</td>
                          <td className="px-3 py-2 text-slate-300">{customer.contractActive ? '有效' : '停用'}</td>
                          <td className="px-3 py-2 text-slate-300">{customer.onlineStatus}</td>
                          <td className="px-3 py-2 text-slate-300">{customer.deviceCount}/{customer.activeDeviceCount}</td>
                          <td className="px-3 py-2 text-slate-300">{Number(customer.totalRewardUsdt || '0').toFixed(3)} USDT</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

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

            {/* Table */}
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

            {loading && (
              <div className="mt-4 text-xs text-slate-500">正在同步链上数据...</div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

