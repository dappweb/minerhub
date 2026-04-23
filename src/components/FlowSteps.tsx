import { BadgeCheck, BarChart3, Cpu, Link2 } from 'lucide-react';
import { motion } from 'motion/react';

const steps = [
  {
    icon: Link2,
    title: '身份同步与推荐人绑定',
    desc: '首次进入 App 先完成身份同步，并绑定推荐人钱包地址，确保账户可正常初始化。',
  },
  {
    icon: BadgeCheck,
    title: '机器码开通月卡',
    desc: '在首页查看机器码并提交给客服/管理员，完成月卡开通后再继续矿机激活。',
  },
  {
    icon: Cpu,
    title: '矿机设置与 Gas 准备',
    desc: '点击矿机设置完成链上注册；若提示 BNB 不足，请联系管理员充值 Gas。',
  },
  {
    icon: BarChart3,
    title: '保持在线开始累计收益',
    desc: '设备保持在线后，系统按在线时长累计收益，可在 App 内执行领取与兑换。',
  },
];

export default function FlowSteps() {
  return (
    <section className="py-18 bg-slate-950 border-y border-slate-800/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">4 步完成挖矿准备</h2>
          <p className="mt-3 text-slate-400 max-w-2xl">将“注册-开通-激活-在线”流程可视化，用户按步骤即可快速开始挖矿。</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
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
