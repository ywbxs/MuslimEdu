import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
// Images bleed all the way to the actual screen edges (Facebook-style),
// breaking out of both the card's own inner padding AND its outer margin
// from the screen - PostCard's imageWrap cancels both out with a matching
// negative marginHorizontal, so there's nothing left to reserve here.
const GRID_WIDTH = SCREEN_WIDTH;
const GAP = 3;
// Flush with the screen edges now (see GRID_WIDTH above), so rounding the
// corners would look like a mistake rather than a card - straight edges.
const IMAGE_RADIUS = 0;
// A single image's box follows its own natural aspect ratio (see below)
// rather than a fixed crop - this only bounds how tall that can get, so a
// portrait screenshot/poster can't push the rest of the feed off-screen.
const DEFAULT_MAX_SINGLE_IMAGE_HEIGHT = SCREEN_HEIGHT * 0.85;

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
 *   1 image  -> full width, natural aspect ratio (capped height)
 *   2 images -> side by side, even split
 *   3 images -> one big on the left, two stacked on the right
 *   4 images -> even 2x2 grid
 *   5-6      -> 2x2 grid of the first 3, "+N" overlay on the 4th tile
 */
export default function PostImageGrid({ images, onPressImage, maxHeight = DEFAULT_MAX_SINGLE_IMAGE_HEIGHT, width }: Props) {
  // A single image shows at its real proportions instead of being cropped
  // into a fixed box (like Facebook's own "cover photo" posts) - needs the
  // source's natural size, which only `Image.getSize` can tell us for a
  // remote uri. Hooks can't sit after the early-return below, so this runs
  // unconditionally and just no-ops when there isn't exactly one image.
  const singleUri = images && images.length === 1 ? images[0] : null;
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!singleUri) {
      setNaturalRatio(null);
      return;
    }
    setNaturalRatio(null);
    let cancelled = false;
    Image.getSize(
      singleUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNaturalRatio(h / w);
      },
      () => {
        // Falls back to the 4:3-ish guess below and just stays there.
      },
    );
    return () => {
      cancelled = true;
    };
  }, [singleUri]);

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
    const ratio = naturalRatio ?? 0.75; // 4:3-ish guess until Image.getSize resolves
    return (
      <View style={[styles.wrap, { width: W, height: Math.min(maxHeight, ratio * W) }]}>
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700' },
});
