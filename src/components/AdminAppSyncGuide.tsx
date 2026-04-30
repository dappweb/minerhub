import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  RefreshCw,
  Server,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { motion } from 'motion/react';

const timeline = [
  {
    step: '01',
    appTitle: '用户先完成身份同步',
    appText: 'App 会生成钱包身份、用户 ID 和本机设备 ID。',
    adminTitle: '后台等待出现用户',
    adminText: '管理员用钱包地址核对用户，确认不是给错账号操作。',
    syncText: 'users + customer_profiles 建立用户档案。',
    icon: UserCheck,
  },
  {
    step: '02',
    appTitle: '用户点击矿机设置',
    appText: 'App 注册矿机，并把设备编号和算力同步到后台。',
    adminTitle: '后台看到设备上线',
    adminText: '设备列表出现该用户矿机，状态可从离线变为在线。',
    syncText: 'devices 写入 device_id、hashrate、status。',
    icon: Smartphone,
  },
  {
    step: '03',
    appTitle: 'App 显示等待激活',
    appText: '用户不用重复注册，只需要等待后台开通。',
    adminTitle: '管理员点击激活',
    adminText: '把用户状态改为已激活，让系统允许收益累计。',
    syncText: 'contract_active = 1，activation_status = active。',
    icon: ShieldCheck,
  },
  {
    step: '04',
    appTitle: '用户刷新 App',
    appText: 'App 读取最新合约和月卡到期时间。',
    adminTitle: '管理员开通或续费月卡',
    adminText: '月卡到期时间必须是未来时间，最好同步合约到期时间。',
    syncText: 'monthly_card_end_at / contract_end_at 更新到未来。',
    icon: CreditCard,
  },
  {
    step: '05',
    appTitle: 'App 保持在线',
    appText: '在线心跳持续上报，收益开始按在线时间累计。',
    adminTitle: '后台观察在线和收益',
    adminText: '管理员可查看最近同步时间、在线状态和收益流水。',
    syncText: 'heartbeat 更新 last_seen_at，并写入 reward_ledger。',
    icon: Activity,
  },
];

const unlockChecks = [
  '手机安装的是最新 APK',
  '身份同步已完成',
  '矿机设备已注册',
  '后台已激活用户',
  '月卡或合约仍在有效期内',
];

const troubleshooting = [
  {
    title: '后台看到矿机，手机仍提示锁定',
    reason: '常见原因是手机还在用旧 App，旧版本只看合约到期时间，没有正确识别月卡时间。',
    fix: '重新下载安装最新版 APK，然后在 App 里点身份同步并刷新。',
  },
  {
    title: '管理员已续费，但用户没有恢复',
    reason: '可能续费到了另一个钱包账号，或只改了设备状态，没有激活用户合约。',
    fix: '用用户手机钱包地址核对后台用户，确认 contractActive 为 1，月卡到期时间是未来。',
  },
  {
    title: '显示在线，但收益没有增长',
    reason: '在线状态只说明心跳正常，收益还需要用户已激活且月卡未过期。',
    fix: '检查用户详情里的 contractActive、monthlyCardEndAt、设备 status 三项。',
  },
];

export default function AdminAppSyncGuide() {
  return (
    <section id="sync-guide" className="border-y border-slate-800/70 bg-slate-950 py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-end">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-sm font-semibold text-cyan-200">
              <RefreshCw size={14} />
              管理员和 App 用户怎么配合
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              一张图看懂：从注册矿机到月卡生效
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              用户在 App 里完成身份同步和矿机设置，管理员在后台完成激活和月卡续费。两边不是两套流程，而是在同一个用户账号上接力完成。
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <CheckCircle2 size={16} />
              App 解锁需要同时满足
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {unlockChecks.map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-12 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/45">
          <div className="grid grid-cols-[0.6fr_1fr_1fr_1fr] border-b border-slate-800 bg-slate-900/90 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
            <div>步骤</div>
            <div>App 用户看到</div>
            <div>管理员要做</div>
            <div>系统同步结果</div>
          </div>

          {timeline.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="grid gap-4 border-b border-slate-800/80 px-4 py-5 last:border-b-0 md:grid-cols-[0.6fr_1fr_1fr_1fr]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-200">
                  <item.icon size={18} />
                </div>
                <div className="text-sm font-bold text-cyan-200">STEP {item.step}</div>
              </div>

              <div>
                <div className="mb-1 text-sm font-bold text-white">{item.appTitle}</div>
                <p className="text-sm leading-6 text-slate-400">{item.appText}</p>
              </div>

              <div>
                <div className="mb-1 text-sm font-bold text-white">{item.adminTitle}</div>
                <p className="text-sm leading-6 text-slate-400">{item.adminText}</p>
              </div>

              <div className="rounded-lg border border-slate-700/70 bg-slate-950/55 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-cyan-300">
                  <Server size={13} />
                  自动写入后台数据
                </div>
                <p className="text-sm leading-6 text-slate-300">{item.syncText}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {troubleshooting.map((item) => (
            <div key={item.title} className="rounded-lg border border-amber-400/25 bg-amber-400/8 p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-amber-200">
                <AlertTriangle size={17} />
                {item.title}
              </div>
              <p className="mb-3 text-sm leading-6 text-slate-300">
                <span className="font-semibold text-slate-100">原因：</span>
                {item.reason}
              </p>
              <p className="text-sm leading-6 text-slate-300">
                <span className="font-semibold text-slate-100">处理：</span>
                {item.fix}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-lg border border-cyan-400/25 bg-cyan-400/10 p-5">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-200">
            <ClipboardCheck size={17} />
            管理员核对口诀
          </div>
          <p className="text-sm leading-7 text-slate-200">
            先核对钱包地址，再看设备是否存在，最后确认用户已激活、月卡未过期。只要这四项一致，App 刷新后就会恢复正常运行。
          </p>
        </div>
      </div>
    </section>
  );
}
