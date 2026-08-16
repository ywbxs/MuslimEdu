import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Download } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchAdminMaterialReview, Material } from '../../services/materialService';
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

const CATEGORY_KEYS: Record<string, string> = {
  lecture_notes: 'notes',
  presentation: 'slides',
  video: 'video',
  audio: 'audio',
  worksheet: 'worksheet',
  reading: 'reading',
  other: 'resource',
};
const CATEGORY_LABELS: Record<string, string> = {
  lecture_notes: 'Notes',
  presentation: 'Slides',
  video: 'Video',
  audio: 'Audio',
  worksheet: 'Worksheet',
  reading: 'Reading',
  other: 'Resource',
};

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconDownload({ color, size = 13 }: { color: string; size?: number }) {
  return <Download size={size} color={color} strokeWidth={1.8} />;
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

// Read-only, school-wide review — same every-teacher-write-needs-an-
// admin-read counterpart as AdminAnnouncementReviewScreen. Filters by
// section using a chip row built from the sections actually present in
// the results (no separate class/section picker fetch), since the admin
// endpoint already returns everything school-wide in one call.
export default function AdminMaterialsReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<number | null>(null);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const list = await fetchAdminMaterialReview(token);
        setMaterials(list);
      } catch (e: any) {
        setError(e?.message ?? t('admin_materials_review.load_error', 'Could not load materials.'));
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

  const sectionOptions = useMemo(() => {
    const seen = new Map<number, string>();
    materials.forEach((m) => {
      if (!seen.has(m.section_id)) seen.set(m.section_id, m.section_name ?? `${t('admin_materials_review.section', 'Section')} ${m.section_id}`);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [materials, t]);

  const visible = sectionFilter ? materials.filter((m) => m.section_id === sectionFilter) : materials;

  return (
    <GlassBackground style={{ flex: 1, backgroundColor: CANVAS }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_materials_review.title', 'Materials Review')}</Text>
      </View>

      {sectionOptions.length > 0 ? (
        <FlatList
          horizontal
          data={[{ id: 0, name: t('admin_materials_review.all_sections', 'All sections') }, ...sectionOptions]}
          keyExtractor={(s) => String(s.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10 }}
          renderItem={({ item }) => {
            const active = item.id === 0 ? sectionFilter === null : sectionFilter === item.id;
            return (
              <TouchableOpacity
                onPress={() => setSectionFilter(item.id === 0 ? null : item.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            );
          }}
        />
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
          <MaterialCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 24 }}
          onRefresh={() => {
            setIsRefreshing(true);
            load({ silent: true });
          }}
          refreshing={isRefreshing}
          ListEmptyComponent={<Text style={styles.emptyText}>{t('admin_materials_review.empty', 'No materials uploaded yet.')}</Text>}
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
                    {t(`admin_materials_review.category_${CATEGORY_KEYS[item.category] ?? 'resource'}`, CATEGORY_LABELS[item.category] ?? 'Resource')}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardMeta}>
                {item.section_name} · {item.subject_name}
                {item.week_label ? ` · ${item.week_label}` : ''}
              </Text>
              <Text style={styles.cardMetaSub}>
                {item.teacher_name} · {item.uploaded_at}
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
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F0F1F3',
    marginRight: 8,
  },
  chipActive: { backgroundColor: EMERALD },
  chipText: { fontSize: 12.5, color: INK, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
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
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 8 },
  cardMetaSub: { fontSize: 11, color: SUBTLE, marginTop: 2 },
  downloadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  downloadText: { flex: 1, fontSize: 12.5, color: EMERALD, fontWeight: '600' },
  emptyText: { textAlign: 'center', color: SUBTLE, marginTop: 40, fontSize: 13.5 },
});
