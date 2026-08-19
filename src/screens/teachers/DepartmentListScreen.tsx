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
import { ChevronLeft } from 'lucide-react-native';
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
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}

// Mirrors ClassListScreen.tsx's structure/styling so the Departments screen
// feels like part of the same Academic Management module.
const DepartmentListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const { t } = useLocale();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';
  const statusLabel = (status: string) => t(`department_list.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const [departments, setDepartments] = useState([]);
  const [campuses, setCampuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [campusFilter, setCampusFilter] = useState('all');

  useFocusEffect(
    useCallback(() => {
      fetchDepartments();
    }, [searchTerm, statusFilter, campusFilter, token])
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

  const fetchDepartments = async () => {
    if (!token) return;
    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/admin_departments_list`,
        {
          search: searchTerm,
          status: statusFilter === 'all' ? undefined : statusFilter,
          campus_id: campusFilter === 'all' ? undefined : campusFilter,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setDepartments(response.data.departments || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      Alert.alert(t('common.error', 'Error'), t('department_list.load_error', 'Failed to load departments'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDepartments();
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    setTimeout(() => {
      fetchDepartments();
    }, 300);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status);
  };

  const handleCampusFilter = (campusId) => {
    setCampusFilter(campusId);
  };

  const handleDepartmentPress = (departmentId) => {
    navigation.navigate('DepartmentForm', { departmentId });
  };

  const handleDelete = (department) => {
    Alert.alert(
      t('department_list.delete_title', 'Delete Department'),
      t('department_list.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', department.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('department_list.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.post(
                `${API_BASE_URL}/admin_departments_delete`,
                { department_id: department.id },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              fetchDepartments();
            } catch (error) {
              const msg = error.response?.data?.message || t('department_list.delete_error', 'Failed to delete department');
              Alert.alert(t('common.error', 'Error'), msg);
            }
          },
        },
      ]
    );
  };

  const renderDepartmentCard = ({ item }) => {
    const badge = statusColors(theme, item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleDepartmentPress(item.id)}
      >
        <View style={styles.cardHeader}>
          {item.code ? (
            <View style={styles.codeBadge}>
              <Text style={styles.codeText}>{item.code}</Text>
            </View>
          ) : (
            <View />
          )}
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {item.status}
          </Text>
        </View>

        <Text style={styles.name}>{item.name}</Text>

        {item.school_level ? (
          <Text style={styles.schoolLevel}>
            {item.school_level.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
        ) : null}

        {item.campus_name ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('department_list.campus_label', 'Campus:')}</Text>
            <Text style={styles.value}>{item.campus_name}</Text>
          </View>
        ) : null}

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('department_list.head_label', 'Head:')}</Text>
          <Text style={styles.value}>{item.head_of_department_name || t('department_list.not_assigned', 'Not assigned')}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>{t('department_list.n_curricula', '{n} curricula').replace('{n}', String(item.curricula_count))}</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statChipText}>{t('department_list.n_classes', '{n} classes').replace('{n}', String(item.classes_count))}</Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDepartmentPress(item.id)}
          >
            <Text style={styles.actionButtonText}>{t('common.edit', 'Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>{t('department_list.delete', 'Delete')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={60} height={20} borderRadius={6} baseColor={theme.skeletonBase} />
        <Skeleton width={50} height={16} borderRadius={4} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width="55%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width="80%" height={12} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <Skeleton width="40%" height={12} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
      <View style={{ flexDirection: 'row' }}>
        <Skeleton width={80} height={22} borderRadius={12} style={{ marginRight: 8 }} baseColor={theme.skeletonBase} />
        <Skeleton width={70} height={22} borderRadius={12} baseColor={theme.skeletonBase} />
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('department_list.title', 'Departments')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>
          {[0, 1, 2].map(renderSkeletonCard)}
        </View>
        <BottomNavBar />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Departments</Text>
        {isAdminRole ? (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('DepartmentForm')}
          >
            <Text style={styles.addButtonText}>{t('department_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('department_list.search_placeholder', 'Search department name or code...')}
          value={searchTerm}
          onChangeText={handleSearch}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'inactive', 'all'].map((status) => (
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

      {campuses.length > 0 ? (
        <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterButton, campusFilter === 'all' && styles.filterButtonActive]}
            onPress={() => handleCampusFilter('all')}
          >
            <Text style={[styles.filterButtonText, campusFilter === 'all' && styles.filterButtonTextActive]}>
              {t('department_list.all_campuses', 'All Campuses')}
            </Text>
          </TouchableOpacity>
          {campuses.map((campus) => (
            <TouchableOpacity
              key={campus.id}
              style={[styles.filterButton, campusFilter === campus.id && styles.filterButtonActive]}
              onPress={() => handleCampusFilter(campus.id)}
            >
              <Text style={[styles.filterButtonText, campusFilter === campus.id && styles.filterButtonTextActive]}>
                {campus.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      <FlatList
        style={{ flex: 1 }}
        data={departments}
        renderItem={renderDepartmentCard}
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
            icon="🏛️"
            title={t('department_list.empty_title', 'No departments found')}
            subtitle={
              searchTerm
                ? t('department_list.no_match', 'Nothing matches "{query}".').replace('{query}', searchTerm)
                : statusFilter === 'all'
                ? t('department_list.empty_all', 'No departments yet.')
                : t('department_list.empty_status', 'No {status} departments yet.').replace('{status}', statusLabel(statusFilter).toLowerCase())
            }
            colors={theme}
          />
        }
      />
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
    card: {
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
    codeBadge: {
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
    },
    codeText: {
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
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: 2,
    },
    schoolLevel: {
      fontSize: 12,
      color: theme.textSecondary,
      marginBottom: 10,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 10,
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
    statsRow: {
      flexDirection: 'row',
      marginBottom: 12,
    },
    statChip: {
      backgroundColor: theme.surfaceVariant,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 8,
    },
    statChipText: {
      fontSize: 11,
      color: theme.textSecondary,
      fontWeight: '600',
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    actionButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 8,
    },
    actionButtonText: {
      color: theme.onAccent,
      fontSize: 12,
      fontWeight: '600',
    },
    deleteButton: {
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginLeft: 8,
    },
    deleteButtonText: {
      color: theme.danger,
      fontSize: 12,
      fontWeight: '600',
    },
  });

export default DepartmentListScreen;
