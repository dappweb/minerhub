import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface DeviceTabProps {
  onlineState: string;
  deviceId: string;
  hashrateDisplay: string;
  totalOnlineMinutes: number;
  monthProgressMinutes: number;
  lastSeenAt?: string | null;
  isBusy: boolean;
  identityReady: boolean;
  startMining: () => void;
  initializeAccount: () => void;
  t: {
    deviceSummary: string;
    phoneStatus: string;
    notInit: string;
    hashrate: string;
    hashrateLockedHint: string;
    setupMiner: string;
    syncIdentity: string;
  };
}

function formatDate(iso?: string | null): string {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export default function DeviceTab({
  onlineState,
  deviceId,
  hashrateDisplay,
  totalOnlineMinutes,
  monthProgressMinutes,
  lastSeenAt,
  isBusy,
  identityReady,
  startMining,
  initializeAccount,
  t,
}: DeviceTabProps) {
  const isZh = t.syncIdentity !== 'Sync Identity';
  const formatDuration = (minutes: number) => {
    const days = Math.floor(minutes / 1440);
    const hours = Math.floor((minutes % 1440) / 60);
    const mins = minutes % 60;
    return isZh ? `${days}天${hours}小时${mins}分` : `${days}d ${hours}h ${mins}m`;
  };

  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.deviceSummary}</Text>
        <View style={styles.statusCardCompact}>
          <Text style={s.metricLabel}>{t.phoneStatus}</Text>
          <Text style={s.metricValue}>{onlineState}</Text>
          <Text style={s.walletHint}>{deviceId || t.notInit}</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(totalOnlineMinutes)}</Text>
            <Text style={styles.summaryLabel}>{isZh ? '累计在线时长' : 'Total online time'}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{formatDuration(monthProgressMinutes)}</Text>
            <Text style={styles.summaryLabel}>{isZh ? '本月累计时长' : 'Current month time'}</Text>
          </View>
        </View>
        <Text style={s.label}>{t.hashrate}</Text>
        <View style={styles.readonlyHashrateBox}>
          <Text style={styles.readonlyHashrateValue}>{hashrateDisplay}</Text>
          <Text style={styles.readonlyHashrateHint}>{t.hashrateLockedHint}</Text>
        </View>
        <View style={styles.healthCard}>
          <Text style={styles.healthTitle}>{isZh ? '运行提示' : 'Run status'}</Text>
          <Text style={styles.healthText}>
            {identityReady
              ? (isZh ? `最近一次同步：${formatDate(lastSeenAt)}` : `Last sync: ${formatDate(lastSeenAt)}`)
              : (isZh ? '请先完成身份同步，再进行激活与在线累计。' : 'Complete identity sync before activation and online accrual.')}
          </Text>
          <Text style={styles.healthText}>
            {isZh
              ? '如果设备离线，收益会暂停累计；重新上线后会继续统计。'
              : 'If the device goes offline, rewards stop accruing until it reconnects.'}
          </Text>
        </View>
        <View style={s.quickRow}>
          <TouchableOpacity style={s.quickBtn} onPress={startMining} disabled={isBusy || !identityReady}>
            <Text style={s.quickBtnText}>{t.setupMiner}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.quickBtn} onPress={initializeAccount} disabled={isBusy}>
            <Text style={s.quickBtnText}>{t.syncIdentity}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  statusCardCompact: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 12,
    gap: 6,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0a244f',
    padding: 12,
    gap: 4,
  },
  summaryValue: {
    color: '#f0fdff',
    fontSize: 15,
    fontWeight: '800',
  },
  summaryLabel: {
    color: '#8ec4ff',
    fontSize: 11,
  },
  readonlyHashrateBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0a244f',
    padding: 12,
    gap: 4,
  },
  readonlyHashrateValue: {
    color: '#f0fdff',
    fontSize: 18,
    fontWeight: '800',
  },
  readonlyHashrateHint: {
    color: '#8ec4ff',
    fontSize: 12,
    lineHeight: 18,
  },
  healthCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 12,
    gap: 6,
  },
  healthTitle: {
    color: '#d7f3ff',
    fontSize: 12,
    fontWeight: '700',
  },
  healthText: {
    color: '#8ec4ff',
    fontSize: 12,
    lineHeight: 18,
  },
});
