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
  Modal,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/api';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

// Sibling to DepartmentListScreen.tsx / CurriculumListScreen.tsx. Sections
// belong to a class, so this adds a class-filter modal on top of the usual
// search + status filter bar; the enrollment bar is lifted straight from
// ClassListScreen.tsx since sections carry the same capacity/enrollment shape.
const SectionListScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { classId: routeClassId } = route.params || {};
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const statusLabel = (status: string) => t(`section_list.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const [sections, setSections] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [classFilter, setClassFilter] = useState(routeClassId || null); // null = all classes
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useFocusEffect(
    useCallback(() => {
      getStoredUserRole();
      fetchClasses();
      fetchSections();
    }, [searchTerm, statusFilter, classFilter])
  );

  const getStoredUserRole = async () => {
    try {
      const role = await AsyncStorage.getItem('userRole');
      setUserRole(parseInt(role));
    } catch (error) {
      console.error('Error getting user role:', error);
    }
  };

  const fetchClasses = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_BASE_URL}/admin_classes_list`,
        { per_page: 500, sort_by: 'name', sort_order: 'asc' },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setClasses(response.data.classes || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchSections = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('token');

      const response = await axios.post(
        `${API_BASE_URL}/admin_sections_list`,
        {
          search: searchTerm,
          status: statusFilter === 'all' ? undefined : statusFilter,
          class_id: classFilter || undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      setSections(response.data.sections || []);
    } catch (error) {
      console.error('Error fetching sections:', error);
      Alert.alert(t('common.error', 'Error'), t('section_list.load_error', 'Failed to load sections'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSections();
  };

  const handleSearch = (text) => {
    setSearchTerm(text);
    setTimeout(() => {
      fetchSections();
    }, 300);
  };

  const handleSectionPress = (sectionId) => {
    navigation.navigate('SectionForm', { sectionId });
  };

  const handleDelete = (section) => {
    Alert.alert(
      t('section_list.delete_title', 'Delete Section'),
      t('section_list.delete_message', 'Delete "{name}"? This can\'t be undone.').replace('{name}', section.name),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('section_list.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              await axios.post(
                `${API_BASE_URL}/admin_sections_delete`,
                { section_id: section.id },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                }
              );
              fetchSections();
            } catch (error) {
              const msg = error.response?.data?.message || t('section_list.delete_error', 'Failed to delete section');
              Alert.alert(t('common.error', 'Error'), msg);
            }
          },
        },
      ]
    );
  };

  const classFilterLabel = classFilter
    ? classes.find((c) => c.id === classFilter)?.name || t('section_list.selected_class', 'Selected class')
    : t('section_list.all_classes', 'All Classes');

  const renderSectionCard = ({ item }) => {
    const badge = statusColors(theme, item.status);
    const pct = item.capacity ? Math.round((item.current_enrollment / item.capacity) * 100) : 0;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleSectionPress(item.id)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.className}>{item.class_name || t('section_list.unassigned_class', 'Unassigned class')}</Text>
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {item.status}
          </Text>
        </View>

        <Text style={styles.name}>{item.name}</Text>

        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('section_list.adviser_label', 'Adviser:')}</Text>
          <Text style={styles.value}>{item.class_teacher_name || t('section_list.not_assigned', 'Not assigned')}</Text>
        </View>
        {item.room_number ? (
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('section_list.room_label', 'Room:')}</Text>
            <Text style={styles.value}>{item.room_number}</Text>
          </View>
        ) : null}

        {item.capacity ? (
          <>
            <View style={styles.enrollmentBar}>
              <View
                style={[
                  styles.enrollmentFill,
                  {
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: pct > 90 ? theme.danger : pct > 75 ? '#f59e0b' : '#1FAE64',
                  },
                ]}
              />
            </View>
            <Text style={styles.enrollmentText}>
              {t('section_list.enrollment_with_capacity', '{current}/{capacity} students ({pct}%)')
                .replace('{current}', String(item.current_enrollment))
                .replace('{capacity}', String(item.capacity))
                .replace('{pct}', String(pct))}
            </Text>
          </>
        ) : (
          <Text style={styles.enrollmentText}>
            {t('section_list.enrollment_no_capacity', '{n} students (no capacity limit set)').replace('{n}', String(item.current_enrollment))}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={styles.studentsButton}
            onPress={() => navigation.navigate('SectionStudents', { sectionId: item.id })}
          >
            <Text style={styles.studentsButtonText}>{t('section_list.students', 'Students')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleSectionPress(item.id)}
          >
            <Text style={styles.actionButtonText}>{t('common.edit', 'Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item)}
          >
            <Text style={styles.deleteButtonText}>{t('section_list.delete', 'Delete')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardHeader}>
        <Skeleton width={90} height={14} borderRadius={4} baseColor={theme.skeletonBase} />
        <Skeleton width={50} height={16} borderRadius={4} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width="45%" height={18} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
      <Skeleton width="60%" height={12} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width={200} height={6} borderRadius={3} style={{ marginTop: 4, marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="50%" height={12} style={{ marginBottom: 12 }} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('section_list.title', 'Sections')}</Text>
        </View>
        <View style={styles.listContainer}>
          {[0, 1, 2].map(renderSkeletonCard)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sections</Text>
        {userRole === 2 && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('SectionForm')}
          >
            <Text style={styles.addButtonText}>{t('section_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('section_list.search_placeholder', 'Search section name...')}
          value={searchTerm}
          onChangeText={handleSearch}
          placeholderTextColor={theme.textMuted}
        />
      </View>

      <TouchableOpacity
        style={styles.classFilterButton}
        onPress={() => setClassModalVisible(true)}
      >
        <Text style={styles.classFilterText}>{classFilterLabel}</Text>
        <Text style={styles.classFilterChevron}>▾</Text>
      </TouchableOpacity>

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'inactive', 'all'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              statusFilter === status && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(status)}
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

      <FlatList
        data={sections}
        renderItem={renderSectionCard}
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
            icon="🧑‍🏫"
            title={t('section_list.empty_title', 'No sections found')}
            subtitle={
              searchTerm
                ? t('section_list.no_match', 'Nothing matches "{query}".').replace('{query}', searchTerm)
                : statusFilter === 'all'
                ? t('section_list.empty_all', 'No sections yet.')
                : t('section_list.empty_status', 'No {status} sections yet.').replace('{status}', statusLabel(statusFilter).toLowerCase())
            }
            colors={theme}
          />
        }
      />

      <Modal
        visible={classModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setClassModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('section_list.filter_by_class', 'Filter by Class')}</Text>
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                setClassFilter(null);
                setClassModalVisible(false);
              }}
            >
              <Text style={styles.modalItemText}>{t('section_list.all_classes', 'All Classes')}</Text>
            </TouchableOpacity>
            <FlatList
              data={classes}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setClassFilter(item.id);
                    setClassModalVisible(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.name}</Text>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id.toString()}
            />
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setClassModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    classFilterButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: 8,
      backgroundColor: theme.surface,
    },
    classFilterText: {
      fontSize: 14,
      color: theme.textPrimary,
      fontWeight: '600',
    },
    classFilterChevron: {
      color: theme.textSecondary,
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
      marginBottom: 4,
    },
    className: {
      fontSize: 12,
      color: theme.textSecondary,
      fontWeight: '600',
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
      marginBottom: 10,
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
      backgroundColor: theme.surfaceVariant,
      borderRadius: 3,
      overflow: 'hidden',
      marginTop: 4,
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
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    studentsButton: {
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
    },
    studentsButtonText: {
      color: theme.accentSoftText,
      fontSize: 12,
      fontWeight: '600',
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
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 40,
    },
    emptyText: {
      fontSize: 16,
      color: theme.textMuted,
    },
    modalContainer: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.textPrimary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalItem: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalItemText: {
      fontSize: 14,
      color: theme.textPrimary,
    },
    modalCloseButton: {
      paddingVertical: 12,
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalCloseText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.accent,
    },
  });

export default SectionListScreen;
