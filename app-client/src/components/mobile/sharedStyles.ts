import { StyleSheet } from 'react-native';

/** Styles shared across multiple tab components */
const sharedStyles = StyleSheet.create({
  actionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2554',
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    color: '#e9f8ff',
    fontSize: 17,
    fontWeight: '800',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a5ea8',
    backgroundColor: '#0d2a63',
    padding: 12,
    gap: 6,
  },
  metricValue: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#9eceff',
    fontSize: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#143e7a',
    borderWidth: 1,
    borderColor: '#3f77bc',
    paddingVertical: 10,
    alignItems: 'center',
  },
  quickBtnText: {
    color: '#dbf4ff',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 10,
    backgroundColor: '#184680',
    borderWidth: 1,
    borderColor: '#3f77bc',
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 2,
  },
  secondaryBtnText: {
    color: '#dbf4ff',
    fontSize: 14,
    fontWeight: '700',
  },
  disabledBtn: {
    opacity: 0.55,
  },
  label: {
    color: '#bcdcff',
    fontSize: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3f77bc',
    backgroundColor: '#062656',
    color: '#e8fbff',
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  walletText: {
    color: '#effbff',
    fontSize: 12,
    fontWeight: '600',
  },
  walletHint: {
    color: '#96cfff',
    fontSize: 12,
  },
  profileExpire: {
    color: '#c8ebff',
    fontSize: 13,
  },
});

export default sharedStyles;
