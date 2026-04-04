import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDownUp, Settings, Wallet, Activity, Info } from 'lucide-react';
import { connectWallet, swapMmToUsdtOnChain } from '../lib/blockchain';

export default function DappSwap() {
  const [mmAmount, setMmAmount] = useState('10000');
  const [usdtAmount, setUsdtAmount] = useState('10.00');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [txStatus, setTxStatus] = useState<string>('请先连接钱包');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMmAmount(val);
    if (!isNaN(Number(val))) {
      setUsdtAmount((Number(val) / 1000).toFixed(2));
    }
  };

  const handleConnectWallet = async () => {
    try {
      setIsSubmitting(true);
      const address = await connectWallet();
      setWalletAddress(address);
      setTxStatus('钱包已连接，可发起兑换');
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接钱包失败';
      setTxStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSwap = async () => {
    try {
      setIsSubmitting(true);
      setTxStatus('正在提交链上兑换交易...');
      const hash = await swapMmToUsdtOnChain(mmAmount);
      setTxStatus(`兑换成功: ${hash.slice(0, 10)}...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '兑换失败';
      setTxStatus(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="dapp-swap" className="py-24 bg-slate-950 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-sm font-medium mb-6"
          >
            Web3 DApp 集成
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">去中心化兑换 (DApp Swap)</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            内置基于智能合约的 AMM 兑换池，挖矿产出的 MM 代币可随时随地与 USDT 进行去中心化兑换，资产完全由用户掌控。
          </p>
        </div>

        <div className="flex flex-col lg:flex-row items-center justify-center gap-12">
          {/* Swap UI Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>
            
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">兑换</h3>
              <div className="flex gap-3 text-slate-400">
                <button className="hover:text-white transition-colors"><Activity size={20} /></button>
                <button className="hover:text-white transition-colors"><Settings size={20} /></button>
              </div>
            </div>

            {/* From Input */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 mb-2 hover:border-slate-700 transition-colors">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>支付</span>
                <span>余额: 124,500 MM</span>
              </div>
              <div className="flex justify-between items-center">
                <input 
                  type="text" 
                  value={mmAmount}
                  onChange={handleMmChange}
                  className="bg-transparent text-3xl font-bold text-white outline-none w-1/2"
                  placeholder="0.0"
                />
                <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center text-cyan-400 text-xs font-bold">M</div>
                  <span className="font-bold">MM</span>
                </button>
              </div>
            </div>

            {/* Swap Icon */}
            <div className="flex justify-center -my-4 relative z-10">
              <button className="bg-slate-800 border-4 border-slate-900 p-2 rounded-xl hover:bg-slate-700 transition-colors text-slate-300">
                <ArrowDownUp size={20} />
              </button>
            </div>

            {/* To Input */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 mt-2 hover:border-slate-700 transition-colors">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>收到 (预估)</span>
                <span>余额: 12.50 USDT</span>
              </div>
              <div className="flex justify-between items-center">
                <input 
                  type="text" 
                  value={usdtAmount}
                  readOnly
                  className="bg-transparent text-3xl font-bold text-white outline-none w-1/2"
                  placeholder="0.0"
                />
                <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 text-xs font-bold">$</div>
                  <span className="font-bold">USDT</span>
                </button>
              </div>
            </div>

            {/* Exchange Rate Info */}
            <div className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>兑换比例</span>
                <span className="text-white">1000 MM = 1 USDT</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span className="flex items-center gap-1">滑点容差 <Info size={14}/></span>
                <span className="text-white">0.5%</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>网络费用</span>
                <span className="text-white">~$0.02</span>
              </div>
            </div>

            <button
              onClick={handleConnectWallet}
              disabled={isSubmitting}
              className="w-full mt-6 py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {walletAddress ? '钱包已连接' : '连接钱包'}
            </button>

            <button
              onClick={handleConfirmSwap}
              disabled={isSubmitting || !walletAddress}
              className="w-full mt-3 py-4 rounded-xl bg-cyan-500 text-slate-950 font-bold text-lg hover:bg-cyan-400 transition-colors shadow-[0_0_20px_-5px_rgba(6,182,212,0.5)] disabled:opacity-60"
            >
              确认链上兑换
            </button>

            <p className="mt-3 text-xs text-slate-400 break-all">{txStatus}</p>
          </motion.div>

          {/* Features Description */}
          <div className="flex-1 space-y-8 max-w-lg">
            {[
              { title: '去中心化流动性池', desc: '基于 Uniswap V3 协议的 AMM 机制，确保交易深度与价格发现，无需中心化撮合。' },
              { title: '智能合约自动执行', desc: '兑换逻辑全部写入区块链智能合约，代码开源且经过 CertiK 审计，杜绝人为作恶。' },
              { title: '无缝连接本地钱包', desc: 'App 内置的 TEE 硬件钱包直接签名授权，资产不经过任何第三方服务器，安全直达。' }
            ].map((item, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shrink-0">
                  <Wallet size={24} />
                </div>
                <div>
                  <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
