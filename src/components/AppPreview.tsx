import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Battery, Wifi, Signal, Activity, ArrowRightLeft, Wallet } from 'lucide-react';
import { claimRewardsOnChain, connectWallet, startMiningOnChain } from '../lib/blockchain';

export default function AppPreview() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [miningStatus, setMiningStatus] = useState<string>('等待连接钱包');
  const [pendingAction, setPendingAction] = useState<boolean>(false);

  const handleConnect = async () => {
    try {
      setPendingAction(true);
      const address = await connectWallet();
      setWalletAddress(address);
      setMiningStatus('钱包已连接，可发起链上挖矿');
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接钱包失败';
      setMiningStatus(message);
    } finally {
      setPendingAction(false);
    }
  };

  const handleStartMining = async () => {
    try {
      setPendingAction(true);
      setMiningStatus('链上提交挖矿交易中...');
      const hash = await startMiningOnChain();
      setMiningStatus(`挖矿交易已确认: ${hash.slice(0, 10)}...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '挖矿交易失败';
      setMiningStatus(message);
    } finally {
      setPendingAction(false);
    }
  };

  const handleClaim = async () => {
    try {
      setPendingAction(true);
      setMiningStatus('链上领取收益中...');
      const hash = await claimRewardsOnChain();
      setMiningStatus(`收益领取成功: ${hash.slice(0, 10)}...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '收益领取失败';
      setMiningStatus(message);
    } finally {
      setPendingAction(false);
    }
  };

  return (
    <section id="app-preview" className="py-24 bg-slate-900/50 border-y border-slate-800/50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 text-sm font-medium mb-6"
            >
              Android / iOS 客户端已就绪
            </motion.div>
            <h2 className="text-3xl md:text-4xl font-bold mb-6">双端兼容挖矿钱包</h2>
            <p className="text-slate-400 text-lg mb-10 leading-relaxed">
              用户只需在 Android 或 iOS 手机上安装 MinerHub App，即可一键生成本地加密钱包。利用手机闲置算力进行静默挖矿，产出的 MM 代币可直接在 App 内兑换为 USDT 并提现。
            </p>
            
            <div className="space-y-8">
              {[
                { step: '01', title: '安装与生成钱包', desc: '下载双端客户端，一键生成基于 TEE 保护的本地非托管钱包，私钥完全由用户掌控。' },
                { step: '02', title: '一键开启挖矿', desc: '点击启动，后台智能调度算力，自动控制温度与功耗，完全不影响手机日常使用。' },
                { step: '03', title: '随时兑换 USDT', desc: '挖矿收益实时到账，内置 Swap 功能，可随时将 MM 代币兑换为 USDT 并提现至交易所。' }
              ].map((item, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.2 }}
                  className="flex gap-5"
                >
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                    <p className="text-slate-400">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Phone Mockup */}
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex-1 flex justify-center lg:justify-end w-full"
          >
            <div className="relative w-[320px] h-[650px] bg-slate-950 rounded-[3rem] border-[8px] border-slate-800 shadow-2xl overflow-hidden flex flex-col shrink-0">
              {/* Status Bar */}
              <div className="h-7 w-full flex justify-between items-center px-6 pt-2 text-[10px] text-slate-400 z-10">
                <span>12:00</span>
                <div className="flex gap-1.5 items-center">
                  <Signal size={12} />
                  <Wifi size={12} />
                  <Battery size={14} />
                </div>
              </div>
              
              {/* Notch */}
              <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-20">
                <div className="w-32 h-6 bg-slate-800 rounded-b-3xl"></div>
              </div>

              {/* App Content */}
              <div className="flex-1 flex flex-col p-6 pt-8 relative">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-slate-950 font-bold text-lg">M</div>
                    <span className="font-bold text-lg">MinerHub</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center">
                    <Wallet className="text-cyan-400" size={16} />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/30 rounded-2xl p-5 mb-8 shadow-lg">
                  <div className="text-slate-400 text-sm mb-1">总资产 (USDT)</div>
                  <div className="text-3xl font-bold text-white mb-4">$ 124.50</div>
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-slate-400">MM 余额</span>
                    <span className="font-medium text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-md">124,500 MM</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center relative">
                  <div className="absolute inset-0 bg-cyan-500/5 rounded-full animate-ping" style={{ animationDuration: '3s' }}></div>
                  <div className="w-44 h-44 rounded-full border-4 border-cyan-500/20 flex flex-col items-center justify-center relative z-10 bg-slate-900 shadow-[0_0_40px_rgba(6,182,212,0.15)]">
                    <Activity className="text-cyan-400 mb-2" size={36} />
                    <div className="text-3xl font-bold text-white">15.4</div>
                    <div className="text-sm text-cyan-400 mt-1">MH/s</div>
                  </div>
                  <div className="mt-8 text-cyan-400 font-medium flex items-center gap-2 bg-cyan-500/10 px-4 py-2 rounded-full">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
                    </span>
                    挖矿运行中...
                  </div>
                </div>

                <div className="mt-auto pt-8 grid grid-cols-2 gap-4">
                  <button className="py-3.5 rounded-xl bg-slate-800 text-white font-medium flex items-center justify-center gap-2 hover:bg-slate-700 transition-colors">
                    <ArrowRightLeft size={18} />
                    兑换 USDT
                  </button>
                  <button className="py-3.5 rounded-xl bg-cyan-500 text-slate-950 font-bold flex items-center justify-center gap-2 hover:bg-cyan-400 transition-colors shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)]">
                    <Wallet size={18} />
                    提现
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleConnect}
                    disabled={pendingAction}
                    className="w-full py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
                  >
                    {walletAddress ? '钱包已连接' : '连接钱包'}
                  </button>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleStartMining}
                      disabled={pendingAction || !walletAddress}
                      className="py-3 rounded-xl bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors disabled:opacity-60"
                    >
                      开始链上挖矿
                    </button>
                    <button
                      onClick={handleClaim}
                      disabled={pendingAction || !walletAddress}
                      className="py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
                    >
                      领取收益
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 break-all">{miningStatus}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
