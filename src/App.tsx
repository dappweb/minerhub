/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConnectButton } from '@rainbow-me/rainbowkit';
import React, { Suspense } from 'react';
import type { Address } from 'viem';
import { verifyMessage } from 'viem';
import { useAccount, useSignMessage } from 'wagmi';
import Hero from './components/Hero';
import { getMiningPoolOwnerOnChain } from './lib/blockchain';

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
  const { address, isConnected } = useAccount();
  const { signMessageAsync, isPending: isSignaturePending } = useSignMessage();

  const androidDownloadUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL || '#';
  const iosDownloadUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL || '#';
  const ownerWalletAddress =
    (import.meta.env.VITE_OWNER_WALLET as string | undefined) ||
    (import.meta.env.VITE_OWNER_ADDRESS as string | undefined) ||
    '';

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

  const isOwnerAddress = React.useCallback((address: string) => {
    if (!address || !ownerAuthorityAddress) {
      return false;
    }
    return address.toLowerCase() === ownerAuthorityAddress.toLowerCase();
  }, [ownerAuthorityAddress]);

  const adminWallet = isConnected && address ? address : '';
  const isSignatureVerified =
    Boolean(adminWallet) &&
    Boolean(verifiedOwnerWallet) &&
    adminWallet.toLowerCase() === verifiedOwnerWallet.toLowerCase();
  const isOwnerLoggedIn = Boolean(adminWallet) && isOwnerAddress(adminWallet) && isSignatureVerified;
  const isAdminView = viewMode === 'admin';

  React.useEffect(() => {
    if (!adminWallet) {
      setVerifiedOwnerWallet('');
      setAdminLoginStatus('请先使用钱包登录后台');
      setViewMode('website');
      return;
    }

    if (!isOwnerAddress(adminWallet)) {
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

        const signature = await signMessageAsync({ message });
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
    [isOwnerAddress, signMessageAsync],
  );

  const renderConnectAction = (className: string, showConnectedLabel: boolean) => (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal }) => {
        const ready = mounted;
        const connected = Boolean(ready && account);

        const label = !connected
          ? '连接钱包'
          : isOwnerAddress(account.address)
            ? showConnectedLabel
              ? isSignatureVerified
                ? `已验证 ${formatWallet(account.address)}`
                : `待签名 ${formatWallet(account.address)}`
              : isSignaturePending
                ? '签名验证中...'
                : '签名验证进入后台'
            : '非 owner 钱包';

        return (
          <button
            onClick={() => {
              if (!connected) {
                openConnectModal();
                return;
              }

              if (!isOwnerAddress(account.address)) {
                setAdminLoginStatus('当前钱包不是链上 owner 账户，无法进入管理后台。');
                setViewMode('website');
                return;
              }

              void verifyOwnerSignatureAndEnter(account.address);
            }}
            className={className}
            type="button"
          >
            {label}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );

  const renderOwnerDashboardEntry = (className: string) => (
    <ConnectButton.Custom>
      {({ account, mounted, openConnectModal }) => {
        const ready = mounted;
        const connected = Boolean(ready && account);

        return (
          <button
            onClick={() => {
              if (!connected) {
                openConnectModal();
                return;
              }

              void verifyOwnerSignatureAndEnter(account.address);
            }}
            className={className}
            type="button"
          >
            数据面板
          </button>
        );
      }}
    </ConnectButton.Custom>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      {!isAdminView && (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-bold text-white">
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
                        href={androidDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
                      >
                        下载 Android
                      </a>
                      <a
                        href={iosDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex px-5 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold hover:bg-slate-700 transition-colors"
                      >
                        下载 iOS
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
                  </div>
                </div>
              </section>
            ) : (
              <AdminDashboard fullScreen adminWallet={adminWallet} />
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
