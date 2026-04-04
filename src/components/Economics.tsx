import { Coins, DollarSign, Activity } from 'lucide-react';

export default function Economics() {
  return (
    <section id="economics" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">经济模型与收益预估</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">双代币机制保障系统稳定，多机型差异化收益。</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          {/* 双代币机制 */}
          <div>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Coins className="text-cyan-400" />
              双代币机制
            </h3>
            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 shrink-0">
                  MM
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">Miner Token (MM)</h4>
                  <p className="text-slate-400 text-sm mb-2">用途：挖矿产出，可兑换USDT</p>
                  <p className="text-slate-500 text-sm">来源：手机算力贡献持续产出</p>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-green-400 shrink-0">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">USDT</h4>
                  <p className="text-slate-400 text-sm mb-2">用途：稳定币结算，可直接提现</p>
                  <p className="text-slate-500 text-sm">来源：官方兑付池或DEX市场兑换</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-blue-900/10 border border-blue-500/20">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Activity size={18} className="text-blue-400" />
                兑付保障体系
              </h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <span>官方池</span>
                  <span className="font-medium text-white">固定汇率保底 (1000 MM = 1 USDT)</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2 pt-2">
                  <span>市场池</span>
                  <span className="font-medium text-white">Uniswap浮动汇率，无上限</span>
                </li>
                <li className="flex justify-between pt-2">
                  <span>准备金</span>
                  <span className="font-medium text-white">种子期$50K → 成熟期$1M+</span>
                </li>
              </ul>
            </div>
          </div>

          {/* 收益预估 */}
          <div>
            <h3 className="text-2xl font-bold mb-6">机型收益预估</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-4 px-4 font-medium">机型</th>
                    <th className="py-4 px-4 font-medium">日收益预估</th>
                    <th className="py-4 px-4 font-medium">年化收益</th>
                    <th className="py-4 px-4 font-medium">成本回收期</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-4 font-medium">标准版</td>
                    <td className="py-4 px-4 text-cyan-400">$0.5 - $1.0</td>
                    <td className="py-4 px-4">$180 - $365</td>
                    <td className="py-4 px-4 text-slate-400">约 18 个月</td>
                  </tr>
                  <tr className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-4 font-medium">Pro版</td>
                    <td className="py-4 px-4 text-cyan-400">$1.0 - $2.0</td>
                    <td className="py-4 px-4">$365 - $730</td>
                    <td className="py-4 px-4 text-slate-400">约 12 个月</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-4 font-medium text-amber-400">限量款</td>
                    <td className="py-4 px-4 text-cyan-400 font-bold">$2.0 - $4.0</td>
                    <td className="py-4 px-4 font-bold">$730 - $1460</td>
                    <td className="py-4 px-4 text-amber-400/80">约 6 个月</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
              * 收益数据基于当前网络难度与代币模型测算，实际收益可能随全网算力波动。官方保底机制确保最低收益下限。
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
