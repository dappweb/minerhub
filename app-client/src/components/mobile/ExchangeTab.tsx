import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

type ActionType = 'init' | 'mine' | 'claim' | 'swap' | 'transfer' | 'gas' | '';
type SwapTxStage = 'idle' | 'submitting' | 'confirming' | 'success' | 'failed';

export interface ExchangeTabProps {
  swapAmount: string;
  setSwapAmount: (v: string) => void;
  swapPriceText: string;
  estimatedSuper: number;
  feeUsdt: number;
  minReceiveSuper: number;
  isBusy: boolean;
  identityReady: boolean;
  swapTxStage: SwapTxStage;
  gasFundedBnbTotal: string;
  phase2IntentId: string;
  refreshSwapPrice: () => void;
  openSwapConfirm: () => void;
  openGasAssist: (actionName: ActionType, retryAction: () => Promise<void>, message?: string) => void;
  txStageLabels: {
    submitting: string;
    confirming: string;
    success: string;
    failed: string;
  };
  t: {
    swapPanelTitle: string;
    refreshPrice: string;
    swapAmount: string;
    swapAmountPlaceholder: string;
    quote: string;
    fee: string;
    minReceive: string;
    swapButton: string;
    txProgressTitle: string;
    gasAssistTitle: string;
    gasBalanceLabel: string;
    gasBuyAndRetry: string;
  };
}

export default function ExchangeTab({
  swapAmount,
  setSwapAmount,
  swapPriceText,
  estimatedSuper,
  feeUsdt,
  minReceiveSuper,
  isBusy,
  identityReady,
  swapTxStage,
  gasFundedBnbTotal,
  phase2IntentId,
  refreshSwapPrice,
  openSwapConfirm,
  openGasAssist,
  txStageLabels,
  t,
}: ExchangeTabProps) {
  return (
    <>
      <View style={styles.swapCard}>
        <View style={s.rowBetween}>
          <Text style={s.sectionTitle}>{t.swapPanelTitle}</Text>
          <TouchableOpacity onPress={refreshSwapPrice} disabled={isBusy}>
            <Text style={styles.refreshText}>{t.refreshPrice}</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.label}>{t.swapAmount}</Text>
        <TextInput
          style={s.input}
          value={swapAmount}
          onChangeText={setSwapAmount}
          keyboardType="decimal-pad"
          placeholder={t.swapAmountPlaceholder}
          placeholderTextColor="#93a9d1"
          editable={!isBusy}
        />

        <Text style={styles.hint}>{swapPriceText}</Text>

        <View style={styles.previewBox}>
          <View style={s.rowBetween}>
            <Text style={styles.previewLabel}>{t.quote}</Text>
            <Text style={styles.previewValue}>{estimatedSuper.toFixed(6)} SUPER</Text>
          </View>
          <View style={s.rowBetween}>
            <Text style={styles.previewLabel}>{t.fee}</Text>
            <Text style={styles.previewValue}>{feeUsdt.toFixed(6)} USDT</Text>
          </View>
          <View style={s.rowBetween}>
            <Text style={styles.previewLabel}>{t.minReceive}</Text>
            <Text style={styles.previewValue}>{minReceiveSuper.toFixed(6)} SUPER</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primarySwapBtn, (isBusy || !identityReady) && s.disabledBtn]}
          onPress={openSwapConfirm}
          disabled={isBusy || !identityReady}
        >
          <Text style={styles.primarySwapBtnText}>{t.swapButton}</Text>
        </TouchableOpacity>

        {swapTxStage !== 'idle' && (
          <View style={styles.txStageCard}>
            <Text style={styles.txStageTitle}>{t.txProgressTitle}</Text>
            <View style={styles.txStageRow}>
              <View style={styles.txStageItem}>
                <View style={[styles.txDot, styles.txDotActive]} />
                <Text style={styles.txStageText}>{txStageLabels.submitting}</Text>
              </View>
              <View style={[styles.txStageLine, (swapTxStage === 'confirming' || swapTxStage === 'success' || swapTxStage === 'failed') && styles.txStageLineActive]} />
              <View style={styles.txStageItem}>
                <View
                  style={[
                    styles.txDot,
                    (swapTxStage === 'confirming' || swapTxStage === 'success' || swapTxStage === 'failed') && styles.txDotActive,
                  ]}
                />
                <Text style={styles.txStageText}>{txStageLabels.confirming}</Text>
              </View>
              <View style={[styles.txStageLine, (swapTxStage === 'success' || swapTxStage === 'failed') && styles.txStageLineActive]} />
              <View style={styles.txStageItem}>
                <View
                  style={[
                    styles.txDot,
                    (swapTxStage === 'success' || swapTxStage === 'failed') && (swapTxStage === 'success' ? styles.txDotSuccess : styles.txDotFailed),
                  ]}
                />
                <Text style={styles.txStageText}>
                  {swapTxStage === 'failed' ? txStageLabels.failed : txStageLabels.success}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.gasAssistTitle}</Text>
        <View style={styles.gasInfoBox}>
          <Text style={styles.gasInfoText}>{t.gasBalanceLabel}: {gasFundedBnbTotal} BNB</Text>
          {!!phase2IntentId && <Text style={styles.gasInfoHint}>Intent: {phase2IntentId.slice(0, 16)}...</Text>}
          <TouchableOpacity
            style={[s.secondaryBtn, !identityReady && s.disabledBtn]}
            onPress={() => openGasAssist('gas', async () => Promise.resolve())}
            disabled={!identityReady || isBusy}
          >
            <Text style={s.secondaryBtnText}>{t.gasBuyAndRetry}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  swapCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#36a7ff',
    backgroundColor: '#0a3a7f',
    padding: 14,
    gap: 10,
  },
  refreshText: {
    color: '#d6f6ff',
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    color: '#b8dcff',
    fontSize: 12,
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#072f67',
    padding: 10,
    gap: 8,
  },
  previewLabel: {
    color: '#b7dbff',
    fontSize: 12,
  },
  previewValue: {
    color: '#f0fdff',
    fontSize: 13,
    fontWeight: '700',
  },
  primarySwapBtn: {
    borderRadius: 12,
    backgroundColor: '#22d3ee',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  primarySwapBtnText: {
    color: '#083344',
    fontSize: 16,
    fontWeight: '800',
  },
  txStageCard: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4aa8ff',
    backgroundColor: '#072f67',
    padding: 10,
    gap: 10,
  },
  txStageTitle: {
    color: '#d7f3ff',
    fontSize: 12,
    fontWeight: '700',
  },
  txStageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txStageItem: {
    alignItems: 'center',
    gap: 4,
    width: 82,
  },
  txDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#31557f',
  },
  txDotActive: {
    backgroundColor: '#38bdf8',
  },
  txDotSuccess: {
    backgroundColor: '#22c55e',
  },
  txDotFailed: {
    backgroundColor: '#ef4444',
  },
  txStageLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#31557f',
    marginHorizontal: 4,
  },
  txStageLineActive: {
    backgroundColor: '#38bdf8',
  },
  txStageText: {
    color: '#b7dbff',
    fontSize: 11,
    textAlign: 'center',
  },
  gasInfoBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#315d95',
    backgroundColor: '#0b2d60',
    padding: 10,
    gap: 8,
  },
  gasInfoText: {
    color: '#cde8ff',
    fontSize: 12,
    fontWeight: '700',
  },
  gasInfoHint: {
    color: '#8dc6ff',
    fontSize: 11,
  },
});
