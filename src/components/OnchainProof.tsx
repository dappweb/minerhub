import { useEffect, useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import { getGlobalStatsOnChain, getMiningPoolAddress, type MiningPoolGlobalStats } from '../lib/blockchain';

function formatHashrate(hashrate: bigint): string {
  const mh = Number(hashrate) / 1000;
  if (!Number.isFinite(mh)) {
    return '--';
  }
  return `${mh.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} MH/s`;
}

function formatSuper(amount: bigint): string {
  const superValue = Number(formatUnits(amount, 18));
  if (!Number.isFinite(superValue)) {
    return '--';
  }
  return superValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function OnchainProof() {
  const [stats, setStats] = useState<MiningPoolGlobalStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const poolAddress = getMiningPoolAddress();

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!poolAddress) {
        setLoading(false);
        return;
      }
      try {
        const result = await getGlobalStatsOnChain();
        if (active) {
          setStats(result);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [poolAddress]);

  const cards = useMemo(() => {
    return [
      {
        label: '注册矿工数',
        value: stats ? stats.totalMiners.toString() : loading ? '同步中...' : '--',
      },
      {
        label: '全网活跃算力',
        value: stats ? formatHashrate(stats.totalActiveHashrate) : loading ? '同步中...' : '--',
      },
      {
        label: '累计发放 SUPER',
        value: stats ? formatSuper(stats.totalEmitted) : loading ? '同步中...' : '--',
      },
    ];
  }, [loading, stats]);

  return (
    <section className="py-16 bg-slate-950">
      <div className="max-w-7xl mx-auto px-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/45 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold">链上数据背书</h2>
              <p className="mt-2 text-slate-400">关键运营指标直接读取 MiningPool 合约，而非本地静态数据。</p>
            </div>
            <p className="text-xs text-slate-500 break-all">
              数据来源: {poolAddress || '未配置 VITE_MINING_POOL_ADDRESS'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cards.map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-slate-400 text-sm">{item.label}</p>
                <p className="mt-3 text-2xl font-bold text-cyan-300">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
