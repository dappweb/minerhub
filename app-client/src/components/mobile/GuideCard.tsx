import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type GuideStep = {
  key: string;
  label: string;
  status: string;
  active: boolean;
  complete: boolean;
};

type GuideCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  disabled?: boolean;
  steps: GuideStep[];
  onPress: () => void;
};

export default function GuideCard({
  title,
  description,
  buttonLabel,
  disabled = false,
  steps,
  onPress,
}: GuideCardProps) {
  const activeStep = steps.find((step) => step.active) ?? steps.find((step) => !step.complete) ?? steps[steps.length - 1];

  return (
    <View style={styles.guideCard}>
      <View style={styles.headerMain}>
        <Text style={styles.eyebrow}>当前任务</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{description}</Text>
      </View>

      {activeStep ? (
        <View style={styles.focusCard}>
          <Text style={styles.focusLabel}>现在最值得先完成</Text>
          <View style={styles.focusRow}>
            <View style={[styles.focusBadge, activeStep.complete && styles.focusBadgeDone]}>
              <Text style={styles.focusBadgeText}>{activeStep.complete ? 'DONE' : 'NEXT'}</Text>
            </View>
            <View style={styles.focusContent}>
              <Text style={styles.focusTitle}>{activeStep.label}</Text>
              <Text style={styles.focusStatus}>{activeStep.status}</Text>
            </View>
          </View>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.primaryBtn, disabled && styles.disabledBtn]} onPress={onPress} disabled={disabled}>
        <Text style={styles.primaryBtnText}>{buttonLabel}</Text>
      </TouchableOpacity>

      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <View key={step.key} style={[styles.stepItem, step.active && styles.stepItemActive]}>
            <View
              style={[
                styles.stepBadge,
                step.complete && styles.stepBadgeDone,
                step.active && styles.stepBadgeActive,
              ]}
            >
              <Text style={styles.stepBadgeText}>{`0${index + 1}`}</Text>
            </View>
            <Text style={styles.stepLabel}>{step.label}</Text>
            <Text style={[styles.stepStatus, step.active && styles.stepStatusActive]}>{step.status}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  guideCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2e90d1',
    backgroundColor: '#071d44',
    padding: 14,
    gap: 14,
  },
  headerMain: {
    gap: 6,
  },
  eyebrow: {
    color: '#67e8f9',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#ecfeff',
    fontSize: 20,
    fontWeight: '800',
  },
  body: {
    color: '#9cc6ff',
    fontSize: 13,
    lineHeight: 19,
  },
  focusCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#225b98',
    backgroundColor: '#082754',
    padding: 12,
    gap: 8,
  },
  focusLabel: {
    color: '#67e8f9',
    fontSize: 11,
    fontWeight: '700',
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  focusBadge: {
    borderRadius: 999,
    backgroundColor: '#0f766e',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  focusBadgeDone: {
    backgroundColor: '#166534',
  },
  focusBadgeText: {
    color: '#dffaff',
    fontSize: 10,
    fontWeight: '800',
  },
  focusContent: {
    flex: 1,
    gap: 2,
  },
  focusTitle: {
    color: '#effbff',
    fontSize: 15,
    fontWeight: '800',
  },
  focusStatus: {
    color: '#90c8ff',
    fontSize: 12,
  },
  primaryBtn: {
    borderRadius: 14,
    backgroundColor: '#22d3ee',
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#083344',
    fontSize: 14,
    fontWeight: '800',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  stepsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepItem: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#184680',
    backgroundColor: '#082754',
    padding: 10,
    gap: 6,
  },
  stepItemActive: {
    borderColor: '#22d3ee',
    backgroundColor: '#0a315f',
  },
  stepBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#1f3e70',
  },
  stepBadgeDone: {
    backgroundColor: '#14532d',
  },
  stepBadgeActive: {
    backgroundColor: '#0f766e',
  },
  stepBadgeText: {
    color: '#dffaff',
    fontSize: 11,
    fontWeight: '800',
  },
  stepLabel: {
    color: '#effbff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepStatus: {
    color: '#90c8ff',
    fontSize: 11,
  },
  stepStatusActive: {
    color: '#d8f9ff',
  },
});
