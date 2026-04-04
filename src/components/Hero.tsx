import { motion } from 'motion/react';
import { Smartphone, Zap, Shield, Coins, Download } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-slate-950 to-slate-950"></div>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-sm font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            Android 挖矿客户端已发布
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-400"
          >
            这部手机会自己赚钱
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-xl text-slate-400 mb-10 leading-relaxed"
          >
            安装 Android 客户端，一键生成本地钱包。将手机从"消费电子"升级为"生产力工具"，利用闲置算力挖矿，随时随地兑换 USDT 收益。
          </motion.p>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button className="px-8 py-4 rounded-full bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition-colors shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] flex items-center gap-2">
              <Download size={20} />
              下载 Android 客户端
            </button>
            <button className="px-8 py-4 rounded-full bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors border border-slate-700">
              查看操作指南
            </button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-24 grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            { icon: Smartphone, title: 'Android 专属', desc: '一键安装，极简体验' },
            { icon: Zap, title: '智能挖矿', desc: '后台静默运行' },
            { icon: Shield, title: 'TEE安全', desc: '本地钱包私钥保护' },
            { icon: Coins, title: '一键兑换', desc: 'MM 随时兑换 USDT' },
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
