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
  lang: Lang;
  guideCtaLabel: string;
  guideAction: () => void;
  setActiveTab: (tab: BottomTab) => void;
  onCopyAddress: () => void;
  copyState: 'idle' | 'copied' | 'failed';
  machineCode: string;
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
    machineCodeTitle: string;
    machineCodeHint: string;
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
  lang,
  guideCtaLabel,
  guideAction,
  setActiveTab,
  onCopyAddress,
  copyState,
  machineCode,
  t,
}: HomeTabProps) {
  const copyLabel =
    copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : t.copyAddress;
  return (
    <>
      <View style={styles.profileCard}>
        <View style={s.rowBetween}>
          <View style={s.rowInline}>
            <Text style={styles.profileId}>{t.profileId}:{displayId}</Text>
            <Text style={styles.vipTag}>{t.profileVip}</Text>
          </View>
          <Text style={styles.unbindText}>{t.homeOverview}</Text>
        </View>
        <Text style={s.profileExpire}>{t.profileExpire}: {expireDate}</Text>
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
        <Text style={styles.machineLabel}>{t.machineCodeTitle}</Text>
        <Text style={styles.machineValue}>{machineCode}</Text>
        <Text style={styles.machineHint}>{t.machineCodeHint}</Text>
      </View>

      <View style={styles.statusCard}>
        <View style={s.rowBetween}>
          <Text style={styles.statusTitle}>{t.phoneStatus}</Text>
          <View style={[styles.dotPill, identityReady ? styles.dotOnline : styles.dotOffline]}>
            <Text style={styles.dotPillText}>{onlineState}</Text>
          </View>
        </View>
        <Text style={styles.hashingText}>{t.hashing}</Text>
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

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.homePrimaryAction}</Text>
        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} onPress={guideAction} disabled={isBusy || contractExpired}>
            <Text style={s.quickBtnText}>{guideCtaLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => setActiveTab('earnings')}>
            <Text style={s.quickBtnText}>{t.tabEarnings}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={() => setActiveTab('exchange')}>
            <Text style={s.quickBtnText}>{t.tabExchange}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1f4f96',
    backgroundColor: '#08306f',
    padding: 14,
    gap: 8,
  },
  statusTitle: {
    color: '#e6f4ff',
    fontSize: 19,
    fontWeight: '700',
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
  hashingText: {
    color: '#b8ecff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 8,
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
});
