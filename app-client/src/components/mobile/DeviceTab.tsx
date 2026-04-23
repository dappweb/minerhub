import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ExchangeRequestDto } from '../../services/api';
import s from './sharedStyles';

export interface DeviceTabProps {
  onlineState: string;
  deviceId: string;
  hashrateDisplay: string;
  isBusy: boolean;
  identityReady: boolean;
  startMining: () => void;
  initializeAccount: () => void;
  exchangeOrders?: ExchangeRequestDto[];
  exchangeOrdersLoading?: boolean;
  onRefreshExchangeOrders?: () => void;
  t: {
    deviceSummary: string;
    phoneStatus: string;
    notInit: string;
    hashrate: string;
    hashrateLockedHint: string;
    setupMiner: string;
    syncIdentity: string;
    exchangeOrderHistoryTitle?: string;
    exchangeOrderStatus?: string;
    exchangeOrderCreatedAt?: string;
    exchangeOrderEmpty?: string;
    exchangeOrderMode?: string;
  };
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#38bdf8',
  completed: '#4ade80',
  failed: '#f87171',
  cancelled: '#94a3b8',
};

function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? '#94a3b8';
}

function formatDate(iso: string): string {
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
  isBusy,
  identityReady,
  startMining,
  initializeAccount,
  exchangeOrders = [],
  exchangeOrdersLoading = false,
  onRefreshExchangeOrders,
  t,
}: DeviceTabProps) {
  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.deviceSummary}</Text>
        <View style={styles.statusCardCompact}>
          <Text style={s.metricLabel}>{t.phoneStatus}</Text>
          <Text style={s.metricValue}>{onlineState}</Text>
          <Text style={s.walletHint}>{deviceId || t.notInit}</Text>
        </View>
        <Text style={s.label}>{t.hashrate}</Text>
        <View style={styles.readonlyHashrateBox}>
          <Text style={styles.readonlyHashrateValue}>{hashrateDisplay}</Text>
          <Text style={styles.readonlyHashrateHint}>{t.hashrateLockedHint}</Text>
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

      {/* 兑换交易记录 */}
      <View style={s.actionCard}>
        <View style={styles.orderHeaderRow}>
          <Text style={s.sectionTitle}>{t.exchangeOrderHistoryTitle ?? '兑换记录'}</Text>
          {onRefreshExchangeOrders && (
            <TouchableOpacity onPress={onRefreshExchangeOrders} style={styles.refreshBtn}>
              <Text style={styles.refreshBtnText}>↻</Text>
            </TouchableOpacity>
          )}
        </View>
        {exchangeOrdersLoading ? (
          <Text style={styles.orderEmpty}>加载中…</Text>
        ) : exchangeOrders.length === 0 ? (
          <Text style={styles.orderEmpty}>{t.exchangeOrderEmpty ?? '暂无兑换记录'}</Text>
        ) : (
          <ScrollView style={styles.orderList} nestedScrollEnabled>
            {exchangeOrders.map((item) => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderTopRow}>
                  <Text style={styles.orderAmount}>{item.amountSuper} SUPER → {item.amountUsdt} USDT</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '33', borderColor: statusColor(item.status) }]}>
                    <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.orderMeta}>
                  {t.exchangeOrderCreatedAt ?? '时间'}: {formatDate(item.createdAt)}
                </Text>
                {item.completedAt && (
                  <Text style={styles.orderMeta}>完成: {formatDate(item.completedAt)}</Text>
                )}
                {item.txHash && (
                  <Text style={styles.orderTxHash} numberOfLines={1} ellipsizeMode="middle">
                    TxHash: {item.txHash}
                  </Text>
                )}
                <Text style={styles.orderMeta}>
                  {t.exchangeOrderMode ?? '模式'}: {item.mode}
                  {item.note ? `  |  ${item.note}` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
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
  orderHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  refreshBtn: {
    padding: 4,
  },
  refreshBtnText: {
    color: '#38bdf8',
    fontSize: 18,
  },
  orderList: {
    maxHeight: 380,
  },
  orderEmpty: {
    color: '#8ec4ff',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  orderItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e4070',
    backgroundColor: '#0b2045',
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  orderAmount: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  orderMeta: {
    color: '#7dd3fc',
    fontSize: 11,
    lineHeight: 16,
  },
  orderTxHash: {
    color: '#64748b',
    fontSize: 10,
    lineHeight: 14,
    fontFamily: 'monospace',
  },
});
