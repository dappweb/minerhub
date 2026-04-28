import React, { useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableWithoutFeedback, View } from 'react-native';

export type OnboardingLang = 'en' | 'zh';

type OnboardingFlowProps = {
  visible: boolean;
  minimized: boolean;
  lang: OnboardingLang;
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
    s1Title: 'Complete Account Setup',
    s1Body:
      'Finish identity setup and keep your wallet ready. You can continue from any tab later.',
    s1Hint: 'No device code is required anymore.',
    s2Title: 'Ready to Configure Miner',
    s2Body: 'Identity config is complete. Next, ask support to activate the monthly card, then return to finish miner setup.',
    s2Bullet1: '• Keep this floating guide available from any tab',
    s2Bullet2: '• Finish monthly-card activation with support',
    s2Bullet3: '• After activation, tap Setup Miner from the home guide',
    s3Title: 'Bind Referrer (Optional)',
    s3Body: 'Enter the wallet address of your referrer if you have one. This can be added later from the profile page.',
    s3Placeholder: 'Referrer wallet address (0x...)',
    s3Optional: 'Optional: Leave empty to continue',
    s3Invalid: 'Invalid wallet address',
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
    s1Title: '完成账户配置',
    s1Body: '先完成身份同步并保持钱包可用，之后可在任意页面继续配置流程。',
    s1Hint: '当前流程无需额外设备编码。',
    s2Title: '准备配置矿机',
    s2Body: '注册配置已完成。下一步请联系客服开通月卡，随后返回首页完成矿机设置。',
    s2Bullet1: '• 这个悬浮引导可在任意页面继续打开',
    s2Bullet2: '• 联系客服完成月卡激活',
    s2Bullet3: '• 激活完成后，回到首页点击"矿机设置"',
    s3Title: '绑定推荐人（可选）',
    s3Body: '输入您的推荐人钱包地址，如果您有的话。也可以稍后在个人页面添加。',
    s3Placeholder: '推荐人钱包地址（0x...）',
    s3Optional: '可选：留空可继续',
    s3Invalid: '无效的钱包地址',
    floatingTitle: '注册配置',
  },
} as const;

function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export default function OnboardingFlow({ visible, minimized, lang, initialReferralWallet = '', onComplete, onMinimize, onExpand }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [referralWallet, setReferralWallet] = useState(initialReferralWallet);
  const [referralError, setReferralError] = useState('');
  const t = COPY[lang];

  const stepSummary = useMemo(() => {
    if (step === 1) return t.s1Title;
    if (step === 2) return t.s2Title;
    return t.s3Title;
  }, [step, t.s1Title, t.s2Title, t.s3Title]);

  const next = () => {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    // Step 3: Validate referral wallet (optional, can be empty)
    const normalized = referralWallet.trim().toLowerCase();
    if (normalized && !isValidEthereumAddress(normalized)) {
      setReferralError(t.s3Invalid);
      return;
    }
    onComplete(normalized);
  };

  const back = () => {
    if (step > 1) {
      setReferralError('');
      setStep((step - 1) as 1 | 2 | 3);
    }
  };

  const handleReferralChange = (text: string) => {
    setReferralWallet(text);
    setReferralError('');
  };

  if (!visible) return null;

  const { cardWidth, cardMaxHeight, scrollMaxHeight, paddingBottom, screenWidth } = getResponsiveDimensions();
  
  // 动态样式（根据屏幕尺寸）
  const dynamicStyles = {
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(2, 6, 23, 0.68)',
      justifyContent: 'flex-end' as const,
      alignItems: 'center' as const,
      paddingHorizontal: Math.max(12, screenWidth * 0.05),
      paddingBottom,
    },
    expandedWrap: {
      width: cardWidth,
      maxWidth: cardWidth,
    },
    card: {
      maxHeight: cardMaxHeight,
    },
    scroll: {
      maxHeight: scrollMaxHeight,
    },
  };

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
      <View style={[styles.modalBackdrop, dynamicStyles.modalBackdrop]}>
        <TouchableWithoutFeedback onPress={onMinimize}>
          <View style={StyleSheet.absoluteFillObject} />
        </TouchableWithoutFeedback>
        <View style={[styles.expandedWrap, dynamicStyles.expandedWrap]} pointerEvents="box-none">
          <View style={[styles.card, dynamicStyles.card]}>
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

            <ScrollView style={[styles.scroll, dynamicStyles.scroll]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="always">
              {step === 1 && (
                <>
                  <Text style={styles.title}>{t.s1Title}</Text>
                  <Text style={styles.body}>{t.s1Body}</Text>
                  <Text style={styles.hint}>{t.s1Hint}</Text>
                </>
              )}

              {step === 2 && (
                <>
                  <Text style={styles.title}>{t.s2Title}</Text>
                  <Text style={styles.body}>{t.s2Body}</Text>
                  <View style={styles.bullets}>
                    <Text style={styles.bullet}>{t.s2Bullet1}</Text>
                    <Text style={styles.bullet}>{t.s2Bullet2}</Text>
                    <Text style={styles.bullet}>{t.s2Bullet3}</Text>
                  </View>
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={styles.title}>{t.s3Title}</Text>
                  <Text style={styles.body}>{t.s3Body}</Text>
                  <Text style={styles.referralTitle}>{t.s3Optional}</Text>
                  <TextInput
                    style={styles.referralInput}
                    placeholder={t.s3Placeholder}
                    placeholderTextColor="#64748b"
                    value={referralWallet}
                    onChangeText={handleReferralChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {referralError && <Text style={styles.errorText}>{referralError}</Text>}
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

// 响应式尺寸计算
const getResponsiveDimensions = () => {
  const { width, height } = Dimensions.get('window');
  const isLandscape = width > height;
  
  return {
    screenWidth: width,
    screenHeight: height,
    isLandscape,
    // 弹窗宽度：屏幕宽度的 90%，但最大 520px，最小 280px
    cardWidth: Math.min(Math.max(width * 0.9, 280), 520),
    // 弹窗最大高度：屏幕高度的 85%（横屏）或 75%（竖屏）
    cardMaxHeight: isLandscape ? height * 0.85 : height * 0.75,
    // ScrollView 高度：动态计算
    scrollMaxHeight: isLandscape ? height * 0.5 : height * 0.4,
    // 底部间距：在竖屏模式下固定96，横屏模式下为20
    paddingBottom: isLandscape ? 20 : 96,
  };
};

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
    maxWidth: 520,
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
    padding: 18,
    width: '100%',
    maxHeight: '85%',
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
    fontSize: 14,
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
  scroll: { maxHeight: 400 },
  scrollContent: { paddingBottom: 12 },
  title: { color: '#f1f5f9', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  body: { color: '#cbd5e1', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  hint: { color: '#64748b', fontSize: 13, marginTop: 10 },
  errorText: { color: '#fda4af', fontSize: 13, marginTop: 10 },
  referralTitle: { color: '#cbd5e1', fontSize: 14, marginTop: 8, marginBottom: 10, fontWeight: '600' },
  referralInput: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1224',
    color: '#e2e8f0',
    paddingHorizontal: 14,
    marginBottom: 6,
    fontSize: 15,
  },
  bullets: { marginTop: 10 },
  bullet: { color: '#e2e8f0', fontSize: 15, lineHeight: 26 },
  codeBox: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  codeText: { color: '#22d3ee', fontSize: 24, fontWeight: '700', letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 18 },
  spacer: { flex: 1 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#a78bfa' },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 16 },
  btnGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnGhostText: { color: '#cbd5e1', fontWeight: '600', fontSize: 16 },
  minimizedPill: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#225b98',
    backgroundColor: 'rgba(8, 39, 84, 0.96)',
    paddingHorizontal: 18,
    paddingVertical: 14,
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
    fontSize: 14,
    fontWeight: '800',
  },
  minimizedHint: {
    color: '#93c5fd',
    fontSize: 12,
  },
  minimizedAction: {
    color: '#67e8f9',
    fontSize: 13,
    fontWeight: '800',
  },
});
