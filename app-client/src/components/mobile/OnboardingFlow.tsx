import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';

export type OnboardingLang = 'en' | 'zh';

type OnboardingFlowProps = {
  visible: boolean;
  minimized: boolean;
  lang: OnboardingLang;
  machineCode: string;
  initialReferralWallet?: string;
  onComplete: (referralWallet: string) => void;
  onMinimize: () => void;
  onExpand: () => void;
};

const COPY = {
  en: {
    step: 'Step',
    of: 'of',
    next: 'Next',
    back: 'Back',
    minimize: 'Later',
    resume: 'Continue Setup',
    finish: 'Start Earning',
    s1Title: 'Bind Inviter Wallet',
    s1Body: 'Use inviter wallet address to complete registration. After activation, keep phone online to accrue rewards.',
    s1Hint: 'Required. Use inviter wallet address (0x...).',
    s1Tip: 'Tip: support/admin manages monthly-card activation and contract duration.',
    s2Title: 'Your Machine Code',
    s2Body:
      'Send this code to our support when you purchase a monthly card. It binds your phone to your contract.',
    s2Hint: 'You can also find this code in the Home tab.',
    s3Title: 'Ready to Configure Miner',
    s3Body: 'Identity config is complete. Next, ask support to activate the monthly card, then return to finish miner setup.',
    s3Bullet1: '• Keep this floating guide available from any tab',
    s3Bullet2: '• Finish monthly-card activation with your machine code',
    s3Bullet3: '• After activation, tap Setup Miner from the home guide',
    referralTitle: 'Inviter Wallet Address',
    referralPlaceholder: '0x... inviter wallet',
    referralInvalid: 'Please enter a valid wallet address.',
    floatingTitle: 'Registration Setup',
  },
  zh: {
    step: '第',
    of: '步 / 共',
    next: '下一步',
    back: '上一步',
    minimize: '稍后',
    resume: '继续配置',
    finish: '开始挖矿',
    s1Title: '绑定推荐人钱包',
    s1Body: '请输入推荐人钱包地址完成注册。开通后请保持手机在线，以便持续累计收益。',
    s1Hint: '必填，请输入推荐人的钱包地址（0x...）。',
    s1Tip: '提示：月卡开通与合同周期由客服/管理员统一管理。',
    s2Title: '您的机器码',
    s2Body: '购买月卡时请将此机器码告知客服，用于将本机绑定到您的合同。',
    s2Hint: '您也可以在"首页"随时查看此机器码。',
    s3Title: '准备配置矿机',
    s3Body: '注册配置已完成。下一步请联系客服用机器码开通月卡，随后返回首页完成矿机设置。',
    s3Bullet1: '• 这个悬浮引导可在任意页面继续打开',
    s3Bullet2: '• 用机器码联系客户完成月卡激活',
    s3Bullet3: '• 激活完成后，回到首页点击“矿机设置”',
    referralTitle: '推荐人钱包地址',
    referralPlaceholder: '输入推荐人钱包地址 0x...',
    referralInvalid: '请输入有效的钱包地址。',
    floatingTitle: '注册配置',
  },
} as const;

export default function OnboardingFlow({ visible, minimized, lang, machineCode, initialReferralWallet = '', onComplete, onMinimize, onExpand }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [referralWallet, setReferralWallet] = useState(initialReferralWallet);
  const [referralError, setReferralError] = useState('');
  const t = COPY[lang];

  useEffect(() => {
    if (initialReferralWallet && !referralWallet) {
      setReferralWallet(initialReferralWallet);
    }
  }, [initialReferralWallet, referralWallet]);

  const stepSummary = useMemo(() => {
    if (step === 1) return t.s1Title;
    if (step === 2) return t.s2Title;
    return t.s3Title;
  }, [step, t.s1Title, t.s2Title, t.s3Title]);

  const next = () => {
    if (step === 1) {
      const normalized = referralWallet.trim().toLowerCase();
      const isValidWallet = /^0x[a-f0-9]{40}$/.test(normalized);
      if (!isValidWallet) {
        setReferralError(t.referralInvalid);
        return;
      }

      setReferralWallet(normalized);
      setReferralError('');
      setStep(2);
      return;
    }

    if (step < 3) {
      setStep((step + 1) as 1 | 2 | 3);
      return;
    }

    const normalized = referralWallet.trim().toLowerCase();
    setReferralError('');
    onComplete(normalized);
  };

  const back = () => {
    if (step > 1) setStep((step - 1) as 1 | 2 | 3);
  };

  if (!visible) return null;

  if (minimized) {
    return (
      <View pointerEvents="box-none" style={styles.floatingWrap}>
        <Pressable style={styles.minimizedPill} onPress={onExpand}>
          <View style={styles.minimizedCopy}>
            <Text style={styles.minimizedTitle}>{t.floatingTitle}</Text>
            <Text style={styles.minimizedHint}>{`${t.step} ${step}/3 · ${stepSummary}`}</Text>
          </View>
          <Text style={styles.minimizedAction}>{t.resume}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onMinimize}
    >
      <View style={styles.modalBackdrop}>
        <TouchableWithoutFeedback onPress={onMinimize}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={styles.expandedWrap} pointerEvents="box-none">
          <View style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.badge}>
                  {t.step} {step} {t.of} 3
                </Text>
                <Text style={styles.floatingTitle}>{t.floatingTitle}</Text>
              </View>
              <Pressable onPress={onMinimize} style={styles.headerAction}>
                <Text style={styles.headerActionText}>{t.minimize}</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
              {step === 1 && (
                <>
                  <Text style={styles.title}>{t.s1Title}</Text>
                  <Text style={styles.body}>{t.s1Body}</Text>
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
                  <Text style={styles.hint}>{t.s1Hint}</Text>
                  {referralError ? <Text style={styles.errorText}>{referralError}</Text> : null}
                  <Text style={styles.hint}>{t.s1Tip}</Text>
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
                  <View style={styles.bullets}>
                    <Text style={styles.bullet}>{t.s3Bullet1}</Text>
                    <Text style={styles.bullet}>{t.s3Bullet2}</Text>
                    <Text style={styles.bullet}>{t.s3Bullet3}</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.actions}>
              {step > 1 ? (
                <Pressable onPress={back} style={[styles.btn, styles.btnGhost]}>
                  <Text style={styles.btnGhostText}>{t.back}</Text>
                </Pressable>
              ) : (
                <View style={styles.spacer} />
              )}
              <Pressable onPress={next} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryText}>{step === 3 ? t.finish : t.next}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 96,
  },
  expandedWrap: {
    width: '100%',
    maxWidth: 420,
  },
  floatingWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 96,
    zIndex: 40,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#225b98',
    padding: 16,
    width: '100%',
    maxHeight: '62%',
    shadowColor: '#020617',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  headerCopy: {
    gap: 8,
    flex: 1,
  },
  floatingTitle: {
    color: '#dbeafe',
    fontSize: 13,
    fontWeight: '700',
  },
  headerAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#172554',
    borderWidth: 1,
    borderColor: '#1d4ed8',
  },
  headerActionText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(34,211,238,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  scroll: { maxHeight: 320 },
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
  spacer: { flex: 1 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#a78bfa' },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  btnGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnGhostText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
  minimizedPill: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#225b98',
    backgroundColor: 'rgba(8, 39, 84, 0.96)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  minimizedCopy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  minimizedTitle: {
    color: '#e0f2fe',
    fontSize: 13,
    fontWeight: '800',
  },
  minimizedHint: {
    color: '#93c5fd',
    fontSize: 11,
  },
  minimizedAction: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '800',
  },
});
