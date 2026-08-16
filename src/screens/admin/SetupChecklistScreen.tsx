import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookOpen, Building2, Calendar, Camera, ChevronLeft, CircleDollarSign, Clock, Flag, IdCard, Layers, Star } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import BentoGridCard, { BentoGrid } from '../../components/glass/BentoGridCard';
import ProgressRing from '../../components/glass/ProgressRing';
import BottomNavBar from '../../components/BottomNavBar';
import { fetchAcademicSessions } from '../../services/academicSessionService';
import { fetchGradingSystems, fetchSubjectsCatalog } from '../../services/adminAcademicCatalogService';
import { fetchClasses } from '../../services/adminService';
import { listSchedules } from '../../services/academicScheduleService';
import { fetchAttendanceMethods } from '../../services/attendanceConfigService';
import { fetchEnrollmentStages, fetchFeeTypes } from '../../services/enrollmentWorkflowService';
import { fetchStudentNumberConfig } from '../../services/studentNumberService';

/**
 * Persistent, revisitable version of AcademicSetupWizardScreen (which only
 * ever runs once, before academic_setup_completed flips true, and covers
 * just institution/year/grading/first-enrollment-stage - see its own
 * comment). This is reachable any time from the admin dashboard menu and
 * checks live data for everything a school needs before its portals are
 * genuinely ready to use day-to-day - including the pieces the one-time
 * wizard doesn't touch at all (classes/sections, subjects, class schedule,
 * attendance config, fee types), several of which turned out to have no
 * discoverable entry point anywhere in the app until this session.
 */

type ItemStatus = 'checking' | 'done' | 'todo' | 'error';

type ChecklistCategory = 'foundation' | 'operations' | 'enrollment';

interface ChecklistItem {
  key: string;
  title: string;
  desc: string;
  route: string;
  category: ChecklistCategory;
  status: ItemStatus;
  count: number | null;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconBuilding({ color }: { color: string }) {
  return <Building2 size={22} color={color} strokeWidth={1.8} />;
}
function IconCalendar({ color }: { color: string }) {
  return <Calendar size={22} color={color} strokeWidth={2} />;
}
function IconGrade({ color }: { color: string }) {
  return <Star size={22} color={color} strokeWidth={1.8} />;
}
function IconLayers({ color }: { color: string }) {
  return <Layers size={22} color={color} strokeWidth={2} />;
}
function IconBook({ color }: { color: string }) {
  return <BookOpen size={22} color={color} strokeWidth={2} />;
}
function IconClock({ color }: { color: string }) {
  return <Clock size={22} color={color} strokeWidth={2} />;
}
function IconCamera({ color }: { color: string }) {
  return <Camera size={22} color={color} strokeWidth={2} />;
}
function IconFlag({ color }: { color: string }) {
  return <Flag size={22} color={color} strokeWidth={2} />;
}
function IconCoin({ color }: { color: string }) {
  return <CircleDollarSign size={22} color={color} strokeWidth={2} />;
}
function IconIdCard({ color }: { color: string }) {
  return <IdCard size={22} color={color} strokeWidth={2} />;
}

export default function SetupChecklistScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token } = useAuth();
  const { t } = useLocale();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    const checks: Array<{ key: string; title: string; desc: string; route: string; category: ChecklistCategory; run: () => Promise<number> }> = [
      {
        key: 'academic_year',
        title: t('setup_checklist.academic_year_title', 'Academic Year'),
        desc: t('setup_checklist.academic_year_desc', 'At least one school year with a current year set.'),
        route: 'AcademicYears',
        category: 'foundation',
        run: async () => (await fetchAcademicSessions(token)).length,
      },
      {
        key: 'grading',
        title: t('setup_checklist.grading_title', 'Grading System'),
        desc: t('setup_checklist.grading_desc', 'How grades are scored and reported.'),
        route: 'GradingSystems',
        category: 'foundation',
        run: async () => (await fetchGradingSystems(token)).length,
      },
      {
        key: 'classes',
        title: t('setup_checklist.classes_title', 'Classes & Sections'),
        desc: t('setup_checklist.classes_desc', 'Create classes, then sections (with room + adviser) inside them.'),
        route: 'ClassList',
        category: 'foundation',
        run: async () => (await fetchClasses(token)).length,
      },
      {
        key: 'subjects',
        title: t('setup_checklist.subjects_title', 'Subjects'),
        desc: t('setup_checklist.subjects_desc', 'The subject catalog sections and schedules pull from.'),
        route: 'ProgramsCatalog',
        category: 'foundation',
        run: async () => (await fetchSubjectsCatalog(token)).length,
      },
      {
        key: 'student_staff_codes',
        title: t('setup_checklist.student_staff_codes_title', 'Student & Staff Codes'),
        desc: t('setup_checklist.student_staff_codes_desc', 'The code format assigned automatically to new students and staff.'),
        route: 'StudentStaffCodeSetup',
        category: 'foundation',
        run: async () => {
          const [student, staff] = await Promise.all([
            fetchStudentNumberConfig(token, 'student'),
            fetchStudentNumberConfig(token, 'staff'),
          ]);
          return student.is_configured && staff.is_configured ? 1 : 0;
        },
      },
      {
        key: 'schedule',
        title: t('setup_checklist.schedule_title', 'Class Schedule'),
        desc: t('setup_checklist.schedule_desc', 'Assign subject, teacher, room and time to each section.'),
        route: 'AdminSchedule',
        category: 'foundation',
        run: async () => (await listSchedules(token)).length,
      },
      {
        key: 'attendance',
        title: t('setup_checklist.attendance_title', 'Attendance Config'),
        desc: t('setup_checklist.attendance_desc', 'Which capture methods (manual, QR, face) are active.'),
        route: 'AttendanceConfig',
        category: 'operations',
        run: async () => (await fetchAttendanceMethods(token)).length,
      },
      {
        key: 'enrollment_stages',
        title: t('setup_checklist.enrollment_stages_title', 'Enrollment Stages'),
        desc: t('setup_checklist.enrollment_stages_desc', 'The admission pipeline students move through.'),
        route: 'EnrollmentStages',
        category: 'enrollment',
        run: async () => (await fetchEnrollmentStages(token)).length,
      },
      {
        key: 'fee_types',
        title: t('setup_checklist.fee_types_title', 'Fee Types'),
        desc: t('setup_checklist.fee_types_desc', 'Tuition, miscellaneous, service fees - what enrollment collects.'),
        route: 'EnrollmentFeeTypes',
        category: 'enrollment',
        run: async () => (await fetchFeeTypes(token)).length,
      },
    ];

    setItems(checks.map((c) => ({ key: c.key, title: c.title, desc: c.desc, route: c.route, category: c.category, status: 'checking', count: null })));

    const results = await Promise.all(
      checks.map(async (c) => {
        try {
          const count = await c.run();
          return { key: c.key, status: (count > 0 ? 'done' : 'todo') as ItemStatus, count };
        } catch {
          return { key: c.key, status: 'error' as ItemStatus, count: null };
        }
      })
    );

    setItems((prev) =>
      prev.map((item) => {
        const r = results.find((x) => x.key === item.key);
        return r ? { ...item, status: r.status, count: r.count } : item;
      })
    );
    setLoading(false);
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const iconFor = (key: string, color: string) => {
    switch (key) {
      case 'academic_year':
        return <IconCalendar color={color} />;
      case 'grading':
        return <IconGrade color={color} />;
      case 'classes':
        return <IconLayers color={color} />;
      case 'subjects':
        return <IconBook color={color} />;
      case 'student_staff_codes':
        return <IconIdCard color={color} />;
      case 'schedule':
        return <IconClock color={color} />;
      case 'attendance':
        return <IconCamera color={color} />;
      case 'enrollment_stages':
        return <IconFlag color={color} />;
      case 'fee_types':
        return <IconCoin color={color} />;
      default:
        return <IconBuilding color={color} />;
    }
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const overallPercent = items.length > 0 ? (doneCount / items.length) * 100 : 0;

  const CATEGORY_LABELS: Record<ChecklistCategory, string> = {
    foundation: t('setup_checklist.category_foundation', 'Academic Foundation'),
    operations: t('setup_checklist.category_operations', 'Operations'),
    enrollment: t('setup_checklist.category_enrollment', 'Enrollment & Fees'),
  };
  const categoryBreakdown = (['foundation', 'operations', 'enrollment'] as ChecklistCategory[])
    .map((cat) => {
      const catItems = items.filter((i) => i.category === cat);
      const catDone = catItems.filter((i) => i.status === 'done').length;
      return { key: cat, label: CATEGORY_LABELS[cat], done: catDone, total: catItems.length };
    })
    .filter((c) => c.total > 0);

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <IconChevronLeft color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, styles.headerTitleFlex]}>{t('setup_checklist.title', 'Setup Checklist')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {!loading ? (
        <View style={styles.analyticsCard}>
          <ProgressRing
            percent={overallPercent}
            color={theme.accent}
            trackColor={theme.surfaceVariant}
            labelColor={theme.textSecondary}
            label={t('setup_checklist.ready', 'ready')}
          />
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.analyticsTitle}>
              {t('setup_checklist.progress', '{done} of {total} set up').replace('{done}', String(doneCount)).replace('{total}', String(items.length))}
            </Text>
            {categoryBreakdown.map((c) => {
              const pct = c.total > 0 ? (c.done / c.total) * 100 : 0;
              return (
                <View key={c.key} style={styles.categoryRow}>
                  <Text style={styles.categoryLabel} numberOfLines={1}>{c.label}</Text>
                  <View style={styles.categoryBarTrack}>
                    <View style={[styles.categoryBarFill, { width: `${pct}%`, backgroundColor: pct === 100 ? theme.success : theme.accent }]} />
                  </View>
                  <Text style={styles.categoryCount}>{c.done}/{c.total}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <Text style={styles.helperText}>
        {t('setup_checklist.helper', "Everything a school needs before its portals are ready for day-to-day use. Tap any item to set it up or review it - come back here any time from the admin menu.")}
      </Text>

      <ScrollView>
        <BentoGrid>
          {items.map((item) => {
            const isDone = item.status === 'done';
            const isChecking = item.status === 'checking';
            const isError = item.status === 'error';
            const badgeTone = isDone ? 'success' : isError ? 'danger' : 'accent';
            const badgeText = isChecking
              ? t('setup_checklist.checking', 'Checking…')
              : isDone
              ? t('setup_checklist.done', 'Done')
              : isError
              ? t('setup_checklist.check_failed', 'Unavailable')
              : t('setup_checklist.todo', 'Set up');
            return (
              <BentoGridCard
                key={item.key}
                icon={iconFor(item.key, isDone ? theme.success : theme.accent)}
                title={item.title}
                subtitle={item.desc}
                meta={isDone && item.count != null ? t('setup_checklist.count_meta', '{count} configured').replace('{count}', String(item.count)) : undefined}
                badgeText={badgeText}
                badgeTone={badgeTone as any}
                onPress={() => (navigation as any).navigate(item.route)}
                theme={theme}
              />
            );
          })}
        </BentoGrid>
      </ScrollView>
      <BottomNavBar />
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

    analyticsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.surface,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      ...theme.elevation2,
    },
    analyticsTitle: { fontSize: 13.5, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 },
    categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
    categoryLabel: { fontSize: 10.5, color: theme.textSecondary, width: 92 },
    categoryBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.surfaceVariant, overflow: 'hidden', marginHorizontal: 8 },
    categoryBarFill: { height: 6, borderRadius: 3 },
    categoryCount: { fontSize: 10.5, fontWeight: '700', color: theme.textSecondary, width: 28, textAlign: 'right' },

    helperText: { fontSize: 12.5, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },
  });
