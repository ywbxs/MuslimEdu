import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchTeacherReports, TeacherReport } from '../../services/adminTeacherService';
import { Skeleton } from '../../components/Skeleton';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHADOW, GLASS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
const EMERALD = '#0F9D58';
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

function formatMonth(monthStr: string) {
  const d = new Date(monthStr);
  if (isNaN(d.getTime())) return monthStr;
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Full-screen, tap-to-dismiss viewer for a report photo. */
function PhotoViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = Dimensions.get('window');
  const { t } = useLocale();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.viewerBackdrop} activeOpacity={1} onPress={onClose}>
        {uri && (
          <Image
            source={{ uri }}
            style={{ width: width * 0.94, height: height * 0.75 }}
            resizeMode="contain"
          />
        )}
        <TouchableOpacity style={styles.viewerCloseBtn} onPress={onClose} hitSlop={12}>
          <Text style={styles.viewerCloseText}>{t('common.close', 'Close')}</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

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
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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
          <Text style={styles.sectionLabel}>{t('admin_teacher_report_detail.history', 'History')}</Text>
          {reports.length === 0 ? (
            <Text style={styles.emptyText}>{t('admin_teacher_report_detail.empty', 'No monthly reports submitted yet.')}</Text>
          ) : (
            reports.map((report) => (
              <View key={report.id} style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportMonth}>{formatMonth(report.report_month)}</Text>
                </View>

                <View style={styles.ratingsRow}>
                  <RatingBox label={t('admin_teacher_report_detail.teaching', 'Teaching')} value={report.teaching_effectiveness_rating} />
                  <RatingBox label={t('admin_teacher_report_detail.engagement', 'Engagement')} value={report.classroom_engagement_rating} />
                  <RatingBox label={t('admin_teacher_report_detail.growth', 'Growth')} value={report.professional_growth_rating} />
                </View>

                {report.note ? <Text style={styles.reportNote}>{report.note}</Text> : null}

                {report.photos.length > 0 && (
                  <View style={styles.photoGrid}>
                    {report.photos.map((url) => (
                      <TouchableOpacity
                        key={url}
                        activeOpacity={0.85}
                        onPress={() => setViewerUri(url)}
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

      <PhotoViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
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

  // --- Full-screen photo viewer ---
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCloseBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  viewerCloseText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
