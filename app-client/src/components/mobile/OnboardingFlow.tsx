import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export type OnboardingLang = 'en' | 'zh';

type OnboardingFlowProps = {
  visible: boolean;
  lang: OnboardingLang;
  machineCode: string;
  onComplete: (contractYears: 1 | 2 | 3) => void;
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
      'Your phone becomes an AI mining node. We continuously distribute USDT rewards on-chain while the device stays online.',
    s1Bullet1: '• No upfront hardware cost',
    s1Bullet2: '• Daily on-chain USDT rewards',
    s1Bullet3: '• Cancel or exchange anytime',
    s2Title: 'Your Machine Code',
    s2Body:
      'Send this code to our support when you purchase a monthly card. It binds your phone to your contract.',
    s2Hint: 'You can also find this code in the Home tab.',
    s3Title: 'Choose a Contract Term',
    s3Body: 'The duration your monthly card will remain active. You can extend it later anytime.',
    years1: '1 Year',
    years2: '2 Years',
    years3: '3 Years',
    recommended: 'Recommended',
    tip: 'Tip: support can override this based on your purchase.',
  },
  zh: {
    step: '第',
    of: '步 / 共',
    next: '下一步',
    back: '上一步',
    finish: '开始挖矿',
    s1Title: '欢迎使用 Coin Planet',
    s1Body: '您的手机将作为一台 AI 挖矿节点，设备在线期间系统将持续在链上派发 USDT 收益。',
    s1Bullet1: '• 无需硬件投入',
    s1Bullet2: '• 每日链上 USDT 收益',
    s1Bullet3: '• 随时可取消或兑换',
    s2Title: '您的机器码',
    s2Body: '购买月卡时请将此机器码告知客服，用于将本机绑定到您的合同。',
    s2Hint: '您也可以在"首页"随时查看此机器码。',
    s3Title: '选择合同周期',
    s3Body: '即您月卡的有效时长。后续可随时延长。',
    years1: '1 年',
    years2: '2 年',
    years3: '3 年',
    recommended: '推荐',
    tip: '提示：实际周期以客服开通为准。',
  },
} as const;

export default function OnboardingFlow({ visible, lang, machineCode, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [years, setYears] = useState<1 | 2 | 3>(3);
  const t = COPY[lang];

  const next = () => {
    if (step < 3) setStep((step + 1) as 1 | 2 | 3);
    else onComplete(years);
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
                <View style={styles.yearsRow}>
                  {[1, 2, 3].map((y) => {
                    const active = years === y;
                    const label = y === 1 ? t.years1 : y === 2 ? t.years2 : t.years3;
                    return (
                      <Pressable
                        key={y}
                        onPress={() => setYears(y as 1 | 2 | 3)}
                        style={[styles.yearBtn, active && styles.yearBtnActive]}
                      >
                        <Text style={[styles.yearLabel, active && styles.yearLabelActive]}>{label}</Text>
                        {y === 3 && <Text style={styles.recommended}>{t.recommended}</Text>}
                      </Pressable>
                    );
                  })}
                </View>
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
  yearsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  yearBtn: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  yearBtnActive: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: '#a78bfa' },
  yearLabel: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
  yearLabelActive: { color: '#f1f5f9' },
  recommended: { color: '#a78bfa', fontSize: 10, marginTop: 4, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: '#a78bfa' },
  btnPrimaryText: { color: '#0f172a', fontWeight: '700', fontSize: 15 },
  btnGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  btnGhostText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
});
