import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import {
  fetchTeacherReports,
  createTeacherReport,
  updateTeacherReport,
  deleteTeacherReport,
  TeacherReport,
} from '../../services/adminTeacherService';
import { Skeleton } from '../../components/Skeleton';
import PhotoLightbox from '../../components/PhotoLightbox';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#2BCBB0';
const EMERALD_SOFT = '#E5F8F5';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const DANGER = '#D70015';
const TRACK_BG = '#F4F5F7';
const GLASS_SURFACE = GLASS.fillOnLight;
const GLASS_SURFACE_STRONG = GLASS.fillOnLightStrong;
const GLASS_BORDER = GLASS.borderOnLight;

function RatingBox({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.ratingBox}>
      <Text style={styles.ratingBoxLabel}>{label}</Text>
      <Text style={styles.ratingBoxValue}>{value != null ? `${value}/5` : '—'}</Text>
    </View>
  );
}

function RatingSelector({ label, value, onChange }: { label: string; value: number | null; onChange: (n: number) => void }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.ratingRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.ratingPill, value === n && styles.ratingPillSelected]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.ratingPillText, value === n && styles.ratingPillTextSelected]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function formatMonth(monthStr: string) {
  const d = new Date(monthStr);
  if (isNaN(d.getTime())) return monthStr;
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Full-screen, tap-to-dismiss viewer for a report photo. */
export default function AdminTeacherReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { teacherId, teacherName } = (route.params as { teacherId: number; teacherName: string }) ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [reports, setReports] = useState<TeacherReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [note, setNote] = useState('');
  const [teachingRating, setTeachingRating] = useState<number | null>(null);
  const [engagementRating, setEngagementRating] = useState<number | null>(null);
  const [growthRating, setGrowthRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Non-null while editing an existing report - handleSave calls
  // updateTeacherReport instead of createTeacherReport. There's no separate
  // draft/approval status on this model, so editing IS the resubmission -
  // mirrors AdminChildReportDetailScreen.tsx.
  const [editingReportId, setEditingReportId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchTeacherReports(token, teacherId);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_teacher_report_detail.load_error', 'Failed to load reports.'));
    }
  }, [token, teacherId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const resetForm = () => {
    setShowForm(false);
    setEditingReportId(null);
    setNote('');
    setTeachingRating(null);
    setEngagementRating(null);
    setGrowthRating(null);
  };

  const handleSave = async () => {
    if (!token || !teachingRating || !engagementRating || !growthRating) {
      Alert.alert(
        t('admin_teacher_report_detail.almost_done', 'Almost done'),
        t('admin_teacher_report_detail.select_all_ratings', 'Please select all three ratings.'),
      );
      return;
    }
    setIsSubmitting(true);
    try {
      const fields = {
        note,
        teaching_effectiveness_rating: teachingRating,
        classroom_engagement_rating: engagementRating,
        professional_growth_rating: growthRating,
      };
      if (editingReportId) {
        await updateTeacherReport(token, editingReportId, fields);
        Alert.alert(t('admin_teacher_report_detail.report_updated', 'Report updated'), t('admin_teacher_report_detail.report_updated_message', 'This report was updated.'));
      } else {
        await createTeacherReport(token, teacherId, fields);
        Alert.alert(
          t('admin_teacher_report_detail.report_added', 'Report added'),
          t('admin_teacher_report_detail.report_added_message', 'A report was added for {name}.').replace('{name}', teacherName),
        );
      }
      resetForm();
      await load();
    } catch (err) {
      Alert.alert(t('admin_teacher_report_detail.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (report: TeacherReport) => {
    setEditingReportId(report.id);
    setNote(report.note ?? '');
    setTeachingRating(report.teaching_effectiveness_rating);
    setEngagementRating(report.classroom_engagement_rating);
    setGrowthRating(report.professional_growth_rating);
    setShowForm(true);
  };

  const handleDelete = (reportId: number) => {
    Alert.alert(
      t('admin_teacher_report_detail.delete_title', 'Delete report'),
      t('admin_teacher_report_detail.delete_message', 'This cannot be undone. Continue?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('admin_teacher_report_detail.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteTeacherReport(token, reportId);
              await load();
            } catch (err) {
              Alert.alert(t('admin_teacher_report_detail.delete_error', 'Could not delete'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{teacherName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.scrollContent}>
          <Skeleton width={80} height={12} style={{ marginBottom: 10 }} />
          {[0, 1].map((i) => (
            <View key={i} style={styles.reportCard}>
              <Skeleton width={140} height={15} style={{ marginBottom: 12 }} />
              <Skeleton width="90%" height={11} style={{ marginBottom: 6 }} />
              <Skeleton width="60%" height={11} />
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={styles.retryButton}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!showForm && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>+ {t('admin_teacher_report_detail.add_report', 'Add Report on Their Behalf')}</Text>
            </TouchableOpacity>
          )}

          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingReportId
                  ? t('admin_teacher_report_detail.edit_report', 'Edit Report')
                  : t('admin_teacher_report_detail.new_report', 'New Report')}
              </Text>
              <TextInput
                style={styles.noteInput}
                placeholder={t('admin_teacher_report_detail.note_placeholder', 'Write a short note...')}
                placeholderTextColor={SUBTLE}
                multiline
                value={note}
                onChangeText={setNote}
              />
              <RatingSelector label={t('admin_teacher_report_detail.teaching', 'Teaching')} value={teachingRating} onChange={setTeachingRating} />
              <RatingSelector label={t('admin_teacher_report_detail.engagement', 'Engagement')} value={engagementRating} onChange={setEngagementRating} />
              <RatingSelector label={t('admin_teacher_report_detail.growth', 'Growth')} value={growthRating} onChange={setGrowthRating} />

              <View style={styles.formButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={resetForm}>
                  <Text style={styles.cancelButtonText}>{t('common.cancel', 'Cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>
                      {editingReportId
                        ? t('admin_teacher_report_detail.update_report', 'Update Report')
                        : t('admin_teacher_report_detail.save_report', 'Save Report')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>{t('admin_teacher_report_detail.history', 'History')}</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin_teacher_report_detail.empty', 'No monthly reports submitted yet.')}</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportMonth}>{formatMonth(report.report_month)}</Text>
                  <View style={styles.reportCardActions}>
                    <TouchableOpacity onPress={() => handleEdit(report)} hitSlop={8}>
                      <Text style={styles.editText}>{t('admin_teacher_report_detail.edit', 'Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(report.id)} hitSlop={8}>
                      <Text style={styles.deleteText}>{t('admin_teacher_report_detail.delete', 'Delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.ratingsRow}>
                  <RatingBox label={t('admin_teacher_report_detail.teaching', 'Teaching')} value={report.teaching_effectiveness_rating} />
                  <RatingBox label={t('admin_teacher_report_detail.engagement', 'Engagement')} value={report.classroom_engagement_rating} />
                  <RatingBox label={t('admin_teacher_report_detail.growth', 'Growth')} value={report.professional_growth_rating} />
                </View>

                {report.note ? <Text style={styles.reportNote}>{report.note}</Text> : null}

                {report.photos.length > 0 && (
                  <View style={styles.photoGrid}>
                    {report.photos.map((url, index) => (
                      <TouchableOpacity
                        key={url}
                        activeOpacity={0.85}
                        onPress={() => setLightbox({ photos: report.photos, index })}
                      >
                        <Image source={{ uri: url }} style={styles.photoThumb} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <View style={styles.reportFooterRow}>
                  <View style={styles.submittedByDot} />
                  <Text style={styles.reportSubmittedBy}>
                    {t('admin_teacher_report_detail.submitted_by', 'Submitted by')} {report.submitted_by ?? t('admin_teacher_report_detail.staff_member', 'a staff member')}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <PhotoLightbox
        visible={!!lightbox}
        photos={lightbox?.photos ?? []}
        initialIndex={lightbox?.index ?? 0}
        onClose={() => setLightbox(null)}
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
    borderBottomColor: '#F0F0F0',
  },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: INK, flex: 1, textAlign: 'center', marginHorizontal: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  scrollContent: { padding: 18, paddingBottom: 40 },

  sectionLabel: { fontSize: 13, fontWeight: '700', color: SUBTLE, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  emptyText: { color: SUBTLE, fontSize: 14 },

  addButton: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: { color: EMERALD, fontWeight: '700', fontSize: 14 },

  formCard: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...SHADOW.level1,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 14 },
  noteInput: {
    backgroundColor: TRACK_BG,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    color: INK,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: INK, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ratingPill: { width: 44, height: 44, borderRadius: 22, backgroundColor: TRACK_BG, alignItems: 'center', justifyContent: 'center' },
  ratingPillSelected: { backgroundColor: EMERALD },
  ratingPillText: { fontSize: 15, fontWeight: '600', color: INK },
  ratingPillTextSelected: { color: '#FFFFFF' },
  formButtonRow: { flexDirection: 'row', marginTop: 4 },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  cancelButtonText: { color: SUBTLE, fontWeight: '600' },
  submitButton: { flex: 2, backgroundColor: EMERALD, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },

  // --- Big report card ---
  reportCard: {
    backgroundColor: GLASS_SURFACE_STRONG,
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    ...SHADOW.level2,
  },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  reportMonth: { fontWeight: '800', color: INK, fontSize: 18 },
  reportCardActions: { flexDirection: 'row', gap: 16 },
  editText: { color: EMERALD, fontSize: 13, fontWeight: '600' },
  deleteText: { color: DANGER, fontSize: 13, fontWeight: '600' },
  reportNote: { color: INK, fontSize: 14.5, lineHeight: 21, marginBottom: 14, marginTop: 2 },

  ratingsRow: { flexDirection: 'row', marginBottom: 14, gap: 10 },
  ratingBox: {
    flex: 1,
    backgroundColor: TRACK_BG,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingBoxLabel: { fontSize: 11.5, color: SUBTLE, marginBottom: 4, fontWeight: '600' },
  ratingBoxValue: { fontSize: 17, fontWeight: '800', color: EMERALD },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  photoThumb: { width: 92, height: 92, borderRadius: 16, backgroundColor: TRACK_BG },

  reportFooterRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  submittedByDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: EMERALD, marginRight: 8 },
  reportSubmittedBy: { fontSize: 12.5, color: SUBTLE, fontStyle: 'italic' },
});
