import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { can } from '../../services/permissions';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { BentoGrid } from '../../components/glass/BentoGridCard';
import UserAvatar from '../../components/UserAvatar';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import BottomNavBar from '../../components/BottomNavBar';
import {
  WorkflowRecord,
  fetchEnrollmentWorkflowList,
  startEnrollmentWorkflow,
} from '../../services/enrollmentWorkflowService';
import { fetchAcademicSessions, pickCurrentSession, AcademicSession } from '../../services/academicSessionService';
import { fetchStudents, StudentSummary } from '../../services/adminService';

/**
 * Admin: spec §4.16 - students' progress through the enrollment pipeline
 * configured in EnrollmentStagesScreen. This is the "workflow records" half
 * of the feature; stage configuration lives in EnrollmentStagesScreen /
 * EnrollmentStageFormScreen (built previously).
 *
 * "+ Start" opens a bottom-sheet student picker (same Modal pattern as
 * DepartmentFormScreen's option pickers) and calls
 * admin_enrollment_workflow_start against the school's current academic
 * year - resolved via admin_sessions_list / pickCurrentSession, since there
 * is no separate "current session" endpoint. If a school hasn't set a
 * current year yet, the picker is blocked with an explanatory message
 * rather than silently guessing a session_id.
 */

const STATUS_FILTERS: Array<'in_progress' | 'completed' | 'withdrawn' | 'all'> = [
  'in_progress',
  'completed',
  'withdrawn',
  'all',
];

const WORKFLOW_STATUS_FALLBACKS: Record<string, string> = {
  in_progress: 'in progress',
  completed: 'completed',
  withdrawn: 'withdrawn',
};

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconLayers({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l9 5-9 5-9-5 9-5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M3 13l9 5 9-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconAlertTriangle({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
      <Path d="M12 4 2.5 20h19L12 4Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M12 10v4.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

export default function EnrollmentWorkflowListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, user } = useAuth();
  const { t } = useLocale();
  // Starting a new workflow is an admin-only decision (see
  // admin_enrollment_workflow_start's requireAdmin-only guard) - a
  // Registrar shares this screen but can only view/advance, not start.
  const canStart = can(user, 'manage_enrollment');
  const workflowStatusLabel = (s: string) => t(`enrollment_workflow_list.status_${s}`, WORKFLOW_STATUS_FALLBACKS[s] ?? s.replace('_', ' '));

  const [records, setRecords] = useState<WorkflowRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('in_progress');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentSession, setCurrentSession] = useState<AcademicSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Start-workflow picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [starting, setStarting] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await fetchEnrollmentWorkflowList(token, statusFilter === 'all' ? {} : { status: statusFilter });
      setRecords(list);

      // Academic sessions are only needed to power the "+ Start" picker,
      // which is admin-only (admin_enrollment_workflow_start is
      // admin-only, and admin_sessions_list itself is admin-gated too) -
      // a Cashier/Registrar sharing this screen can't start workflows, so
      // skip this call for them entirely rather than letting its 403
      // fail the whole Promise.all and blank out records they CAN see.
      if (canStart) {
        try {
          const sessions = await fetchAcademicSessions(token);
          setCurrentSession(pickCurrentSession(sessions));
        } catch {
          setCurrentSession(null);
        }
        setSessionChecked(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('enrollment_workflow_list.load_error', 'Failed to load enrollment records.'));
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter, t, canStart]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openPicker = async () => {
    if (!currentSession) {
      Alert.alert(
        t('enrollment_workflow_list.no_session_title', 'No Academic Year Set'),
        t('enrollment_workflow_list.no_session_message', 'Set a current academic year before starting enrollment workflows for students.'),
      );
      return;
    }
    setPickerVisible(true);
    setStudentsLoading(true);
    try {
      const list = await fetchStudents(token!, '');
      setStudents(list);
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_list.load_students_error', 'Failed to load students.'));
    } finally {
      setStudentsLoading(false);
    }
  };

  const searchStudents = async (text: string) => {
    setStudentSearch(text);
    if (!token) return;
    setStudentsLoading(true);
    try {
      const list = await fetchStudents(token, text);
      setStudents(list);
    } catch {
      // Keep the previous list visible rather than clearing it on a
      // transient search error.
    } finally {
      setStudentsLoading(false);
    }
  };

  const handleStart = async (student: StudentSummary) => {
    if (!token || !currentSession) return;
    setStarting(student.id);
    try {
      await startEnrollmentWorkflow(token, student.id, currentSession.id);
      setPickerVisible(false);
      setStudentSearch('');
      load();
    } catch (err) {
      Alert.alert(t('common.error', 'Error'), err instanceof Error ? err.message : t('enrollment_workflow_list.start_error', 'Could not start the workflow.'));
    } finally {
      setStarting(null);
    }
  };

  const renderRecord = (item: WorkflowRecord) => {
    const statusColor =
      item.status === 'completed' ? theme.success : item.status === 'withdrawn' ? theme.danger : theme.accent;
    const statusBg =
      item.status === 'completed' ? theme.successSoft : item.status === 'withdrawn' ? theme.dangerSoft : theme.accentSoft;
    const studentName = item.student?.name ?? t('enrollment_workflow_list.student_fallback', 'Student #{id}').replace('{id}', String(item.user_id));
    const placed = !!item.section_name;
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('EnrollmentWorkflowDetail', { recordId: item.id })}
      >
        <View style={styles.cardTop}>
          <UserAvatar name={studentName} photo={item.student?.photo ?? null} size={44} ringColor={theme.border} dotColor={statusColor} />
          <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusBg }]}>
            {workflowStatusLabel(item.status)}
          </Text>
        </View>

        <Text style={styles.studentName} numberOfLines={1}>{studentName}</Text>
        <Text style={styles.stageText} numberOfLines={1}>
          {item.current_stage?.name ?? t('enrollment_workflow_list.unknown_stage', 'Unknown stage')}
        </Text>

        {placed ? (
          <View style={styles.sectionChip}>
            <IconLayers color={theme.accent} />
            <Text style={styles.sectionChipText} numberOfLines={1}>
              {[item.class_name, item.section_name].filter(Boolean).join(' - ')}
            </Text>
          </View>
        ) : (
          <View style={styles.warnChip}>
            <IconAlertTriangle color={theme.danger} />
            <Text style={styles.warnChipText} numberOfLines={1}>
              {item.status === 'completed'
                ? t('enrollment_workflow_list.needs_placement', 'Needs section')
                : t('enrollment_workflow_list.not_placed', 'Not placed')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={styles.cardTop}>
        <SkeletonCircle size={44} baseColor={theme.skeletonBase} />
        <Skeleton width={60} height={20} borderRadius={10} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width="70%" height={15} style={{ marginTop: 10, marginBottom: 6 }} baseColor={theme.skeletonBase} />
      <Skeleton width="45%" height={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('enrollment_workflow_list.title', 'Enrollment Records')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <BentoGrid>{[0, 1, 2, 3, 4].map(renderSkeletonCard)}</BentoGrid>
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
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Enrollment Records</Text>
        {canStart ? (
          <TouchableOpacity style={styles.addButton} onPress={openPicker}>
            <Text style={styles.addButtonText}>{t('enrollment_workflow_list.start', '+ Start')}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {canStart && sessionChecked && !currentSession ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            {t('enrollment_workflow_list.no_current_year', 'No academic year is set as current yet - set one before starting workflows.')}
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>{t('common.retry', 'Retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView horizontal style={styles.filterBar} showsHorizontalScrollIndicator={false}>
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, statusFilter === status && styles.filterButtonActive]}
            onPress={() => setStatusFilter(status)}
          >
            <Text style={[styles.filterButtonText, statusFilter === status && styles.filterButtonTextActive]}>
              {status === 'all' ? t('common.all', 'All') : workflowStatusLabel(status)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }}>
        {records.length === 0 ? (
          <EmptyState
            icon="📋"
            title={t('enrollment_workflow_list.empty_title', 'No records here')}
            subtitle={
              statusFilter === 'all'
                ? t('enrollment_workflow_list.empty_subtitle_all', 'No students have been started in the enrollment workflow yet.')
                : t('enrollment_workflow_list.empty_subtitle_status', 'No {status} records right now.').replace('{status}', workflowStatusLabel(statusFilter))
            }
            colors={theme}
          />
        ) : (
          <BentoGrid>{records.map(renderRecord)}</BentoGrid>
        )}
      </ScrollView>
      <BottomNavBar />

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('enrollment_workflow_list.modal_title', 'Start Enrollment Workflow')}</Text>
            <TextInput
              style={styles.modalSearch}
              placeholder={t('enrollment_workflow_list.search_placeholder', 'Search students...')}
              value={studentSearch}
              onChangeText={searchStudents}
              placeholderTextColor={theme.textMuted}
            />
            {studentsLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginVertical: 20 }} />
            ) : (
              <FlatList
                data={students}
                keyExtractor={(s) => s.id.toString()}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    disabled={starting === item.id}
                    onPress={() => handleStart(item)}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {starting === item.id ? <ActivityIndicator size="small" color={theme.accent} /> : null}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.modalEmptyText}>
                    {t('enrollment_workflow_list.no_match', 'No students match "{query}".').replace('{query}', studentSearch)}
                  </Text>
                }
              />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalCloseText}>{t('common.close', 'Close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

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
    addButton: { backgroundColor: theme.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
    addButtonText: { color: theme.onAccent, fontWeight: '600', fontSize: 14 },

    errorBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.dangerSoft,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 12,
      borderRadius: RADIUS.md,
    },
    errorBannerText: { color: theme.danger, fontSize: 13, flex: 1, marginRight: 8 },
    retryText: { color: theme.danger, fontWeight: '700', fontSize: 13 },

    // alignItems is required here - a horizontal ScrollView's content is a
    // row flex container, which defaults to alignItems: 'stretch' with no
    // explicit height on any child. Without this, every filterButton below
    // stretches to fill the ScrollView's full cross-axis height instead of
    // hugging its own padding, turning the pill row into near-full-screen
    // vertical bars.
    filterBar: { paddingHorizontal: 16, paddingVertical: 12, flexGrow: 0 },
    filterButton: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      marginRight: 8,
    },
    filterButtonActive: { backgroundColor: theme.accent, borderColor: theme.accent },
    filterButtonText: { fontSize: 12, color: theme.textSecondary, fontWeight: '500', textTransform: 'capitalize' },
    filterButtonTextActive: { color: theme.onAccent },

    card: {
      width: '47%',
      minHeight: 150,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    studentName: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary, marginBottom: 2 },
    stageText: { fontSize: 12, color: theme.textSecondary, marginBottom: 10 },
    statusBadge: {
      fontSize: 10.5,
      fontWeight: '600',
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 10,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },
    sectionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.accentSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 5,
      maxWidth: '100%',
    },
    sectionChipText: { fontSize: 11, fontWeight: '600', color: theme.accent, flexShrink: 1 },
    warnChip: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.dangerSoft,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      gap: 5,
    },
    warnChipText: { fontSize: 11, fontWeight: '600', color: theme.danger },

    modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
    modalContent: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: RADIUS.lg,
      borderTopRightRadius: RADIUS.lg,
      padding: 20,
      maxHeight: '80%',
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary, marginBottom: 14 },
    modalSearch: {
      height: 44,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: RADIUS.sm,
      paddingHorizontal: 14,
      fontSize: 14.5,
      color: theme.textPrimary,
      marginBottom: 12,
    },
    modalItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalItemText: { fontSize: 15, color: theme.textPrimary },
    modalEmptyText: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', paddingVertical: 24 },
    modalCloseButton: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
    modalCloseText: { fontSize: 14.5, fontWeight: '600', color: theme.textSecondary },
  });
