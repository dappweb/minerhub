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

type ViewMode = 'website' | 'admin' | 'mining';

export default function App() {
  const [viewMode, setViewMode] = React.useState<ViewMode>('website');

  const navItems: Array<{ key: ViewMode; label: string }> = [
    { key: 'website', label: '项目网站' },
    { key: 'admin', label: '后台管理系统' },
    { key: 'mining', label: '挖矿 App' },
  ];

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
            <AdminDashboard />
          </>
        )}

        {viewMode === 'mining' && (
          <>
            <section className="pt-24 pb-8">
              <div className="max-w-7xl mx-auto px-6">
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">挖矿 App</h1>
                <p className="mt-4 text-slate-400">移动端一键挖矿、钱包管理与收益兑换。</p>
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
