import React, { useMemo, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { createClaim, createUser, registerDevice } from './services/api';
import { claimRewardOnChain, getWalletAddress, registerMinerOnChain, swapMmToUsdtOnChain } from './services/blockchain';

export default function App() {
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [mmAmount, setMmAmount] = useState<string>('10');
  const [status, setStatus] = useState<string>('等待连接钱包');

  const shortAddress = useMemo(() => {
    if (!walletAddress) return '未连接';
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  const connectWallet = async () => {
    setStatus('读取链上钱包中...');
    try {
      const address = getWalletAddress();
      setWalletAddress(address);
      const user = await createUser(address);
      setUserId(user.id);
      setStatus('钱包已连接，后台账户已创建');
    } catch (error) {
      const message = error instanceof Error ? error.message : '钱包连接失败';
      setStatus(`钱包初始化失败：${message}`);
    }
  };

  const startMining = async () => {
    if (!walletAddress || !userId) {
      setStatus('请先连接钱包并初始化账户');
      return;
    }
    setStatus('提交链上矿机注册中...');
    try {
      const deviceId = `mobile-${Date.now()}`;
      const txHash = await registerMinerOnChain(1000, deviceId);
      const device = await registerDevice({
        userId,
        deviceId,
        hashrate: 1000,
      });

      await createClaim({ userId, amount: '10' });
      setStatus(`链上矿机注册成功（${txHash.slice(0, 10)}...），设备ID ${device.id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '启动挖矿失败';
      setStatus(`启动挖矿失败：${message}`);
    }
  };

  const claimReward = async () => {
    setStatus('提交链上领取交易...');
    try {
      const txHash = await claimRewardOnChain();
      setStatus(`领取成功：${txHash.slice(0, 10)}...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '领取失败';
      setStatus(`领取失败：${message}`);
    }
  };

  const swapMm = async () => {
    setStatus('提交链上兑换交易...');
    try {
      const txHash = await swapMmToUsdtOnChain(mmAmount);
      setStatus(`兑换成功：${txHash.slice(0, 10)}...`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '兑换失败';
      setStatus(`兑换失败：${message}`);
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

        <TouchableOpacity style={styles.primaryBtn} onPress={connectWallet}>
          <Text style={styles.primaryBtnText}>{walletAddress ? '重新连接钱包' : '连接钱包'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={startMining}>
          <Text style={styles.secondaryBtnText}>开始挖矿</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={claimReward}>
          <Text style={styles.secondaryBtnText}>领取收益</Text>
        </TouchableOpacity>

        <View style={styles.swapBox}>
          <Text style={styles.label}>兑换 MM 数量</Text>
          <TextInput
            style={styles.input}
            value={mmAmount}
            onChangeText={setMmAmount}
            keyboardType="decimal-pad"
            placeholder="输入 MM 数量"
            placeholderTextColor="#475569"
          />
          <TouchableOpacity style={styles.secondaryBtn} onPress={swapMm}>
            <Text style={styles.secondaryBtnText}>兑换为 USDT</Text>
          </TouchableOpacity>
        </View>

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
  swapBox: {
    gap: 8,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#020617',
    color: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  status: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
});
