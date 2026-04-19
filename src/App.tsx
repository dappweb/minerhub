/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { usePrivy } from '@privy-io/react-auth';
import React, { Suspense } from 'react';
import type { Address } from 'viem';
import { verifyMessage } from 'viem';
import { useAccount, useChainId, useSignMessage, useSwitchChain } from 'wagmi';
import Hero from './components/Hero';
import { getMiningPoolOwnerOnChain } from './lib/blockchain';
import { coinPlanetChain } from './lib/wallet';

// Lazy-load non-critical components for faster initial render
const AppPreview = React.lazy(() => import('./components/AppPreview'));
const DappSwap = React.lazy(() => import('./components/DappSwap'));
const Download = React.lazy(() => import('./components/Download'));
const Features = React.lazy(() => import('./components/Features'));
const Architecture = React.lazy(() => import('./components/Architecture'));
const Economics = React.lazy(() => import('./components/Economics'));
const FlowSteps = React.lazy(() => import('./components/FlowSteps'));
const OnchainProof = React.lazy(() => import('./components/OnchainProof'));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const Comparison = React.lazy(() => import('./components/Comparison'));
const Roadmap = React.lazy(() => import('./components/Roadmap'));
const MobileQrLogin = React.lazy(() => import('./components/MobileQrLogin'));

type ViewMode = 'website' | 'admin';

function formatWallet(address: string): string {
  if (!address || address.length < 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function App() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('website');
  const [adminLoginStatus, setAdminLoginStatus] = React.useState<string>('请先使用钱包登录后台');
  const [ownerAuthorityAddress, setOwnerAuthorityAddress] = React.useState<string>('');
  const [verifiedOwnerWallet, setVerifiedOwnerWallet] = React.useState<string>('');
  const autoVerifyAttemptedWalletRef = React.useRef<string>('');
  const [systemStatus, setSystemStatus] = React.useState<{ maintenanceEnabled: boolean; maintenanceMessageZh: string; maintenanceMessageEn: string } | null>(null);
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSignaturePending } = useSignMessage();
  const currentChainId = useChainId();
  const { switchChainAsync, switchChain } = useSwitchChain();

  // Auto-switch / add BSC testnet whenever a wallet is connected on a
  // different chain. wagmi's switchChain will call wallet_switchEthereumChain
  // and fall back to wallet_addEthereumChain automatically if the network is
  // not yet in the wallet (works for MetaMask, OneKey, OKX, TokenPocket...).
  React.useEffect(() => {
    if (!isConnected) return;
    if (!currentChainId) return;
    if (currentChainId === coinPlanetChain.id) return;
    try {
      // Prefer async to surface errors; fall back to fire-and-forget.
      if (switchChainAsync) {
        void switchChainAsync({ chainId: coinPlanetChain.id }).catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[wallet] failed to switch to BSC testnet:', err);
        });
      } else {
        switchChain({ chainId: coinPlanetChain.id });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[wallet] switchChain threw:', err);
    }
  }, [isConnected, currentChainId, switchChainAsync, switchChain]);

  const signAdminMessage = React.useCallback(
    async (walletAddress: string, message: string) => {
      if (!walletAddress) {
        throw new Error('请先连接钱包。');
      }

      return signMessageAsync({
        account: walletAddress as Address,
        message,
      });
    },
    [signMessageAsync],
  );

  const ownerWalletAddress =
    (import.meta.env.VITE_OWNER_WALLET as string | undefined) ||
    (import.meta.env.VITE_OWNER_ADDRESS as string | undefined) ||
    '';

  const extraAdminAddresses = React.useMemo(() => {
    const raw = (import.meta.env.VITE_ADMIN_ADDRESSES as string | undefined) || '';
    const fromEnv = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[0-9a-f]{40}$/i.test(s));
    // Fallback: hard-coded admin allowlist so production works even when the
    // Cloudflare Pages env var is not yet configured. These addresses are
    // already public (they are treasury/admin wallets on BSC testnet).
    const fallback = ['0xca949919f03e3e52949d1436442312d8a023fe41'];
    return Array.from(new Set([...fromEnv, ...fallback]));
  }, []);

  React.useEffect(() => {
    let canceled = false;

    const loadOwnerAuthority = async () => {
      try {
        const chainOwner = await getMiningPoolOwnerOnChain();
        if (!canceled) {
          setOwnerAuthorityAddress(chainOwner);
        }
      } catch {
        if (!canceled) {
          setOwnerAuthorityAddress(ownerWalletAddress);
        }
      }
    };

    void loadOwnerAuthority();
    return () => {
      canceled = true;
    };
  }, [ownerWalletAddress]);

  React.useEffect(() => {
    let canceled = false;

    const loadSystemStatus = async () => {
      try {
        const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'https://coin-planet-api.dappweb.workers.dev';
        const response = await fetch(`${baseUrl}/api/system/status`);
        const data = (await response.json()) as { maintenanceEnabled?: boolean; maintenanceMessageZh?: string; maintenanceMessageEn?: string };
        if (!canceled) {
          setSystemStatus({
            maintenanceEnabled: Boolean(data.maintenanceEnabled),
            maintenanceMessageZh: data.maintenanceMessageZh ?? '系统维护中，请稍后再试。',
            maintenanceMessageEn: data.maintenanceMessageEn ?? 'System maintenance in progress. Please try again later.',
          });
        }
      } catch {
        if (!canceled) {
          setSystemStatus(null);
        }
      }
    };

    void loadSystemStatus();
    return () => {
      canceled = true;
    };
  }, []);

  const isOwnerAddress = React.useCallback((address: string) => {
    if (!address) {
      return false;
    }
    const lower = address.toLowerCase();
    if (ownerAuthorityAddress && lower === ownerAuthorityAddress.toLowerCase()) {
      return true;
    }
    return extraAdminAddresses.includes(lower);
  }, [ownerAuthorityAddress, extraAdminAddresses]);

  const adminWallet = isConnected && address ? address : '';
  const isSignatureVerified =
    Boolean(adminWallet) &&
    Boolean(verifiedOwnerWallet) &&
    adminWallet.toLowerCase() === verifiedOwnerWallet.toLowerCase();
  const isOwnerLoggedIn = Boolean(adminWallet) && isOwnerAddress(adminWallet) && isSignatureVerified;
  const isAdminView = viewMode === 'admin';
  const maintenanceEnabled = Boolean(systemStatus?.maintenanceEnabled);

  React.useEffect(() => {
    if (!adminWallet) {
      autoVerifyAttemptedWalletRef.current = '';
      setVerifiedOwnerWallet('');
      setAdminLoginStatus('请先使用钱包登录后台');
      setViewMode('website');
      return;
    }

    if (!isOwnerAddress(adminWallet)) {
      autoVerifyAttemptedWalletRef.current = '';
      setVerifiedOwnerWallet('');
      setAdminLoginStatus('当前钱包不是链上 owner 账户，无法进入管理后台。');
      setViewMode('website');
      return;
    }

    if (!isSignatureVerified) {
      setAdminLoginStatus('owner 钱包已连接，请完成链上签名验证后进入数据面板。');
      setViewMode('website');
    }
  }, [adminWallet, isOwnerAddress, isSignatureVerified]);

  const verifyOwnerSignatureAndEnter = React.useCallback(
    async (walletAddress: string) => {
      if (!walletAddress) {
        setAdminLoginStatus('请先连接钱包。');
        return;
      }

      if (!isOwnerAddress(walletAddress)) {
        setVerifiedOwnerWallet('');
        setAdminLoginStatus('当前钱包不是链上 owner 账户，无法进入管理后台。');
        setViewMode('website');
        return;
      }

      try {
        const nonce = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        const message = [
          'Coin Planet Admin 登录签名验证',
          `Address: ${walletAddress}`,
          `Nonce: ${nonce}`,
          'Purpose: 进入链上数据管理面板',
        ].join('\n');

        const signature = await signAdminMessage(walletAddress, message);
        const valid = await verifyMessage({
          address: walletAddress as Address,
          message,
          signature,
        });

        if (!valid) {
          throw new Error('签名验证失败');
        }

        setVerifiedOwnerWallet(walletAddress);
        setAdminLoginStatus('链上签名验证成功，已进入 Coin Planet Admin。');
        setViewMode('admin');
      } catch (error) {
        setVerifiedOwnerWallet('');
        const message = error instanceof Error ? error.message : '签名验证失败';
        setAdminLoginStatus(`签名验证失败：${message}`);
        setViewMode('website');
      }
    },
    [isOwnerAddress, signAdminMessage],
  );

  React.useEffect(() => {
    if (!adminWallet) return;
    if (!isOwnerAddress(adminWallet)) return;
    if (isSignatureVerified) {
      setViewMode('admin');
      return;
    }
    if (isSignaturePending) return;

    const normalizedWallet = adminWallet.toLowerCase();
    if (autoVerifyAttemptedWalletRef.current === normalizedWallet) return;

    autoVerifyAttemptedWalletRef.current = normalizedWallet;
    void verifyOwnerSignatureAndEnter(adminWallet);
  }, [adminWallet, isOwnerAddress, isSignaturePending, isSignatureVerified, verifyOwnerSignatureAndEnter]);

  const { login: privyLogin, ready: privyReady, authenticated: privyAuthenticated } = usePrivy();

  const renderConnectAction = (className: string, showConnectedLabel: boolean) => {
    const connected = Boolean(privyReady && privyAuthenticated && address);

    const label = !connected
      ? '连接钱包'
      : isOwnerAddress(address)
        ? showConnectedLabel
          ? isSignatureVerified
            ? `已验证 ${formatWallet(address!)}`
            : `待签名 ${formatWallet(address!)}`
          : isSignaturePending
            ? '签名验证中...'
            : '签名验证进入后台'
        : '非 owner 钱包';

    return (
      <button
        onClick={() => {
          if (!privyReady) return;
          if (!connected) {
            privyLogin();
            return;
          }

          if (!isOwnerAddress(address)) {
            setAdminLoginStatus('当前钱包不是链上 owner 账户，无法进入管理后台。');
            setViewMode('website');
            return;
          }

          void verifyOwnerSignatureAndEnter(address!);
        }}
        className={className}
        type="button"
        disabled={!privyReady}
      >
        {label}
      </button>
    );
  };

  const renderOwnerDashboardEntry = (className: string) => {
    const connected = Boolean(privyReady && privyAuthenticated && address);

    return (
      <button
        onClick={() => {
          if (!privyReady) return;
          if (!connected) {
            privyLogin();
            return;
          }

          void verifyOwnerSignatureAndEnter(address!);
        }}
        className={className}
        type="button"
        disabled={!privyReady}
      >
        数据面板
      </button>
    );
  };

  if (!isAdminView && maintenanceEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 bg-slate-950 text-slate-50">
        <div className="max-w-xl w-full rounded-3xl border border-cyan-500/20 bg-slate-900/70 p-10 text-center shadow-2xl">
          <div className="text-sm uppercase tracking-[0.35em] text-cyan-300 mb-4">Maintenance Mode</div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{systemStatus?.maintenanceMessageZh ?? '系统维护中，请稍后再试。'}</h1>
          <p className="text-slate-400 mb-6">{systemStatus?.maintenanceMessageEn ?? 'System maintenance in progress. Please try again later.'}</p>
          <div className="flex justify-center">
            {renderConnectAction('px-5 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors', true)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      {!isAdminView && maintenanceEnabled && (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-xl w-full rounded-3xl border border-cyan-500/20 bg-slate-900/70 p-10 text-center shadow-2xl">
            <div className="text-sm uppercase tracking-[0.35em] text-cyan-300 mb-4">Maintenance Mode</div>
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{systemStatus?.maintenanceMessageZh ?? '系统维护中，请稍后再试。'}</h1>
            <p className="text-slate-400 mb-6">{systemStatus?.maintenanceMessageEn ?? 'System maintenance in progress. Please try again later.'}</p>
            <div className="flex justify-center">
              {renderConnectAction('px-5 py-3 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors', true)}
            </div>
          </div>
        </div>
      )}
      {!isAdminView && (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded flex items-center justify-center font-bold text-white"
              style={{ backgroundImage: 'linear-gradient(135deg, #22d3ee 0%, #2563eb 100%)' }}
            >
              M
            </div>
            <span className="font-bold text-xl tracking-tight">Coin Planet</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-sm font-medium text-slate-300">
            {renderOwnerDashboardEntry(
              'px-4 py-2 rounded-full bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors',
            )}
          </div>
        </div>
      </nav>
      )}

      <main className={isAdminView ? 'min-h-screen' : 'pt-16'}>
        <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" /></div>}>
        {viewMode === 'website' && (
          <>
            <Hero />
            <div id="flow-steps">
              <FlowSteps />
            </div>
            <OnchainProof />
            <section id="quick-entry" className="py-16 border-y border-slate-800/50 bg-slate-900/40">
              <div className="max-w-7xl mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-10">快速入口</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <h3 className="text-2xl font-bold mb-3">后台管理系统</h3>
                    <p className="text-slate-400 mb-6">通过钱包签名登录后台，管理矿机、用户与收益策略。</p>
                    {renderConnectAction(
                      'px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors',
                      false,
                    )}
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <h3 className="text-2xl font-bold mb-3">挖矿 App (Android / iOS)</h3>
                    <p className="text-slate-400 mb-6">下载双端兼容客户端，连接钱包后一键开启链上挖矿。</p>
                    <div className="flex flex-wrap gap-3">
                      <a
                        href="#download"
                        className="inline-flex px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
                      >
                        前往下载
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            <Download />
            <Features />
            <Architecture />
            <Economics />
            <AppPreview />
            <DappSwap />
            <Comparison />
            <Roadmap />
          </>
        )}

        {viewMode === 'admin' && (
          <>
            {!isOwnerLoggedIn ? (
              <section className="min-h-screen flex items-center justify-center px-6 py-10">
                <div className="w-full max-w-7xl">
                  <div className="max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
                    <h2 className="text-2xl font-bold mb-3">钱包登录验证</h2>
                    <p className="text-slate-400 mb-6">请使用链上 owner 钱包完成签名验证，通过后才可访问链上数据管理面板。</p>
                    {renderConnectAction(
                      'px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors',
                      false,
                    )}
                    <p className="mt-4 text-sm text-slate-400 break-all">{adminLoginStatus}</p>
                    <MobileQrLogin />
                  </div>
                </div>
              </section>
            ) : (
              <AdminDashboard fullScreen adminWallet={adminWallet} signMessageAsync={signAdminMessage} />
            )}
          </>
        )}
        </Suspense>
      </main>

      {!isAdminView && (
      <footer className="bg-slate-900 py-12 border-t border-slate-800 text-center text-slate-400 text-sm">
        <p>Coin Planet 手机挖矿系统 v1.0</p>
        <p className="mt-2">将手机从"消费电子产品"升级为"生产力工具"</p>
      </footer>
      )}
    </div>
  );
}
