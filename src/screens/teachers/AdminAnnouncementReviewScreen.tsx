import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, MapPin, Paperclip } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchClasses, fetchSections, ClassOption, SectionOption } from '../../services/adminService';
import { fetchAdminAnnouncementReview, Announcement } from '../../services/announcementService';
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

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconPin({ color, size = 14 }: { color: string; size?: number }) {
  return <MapPin size={size} color={color} strokeWidth={1.6} />;
}
function IconPaperclip({ color, size = 13 }: { color: string; size?: number }) {
  return <Paperclip size={size} color={color} strokeWidth={1.8} />;
}

// Same generic chip-picker used by AdminGradebookReviewScreen — kept
// identical here on purpose so the two review screens feel like one
// family rather than two one-off designs.
function Picker<T extends { id: number; name: string }>({
  label,
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  label: string;
  options: T[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  const { t } = useLocale();
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chipWrap}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.id}
            disabled={disabled}
            style={[styles.chip, selectedId === opt.id ? styles.chipActive : null, disabled ? styles.chipDisabled : null]}
            onPress={() => onSelect(opt.id)}
          >
            <Text style={[styles.chipText, selectedId === opt.id ? styles.chipTextActive : null]}>{opt.name}</Text>
          </TouchableOpacity>
        ))}
        {options.length === 0 ? <Text style={styles.emptyPickerText}>{t('admin_announcement_review.nothing_available', 'Nothing available yet.')}</Text> : null}
      </View>
    </View>
  );
}

// Admin's read-only counterpart to the teacher's Announcements screen:
// pick class -> section, then see every announcement posted to that
// section (whole-class and subject-scoped), newest/pinned first —
// exactly as students there would see it.
export default function AdminAnnouncementReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);

  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoadingFilters(true);
    fetchClasses(token)
      .then(setClasses)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_announcement_review.classes_error', 'Could not load classes.')))
      .finally(() => setIsLoadingFilters(false));
  }, [token, t]);

  const onSelectClass = useCallback(
    (id: number) => {
      setClassId(id);
      setSectionId(null);
      setAnnouncements([]);
      if (!token) return;
      setIsLoadingSections(true);
      fetchSections(token, String(id))
        .then(setSections)
        .catch((err) => setError(err instanceof Error ? err.message : t('admin_announcement_review.sections_error', 'Could not load sections.')))
        .finally(() => setIsLoadingSections(false));
    },
    [token, t]
  );

  const loadReview = useCallback(() => {
    if (!token || !sectionId) return;
    setIsLoadingReview(true);
    setError(null);
    fetchAdminAnnouncementReview(token, sectionId)
      .then(setAnnouncements)
      .catch((err) => setError(err instanceof Error ? err.message : t('admin_announcement_review.announcements_error', 'Could not load announcements.')))
      .finally(() => setIsLoadingReview(false));
  }, [token, sectionId, t]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={INK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('admin_announcement_review.title', 'Announcements Review')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <>
            {error ? (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
            {isLoadingFilters ? (
              <Skeleton width="100%" height={80} borderRadius={12} />
            ) : (
              <>
                <Picker label={t('admin_announcement_review.class', 'Class')} options={classes} selectedId={classId} onSelect={onSelectClass} />
                {classId ? (
                  isLoadingSections ? (
                    <Skeleton width="100%" height={40} borderRadius={12} style={{ marginTop: 8 }} />
                  ) : (
                    <Picker label={t('admin_announcement_review.section', 'Section')} options={sections} selectedId={sectionId} onSelect={setSectionId} />
                  )
                ) : null}
              </>
            )}
            {isLoadingReview ? (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <ActivityIndicator color={EMERALD} />
              </View>
            ) : null}
            {!isLoadingReview && sectionId && announcements.length === 0 && !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{t('admin_announcement_review.empty_title', 'No announcements yet')}</Text>
                <Text style={styles.emptyDesc}>{t('admin_announcement_review.empty_desc', 'Nothing has been posted to this section so far.')}</Text>
              </View>
            ) : null}
          </>
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
                  {item.attachment_name ?? t('admin_announcement_review.attachment', 'Attachment')}
                </Text>
              </TouchableOpacity>
            ) : null}
            <Text style={styles.cardMeta}>
              {item.teacher_name ?? t('admin_announcement_review.teacher', 'Teacher')} · {item.subject_name ?? t('admin_announcement_review.whole_class', 'Whole class')} · {item.posted_at}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: GLASS_SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: GLASS_BORDER,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  listContent: { padding: 16 },

  pickerBlock: { marginBottom: 14 },
  pickerLabel: { fontSize: 12, color: SUBTLE, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: GLASS_SURFACE, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, ...SHADOW.level1 },
  chipActive: { backgroundColor: EMERALD },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 12.5, fontWeight: '700', color: INK },
  chipTextActive: { color: '#FFFFFF' },
  emptyPickerText: { fontSize: 12.5, color: SUBTLE },

  card: {
    backgroundColor: GLASS_SURFACE,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.level1,
  },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { flex: 1, fontSize: 14.5, fontWeight: '700', color: INK },
  cardBody: { fontSize: 13, color: INK, marginTop: 6, lineHeight: 18 },
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
  attachmentText: { fontSize: 12, color: EMERALD, fontWeight: '600' },
  cardMeta: { fontSize: 11.5, color: SUBTLE, marginTop: 8 },

  emptyWrap: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: INK, marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: SUBTLE, textAlign: 'center', lineHeight: 18 },
  errorBanner: { backgroundColor: '#FCEDED', borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: '#E5484D', fontSize: 13.5, textAlign: 'center' },
});
