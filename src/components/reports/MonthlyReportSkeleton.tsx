import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonCircle } from '../Skeleton';

/**
 * Loading placeholder for OrphanReportScreen.tsx / TeacherOrphanReportScreen.tsx,
 * shaped like the real status card + timeline (see MonthlyReportTimeline.tsx)
 * so nothing jumps when the real content swaps in - same convention as
 * AdminChildReportDetailScreen.tsx's inline Skeleton usage, just shaped for
 * this screen instead of a bare centered spinner.
 */
export default function MonthlyReportSkeleton() {
  return (
    <View style={styles.scroll}>
      <View style={styles.card}>
        <View style={styles.row}>
          <Skeleton width={42} height={42} borderRadius={12} />
          <View style={styles.flex1}>
            <Skeleton width="70%" height={15} style={styles.mb8} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
        <View style={styles.divider} />
        <Skeleton width="100%" height={12} style={styles.mb8} />
        <Skeleton width="85%" height={12} style={styles.mb18} />
        <Skeleton width="100%" height={52} borderRadius={15} />
      </View>

      <View style={styles.card}>
        <View style={styles.historyHeadRow}>
          <SkeletonCircle size={34} />
          <Skeleton width={140} height={14} style={styles.ml10} />
        </View>
        <Skeleton width={200} height={11} style={[styles.ml44, styles.mb14]} />

        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.timelineRow}>
            <Skeleton width={44} height={44} borderRadius={16} />
            <View style={styles.timelineCard}>
              <Skeleton width="55%" height={13} style={styles.mb8} />
              <Skeleton width="75%" height={9} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  flex1: { flex: 1, marginLeft: 14 },
  mb8: { marginBottom: 8 },
  mb14: { marginBottom: 14 },
  mb18: { marginBottom: 18 },
  ml10: { marginLeft: 10 },
  ml44: { marginLeft: 44 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0B1F13',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#EDEEF0', marginVertical: 18 },
  historyHeadRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  timelineCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, shadowColor: '#0D1E1C', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
});
