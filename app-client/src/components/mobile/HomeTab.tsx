import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTab } from './BottomNav';
import s from './sharedStyles';

type Lang = 'en' | 'zh';

export interface HomeTabProps {
  displayId: string;
  expireDate: string;
  walletAddress: string;
  shortAddress: string;
  onlineState: string;
  identityReady: boolean;
  isBusy: boolean;
  contractExpired: boolean;
  totalOnlineMinutes: number;
  monthProgressMinutes: number;
  estimatedRewardUsdtPerDay: number;
  lang: Lang;
  guideCtaLabel: string;
  guideDescription: string;
  guideAction: () => void;
  setActiveTab: (tab: BottomTab) => void;
  onCopyAddress: () => void;
  copyState: 'idle' | 'copied' | 'failed';
  bnbBalance: string;
  superBalance: string;
  usdtBalance: string;
  t: {
    profileId: string;
    profileVip: string;
    homeOverview: string;
    profileExpire: string;
    notInit: string;
    short: string;
    phoneStatus: string;
    hashing: string;
    totalOnline: string;
    monthOnline: string;
    homePrimaryAction: string;
    tabEarnings: string;
    tabExchange: string;
    copyAddress: string;
    copied: string;
    copyFailed: string;
  };
}

function formatDuration(totalMinutes: number, lang: Lang) {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safe / 1440);
  const hours = Math.floor((safe % 1440) / 60);
  const minutes = safe % 60;
  if (lang === 'zh') return `${days}天${hours}小时${minutes}分`;
  return `${days}d ${hours}h ${minutes}m`;
}

export default function HomeTab({
  displayId,
  expireDate,
  walletAddress,
  shortAddress,
  onlineState,
  identityReady,
  isBusy,
  contractExpired,
  totalOnlineMinutes,
  monthProgressMinutes,
  estimatedRewardUsdtPerDay,
  lang,
  guideCtaLabel,
  guideDescription,
  guideAction,
  setActiveTab,
  onCopyAddress,
  copyState,
  t,
  bnbBalance,
  superBalance,
  usdtBalance,
}: HomeTabProps) {
  const copyLabel =
    copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : t.copyAddress;
  const stageText = !identityReady
    ? (lang === 'zh' ? '待完成身份同步' : 'Identity sync required')
    : contractExpired
      ? (lang === 'zh' ? '合同已到期，待续期' : 'Contract expired')
      : onlineState === (lang === 'zh' ? '在线' : 'Online')
        ? (lang === 'zh' ? '设备在线，正在累计收益' : 'Device online and earning')
        : (lang === 'zh' ? '设备待激活或暂时离线' : 'Device inactive or offline');
  const stageHint = !identityReady
    ? guideDescription
    : contractExpired
      ? (lang === 'zh' ? '续期后即可恢复收益累计与兑换操作。' : 'Renew to restore rewards and swaps.')
      : onlineState === (lang === 'zh' ? '在线' : 'Online')
        ? (lang === 'zh' ? '保持手机在线，收益会按在线时长累计。' : 'Keep the device online to continue accruing rewards.')
        : (lang === 'zh' ? '完成激活并保持设备在线，今日收益会开始增长。' : 'Activate and keep the device online to grow today\'s rewards.');

  return (
    <>
      <View style={styles.stageCard}>
        <View style={s.rowBetween}>
          <Text style={styles.stageLabel}>{lang === 'zh' ? '当前状态' : 'Current status'}</Text>
          <View style={[styles.dotPill, identityReady && !contractExpired ? styles.dotOnline : styles.dotOffline]}>
            <Text style={styles.dotPillText}>{onlineState}</Text>
          </View>
        </View>
        <Text style={styles.stageTitle}>{stageText}</Text>
        <Text style={styles.stageHint}>{stageHint}</Text>
        <View style={s.rowBetween}>
          <View style={styles.stageMetric}>
            <Text style={styles.stageMetricValue}>{estimatedRewardUsdtPerDay.toFixed(3)} USDT</Text>
            <Text style={styles.stageMetricLabel}>{lang === 'zh' ? '今日预计收益' : 'Estimated today'}</Text>
          </View>
          <View style={styles.stageMetric}>
            <Text style={styles.stageMetricValue}>{expireDate}</Text>
            <Text style={styles.stageMetricLabel}>{t.profileExpire}</Text>
          </View>
        </View>
      </View>

      <View style={styles.primaryActionCard}>
        <View style={s.rowBetween}>
          <View style={styles.primaryActionContent}>
            <Text style={styles.primaryActionLabel}>{t.homePrimaryAction}</Text>
            <Text style={styles.primaryActionTitle}>{guideCtaLabel}</Text>
            <Text style={styles.primaryActionHint}>{guideDescription}</Text>
          </View>
          <TouchableOpacity
            style={[styles.primaryActionBtn, (isBusy || contractExpired) && s.disabledBtn]}
            onPress={guideAction}
            disabled={isBusy || contractExpired}
          >
            <Text style={styles.primaryActionBtnText}>{guideCtaLabel}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => setActiveTab('earnings')}>
            <Text style={styles.secondaryActionText}>{t.tabEarnings}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryActionBtn} onPress={() => setActiveTab('exchange')}>
            <Text style={styles.secondaryActionText}>{t.tabExchange}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.metricsRow}>
        <View style={s.metricCard}>
          <Text style={s.metricValue}>{formatDuration(totalOnlineMinutes, lang)}</Text>
          <Text style={s.metricLabel}>{t.totalOnline}</Text>
        </View>
        <View style={s.metricCard}>
          <Text style={s.metricValue}>{formatDuration(monthProgressMinutes, lang)}</Text>
          <Text style={s.metricLabel}>{t.monthOnline}</Text>
        </View>
      </View>

      <View style={styles.profileCard}>
        <View style={s.rowBetween}>
          <View style={s.rowInline}>
            <Text style={styles.profileId}>{t.profileId}:{displayId}</Text>
            <Text style={styles.vipTag}>{t.profileVip}</Text>
          </View>
          <Text style={styles.unbindText}>{t.homeOverview}</Text>
        </View>
        <Text style={s.walletText}>{walletAddress || t.notInit}</Text>
        <View style={s.rowBetween}>
          <Text style={s.walletHint}>{t.short}{shortAddress}</Text>
          <TouchableOpacity
            onPress={onCopyAddress}
            disabled={!walletAddress}
            style={[styles.copyBtn, !walletAddress && s.disabledBtn, copyState === 'copied' && styles.copyBtnOk]}
          >
            <Text style={styles.copyBtnText}>{copyLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.machineCard}>
        {walletAddress ? (
          <View style={styles.balanceCard}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>BNB</Text>
              <Text style={styles.balanceValue}>{bnbBalance}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>SUPER</Text>
              <Text style={styles.balanceValue}>{superBalance}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>USDT</Text>
              <Text style={styles.balanceValue}>{usdtBalance}</Text>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  stageCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2f93db',
    backgroundColor: '#072a59',
    padding: 14,
    gap: 10,
  },
  stageLabel: {
    color: '#8fdcff',
    fontSize: 12,
    fontWeight: '700',
  },
  stageTitle: {
    color: '#f0fbff',
    fontSize: 22,
    fontWeight: '800',
  },
  stageHint: {
    color: '#b9e4ff',
    fontSize: 13,
    lineHeight: 19,
  },
  stageMetric: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#225b98',
    backgroundColor: '#0a376f',
    padding: 10,
    gap: 4,
  },
  stageMetricValue: {
    color: '#ecfeff',
    fontSize: 15,
    fontWeight: '800',
  },
  stageMetricLabel: {
    color: '#9dd4ff',
    fontSize: 11,
  },
  primaryActionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f7fb2',
    backgroundColor: '#083f63',
    padding: 14,
    gap: 12,
  },
  primaryActionContent: {
    flex: 1,
    gap: 5,
    paddingRight: 12,
  },
  primaryActionLabel: {
    color: '#7dd3fc',
    fontSize: 12,
    fontWeight: '700',
  },
  primaryActionTitle: {
    color: '#f0fbff',
    fontSize: 20,
    fontWeight: '800',
  },
  primaryActionHint: {
    color: '#c0ecff',
    fontSize: 12,
    lineHeight: 18,
  },
  primaryActionBtn: {
    alignSelf: 'center',
    borderRadius: 14,
    backgroundColor: '#22d3ee',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryActionBtnText: {
    color: '#083344',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f77bc',
    backgroundColor: '#0a315f',
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryActionText: {
    color: '#dbf4ff',
    fontSize: 12,
    fontWeight: '700',
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2d7bc4',
    backgroundColor: '#0b45a1',
    padding: 14,
    gap: 6,
  },
  machineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f97316',
    backgroundColor: '#1f1207',
    padding: 14,
    gap: 6,
  },
  machineLabel: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '700',
  },
  machineValue: {
    color: '#fff7ed',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  machineHint: {
    color: '#fed7aa',
    fontSize: 12,
  },
  profileId: {
    color: '#f0fbff',
    fontSize: 22,
    fontWeight: '800',
  },
  vipTag: {
    color: '#ffd6ee',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#7f1d63',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  unbindText: {
    color: '#d5f4ff',
    fontSize: 13,
    fontWeight: '600',
  },
  dotPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dotOnline: {
    backgroundColor: '#0f766e',
  },
  dotOffline: {
    backgroundColor: '#475569',
  },
  dotPillText: {
    color: '#ecfeff',
    fontSize: 12,
    fontWeight: '700',
  },
  copyBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
  },
  copyBtnOk: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  copyBtnText: {
    color: '#e8fbff',
    fontSize: 12,
    fontWeight: '700',
  },
  balanceCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    padding: 14,
    gap: 10,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#93a9d1',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
  },
});
