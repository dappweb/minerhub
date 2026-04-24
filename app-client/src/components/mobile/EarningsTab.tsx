import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface EarningsTabProps {
  marketTrend: string;
  marketRisk: string;
  marketHint: string;
  configuredRewardRateUsdtPerHour: number;
  effectiveRewardRateUsdtPerHour: number;
  estimatedRewardUsdtPerDay: number;
  totalRewardUsdt: number;
  totalRewardSuper: number;
  todayRewardUsdt: number;
  yesterdayRewardUsdt: number;
  claimableRewardUsdt: number;
  rewardTokenSymbol: string;
  lockCycleDays: number;
  lockRemainingDays: number | null;
  lockStatusText: string;
  totalOnlineMinutes: number;
  monthProgressMinutes: number;
  isBusy: boolean;
  identityReady: boolean;
  chartValues: number[];
  chartMax: number;
  recentRewards: Array<{
    rewardUsdt: number;
    source: string;
    createdAt: string;
  }>;
  claimReward: () => void;
  t: {
    marketStatusTitle: string;
    marketTrendLabel: string;
    marketRiskLabel: string;
    yieldRateTitle: string;
    configuredYieldRateLabel: string;
    effectiveYieldRateLabel: string;
    estimatedDailyRewardLabel: string;
    rewardTokenTitle: string;
    totalRewardLabel: string;
    todayRewardLabel: string;
    claimableRewardLabel: string;
    lockCycleLabel: string;
    lockRemainingLabel: string;
    lockStatusLabel: string;
    earningsCurveTitle: string;
    range7dLabel: string;
    rewardsSummary: string;
    claimReward: string;
    quote: string;
    earningsChart: string;
    chartYAxis: string;
    ruleHint: string;
  };
}

export default function EarningsTab({
  marketTrend,
  marketRisk,
  marketHint,
  configuredRewardRateUsdtPerHour,
  effectiveRewardRateUsdtPerHour,
  estimatedRewardUsdtPerDay,
  totalRewardUsdt,
  totalRewardSuper,
  todayRewardUsdt,
  yesterdayRewardUsdt,
  claimableRewardUsdt,
  rewardTokenSymbol,
  lockCycleDays,
  lockRemainingDays,
  lockStatusText,
  totalOnlineMinutes,
  monthProgressMinutes,
  isBusy,
  identityReady,
  chartValues,
  chartMax,
  recentRewards,
  claimReward,
  t,
}: EarningsTabProps) {
  const isZh = t.claimReward !== 'Claim Reward';
  const onlineHoursToday = Math.min(24, monthProgressMinutes % 1440 / 60);
  const missedRewardUsdt = Math.max(0, estimatedRewardUsdtPerDay - todayRewardUsdt);
  const formatDuration = (minutes: number) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return isZh ? `${days}天${hours}小时${mins}分` : `${days}d ${hours}h ${mins}m`;
  };

  return (
    <>
      <View style={s.actionCard}>
        <Text style={styles.heroLabel}>{isZh ? '收益总览' : 'Reward overview'}</Text>
        <Text style={styles.heroValue}>{Number.isFinite(claimableRewardUsdt) ? claimableRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
        <Text style={styles.heroHint}>
          {isZh
            ? `当前可领取，今日已累计 ${todayRewardUsdt.toFixed(3)} USDT。`
            : `Available to claim now, with ${todayRewardUsdt.toFixed(3)} USDT earned today.`}
        </Text>
        <View style={styles.heroMetaRow}>
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaLabel}>{t.totalRewardLabel}</Text>
            <Text style={styles.heroMetaValue}>{Number.isFinite(totalRewardUsdt) ? totalRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
          </View>
          <View style={styles.heroMetaItem}>
            <Text style={styles.heroMetaLabel}>{t.estimatedDailyRewardLabel}</Text>
            <Text style={styles.heroMetaValue}>{Number.isFinite(estimatedRewardUsdtPerDay) ? estimatedRewardUsdtPerDay.toFixed(3) : '0.000'} USDT</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.claimBtn, (isBusy || !identityReady) && s.disabledBtn]} onPress={claimReward} disabled={isBusy || !identityReady}>
          <Text style={styles.claimBtnText}>{t.claimReward}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{isZh ? '收益变化说明' : 'Why rewards changed'}</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{onlineHoursToday.toFixed(1)}h</Text>
            <Text style={s.metricLabel}>{isZh ? '今日在线时长估算' : 'Estimated online today'}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Math.max(0, todayRewardUsdt - yesterdayRewardUsdt).toFixed(3)} USDT</Text>
            <Text style={s.metricLabel}>{isZh ? '较昨日新增' : 'Increase vs yesterday'}</Text>
          </View>
        </View>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{missedRewardUsdt.toFixed(3)} USDT</Text>
            <Text style={s.metricLabel}>{isZh ? '离线少赚估算' : 'Estimated missed reward'}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{lockRemainingDays == null ? '--' : `${lockRemainingDays}d`}</Text>
            <Text style={s.metricLabel}>{t.lockRemainingLabel}</Text>
          </View>
        </View>
        <View style={styles.explainCard}>
          <Text style={styles.explainLine}>
            {isZh ? `设备累计在线 ${formatDuration(totalOnlineMinutes)}。` : `Device total online time: ${formatDuration(totalOnlineMinutes)}.`}
          </Text>
          <Text style={styles.explainLine}>
            {isZh ? `${marketTrend} / ${marketRisk}，${marketHint}` : `${marketTrend} / ${marketRisk}. ${marketHint}`}
          </Text>
          <Text style={styles.explainLine}>
            {isZh ? `合同状态：${lockStatusText}` : `Contract status: ${lockStatusText}`}
          </Text>
        </View>
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.yieldRateTitle}</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(configuredRewardRateUsdtPerHour) ? configuredRewardRateUsdtPerHour.toFixed(3) : '0.000'} USDT/h</Text>
            <Text style={s.metricLabel}>{t.configuredYieldRateLabel}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(effectiveRewardRateUsdtPerHour) ? effectiveRewardRateUsdtPerHour.toFixed(3) : '0.000'} USDT/h</Text>
            <Text style={s.metricLabel}>{t.effectiveYieldRateLabel}</Text>
          </View>
        </View>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(totalRewardSuper) ? totalRewardSuper.toFixed(3) : '0.000'} {rewardTokenSymbol}</Text>
            <Text style={s.metricLabel}>{t.quote}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{lockCycleDays} {lockCycleDays > 1 ? 'days' : 'day'}</Text>
            <Text style={s.metricLabel}>{t.lockCycleLabel}</Text>
          </View>
        </View>
        <View style={styles.lockStatusRow}>
          <Text style={styles.lockStatusLabel}>{t.lockStatusLabel}</Text>
          <Text style={styles.lockStatusValue}>{lockStatusText}</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={s.sectionTitle}>{t.earningsCurveTitle}</Text>
          <Text style={styles.rangeTag}>{t.range7dLabel}</Text>
        </View>
        <Text style={styles.chartAxis}>{t.chartYAxis}</Text>
        <View style={styles.chartBars}>
          {chartValues.map((item, idx) => (
            <View key={`${item}-${idx}`} style={styles.barWrap}>
              <View style={[styles.chartBar, { height: Math.max(12, (item / chartMax) * 120) }]} />
            </View>
          ))}
        </View>
        <Text style={styles.ruleHint}>{t.ruleHint}</Text>
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{isZh ? '近期收益记录' : 'Recent reward records'}</Text>
        {recentRewards.length === 0 ? (
          <Text style={styles.recentEmpty}>
            {isZh ? '暂时还没有收益记录，设备保持在线后会逐步显示。' : 'No reward records yet. Keep the device online and records will appear here.'}
          </Text>
        ) : (
          recentRewards.map((item, index) => (
            <View key={`${item.createdAt}-${index}`} style={styles.recentItem}>
              <View style={styles.recentItemTop}>
                <Text style={styles.recentItemValue}>+{item.rewardUsdt.toFixed(3)} USDT</Text>
                <Text style={styles.recentItemTime}>
                  {new Date(item.createdAt).toLocaleString(isZh ? 'zh-CN' : 'en-US')}
                </Text>
              </View>
              <Text style={styles.recentItemMeta}>
                {isZh ? `来源：${item.source || 'system'}` : `Source: ${item.source || 'system'}`}
              </Text>
            </View>
          ))
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  heroLabel: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
  },
  heroValue: {
    color: '#effbff',
    fontSize: 30,
    fontWeight: '900',
  },
  heroHint: {
    color: '#b8dcff',
    fontSize: 13,
    lineHeight: 18,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroMetaItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2a63',
    padding: 10,
    gap: 4,
  },
  heroMetaLabel: {
    color: '#9ec8ff',
    fontSize: 11,
  },
  heroMetaValue: {
    color: '#effbff',
    fontSize: 15,
    fontWeight: '800',
  },
  claimBtn: {
    borderRadius: 12,
    backgroundColor: '#22d3ee',
    paddingVertical: 12,
    alignItems: 'center',
  },
  claimBtnText: {
    color: '#083344',
    fontSize: 15,
    fontWeight: '800',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statusItem: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#0d2a63',
    borderWidth: 1,
    borderColor: '#2a5ea8',
    padding: 10,
    gap: 6,
  },
  statusLabel: {
    color: '#8ec4ff',
    fontSize: 12,
  },
  statusValue: {
    color: '#effbff',
    fontSize: 15,
    fontWeight: '800',
  },
  marketHint: {
    color: '#9ec8ff',
    fontSize: 12,
    lineHeight: 18,
  },
  explainCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 10,
    gap: 6,
  },
  explainLine: {
    color: '#d7f3ff',
    fontSize: 12,
    lineHeight: 18,
  },
  recentEmpty: {
    color: '#9ec8ff',
    fontSize: 12,
    lineHeight: 18,
  },
  recentItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 10,
    gap: 4,
  },
  recentItemTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recentItemValue: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '800',
  },
  recentItemTime: {
    color: '#8ec4ff',
    fontSize: 10,
  },
  recentItemMeta: {
    color: '#b8dcff',
    fontSize: 11,
  },
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2554',
    padding: 14,
    gap: 10,
  },
  chartHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeTag: {
    color: '#d6ecff',
    fontSize: 11,
    borderWidth: 1,
    borderColor: '#3f77bc',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#12386f',
  },
  chartAxis: {
    color: '#9cc6ff',
    fontSize: 11,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    height: 126,
    paddingTop: 4,
  },
  barWrap: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#0a1a3d',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    backgroundColor: '#38bdf8',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  ruleHint: {
    color: '#9ec8ff',
    fontSize: 12,
    lineHeight: 18,
  },
  lockStatusRow: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  lockStatusLabel: {
    color: '#9ec8ff',
    fontSize: 12,
  },
  lockStatusValue: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '700',
  },
});
