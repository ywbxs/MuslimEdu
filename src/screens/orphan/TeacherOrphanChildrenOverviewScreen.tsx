import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path, Line, Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { fetchReportOverview, ReportOverview, OverviewChild } from '../../services/adminOrphanReportService';
import { StudentSummary } from '../../services/adminService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';
import { ChildActionModal, ChildProfileSheet } from '../../components/ChildProfileSheet';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../../theme/spatial';
const EMERALD = '#0F9D58';
const EMERALD_SOFT = '#E7F5EC';
const INK = '#1C1C1E';
const SUBTLE = '#8A9099';
const HAIRLINE = '#EDEEF0';
const CANVAS = '#F6F7F9';
const DANGER = '#E5484D';
const DANGER_SOFT = '#FCEDED';

const MONTH_KEYS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_FALLBACKS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Icons --------------------------------------------------------------
function ChevronLeftIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={21} y1={21} x2={16.2} y2={16.2} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function FilterIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={7} x2={19} y2={7} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={5} y1={12} x2={19} y2={12} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={5} y1={17} x2={19} y2={17} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Circle cx={9} cy={7} r={2} fill="#FFFFFF" stroke={color} strokeWidth={1.6} />
      <Circle cx={15} cy={12} r={2} fill="#FFFFFF" stroke={color} strokeWidth={1.6} />
      <Circle cx={9} cy={17} r={2} fill="#FFFFFF" stroke={color} strokeWidth={1.6} />
    </Svg>
  );
}
function ChevronRightIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CloseIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
// Filled circle + X, used as the "clear search" affordance (matches the
// Children screen's search bar, as opposed to the plain X used in sheets).
function CloseCircleIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} fill={color} opacity={0.16} />
      <Line x1={9} y1={9} x2={15} y2={15} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={15} y1={9} x2={9} y2={15} stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function CheckIcon({ color }: { color: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function EmptyIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke="#C4C9CF" strokeWidth={1.6} strokeLinejoin="round" />
      <Path d="M9 12h6M9 16h4" stroke="#C4C9CF" strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
function PeopleIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3.4} stroke={color} strokeWidth={2} />
      <Path d="M2.7 20c0-3.4 2.8-5.8 6.3-5.8s6.3 2.4 6.3 5.8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M15.5 5a3.4 3.4 0 0 1 0 6.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17.3 14.4c2.2.6 3.7 2.5 3.7 5.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-4.4 3.6-7.5 8-7.5s8 3.1 8 7.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

type StatusFilter = 'all' | 'submitted' | 'missing';

// --- Footer stat item (icon + label on top, bold value below) ----------
function FooterStat({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactElement;
  iconBg: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.footerStat}>
      <View style={styles.footerStatTopRow}>
        <View style={[styles.footerStatIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
        <Text style={styles.footerStatLabel}>{label}</Text>
      </View>
      <Text style={styles.footerStatValue}>{value}</Text>
    </View>
  );
}

// --- Filter sheet -----------------------------------------------------
function FilterSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: StatusFilter;
  onSelect: (v: StatusFilter) => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const options: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t('teacher_orphan_overview.filter_all', 'All children') },
    { key: 'submitted', label: t('teacher_orphan_overview.filter_submitted', 'Submitted') },
    { key: 'missing', label: t('teacher_orphan_overview.filter_missing', 'Missing') },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('teacher_orphan_overview.filter_title', 'Filter')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.sheetCloseBtn}>
              <CloseIcon color={SUBTLE} />
            </TouchableOpacity>
          </View>
          {options.map((opt) => {
            const selected = value === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={styles.filterOptionRow}
                activeOpacity={0.7}
                onPress={() => {
                  onSelect(opt.key);
                  onClose();
                }}
              >
                <Text style={[styles.filterOptionText, selected && { color: EMERALD, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {selected ? (
                  <View style={styles.filterCheckCircle}>
                    <CheckIcon color="#FFFFFF" />
                  </View>
                ) : (
                  <View style={styles.filterEmptyCircle} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

// --- Child row (memoized so re-renders from search/scroll don't re-render every row) ---
const ChildRow = React.memo(function ChildRow({
  item,
  onPress,
}: {
  item: OverviewChild;
  onPress: (item: OverviewChild) => void;
}) {
  const { t } = useLocale();
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={() => onPress(item)}>
      <UserAvatar
        name={item.name}
        photo={item.photo}
        size={48}
        ringColor={HAIRLINE}
        fillColor={EMERALD_SOFT}
        textColor={EMERALD}
        dotColor={item.submitted ? EMERALD : DANGER}
      />
      <View style={styles.cardBody}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.submitted ? (
          <Text style={styles.metaSubmitted} numberOfLines={1}>
            {item.submitted_by
              ? t('teacher_orphan_overview.submitted_by', 'Submitted by {name}').replace('{name}', item.submitted_by)
              : t('teacher_orphan_overview.submitted', 'Submitted')}
          </Text>
        ) : (
          <Text style={styles.metaMissing}>{t('teacher_orphan_overview.not_submitted', 'Not submitted yet')}</Text>
        )}
      </View>
      <ChevronRightIcon color="#C4C9CF" />
    </TouchableOpacity>
  );
});

/**
 * Teacher's read-only Monthly Reports overview for orphan children. This is
 * a view-only counterpart to AdminOrphanOverviewScreen: same roster, search,
 * filter, and current-month status, but with no "Add Report" entry point -
 * teachers can look up a child's full report history (all months, via
 * TeacherOrphanChildReportDetailScreen) without being able to create,
 * edit, or delete reports. That stays admin-only.
 */
export default function TeacherOrphanChildrenOverviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [actionChild, setActionChild] = useState<OverviewChild | null>(null);
  const [selectedChild, setSelectedChild] = useState<OverviewChild | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportOverview(token);
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('teacher_orphan_overview.load_error', 'Failed to load report overview.'));
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  useEffect(() => {
    if (isLoading || error) return;
    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [isLoading, error]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await load();
    setIsRefreshing(false);
  };

  // ChildActionModal/ChildProfileSheet are shared with the admin Children
  // list and take a StudentSummary - the overview endpoint only returns the
  // slim OverviewChild shape (id/name/photo/submitted), so this fills in
  // the rest with safe defaults. ChildProfileSheet re-fetches the full
  // record from /admin_child_profile itself; this is only what's shown
  // before that request resolves.
  const toStudentSummary = useCallback(
    (item: OverviewChild): StudentSummary => ({
      id: item.student_id,
      name: item.name,
      email: '',
      photo: item.photo,
      class_id: null,
      section_id: null,
      orphan_id_number: null,
      status: 'active',
    }),
    [],
  );

  const handleChildAction = (action: 'profile' | 'documents' | 'report') => {
    const child = actionChild;
    setActionChild(null);
    if (!child) return;

    if (action === 'profile') {
      setSelectedChild(child);
      return;
    }
    if (action === 'documents') {
      (navigation as any).navigate('AdminUserDocuments', {
        userId: child.student_id,
        userName: child.name,
      });
      return;
    }
    // action === 'report'
    (navigation as any).navigate('TeacherOrphanChildReportDetail', {
      studentId: child.student_id,
      studentName: child.name,
    });
  };

  const now = new Date();
  const monthIndex = now.getMonth();
  const monthLabel = `${t(`common.month_${MONTH_KEYS[monthIndex]}`, MONTH_FALLBACKS[monthIndex])} ${now.getFullYear()}`;
  const submitted = overview?.submitted_count ?? 0;
  const total = overview?.total_count ?? 0;
  const missing = Math.max(total - submitted, 0);

  const children = overview?.children ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return children.filter((c) => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'submitted' ? c.submitted : !c.submitted);
      return matchesQuery && matchesStatus;
    });
  }, [children, query, statusFilter]);

  const keyExtractor = useCallback((item: OverviewChild) => String(item.student_id), []);
  const renderItem = useCallback(
    ({ item }: { item: OverviewChild }) => <ChildRow item={item} onPress={setActionChild} />,
    [],
  );

  const isFilterActive = statusFilter !== 'all';

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('teacher_orphan_overview.header_title', 'Monthly Reports')}</Text>
          <Text style={styles.headerSubtitle}>{monthLabel}</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerFilterBtn, isFilterActive && styles.headerFilterBtnActive]}
          onPress={() => setFilterSheetOpen(true)}
          hitSlop={8}
        >
          <FilterIcon color={isFilterActive ? '#FFFFFF' : EMERALD} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('teacher_orphan_overview.search_placeholder', 'Search children...')}
          placeholderTextColor={SUBTLE}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <CloseCircleIcon color={SUBTLE} />
          </TouchableOpacity>
        ) : null}
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.card}>
              <SkeletonCircle size={48} style={{ marginRight: 12 }} />
              <View style={styles.cardBody}>
                <Skeleton width="55%" height={14} style={{ marginBottom: 6 }} />
                <Skeleton width="75%" height={11} />
              </View>
            </View>
          ))}
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.flex1, { opacity: fadeIn }]}>
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyIcon />
                <Text style={styles.emptyTitle}>
                  {children.length === 0 ? t('teacher_orphan_overview.empty_title_none', 'No children assigned yet') : t('teacher_orphan_overview.empty_title_no_matches', 'No matches')}
                </Text>
                <Text style={styles.emptyBody}>
                  {children.length === 0
                    ? t('teacher_orphan_overview.empty_body_none', 'Reports will show up here once children are assigned.')
                    : t('teacher_orphan_overview.empty_body_no_matches', 'Try a different name or clear your filter.')}
                </Text>
              </View>
            }
          />

          {/* Bottom stats footer - view-only, so no "Add Report" action here */}
          <View style={styles.footer}>
            <View style={styles.footerStatsRowNoButton}>
              <FooterStat
                icon={<PeopleIcon color={EMERALD} />}
                iconBg={EMERALD_SOFT}
                value={String(total)}
                label={t('teacher_orphan_overview.stat_total', 'Total')}
              />
              <View style={styles.footerDivider} />
              <FooterStat
                icon={<PersonIcon color={EMERALD} />}
                iconBg={EMERALD_SOFT}
                value={String(submitted)}
                label={t('teacher_orphan_overview.stat_submitted', 'Submitted')}
              />
              <View style={styles.footerDivider} />
              <FooterStat
                icon={<PersonIcon color={DANGER} />}
                iconBg={DANGER_SOFT}
                value={String(missing)}
                label={t('teacher_orphan_overview.stat_missing', 'Missing')}
              />
            </View>
          </View>
        </Animated.View>
      )}

      <FilterSheet
        visible={filterSheetOpen}
        value={statusFilter}
        onSelect={setStatusFilter}
        onClose={() => setFilterSheetOpen(false)}
      />

      <ChildActionModal
        visible={!!actionChild}
        child={actionChild ? toStudentSummary(actionChild) : null}
        onClose={() => setActionChild(null)}
        onSelect={handleChildAction}
      />

      {/* canEdit is intentionally omitted (defaults to false) - teachers can
          look up a child's profile but never edit it, only admins can. */}
      <ChildProfileSheet
        visible={!!selectedChild}
        studentId={selectedChild?.student_id ?? null}
        fallback={selectedChild ? toStudentSummary(selectedChild) : null}
        onClose={() => setSelectedChild(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', minWidth: 64 },
  backText: { color: EMERALD, fontSize: 15, fontWeight: '600', marginLeft: 2 },
  headerTitleWrap: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: INK },
  headerSubtitle: { fontSize: 12, fontWeight: '600', color: EMERALD, marginTop: 1 },
  headerFilterBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EMERALD_SOFT,
  },
  headerFilterBtnActive: { backgroundColor: EMERALD },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CANVAS,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: INK, padding: 0 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  errorText: { color: DANGER, textAlign: 'center', marginBottom: 12 },
  retryButton: { backgroundColor: '#EEF0F2', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  retryText: { color: INK, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },

  // --- Child rows (plain white cards, matching the Children screen) ---
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  ...SHADOW.level1,
  },
  cardBody: { flex: 1, marginLeft: 12 },
  name: { fontSize: 15.5, fontWeight: '700', color: INK },
  metaSubmitted: { fontSize: 12.5, color: EMERALD, marginTop: 2, fontWeight: '600' },
  metaMissing: { fontSize: 12.5, color: DANGER, marginTop: 2, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingTop: 50, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 15.5, fontWeight: '700', color: INK, marginTop: 14 },
  emptyBody: { fontSize: 13, color: SUBTLE, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  // --- Bottom stats footer (no action button - view only) ---
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
  },
  footerStatsRowNoButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerStat: { flex: 1 },
  footerStatTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerStatIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerStatLabel: { fontSize: 12.5, color: SUBTLE, fontWeight: '600' },
  footerStatValue: { fontSize: 20, fontWeight: '800', color: INK, marginTop: 6 },
  footerDivider: { width: 1, height: 34, backgroundColor: HAIRLINE, marginHorizontal: 10 },

  // --- Sheets ---
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(17,20,23,0.4)', justifyContent: 'flex-end' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#DADDE1', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  filterSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34, paddingHorizontal: 20 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: INK },
  sheetCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: CANVAS, alignItems: 'center', justifyContent: 'center' },
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  filterOptionText: { fontSize: 15.5, color: INK, fontWeight: '500' },
  filterCheckCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: EMERALD, alignItems: 'center', justifyContent: 'center' },
  filterEmptyCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#D8DBDF' },
});
