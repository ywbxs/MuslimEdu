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
import Svg, { Polyline } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import { Skeleton } from '../../components/Skeleton';
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

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function EnrollmentWorkflowListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();

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
      const [sessions, list] = await Promise.all([
        fetchAcademicSessions(token),
        fetchEnrollmentWorkflowList(token, statusFilter === 'all' ? {} : { status: statusFilter }),
      ]);
      setCurrentSession(pickCurrentSession(sessions));
      setSessionChecked(true);
      setRecords(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollment records.');
    } finally {
      setLoading(false);
    }
  }, [token, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openPicker = async () => {
    if (!currentSession) {
      Alert.alert(
        'No Academic Year Set',
        'Set a current academic year before starting enrollment workflows for students.'
      );
      return;
    }
    setPickerVisible(true);
    setStudentsLoading(true);
    try {
      const list = await fetchStudents(token!, '');
      setStudents(list);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to load students.');
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
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not start the workflow.');
    } finally {
      setStarting(null);
    }
  };

  const renderRecord = ({ item }: { item: WorkflowRecord }) => {
    const statusColor =
      item.status === 'completed' ? theme.success : item.status === 'withdrawn' ? theme.danger : theme.accent;
    const statusBg =
      item.status === 'completed' ? theme.successSoft : item.status === 'withdrawn' ? theme.dangerSoft : theme.accentSoft;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => (navigation as any).navigate('EnrollmentWorkflowDetail', { recordId: item.id })}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.studentName}>{item.student?.name ?? `Student #${item.user_id}`}</Text>
          <Text style={styles.stageText}>{item.currentStage?.name ?? 'Unknown stage'}</Text>
        </View>
        <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusBg }]}>
          {item.status.replace('_', ' ')}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderSkeletonCard = (key: number) => (
    <View key={key} style={styles.card}>
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={16} style={{ marginBottom: 8 }} baseColor={theme.skeletonBase} />
        <Skeleton width="40%" height={13} baseColor={theme.skeletonBase} />
      </View>
      <Skeleton width={70} height={22} borderRadius={12} baseColor={theme.skeletonBase} />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
            <IconChevronLeft color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, styles.headerTitleFlex]}>Enrollment Records</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.listContainer}>{[0, 1, 2, 3, 4].map(renderSkeletonCard)}</View>
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
        <TouchableOpacity style={styles.addButton} onPress={openPicker}>
          <Text style={styles.addButtonText}>+ Start</Text>
        </TouchableOpacity>
      </View>

      {sessionChecked && !currentSession ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            No academic year is set as current yet - set one before starting workflows.
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
          <TouchableOpacity onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
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
              {status === 'all' ? 'All' : status.replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        style={{ flex: 1 }}
        data={records}
        renderItem={renderRecord}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No records here"
            subtitle={
              statusFilter === 'all'
                ? 'No students have been started in the enrollment workflow yet.'
                : `No ${statusFilter.replace('_', ' ')} records right now.`
            }
            colors={theme}
          />
        }
      />
      <BottomNavBar />

      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Enrollment Workflow</Text>
            <TextInput
              style={styles.modalSearch}
              placeholder="Search students..."
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
                  <Text style={styles.modalEmptyText}>No students match "{studentSearch}".</Text>
                }
              />
            )}
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setPickerVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
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

    filterBar: { paddingHorizontal: 16, paddingVertical: 12 },
    filterButton: {
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

    listContainer: { paddingHorizontal: 16, paddingVertical: 12 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
      ...theme.elevation2,
    },
    studentName: { fontSize: 15.5, fontWeight: '700', color: theme.textPrimary, marginBottom: 3 },
    stageText: { fontSize: 12.5, color: theme.textSecondary },
    statusBadge: {
      fontSize: 11,
      fontWeight: '600',
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
      overflow: 'hidden',
      textTransform: 'capitalize',
    },

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
