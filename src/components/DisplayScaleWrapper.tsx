import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { useDisplayScale } from '../context/DisplayScaleContext';

/**
 * Visually zooms the whole app tree it wraps. Sizing the inner box to
 * screen-size / scale BEFORE applying the scale transform means the
 * scaled result exactly fills the viewport again (no gaps, no clipped
 * edges) instead of just shrinking/growing in place.
 *
 * Native <Modal> content (action sheets, "coming soon" dialogs, etc.)
 * renders on its own native root outside this tree, so it does not pick
 * up the zoom - only normal in-screen content does.
 */
export default function DisplayScaleWrapper({ children }: { children: React.ReactNode }) {
  const { scale } = useDisplayScale();
  const { width, height } = useWindowDimensions();

  if (scale === 1) return <>{children}</>;

  return (
    <View style={styles.outer}>
      <View style={{ width: width / scale, height: height / scale, transform: [{ scale }] }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
