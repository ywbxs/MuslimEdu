import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, LayoutChangeEvent } from 'react-native';

/**
 * How much vertical space the keyboard is covering, for bottom-anchored
 * layouts (sheets, composers) to pad themselves out of the way with.
 *
 * Why not KeyboardAvoidingView: `behavior="height"` works by *shrinking*
 * its own height. That only moves anything if the shrunken view stays
 * anchored to the top. Every bottom sheet in this app is inside a
 * `justifyContent: 'flex-end'` container, which immediately pushes the
 * now-shorter view back down to the bottom of the screen - the shrink and
 * the re-anchor cancel out exactly, so the sheet never actually moves off
 * the keyboard. (In the comments sheet it couldn't work at all: the sheet
 * has a fixed `height: '85%'`, so shrinking a child just left dead space
 * inside it.) Padding a flex-end container is unambiguous by comparison -
 * the sheet's bottom edge lands exactly on top of the keyboard.
 *
 * `onLayout` is optional but makes this self-correcting: if the window
 * *does* resize for the keyboard (older Android, or if edge-to-edge is
 * ever turned off - RN 0.81+ enables it by default and then the window
 * just doesn't resize), the measured height shrinks on its own and this
 * subtracts whatever the window already absorbed, so the padding can
 * never double-count and fling the sheet too high.
 *
 * Usage:
 *   const { inset, onLayout } = useKeyboardInset();
 *   <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
 *     <View style={[styles.flexEndBackdrop, { paddingBottom: inset }]}>
 */
export function useKeyboardInset() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState<number | null>(null);
  const restHeightRef = useRef<number | null>(null);

  useEffect(() => {
    // iOS gets the "will" events so the sheet animates in step with the
    // keyboard; Android only reliably fires the "did" ones.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Only trust a measurement taken with the keyboard down as the baseline,
    // otherwise the "did the window resize?" comparison has nothing to
    // compare against.
    if (keyboardHeight === 0) restHeightRef.current = h;
    setLayoutHeight(h);
  };

  const alreadyAbsorbed =
    restHeightRef.current != null && layoutHeight != null
      ? Math.max(0, restHeightRef.current - layoutHeight)
      : 0;
  const inset = Math.max(0, keyboardHeight - alreadyAbsorbed);

  return {
    inset,
    onLayout,
    /** Height left over for content once the keyboard is accounted for. */
    availableHeight: layoutHeight != null ? Math.max(0, layoutHeight - inset) : null,
  };
}

export default useKeyboardInset;
