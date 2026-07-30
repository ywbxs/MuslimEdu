import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const DEFAULT_RING = '#FFFFFF';
const DEFAULT_FILL = '#0F9D58';
const DEFAULT_DOT = '#5FE38A';

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
 * Pass `dotColor={null}` to hide the status dot entirely (e.g. inside the
 * profile bottom sheet, where a big centered avatar doesn't need one).
 */
export default function UserAvatar({
  name,
  photo,
  size = 56,
  ringColor = DEFAULT_RING,
  fillColor = DEFAULT_FILL,
  dotColor = DEFAULT_DOT,
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

  // Proportions lifted from the original hero avatar (62 ring / 50 inner /
  // 14 dot) so every size in the app - a 40px list row, a 62px header, a
  // 76px profile sheet - reads as the exact same shape, just scaled.
  const ringWidth = Math.max(1.5, size * 0.032);
  const innerSize = size * 0.806;
  const dotSize = size * 0.226;
  const dotOffset = -size * 0.032;
  const showPhoto = !!photo && !photoFailed;

  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderWidth: ringWidth, borderColor: ringColor },
        style,
      ]}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photo as string }}
          style={{ width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: '#F0F0F0' }}
          onError={() => setPhotoFailed(true)}
        />
      ) : (
        <View
          style={[
            styles.inner,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2, backgroundColor: fillColor },
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
              borderRadius: dotSize / 2,
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
  ring: { alignItems: 'center', justifyContent: 'center' },
  inner: { alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute' },
});
