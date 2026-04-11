import { motion } from 'motion/react';
import { Link2, Cpu, BarChart3 } from 'lucide-react';

const steps = [
  {
    icon: Link2,
    title: '连接钱包并完成校验',
    desc: '通过 RainbowKit 连接钱包，系统会自动校验 owner 权限。',
  },
  {
    icon: Cpu,
    title: '注册矿工并同步算力',
    desc: '完成设备注册后，算力与状态会写入链上并持续更新。',
  },
  {
    icon: BarChart3,
    title: '查看实时收益与风控',
    desc: '在数据面板里查看待领取、累计发放和风险评分。',
  },
];

export default function FlowSteps() {
  return (
    <section className="py-18 bg-slate-950 border-y border-slate-800/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">3 步完成上链运营</h2>
          <p className="mt-3 text-slate-400 max-w-2xl">把 onboarding 变成可验证的链上流程，而不是黑盒后台。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
              className="rounded-2xl border border-slate-800 bg-slate-900/55 p-6"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300 mb-4">
                <step.icon size={22} />
              </div>
              <p className="text-xs tracking-wider text-cyan-300/80 mb-2">STEP {index + 1}</p>
              <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
