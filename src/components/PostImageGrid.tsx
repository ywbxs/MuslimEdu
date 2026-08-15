import React from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text } from 'react-native';

const GAP = 3;
const IMAGE_RADIUS = 18;
// Default single-image shape: a slightly-taller-than-wide rectangle (the
// original ratio this always had). The Home feed overrides this to a true
// 4:3 via the aspectRatio prop below - scoped there only, since other
// callers (moderation queue, profile modal, quoted reposts) keep this look.
const DEFAULT_ASPECT_RATIO = 1 / 1.05;

interface Props {
  images: string[];
  onPressImage?: (index: number) => void;
  maxHeight?: number;
  // Explicit pixel width for callers that know their own fixed container
  // width up front (e.g. a fixed-width card). Omit to fill the parent's own
  // width instead - the default, and the only thing every current caller
  // actually uses. A previous version computed its own pixel width from
  // Dimensions.get('window').width minus an assumed card margin, which
  // silently went stale the moment a caller (the Home feed) overrode that
  // margin independently - the image rendered narrower than the space it
  // actually had, leaving a gap on one side. Filling the parent can't drift
  // out of sync like that, since it's not duplicating an assumption about
  // what the parent's own layout is doing.
  width?: number;
  // Overrides IMAGE_RADIUS - the Home feed's edge-to-edge cards square this
  // off to 0 so a full-bleed photo doesn't show rounded corners floating
  // mid-image against the card's own square edges. Omit to keep the default
  // rounded look every other caller (moderation queue, profile modal, quoted
  // reposts) already has.
  radius?: number;
  // Overrides DEFAULT_ASPECT_RATIO for the single-image case only (2+ image
  // layouts already use fixed pixel heights, unaffected by this). The Home
  // feed passes 4/3 here; omit to keep the default ratio.
  aspectRatio?: number;
}

/**
 * Lays out 1-6 images the way most feed apps do:
 *   1 image  -> full width, natural-ish tall rectangle
 *   2 images -> side by side, even split
 *   3 images -> one big on the left, two stacked on the right
 *   4 images -> even 2x2 grid
 *   5-6      -> 2x2 grid of the first 3, "+N" overlay on the 4th tile
 */
export default function PostImageGrid({ images, onPressImage, maxHeight = 320, width, radius, aspectRatio }: Props) {
  if (!images || images.length === 0) return null;

  const W: number | `${number}%` = width ?? '100%';
  const R = radius ?? IMAGE_RADIUS;
  const AR = aspectRatio ?? DEFAULT_ASPECT_RATIO;
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
    <TouchableOpacity activeOpacity={0.9} style={[style, { borderRadius: R }]} onPress={() => tap(index)}>
      <Image source={{ uri }} style={styles.fill} resizeMode="cover" />
      {!!overlayCount && (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>+{overlayCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  if (images.length === 1) {
    // aspectRatio (not a computed pixel height) so this holds its shape
    // regardless of whether W ends up a number or a '100%' string.
    return (
      <View style={[styles.wrap, { width: W, aspectRatio: AR, maxHeight, borderRadius: R }]}>
        <Tile uri={images[0]} style={styles.fill} index={0} />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View style={[styles.wrap, styles.row, { width: W, height: 200, borderRadius: R }]}>
        <Tile uri={images[0]} style={[styles.half, { marginRight: GAP / 2 }]} index={0} />
        <Tile uri={images[1]} style={[styles.half, { marginLeft: GAP / 2 }]} index={1} />
      </View>
    );
  }

  if (images.length === 3) {
    return (
      <View style={[styles.wrap, styles.row, { width: W, height: 240, borderRadius: R }]}>
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
    <View style={[styles.wrap, { width: W, height: 240, borderRadius: R }]}>
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
  wrap: { overflow: 'hidden', backgroundColor: '#F0F1F2' },
  row: { flexDirection: 'row', width: '100%', height: '100%' },
  half: { flex: 1, position: 'relative', overflow: 'hidden' },
  fill: { width: '100%', height: '100%', position: 'relative' },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
});
