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
  return (
    <View style={styles.guideCard}>
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{description}</Text>
        </View>
        <TouchableOpacity style={[styles.primaryBtn, disabled && styles.disabledBtn]} onPress={onPress} disabled={disabled}>
          <Text style={styles.primaryBtnText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.stepsRow}>
        {steps.map((step, index) => (
          <View key={step.key} style={styles.stepItem}>
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
            <Text style={styles.stepStatus}>{step.status}</Text>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerMain: {
    flex: 1,
    gap: 6,
    paddingRight: 12,
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
  primaryBtn: {
    alignSelf: 'flex-start',
    borderRadius: 14,
    backgroundColor: '#22d3ee',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: {
    color: '#083344',
    fontSize: 13,
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
});