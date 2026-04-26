import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type ContractModalLang = 'en' | 'zh';

type ContractModalProps = {
  visible: boolean;
  lang: ContractModalLang;
  title: string;
  content: string;
  onAccept: () => Promise<void>;
  onReject: () => void;
};

const COPY = {
  en: {
    scrollToBottom: 'Please scroll to the bottom to agree',
    acceptBtn: 'I Accept',
    rejectBtn: 'Decline',
    submittingBtn: 'Submitting...',
  },
  zh: {
    scrollToBottom: '请滑动到最底部后同意',
    acceptBtn: '同意',
    rejectBtn: '拒绝',
    submittingBtn: '提交中...',
  },
} as const;

export default function ContractModal({ visible, lang, title, content, onAccept, onReject }: ContractModalProps) {
  const [scrollPos, setScrollPos] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const t = COPY[lang];

  // Check if user has scrolled to bottom (within 10px threshold)
  const isAtBottom = scrollPos >= contentHeight - 10;

  const handleScroll = (event: any) => {
    setScrollPos(event.nativeEvent.contentOffset.y);
  };

  const handleContentLayout = (event: any) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
          </View>

          <ScrollView
            style={styles.contentScroll}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            <View onLayout={handleContentLayout}>
              <Text style={styles.content}>{content}</Text>
            </View>
          </ScrollView>

          {!isAtBottom && (
            <View style={styles.scrollPrompt}>
              <Text style={styles.scrollPromptText}>{t.scrollToBottom}</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={onReject}
              disabled={submitting}
            >
              <Text style={styles.rejectText}>{t.rejectBtn}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn, !isAtBottom && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={!isAtBottom || submitting}
            >
              <Text style={[styles.acceptText, !isAtBottom && styles.acceptTextDisabled]}>
                {submitting ? t.submittingBtn : t.acceptBtn}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#225b98',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2f3ff',
  },
  contentScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    fontSize: 13,
    lineHeight: 20,
    color: '#c9e1ff',
  },
  scrollPrompt: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(241, 186, 32, 0.1)',
    borderTopWidth: 1,
    borderTopColor: '#f1ba20',
  },
  scrollPromptText: {
    fontSize: 12,
    color: '#fbbf24',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e3a5f',
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rejectBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#384f6e',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  acceptBtn: {
    backgroundColor: '#22d3ee',
  },
  acceptBtnDisabled: {
    backgroundColor: 'rgba(34, 211, 238, 0.3)',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#083344',
  },
  acceptTextDisabled: {
    color: 'rgba(8, 51, 68, 0.5)',
  },
});
