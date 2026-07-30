import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import DashboardShell, { SUBTLE, INK } from './DashboardShell';

interface PlaceholderDashboardProps {
  roleLabel: string;
}

/**
 * Generic "coming soon" dashboard for any role that doesn't have a
 * fully built screen yet. Swap this out for a real dashboard component
 * (see AdminDashboard.tsx as the reference pattern) as each role gets built.
 */
export default function PlaceholderDashboard({ roleLabel }: PlaceholderDashboardProps) {
  return (
    <DashboardShell title={roleLabel}>
      <View style={styles.center}>
        <Text style={styles.title}>{roleLabel} dashboard</Text>
        <Text style={styles.subtitle}>
          This dashboard hasn't been built yet — login and logout already
          work for this role, we just haven't added the features.
        </Text>
      </View>
    </DashboardShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  title: { fontSize: 18, fontWeight: '600', color: INK, marginBottom: 8, textTransform: 'capitalize' },
  subtitle: { fontSize: 14, color: SUBTLE, textAlign: 'center', paddingHorizontal: 24 },
});
