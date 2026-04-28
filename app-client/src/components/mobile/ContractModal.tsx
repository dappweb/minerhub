import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

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
    eyebrow: 'Contract Review',
    progress: 'Read progress',
    scrollToBottom: 'Read the full contract to enable agreement',
    scrollToEnd: 'Scroll to End',
    acceptBtn: 'Agree and Continue',
    rejectBtn: 'Decline',
    submittingBtn: 'Submitting...',
    acceptedHint: 'Full content reviewed. You can agree now.',
    clauseHint: 'This agreement controls activation, rewards, device uptime, and settlement rules.',
  },
  zh: {
    eyebrow: '合同确认',
    progress: '阅读进度',
    scrollToBottom: '请完整阅读合同后再同意',
    scrollToEnd: '滑到底部',
    acceptBtn: '同意并继续',
    rejectBtn: '暂不同意',
    submittingBtn: '提交中...',
    acceptedHint: '已阅读完整内容，可以继续确认。',
    clauseHint: '该协议用于确认开通周期、收益累计、设备在线和结算规则。',
  },
} as const;

export default function ContractModal({ visible, lang, title, content, onAccept, onReject }: ContractModalProps) {
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [scrollPos, setScrollPos] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const t = COPY[lang];

  const normalizedContent = useMemo(
    () => (content || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim(),
    [content],
  );

  const availableSheetHeight = Math.max(360, height - 34);
  const sheetHeight = Math.min(availableSheetHeight, Math.max(500, Math.floor(height * 0.84)));
  const hasMeasuredScroll = contentHeight > 0 && viewportHeight > 0;
  const scrollableDistance = hasMeasuredScroll ? Math.max(0, contentHeight - viewportHeight) : 0;
  const progress = !hasMeasuredScroll
    ? 0
    : scrollableDistance <= 0
      ? 1
      : Math.min(1, scrollPos / scrollableDistance);
  const progressPercent = Math.round(progress * 100);
  const isAtBottom = hasMeasuredScroll && (scrollableDistance <= 0 || scrollPos >= scrollableDistance - 12);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    setScrollPos(Math.max(0, contentOffset.y));
    setContentHeight(contentSize.height);
    setViewportHeight(layoutMeasurement.height);
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  const handleViewportLayout = (event: LayoutChangeEvent) => {
    setViewportHeight(event.nativeEvent.layout.height);
  };

  const scrollToEnd = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleAccept = async () => {
    if (!isAtBottom || submitting) return;
    setSubmitting(true);
    try {
      await onAccept();
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.container, { height: sheetHeight }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.eyebrow}>{t.eyebrow}</Text>
              <Text style={styles.progressText}>
                {t.progress} {progressPercent}%
              </Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.hint}>{t.clauseHint}</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.contentScroll}
            contentContainerStyle={styles.contentContainer}
            onScroll={handleScroll}
            onLayout={handleViewportLayout}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
          >
            <View onLayout={handleContentLayout}>
              <Text selectable style={styles.content}>
                {normalizedContent || '...'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>

          <View style={[styles.readState, isAtBottom ? styles.readStateDone : styles.readStatePending]}>
            <Text style={[styles.readStateText, isAtBottom ? styles.readStateTextDone : styles.readStateTextPending]}>
              {isAtBottom ? t.acceptedHint : t.scrollToBottom}
            </Text>
            {!isAtBottom && (
              <Pressable style={styles.scrollEndBtn} onPress={scrollToEnd}>
                <Text style={styles.scrollEndBtnText}>{t.scrollToEnd}</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={onReject}
              disabled={submitting}
              activeOpacity={0.82}
            >
              <Text style={styles.rejectText}>{t.rejectBtn}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn, !isAtBottom && styles.acceptBtnDisabled]}
              onPress={handleAccept}
              disabled={!isAtBottom || submitting}
              activeOpacity={0.82}
            >
              {submitting ? (
                <View style={styles.submittingRow}>
                  <ActivityIndicator size="small" color="#083344" />
                  <Text style={styles.acceptText}>{t.submittingBtn}</Text>
                </View>
              ) : (
                <Text style={[styles.acceptText, !isAtBottom && styles.acceptTextDisabled]}>{t.acceptBtn}</Text>
              )}
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
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  container: {
    width: '100%',
    backgroundColor: '#061833',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: '#2f89d8',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#3f77bc',
    marginTop: 10,
    marginBottom: 2,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
    gap: 7,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '800',
  },
  progressText: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#e2f3ff',
    lineHeight: 27,
  },
  hint: {
    color: '#9cc6ff',
    fontSize: 13,
    lineHeight: 19,
  },
  contentScroll: {
    flex: 1,
    backgroundColor: '#071f46',
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
  },
  content: {
    fontSize: 15,
    lineHeight: 24,
    color: '#d8ecff',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#0f2d5c',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22d3ee',
  },
  readState: {
    minHeight: 48,
    paddingVertical: 9,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
  },
  readStatePending: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderTopColor: 'rgba(251, 191, 36, 0.42)',
  },
  readStateDone: {
    backgroundColor: 'rgba(20, 184, 166, 0.12)',
    borderTopColor: 'rgba(45, 212, 191, 0.35)',
  },
  readStateText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  readStateTextPending: {
    color: '#fbbf24',
  },
  readStateTextDone: {
    color: '#99f6e4',
  },
  scrollEndBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scrollEndBtnText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '800',
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
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#384f6e',
  },
  rejectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  acceptBtn: {
    backgroundColor: '#22d3ee',
  },
  acceptBtnDisabled: {
    backgroundColor: 'rgba(34, 211, 238, 0.24)',
  },
  acceptText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#083344',
  },
  acceptTextDisabled: {
    color: 'rgba(216, 244, 255, 0.46)',
  },
  submittingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});
