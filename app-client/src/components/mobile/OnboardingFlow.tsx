import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export type OnboardingLang = 'en' | 'zh';

type OnboardingFlowProps = {
  visible: boolean;
  lang: OnboardingLang;
  machineCode: string;
  onComplete: (referralWallet: string) => void;
};

const COPY = {
  en: {
    step: 'Step',
    of: 'of',
    next: 'Next',
    back: 'Back',
    finish: 'Start Earning',
    s1Title: 'Welcome to Coin Planet',
    s1Body:
      'Your phone works as an AI mining node. Complete onboarding first, then rewards accrue while the device remains online.',
    s1Bullet1: '• Step 1: Identity sync + inviter wallet',
    s1Bullet2: '• Step 2: Send machine code for monthly-card activation',
    s1Bullet3: '• Step 3: Setup miner (admin gas top-up if needed)',
    s2Title: 'Your Machine Code',
    s2Body:
      'Send this code to our support when you purchase a monthly card. It binds your phone to your contract.',
    s2Hint: 'You can also find this code in the Home tab.',
    s3Title: 'Bind Inviter Wallet',
    s3Body: 'Use inviter wallet address to complete registration. After activation, keep phone online to accrue rewards.',
    referralTitle: 'Inviter Wallet Address',
    referralHint: 'Required. Use inviter wallet address (0x...).',
    referralPlaceholder: '0x... inviter wallet',
    referralInvalid: 'Please enter a valid wallet address.',
    tip: 'Tip: support/admin manages monthly-card activation and contract duration.',
  },
  zh: {
    step: '第',
    of: '步 / 共',
    next: '下一步',
    back: '上一步',
    finish: '开始挖矿',
    s1Title: '欢迎使用 Coin Planet',
    s1Body: '您的手机将作为 AI 挖矿节点。请先完成准备流程，随后设备在线即可持续累计 USDT 收益。',
    s1Bullet1: '• 第一步：身份同步 + 绑定推荐人钱包',
    s1Bullet2: '• 第二步：提交机器码，开通月卡',
    s1Bullet3: '• 第三步：矿机设置（Gas 不足联系管理员）',
    s2Title: '您的机器码',
    s2Body: '购买月卡时请将此机器码告知客服，用于将本机绑定到您的合同。',
    s2Hint: '您也可以在"首页"随时查看此机器码。',
    s3Title: '绑定推荐人钱包',
    s3Body: '请输入推荐人钱包地址完成注册。开通后请保持手机在线，以便持续累计收益。',
    referralTitle: '推荐人钱包地址',
    referralHint: '必填，请输入推荐人的钱包地址（0x...）。',
    referralPlaceholder: '输入推荐人钱包地址 0x...',
    referralInvalid: '请输入有效的钱包地址。',
    tip: '提示：月卡开通与合同周期由客服/管理员统一管理。',
  },
} as const;

export default function OnboardingFlow({ visible, lang, machineCode, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [referralWallet, setReferralWallet] = useState('');
  const [referralError, setReferralError] = useState('');
  const t = COPY[lang];

  const next = () => {
    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
      return;
    }

    const normalized = referralWallet.trim().toLowerCase();
    const isValidWallet = /^0x[a-f0-9]{40}$/.test(normalized);
    if (!isValidWallet) {
      setReferralError(t.referralInvalid);
      return;
    }

    setReferralError('');
    onComplete(normalized);
  };

  const back = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>
            {t.step} {step} {t.of} 3
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {step === 1 && (
              <>
                <Text style={styles.title}>{t.s1Title}</Text>
                <Text style={styles.body}>{t.s1Body}</Text>
                <View style={styles.bullets}>
                  <Text style={styles.bullet}>{t.s1Bullet1}</Text>
                  <Text style={styles.bullet}>{t.s1Bullet2}</Text>
                  <Text style={styles.bullet}>{t.s1Bullet3}</Text>
                </View>
              </>
            )}

            {step === 2 && (
              <>
                <Text style={styles.title}>{t.s2Title}</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText} selectable>
                    {machineCode || '------'}
                  </Text>
                </View>
                <Text style={styles.body}>{t.s2Body}</Text>
                <Text style={styles.hint}>{t.s2Hint}</Text>
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.title}>{t.s3Title}</Text>
                <Text style={styles.body}>{t.s3Body}</Text>
                <Text style={styles.referralTitle}>{t.referralTitle}</Text>
                <TextInput
                  style={styles.referralInput}
                  value={referralWallet}
                  onChangeText={(text) => {
                    setReferralWallet(text);
                    if (referralError) setReferralError('');
                  }}
                  placeholder={t.referralPlaceholder}
                  placeholderTextColor="#64748b"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>{t.referralHint}</Text>
                {referralError ? <Text style={styles.errorText}>{referralError}</Text> : null}
                <Text style={styles.hint}>{t.tip}</Text>
              </>
            )}
          </ScrollView>

          <View style={styles.actions}>
            {step > 1 ? (
              <Pressable onPress={back} style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostText}>{t.back}</Text>
              </Pressable>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable onPress={next} style={[styles.btn, styles.btnPrimary]}>
              <Text style={styles.btnPrimaryText}>{step === 3 ? t.finish : t.next}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 20,
    maxHeight: '90%',
  },
  badge: {
    alignSelf: 'flex-start',
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(167,139,250,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 14,
  },
  scroll: { maxHeight: 420 },
  scrollContent: { paddingBottom: 8 },
  title: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', marginBottom: 10 },
  body: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 10 },
  hint: { color: '#64748b', fontSize: 12, marginTop: 8 },
  errorText: { color: '#fda4af', fontSize: 12, marginTop: 8 },
  referralTitle: { color: '#cbd5e1', fontSize: 13, marginTop: 6, marginBottom: 8, fontWeight: '600' },
  referralInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1224',
    color: '#e2e8f0',
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  bullets: { marginTop: 8 },
  bullet: { color: '#e2e8f0', fontSize: 14, lineHeight: 24 },
  codeBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeText: { color: '#22d3ee', fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#a78bfa' },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  btnGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnGhostText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
});
