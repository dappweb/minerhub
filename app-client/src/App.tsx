import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { createClaim, createUser, registerDevice } from './services/api';

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
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
    try {
      const user = await createUser(demoAddress);
      setUserId(user.id);
      setStatus('钱包已连接，后台账户已创建');
    } catch (error) {
      const message = error instanceof Error ? error.message : '创建用户失败';
      setStatus(`钱包已连接，但后台初始化失败：${message}`);
    }
  };

  const mockStartMining = async () => {
    if (!walletAddress || !userId) {
      setStatus('请先连接钱包并初始化账户');
      return;
    }
    setStatus('提交矿机注册中...');
    try {
      const device = await registerDevice({
        userId,
        deviceId: `mobile-${Date.now()}`,
        hashrate: 1000,
      });

      await createClaim({ userId, amount: '10' });
      setStatus(`矿机注册成功（${device.id}），已创建收益记录`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动挖矿失败';
      setStatus(`启动挖矿失败：${message}`);
    }
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

        <View style={styles.section}>
          <Text style={styles.label}>后台用户ID</Text>
          <Text style={styles.value}>{userId || '未初始化'}</Text>
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
