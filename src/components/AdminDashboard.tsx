import { motion } from 'motion/react';
import { Users, Smartphone, Activity, Search, ShieldAlert, CheckCircle2, LayoutDashboard, Database, Ban } from 'lucide-react';

export default function AdminDashboard() {
  const mockDevices = [
    { id: 'DEV-8A92F1', user: 'user_77x9a', model: 'MinerHub Pro', hashrate: '15.4 MH/s', status: 'active', time: '2 mins ago' },
    { id: 'DEV-3B44E2', user: 'user_21b4c', model: 'MinerHub Std', hashrate: '8.2 MH/s', status: 'active', time: '5 mins ago' },
    { id: 'DEV-9C11D5', user: 'user_99y2m', model: 'MinerHub Pro', hashrate: '0.0 MH/s', status: 'offline', time: '2 hours ago' },
    { id: 'DEV-5F88A3', user: 'user_44z1k', model: 'MinerHub Ltd', hashrate: '22.1 MH/s', status: 'active', time: '1 min ago' },
    { id: 'DEV-2A77B9', user: 'user_11x5p', model: 'MinerHub Std', hashrate: '---', status: 'banned', time: '1 day ago' },
  ];

  return (
    <section id="admin-dashboard" className="py-24 bg-slate-900/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-sm font-medium mb-6"
          >
            B端赋能
          </motion.div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">管理员后台与设备管理</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            为品牌方和运营团队提供强大的设备与账号管理后台，实时监控全网算力、设备状态与防作弊风控。
          </p>
        </div>

        {/* Dashboard Mockup */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-slate-950 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          {/* Sidebar */}
          <div className="w-full md:w-64 bg-slate-900/50 border-r border-slate-800 p-6 hidden md:block">
            <div className="flex items-center gap-2 mb-10 text-white">
              <LayoutDashboard className="text-purple-400" />
              <span className="font-bold text-lg">MinerHub Admin</span>
            </div>
            <nav className="space-y-2">
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-500/10 text-purple-400 font-medium border border-purple-500/20">
                <Smartphone size={18} /> 设备管理
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Users size={18} /> 用户账号
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Activity size={18} /> 全网算力
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <Database size={18} /> 资金池监控
              </a>
              <a href="#" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                <ShieldAlert size={18} /> 风控中心
              </a>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 md:p-8">
            {/* Top Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: '在线设备数', value: '42,105', trend: '+12%', color: 'text-green-400' },
                { label: '全网总算力', value: '645.2 GH/s', trend: '+5.4%', color: 'text-cyan-400' },
                { label: '今日产出 (MM)', value: '12.5M', trend: '稳定', color: 'text-blue-400' },
                { label: '异常设备预警', value: '24', trend: '-3', color: 'text-red-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-slate-900 rounded-2xl p-4 border border-slate-800">
                  <div className="text-slate-400 text-sm mb-2">{stat.label}</div>
                  <div className={`text-2xl font-bold ${stat.color} mb-1`}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.trend}</div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
              <h3 className="text-xl font-bold">设备实时监控</h3>
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="搜索设备ID或用户账号..." 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <button className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-700">
                  筛选
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">设备 ID (指纹)</th>
                    <th className="px-4 py-3 font-medium">绑定账号</th>
                    <th className="px-4 py-3 font-medium">机型</th>
                    <th className="px-4 py-3 font-medium">实时算力</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {mockDevices.map((dev, i) => (
                    <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-300">{dev.id}</td>
                      <td className="px-4 py-3 text-cyan-400">{dev.user}</td>
                      <td className="px-4 py-3 text-slate-400">{dev.model}</td>
                      <td className="px-4 py-3 font-medium">{dev.hashrate}</td>
                      <td className="px-4 py-3">
                        {dev.status === 'active' && <span className="inline-flex items-center gap-1.5 text-green-400 bg-green-400/10 px-2 py-1 rounded-md text-xs"><CheckCircle2 size={12}/> 在线</span>}
                        {dev.status === 'offline' && <span className="inline-flex items-center gap-1.5 text-slate-400 bg-slate-800 px-2 py-1 rounded-md text-xs"><Activity size={12}/> 离线</span>}
                        {dev.status === 'banned' && <span className="inline-flex items-center gap-1.5 text-red-400 bg-red-400/10 px-2 py-1 rounded-md text-xs"><Ban size={12}/> 封禁</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-slate-400 hover:text-white mr-3 transition-colors">详情</button>
                        <button className="text-red-400 hover:text-red-300 transition-colors">封禁</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
