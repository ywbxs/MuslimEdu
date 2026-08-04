import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Skeleton, SkeletonCircle } from './Skeleton';

/**
 * Launch skeleton shaped like the Home dashboard (greeting header, avatar,
 * balance text, bento tile grid) - shown instead of AppLaunchSkeleton when
 * a saved session is being restored, since that path lands on a dashboard,
 * not the login screen. See RootNavigator.tsx / AuthContext's
 * hasStoredSession for how the two skeletons are picked between.
 */
export default function DashboardLaunchSkeleton() {
  return (
    <View style={styles.screen}>
      {/* Balance text, top-right */}
      <View style={styles.balanceRow}>
        <Skeleton width={44} height={15} borderRadius={6} />
      </View>

      {/* Greeting + avatar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Skeleton width={140} height={14} borderRadius={6} />
          <Skeleton width={100} height={24} borderRadius={7} style={styles.mt8} />
        </View>
        <SkeletonCircle size={52} />
      </View>

      {/* Bento tile grid */}
      <View style={styles.grid}>
        <Skeleton width={'48%'} height={100} borderRadius={20} />
        <Skeleton width={'48%'} height={100} borderRadius={20} />
        <Skeleton width={'48%'} height={100} borderRadius={20} style={styles.mt12} />
        <Skeleton width={'48%'} height={100} borderRadius={20} style={styles.mt12} />
        <Skeleton width={'100%'} height={130} borderRadius={22} style={styles.mt12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  balanceRow: { alignItems: 'flex-end', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  mt8: { marginTop: 8 },
  mt12: { marginTop: 12 },
});
