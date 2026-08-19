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
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, Check, Users, MapPin, Pencil, Trash2, GraduationCap } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../config/api';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';

interface SectionSummary {
  id: number;
  name: string;
  class_id: number;
  class_name: string | null;
  class_teacher_name: string | null;
  room_number: string | null;
  status: string;
  capacity: number | null;
  current_enrollment: number;
}

interface ClassOption {
  id: number;
  name: string;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronDown({ color }: { color: string }) {
  return <ChevronDown size={16} color={color} strokeWidth={2.4} />;
}
function IconCheck({ color }: { color: string }) {
  return <Check size={17} color={color} strokeWidth={2.6} />;
}
function IconUsers({ color }: { color: string }) {
  return <Users size={13} color={color} strokeWidth={2.2} />;
}
function IconMapPin({ color }: { color: string }) {
  return <MapPin size={13} color={color} strokeWidth={2.2} />;
}
function IconPencil({ color }: { color: string }) {
  return <Pencil size={14} color={color} strokeWidth={2.3} />;
}
function IconTrash({ color }: { color: string }) {
  return <Trash2 size={16} color={color} strokeWidth={2.2} />;
}
function IconGraduationCap({ color }: { color: string }) {
  return <GraduationCap size={17} color={color} strokeWidth={2} />;
}

// Sibling to DepartmentListScreen.tsx / CurriculumListScreen.tsx. Sections
// belong to a class, so this adds a class-filter sheet on top of the usual
// search + status filter bar.
const SectionListScreen = () => {
  const { token, user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { classId: routeClassId } = (route.params as { classId?: number }) || {};
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useLocale();
  const statusLabel = (status: string) => t(`section_list.status_${status}`, status.charAt(0).toUpperCase() + status.slice(1));

  const [sections, setSections] = useState<SectionSummary[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [classFilter, setClassFilter] = useState<number | null>(routeClassId ?? null);
  const [classModalVisible, setClassModalVisible] = useState(false);
  // Was read from AsyncStorage('userRole'), which the real auth flow never
  // writes to (the token lives in the Keychain, not AsyncStorage) - always
  // NaN, so the admin-only actions this gates were permanently hidden.
  const userRole = user?.role_id ?? null;

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

  const fetchClasses = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authedPost('/admin_classes_list', { per_page: 500, sort_by: 'name', sort_order: 'asc' });
      setClasses(data.classes ?? []);
    } catch {
      // Silent - class filter just stays at "All Classes" if this fails.
    }
  }, [token, authedPost]);

  const fetchSections = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await authedPost('/admin_sections_list', {
        search: searchTerm,
        status: statusFilter === 'all' ? undefined : statusFilter,
        class_id: classFilter || undefined,
      });
      setSections(data.sections ?? []);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_list.load_error', 'Failed to load sections'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, authedPost, searchTerm, statusFilter, classFilter, t]);

  useFocusEffect(
    useCallback(() => {
      fetchClasses();
      fetchSections();
    }, [fetchClasses, fetchSections])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSections();
  };

  const handleSearch = (text: string) => {
    setSearchTerm(text);
    setTimeout(() => fetchSections(), 300);
  };

  const handleSectionPress = (sectionId: number) => {
    (navigation as any).navigate('SectionForm', { sectionId });
  };

  const handleDelete = (section: SectionSummary) => {
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
              await authedPost('/admin_sections_delete', { section_id: section.id });
              fetchSections();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('section_list.delete_error', 'Failed to delete section'));
            }
          },
        },
      ]
    );
  };

  const classFilterLabel = classFilter
    ? classes.find((c) => c.id === classFilter)?.name || t('section_list.selected_class', 'Selected class')
    : t('section_list.all_classes', 'All Classes');

  const renderSectionCard = ({ item }: { item: SectionSummary }) => {
    const badge = statusColors(theme, item.status);
    const pct = item.capacity ? Math.round((item.current_enrollment / item.capacity) * 100) : 0;
    return (
      <TouchableOpacity style={styles.card} onPress={() => handleSectionPress(item.id)} activeOpacity={0.85}>
        <View style={styles.cardTopRow}>
          <View style={styles.iconBadge}>
            <IconGraduationCap color={theme.accentSoftText} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.className} numberOfLines={1}>
              {item.class_name || t('section_list.unassigned_class', 'Unassigned class')}
            </Text>
          </View>
          <Text style={[styles.statusBadgeText, { color: badge.color, backgroundColor: badge.backgroundColor }]}>
            {statusLabel(item.status)}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <IconUsers color={theme.textSecondary} />
            <Text style={styles.metaChipText} numberOfLines={1}>
              {item.class_teacher_name || t('section_list.not_assigned', 'Not assigned')}
            </Text>
          </View>
          {item.room_number ? (
            <View style={styles.metaChip}>
              <IconMapPin color={theme.textSecondary} />
              <Text style={styles.metaChipText}>{item.room_number}</Text>
            </View>
          ) : null}
        </View>

        {item.capacity ? (
          <>
            <View style={styles.enrollmentBar}>
              <View
                style={[
                  styles.enrollmentFill,
                  {
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: pct > 90 ? theme.danger : pct > 75 ? theme.warning : theme.success,
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
            onPress={() => (navigation as any).navigate('SectionStudents', { sectionId: item.id })}
          >
            <Text style={styles.studentsButtonText}>{t('section_list.students', 'Students')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.editButton} onPress={() => handleSectionPress(item.id)}>
            <IconPencil color={theme.onAccent} />
            <Text style={styles.editButtonText}>{t('common.edit', 'Edit')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)} hitSlop={8}>
            <IconTrash color={theme.danger} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardTopRow}>
        <Skeleton width={44} height={44} borderRadius={22} baseColor={theme.skeletonBase} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="60%" height={16} style={{ marginBottom: 6 }} baseColor={theme.skeletonBase} />
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
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('section_list.title', 'Sections')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2].map(renderSkeletonCard)}</View>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('section_list.title', 'Sections')}</Text>
        {userRole === 2 ? (
          <TouchableOpacity style={styles.addButton} onPress={() => (navigation as any).navigate('SectionForm')}>
            <Text style={styles.addButtonText}>{t('section_list.add', '+ Add')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
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

      <TouchableOpacity style={styles.classFilterButton} onPress={() => setClassModalVisible(true)} activeOpacity={0.8}>
        <Text style={styles.classFilterText} numberOfLines={1}>{classFilterLabel}</Text>
        <IconChevronDown color={theme.textSecondary} />
      </TouchableOpacity>

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {['active', 'inactive', 'all'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, statusFilter === status && styles.filterButtonActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterButtonText, statusFilter === status && styles.filterButtonTextActive]}>
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
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} colors={[theme.accent]} />
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
            actionLabel={userRole === 2 ? t('section_list.add', '+ Add') : undefined}
            onAction={userRole === 2 ? () => (navigation as any).navigate('SectionForm') : undefined}
            colors={theme}
          />
        }
      />

      <KeyboardAwareModal visible={classModalVisible} transparent animationType="slide" onRequestClose={() => setClassModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setClassModalVisible(false)}>
          <TouchableOpacity style={styles.modalContent} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('section_list.filter_by_class', 'Filter by Class')}</Text>
            <FlatList
              data={[{ id: -1, name: t('section_list.all_classes', 'All Classes') }, ...classes]}
              renderItem={({ item }) => {
                const selected = item.id === -1 ? classFilter === null : classFilter === item.id;
                return (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setClassFilter(item.id === -1 ? null : item.id);
                      setClassModalVisible(false);
                    }}
                  >
                    <Text style={[styles.modalItemText, selected && styles.modalItemTextSelected]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {selected ? <IconCheck color={theme.accent} /> : null}
                  </TouchableOpacity>
                );
              }}
              keyExtractor={(item) => item.id.toString()}
              style={{ maxHeight: 360 }}
            />
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setClassModalVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareModal>
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

    classFilterButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      borderRadius: RADIUS.md ?? 14,
      backgroundColor: theme.surface,
    },
    classFilterText: { fontSize: 14, color: theme.textPrimary, fontWeight: '600', flex: 1, marginRight: 8 },

    filterBar: { paddingHorizontal: 16, paddingVertical: 4, backgroundColor: theme.surface, flexGrow: 0 },
    filterButton: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: RADIUS.pill,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      marginRight: 8,
      marginBottom: 12,
    },
    filterButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    filterButtonText: { fontSize: 12.5, color: theme.textSecondary, fontWeight: '600' },
    filterButtonTextActive: { color: theme.onAccent },

    listContainer: { paddingHorizontal: 16, paddingVertical: 12 },

    card: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl ?? 20,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardTopRow: { flexDirection: 'row', alignItems: 'center' },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: { fontSize: 16, fontWeight: '800', color: theme.textPrimary },
    className: { fontSize: 12, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
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
      maxWidth: '100%',
    },
    metaChipText: { fontSize: 11.5, fontWeight: '600', color: theme.textSecondary },

    enrollmentBar: { height: 6, backgroundColor: theme.border, borderRadius: 3, overflow: 'hidden', marginTop: 14, marginBottom: 6 },
    enrollmentFill: { height: '100%', borderRadius: 3 },
    enrollmentText: { fontSize: 12, color: theme.textSecondary, fontWeight: '600' },

    cardFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    studentsButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.accent,
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    studentsButtonText: { color: theme.accent, fontSize: 12.5, fontWeight: '700' },
    editButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.accent,
      paddingVertical: 9,
      borderRadius: RADIUS.pill,
    },
    editButtonText: { color: theme.onAccent, fontSize: 12.5, fontWeight: '700' },
    deleteButton: {
      width: 38,
      height: 38,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.dangerSoft,
      borderRadius: RADIUS.pill,
    },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      maxHeight: '80%',
      paddingBottom: 8,
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderStrong,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 4,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.textPrimary,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    modalItemText: { fontSize: 14.5, color: theme.textPrimary, flex: 1, marginRight: 8 },
    modalItemTextSelected: { fontWeight: '700', color: theme.accent },
    modalCloseButton: {
      marginTop: 8,
      marginHorizontal: 16,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: theme.surfaceVariant,
      borderRadius: RADIUS.pill,
    },
    modalCloseText: { fontSize: 15, fontWeight: '700', color: theme.textPrimary },
  });

export default SectionListScreen;
