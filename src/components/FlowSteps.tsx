import { BadgeCheck, BarChart3, Cpu, Link2 } from 'lucide-react';
import { motion } from 'motion/react';

const steps = [
  {
    icon: Link2,
    title: '完成注册与推荐人绑定',
    desc: '首次打开 App 先完成身份同步，并填写推荐人钱包，系统会为你建立账户身份。',
  },
  {
    icon: BadgeCheck,
    title: '提交机器码开通服务',
    desc: '在首页复制机器码并提交开通申请，开通成功后就能进入设备激活阶段。',
  },
  {
    icon: Cpu,
    title: '激活设备开始运行',
    desc: '点击矿机设置完成激活；如果网络费不足，系统会提示你申请支持。',
  },
  {
    icon: BarChart3,
    title: '保持在线并领取收益',
    desc: '设备在线后会持续累计收益，你可以在 App 内查看进度、领取并发起兑换。',
  },
];

export default function FlowSteps() {
  return (
    <section className="py-18 bg-slate-950 border-y border-slate-800/40">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">4 步完成开通并开始收益</h2>
          <p className="mt-3 text-slate-400 max-w-2xl">把“注册、开通、激活、收益”做成一条清晰路径，让用户从下载到开始累计收益更顺滑。</p>
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
