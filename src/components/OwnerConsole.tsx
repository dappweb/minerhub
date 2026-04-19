import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

type OwnerConsoleProps = {
  adminWallet: string;
  signMessageAsync: (walletAddress: string, message: string) => Promise<string>;
};

type Tab = 'overview' | 'tokens' | 'earnings' | 'payouts' | 'audit';

type OverviewData = {
  users: number;
  devices: number;
  activeDevices: number;
  totalRewardUsdt: number;
  totalRewardSuper: number;
  payoutBatches: number;
  payoutUsdtTotal: number;
  onchain: {
    enabled: boolean;
    relayer?: string;
    superTotalSupply?: string;
    relayerSuperBalance?: string;
    error?: string;
  };
};

type EarningsRow = {
  userId: string;
  wallet: string;
  nickname: string | null;
  totalRewardUsdt: string;
  totalRewardSuper: string;
  rateUsdtPerHour: string;
  onlineStatus: string;
  lastSeenAt: string | null;
  lastAccruedTo: string | null;
};

type AuditRow = {
  id: string;
  actorWallet: string;
  action: string;
  targetUserId: string | null;
  targetWallet: string | null;
  payload: unknown;
  txHash: string | null;
  status: string;
  errorMessage: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://coin-planet-api.dappweb.workers.dev';

export default function OwnerConsole({ adminWallet, signMessageAsync }: OwnerConsoleProps) {
  const [tab, setTab] = useState<Tab>('overview');

  // Auth state: JWT for reads, signature per-request for writes
  const [token, setToken] = useState<string>(() => sessionStorage.getItem('ownerJwt') || '');
  const [expiresAt, setExpiresAt] = useState<string>(() => sessionStorage.getItem('ownerJwtExp') || '');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const isAuthed = useMemo(() => {
    if (!token || !expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now() + 5_000;
  }, [token, expiresAt]);

  const login = useCallback(async () => {
    try {
      setLoginError('');
      setLoginLoading(true);
      const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const ts = Date.now();
      const msg = `coinplanet-owner|login|${nonce}|${ts}`;
      const signature = await signMessageAsync(adminWallet, msg);
      const res = await fetch(`${API_BASE}/api/owner/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ wallet: adminWallet, signature, nonce, ts }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { token: string; expiresAt: string };
      sessionStorage.setItem('ownerJwt', data.token);
      sessionStorage.setItem('ownerJwtExp', data.expiresAt);
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'login failed');
    } finally {
      setLoginLoading(false);
    }
  }, [adminWallet, signMessageAsync]);

  const logout = useCallback(() => {
    sessionStorage.removeItem('ownerJwt');
    sessionStorage.removeItem('ownerJwtExp');
    setToken('');
    setExpiresAt('');
  }, []);

  const authedFetch = useCallback(
    async <T,>(path: string, init: RequestInit = {}, sensitive = false): Promise<T> => {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
        ...(init.headers as Record<string, string> | undefined),
      };
      if (sensitive) {
        const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const bodyStr = typeof init.body === 'string' ? init.body : init.body ? JSON.stringify(init.body) : '{}';
        let payload: Record<string, unknown> = {};
        try { payload = JSON.parse(bodyStr); } catch { /* ignore */ }
        const message = `coinplanet|${nonce}|${path}|${JSON.stringify(payload)}`;
        const signature = await signMessageAsync(adminWallet, message);
        headers['x-signature'] = signature;
        headers['x-nonce'] = nonce;
        headers['x-wallet'] = adminWallet;
      }
      const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as T;
    },
    [adminWallet, signMessageAsync, token]
  );

  // --- Overview ---
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const loadOverview = useCallback(async () => {
    try { setLoadingOverview(true); setOverview(await authedFetch<OverviewData>('/api/owner/overview')); }
    catch (e) { console.error(e); }
    finally { setLoadingOverview(false); }
  }, [authedFetch]);

  // --- Token ops ---
  const [mintTo, setMintTo] = useState('');
  const [mintAmount, setMintAmount] = useState('1000');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('1000');
  const [burnAmount, setBurnAmount] = useState('100');
  const [burnFromAddr, setBurnFromAddr] = useState('');
  const [airdropCsv, setAirdropCsv] = useState('');
  const [airdropMode, setAirdropMode] = useState<'mint' | 'transfer'>('mint');
  const [balanceQuery, setBalanceQuery] = useState('');
  const [balanceResult, setBalanceResult] = useState<string>('');
  const [tokenMsg, setTokenMsg] = useState<string>('');
  const [tokenLoading, setTokenLoading] = useState(false);

  const runMint = useCallback(async () => {
    setTokenLoading(true); setTokenMsg('');
    try {
      const r = await authedFetch<{ txHash: string }>('/api/owner/super/mint', {
        method: 'POST', body: JSON.stringify({ to: mintTo, amount: mintAmount }),
      }, true);
      setTokenMsg(`铸造成功: ${r.txHash}`);
    } catch (e) { setTokenMsg(`铸造失败: ${e instanceof Error ? e.message : e}`); }
    finally { setTokenLoading(false); }
  }, [authedFetch, mintTo, mintAmount]);

  const runTransfer = useCallback(async () => {
    setTokenLoading(true); setTokenMsg('');
    try {
      const r = await authedFetch<{ txHash: string }>('/api/owner/super/transfer', {
        method: 'POST', body: JSON.stringify({ to: transferTo, amount: transferAmount }),
      }, true);
      setTokenMsg(`转账成功: ${r.txHash}`);
    } catch (e) { setTokenMsg(`转账失败: ${e instanceof Error ? e.message : e}`); }
    finally { setTokenLoading(false); }
  }, [authedFetch, transferTo, transferAmount]);

  const runBurn = useCallback(async () => {
    setTokenLoading(true); setTokenMsg('');
    try {
      const body: Record<string, unknown> = { amount: burnAmount };
      if (burnFromAddr.trim()) body.from = burnFromAddr.trim();
      const r = await authedFetch<{ txHash: string }>('/api/owner/super/burn', {
        method: 'POST', body: JSON.stringify(body),
      }, true);
      setTokenMsg(`销毁成功: ${r.txHash}`);
    } catch (e) { setTokenMsg(`销毁失败: ${e instanceof Error ? e.message : e}`); }
    finally { setTokenLoading(false); }
  }, [authedFetch, burnAmount, burnFromAddr]);

  const runAirdrop = useCallback(async () => {
    setTokenLoading(true); setTokenMsg('');
    try {
      const items = airdropCsv
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [wallet, amount] = l.split(/[,\s]+/);
          return { wallet, amount };
        })
        .filter((x) => x.wallet && x.amount);
      if (!items.length) { setTokenMsg('CSV 为空或格式错误'); setTokenLoading(false); return; }
      const r = await authedFetch<{ success: number; failed: number; total: number; results: Array<{ wallet: string; txHash?: string; error?: string }> }>(
        '/api/owner/super/airdrop',
        { method: 'POST', body: JSON.stringify({ mode: airdropMode, items }) },
        true
      );
      setTokenMsg(`空投完成: ${r.success}/${r.total} 成功, ${r.failed} 失败`);
    } catch (e) { setTokenMsg(`空投失败: ${e instanceof Error ? e.message : e}`); }
    finally { setTokenLoading(false); }
  }, [authedFetch, airdropCsv, airdropMode]);

  const runBalance = useCallback(async () => {
    setTokenLoading(true); setBalanceResult('');
    try {
      const r = await authedFetch<{ wallet: string; balance: string }>(`/api/owner/super/balance?wallet=${encodeURIComponent(balanceQuery)}`);
      setBalanceResult(`${r.wallet}: ${r.balance} SUPER`);
    } catch (e) { setBalanceResult(`查询失败: ${e instanceof Error ? e.message : e}`); }
    finally { setTokenLoading(false); }
  }, [authedFetch, balanceQuery]);

  // --- Earnings ---
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsMsg, setEarningsMsg] = useState('');
  const [settleUser, setSettleUser] = useState('');
  const [settleHours, setSettleHours] = useState('24');
  const [adjustUser, setAdjustUser] = useState('');
  const [adjustUsdt, setAdjustUsdt] = useState('0');
  const [adjustSuper, setAdjustSuper] = useState('0');
  const [adjustNote, setAdjustNote] = useState('');

  const loadEarnings = useCallback(async () => {
    setEarningsLoading(true);
    try { setEarnings((await authedFetch<{ items: EarningsRow[] }>('/api/owner/earnings/overview')).items); }
    catch (e) { setEarningsMsg(`加载失败: ${e instanceof Error ? e.message : e}`); }
    finally { setEarningsLoading(false); }
  }, [authedFetch]);

  const runSettle = useCallback(async () => {
    setEarningsMsg('');
    try {
      const r = await authedFetch<{ rewardId: string; usdt: number; totalRewardUsdt: string }>(
        `/api/owner/earnings/settle/${encodeURIComponent(settleUser)}`,
        { method: 'POST', body: JSON.stringify({ hours: Number(settleHours) }) },
        true
      );
      setEarningsMsg(`结算成功: +${r.usdt} USDT, 累计 ${r.totalRewardUsdt}`);
      void loadEarnings();
    } catch (e) { setEarningsMsg(`结算失败: ${e instanceof Error ? e.message : e}`); }
  }, [authedFetch, settleUser, settleHours, loadEarnings]);

  const runAdjust = useCallback(async () => {
    setEarningsMsg('');
    try {
      const r = await authedFetch<{ totalRewardUsdt: string; totalRewardSuper: string }>(
        `/api/owner/earnings/adjust/${encodeURIComponent(adjustUser)}`,
        { method: 'POST', body: JSON.stringify({ deltaUsdt: Number(adjustUsdt), deltaSuper: Number(adjustSuper), note: adjustNote }) },
        true
      );
      setEarningsMsg(`调整成功: USDT=${r.totalRewardUsdt}, SUPER=${r.totalRewardSuper}`);
      void loadEarnings();
    } catch (e) { setEarningsMsg(`调整失败: ${e instanceof Error ? e.message : e}`); }
  }, [authedFetch, adjustUser, adjustUsdt, adjustSuper, adjustNote, loadEarnings]);

  // --- Payouts ---
  const [payoutCsv, setPayoutCsv] = useState('');
  const [payoutNote, setPayoutNote] = useState('');
  const [payoutDryResult, setPayoutDryResult] = useState<string>('');
  const [payoutMsg, setPayoutMsg] = useState('');
  const parsePayoutCsv = () =>
    payoutCsv
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [wallet, amountUsdt, userId] = l.split(/[,\s]+/);
        return { wallet, amountUsdt, userId };
      })
      .filter((x) => x.wallet && x.amountUsdt);

  const runPayout = useCallback(async (dryRun: boolean) => {
    setPayoutMsg(''); setPayoutDryResult('');
    try {
      const items = parsePayoutCsv();
      if (!items.length) { setPayoutMsg('CSV 为空或格式错误'); return; }
      const r = await authedFetch<{ total: number; count: number; outcomes?: Array<{ wallet: string; amount: string; txHash?: string; error?: string }> }>(
        '/api/owner/payouts/batch',
        { method: 'POST', body: JSON.stringify({ dryRun, note: payoutNote, items }) },
        !dryRun
      );
      if (dryRun) {
        setPayoutDryResult(`DRY-RUN: 共 ${r.count} 笔, 合计 ${r.total} USDT`);
      } else {
        const ok = r.outcomes?.filter((x) => x.txHash).length ?? 0;
        setPayoutMsg(`批量出款完成: ${ok}/${r.count} 成功`);
      }
    } catch (e) { setPayoutMsg(`失败: ${e instanceof Error ? e.message : e}`); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authedFetch, payoutCsv, payoutNote]);

  // --- Audit ---
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilterAction, setAuditFilterAction] = useState('');
  const [auditFilterTarget, setAuditFilterTarget] = useState('');
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const q = new URLSearchParams();
      if (auditFilterAction) q.set('action', auditFilterAction);
      if (auditFilterTarget) q.set('target', auditFilterTarget);
      q.set('limit', '100');
      setAudit((await authedFetch<{ items: AuditRow[] }>(`/api/owner/audit?${q}`)).items);
    } catch (e) { console.error(e); }
    finally { setAuditLoading(false); }
  }, [authedFetch, auditFilterAction, auditFilterTarget]);

  useEffect(() => {
    if (!isAuthed) return;
    if (tab === 'overview') void loadOverview();
    if (tab === 'earnings') void loadEarnings();
    if (tab === 'audit') void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAuthed]);

  if (!isAuthed) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
        <h3 className="text-lg font-bold text-amber-300 mb-3">Owner 控制台 · 需要登录</h3>
        <p className="text-sm text-slate-400 mb-4">
          使用 owner 钱包签名换取 JWT 会话 (2 小时)。登录后无需每次签名；敏感写操作仍会再次请求签名。
        </p>
        <button
          onClick={login}
          disabled={loginLoading}
          className="px-5 py-2 rounded-xl bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 transition-colors disabled:opacity-50"
        >
          {loginLoading ? '签名中...' : '钱包签名登录'}
        </button>
        {loginError && <p className="mt-3 text-sm text-red-400 break-all">{loginError}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-cyan-300">Owner 控制台</h3>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>会话到期: {new Date(expiresAt).toLocaleString()}</span>
          <button onClick={logout} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700">退出</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {(['overview', 'tokens', 'earnings', 'payouts', 'audit'] as Tab[]).map((t) => (
          <button key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === t ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {t === 'overview' ? '概览' : t === 'tokens' ? 'SUPER 代币' : t === 'earnings' ? '收益' : t === 'payouts' ? '批量出款' : '审计日志'}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-3 text-sm">
          <button onClick={loadOverview} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs">刷新</button>
          {loadingOverview && <p className="text-slate-400">加载中...</p>}
          {overview && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <OverviewCell label="用户" value={overview.users} />
              <OverviewCell label="设备" value={overview.devices} />
              <OverviewCell label="活跃设备" value={overview.activeDevices} />
              <OverviewCell label="累计收益 USDT" value={Number(overview.totalRewardUsdt).toFixed(2)} />
              <OverviewCell label="累计收益 SUPER" value={Number(overview.totalRewardSuper).toFixed(2)} />
              <OverviewCell label="出款批次" value={overview.payoutBatches} />
              <OverviewCell label="出款总额" value={Number(overview.payoutUsdtTotal).toFixed(2)} />
              <OverviewCell label="链上状态" value={overview.onchain.enabled ? '已连接' : '未配置'} />
              {overview.onchain.enabled && (
                <>
                  <OverviewCell label="SUPER 总供应" value={overview.onchain.superTotalSupply ?? '-'} />
                  <OverviewCell label="Relayer 余额" value={overview.onchain.relayerSuperBalance ?? '-'} />
                  <OverviewCell label="Relayer 地址" value={overview.onchain.relayer ?? '-'} span={2} />
                </>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'tokens' && (
        <div className="space-y-6 text-sm">
          {tokenMsg && <p className="text-cyan-300 break-all">{tokenMsg}</p>}

          <Card title="查询 SUPER 余额">
            <div className="flex gap-2">
              <input className={inputCls} placeholder="0x..." value={balanceQuery} onChange={(e) => setBalanceQuery(e.target.value)} />
              <button onClick={runBalance} disabled={tokenLoading} className={btnCls}>查询</button>
            </div>
            {balanceResult && <p className="text-slate-300 text-xs break-all mt-2">{balanceResult}</p>}
          </Card>

          <Card title="铸造 SUPER (mint)">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="接收地址 0x..." value={mintTo} onChange={(e) => setMintTo(e.target.value)} />
              <input className={inputCls} placeholder="数量 (SUPER)" value={mintAmount} onChange={(e) => setMintAmount(e.target.value)} />
              <button onClick={runMint} disabled={tokenLoading || !mintTo} className={btnCls}>铸造</button>
            </div>
          </Card>

          <Card title="从 Relayer 转账 SUPER (transfer)">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="接收地址 0x..." value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
              <input className={inputCls} placeholder="数量" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} />
              <button onClick={runTransfer} disabled={tokenLoading || !transferTo} className={btnCls}>转账</button>
            </div>
          </Card>

          <Card title="销毁 SUPER (burn / burnFrom)">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="可选: 从指定地址 (需允许额度)" value={burnFromAddr} onChange={(e) => setBurnFromAddr(e.target.value)} />
              <input className={inputCls} placeholder="数量" value={burnAmount} onChange={(e) => setBurnAmount(e.target.value)} />
              <button onClick={runBurn} disabled={tokenLoading} className={btnCls}>销毁</button>
            </div>
            <p className="text-xs text-slate-500 mt-2">留空 from 则销毁 Relayer 自有余额; 从他人销毁需先经 approve。</p>
          </Card>

          <Card title="批量空投 (airdrop)">
            <div className="flex gap-2 mb-2">
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="radio" checked={airdropMode === 'mint'} onChange={() => setAirdropMode('mint')} /> 铸造模式
              </label>
              <label className="text-xs text-slate-400 flex items-center gap-2">
                <input type="radio" checked={airdropMode === 'transfer'} onChange={() => setAirdropMode('transfer')} /> 转账模式
              </label>
            </div>
            <textarea
              className={`${inputCls} h-28 font-mono`}
              placeholder="每行: 0xWallet,数量&#10;例如:&#10;0xabc...,100&#10;0xdef...,200"
              value={airdropCsv}
              onChange={(e) => setAirdropCsv(e.target.value)}
            />
            <button onClick={runAirdrop} disabled={tokenLoading} className={`${btnCls} mt-2`}>执行空投 (最多 200 条)</button>
          </Card>
        </div>
      )}

      {tab === 'earnings' && (
        <div className="space-y-6 text-sm">
          {earningsMsg && <p className="text-cyan-300 break-all">{earningsMsg}</p>}

          <Card title="结算在线时长 (单用户)">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="userId" value={settleUser} onChange={(e) => setSettleUser(e.target.value)} />
              <input className={inputCls} placeholder="小时数" value={settleHours} onChange={(e) => setSettleHours(e.target.value)} />
              <button onClick={runSettle} disabled={!settleUser} className={btnCls}>结算</button>
            </div>
          </Card>

          <Card title="手动调整 (加减 USDT / SUPER)">
            <div className="flex flex-wrap gap-2">
              <input className={inputCls} placeholder="userId" value={adjustUser} onChange={(e) => setAdjustUser(e.target.value)} />
              <input className={inputCls} placeholder="Δ USDT" value={adjustUsdt} onChange={(e) => setAdjustUsdt(e.target.value)} />
              <input className={inputCls} placeholder="Δ SUPER" value={adjustSuper} onChange={(e) => setAdjustSuper(e.target.value)} />
              <input className={inputCls} placeholder="备注" value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
              <button onClick={runAdjust} disabled={!adjustUser} className={btnCls}>调整</button>
            </div>
          </Card>

          <Card title={`收益总览 (${earnings.length})`}>
            <button onClick={loadEarnings} className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs mb-2">刷新</button>
            {earningsLoading && <p className="text-slate-400">加载中...</p>}
            <div className="overflow-auto max-h-96">
              <table className="text-xs w-full">
                <thead className="text-slate-400">
                  <tr><th className="text-left py-1 pr-2">userId</th><th className="text-left pr-2">wallet</th><th className="text-right pr-2">USDT</th><th className="text-right pr-2">SUPER</th><th className="text-right pr-2">rate/h</th><th className="text-left pr-2">状态</th></tr>
                </thead>
                <tbody>
                  {earnings.map((e) => (
                    <tr key={e.userId} className="border-t border-slate-800">
                      <td className="py-1 pr-2 font-mono cursor-pointer" onClick={() => { setSettleUser(e.userId); setAdjustUser(e.userId); }}>{e.userId.slice(0, 10)}…</td>
                      <td className="pr-2 font-mono text-slate-400">{e.wallet.slice(0, 10)}…{e.wallet.slice(-4)}</td>
                      <td className="pr-2 text-right">{Number(e.totalRewardUsdt).toFixed(2)}</td>
                      <td className="pr-2 text-right">{Number(e.totalRewardSuper).toFixed(2)}</td>
                      <td className="pr-2 text-right">{e.rateUsdtPerHour}</td>
                      <td className="pr-2">{e.onlineStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="space-y-6 text-sm">
          {payoutMsg && <p className="text-cyan-300 break-all">{payoutMsg}</p>}
          {payoutDryResult && <p className="text-amber-300 break-all">{payoutDryResult}</p>}
          <Card title="批量 USDT 出款 (由 Relayer 链上支付)">
            <textarea
              className={`${inputCls} h-32 font-mono`}
              placeholder="每行: 0xWallet,金额USDT[,userId 可选]&#10;例: 0xabc,10,user_123"
              value={payoutCsv}
              onChange={(e) => setPayoutCsv(e.target.value)}
            />
            <input className={`${inputCls} mt-2`} placeholder="批次备注" value={payoutNote} onChange={(e) => setPayoutNote(e.target.value)} />
            <div className="flex gap-2 mt-2">
              <button onClick={() => runPayout(true)} className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-xs">DRY-RUN 预览</button>
              <button onClick={() => runPayout(false)} className={btnCls}>执行出款 (最多 100 条)</button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <input className={inputCls} placeholder="action (例: super.mint)" value={auditFilterAction} onChange={(e) => setAuditFilterAction(e.target.value)} />
            <input className={inputCls} placeholder="target wallet" value={auditFilterTarget} onChange={(e) => setAuditFilterTarget(e.target.value)} />
            <button onClick={loadAudit} className={btnCls}>查询</button>
          </div>
          {auditLoading && <p className="text-slate-400">加载中...</p>}
          <div className="overflow-auto max-h-[500px]">
            <table className="text-xs w-full">
              <thead className="text-slate-400">
                <tr>
                  <th className="text-left py-1 pr-2">时间</th>
                  <th className="text-left pr-2">action</th>
                  <th className="text-left pr-2">status</th>
                  <th className="text-left pr-2">actor</th>
                  <th className="text-left pr-2">target</th>
                  <th className="text-left pr-2">tx</th>
                  <th className="text-left pr-2">payload</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="pr-2 font-mono">{a.action}</td>
                    <td className={`pr-2 ${a.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{a.status}</td>
                    <td className="pr-2 font-mono text-slate-400">{a.actorWallet.slice(0, 8)}…</td>
                    <td className="pr-2 font-mono text-slate-400">{a.targetWallet ? `${a.targetWallet.slice(0, 8)}…` : a.targetUserId?.slice(0, 10) ?? '-'}</td>
                    <td className="pr-2 font-mono text-cyan-400">{a.txHash ? `${a.txHash.slice(0, 10)}…` : '-'}</td>
                    <td className="pr-2 font-mono text-slate-500 max-w-xs truncate">{a.payload ? JSON.stringify(a.payload) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm flex-1 min-w-[160px] focus:outline-none focus:border-cyan-500';
const btnCls = 'px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 disabled:opacity-50 text-sm';

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <h4 className="font-semibold text-slate-200 mb-3">{title}</h4>
      {children}
    </div>
  );
}

function OverviewCell({ label, value, span }: { label: string; value: string | number; span?: number }) {
  return (
    <div className={`rounded-lg bg-slate-950/60 border border-slate-800 p-3 ${span === 2 ? 'md:col-span-2' : ''}`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-sm font-mono text-slate-100 break-all">{value}</div>
    </div>
  );
}
