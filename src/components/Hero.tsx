import { ArrowRight, Coins, Shield, Smartphone, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import BscBadge from './BscBadge';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#F0B90B]/15 via-slate-950 to-slate-950"></div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-3 mb-8"
          >
            <BscBadge />
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
              </span>
              Android / iOS 挖矿客户端已发布
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#FCD535] via-white to-[#22D3EE]"
          >
            手机即节点，链上即收益
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-slate-400 mb-10 leading-relaxed"
          >
            基于 <span className="text-[#F0B90B] font-semibold">BNB Smart Chain</span> 的 SUPER (BEP-20) 挖矿生态。连接管理员钱包后可直接进入数据面板，实时查看矿工状态、全网算力与链上收益发放。
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <a href="#quick-entry" className="px-8 py-4 rounded-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] inline-flex items-center gap-2">
              连接钱包进入后台
              <ArrowRight size={18} />
            </a>
            <a href="#download" className="px-8 py-4 rounded-full bg-green-600 text-white font-bold hover:bg-green-500 transition-colors shadow-[0_0_30px_-5px_rgba(34,197,94,0.5)] inline-flex items-center gap-2">
              立即下载应用
              <ArrowRight size={18} />
            </a>
            <a href="#flow-steps" className="px-8 py-4 rounded-full bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors border border-slate-700 inline-flex items-center gap-2">
              查看上手流程
            </a>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { icon: Smartphone, title: '双端兼容', desc: 'Android / iOS 一致体验' },
            { icon: Zap, title: '智能挖矿', desc: '后台静默运行' },
            { icon: Shield, title: 'TEE 安全', desc: '本地钱包私钥保护' },
            { icon: Coins, title: '一键兑换', desc: 'SUPER 随时兑换 USDT' },
          ].map((item, i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">
                <item.icon size={24} />
              </div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

