import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, MapPin, Paperclip } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchStudentAnnouncements, Announcement } from '../../services/announcementService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#1FAE64';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return <ChevronLeft size={size} color={color} strokeWidth={2.4} />;
}
function IconPin({ color, size = 15 }: { color: string; size?: number }) {
  return <MapPin size={size} color={color} strokeWidth={1.6} />;
}
function IconPaperclip({ color, size = 14 }: { color: string; size?: number }) {
  return <Paperclip size={size} color={color} strokeWidth={1.8} />;
}

function AnnouncementCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="55%" height={14} borderRadius={4} />
      <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Read-only feed of announcements for the student's current section —
// whole-class posts plus anything posted by subject teachers for
// subjects taught in that section. Same visual language as
// TeacherAnnouncementsScreen, minus compose/delete controls.
export default function StudentAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const list = await fetchStudentAnnouncements(token);
        setAnnouncements(list);
      } catch (e: any) {
        setError(e?.message ?? t('student_announcements.load_error', 'Could not load announcements.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, t]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('student_announcements.title', 'Announcements')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <AnnouncementCardSkeleton />
          <AnnouncementCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>{t('student_announcements.empty', 'No announcements yet for your class.')}</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTopRow}>
                {item.is_pinned ? <IconPin color={EMERALD} /> : null}
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              {item.attachment_url ? (
                <TouchableOpacity
                  style={styles.attachmentRow}
                  onPress={() => Linking.openURL(item.attachment_url as string)}
                >
                  <IconPaperclip color={EMERALD} />
                  <Text style={styles.attachmentText} numberOfLines={1}>
                    {item.attachment_name ?? t('student_announcements.attachment', 'Attachment')}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.cardMeta}>
                {item.teacher_name ?? t('student_announcements.teacher', 'Teacher')} · {item.subject_name ?? t('student_announcements.whole_class', 'Whole class')} · {item.posted_at}
              </Text>
            </View>
          )}
        />
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK, marginLeft: 8 },
  errorBanner: { marginHorizontal: 16, marginBottom: 8, padding: 10, borderRadius: 10, backgroundColor: '#FDECEC' },
  errorText: { color: '#B3261E', fontSize: 13 },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: GLASS_SURFACE,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    marginBottom: 12,
    ...SHADOW.card,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  cardBody: { fontSize: 13.5, color: INK, marginTop: 6, lineHeight: 19 },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: EMERALD_SOFT,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: '100%',
  },
  attachmentText: { fontSize: 12.5, color: EMERALD, fontWeight: '600' },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 8 },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
});
