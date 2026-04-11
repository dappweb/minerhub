import { Coins, DollarSign, Activity } from 'lucide-react';

export default function Economics() {
  return (
    <section id="economics" className="py-24 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">经济模型与收益预估</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            SUPER 与 USDT 双资产模型，兼顾矿工激励和稳定结算。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-16">
          <div>
            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <Coins className="text-cyan-400" />
              双资产机制
            </h3>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 flex items-center justify-center font-bold text-cyan-400 shrink-0">
                  S
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">SUPER</h4>
                  <p className="text-slate-400 text-sm mb-2">用途：挖矿产出和生态激励</p>
                  <p className="text-slate-500 text-sm">来源：链上挖矿与协议激励分配</p>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-green-400 shrink-0">
                  <DollarSign size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-lg mb-1">USDT</h4>
                  <p className="text-slate-400 text-sm mb-2">用途：稳定结算与提现</p>
                  <p className="text-slate-500 text-sm">来源：Swap 池兑换和外部流动性</p>
                </div>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-2xl bg-blue-900/10 border border-blue-500/20">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <Activity size={18} className="text-blue-400" />
                兑换保障逻辑
              </h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex justify-between border-b border-slate-800 pb-2">
                  <span>目标锚定</span>
                  <span className="font-medium text-white">1000 SUPER ≈ 1 USDT</span>
                </li>
                <li className="flex justify-between border-b border-slate-800 pb-2 pt-2">
                  <span>市场价格</span>
                  <span className="font-medium text-white">由 AMM 流动池实时形成</span>
                </li>
                <li className="flex justify-between pt-2">
                  <span>滑点控制</span>
                  <span className="font-medium text-white">前端最小到手量保护</span>
                </li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="text-2xl font-bold mb-6">机型收益预估</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-4 px-4 font-medium">机型</th>
                    <th className="py-4 px-4 font-medium">日收益预估</th>
                    <th className="py-4 px-4 font-medium">年化区间</th>
                    <th className="py-4 px-4 font-medium">回本周期</th>
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
                    <td className="py-4 px-4 font-medium">Pro 版</td>
                    <td className="py-4 px-4 text-cyan-400">$1.0 - $2.0</td>
                    <td className="py-4 px-4">$365 - $730</td>
                    <td className="py-4 px-4 text-slate-400">约 12 个月</td>
                  </tr>
                  <tr className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-4 font-medium text-amber-400">旗舰版</td>
                    <td className="py-4 px-4 text-cyan-400 font-bold">$2.0 - $4.0</td>
                    <td className="py-4 px-4 font-bold">$730 - $1460</td>
                    <td className="py-4 px-4 text-amber-400/80">约 6 个月</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
              以上为示例性估算，实际收益受网络难度、活跃设备数量和链上兑换价格影响。
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
