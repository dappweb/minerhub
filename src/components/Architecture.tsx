import { motion } from 'motion/react';
import { Smartphone, Server, Database, ShieldCheck, Wallet } from 'lucide-react';

export default function Architecture() {
  return (
    <section id="architecture" className="py-24 bg-slate-900/30 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">商业闭环与系统架构</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">三层架构设计，确保挖矿效率、资产安全与生态流转。</p>
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-cyan-500/0 -translate-y-1/2 hidden md:block"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
            {/* 硬件层 */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <Smartphone className="text-cyan-400" />
                <h3 className="text-xl font-bold">硬件层</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">手机设备</div>
                    <div className="text-sm text-slate-400">专属散热与定制调度</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">TEE安全芯片</div>
                    <div className="text-sm text-slate-400">硬件级私钥隔离保护</div>
                  </div>
                </li>
              </ul>
            </motion.div>

            {/* 软件层 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="bg-slate-950 p-8 rounded-3xl border border-cyan-500/30 shadow-[0_0_30px_-10px_rgba(6,182,212,0.2)] relative"
            >
              <div className="absolute -top-3 -right-3 w-6 h-6 bg-cyan-500 rounded-full animate-ping opacity-20"></div>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <Server className="text-cyan-400" />
                <h3 className="text-xl font-bold">软件层</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">挖矿引擎</div>
                    <div className="text-sm text-slate-400">后台静默运行，MM代币产出</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">设备指纹绑定</div>
                    <div className="text-sm text-slate-400">防作弊与唯一性验证</div>
                  </div>
                </li>
              </ul>
            </motion.div>

            {/* 金融层 */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="bg-slate-950 p-8 rounded-3xl border border-slate-800 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <Database className="text-cyan-400" />
                <h3 className="text-xl font-bold">金融层</h3>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">链上确权与钱包</div>
                    <div className="text-sm text-slate-400">资产归属验证与管理</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-2"></div>
                  <div>
                    <div className="font-medium">兑换中心</div>
                    <div className="text-sm text-slate-400">USDT变现与提现通道</div>
                  </div>
                </li>
              </ul>
            </motion.div>
          </div>
        </div>

        <div className="mt-16 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-2xl p-6 border border-cyan-500/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <ShieldCheck className="text-cyan-400 w-10 h-10" />
            <div>
              <div className="font-bold text-lg">用户价值</div>
              <div className="text-slate-400">手机成本回收周期 8-24个月，年化补贴 10-40%</div>
            </div>
          </div>
          <div className="hidden md:block w-px h-12 bg-slate-700"></div>
          <div className="flex items-center gap-4">
            <Wallet className="text-blue-400 w-10 h-10" />
            <div>
              <div className="font-bold text-lg">厂商价值</div>
              <div className="text-slate-400">硬件溢价 + 用户粘性 + 生态数据</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
