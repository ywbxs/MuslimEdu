import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Layers, GraduationCap, Clock, Sun, Building2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { API_BASE_URL } from '../../config/api';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';

interface ClassSummary {
  id: number;
  class_code: string;
  name: string;
  grade_level: number;
  campus: string | null;
  school_year: string | null;
  shift: string;
  class_type: string;
  max_capacity: number;
  current_enrollment: number;
  enrollment_percentage: number;
  status: string;
  start_date: string;
  end_date: string;
}

interface CampusOption {
  id: number;
  name: string;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconLayers({ color }: { color: string }) {
  return <Layers size={13} color={color} strokeWidth={2.2} />;
}
function IconSun({ color }: { color: string }) {
  return <Sun size={13} color={color} strokeWidth={2.2} />;
}
function IconClock({ color }: { color: string }) {
  return <Clock size={13} color={color} strokeWidth={2.2} />;
}
function IconBuilding({ color }: { color: string }) {
  return <Building2 size={13} color={color} strokeWidth={2.2} />;
}
function IconGraduationCap({ color, size = 22 }: { color: string; size?: number }) {
  return <GraduationCap size={size} color={color} strokeWidth={2} />;
}

// Backend sends full ISO timestamps ("2026-08-17T18:00:00.000000Z") even
// though these are date-only fields - just the calendar date, no time.
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const ClassListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const { t } = useLocale();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  const statusLabel = (status: string) => t(`class_list.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [campusFilter, setCampusFilter] = useState<number | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const authedPost = useCallback(
    async (path: string, body: Record<string, any>) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message ?? `Request failed (${response.status})`);
      return data;
    },
    [token]
  );

  const fetchCampuses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authedPost('/admin_campuses_list', { status: 'active' });
      setCampuses(data.campuses ?? []);
    } catch {
      // Silent - campus filter just stays at "All" if this fails.
    }
  }, [token, authedPost]);

  const fetchClasses = useCallback(
    async (pageNum = 1, campusOverride?: number | 'all') => {
      if (!token) return;
      try {
        setLoading(true);
        const effectiveCampus = campusOverride !== undefined ? campusOverride : campusFilter;
        const data = await authedPost('/admin_classes_list', {
          search: searchTerm,
          status: statusFilter,
          campus_id: effectiveCampus === 'all' ? undefined : effectiveCampus,
          page: pageNum,
          per_page: 10,
          sort_by: 'grade_level',
          sort_order: 'asc',
        });
        setClasses(data.classes ?? []);
        setPage(pageNum);
        setTotalPages(data.pagination?.last_page ?? 1);
      } catch (err) {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_list.load_error', 'Failed to load classes'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, authedPost, searchTerm, statusFilter, campusFilter, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [fetchClasses])
  );

  useFocusEffect(
    useCallback(() => {
      fetchCampuses();
    }, [fetchCampuses])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClasses(1);
  };

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    setPage(1);
    setTimeout(() => fetchClasses(1), 300);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setPage(1);
    fetchClasses(1);
  };

  const handleClassPress = (classId: number) => {
    (navigation as any).navigate('ClassDetail', { classId });
  };

  const handleSectionsPress = (classId: number) => {
    (navigation as any).navigate('SectionList', { classId });
  };

  const renderClassCard = ({ item }: { item: ClassSummary }) => {
    const badge = statusColors(theme, item.status);
    const pct = item.enrollment_percentage || 0;
    return (
      <TouchableOpacity style={styles.classCard} onPress={() => handleClassPress(item.id)} activeOpacity={0.85}>
        <View style={styles.cardTopRow}>
          <View style={styles.gradeBadge}>
            <Text style={styles.gradeBadgeText}>{item.grade_level}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.className} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.classCode}>{item.class_code}</Text>
          </View>
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {statusLabel(item.status)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <IconLayers color={theme.textSecondary} />
            <Text style={styles.metaChipText}>{item.class_type}</Text>
          </View>
          <View style={styles.metaChip}>
            <IconSun color={theme.textSecondary} />
            <Text style={styles.metaChipText}>{item.shift}</Text>
          </View>
          {item.school_year ? (
            <View style={styles.metaChip}>
              <IconClock color={theme.textSecondary} />
              <Text style={styles.metaChipText}>{item.school_year}</Text>
            </View>
          ) : null}
          {item.campus ? (
            <View style={styles.metaChip}>
              <IconBuilding color={theme.textSecondary} />
              <Text style={styles.metaChipText}>{item.campus}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.enrollmentBar}>
          <View
            style={[
              styles.enrollmentFill,
              {
                width: `${pct}%`,
                backgroundColor: pct > 90 ? theme.danger : pct > 75 ? theme.warning : theme.success,
              },
            ]}
          />
        </View>
        <Text style={styles.enrollmentText}>
          {t('class_list.enrollment', '{current}/{capacity} students ({pct}%)')
            .replace('{current}', String(item.current_enrollment))
            .replace('{capacity}', String(item.max_capacity))
            .replace('{pct}', String(pct))}
        </Text>

        <Text style={styles.dateText}>
          {t('class_list.date_range', '{start} — {end}').replace('{start}', formatDate(item.start_date)).replace('{end}', formatDate(item.end_date))}
        </Text>

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.sectionsButton} onPress={() => handleSectionsPress(item.id)}>
            <IconLayers color={theme.accent} />
            <Text style={styles.sectionsButtonText}>{t('class_list.sections', 'Sections')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => handleClassPress(item.id)}>
            <Text style={styles.actionButtonText}>{t('class_list.view', 'View')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.classCard}>
      <View style={styles.cardTopRow}>
        <Skeleton width={44} height={44} borderRadius={22} baseColor={theme.skeletonBase} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="70%" height={16} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
          <Skeleton width="40%" height={12} baseColor={theme.skeletonBase} />
        </View>
      </View>
      <Skeleton width="90%" height={12} style={{ marginTop: 14, marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="100%" height={6} borderRadius={3} style={{ marginTop: 8, marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="50%" height={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <GlassBackground variant="canvas" />
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('class_list.title', 'Classes')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2, 3].map(renderSkeletonCard)}</View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('class_list.title', 'Classes')}</Text>
        {isAdminRole ? (
          <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('CreateClass')}>
            <Text style={styles.addButtonText}>{t('class_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('class_list.search_placeholder', 'Search class code or name...')}
          value={searchTerm}
          onChangeText={handleSearch}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'pending', 'closed', 'archived'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, statusFilter === status && styles.filterButtonActive]}
            onPress={() => handleStatusFilter(status)}
          >
            <Text style={[styles.filterButtonText, statusFilter === status && styles.filterButtonTextActive]}>
              {statusLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={{ flex: 1 }}
        data={classes}
        renderItem={renderClassCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} colors={[theme.accent]} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="🏫"
            title={t('class_list.empty_title', 'No classes found')}
            subtitle={
              searchTerm
                ? t('class_list.no_match', 'Nothing matches "{query}" in {status}.').replace('{query}', searchTerm).replace('{status}', statusLabel(statusFilter).toLowerCase())
                : t('class_list.empty_status', 'No {status} classes yet.').replace('{status}', statusLabel(statusFilter).toLowerCase())
            }
            actionLabel={isAdminRole ? t('class_list.add_class_action', 'Add Class') : undefined}
            onAction={isAdminRole ? () => (navigation as any).navigate('CreateClass') : undefined}
            colors={theme}
          />
        }
      />

      {totalPages > 1 ? (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}
            onPress={() => page > 1 && fetchClasses(page - 1)}
            disabled={page === 1}
          >
            <Text style={styles.paginationText}>{t('class_list.previous', 'Previous')}</Text>
          </TouchableOpacity>

          <Text style={styles.paginationInfo}>
            {t('class_list.page_of', 'Page {page} of {total}').replace('{page}', String(page)).replace('{total}', String(totalPages))}
          </Text>

          <TouchableOpacity
            style={[styles.paginationButton, page === totalPages && styles.paginationButtonDisabled]}
            onPress={() => page < totalPages && fetchClasses(page + 1)}
            disabled={page === totalPages}
          >
            <Text style={styles.paginationText}>{t('class_list.next', 'Next')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <BottomNavBar />
    </View>
  );
};

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: theme.textPrimary },
    headerTitleFlex: { flex: 1, marginLeft: 8 },
    backButton: { width: 32 },
    headerSpacer: { width: 32 },
    addButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface },
    searchInput: {
      height: 46,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.pill,
      paddingHorizontal: 18,
      fontSize: 14.5,
      backgroundColor: theme.surface,
      color: theme.textPrimary,
      ...theme.elevation1,
    },
    filterBar: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.surface, flexGrow: 0 },
    filterButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      marginRight: 8,
    },
    filterButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    filterButtonText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    filterButtonTextActive: { color: theme.onAccent },

    listContainer: { paddingHorizontal: 16, paddingVertical: 12 },

    classCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl ?? 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center' },
    gradeBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradeBadgeText: { fontSize: 17, fontWeight: '800', color: theme.accentSoftText },
    className: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
    classCode: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.pill,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },

    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: theme.surfaceVariant,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADIUS.pill,
    },
    metaChipText: { fontSize: 11.5, fontWeight: '600', color: theme.textSecondary, textTransform: 'capitalize' },

    enrollmentBar: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginTop: 14, marginBottom: 6 },
    enrollmentFill: { height: '100%', borderRadius: 3 },
    enrollmentText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

    dateText: { fontSize: 11, color: theme.textMuted, marginTop: 8 },

    cardFooter: { flexDirection: 'row', gap: 10, marginTop: 14 },
    sectionsButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: theme.accent,
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    sectionsButtonText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
    actionButton: {
      flex: 1,
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    actionButtonText: { color: theme.onAccent, fontSize: 12.5, fontWeight: '700' },

    paginationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 16,
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    paginationButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: theme.borderStrong },
    paginationButtonDisabled: { opacity: 0.5 },
    paginationText: { fontSize: 12, fontWeight: '600', color: theme.accent },
    paginationInfo: { fontSize: 12, color: theme.textSecondary, fontWeight: '500' },
  });

export default ClassListScreen;
