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
import { fetchTeacherOverview, TeacherReportOverview, TeacherOverview } from '../../services/adminTeacherService';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';

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
type OverviewTab = 'children' | 'teachers';

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
  allLabel,
}: {
  visible: boolean;
  value: StatusFilter;
  onSelect: (v: StatusFilter) => void;
  onClose: () => void;
  allLabel: string;
}) {
  const { t } = useLocale();
  const options: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: allLabel },
    { key: 'submitted', label: t('admin_orphan_overview.filter_submitted', 'Submitted') },
    { key: 'missing', label: t('admin_orphan_overview.filter_missing', 'Missing') },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <TouchableOpacity style={styles.flex1} activeOpacity={1} onPress={onClose} />
        <View style={styles.filterSheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{t('admin_orphan_overview.filter_title', 'Filter')}</Text>
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
              ? t('admin_orphan_overview.submitted_by', 'Submitted by {name}').replace('{name}', item.submitted_by)
              : t('admin_orphan_overview.submitted', 'Submitted')}
          </Text>
        ) : (
          <Text style={styles.metaMissing}>{t('admin_orphan_overview.not_submitted', 'Not submitted yet')}</Text>
        )}
      </View>
      <ChevronRightIcon color="#C4C9CF" />
    </TouchableOpacity>
  );
});

// --- Teacher row (same visual as ChildRow, separate type/handler) ---
const TeacherRow = React.memo(function TeacherRow({
  item,
  onPress,
}: {
  item: TeacherOverview;
  onPress: (item: TeacherOverview) => void;
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
              ? t('admin_orphan_overview.submitted_by', 'Submitted by {name}').replace('{name}', item.submitted_by)
              : t('admin_orphan_overview.submitted', 'Submitted')}
          </Text>
        ) : (
          <Text style={styles.metaMissing}>{t('admin_orphan_overview.not_submitted', 'Not submitted yet')}</Text>
        )}
      </View>
      <ChevronRightIcon color="#C4C9CF" />
    </TouchableOpacity>
  );
});

/**
 * Admin's Monthly Reports overview. Search/filter are client-side over the
 * already-fetched roster (no new endpoints); tap a row (or pick one from the
 * "Add Report" sheet) to open AdminChildReportDetail - navigation and data
 * flow are unchanged from the original screen, only the visuals are new
 * (matches the plain-card + bottom stats-and-button layout used elsewhere
 * in the app, instead of the dark gradient hero + floating action button).
 *
 * Note on scope: the backend's report status is binary (submitted / not) -
 * there's no "pending review" state, and OverviewChild carries no guardian
 * name or last-submission-date field. So the footer shows Total/Submitted/
 * Missing (real numbers) and each row shows who submitted (submitted_by)
 * rather than a guardian name that doesn't exist in the API response yet.
 */
export default function AdminOrphanOverviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { token } = useAuth();
  const { t } = useLocale();

  const [activeTab, setActiveTab] = useState<OverviewTab>('children');

  const [overview, setOverview] = useState<ReportOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Teachers tab has its own loading/error state so switching tabs never
  // shows a stale spinner or a stale error from the other tab's fetch.
  const [teacherOverview, setTeacherOverview] = useState<TeacherReportOverview | null>(null);
  const [isTeacherLoading, setIsTeacherLoading] = useState(false);
  const [isTeacherRefreshing, setIsTeacherRefreshing] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchReportOverview(token);
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('admin_orphan_overview.load_error', 'Failed to load report overview.'));
    }
  }, [token]);

  const loadTeachers = useCallback(async () => {
    if (!token) return;
    setTeacherError(null);
    try {
      const data = await fetchTeacherOverview(token);
      setTeacherOverview(data);
    } catch (err) {
      setTeacherError(err instanceof Error ? err.message : t('admin_orphan_overview.load_teacher_error', 'Failed to load teacher report overview.'));
    }
  }, [token]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  // Teacher data is lazy-loaded the first time that tab is opened, then cached.
  useEffect(() => {
    if (activeTab !== 'teachers' || teacherOverview || isTeacherLoading) return;
    setIsTeacherLoading(true);
    loadTeachers().finally(() => setIsTeacherLoading(false));
  }, [activeTab, teacherOverview, isTeacherLoading, loadTeachers]);

  useEffect(() => {
    const loading = activeTab === 'children' ? isLoading : isTeacherLoading;
    const hasError = activeTab === 'children' ? error : teacherError;
    if (loading || hasError) return;
    fadeIn.setValue(0);
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [activeTab, isLoading, error, isTeacherLoading, teacherError]);

  const onRefresh = async () => {
    if (activeTab === 'children') {
      setIsRefreshing(true);
      await load();
      setIsRefreshing(false);
    } else {
      setIsTeacherRefreshing(true);
      await loadTeachers();
      setIsTeacherRefreshing(false);
    }
  };

  const goToChild = useCallback(
    (item: OverviewChild) => {
      (navigation as any).navigate('AdminChildReportDetail', {
        studentId: item.student_id,
        studentName: item.name,
      });
    },
    [navigation],
  );

  const goToTeacher = useCallback(
    (item: TeacherOverview) => {
      (navigation as any).navigate('AdminTeacherReportDetail', {
        teacherId: item.teacher_id,
        teacherName: item.name,
      });
    },
    [navigation],
  );

  const now = new Date();
  const monthLabel = `${t(`common.month_${MONTH_KEYS[now.getMonth()]}`, MONTH_FALLBACKS[now.getMonth()])} ${now.getFullYear()}`;

  const submitted = overview?.submitted_count ?? 0;
  const total = overview?.total_count ?? 0;
  const missing = Math.max(total - submitted, 0);

  const teacherSubmitted = teacherOverview?.submitted_count ?? 0;
  const teacherTotal = teacherOverview?.total_count ?? 0;
  const teacherMissing = Math.max(teacherTotal - teacherSubmitted, 0);

  const children = overview?.children ?? [];
  const teachers = teacherOverview?.teachers ?? [];

  const filteredChildren = useMemo(() => {
    const q = query.trim().toLowerCase();
    return children.filter((c) => {
      const matchesQuery = !q || c.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'submitted' ? c.submitted : !c.submitted);
      return matchesQuery && matchesStatus;
    });
  }, [children, query, statusFilter]);

  const filteredTeachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesQuery = !q || teacher.name.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' || (statusFilter === 'submitted' ? teacher.submitted : !teacher.submitted);
      return matchesQuery && matchesStatus;
    });
  }, [teachers, query, statusFilter]);

  const childKeyExtractor = useCallback((item: OverviewChild) => String(item.student_id), []);
  const teacherKeyExtractor = useCallback((item: TeacherOverview) => String(item.teacher_id), []);
  const renderChildItem = useCallback(
    ({ item }: { item: OverviewChild }) => <ChildRow item={item} onPress={goToChild} />,
    [goToChild],
  );
  const renderTeacherItem = useCallback(
    ({ item }: { item: TeacherOverview }) => <TeacherRow item={item} onPress={goToTeacher} />,
    [goToTeacher],
  );

  const isFilterActive = statusFilter !== 'all';

  const isChildrenTab = activeTab === 'children';
  const currentIsLoading = isChildrenTab ? isLoading : isTeacherLoading;
  const currentIsRefreshing = isChildrenTab ? isRefreshing : isTeacherRefreshing;
  const currentError = isChildrenTab ? error : teacherError;
  const currentReload = isChildrenTab ? load : loadTeachers;

  return (
    <View style={styles.flex}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeftIcon color={EMERALD} />
          <Text style={styles.backText}>{t('common.back', 'Back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('admin_orphan_overview.header_title', 'Monthly Reports')}</Text>
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

      {/* Children / Teachers tab toggle */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, isChildrenTab && styles.tabBtnActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('children')}
        >
          <Text style={[styles.tabBtnText, isChildrenTab && styles.tabBtnTextActive]}>{t('admin_orphan_overview.tab_children', 'Children')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, !isChildrenTab && styles.tabBtnActive]}
          activeOpacity={0.8}
          onPress={() => setActiveTab('teachers')}
        >
          <Text style={[styles.tabBtnText, !isChildrenTab && styles.tabBtnTextActive]}>{t('admin_orphan_overview.tab_teachers', 'Teachers')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchIcon color={SUBTLE} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={isChildrenTab ? t('admin_orphan_overview.search_children_placeholder', 'Search children...') : t('admin_orphan_overview.search_teachers_placeholder', 'Search teachers...')}
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

      {currentIsLoading ? (
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
      ) : currentError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{currentError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={currentReload}>
            <Text style={styles.retryText}>{t('common.try_again', 'Try again')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View style={[styles.flex1, { opacity: fadeIn }]}>
          {isChildrenTab ? (
            <FlatList
              data={filteredChildren}
              keyExtractor={childKeyExtractor}
              renderItem={renderChildItem}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={currentIsRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyIcon />
                  <Text style={styles.emptyTitle}>
                    {children.length === 0 ? t('admin_orphan_overview.empty_children_title', 'No children assigned yet') : t('admin_orphan_overview.empty_no_matches', 'No matches')}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {children.length === 0
                      ? t('admin_orphan_overview.empty_children_body', 'Reports will show up here once children are assigned.')
                      : t('admin_orphan_overview.empty_no_matches_body', 'Try a different name or clear your filter.')}
                  </Text>
                </View>
              }
            />
          ) : (
            <FlatList
              data={filteredTeachers}
              keyExtractor={teacherKeyExtractor}
              renderItem={renderTeacherItem}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={currentIsRefreshing} onRefresh={onRefresh} tintColor={EMERALD} />}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <EmptyIcon />
                  <Text style={styles.emptyTitle}>
                    {teachers.length === 0 ? t('admin_orphan_overview.empty_teachers_title', 'No teachers yet') : t('admin_orphan_overview.empty_no_matches', 'No matches')}
                  </Text>
                  <Text style={styles.emptyBody}>
                    {teachers.length === 0
                      ? t('admin_orphan_overview.empty_teachers_body', 'Reports will show up here once teachers are added.')
                      : t('admin_orphan_overview.empty_no_matches_body', 'Try a different name or clear your filter.')}
                  </Text>
                </View>
              }
            />
          )}

          {/* Bottom stats + action footer (separate counts per tab) */}
          <View style={styles.footer}>
            <View style={styles.footerStatsRow}>
              <FooterStat
                icon={<PeopleIcon color={EMERALD} />}
                iconBg={EMERALD_SOFT}
                value={String(isChildrenTab ? total : teacherTotal)}
                label={t('admin_orphan_overview.stat_total', 'Total')}
              />
              <View style={styles.footerDivider} />
              <FooterStat
                icon={<PersonIcon color={EMERALD} />}
                iconBg={EMERALD_SOFT}
                value={String(isChildrenTab ? submitted : teacherSubmitted)}
                label={t('admin_orphan_overview.stat_submitted', 'Submitted')}
              />
              <View style={styles.footerDivider} />
              <FooterStat
                icon={<PersonIcon color={DANGER} />}
                iconBg={DANGER_SOFT}
                value={String(isChildrenTab ? missing : teacherMissing)}
                label={t('admin_orphan_overview.stat_missing', 'Missing')}
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
        allLabel={isChildrenTab ? t('admin_orphan_overview.filter_all_children', 'All children') : t('admin_orphan_overview.filter_all_teachers', 'All teachers')}
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

  tabBar: {
    flexDirection: 'row',
    backgroundColor: CANVAS,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  tabBtnText: { fontSize: 14, fontWeight: '600', color: SUBTLE },
  tabBtnTextActive: { color: EMERALD },

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

  // --- Bottom stats + action footer ---
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 18,
  },
  footerStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
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
