import React from 'react';
import { Modal, ModalProps, View } from 'react-native';
import { useKeyboardInset } from '../hooks/useKeyboardInset';

/**
 * Drop-in replacement for react-native's <Modal> that keeps its content
 * clear of the on-screen keyboard.
 *
 * Since RN 0.81 Android is edge-to-edge by default (this app is on 0.86),
 * so `android:windowSoftInputMode="adjustResize"` no longer resizes
 * anything - the keyboard arrives as a window *inset* and paints over the
 * UI. Keyboard avoidance is the app's job now; nothing happens for free.
 *
 * The wrapper is a plain `flex: 1` view padded by the keyboard height,
 * which is layout-neutral for every modal in this app (they all root at a
 * flex:1 backdrop, bottom-anchored or centered): bottom sheets end up
 * sitting on top of the keyboard, centered dialogs re-center in the space
 * that's left. See useKeyboardInset for why padding rather than a
 * KeyboardAvoidingView.
 */
export default function KeyboardAwareModal({
  children,
  ...modalProps
}: ModalProps & { children?: React.ReactNode }) {
  const { inset, onLayout } = useKeyboardInset();

  return (
    <Modal {...modalProps}>
      <View style={{ flex: 1, paddingBottom: inset }} onLayout={onLayout} pointerEvents="box-none">
        {children}
      </View>
    </Modal>
  );
}
