import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import s from './sharedStyles';

export interface ProfileTabProps {
  walletAddress: string;
  expireDate: string;
  contractExpired: boolean;
  transferTo: string;
  setTransferTo: (v: string) => void;
  transferAmount: string;
  setTransferAmount: (v: string) => void;
  isBusy: boolean;
  identityReady: boolean;
  transferNativeToken: () => void;
  t: {
    profileSummary: string;
    walletCardTitle: string;
    notInit: string;
    profileExpire: string;
    contractExpiredTitle: string;
    contractExpiredBody: string;
    advancedSettings: string;
    transferTitle: string;
    transferTo: string;
    transferAmount: string;
    sendTransfer: string;
  };
}

export default function ProfileTab({
  walletAddress,
  expireDate,
  contractExpired,
  transferTo,
  setTransferTo,
  transferAmount,
  setTransferAmount,
  isBusy,
  identityReady,
  transferNativeToken,
  t,
}: ProfileTabProps) {
  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.profileSummary}</Text>
        <Text style={s.metricLabel}>{t.walletCardTitle}</Text>
        <Text style={s.walletText}>{walletAddress || t.notInit}</Text>
        <Text style={s.profileExpire}>{t.profileExpire}: {expireDate}</Text>
        {contractExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerTitle}>{t.contractExpiredTitle}</Text>
            <Text style={styles.expiredBannerBody}>{t.contractExpiredBody}</Text>
          </View>
        )}
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.advancedSettings}</Text>
        <Text style={s.label}>{t.transferTitle}</Text>
        <TextInput
          style={s.input}
          value={transferTo}
          onChangeText={setTransferTo}
          placeholder={t.transferTo}
          placeholderTextColor="#93a9d1"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isBusy}
        />
        <TextInput
          style={s.input}
          value={transferAmount}
          onChangeText={setTransferAmount}
          keyboardType="decimal-pad"
          placeholder={t.transferAmount}
          placeholderTextColor="#93a9d1"
          editable={!isBusy}
        />
        <TouchableOpacity style={s.secondaryBtn} onPress={transferNativeToken} disabled={isBusy || !identityReady}>
          <Text style={s.secondaryBtnText}>{t.sendTransfer}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  expiredBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#3f0d17',
    padding: 10,
    gap: 4,
    marginTop: 6,
  },
  expiredBannerTitle: {
    color: '#ffe4e6',
    fontSize: 13,
    fontWeight: '800',
  },
  expiredBannerBody: {
    color: '#fecdd3',
    fontSize: 12,
    lineHeight: 18,
  },
});
