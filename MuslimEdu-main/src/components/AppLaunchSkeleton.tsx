import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Skeleton, SkeletonCircle } from './Skeleton';

/**
 * Launch skeleton shaped like the Login screen (the screen an unauthenticated
 * user lands on). Matching the real layout means when the session check
 * finishes there's no jump: the greyed shapes sit exactly where the logo,
 * hero, inputs, and buttons will appear.
 */
export default function AppLaunchSkeleton() {
  return (
    <View style={styles.screen}>
      {/* Header: centered logo + brand name */}
      <View style={styles.header}>
        <SkeletonCircle size={34} />
        <Skeleton width={110} height={20} borderRadius={6} style={styles.brandName} />
      </View>

      {/* Hero: headline block on the left, illustration square on the right */}
      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Skeleton width={'80%'} height={34} borderRadius={8} />
          <Skeleton width={'60%'} height={34} borderRadius={8} style={styles.mt8} />
          <Skeleton width={'70%'} height={14} borderRadius={6} style={styles.mt14} />
        </View>
        <Skeleton width={150} height={150} borderRadius={20} />
      </View>

      {/* Email field */}
      <Skeleton width={60} height={14} borderRadius={6} style={styles.mt24} />
      <Skeleton width={'100%'} height={58} borderRadius={18} style={styles.mt10} />

      {/* Password field */}
      <Skeleton width={80} height={14} borderRadius={6} style={styles.mt20} />
      <Skeleton width={'100%'} height={58} borderRadius={18} style={styles.mt10} />

      {/* Remember me / forgot */}
      <View style={styles.rowBetween}>
        <Skeleton width={120} height={14} borderRadius={6} />
        <Skeleton width={100} height={14} borderRadius={6} />
      </View>

      {/* Log in button */}
      <Skeleton width={'100%'} height={58} borderRadius={29} style={styles.mt20} />

      {/* Get Started card */}
      <Skeleton width={'100%'} height={82} borderRadius={22} style={styles.mt20} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  brandName: { marginLeft: 8 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  heroText: { flex: 1, paddingRight: 12 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  mt8: { marginTop: 8 },
  mt10: { marginTop: 10 },
  mt14: { marginTop: 14 },
  mt20: { marginTop: 20 },
  mt24: { marginTop: 24 },
});
