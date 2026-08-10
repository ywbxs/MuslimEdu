import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';

const DEFAULT_RING = '#FFFFFF';
const DEFAULT_FILL = '#2BCBB0';

/**
 * The one avatar look used everywhere in the app: a ring-bordered circle
 * with the photo (or initial, if there's no photo / it fails to load)
 * inside, plus a small status dot overlapping the ring's edge.
 *
 * `photo` should already be an absolutized URL (every service in this app
 * runs backend photo paths through config/api's absoluteUrl() before this
 * component ever sees them - StudentSummary, AuthUser, OverviewChild, etc.
 * all do this at the fetch layer) so passing user.photo / item.photo
 * straight through keeps every avatar in sync with whatever the backend
 * has on file, with no extra wiring needed here.
 *
 * No status dot by default - pass an explicit `dotColor` (e.g. an
 * active/inactive or attendance-status color) where a dot is actually
 * meaningful. Plain profile avatars (dashboard headers, composers, post
 * authors) show no dot at all.
 */
export default function UserAvatar({
  name,
  photo,
  size = 56,
  ringColor = DEFAULT_RING,
  fillColor = DEFAULT_FILL,
  dotColor = null,
  textColor = '#FFFFFF',
  style,
}: {
  name: string;
  photo?: string | null;
  size?: number;
  ringColor?: string;
  fillColor?: string;
  dotColor?: string | null;
  textColor?: string;
  style?: object;
}) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const initial = name?.trim()?.[0]?.toUpperCase() ?? '?';
  size = Math.round(size);

  // Proportions lifted from the original hero avatar (62 ring / 50 inner /
  // 14 dot) so every size in the app - a 40px list row, a 62px header, a
  // 76px profile sheet - reads as the exact same shape, just scaled.
  //
  // All derived values are rounded to whole pixels. On Android, a circular
  // view (borderRadius === width/2) combined with a fractional width/height
  // or a fractional borderRadius makes the GPU-rasterized elevation shadow
  // rasterize the clip path into a faceted/jagged polygon instead of a
  // smooth circle - the "halo" artifact. Keeping every size and radius an
  // integer keeps the clip path (and therefore the shadow) round.
  const ringWidth = Math.round(Math.max(1.5, size * 0.032));
  const innerSize = Math.round(size * 0.806);
  const dotSize = Math.round(size * 0.226);
  const dotOffset = -Math.round(size * 0.032);
  const showPhoto = !!photo && !photoFailed;

  // borderRadius is derived separately (not just size/2) because size/2 is
  // fractional whenever size is odd - same integer-clip-path reasoning as
  // above, just applied to the radius rather than the width/height.
  const outerRadius = Math.round(size / 2);
  const innerRadius = Math.round(innerSize / 2);
  const dotRadius = Math.round(dotSize / 2);

  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: outerRadius, borderWidth: ringWidth, borderColor: ringColor },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photo as string }}
          style={{ width: innerSize, height: innerSize, borderRadius: innerRadius, backgroundColor: '#F0F0F0' }}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.inner,
            { width: innerSize, height: innerSize, borderRadius: innerRadius, backgroundColor: fillColor },
          ]}
        >
          <Text style={{ color: textColor, fontSize: innerSize * 0.4, fontWeight: '700' }}>{initial}</Text>
        </View>
      )}

      {dotColor ? (
        <View
          style={[
            styles.dot,
            {
              top: dotOffset,
              right: dotOffset,
              width: dotSize,
              height: dotSize,
              borderRadius: dotRadius,
              backgroundColor: dotColor,
              borderWidth: ringWidth,
              borderColor: ringColor,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
    // Elevation shadows on Android are rasterized against the view's clip
    // path; on a circular view this reliably produces a jagged/faceted
    // "halo" ring around the avatar instead of a soft shadow. iOS's
    // shadow*/shadowOffset/shadowRadius render cleanly as a true blurred
    // drop shadow, so we keep those there and simply drop elevation on
    // Android rather than fight the renderer for a shadow effect it can't
    // do well on a circle.
    ...Platform.select({
      ios: {
        shadowColor: '#0B1F14',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  inner: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute' },
});
