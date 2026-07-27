import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchStudentMaterials, Material } from '../../services/materialService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const CANVAS = '#F6F7F9';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_BORDER = GLASS.borderOnLight;

const CATEGORY_LABELS: Record<string, string> = {
  lecture_notes: 'Notes',
  presentation: 'Slides',
  video: 'Video',
  audio: 'Audio',
  worksheet: 'Worksheet',
  reading: 'Reading',
  other: 'Resource',
};

function IconChevronLeft({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconDownload({ color, size = 14 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12m0 0l-4-4m4 4l4-4M5 19h14" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MaterialCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="55%" height={14} borderRadius={4} />
      <Skeleton width="90%" height={12} borderRadius={4} style={{ marginTop: 10 }} />
      <Skeleton width="35%" height={11} borderRadius={4} style={{ marginTop: 10 }} />
    </View>
  );
}

// Read-only resource library for the student's current section — every
// material a teacher has uploaded for a subject they're taking. Same
// visual language as StudentAnnouncementsScreen, tap a card to open/
// download the file via the device's default handler.
export default function StudentMaterialsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const list = await fetchStudentMaterials(token);
        setMaterials(list);
      } catch (e: any) {
        setError(e?.message ?? 'Could not load materials.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
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
        <Text style={styles.headerTitle}>Materials</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={materials}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No materials shared for your classes yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => Linking.openURL(item.file_url)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryBadgeText}>
                    {CATEGORY_LABELS[item.category] ?? 'Resource'}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.cardBody} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              <Text style={styles.cardMeta}>
                {item.subject_name}
                {item.week_label ? ` · ${item.week_label}` : ''} · {item.teacher_name}
              </Text>
              <View style={styles.downloadRow}>
                <IconDownload color={EMERALD} />
                <Text style={styles.downloadText} numberOfLines={1}>
                  {item.file_name}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
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
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: INK },
  categoryBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: EMERALD_SOFT,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', color: EMERALD },
  cardBody: { fontSize: 13.5, color: INK, marginTop: 6, lineHeight: 19 },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 8 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  downloadText: { flex: 1, fontSize: 12.5, color: EMERALD, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
});
