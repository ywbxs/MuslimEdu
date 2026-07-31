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
import axios from 'axios';
import Svg, { Polyline } from 'react-native-svg';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
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

  const [classes, setClasses] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [campusFilter, setCampusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
    }, [token])
  );

  useFocusEffect(
    useCallback(() => {
      fetchCampuses();
    }, [token])
  );

  const fetchCampuses = async () => {
    if (!token) return;
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin_campuses_list`,
        { status: 'active' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setCampuses(response.data.campuses || []);
    } catch (error) {
      console.error('Error fetching campuses:', error);
    }
  };

  const fetchClasses = async (pageNum = 1, campusOverride = undefined) => {
    if (!token) return;
    try {
      setLoading(true);

      const effectiveCampus = campusOverride !== undefined ? campusOverride : campusFilter;

      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_list`,
        {
          search: searchTerm,
          status: statusFilter,
          campus_id: effectiveCampus === 'all' ? undefined : effectiveCampus,
          page: pageNum,
          per_page: 10,
          sort_by: 'grade_level',
          sort_order: 'asc',
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setClasses(response.data.classes);
      setFilteredClasses(response.data.classes);
      setPage(pageNum);
      setTotalPages(response.data.pagination.last_page);
    } catch (error) {
      console.error('Error fetching classes:', error);
      Alert.alert(t('common.error', 'Error'), t('class_list.load_error', 'Failed to load classes'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClasses(1);
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    setPage(1);
    // Debounce search
    setTimeout(() => {
      fetchClasses(1);
    }, 300);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
    setPage(1);
    fetchClasses(1);
  };

  const handleCampusFilter = (campusId) => {
    setCampusFilter(campusId);
    setPage(1);
    fetchClasses(1, campusId);
  };

  const handleClassPress = (classId) => {
    navigation.navigate('ClassDetail', { classId });
  };

  const renderClassCard = ({ item }) => {
    const badge = statusColors(theme, item.status);
    return (
      <TouchableOpacity
        style={styles.classCard}
        onPress={() => handleClassPress(item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.classCodeBadge}>
            <Text style={styles.classCode}>{item.class_code}</Text>
          </View>
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {item.status}
          </Text>
        </View>

        <Text style={styles.className}>{item.name}</Text>

        <View style={styles.classInfo}>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('class_list.grade_label', 'Grade:')}</Text>
            <Text style={styles.value}>{item.grade_level}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('class_list.type_label', 'Type:')}</Text>
            <Text style={styles.value}>{item.class_type}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('class_list.shift_label', 'Shift:')}</Text>
            <Text style={styles.value}>{item.shift}</Text>
          </View>
          {item.campus ? (
            <View style={styles.infoRow}>
              <Text style={styles.label}>{t('class_list.campus_label', 'Campus:')}</Text>
              <Text style={styles.value}>{item.campus}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.enrollmentBar}>
          <View
            style={[
              styles.enrollmentFill,
              {
                width: `${item.enrollment_percentage || 0}%`,
                backgroundColor:
                  item.enrollment_percentage > 90
                    ? theme.danger
                    : item.enrollment_percentage > 75
                    ? theme.warning
                    : theme.success,
              },
            ]}
          />
        </View>
        <Text style={styles.enrollmentText}>
          {t('class_list.enrollment', '{current}/{capacity} students ({pct}%)')
            .replace('{current}', String(item.current_enrollment))
            .replace('{capacity}', String(item.max_capacity))
            .replace('{pct}', String(item.enrollment_percentage || 0))}
        </Text>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            {t('class_list.date_range', '{start} to {end}').replace('{start}', item.start_date).replace('{end}', item.end_date)}
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleClassPress(item.id)}
          >
            <Text style={styles.actionButtonText}>{t('class_list.view', 'View')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.classCard}>
      <View style={styles.cardHeader}>
        <Skeleton width={70} height={20} borderRadius={6} baseColor={theme.skeletonBase} />
        <Skeleton width={50} height={16} borderRadius={4} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width="60%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width="90%" height={12} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="80%" height={12} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="70%" height={12} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <Skeleton width="100%" height={6} borderRadius={3} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="50%" height={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('class_list.title', 'Classes')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>
          {[0, 1, 2, 3].map(renderSkeletonCard)}
        </View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('class_list.title', 'Classes')}</Text>
        {isAdminRole ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateClass')}
          >
            <Text style={styles.addButtonText}>{t('class_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('class_list.search_placeholder', 'Search class code or name...')}
          value={searchTerm}
          onChangeText={handleSearch}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      {/* Status Filter */}
      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'pending', 'closed', 'archived'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              statusFilter === status && styles.filterButtonActive,
            ]}
            onPress={() => handleStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                statusFilter === status && styles.filterButtonTextActive,
              ]}
            >
              {statusLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Class List */}
      <FlatList
        style={{ flex: 1 }}
        data={filteredClasses}
        renderItem={renderClassCard}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.accent}
            colors={[theme.accent]}
          />
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
            colors={theme}
          />
        }
      />

      {/* Pagination */}
      {totalPages > 1 && (
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
      )}
      <BottomNavBar />
    </View>
  );
};

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
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
    headerTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.textPrimary,
    },
    headerTitleFlex: {
      flex: 1,
      marginLeft: 8,
    },
    backButton: {
      width: 32,
    },
    headerSpacer: {
      width: 32,
    },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    addButtonText: {
      color: theme.onAccent,
      fontWeight: '600',
      fontSize: 14,
    },
    searchContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
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
    filterBar: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.surface,
    },
    filterButton: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      marginRight: 8,
    },
    filterButtonActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterButtonText: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    filterButtonTextActive: {
      color: theme.onAccent,
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    classCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    classCodeBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    classCode: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.accentSoftText,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      overflow: 'hidden',
    },
    className: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 10,
    },
    classInfo: {
      marginBottom: 12,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
    value: {
      fontSize: 12,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    enrollmentBar: {
      height: 6,
      backgroundColor: theme.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 6,
    },
    enrollmentFill: {
      height: '100%',
      borderRadius: 3,
    },
    enrollmentText: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    dateText: {
      fontSize: 11,
      color: theme.textMuted,
    },
    actionButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    actionButtonText: {
      color: theme.onAccent,
      fontSize: 12,
      fontWeight: '600',
    },
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
    paginationButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.borderStrong,
    },
    paginationButtonDisabled: {
      opacity: 0.5,
    },
    paginationText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.accent,
    },
    paginationInfo: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '500',
    },
  });

export default ClassListScreen;
