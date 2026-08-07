import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { fetchActiveWidgetAnnouncements, WidgetAnnouncement } from '../../services/widgetAnnouncementService';
import { RADIUS, SHADOW } from '../../theme/glass';
import PrayerTimesCard from './PrayerTimesCard';
import { CARD_W as OUTER_CARD_W } from './deckMetrics';
import { CARD_W, EDGE, GAP, SNAP, END_PAD } from './widgetCarouselMetrics';

type WidgetItem = { kind: 'prayer' } | { kind: 'announcement'; announcement: WidgetAnnouncement };

function AnnouncementImageCard({ announcement, height, onPress }: { announcement: WidgetAnnouncement; height: number; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.announcementCard, { width: CARD_W, height }]}>
      <Image source={{ uri: announcement.image_url }} style={styles.announcementImage} resizeMode="cover" />
    </TouchableOpacity>
  );
}

/**
 * Nested horizontal carousel dropped into the outer feed deck's `{ kind:
 * 'widgets' }` slot (see FeedScreen.tsx). Prayer Times card always first,
 * then any active superadmin-uploaded announcement images. Owns its own
 * data loading rather than being prop-drilled from FeedScreen, since it's
 * orthogonal to posts.
 */
export default function WidgetCarousel({ height, active }: { height: number; active?: boolean }) {
  const { token } = useAuth();
  const navigation = useNavigation();
  const [announcements, setAnnouncements] = useState<WidgetAnnouncement[]>([]);

  const load = useCallback(() => {
    if (!token) return;
    fetchActiveWidgetAnnouncements(token)
      .then((rows) => setAnnouncements(rows.filter((a) => a.active)))
      .catch(() => {
        // Announcements are a bonus, not required content - the Prayer
        // Times card still renders even if this call fails.
      });
  }, [token]);

  useEffect(() => {
    if (active) load();
  }, [active, load]);

  if (!token) return null;

  const items: WidgetItem[] = [{ kind: 'prayer' }, ...announcements.map((a) => ({ kind: 'announcement' as const, announcement: a }))];

  const cardHeight = Math.min(height, 320);

  return (
    <View style={[styles.wrap, { width: OUTER_CARD_W, height }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => (item.kind === 'prayer' ? 'prayer' : `announcement-${item.announcement.id}`)}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={SNAP}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ paddingLeft: EDGE, paddingRight: END_PAD, alignItems: 'center' }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        renderItem={({ item }) =>
          item.kind === 'prayer' ? (
            <PrayerTimesCard token={token} />
          ) : (
            <AnnouncementImageCard
              announcement={item.announcement}
              height={cardHeight}
              onPress={() =>
                (navigation as any).navigate('ImageViewer', { images: [item.announcement.image_url], initialIndex: 0 })
              }
            />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
  announcementCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.level2,
  },
  announcementImage: { width: '100%', height: '100%' },
});
