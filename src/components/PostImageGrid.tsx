import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
// PostCard's image sits inside the card's own padding, which is already
// inset from the screen by the card's marginHorizontal. Match both so the
// image never touches or overflows the card's rounded edges.
const H_PADDING = 16 + 18; // card marginHorizontal + card paddingHorizontal
const GRID_WIDTH = SCREEN_WIDTH - H_PADDING * 2;
const GAP = 3;
const IMAGE_RADIUS = 18;

interface Props {
  images: string[];
  onPressImage?: (index: number) => void;
  maxHeight?: number;
  // Overrides GRID_WIDTH for callers that don't use the default full-width
  // vertical card (e.g. the fixed-width feed deck card) - omit to keep
  // today's behavior exactly as-is.
  width?: number;
}

/**
 * Lays out 1-6 images the way most feed apps do:
 *   1 image  -> full width, natural-ish tall rectangle
 *   2 images -> side by side, even split
 *   3 images -> one big on the left, two stacked on the right
 *   4 images -> even 2x2 grid
 *   5-6      -> 2x2 grid of the first 3, "+N" overlay on the 4th tile
 */
export default function PostImageGrid({ images, onPressImage, maxHeight = 320, width }: Props) {
  if (!images || images.length === 0) return null;

  const W = width ?? GRID_WIDTH;
  const tap = (index: number) => onPressImage?.(index);

  const Tile = ({
    uri,
    style,
    index,
    overlayCount,
  }: {
    uri: string;
    style: any;
    index: number;
    overlayCount?: number;
  }) => (
    <TouchableOpacity activeOpacity={0.9} style={style} onPress={() => tap(index)}>
      <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
      {!!overlayCount && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>+{overlayCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (images.length === 1) {
    return (
      <View style={[styles.wrap, { width: W, height: Math.min(maxHeight, W * 1.05) }]}>
        <Tile uri={images[0]} style={styles.fill} index={0} />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View style={[styles.wrap, styles.row, { width: W, height: 200 }]}>
        <Tile uri={images[0]} style={[styles.half, { marginRight: GAP / 2 }]} index={0} />
        <Tile uri={images[1]} style={[styles.half, { marginLeft: GAP / 2 }]} index={1} />
      </View>
    );
  }

  if (images.length === 3) {
    return (
      <View style={[styles.wrap, styles.row, { width: W, height: 240 }]}>
        <Tile uri={images[0]} style={[styles.half, { marginRight: GAP / 2 }]} index={0} />
        <View style={[styles.half, { marginLeft: GAP / 2 }]}>
          <Tile uri={images[1]} style={[styles.fill, { marginBottom: GAP / 2 }]} index={1} />
          <Tile uri={images[2]} style={[styles.fill, { marginTop: GAP / 2 }]} index={2} />
        </View>
      </View>
    );
  }

  // 4 or more -> 2x2 grid, overlay "+N" on the last visible tile
  const visible = images.slice(0, 4);
  const remaining = images.length - 4;

  return (
    <View style={[styles.wrap, { width: W, height: 240 }]}>
      <View style={[styles.row, { flex: 1, marginBottom: GAP / 2 }]}>
        <Tile uri={visible[0]} style={[styles.half, { marginRight: GAP / 2 }]} index={0} />
        <Tile uri={visible[1]} style={[styles.half, { marginLeft: GAP / 2 }]} index={1} />
      </View>
      <View style={[styles.row, { flex: 1, marginTop: GAP / 2 }]}>
        <Tile uri={visible[2]} style={[styles.half, { marginRight: GAP / 2 }]} index={2} />
        <Tile
          uri={visible[3]}
          style={[styles.half, { marginLeft: GAP / 2 }]}
          index={3}
          overlayCount={remaining > 0 ? remaining : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: GRID_WIDTH, borderRadius: IMAGE_RADIUS, overflow: 'hidden', backgroundColor: '#F0F1F2' },
  row: { flexDirection: 'row', width: '100%', height: '100%' },
  half: { flex: 1, position: 'relative', overflow: 'hidden', borderRadius: IMAGE_RADIUS },
  fill: { width: '100%', height: '100%', position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
});
