import { ArrowRight, CheckCircle2, Coins, Gauge, Shield, Smartphone, WalletCards, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import BscBadge from './BscBadge';

const setupItems = [
  '身份同步',
  '账号开通',
  '激活设备',
  '收益在线',
];

export default function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-800/60 bg-slate-950 pt-28 pb-16 sm:pt-32 lg:min-h-[calc(100vh-4rem)] lg:pb-20">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(240,185,11,0.12),transparent_32%),linear-gradient(180deg,rgba(15,23,42,0),rgba(2,6,23,0.94)_82%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] [background-size:64px_64px]" />
      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex flex-wrap items-center gap-3"
            >
              <BscBadge />
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-sm font-medium text-cyan-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-500" />
                </span>
                Android / iOS 挖矿客户端已发布
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
            >
              手机即节点，链上即收益
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-10 text-lg leading-8 text-slate-300 sm:text-xl"
            >
              下载 App 后按“身份同步 → 完成账号开通 → 激活设备 → 保持在线”完成准备流程。
              基于 <span className="font-semibold text-[#F0B90B]">BNB Smart Chain</span> 的 SUPER 生态会将收益、兑换与团队数据统一沉淀到手机端。
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col gap-3 sm:flex-row sm:flex-wrap"
            >
              <a href="#download" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-7 py-4 font-bold text-slate-950 shadow-[0_0_30px_-5px_rgba(6,182,212,0.5)] transition-colors hover:bg-cyan-400">
                下载 App 开始使用
                <ArrowRight size={18} />
              </a>
              <a href="#flow-steps" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-7 py-4 font-medium text-white transition-colors hover:bg-slate-700">
                查看开通流程
              </a>
              <a href="#quick-entry" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/15 px-7 py-4 font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/25">
                管理员进入后台
                <ArrowRight size={18} />
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4"
            >
              {[
                { value: '4 步', label: '开通路径' },
                { value: 'BEP-20', label: 'SUPER 资产' },
                { value: 'BSC', label: '链上结算' },
                { value: 'App', label: '移动端管理' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                  <p className="text-lg font-bold text-cyan-300">{item.value}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mx-auto w-full max-w-[410px] lg:ml-auto"
          >
            <div className="relative rounded-[2rem] border border-slate-700 bg-slate-900/80 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur-sm">
              <div className="rounded-[1.5rem] border border-slate-800 bg-slate-950 p-5">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500 text-slate-950">
                      <Smartphone size={21} />
                    </div>
                    <div>
                      <p className="font-bold text-white">Coin Planet App</p>
                      <p className="text-xs text-slate-500">设备开通进度</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">Online</span>
                </div>

                <div className="mb-5 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm text-cyan-200">
                    <Gauge size={16} />
                    当前算力
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-4xl font-bold text-white">15.4</p>
                    <p className="pb-1 text-sm font-semibold text-cyan-300">MH/s</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {setupItems.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                      <CheckCircle2 size={18} className={index < 3 ? 'text-emerald-300' : 'text-cyan-300'} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-100">{item}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
                          <div className={`h-full rounded-full ${index < 3 ? 'w-full bg-emerald-400' : 'w-2/3 bg-cyan-400'}`} />
                        </div>
                      </div>
                      <span className="text-xs text-slate-500">0{index + 1}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                      <WalletCards size={14} />
                      SUPER
                    </div>
                    <p className="text-lg font-bold text-white">124,500</p>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                      <Coins size={14} />
                      USDT
                    </div>
                    <p className="text-lg font-bold text-white">124.50</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-4"
        >
          {[
            { icon: Smartphone, title: '上手明确', desc: '首页直接告诉用户下一步该做什么' },
            { icon: Zap, title: '收益闭环', desc: '激活设备后即可持续累计收益' },
            { icon: Shield, title: '流程透明', desc: '兑换与收益进度都可持续追踪' },
            { icon: Coins, title: '移动优先', desc: '团队、收益、订单都在 App 内查看' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-5 backdrop-blur-sm">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <item.icon size={24} />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-slate-400">{item.desc}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
