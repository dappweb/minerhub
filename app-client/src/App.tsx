import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [status, setStatus] = useState<string>('等待连接钱包');

  const shortAddress = useMemo(() => {
    if (!walletAddress) return '未连接';
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const mockConnectWallet = async () => {
    setStatus('钱包连接中...');
    await new Promise((resolve) => setTimeout(resolve, 600));
    const demoAddress = '0x9c2Ff52A2185f3eA7f7d6A1CE8D2940E42bAA123';
    setWalletAddress(demoAddress);
    setStatus('钱包已连接，可开始挖矿');
  };

  const mockStartMining = async () => {
    if (!walletAddress) {
      setStatus('请先连接钱包');
      return;
    }
    setStatus('提交链上挖矿交易中...');
    await new Promise((resolve) => setTimeout(resolve, 800));
    setStatus('挖矿交易已确认');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.card}>
        <Text style={styles.title}>MinerHub Mobile</Text>
        <Text style={styles.subtitle}>React Native Expo（Android / iOS 双端）</Text>

        <View style={styles.section}>
          <Text style={styles.label}>钱包地址</Text>
          <Text style={styles.value}>{shortAddress}</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={mockConnectWallet}>
          <Text style={styles.primaryBtnText}>{walletAddress ? '重新连接钱包' : '连接钱包'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={mockStartMining}>
          <Text style={styles.secondaryBtnText}>开始挖矿</Text>
        </TouchableOpacity>

        <Text style={styles.status}>{status}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    gap: 14,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
  },
  section: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#111827',
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 6,
  },
  value: {
    color: '#22d3ee',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryBtn: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: '#06b6d4',
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#082f49',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 12,
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
});
