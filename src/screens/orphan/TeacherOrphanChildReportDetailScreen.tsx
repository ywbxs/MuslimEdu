import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { MonthlyReport } from '../../services/orphanService';
import { fetchChildReports } from '../../services/adminOrphanReportService';
import { Skeleton } from '../../components/Skeleton';
import RatingGauge from '../../components/RatingGauge';
import PhotoLightbox from '../../components/PhotoLightbox';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW } from '../../theme/spatial';
const EMERALD = '#0F9D58';
const GOLD = '#B8912F';
const INK = '#14171A';
const SUBTLE = '#7A8078';
const CANVAS = '#F3F5F2';

/**
 * Teacher's read-only view of a single child's full report history (every
 * month on record, same data as AdminChildReportDetailScreen via the same
 * /admin_orphan_report_list endpoint) - no "Add Report" form and no
 * Delete action, since creating/removing reports stays admin-only.
 */
export default function TeacherOrphanChildReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const { studentId, studentName } = (route.params as { studentId: number; studentName: string }) ?? {};
  const { token } = useAuth();

  const [reports, setReports] = useState<MonthlyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    }
  }, [token, studentId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const openLightbox = (photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  return (
    <View style={styles.flex}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{studentName}</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.scrollContent}>
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
          <Text style={styles.sectionLabel}>History</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>No reports submitted yet.</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportMonth}>{report.report_month}</Text>
                </View>

                <View style={styles.gaugeRow}>
                  <RatingGauge label="Academic" value={report.academic_rating} color={EMERALD} />
                  <RatingGauge label="Wellbeing" value={report.wellbeing_rating} color={GOLD} />
                </View>

                {report.note ? (
                  <View style={styles.noteBlock}>
                    <Text style={styles.reportNote}>{report.note}</Text>
                  </View>
                ) : null}

                <Text style={styles.reportSubmittedBy}>Submitted by {report.submitted_by ?? 'unknown'}</Text>

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

  sectionLabel: { fontSize: 13, fontWeight: '600', color: SUBTLE, textTransform: 'uppercase', marginBottom: 10 },
  emptyText: { color: SUBTLE, fontSize: 14 },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    ...SHADOW.level1,
  },
  reportCardHeader: { marginBottom: 14 },
  reportMonth: { fontWeight: '800', color: INK, fontSize: 15 },

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
