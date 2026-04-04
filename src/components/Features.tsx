import { motion } from 'motion/react';
import { Cpu, Lock, RefreshCw, Users, TrendingUp } from 'lucide-react';

export default function Features() {
  const features = [
    {
      icon: Cpu,
      title: '智能挖矿',
      desc: '后台运行、智能调度、温度保护。零操作成本，完全不影响手机日常使用体验。'
    },
    {
      icon: Lock,
      title: '硬件钱包',
      desc: 'TEE隔离、私钥不出设备、防Root。提供金融级安全保障，资产绝对安全。'
    },
    {
      icon: RefreshCw,
      title: '一键兑换',
      desc: '官方保底池 + DEX市场双通道。即时变现，汇率透明，随时随地提取收益。'
    },
    {
      icon: Users,
      title: '社交裂变',
      desc: '邀请码、战队系统、排行榜。享受收益加成，打造游戏化挖矿体验。'
    },
    {
      icon: TrendingUp,
      title: '成长体系',
      desc: '等级权益、NFT徽章、治理权。长期激励机制，增强用户身份认同与粘性。'
    }
  ];

  return (
    <section id="features" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">核心功能模块</h2>
          <p className="text-slate-400 max-w-2xl">围绕用户体验与资产安全，打造完整的软硬件一体化挖矿生态。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="p-8 rounded-3xl bg-gradient-to-b from-slate-900 to-slate-900/50 border border-slate-800 hover:border-cyan-500/30 transition-colors group"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-cyan-400 mb-6 group-hover:scale-110 transition-transform">
                <feature.icon size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
