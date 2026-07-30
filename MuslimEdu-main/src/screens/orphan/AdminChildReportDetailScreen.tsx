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
import { MonthlyReport } from '../../services/orphanService';
import {
  fetchChildReports,
  createChildReport,
  deleteChildReport,
} from '../../services/adminOrphanReportService';
import { Skeleton } from '../../components/Skeleton';

const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#EAF7EF';
const INK = '#1C1C1E';
const SUBTLE = '#8E8E93';
const DANGER = '#E0637A';
const TRACK_BG = '#F4F5F7';

function RatingSelector({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number) => void }) {
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
  const navigation = useNavigation();
  const route = useRoute();
  const { studentId, studentName } = (route.params as { studentId: number; studentName: string }) ?? {};
  const { token } = useAuth();

  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [note, setNote] = useState('');
  const [academicRating, setAcademicRating] = useState<number | null>(null);
  const [wellbeingRating, setWellbeingRating] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchChildReports(token, studentId);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    }
  }, [token, studentId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleCreate = async () => {
    if (!token || !academicRating || !wellbeingRating) {
      Alert.alert('Almost done', 'Please select both ratings.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createChildReport(
        token,
        studentId,
        { note, academic_rating: academicRating, wellbeing_rating: wellbeingRating },
      );
      Alert.alert('Report added', `A report was added for ${studentName}.`);
      setShowForm(false);
      setNote('');
      setAcademicRating(null);
      setWellbeingRating(null);
      await load();
    } catch (err) {
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (reportId: number) => {
    Alert.alert('Delete report', 'This cannot be undone. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!token) return;
          try {
            await deleteChildReport(token, reportId);
            await load();
          } catch (err) {
            Alert.alert('Could not delete', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>Back</Text>
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
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {!showForm && (
            <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
              <Text style={styles.addButtonText}>+ Add Report on Their Behalf</Text>
            </TouchableOpacity>
          )}

          {showForm && (
            <View style={styles.formCard}>
              <Text style={styles.formTitle}>New Report</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Write a short note..."
                placeholderTextColor={SUBTLE}
                multiline
                value={note}
                onChangeText={setNote}
              />
              <RatingSelector label="Academic Rating" value={academicRating} onChange={setAcademicRating} />
              <RatingSelector label="Wellbeing Rating" value={wellbeingRating} onChange={setWellbeingRating} />

              <View style={styles.formButtonRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, isSubmitting && { opacity: 0.6 }]}
                  onPress={handleCreate}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Save Report</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Text style={styles.sectionLabel}>History</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>No reports submitted yet.</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportMonth}>{report.report_month}</Text>
                  <TouchableOpacity onPress={() => handleDelete(report.id)} hitSlop={8}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                {report.note ? <Text style={styles.reportNote}>{report.note}</Text> : null}
                <View style={styles.reportRatingsRow}>
                  <Text style={styles.reportRating}>Academic: {report.academic_rating ?? '—'}</Text>
                  <Text style={styles.reportRating}>Wellbeing: {report.wellbeing_rating ?? '—'}</Text>
                </View>
                <Text style={styles.reportSubmittedBy}>Submitted by {report.submitted_by ?? 'unknown'}</Text>
                {report.photos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                    {report.photos.map((url) => (
                      <Image key={url} source={{ uri: url }} style={styles.photoThumb} />
                    ))}
                  </ScrollView>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: TRACK_BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
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
  photoThumb: { width: 64, height: 64, borderRadius: 12, marginRight: 10, backgroundColor: TRACK_BG },
  photoAddTile: {
    width: 64, height: 64, borderRadius: 12, backgroundColor: TRACK_BG,
    borderWidth: 1.5, borderColor: '#D9DCE1', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  formButtonRow: { flexDirection: 'row', marginTop: 4 },
  cancelButton: { flex: 1, paddingVertical: 14, alignItems: 'center', marginRight: 10 },
  cancelButtonText: { color: SUBTLE, fontWeight: '600' },
  submitButton: { flex: 2, backgroundColor: EMERALD, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '700' },

  sectionLabel: { fontSize: 13, fontWeight: '600', color: SUBTLE, textTransform: 'uppercase', marginBottom: 10 },
  emptyText: { color: SUBTLE, fontSize: 14 },
  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12 },
  reportCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  reportMonth: { fontWeight: '700', color: INK },
  deleteText: { color: DANGER, fontSize: 13, fontWeight: '600' },
  reportNote: { color: INK, fontSize: 14, marginBottom: 8 },
  reportRatingsRow: { flexDirection: 'row', marginBottom: 6 },
  reportRating: { fontSize: 12, color: SUBTLE, marginRight: 16 },
  reportSubmittedBy: { fontSize: 11, color: SUBTLE, fontStyle: 'italic' },
});
