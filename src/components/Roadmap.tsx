import { motion } from 'motion/react';
import { Flag, Rocket, Globe } from 'lucide-react';

export default function Roadmap() {
  const milestones = [
    {
      icon: Flag,
      phase: 'MVP 阶段',
      time: '第 1-2 个月',
      title: '功能验证',
      items: ['合约安全审计完成', '单机型试点运行', '1000名种子测试用户入驻']
    },
    {
      icon: Rocket,
      phase: '量产阶段',
      time: '第 3-4 个月',
      title: '规模出货',
      items: ['多机型系统适配', '产线软硬件集成', '首批5万台设备发售']
    },
    {
      icon: Globe,
      phase: '生态阶段',
      time: '第 5-12 个月',
      title: '生态建设',
      items: ['DEX去中心化交易所上线', '治理DAO成立', '突破百万用户，实现盈亏平衡']
    }
  ];

  return (
    <section className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">实施里程碑</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">清晰的发展路径，确保项目稳步推进与生态繁荣。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* 连接线 */}
          <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-0.5 bg-slate-800 z-0"></div>

          {milestones.map((milestone, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="w-24 h-24 rounded-full bg-slate-900 border-4 border-slate-950 shadow-[0_0_0_2px_rgba(30,41,59,1)] flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 rounded-full bg-cyan-500/10 animate-pulse"></div>
                <milestone.icon size={32} className={index === 1 ? 'text-cyan-400' : 'text-slate-400'} />
              </div>
              
              <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 w-full">
                <div className="text-cyan-400 font-bold text-sm mb-1">{milestone.time}</div>
                <h3 className="text-xl font-bold mb-1">{milestone.phase}</h3>
                <div className="text-slate-400 font-medium mb-4 pb-4 border-b border-slate-800/50">{milestone.title}</div>
                <ul className="space-y-2 text-sm text-slate-300 text-left">
                  {milestone.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 mt-1.5 shrink-0"></div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
