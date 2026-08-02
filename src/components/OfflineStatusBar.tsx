import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOfflineQueue } from '../context/OfflineQueueContext';

const AMBER = '#B45309';
const AMBER_BG = '#FEF3C7';
const AMBER_BORDER = 'rgba(180,83,9,0.18)';
const BAR_CONTENT_HEIGHT = 40;

/**
 * Global "you're offline" banner - mounted once at the app root (App.tsx),
 * as a normal flex sibling ABOVE the navigator rather than an absolutely
 * positioned overlay. That's the point: going offline pushes the whole
 * screen down by the banner's height instead of floating a pill on top of
 * whatever's underneath it (which could cover a header button or a status
 * badge on some screens).
 *
 * Entrance: height + opacity + a small slide-in grow together as it
 * appears. Exit: opacity fades and the bar drops slightly first, THEN the
 * height collapses back to 0 once that fade finishes - "fade down, then
 * gone" - so content doesn't snap back up mid-fade.
 */
export default function OfflineStatusBar() {
  const insets = useSafeAreaInsets();
  const { isOnline, isFlushing, actions, flushNow } = useOfflineQueue();
  const barHeight = insets.top + BAR_CONTENT_HEIGHT;

  const [mounted, setMounted] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const dropAnim = useRef(new Animated.Value(-6)).current;

  useEffect(() => {
    if (!isOnline) {
      setMounted(true);
      dropAnim.setValue(-6);
      Animated.parallel([
        Animated.timing(heightAnim, { toValue: barHeight, duration: 260, useNativeDriver: false }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 260, useNativeDriver: false }),
        Animated.timing(dropAnim, { toValue: 0, duration: 260, useNativeDriver: false }),
      ]).start();
    } else {
      Animated.sequence([
        Animated.parallel([
          Animated.timing(opacityAnim, { toValue: 0, duration: 220, useNativeDriver: false }),
          Animated.timing(dropAnim, { toValue: 10, duration: 220, useNativeDriver: false }),
        ]),
        Animated.timing(heightAnim, { toValue: 0, duration: 200, useNativeDriver: false }),
      ]).start(() => setMounted(false));
    }
    // barHeight only changes if safe-area insets change (rotation, etc.) -
    // not something that should retrigger the show/hide animation itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  if (!mounted) return null;

  return (
    <Animated.View style={{ height: heightAnim, overflow: 'hidden' }}>
      <Animated.View style={{ opacity: opacityAnim, transform: [{ translateY: dropAnim }], paddingTop: insets.top }}>
        <View style={styles.bar}>
          <View style={styles.dot} />
          <Text style={styles.text} numberOfLines={1}>
            Offline Mode{actions.length > 0 ? ` · ${actions.length} pending` : ''}
          </Text>
          <TouchableOpacity style={styles.syncBtn} onPress={() => flushNow()} activeOpacity={0.8} disabled={isFlushing}>
            {isFlushing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.syncText}>Sync</Text>}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_CONTENT_HEIGHT,
    paddingHorizontal: 14,
    backgroundColor: AMBER_BG,
    borderBottomWidth: 1,
    borderBottomColor: AMBER_BORDER,
    gap: 8,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: AMBER },
  text: { fontSize: 12.5, fontWeight: '700', color: AMBER, flex: 1 },
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
