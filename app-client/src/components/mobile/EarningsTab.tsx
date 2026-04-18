import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface EarningsTabProps {
  totalRewardUsdt: number;
  totalRewardSuper: number;
  isBusy: boolean;
  identityReady: boolean;
  chartValues: number[];
  chartMax: number;
  claimReward: () => void;
  t: {
    rewardsSummary: string;
    claimReward: string;
    quote: string;
    earningsChart: string;
    chartYAxis: string;
    ruleHint: string;
  };
}

export default function EarningsTab({
  totalRewardUsdt,
  totalRewardSuper,
  isBusy,
  identityReady,
  chartValues,
  chartMax,
  claimReward,
  t,
}: EarningsTabProps) {
  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.rewardsSummary}</Text>
        <View style={s.metricsRow}>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(totalRewardUsdt) ? totalRewardUsdt.toFixed(3) : '0.000'} USDT</Text>
            <Text style={s.metricLabel}>{t.claimReward}</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricValue}>{Number.isFinite(totalRewardSuper) ? totalRewardSuper.toFixed(3) : '0.000'} SUPER</Text>
            <Text style={s.metricLabel}>{t.quote}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.secondaryBtn, (isBusy || !identityReady) && s.disabledBtn]} onPress={claimReward} disabled={isBusy || !identityReady}>
          <Text style={s.secondaryBtnText}>{t.claimReward}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chartCard}>
        <Text style={s.sectionTitle}>{t.earningsChart}</Text>
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
  chartCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2554',
    padding: 14,
    gap: 10,
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
});
