import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface EarningsTabProps {
  marketTrend: string;
  marketRisk: string;
  marketHint: string;
  totalRewardUsdt: number;
  totalRewardSuper: number;
  todayRewardUsdt: number;
  claimableRewardUsdt: number;
  rewardTokenSymbol: string;
  rewardRatePerHour: number;
  rewardRateDailyChange: number;
  isBusy: boolean;
  identityReady: boolean;
  chartValues: number[];
  chartMax: number;
  claimReward: () => void;
  t: {
    marketStatusTitle: string;
    marketTrendLabel: string;
    marketRiskLabel: string;
    rewardTokenTitle: string;
    totalRewardLabel: string;
    todayRewardLabel: string;
    claimableRewardLabel: string;
    yieldRateTitle: string;
    rewardRatePerHourLabel: string;
    rewardRateDailyChangeLabel: string;
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
  totalRewardUsdt,
  totalRewardSuper,
  todayRewardUsdt,
  claimableRewardUsdt,
  rewardTokenSymbol,
  rewardRatePerHour,
  rewardRateDailyChange,
  isBusy,
  identityReady,
  chartValues,
  chartMax,
  claimReward,
  t,
}: EarningsTabProps) {
  const dailyChangePositive = rewardRateDailyChange >= 0;

  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.marketStatusTitle}</Text>
        <View style={styles.statusGrid}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>{t.marketTrendLabel}</Text>
            <Text style={styles.statusValue}>{marketTrend}</Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>{t.marketRiskLabel}</Text>
            <Text style={styles.statusValue}>{marketRisk}</Text>
          </View>
        </View>
        <Text style={styles.marketHint}>{marketHint}</Text>
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.rewardTokenTitle}</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(totalRewardUsdt) ? totalRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
            <Text style={s.metricLabel}>{t.totalRewardLabel}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(totalRewardSuper) ? totalRewardSuper.toFixed(3) : '0.000'} {rewardTokenSymbol}</Text>
            <Text style={s.metricLabel}>{t.quote}</Text>
          </View>
        </View>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(todayRewardUsdt) ? todayRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
            <Text style={s.metricLabel}>{t.todayRewardLabel}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(claimableRewardUsdt) ? claimableRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
            <Text style={s.metricLabel}>{t.claimableRewardLabel}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.secondaryBtn, (isBusy || !identityReady) && s.disabledBtn]} onPress={claimReward} disabled={isBusy || !identityReady}>
          <Text style={s.secondaryBtnText}>{t.claimReward}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.yieldRateTitle}</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(rewardRatePerHour) ? rewardRatePerHour.toFixed(4) : '0.0000'} USDT/h</Text>
            <Text style={s.metricLabel}>{t.rewardRatePerHourLabel}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={[s.metricValue, dailyChangePositive ? styles.changeUp : styles.changeDown]}>
              {dailyChangePositive ? '+' : ''}{Number.isFinite(rewardRateDailyChange) ? rewardRateDailyChange.toFixed(2) : '0.00'}%
            </Text>
            <Text style={s.metricLabel}>{t.rewardRateDailyChangeLabel}</Text>
          </View>
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
    </>
  );
}

const styles = StyleSheet.create({
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
  changeUp: {
    color: '#22d3ee',
  },
  changeDown: {
    color: '#fb7185',
  },
});
