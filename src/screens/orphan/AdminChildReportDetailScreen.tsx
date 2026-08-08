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
import { MonthlyReport } from '../../services/orphanService';
import {
  fetchChildReports,
  createChildReport,
  updateChildReport,
  deleteChildReport,
} from '../../services/adminOrphanReportService';
import { Skeleton } from '../../components/Skeleton';
import RatingGauge from '../../components/RatingGauge';
import PhotoLightbox from '../../components/PhotoLightbox';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW } from '../../theme/spatial';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#EAF7EF';
const GOLD = '#B8912F';
const INK = '#14171A';
const SUBTLE = '#7A8078';
const DANGER = '#E0637A';
const CANVAS = '#F3F5F2';

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

export default function AdminChildReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { studentId, studentName } = (route.params as { studentId: number; studentName: string }) ?? {};
  const { token } = useAuth();
  const { t } = useLocale();

  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [note, setNote] = useState('');
  const [academicRating, setAcademicRating] = useState<number | null>(null);
  const [wellbeingRating, setWellbeingRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Non-null while editing an existing report - handleSave calls
  // updateChildReport instead of createChildReport, and the form is
  // pre-filled from that report. There's no separate draft/approval status
  // on this model, so editing an existing month's report IS the resubmission.
  const [editingReportId, setEditingReportId] = useState<number | null>(null);

  // Full-screen photo viewer state - which report's photos are open, and
  // at which index, so PhotoLightbox can be a single shared instance for
  // the whole screen instead of one per report card.
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxVisible, setLightboxVisible] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchChildReports(token, studentId);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_child_report_detail.load_error', 'Failed to load reports.'));
    }
  }, [token, studentId, t]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const resetForm = () => {
    setShowForm(false);
    setEditingReportId(null);
    setNote('');
    setAcademicRating(null);
    setWellbeingRating(null);
  };

  const handleSave = async () => {
    if (!token || !academicRating || !wellbeingRating) {
      Alert.alert(t('admin_child_report_detail.almost_done', 'Almost done'), t('admin_child_report_detail.select_both_ratings', 'Please select both ratings.'));
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingReportId) {
        await updateChildReport(token, editingReportId, {
          note,
          academic_rating: academicRating,
          wellbeing_rating: wellbeingRating,
        });
        Alert.alert(t('admin_child_report_detail.report_updated', 'Report updated'), t('admin_child_report_detail.report_updated_message', "This report was updated."));
      } else {
        await createChildReport(
          token,
          studentId,
          { note, academic_rating: academicRating, wellbeing_rating: wellbeingRating },
        );
        Alert.alert(t('admin_child_report_detail.report_added', 'Report added'), t('admin_child_report_detail.report_added_message', 'A report was added for {name}.').replace('{name}', studentName));
      }
      resetForm();
      await load();
    } catch (err) {
      Alert.alert(t('admin_child_report_detail.error_title', 'Something went wrong'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (report: MonthlyReport) => {
    setEditingReportId(report.id);
    setNote(report.note ?? '');
    setAcademicRating(report.academic_rating);
    setWellbeingRating(report.wellbeing_rating);
    setShowForm(true);
  };

  const handleDelete = (reportId: number) => {
    Alert.alert(t('admin_child_report_detail.delete_title', 'Delete report'), t('admin_child_report_detail.delete_message', 'This cannot be undone. Continue?'), [
      { text: t('common.cancel', 'Cancel'), style: 'cancel' },
      {
        text: t('admin_child_report_detail.delete', 'Delete'),
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteChildReport(token, reportId);
            await load();
          } catch (err) {
            Alert.alert(t('admin_child_report_detail.delete_error', 'Could not delete'), err instanceof Error ? err.message : t('common.try_again_full', 'Please try again.'));
          }
        },
      },
    ]);
  };

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{studentName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.scrollContent}>
          <Skeleton width="100%" height={52} borderRadius={16} style={{ marginBottom: 20 }} />
          <Skeleton width={80} height={12} style={{ marginBottom: 10 }} />
          {[0, 1].map((i) => (
            <View key={i} style={styles.reportCard}>
              <Skeleton width={100} height={13} style={{ marginBottom: 8 }} />
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
              <Text style={styles.addButtonText}>+ {t('admin_child_report_detail.add_report', 'Add Report on Their Behalf')}</Text>
            </TouchableOpacity>
          )}

          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {editingReportId
                  ? t('admin_child_report_detail.edit_report', 'Edit Report')
                  : t('admin_child_report_detail.new_report', 'New Report')}
              </Text>
              <TextInput
                style={styles.noteInput}
                placeholder={t('admin_child_report_detail.note_placeholder', 'Write a short note...')}
                placeholderTextColor={SUBTLE}
                multiline
                value={note}
                onChangeText={setNote}
              />
              <RatingSelector label={t('admin_child_report_detail.academic_rating', 'Academic Rating')} value={academicRating} onChange={setAcademicRating} />
              <RatingSelector label={t('admin_child_report_detail.wellbeing_rating', 'Wellbeing Rating')} value={wellbeingRating} onChange={setWellbeingRating} />

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
                        ? t('admin_child_report_detail.update_report', 'Update Report')
                        : t('admin_child_report_detail.save_report', 'Save Report')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>{t('admin_child_report_detail.history', 'History')}</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin_child_report_detail.empty', 'No reports submitted yet.')}</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportMonth}>{report.report_month}</Text>
                  <View style={styles.reportCardActions}>
                    <TouchableOpacity onPress={() => handleEdit(report)} hitSlop={8}>
                      <Text style={styles.editText}>{t('admin_child_report_detail.edit', 'Edit')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(report.id)} hitSlop={8}>
                      <Text style={styles.deleteText}>{t('admin_child_report_detail.delete', 'Delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.gaugeRow}>
                  <RatingGauge label={t('admin_child_report_detail.academic', 'Academic')} value={report.academic_rating} color={EMERALD} />
                  <RatingGauge label={t('admin_child_report_detail.wellbeing', 'Wellbeing')} value={report.wellbeing_rating} color={GOLD} />
                </View>

                {report.note ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.reportNote}>{report.note}</Text>
                  </View>
                ) : null}

                <Text style={styles.reportSubmittedBy}>{t('admin_child_report_detail.submitted_by', 'Submitted by')} {report.submitted_by ?? t('admin_child_report_detail.unknown', 'unknown')}</Text>

                {report.photos.length > 0 && (
                  <View style={styles.photoGrid}>
                    {report.photos.map((url, index) => (
                      <TouchableOpacity
                        key={url}
                        style={styles.photoTile}
                        activeOpacity={0.85}
                        onPress={() => openLightbox(report.photos, index)}
                      >
                        <Image source={{ uri: url }} style={styles.photoTileImage} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      <PhotoLightbox
        visible={lightboxVisible}
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        onClose={() => setLightboxVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: '#D70015', textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#F2F2F7', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 40 },

  addButton: {
    backgroundColor: EMERALD_SOFT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: { color: EMERALD, fontWeight: '700', fontSize: 14 },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    ...SHADOW.level1,
  },
  formTitle: { fontSize: 17, fontWeight: '700', color: INK, marginBottom: 14 },
  noteInput: {
    backgroundColor: CANVAS,
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
  ratingPill: { width: 44, height: 44, borderRadius: 22, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center' },
  ratingPillSelected: { backgroundColor: EMERALD },
  ratingPillText: { fontSize: 15, fontWeight: '600', color: INK },
  ratingPillTextSelected: { color: '#FFFFFF' },
  formButtonRow: { flexDirection: 'row', marginTop: 4 },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  cancelButtonText: { color: SUBTLE, fontWeight: '600' },
  submitButton: { flex: 2, backgroundColor: EMERALD, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: SUBTLE, textTransform: 'uppercase', marginBottom: 10 },
  emptyText: { color: SUBTLE, fontSize: 14 },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    ...SHADOW.level1,
  },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  reportMonth: { fontWeight: '800', color: INK, fontSize: 15 },
  reportCardActions: { flexDirection: 'row', gap: 16 },
  editText: { color: EMERALD, fontSize: 13, fontWeight: '600' },
  deleteText: { color: DANGER, fontSize: 13, fontWeight: '600' },

  gaugeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },

  noteBlock: {
    backgroundColor: CANVAS,
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
  reportNote: { color: '#3A3F3C', fontSize: 13.5, lineHeight: 19 },
  reportSubmittedBy: { fontSize: 11, color: SUBTLE, fontStyle: 'italic', marginBottom: 12 },

  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoTile: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: CANVAS,
  },
  photoTileImage: { width: '100%', height: '100%' },
});
