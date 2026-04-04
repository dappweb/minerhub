import { Check, X } from 'lucide-react';

export default function Comparison() {
  const data = [
    { feature: '安全性', traditional: '无', software: '软件级（易攻击）', minerhub: '硬件TEE（金融级）' },
    { feature: '便捷性', traditional: '无', software: '需下载配置', minerhub: '开机即用，后台自动' },
    { feature: '成本', traditional: '无', software: '耗电高、效率低', minerhub: '系统级优化，成本最低' },
    { feature: '收益保障', traditional: '无', software: '无保底', minerhub: '官方池保底+市场双通道' },
    { feature: '资产归属', traditional: '无', software: '平台控制', minerhub: '私钥自持，链上确权' },
    { feature: '二手价值', traditional: '折旧', software: '无', minerhub: '挖矿权可转让，残值+' },
  ];

  return (
    <section id="comparison" className="py-24 bg-slate-900/30 border-y border-slate-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">差异化竞争力</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">降维打击传统手机与纯软件挖矿模式。</p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-slate-900/80 border-b border-slate-800">
                  <th className="py-5 px-6 font-medium text-slate-300 w-1/4">对比维度</th>
                  <th className="py-5 px-6 font-medium text-slate-500 w-1/4">传统手机</th>
                  <th className="py-5 px-6 font-medium text-slate-500 w-1/4">软件挖矿App</th>
                  <th className="py-5 px-6 font-bold text-cyan-400 w-1/4 bg-cyan-950/20">MinerHub 方案</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-900/30 transition-colors">
                    <td className="py-4 px-6 font-medium text-slate-300">{row.feature}</td>
                    <td className="py-4 px-6 text-slate-500 flex items-center gap-2">
                      {row.traditional === '无' ? <X size={16} className="text-slate-600" /> : null}
                      {row.traditional}
                    </td>
                    <td className="py-4 px-6 text-slate-400">{row.software}</td>
                    <td className="py-4 px-6 font-bold text-cyan-300 bg-cyan-950/10 flex items-center gap-2">
                      <Check size={18} className="text-cyan-500" />
                      {row.minerhub}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
