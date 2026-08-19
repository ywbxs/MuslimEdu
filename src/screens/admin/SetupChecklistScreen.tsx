import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, BookOpen, Building2, Calendar, Camera, Check, ChevronLeft, CircleDollarSign, Clock, Flag, IdCard, Layers, LogOut, Star } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { useAcademicGlassTheme, AcademicGlassTheme } from '../teachers/academicGlassTheme';
import GlassBackground from '../../components/glass/GlassBackground';
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
 * A step-by-step Setup Assistant, one readiness item at a time (icon,
 * title, description, a single "Set Up" action) instead of a bento grid of
 * 9 equal cards - the same pattern iOS itself uses for onboarding flows
 * (Screen Time, Find My, Health "Setup Assistant"). Every step is required:
 * there's no skip, because MainTabs.tsx now gates the ENTIRE app behind
 * this screen for an admin whose school isn't fully set up yet (see
 * useAdminSetupGate there) - this is the only thing they can do until
 * every item below is done.
 *
 * Two render modes:
 *  - Normal (isGate=false, the default): reached by tapping "Setup
 *    Checklist" from the admin menu - a regular pushed screen with its own
 *    header/back button and the shared BottomNavBar, usable any time
 *    (before OR after everything is complete) to review status.
 *  - Gate (isGate=true): rendered directly by MainTabs.tsx in place of the
 *    whole Tab.Navigator, so there is no "back" to give (nothing exists to
 *    go back to) and no BottomNavBar (its Home/Chat/Alerts/Menu buttons
 *    would be an escape hatch around the very lock this screen enforces).
 *    A small Log Out link takes BottomNavBar/MenuScreen's place as the one
 *    way out, so an admin genuinely stuck (e.g. a backend check is down)
 *    is never trapped.
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

interface SetupChecklistScreenProps {
  isGate?: boolean;
  onAllComplete?: () => void;
}

function IconChevronLeft({ color }: { color: string }) {
  return <ChevronLeft size={22} color={color} strokeWidth={2.4} />;
}
function IconBuilding({ color }: { color: string }) {
  return <Building2 size={28} color={color} strokeWidth={1.7} />;
}
function IconCalendar({ color }: { color: string }) {
  return <Calendar size={28} color={color} strokeWidth={1.8} />;
}
function IconGrade({ color }: { color: string }) {
  return <Star size={28} color={color} strokeWidth={1.7} />;
}
function IconLayers({ color }: { color: string }) {
  return <Layers size={28} color={color} strokeWidth={1.8} />;
}
function IconBook({ color }: { color: string }) {
  return <BookOpen size={28} color={color} strokeWidth={1.8} />;
}
function IconClock({ color }: { color: string }) {
  return <Clock size={28} color={color} strokeWidth={1.8} />;
}
function IconCamera({ color }: { color: string }) {
  return <Camera size={28} color={color} strokeWidth={1.8} />;
}
function IconFlag({ color }: { color: string }) {
  return <Flag size={28} color={color} strokeWidth={1.8} />;
}
function IconCoin({ color }: { color: string }) {
  return <CircleDollarSign size={28} color={color} strokeWidth={1.8} />;
}
function IconIdCard({ color }: { color: string }) {
  return <IdCard size={28} color={color} strokeWidth={1.7} />;
}
function IconCheck({ color, size = 13 }: { color: string; size?: number }) {
  return <Check size={size} color={color} strokeWidth={3} />;
}
function IconArrow({ color }: { color: string }) {
  return <ArrowRight size={17} color={color} strokeWidth={2.2} />;
}
function IconLogOut({ color }: { color: string }) {
  return <LogOut size={16} color={color} strokeWidth={2} />;
}

export default function SetupChecklistScreen({ isGate = false, onAllComplete }: SetupChecklistScreenProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useAcademicGlassTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { token, logout } = useAuth();
  const { t } = useLocale();

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  // 0 = overview, 1..items.length = one per item, items.length+1 = complete.
  const [step, setStep] = useState(0);

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

    setItems((prev) =>
      prev.length
        ? prev
        : checks.map((c) => ({ key: c.key, title: c.title, desc: c.desc, route: c.route, category: c.category, status: 'checking', count: null })),
    );

    const results = await Promise.all(
      checks.map(async (c) => {
        try {
          const count = await c.run();
          return { key: c.key, status: (count > 0 ? 'done' : 'todo') as ItemStatus, count };
        } catch {
          return { key: c.key, status: 'error' as ItemStatus, count: null };
        }
      }),
    );

    setItems(
      checks.map((c) => {
        const r = results.find((x) => x.key === c.key)!;
        return { key: c.key, title: c.title, desc: c.desc, route: c.route, category: c.category, status: r.status, count: r.count };
      }),
    );
    setLoading(false);
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Once the currently-viewed item flips to "done" (the admin set it up on
  // its real screen and came back), move the wizard on to the next
  // not-done item automatically - or to the completion screen if that was
  // the last one. Guarded to item-steps only, so the very first load (while
  // still on the overview screen) never yanks anyone forward uninvited.
  useEffect(() => {
    if (loading || items.length === 0) return;
    if (step < 1 || step > items.length) return;
    const current = items[step - 1];
    if (current?.status !== 'done') return;
    const nextIncomplete = items.findIndex((i) => i.status !== 'done');
    if (nextIncomplete === -1) {
      setStep(items.length + 1);
      onAllComplete?.();
    } else {
      setStep(nextIncomplete + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loading]);

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
  const allDone = items.length > 0 && doneCount === items.length;

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

  const confirmLogout = () => {
    Alert.alert(
      t('menu.log_out_confirm_title', 'Log out?'),
      t('menu.log_out_confirm_message', "You'll need to sign in again to continue."),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('menu.log_out', 'Log Out'), style: 'destructive', onPress: logout },
      ],
    );
  };

  const jumpToFirstIncomplete = () => {
    if (allDone) {
      setStep(items.length + 1);
      return;
    }
    const idx = items.findIndex((i) => i.status !== 'done');
    setStep((idx === -1 ? 0 : idx) + 1);
  };

  const jumpToStage = (cat: ChecklistCategory) => {
    let idx = items.findIndex((i) => i.category === cat && i.status !== 'done');
    if (idx === -1) idx = items.findIndex((i) => i.category === cat);
    if (idx !== -1) setStep(idx + 1);
  };

  const progressPct = step === 0 ? 0 : step > items.length ? 100 : ((step - 1) / Math.max(items.length, 1)) * 100;

  return (
    <View style={styles.container}>
      <GlassBackground variant="canvas" />

      <View style={[styles.chrome, { paddingTop: insets.top }]}>
        <View style={styles.chromeRow}>
          {!isGate && step === 0 ? (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={styles.roundBtn}>
              <IconChevronLeft color={theme.textPrimary} />
            </TouchableOpacity>
          ) : step > 0 && step <= items.length ? (
            <TouchableOpacity onPress={() => setStep(step - 1)} hitSlop={10} style={styles.roundBtn}>
              <IconChevronLeft color={theme.textPrimary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.roundBtnGhost} />
          )}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: theme.accent }]} />
          </View>
          {isGate ? (
            <TouchableOpacity onPress={confirmLogout} hitSlop={10} style={styles.logoutLink}>
              <IconLogOut color={theme.textSecondary} />
            </TouchableOpacity>
          ) : (
            <View style={styles.roundBtnGhost} />
          )}
        </View>
      </View>

      <View style={styles.body}>
        {step === 0 ? (
          <View style={styles.stepFill}>
            <View style={styles.stepScroll}>
              <View style={styles.ringRow}>
                <ProgressRing
                  percent={overallPercent}
                  color={theme.accent}
                  trackColor={theme.surfaceVariant}
                  labelColor={theme.textSecondary}
                  label={t('setup_checklist.ready', 'ready')}
                />
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={styles.overviewTitle}>
                    {t('setup_checklist.progress', '{done} of {total} set up').replace('{done}', String(doneCount)).replace('{total}', String(items.length))}
                  </Text>
                  <Text style={styles.overviewSub}>
                    {isGate
                      ? t('setup_checklist.gate_helper', 'The rest of the app unlocks once every step below is done.')
                      : t('setup_checklist.helper_short', 'Everything a school needs before its portals are ready for day-to-day use.')}
                  </Text>
                </View>
              </View>

              {categoryBreakdown.map((c) => {
                const pct = c.total > 0 ? (c.done / c.total) * 100 : 0;
                return (
                  <TouchableOpacity key={c.key} style={styles.stageCard} activeOpacity={0.85} onPress={() => jumpToStage(c.key)}>
                    <View style={styles.stageInfo}>
                      <Text style={styles.stageName}>{c.label}</Text>
                      <View style={styles.stageBarTrack}>
                        <View style={[styles.stageBarFill, { width: `${pct}%`, backgroundColor: pct === 100 ? theme.success : theme.accent }]} />
                      </View>
                    </View>
                    <Text style={styles.stageCount}>
                      {c.done}/{c.total}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.stepActions}>
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} activeOpacity={0.9} onPress={jumpToFirstIncomplete}>
                <Text style={styles.primaryBtnText}>{allDone ? t('setup_checklist.review', 'Review Setup') : t('setup_checklist.continue', 'Continue Setup')}</Text>
                <IconArrow color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : step <= items.length ? (
          (() => {
            const item = items[step - 1];
            if (!item) return null;
            const isDone = item.status === 'done';
            const isChecking = item.status === 'checking';
            return (
              <View style={styles.stepFill}>
                <View style={styles.stepScroll}>
                  <View style={[styles.stepIcon, { backgroundColor: isDone ? theme.success : theme.accent }]}>
                    {iconFor(item.key, '#FFFFFF')}
                  </View>
                  <Text style={styles.stepEyebrow}>
                    {CATEGORY_LABELS[item.category]} &middot; {t('setup_checklist.step_of', 'Step {n} of {total}').replace('{n}', String(step)).replace('{total}', String(items.length))}
                  </Text>
                  <Text style={styles.stepTitle}>{item.title}</Text>
                  <Text style={styles.stepDesc}>{item.desc}</Text>
                  {isDone ? (
                    <View style={[styles.stepBadge, { backgroundColor: theme.successSoft }]}>
                      <IconCheck color={theme.success} />
                      <Text style={[styles.stepBadgeText, { color: theme.success }]}>
                        {item.count != null
                          ? t('setup_checklist.count_meta', '{count} configured').replace('{count}', String(item.count))
                          : t('setup_checklist.done', 'Done')}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.stepActions}>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
                    activeOpacity={0.9}
                    disabled={isChecking}
                    onPress={() => (navigation as any).navigate(item.route)}
                  >
                    <Text style={styles.primaryBtnText}>
                      {isChecking
                        ? t('setup_checklist.checking', 'Checking…')
                        : isDone
                        ? t('setup_checklist.review_item', 'Review {title}').replace('{title}', item.title)
                        : t('setup_checklist.set_up_item', 'Set Up {title}').replace('{title}', item.title)}
                    </Text>
                    <IconArrow color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()
        ) : (
          <View style={styles.stepFill}>
            <View style={styles.stepScroll}>
              <View style={[styles.doneIcon, { backgroundColor: theme.accent }]}>
                <IconCheck color="#FFFFFF" size={30} />
              </View>
              <Text style={styles.doneTitle}>{t('setup_checklist.all_set', "You're all set")}</Text>
              <Text style={styles.doneSub}>
                {isGate
                  ? t('setup_checklist.all_set_gate_sub', 'Every step is complete. The rest of the admin menu is now unlocked.')
                  : t('setup_checklist.all_set_sub', 'Every step is complete - your portals are ready for day-to-day use.')}
              </Text>
            </View>
            {!isGate ? (
              <View style={styles.stepActions}>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} activeOpacity={0.9} onPress={() => navigation.goBack()}>
                  <Text style={styles.primaryBtnText}>{t('setup_checklist.done', 'Done')}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </View>

      {!isGate ? <BottomNavBar /> : null}
    </View>
  );
}

const makeStyles = (theme: AcademicGlassTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },

    chrome: { paddingHorizontal: 16, paddingBottom: 8 },
    chromeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    roundBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceVariant,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roundBtnGhost: { width: 32, height: 32 },
    logoutLink: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: theme.surfaceVariant, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },

    body: { flex: 1, paddingHorizontal: 20 },
    stepFill: { flex: 1, justifyContent: 'space-between' },
    stepScroll: { paddingTop: 8 },
    stepActions: { paddingBottom: 20, paddingTop: 12 },

    // --- overview ---
    ringRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
    overviewTitle: { fontSize: 20, fontWeight: '800', color: theme.textPrimary, marginBottom: 6 },
    overviewSub: { fontSize: 13, color: theme.textSecondary, lineHeight: 18 },

    stageCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
      ...theme.elevation1,
    },
    stageInfo: { flex: 1 },
    stageName: { fontSize: 14.5, fontWeight: '700', color: theme.textPrimary, marginBottom: 7 },
    stageBarTrack: { height: 5, borderRadius: 3, backgroundColor: theme.surfaceVariant, overflow: 'hidden' },
    stageBarFill: { height: '100%', borderRadius: 3 },
    stageCount: { fontSize: 13, fontWeight: '700', color: theme.textSecondary, fontVariant: ['tabular-nums'] },

    // --- item step ---
    stepIcon: {
      width: 64,
      height: 64,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    stepEyebrow: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: theme.textSecondary, marginBottom: 8 },
    stepTitle: { fontSize: 26, fontWeight: '800', color: theme.textPrimary, marginBottom: 10 },
    stepDesc: { fontSize: 15, lineHeight: 22, color: theme.textSecondary, marginBottom: 16, maxWidth: 320 },
    stepBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 5, borderRadius: 999 },
    stepBadgeText: { fontSize: 12.5, fontWeight: '700' },

    // --- completion ---
    doneIcon: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 20, alignSelf: 'center' },
    doneTitle: { fontSize: 24, fontWeight: '800', color: theme.textPrimary, textAlign: 'center', marginBottom: 8 },
    doneSub: { fontSize: 14.5, color: theme.textSecondary, textAlign: 'center', lineHeight: 21, maxWidth: 280, alignSelf: 'center' },

    // --- shared ---
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 15,
      paddingVertical: 15,
    },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
