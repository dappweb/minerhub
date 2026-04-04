/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import Hero from './components/Hero';
import AppPreview from './components/AppPreview';
import DappSwap from './components/DappSwap';
import Features from './components/Features';
import Architecture from './components/Architecture';
import Economics from './components/Economics';
import AdminDashboard from './components/AdminDashboard';
import Comparison from './components/Comparison';
import Roadmap from './components/Roadmap';
import { connectWallet } from './lib/blockchain';

type ViewMode = 'website' | 'admin' | 'mining';

export default function App() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('website');
  const [adminWallet, setAdminWallet] = React.useState<string>('');
  const [adminLoginStatus, setAdminLoginStatus] = React.useState<string>('请先使用钱包登录后台');
  const [adminPending, setAdminPending] = React.useState<boolean>(false);

  const androidDownloadUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL || '#';
  const iosDownloadUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL || '#';

  const navItems: Array<{ key: ViewMode; label: string }> = [
    { key: 'website', label: '项目网站' },
    { key: 'admin', label: '后台管理系统' },
    { key: 'mining', label: '挖矿 App' },
  ];

  const handleAdminWalletLogin = async () => {
    try {
      setAdminPending(true);
      const address = await connectWallet();
      setAdminWallet(address);
      setAdminLoginStatus('钱包验证成功，已进入后台管理系统');
    } catch (error) {
      const message = error instanceof Error ? error.message : '钱包登录失败';
      setAdminLoginStatus(message);
    } finally {
      setAdminPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-cyan-500/30">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center font-bold text-white">
              M
            </div>
            <span className="font-bold text-xl tracking-tight">MinerHub</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-sm font-medium text-slate-300">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setViewMode(item.key)}
                className={`px-3 py-2 rounded-full border transition-colors ${
                  viewMode === item.key
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                    : 'bg-transparent text-slate-300 border-slate-700 hover:text-cyan-400 hover:border-cyan-500/30'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {viewMode === 'website' && (
          <>
            <Hero />
            <section className="py-16 border-y border-slate-800/50 bg-slate-900/40">
              <div className="max-w-7xl mx-auto px-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-10">快速入口</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                    <h3 className="text-2xl font-bold mb-3">后台管理系统</h3>
                    <p className="text-slate-400 mb-6">通过钱包签名登录后台，管理矿机、用户与收益策略。</p>
                    <button
                      onClick={() => setViewMode('admin')}
                      className="px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors"
                    >
                      钱包登录进入后台
                    </button>
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
            <Features />
            <Architecture />
            <Economics />
            <Comparison />
            <Roadmap />
          </>
        )}

        {viewMode === 'admin' && (
          <>
            <section className="pt-24 pb-8">
              <div className="max-w-7xl mx-auto px-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">后台管理系统</h1>
                <p className="mt-4 text-slate-400">面向运营团队的矿机监控、用户管理和风控控制台。</p>
              </div>
            </section>
            {!adminWallet ? (
              <section className="pb-20">
                <div className="max-w-7xl mx-auto px-6">
                  <div className="max-w-xl rounded-2xl border border-slate-800 bg-slate-900/70 p-8">
                    <h2 className="text-2xl font-bold mb-3">钱包登录验证</h2>
                    <p className="text-slate-400 mb-6">请使用管理员钱包连接并签名，通过后才可访问后台控制台。</p>
                    <button
                      onClick={handleAdminWalletLogin}
                      disabled={adminPending}
                      className="px-5 py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors disabled:opacity-60"
                    >
                      {adminPending ? '登录中...' : '连接钱包登录'}
                    </button>
                    <p className="mt-4 text-sm text-slate-400 break-all">{adminLoginStatus}</p>
                  </div>
                </div>
              </section>
            ) : (
              <>
                <section className="pb-8">
                  <div className="max-w-7xl mx-auto px-6">
                    <p className="text-sm text-cyan-300 break-all">已登录钱包：{adminWallet}</p>
                  </div>
                </section>
                <AdminDashboard />
              </>
            )}
          </>
        )}

        {viewMode === 'mining' && (
          <>
            <section className="pt-24 pb-8">
              <div className="max-w-7xl mx-auto px-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">挖矿 App</h1>
                <p className="mt-4 text-slate-400">移动端一键挖矿、钱包管理与收益兑换。</p>
                <div className="mt-6 flex flex-wrap gap-3">
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
            </section>
            <AppPreview />
            <DappSwap />
          </>
        )}
      </main>

      <footer className="bg-slate-900 py-12 border-t border-slate-800 text-center text-slate-400 text-sm">
        <p>MinerHub 手机挖矿系统 v1.0</p>
        <p className="mt-2">将手机从"消费电子产品"升级为"生产力工具"</p>
      </footer>
    </div>
  );
}
