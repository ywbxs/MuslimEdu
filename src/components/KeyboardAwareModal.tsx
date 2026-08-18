import React, { useEffect, useRef, useState } from 'react';
import { Modal, ModalProps, View, Keyboard, Platform, LayoutChangeEvent } from 'react-native';

/**
 * Drop-in replacement for react-native's <Modal> that keeps its content
 * clear of the on-screen keyboard.
 *
 * Why this exists instead of a KeyboardAvoidingView inside each modal:
 *
 *  - Since RN 0.81 Android is edge-to-edge by default (this app is on
 *    0.86), which means `android:windowSoftInputMode="adjustResize"` no
 *    longer resizes anything - the keyboard comes in as a window *inset*
 *    and simply paints over the UI. Layout-based avoidance has to be done
 *    by the app now; nothing happens for free.
 *  - A <Modal> is its own Android window (a Dialog), separate from the
 *    activity's. KeyboardAvoidingView inside one measures a frame that
 *    never changes when the keyboard opens, so `behavior="height"` had
 *    nothing meaningful to subtract from and the sheet just sat there
 *    with the keyboard covering its fields.
 *
 * So this reads the keyboard height straight from the Keyboard module and
 * pads the modal's content area by it, which works regardless of what the
 * window does. It is also self-correcting for platforms/versions where the
 * window *does* still resize (older Android, or if edge-to-edge is turned
 * off later): it measures its own height at rest vs. now, and only
 * compensates for whatever overlap the window didn't already absorb - so
 * it never double-counts and pushes content too far up.
 *
 * Layout-neutral by design: the wrapper is a plain `flex: 1` view, which
 * is what every modal in this app already puts at its root (a flex:1
 * backdrop, bottom-anchored or centered). Bottom sheets end up sitting
 * right on top of the keyboard; centered dialogs re-center in the space
 * that's left.
 */
export default function KeyboardAwareModal({
  children,
  ...modalProps
}: ModalProps & { children?: React.ReactNode }) {
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

  // Padding doesn't affect this view's own outer height (it's flex:1 against
  // the modal window), so measuring here only ever reports what the *window*
  // did - never our own compensation feeding back into itself.
  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (keyboardHeight === 0) restHeightRef.current = h;
    setLayoutHeight(h);
  };

  const alreadyShrunk =
    restHeightRef.current != null && layoutHeight != null
      ? Math.max(0, restHeightRef.current - layoutHeight)
      : 0;
  const overlap = Math.max(0, keyboardHeight - alreadyShrunk);

  return (
    <Modal {...modalProps}>
      <View style={{ flex: 1, paddingBottom: overlap }} onLayout={onLayout} pointerEvents="box-none">
        {children}
      </View>
    </Modal>
  );
}
