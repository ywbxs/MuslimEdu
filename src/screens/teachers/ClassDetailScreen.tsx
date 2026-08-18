import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import KeyboardAwareModal from '../../components/KeyboardAwareModal';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Layers,
  GraduationCap,
  Clock,
  Sun,
  Building2,
  MapPin,
  Users,
  Copy,
  Archive,
  RotateCcw,
  Trash2,
} from 'lucide-react-native';
import { API_BASE_URL } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme, statusColors } from './academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';

interface ClassDetail {
  id: number;
  class_code: string;
  name: string;
  status: string;
  description: string | null;
  current_enrollment: number;
  max_capacity: number;
  available_slots: number | null;
  enrollment_percentage: number | null;
  grade_level: number;
  class_type: string;
  shift: string;
  department: string | null;
  curriculum: string | null;
  section: string | null;
  room_number: string | null;
  building: string | null;
  floor: string | null;
  school_year: string | null;
  semester_term: string | null;
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

// Backend sends full ISO timestamps ("2026-08-17T18:00:00.000000Z") even
// for date-only fields - just the calendar date, no time.
function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconChevronRight({ color }: { color: string }) {
  return <ChevronRight size={18} color={color} strokeWidth={2.2} />;
}
function IconPencil({ color }: { color: string }) {
  return <Pencil size={18} color={color} strokeWidth={2.2} />;
}

const ClassDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { classId } = route.params;
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const { t } = useLocale();
  const isAdminRole = user?.role === 'admin' || user?.role === 'superadmin';

  const [classData, setClassData] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [duplicateModalVisible, setDuplicateModalVisible] = useState(false);
  const [newClassCode, setNewClassCode] = useState('');
  const [newClassName, setNewClassName] = useState('');

  const authedPost = useCallback(
    async (path: string, body: Record<string, any>) => {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errors = data?.errors ? Object.values(data.errors).flat().join('\n') : null;
        throw new Error(errors || data?.message || `Request failed (${response.status})`);
      }
      return data;
    },
    [token]
  );

  const fetchClassDetail = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      try {
        if (!opts.silent) setLoading(true);
        const data = await authedPost('/admin_classes_detail', { class_id: classId });
        setClassData(data.class ?? null);
      } catch (err) {
        Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_detail.load_error', 'Failed to load class details'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, classId, authedPost, t]
  );

  useFocusEffect(
    useCallback(() => {
      fetchClassDetail();
    }, [fetchClassDetail])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchClassDetail({ silent: true });
  };

  const handleArchiveClass = () => {
    Alert.alert(
      t('class_detail.archive_confirm_title', 'Archive Class'),
      t('class_detail.archive_confirm_message', 'Are you sure you want to archive this class?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('class_detail.archive', 'Archive'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await authedPost('/admin_classes_archive', { class_id: classId });
              Alert.alert(t('common.success', 'Success'), t('class_detail.archive_success', 'Class archived successfully'));
              navigation.goBack();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_detail.archive_error', 'Failed to archive class'));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteClass = () => {
    Alert.alert(
      t('class_detail.delete_confirm_title', 'Delete Class'),
      t('class_detail.delete_confirm_message', 'Are you sure you want to delete this class?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              await authedPost('/admin_classes_delete', { class_id: classId });
              Alert.alert(t('common.success', 'Success'), t('class_detail.delete_success', 'Class deleted successfully'));
              navigation.goBack();
            } catch (err) {
              Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_detail.delete_error', 'Failed to delete class'));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleRestoreClass = async () => {
    try {
      setActionLoading(true);
      await authedPost('/admin_classes_restore', { class_id: classId });
      Alert.alert(t('common.success', 'Success'), t('class_detail.restore_success', 'Class restored successfully'));
      fetchClassDetail();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_detail.restore_error', 'Failed to restore class'));
    } finally {
      setActionLoading(false);
    }
  };

  const openDuplicateModal = () => {
    setNewClassCode(classData?.class_code ? `${classData.class_code}-COPY` : '');
    setNewClassName(classData?.name ? `${classData.name} (Copy)` : '');
    setDuplicateModalVisible(true);
  };

  const handleDuplicateClass = async () => {
    if (!newClassCode.trim() || !newClassName.trim()) {
      Alert.alert(t('class_detail.missing_info_title', 'Missing info'), t('class_detail.missing_info_message', 'Please enter both a class code and a name for the copy.'));
      return;
    }
    try {
      setActionLoading(true);
      const data = await authedPost('/admin_classes_duplicate', {
        class_id: classId,
        new_class_code: newClassCode.trim(),
        new_name: newClassName.trim(),
      });
      setDuplicateModalVisible(false);
      const newClass = data.class;
      Alert.alert(t('common.success', 'Success'), t('class_detail.duplicate_success', 'Class duplicated successfully'), [
        {
          text: t('class_detail.view_copy', 'View Copy'),
          onPress: () => newClass?.id && (navigation as any).push('ClassDetail', { classId: newClass.id }),
        },
        { text: t('common.ok', 'OK'), style: 'cancel' },
      ]);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('class_detail.duplicate_error', 'Failed to duplicate class'));
    } finally {
      setActionLoading(false);
    }
  };

  const header = (title: string) => (
    <View style={[styles.navHeader, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
        <IconChevronLeft color={theme.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.navHeaderTitle}>{title}</Text>
      {isAdminRole && classData ? (
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('EditClass', { classId })}
          hitSlop={10}
          style={styles.headerSpacer}
        >
          <IconPencil color={theme.accent} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerSpacer} />
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.flexContainer}>
        {header(t('class_detail.header_title', 'Class Details'))}
        <View style={styles.container}>
          <View style={styles.heroCard}>
            <Skeleton width={56} height={56} borderRadius={28} baseColor={theme.skeletonBase} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Skeleton width="65%" height={20} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
              <Skeleton width="40%" height={13} baseColor={theme.skeletonBase} />
            </View>
          </View>
          {[0, 1, 2].map((key) => (
            <View key={key} style={styles.groupCard}>
              <Skeleton width="40%" height={16} style={{ marginBottom: 14 }} baseColor={theme.skeletonBase} />
              <Skeleton width="100%" height={14} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
              <Skeleton width="100%" height={14} style={{ marginBottom: 10 }} baseColor={theme.skeletonBase} />
              <Skeleton width="70%" height={14} baseColor={theme.skeletonBase} />
            </View>
          ))}
        </View>
        <BottomNavBar />
      </View>
    );
  }

  if (!classData) {
    return (
      <View style={styles.flexContainer}>
        {header(t('class_detail.header_title', 'Class Details'))}
        <View style={styles.container}>
          <EmptyState
            icon="🔍"
            title={t('class_detail.not_found_title', 'Class not found')}
            subtitle={t('class_detail.not_found_subtitle', 'It may have been removed, or the link is out of date.')}
            colors={theme}
          />
        </View>
        <BottomNavBar />
      </View>
    );
  }

  const badge = statusColors(theme, classData.status);
  const pct = classData.enrollment_percentage ?? 0;
  const occupancyColor = pct > 90 ? theme.danger : pct > 75 ? theme.warning : theme.success;

  const basicRows = [
    { label: t('class_detail.grade_level', 'Grade Level'), value: String(classData.grade_level), icon: <GraduationCap size={16} color={theme.textSecondary} strokeWidth={2.1} /> },
    { label: t('class_detail.class_type', 'Class Type'), value: classData.class_type, icon: <Layers size={16} color={theme.textSecondary} strokeWidth={2.1} /> },
    { label: t('class_detail.shift', 'Shift'), value: classData.shift, icon: <Sun size={16} color={theme.textSecondary} strokeWidth={2.1} /> },
    classData.department ? { label: t('class_detail.department', 'Department'), value: classData.department } : null,
    classData.curriculum ? { label: t('class_detail.curriculum', 'Curriculum'), value: classData.curriculum } : null,
    classData.section ? { label: t('class_detail.section', 'Section'), value: classData.section } : null,
  ].filter(Boolean) as { label: string; value: string; icon?: React.ReactNode }[];

  const locationRows = [
    classData.room_number ? { label: t('class_detail.room_number', 'Room Number'), value: classData.room_number } : null,
    classData.building ? { label: t('class_detail.building', 'Building'), value: classData.building } : null,
    classData.floor ? { label: t('class_detail.floor', 'Floor'), value: classData.floor } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  const academicRows = [
    classData.school_year ? { label: t('class_detail.school_year', 'School Year'), value: classData.school_year } : null,
    classData.semester_term ? { label: t('class_detail.semester_term', 'Semester/Term'), value: classData.semester_term } : null,
    { label: t('class_detail.start_date', 'Start Date'), value: formatDate(classData.start_date) },
    { label: t('class_detail.end_date', 'End Date'), value: formatDate(classData.end_date) },
  ].filter(Boolean) as { label: string; value: string }[];

  const metadataRows = [
    classData.created_by ? { label: t('class_detail.created_by', 'Created By'), value: classData.created_by } : null,
    classData.created_at ? { label: t('class_detail.created_at', 'Created At'), value: formatDateTime(classData.created_at) } : null,
    classData.updated_by ? { label: t('class_detail.updated_by', 'Updated By'), value: classData.updated_by } : null,
    classData.updated_at ? { label: t('class_detail.updated_at', 'Updated At'), value: formatDateTime(classData.updated_at) } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <View style={styles.flexContainer}>
      <GlassBackground variant="canvas" />
      {header(t('class_detail.header_title', 'Class Details'))}
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.gradeBadge}>
              <Text style={styles.gradeBadgeText}>{classData.grade_level}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={styles.className} numberOfLines={1}>{classData.name}</Text>
              <Text style={styles.classCode}>{classData.class_code}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: badge.backgroundColor }]}>
              <Text style={[styles.statusText, { color: badge.color }]}>
                {t(`class_detail.status_${classData.status}`, classData.status)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Layers size={13} color={theme.textSecondary} strokeWidth={2.2} />
              <Text style={styles.metaChipText}>{classData.class_type}</Text>
            </View>
            <View style={styles.metaChip}>
              <Sun size={13} color={theme.textSecondary} strokeWidth={2.2} />
              <Text style={styles.metaChipText}>{classData.shift}</Text>
            </View>
            {classData.school_year ? (
              <View style={styles.metaChip}>
                <Clock size={13} color={theme.textSecondary} strokeWidth={2.2} />
                <Text style={styles.metaChipText}>{classData.school_year}</Text>
              </View>
            ) : null}
          </View>

          {classData.description ? <Text style={styles.description}>{classData.description}</Text> : null}
        </View>

        {/* Enrollment card */}
        <View style={styles.groupCard}>
          <Text style={styles.sectionTitle}>{t('class_detail.enrollment_title', 'Enrollment')}</Text>
          <View style={styles.enrollmentRow}>
            <View style={styles.enrollmentStat}>
              <Text style={styles.statValue}>{classData.current_enrollment}</Text>
              <Text style={styles.statLabel}>{t('class_detail.current', 'Current')}</Text>
            </View>
            <View style={styles.enrollmentStat}>
              <Text style={styles.statValue}>{classData.max_capacity}</Text>
              <Text style={styles.statLabel}>{t('class_detail.capacity', 'Capacity')}</Text>
            </View>
            <View style={styles.enrollmentStat}>
              <Text style={styles.statValue}>{classData.available_slots ?? 0}</Text>
              <Text style={styles.statLabel}>{t('class_detail.available', 'Available')}</Text>
            </View>
            <View style={styles.enrollmentStat}>
              <Text style={[styles.statValue, { color: occupancyColor }]}>{pct}%</Text>
              <Text style={styles.statLabel}>{t('class_detail.occupancy', 'Occupancy')}</Text>
            </View>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: occupancyColor }]} />
          </View>
        </View>

        {/* Basic information */}
        <GroupCard title={t('class_detail.basic_info_title', 'Basic Information')} rows={basicRows} styles={styles} />

        {/* Location */}
        {locationRows.length > 0 ? (
          <GroupCard title={t('class_detail.location_title', 'Location')} rows={locationRows} styles={styles} icon={<MapPin size={16} color={theme.textSecondary} strokeWidth={2.1} />} />
        ) : null}

        {/* Academic information */}
        <GroupCard title={t('class_detail.academic_info_title', 'Academic Information')} rows={academicRows} styles={styles} />

        {/* Admin actions */}
        {isAdminRole ? (
          <View style={styles.groupCard}>
            <Text style={styles.sectionTitle}>{t('class_detail.actions_title', 'Actions')}</Text>

            <ActionRow
              styles={styles}
              icon={<Pencil size={17} color={theme.textPrimary} strokeWidth={2.1} />}
              label={t('class_detail.edit_class', 'Edit Class')}
              onPress={() => (navigation as any).navigate('EditClass', { classId })}
              disabled={actionLoading}
            />
            <ActionRow
              styles={styles}
              icon={<Users size={17} color={theme.textPrimary} strokeWidth={2.1} />}
              label={t('class_detail.manage_sections', 'Sections')}
              onPress={() => (navigation as any).navigate('SectionList', { classId })}
              disabled={actionLoading}
            />
            <ActionRow
              styles={styles}
              icon={<Copy size={17} color={theme.textPrimary} strokeWidth={2.1} />}
              label={t('class_detail.duplicate_class', 'Duplicate Class')}
              onPress={openDuplicateModal}
              disabled={actionLoading}
            />
            {classData.status === 'archived' ? (
              <ActionRow
                styles={styles}
                icon={<RotateCcw size={17} color={theme.success} strokeWidth={2.1} />}
                label={t('class_detail.restore_class', 'Restore Class')}
                onPress={handleRestoreClass}
                disabled={actionLoading}
                tone="success"
              />
            ) : (
              <ActionRow
                styles={styles}
                icon={<Archive size={17} color={theme.warning} strokeWidth={2.1} />}
                label={t('class_detail.archive_class', 'Archive Class')}
                onPress={handleArchiveClass}
                disabled={actionLoading}
                tone="warning"
              />
            )}
            <ActionRow
              styles={styles}
              icon={<Trash2 size={17} color={theme.danger} strokeWidth={2.1} />}
              label={t('class_detail.delete_class', 'Delete Class')}
              onPress={handleDeleteClass}
              disabled={actionLoading}
              tone="danger"
              last
            />
          </View>
        ) : null}

        {/* Metadata */}
        {metadataRows.length > 0 ? <GroupCard title={t('class_detail.metadata_title', 'Metadata')} rows={metadataRows} styles={styles} /> : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <BottomNavBar />

      <KeyboardAwareModal visible={duplicateModalVisible} transparent animationType="slide" onRequestClose={() => setDuplicateModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setDuplicateModalVisible(false)}>
          <TouchableOpacity style={styles.modalCard} activeOpacity={1} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('class_detail.duplicate_modal_title', 'Duplicate Class')}</Text>
            <Text style={styles.modalLabel}>{t('class_detail.new_class_code_label', 'New Class Code')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newClassCode}
              onChangeText={setNewClassCode}
              placeholder={t('class_detail.new_class_code_placeholder', 'e.g. G7-A-2027')}
              placeholderTextColor={theme.textMuted}
              autoCapitalize="characters"
            />
            <Text style={styles.modalLabel}>{t('class_detail.new_name_label', 'New Name')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newClassName}
              onChangeText={setNewClassName}
              placeholder={t('class_detail.new_name_placeholder', 'e.g. Grade 7 - Section A')}
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.modalCancelButton]} onPress={() => setDuplicateModalVisible(false)} disabled={actionLoading}>
                <Text style={styles.modalCancelText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalConfirmButton]} onPress={handleDuplicateClass} disabled={actionLoading}>
                {actionLoading ? <ActivityIndicator color={theme.onAccent} size="small" /> : <Text style={styles.modalConfirmText}>{t('class_detail.duplicate', 'Duplicate')}</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAwareModal>
    </View>
  );
};

function GroupCard({
  title,
  rows,
  styles,
}: {
  title: string;
  rows: { label: string; value: string; icon?: React.ReactNode }[];
  styles: ReturnType<typeof makeStyles>;
  icon?: React.ReactNode;
}) {
  return (
    <View style={styles.groupCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {rows.map((row, i) => (
        <View key={row.label} style={[styles.infoRow, i === rows.length - 1 && styles.infoRowLast]}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={styles.infoValue} numberOfLines={1}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ActionRow({
  styles,
  icon,
  label,
  onPress,
  disabled,
  tone,
  last,
}: {
  styles: ReturnType<typeof makeStyles>;
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'success' | 'warning' | 'danger';
  last?: boolean;
}) {
  const textStyle = [
    styles.actionRowLabel,
    tone === 'success' && styles.actionRowLabelSuccess,
    tone === 'warning' && styles.actionRowLabelWarning,
    tone === 'danger' && styles.actionRowLabelDanger,
  ];
  return (
    <TouchableOpacity
      style={[styles.actionRow, last && styles.actionRowLast]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <View style={styles.actionRowIcon}>{icon}</View>
      <Text style={textStyle}>{label}</Text>
      <IconChevronRight color="#9aa3ab" />
    </TouchableOpacity>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    flexContainer: { flex: 1, backgroundColor: theme.background },
    navHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: theme.surface,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    navHeaderTitle: { flex: 1, marginLeft: 8, fontSize: 17, fontWeight: '700', color: theme.textPrimary },
    backButton: { width: 32 },
    headerSpacer: { width: 32, alignItems: 'flex-end' },

    heroCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl ?? 20,
      margin: 16,
      marginBottom: 0,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    heroTop: { flexDirection: 'row', alignItems: 'center' },
    gradeBadge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gradeBadgeText: { fontSize: 20, fontWeight: '800', color: theme.accentSoftText },
    className: { fontSize: 19, fontWeight: '800', color: theme.textPrimary },
    classCode: { fontSize: 12.5, fontWeight: '600', color: theme.textSecondary, marginTop: 2 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.pill },
    statusText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    description: { fontSize: 13.5, color: theme.textSecondary, lineHeight: 19, marginTop: 14 },

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

    groupCard: {
      backgroundColor: theme.surface,
      borderRadius: RADIUS.xl ?? 20,
      marginHorizontal: 16,
      marginTop: 14,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation1,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },

    enrollmentRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14, marginTop: 6 },
    enrollmentStat: { alignItems: 'center' },
    statValue: { fontSize: 19, fontWeight: '800', color: theme.textPrimary },
    statLabel: { fontSize: 11.5, color: theme.textSecondary, marginTop: 3 },
    progressBar: { height: 7, backgroundColor: theme.border, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },

    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.surfaceVariant,
    },
    infoRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    infoLabel: { fontSize: 13.5, color: theme.textSecondary, fontWeight: '500' },
    infoValue: { fontSize: 13.5, color: theme.textPrimary, fontWeight: '600', flex: 1, marginLeft: 16, textAlign: 'right', textTransform: 'capitalize' },

    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.surfaceVariant,
      gap: 12,
    },
    actionRowLast: { borderBottomWidth: 0, paddingBottom: 2 },
    actionRowIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionRowLabel: { flex: 1, fontSize: 14.5, fontWeight: '600', color: theme.textPrimary },
    actionRowLabelSuccess: { color: theme.success },
    actionRowLabelWarning: { color: theme.warning },
    actionRowLabelDanger: { color: theme.danger },

    bottomSpacer: { height: 20 },

    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 20,
      paddingTop: 6,
    },
    modalHandle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.borderStrong,
      alignSelf: 'center',
      marginBottom: 14,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 16 },
    modalLabel: { fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 6 },
    modalInput: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: theme.textPrimary,
      marginBottom: 14,
    },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
    modalButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.pill, marginLeft: 10, minWidth: 90, alignItems: 'center' },
    modalCancelButton: { backgroundColor: theme.surfaceVariant },
    modalCancelText: { color: theme.textPrimary, fontWeight: '600' },
    modalConfirmButton: { backgroundColor: theme.accent },
    modalConfirmText: { color: theme.onAccent, fontWeight: '600' },
  });

export default ClassDetailScreen;
