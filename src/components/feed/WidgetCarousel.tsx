import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { fetchActiveWidgetAnnouncements, WidgetAnnouncement } from '../../services/widgetAnnouncementService';
import { RADIUS, SHADOW } from '../../theme/glass';
import PrayerTimesCard from './PrayerTimesCard';
import { CARD_W, EDGE, GAP, SNAP, END_PAD } from './widgetCarouselMetrics';

const ROW_HEIGHT = 210;

type WidgetItem = { kind: 'prayer' } | { kind: 'announcement'; announcement: WidgetAnnouncement };

function AnnouncementImageCard({ announcement, onPress }: { announcement: WidgetAnnouncement; onPress: () => void }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[styles.announcementCard, { width: CARD_W, height: ROW_HEIGHT }]}>
      <Image source={{ uri: announcement.image_url }} style={styles.announcementImage} resizeMode="cover" />
    </TouchableOpacity>
  );
}

/**
 * Its own item in the vertical Home feed (see FeedScreen.tsx's deckData,
 * WIDGETS_AFTER_POSTS) - pinned to a fixed, early-but-not-first position
 * among the posts rather than a header/footer, so it reads as a distinct
 * section roughly centered within the feed instead of tacked onto either
 * end. A plain horizontal row, sized to its own compact height rather
 * than a full post card's. Prayer Times card always first, then any
 * active superadmin-uploaded announcement images. Owns its own data
 * loading, refreshed whenever the Home tab regains focus.
 */
export default function WidgetCarousel() {
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

  useFocusEffect(load);

  if (!token) return null;

  const items: WidgetItem[] = [{ kind: 'prayer' }, ...announcements.map((a) => ({ kind: 'announcement' as const, announcement: a }))];

  return (
    <View style={[styles.wrap, { height: ROW_HEIGHT }]}>
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
  wrap: { justifyContent: 'center', marginTop: 16 },
  announcementCard: {
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.level2,
  },
  announcementImage: { width: '100%', height: '100%' },
});
