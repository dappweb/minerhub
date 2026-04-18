import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface DeviceTabProps {
  onlineState: string;
  deviceId: string;
  hashrateInput: string;
  setHashrateInput: (v: string) => void;
  isBusy: boolean;
  identityReady: boolean;
  startMining: () => void;
  initializeAccount: () => void;
  t: {
    deviceSummary: string;
    phoneStatus: string;
    notInit: string;
    hashrate: string;
    hashratePlaceholder: string;
    setupMiner: string;
    syncIdentity: string;
  };
}

export default function DeviceTab({
  onlineState,
  deviceId,
  hashrateInput,
  setHashrateInput,
  isBusy,
  identityReady,
  startMining,
  initializeAccount,
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
        <TextInput
          style={s.input}
          value={hashrateInput}
          onChangeText={setHashrateInput}
          keyboardType="number-pad"
          placeholder={t.hashratePlaceholder}
          placeholderTextColor="#93a9d1"
          editable={!isBusy}
        />
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
});
