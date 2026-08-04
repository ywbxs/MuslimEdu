import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, GestureResponderEvent, PanResponderGestureState } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { COLORS, RADIUS, SHADOW } from '../theme/glass';

const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const SURFACE = COLORS.surface;
const BORDER = COLORS.border;
const EMERALD = COLORS.emerald;

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  /** Rasterizes the drawn strokes to a local PNG file and returns its uri. */
  capture: () => Promise<string>;
}

export interface SignaturePadProps {
  height?: number;
  strokeColor?: string;
  onStrokeChange?: (isEmpty: boolean) => void;
}

/**
 * Finger-drawn digital signature captured on-screen at admission - built
 * with PanResponder + react-native-svg <Path> for live drawing and
 * react-native-view-shot's captureRef to rasterize the result into a PNG
 * for upload, matching the app's no-new-native-dependency constraint (this
 * is a bare RN app, no gesture-handler/reanimated/signature-pad library).
 */
const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ height = 180, strokeColor = INK, onStrokeChange }, ref) => {
    const [paths, setPaths] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('');
    const viewRef = useRef<View>(null);
    const currentPathRef = useRef('');

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setCurrentPath('');
        currentPathRef.current = '';
        onStrokeChange?.(true);
      },
      isEmpty: () => paths.length === 0,
      capture: async () => {
        if (!viewRef.current) {
          throw new Error('Signature pad is not ready to capture.');
        }
        return captureRef(viewRef, { format: 'png', quality: 1 });
      },
    }));

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentPathRef.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setCurrentPath(currentPathRef.current);
        },
        onPanResponderMove: (evt: GestureResponderEvent, _gesture: PanResponderGestureState) => {
          const { locationX, locationY } = evt.nativeEvent;
          currentPathRef.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
          setCurrentPath(currentPathRef.current);
        },
        onPanResponderRelease: () => {
          if (currentPathRef.current) {
            setPaths((prev) => {
              const next = [...prev, currentPathRef.current];
              onStrokeChange?.(next.length === 0);
              return next;
            });
          }
          currentPathRef.current = '';
          setCurrentPath('');
        },
      }),
    ).current;

    const isEmpty = paths.length === 0 && !currentPath;

    return (
      <View style={styles.wrap}>
        <View ref={viewRef} collapsable={false} style={[styles.canvas, { height }]} {...panResponder.panHandlers}>
          {isEmpty ? <Text style={styles.placeholder}>Sign here</Text> : null}
          <Svg width="100%" height={height} style={StyleSheet.absoluteFill}>
            {paths.map((d, i) => (
              <Path key={i} d={d} stroke={strokeColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
            {currentPath ? (
              <Path d={currentPath} stroke={strokeColor} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
          </Svg>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            setPaths([]);
            setCurrentPath('');
            currentPathRef.current = '';
            onStrokeChange?.(true);
          }}
        >
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

export default SignaturePad;

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  canvas: {
    width: '100%',
    backgroundColor: SURFACE,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...SHADOW.level1,
  },
  placeholder: { color: SUBTLE, fontSize: 14, fontWeight: '500' },
  clearButton: { alignSelf: 'flex-end', marginTop: 8, paddingHorizontal: 12, paddingVertical: 6 },
  clearText: { color: EMERALD, fontSize: 13, fontWeight: '700' },
});
