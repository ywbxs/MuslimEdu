import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQueue } from '../context/OfflineQueueContext';

const AMBER = '#B45309';
const AMBER_BG = '#FEF3C7';
const AMBER_BORDER = 'rgba(180,83,9,0.18)';

/**
 * Global "you're offline" banner - mounted once at the app root (App.tsx),
 * above the navigator, so it shows on every screen without each screen
 * needing to know about it. Reads the same connectivity state the offline
 * report-submission queue already tracks (see offlineQueue.ts) rather than
 * a second NetInfo subscription.
 *
 * Hidden entirely while online - reappears the moment NetInfo reports a
 * disconnect, disappears the moment it reports a reconnect. The Sync button
 * calls the same flushNow() the queue already exposes; it's a no-op if
 * still genuinely offline, mainly useful the instant a user reconnects but
 * NetInfo's own event hasn't fired the auto-flush yet.
 */
export default function OfflineStatusBar() {
  const insets = useSafeAreaInsets();
  const { isOnline, isFlushing, actions, flushNow } = useOfflineQueue();

  if (isOnline) return null;

  return (
    <View style={[styles.wrap, { top: insets.top + 6 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        <View style={styles.dot} />
        <Text style={styles.text} numberOfLines={1}>
          Offline Mode{actions.length > 0 ? ` · ${actions.length} pending` : ''}
        </Text>
        <TouchableOpacity style={styles.syncBtn} onPress={() => flushNow()} activeOpacity={0.8} disabled={isFlushing}>
          {isFlushing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.syncText}>Sync</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AMBER_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AMBER_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: AMBER },
  text: { fontSize: 12.5, fontWeight: '700', color: AMBER, flexShrink: 1 },
  syncBtn: {
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncText: { fontSize: 11.5, fontWeight: '700', color: '#FFFFFF' },
});
