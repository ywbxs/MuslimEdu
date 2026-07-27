import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Polyline, Line, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import {
  fetchClassTeacherAssignments,
  assignClassTeacher,
  fetchAcademicDashboardStats,
  ClassSection,
  AssignableTeacher,
  DashboardStats,
} from '../../services/teacherClassService';
import { Skeleton } from '../../components/Skeleton';
import { useAcademicGlassTheme, AcademicGlassTheme } from './academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Colors now come from academicTheme.ts (emerald variant) for light/dark support.

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconClose({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}
function IconCheck({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Polyline points="5 13 10 18 19 7" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconChevronRight({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Polyline points="9 5 16 12 9 19" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconPerson({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2} />
      <Path d="M4 20c0-3.3 3.6-5 8-5s8 1.7 8 5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function IconSearch({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={2} />
      <Line x1={21} y1={21} x2={16.65} y2={16.65} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function RowSkeleton({ styles, theme }: { styles: any; theme: AcademicGlassTheme }) {
  return (
    <View style={styles.card}>
      <Skeleton width="50%" height={15} borderRadius={4} baseColor={theme.skeletonBase} />
      <Skeleton width="35%" height={12} borderRadius={4} style={{ marginTop: 10 }} baseColor={theme.skeletonBase} />
    </View>
  );
}

function TeacherPicker({
  visible,
  teachers,
  currentTeacherId,
  onSelect,
  onClose,
  isSaving,
  styles,
  theme,
}: {
  visible: boolean;
  teachers: AssignableTeacher[];
  currentTeacherId: number | null | undefined;
  onSelect: (teacherId: number | null) => void;
  onClose: () => void;
  isSaving: boolean;
  styles: any;
  theme: AcademicGlassTheme;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Assign Class Teacher</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <IconClose color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {isSaving ? (
            <View style={styles.savingWrap}>
              <ActivityIndicator color={theme.accent} />
            </View>
          ) : (
            <FlatList
              data={teachers}
              keyExtractor={(t) => String(t.id)}
              contentContainerStyle={{ paddingBottom: 24 }}
              ListHeaderComponent={
                currentTeacherId ? (
                  <TouchableOpacity style={styles.optionRow} onPress={() => onSelect(null)} activeOpacity={0.7}>
                    <View style={[styles.optionIcon, { backgroundColor: theme.dangerSoft }]}>
                      <IconClose color={theme.danger} />
                    </View>
                    <Text style={[styles.optionLabel, { color: theme.danger }]}>Remove class teacher</Text>
                  </TouchableOpacity>
                ) : null
              }
              renderItem={({ item }) => {
                const isCurrent = item.id === currentTeacherId;
                return (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => onSelect(item.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.optionIcon}>
                      <IconPerson color={theme.accent} />
                    </View>
                    <Text style={styles.optionLabel}>{item.name}</Text>
                    {isCurrent ? <IconCheck color={theme.accent} /> : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyPickerText}>No teachers found in your school yet.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function AdminClassTeacherAssignScreen() {
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme('emerald');
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useNavigation();
  const { token } = useAuth();

  const [sections, setSections] = useState<ClassSection[]>([]);
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState('');
  const [adviserFilter, setAdviserFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  const [activeSection, setActiveSection] = useState<ClassSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!token) return;
      if (!opts.silent) setIsLoading(true);
      setError(null);
      try {
        const [data, statsData] = await Promise.all([
          fetchClassTeacherAssignments(token),
          fetchAcademicDashboardStats(token).catch(() => null),
        ]);
        setSections(data.sections);
        setTeachers(data.teachers);
        if (statsData) setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load classes.');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    load({ silent: true });
  };

  const visibleSections = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return sections.filter((s) => {
      if (adviserFilter === 'assigned' && !s.class_teacher_id) return false;
      if (adviserFilter === 'unassigned' && s.class_teacher_id) return false;
      if (!q) return true;
      const label = `${s.class_name ?? ''} ${s.section_name}`.toLowerCase();
      return label.includes(q);
    });
  }, [sections, searchText, adviserFilter]);

  const onSelectTeacher = async (teacherId: number | null) => {
    if (!token || !activeSection) return;
    setIsSaving(true);
    try {
      await assignClassTeacher(token, activeSection.section_id, teacherId);
      const teacherName = teacherId ? teachers.find((t) => t.id === teacherId)?.name ?? null : null;
      setSections((prev) =>
        prev.map((s) =>
          s.section_id === activeSection.section_id
            ? { ...s, class_teacher_id: teacherId, class_teacher_name: teacherName }
            : s
        )
      );
      setActiveSection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the class teacher.');
      setActiveSection(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Academic Management</Text>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
          <RowSkeleton styles={styles} theme={theme} />
        </View>
      ) : (
        <FlatList
          data={visibleSections}
          keyExtractor={(item) => String(item.section_id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          ListHeaderComponent={
            <View>
              <View style={styles.statsGrid}>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('CampusList')}
                >
                  <Text style={styles.statValue}>{stats?.campuses ?? '—'}</Text>
                  <Text style={styles.statLabel}>Campuses</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('GradeLevelList')}
                >
                  <Text style={styles.statValue}>{stats?.grade_levels ?? '—'}</Text>
                  <Text style={styles.statLabel}>Grade Levels</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('DepartmentList')}
                >
                  <Text style={styles.statValue}>{stats?.departments ?? '—'}</Text>
                  <Text style={styles.statLabel}>Departments</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('CurriculumList')}
                >
                  <Text style={styles.statValue}>{stats?.curricula ?? '—'}</Text>
                  <Text style={styles.statLabel}>Curricula</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.statCard}
                  activeOpacity={0.8}
                  onPress={() => (navigation as any).navigate('ClassList')}
                >
                  <Text style={styles.statValue}>{stats?.classes ?? '—'}</Text>
                  <Text style={styles.statLabel}>Classes</Text>
                </TouchableOpacity>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.sections ?? '—'}</Text>
                  <Text style={styles.statLabel}>Sections</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.teachers ?? '—'}</Text>
                  <Text style={styles.statLabel}>Teachers</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats?.subjects ?? '—'}</Text>
                  <Text style={styles.statLabel}>Subjects</Text>
                </View>
                <View style={[styles.statCard, styles.statCardWide]}>
                  <Text style={styles.statValue}>{stats?.students ?? '—'}</Text>
                  <Text style={styles.statLabel}>Students Enrolled</Text>
                </View>
              </View>

              <View style={styles.searchRow}>
                <IconSearch color={theme.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search class or section..."
                  placeholderTextColor={theme.textSecondary}
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {(['all', 'assigned', 'unassigned'] as const).map((f) => {
                  const active = adviserFilter === f;
                  const label = f === 'all' ? 'All' : f === 'assigned' ? 'Has adviser' : 'No adviser';
                  return (
                    <TouchableOpacity
                      key={f}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                      onPress={() => setAdviserFilter(f)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            !error ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyTitle}>{sections.length === 0 ? 'No classes yet' : 'No matches'}</Text>
                <Text style={styles.emptyDesc}>
                  {sections.length === 0
                    ? 'Set up classes and sections first, then assign class teachers here.'
                    : 'Try a different search or filter.'}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const assigned = !!item.class_teacher_id;
            const classLabel = `${item.class_name ?? 'Class'} - ${item.section_name}`;
            return (
              <View style={styles.card}>
                <TouchableOpacity style={styles.cardMain} activeOpacity={0.85} onPress={() => setActiveSection(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{classLabel}</Text>
                    <View style={[styles.badge, assigned ? styles.badgeAssigned : styles.badgeUnassigned]}>
                      <Text style={[styles.badgeText, assigned ? styles.badgeTextAssigned : styles.badgeTextUnassigned]}>
                        {assigned ? item.class_teacher_name : 'Not assigned'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.changeText}>{assigned ? 'Change' : 'Assign'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.subjectsRow}
                  activeOpacity={0.75}
                  onPress={() =>
                    (navigation as any).navigate('AdminClassSubjects', {
                      sectionId: item.section_id,
                      classLabel,
                    })
                  }
                >
                  <Text style={styles.subjectsRowText}>Manage subjects & schedule</Text>
                  <IconChevronRight color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      <TeacherPicker
        visible={!!activeSection}
        teachers={teachers}
        currentTeacherId={activeSection?.class_teacher_id}
        onSelect={onSelectTeacher}
        onClose={() => setActiveSection(null)}
        isSaving={isSaving}
        styles={styles}
        theme={theme}
      />
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: { width: 32 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: theme.textPrimary },
  listContent: { padding: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  statCardWide: { flexBasis: '100%' },
  statValue: { fontSize: 20, fontWeight: '800', color: theme.accent, marginBottom: 2 },
  statLabel: { fontSize: 11.5, color: theme.textSecondary, fontWeight: '600', textAlign: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: theme.textPrimary, padding: 0 },
  filterRow: { marginBottom: 14 },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accent },
  filterChipText: { fontSize: 12.5, fontWeight: '600', color: theme.textPrimary },
  filterChipTextActive: { color: theme.accent },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  subjectsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.background,
  },
  subjectsRowText: { fontSize: 13, fontWeight: '600', color: theme.textPrimary },
  cardTitle: { fontSize: 15, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeAssigned: { backgroundColor: theme.accentSoft },
  badgeUnassigned: { backgroundColor: theme.warningSoft },
  badgeText: { fontSize: 12, fontWeight: '600' },
  badgeTextAssigned: { color: theme.accent },
  badgeTextUnassigned: { color: theme.warning },
  changeText: { fontSize: 13, fontWeight: '700', color: theme.accent },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 8 },
  emptyDesc: { fontSize: 13.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 19 },
  errorBanner: { backgroundColor: theme.dangerSoft, borderRadius: 12, padding: 14, marginBottom: 12 },
  errorText: { color: theme.danger, fontSize: 13.5, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingTop: 18,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 16.5, fontWeight: '700', color: theme.textPrimary },
  savingWrap: { paddingVertical: 40, alignItems: 'center' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionLabel: { flex: 1, fontSize: 14.5, color: theme.textPrimary, fontWeight: '600' },
  emptyPickerText: { textAlign: 'center', color: theme.textSecondary, paddingVertical: 30, paddingHorizontal: 24 },
});
