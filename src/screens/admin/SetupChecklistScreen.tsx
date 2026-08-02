import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Path, Circle } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import { RADIUS } from '../../theme/glass';
import GlassBackground from '../../components/glass/GlassBackground';
import BentoGridCard, { BentoGrid } from '../../components/glass/BentoGridCard';
import BottomNavBar from '../../components/BottomNavBar';
import { fetchAcademicSessions } from '../../services/academicSessionService';
import { fetchGradingSystems, fetchSubjectsCatalog } from '../../services/adminAcademicCatalogService';
import { fetchClasses } from '../../services/adminService';
import { listSchedules } from '../../services/academicScheduleService';
import { fetchAttendanceMethods } from '../../services/attendanceConfigService';
import { fetchEnrollmentStages, fetchFeeTypes } from '../../services/enrollmentWorkflowService';

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

interface ChecklistItem {
  key: string;
  title: string;
  desc: string;
  route: string;
  status: ItemStatus;
  count: number | null;
}

function IconChevronLeft({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Polyline points="15 5 8 12 15 19" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconBuilding({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M4 21h16M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M15 21v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCalendar({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5h16v16H4z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M4 9h16M8 3v4M16 3v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function IconGrade({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l2.6 5.3 5.9.8-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.8L12 3Z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function IconLayers({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3l9 5-9 5-9-5 9-5Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M3 13l9 5 9-5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconBook({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
function IconClock({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v5l3.5 2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCamera({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 8h3l1.5-2h7L17 8h3v11H4V8Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.2} stroke={color} strokeWidth={2} />
    </Svg>
  );
}
function IconFlag({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M5 21V4M5 4h12l-3 4 3 4H5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function IconCoin({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
      <Path d="M12 7v10M9.5 9.5c0-1.4 1.1-2.2 2.5-2.2s2.5.8 2.5 2c0 1.5-1.5 2-2.5 2.4-1.2.4-2.5 1-2.5 2.6 0 1.2 1.1 2.2 2.5 2.2s2.5-.8 2.5-2" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
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

    const checks: Array<{ key: string; title: string; desc: string; route: string; run: () => Promise<number> }> = [
      {
        key: 'academic_year',
        title: t('setup_checklist.academic_year_title', 'Academic Year'),
        desc: t('setup_checklist.academic_year_desc', 'At least one school year with a current year set.'),
        route: 'AcademicYears',
        run: async () => (await fetchAcademicSessions(token)).length,
      },
      {
        key: 'grading',
        title: t('setup_checklist.grading_title', 'Grading System'),
        desc: t('setup_checklist.grading_desc', 'How grades are scored and reported.'),
        route: 'GradingSystems',
        run: async () => (await fetchGradingSystems(token)).length,
      },
      {
        key: 'classes',
        title: t('setup_checklist.classes_title', 'Classes & Sections'),
        desc: t('setup_checklist.classes_desc', 'Create classes, then sections (with room + adviser) inside them.'),
        route: 'ClassList',
        run: async () => (await fetchClasses(token)).length,
      },
      {
        key: 'subjects',
        title: t('setup_checklist.subjects_title', 'Subjects'),
        desc: t('setup_checklist.subjects_desc', 'The subject catalog sections and schedules pull from.'),
        route: 'ProgramsCatalog',
        run: async () => (await fetchSubjectsCatalog(token)).length,
      },
      {
        key: 'schedule',
        title: t('setup_checklist.schedule_title', 'Class Schedule'),
        desc: t('setup_checklist.schedule_desc', 'Assign subject, teacher, room and time to each section.'),
        route: 'AdminSchedule',
        run: async () => (await listSchedules(token)).length,
      },
      {
        key: 'attendance',
        title: t('setup_checklist.attendance_title', 'Attendance Config'),
        desc: t('setup_checklist.attendance_desc', 'Which capture methods (manual, QR, face) are active.'),
        route: 'AttendanceConfig',
        run: async () => (await fetchAttendanceMethods(token)).length,
      },
      {
        key: 'enrollment_stages',
        title: t('setup_checklist.enrollment_stages_title', 'Enrollment Stages'),
        desc: t('setup_checklist.enrollment_stages_desc', 'The admission pipeline students move through.'),
        route: 'EnrollmentStages',
        run: async () => (await fetchEnrollmentStages(token)).length,
      },
      {
        key: 'fee_types',
        title: t('setup_checklist.fee_types_title', 'Fee Types'),
        desc: t('setup_checklist.fee_types_desc', 'Tuition, miscellaneous, service fees - what enrollment collects.'),
        route: 'EnrollmentFeeTypes',
        run: async () => (await fetchFeeTypes(token)).length,
      },
    ];

    setItems(checks.map((c) => ({ key: c.key, title: c.title, desc: c.desc, route: c.route, status: 'checking', count: null })));

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
        <View style={styles.progressBanner}>
          <Text style={styles.progressText}>
            {t('setup_checklist.progress', '{done} of {total} set up').replace('{done}', String(doneCount)).replace('{total}', String(items.length))}
          </Text>
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

    progressBanner: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: theme.accentSoft,
      borderRadius: RADIUS.md,
      paddingVertical: 10,
      alignItems: 'center',
    },
    progressText: { fontSize: 13, fontWeight: '700', color: theme.accent },

    helperText: { fontSize: 12.5, color: theme.textSecondary, paddingHorizontal: 16, paddingTop: 12, lineHeight: 18 },
  });
