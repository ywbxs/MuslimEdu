import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { fetchReportOverview, ReportOverview } from '../../services/adminOrphanReportService';
import { Skeleton } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

const EMERALD = '#0F9D58';
const EMERALD_DEEP = '#0B7C46';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const DANGER = '#E5484D';
const DANGER_SOFT = '#FCEDED';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];


export default function AdminOrphanOverviewScreen() {
  const navigation = useNavigation();
  const { token } = useAuth();

  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportOverview(token);
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report overview.');
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
  const submitted = overview?.submitted_count ?? 0;
  const total = overview?.total_count ?? 0;
  const missing = Math.max(total - submitted, 0);
  const progress = total > 0 ? submitted / total : 0;
  const pct = Math.round(progress * 100);

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
            <Polyline points="15 5 8 12 15 19" stroke={EMERALD} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monthly Reports</Text>
        <View style={styles.backBtn} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <Skeleton width={'100%'} height={132} style={{ borderRadius: 22, marginBottom: 20 }} />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={'100%'} height={72} style={{ borderRadius: 16, marginBottom: 10 }} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={overview?.children ?? []}
          keyExtractor={(item) => String(item.student_id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
          ListHeaderComponent={
            <View style={styles.progressCard}>
              <Text style={styles.progressMonth}>{monthLabel}</Text>
              <View style={styles.progressRow}>
                <Text style={styles.progressCount}>{submitted}</Text>
                <Text style={styles.progressTotal}> / {total} submitted</Text>
                <View style={styles.flex1} />
                <Text style={styles.progressPct}>{pct}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${pct}%` }]} />
              </View>
              <View style={styles.progressMetaRow}>
                <View style={styles.progressMeta}>
                  <View style={[styles.metaDot, { backgroundColor: '#FFFFFF' }]} />
                  <Text style={styles.progressMetaText}>{submitted} submitted</Text>
                </View>
                <View style={styles.progressMeta}>
                  <View style={[styles.metaDot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />
                  <Text style={styles.progressMetaText}>{missing} missing</Text>
                </View>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.childRow}
              activeOpacity={0.85}
              onPress={() =>
                (navigation as any).navigate('AdminChildReportDetail', {
                  studentId: item.student_id,
                  studentName: item.name,
                })
              }
            >
              <UserAvatar
                name={item.name}
                photo={item.photo}
                size={40}
                ringColor={HAIRLINE}
                dotColor={item.submitted ? EMERALD : DANGER}
              />
              <View style={[styles.flex1, { marginLeft: 12 }]}>
                <Text style={styles.childName}>{item.name}</Text>
                {item.submitted ? (
                  <Text style={styles.childSubmitted}>
                    Submitted{item.submitted_by ? ` by ${item.submitted_by}` : ''}
                  </Text>
                ) : (
                  <Text style={styles.childMissing}>Not submitted yet</Text>
                )}
              </View>
              {item.submitted ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Submitted</Text>
                </View>
              ) : (
                <View style={[styles.badge, styles.badgeMissing]}>
                  <Text style={[styles.badgeText, styles.badgeTextMissing]}>Missing</Text>
                </View>
              )}
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No children assigned yet.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: CANVAS },
  flex1: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 58,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 72 },
  backText: { color: EMERALD, fontSize: 16, fontWeight: '600', marginLeft: 2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  listContent: { padding: 16, paddingBottom: 40 },

  progressCard: {
    backgroundColor: EMERALD,
    borderRadius: 22,
    padding: 22,
    marginBottom: 18,
    shadowColor: EMERALD_DEEP,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  progressMonth: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14 },
  progressCount: { color: '#FFFFFF', fontSize: 34, fontWeight: '800', lineHeight: 36 },
  progressTotal: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginBottom: 4, marginLeft: 2 },
  progressPct: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  progressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 4 },
  progressMetaRow: { flexDirection: 'row', marginTop: 14, gap: 20 },
  progressMeta: { flexDirection: 'row', alignItems: 'center' },
  metaDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  progressMetaText: { color: 'rgba(255,255,255,0.9)', fontSize: 12.5, fontWeight: '600' },

  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  childName: { fontSize: 15, fontWeight: '700', color: INK },
  childSubmitted: { fontSize: 12.5, color: EMERALD, marginTop: 2, fontWeight: '600' },
  childMissing: { fontSize: 12.5, color: DANGER, marginTop: 2, fontWeight: '600' },
  badge: {
    backgroundColor: EMERALD_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 4,
  },
  badgeMissing: { backgroundColor: DANGER_SOFT },
  badgeText: { color: EMERALD, fontSize: 11.5, fontWeight: '700' },
  badgeTextMissing: { color: DANGER },
  chevron: { fontSize: 22, color: '#C4C9CF', fontWeight: '400', marginLeft: 2 },
  empty: { textAlign: 'center', color: SUBTLE, fontSize: 14, marginTop: 40 },
});
