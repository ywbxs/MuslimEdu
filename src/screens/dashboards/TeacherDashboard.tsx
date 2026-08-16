import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path, Line, Polyline, Polygon } from 'react-native-svg';
import { ArrowRight, Bell, Calendar, Camera, ChevronDown, ChevronRight, CircleCheck, ClipboardCheck, Clock, FileText, IdCard, Mail, Megaphone, NotebookText, Settings, Star, User } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import { fetchTeacherReportStatus, TeacherReportStatus } from '../../services/teacherOrphanService';
import { isQuranTrackingSchoolUser } from '../../utils/orphanSchool';
import { Skeleton, SkeletonCircle } from '../../components/Skeleton';
import UserAvatar from '../../components/UserAvatar';
import HeroGlow from '../../components/HeroGlow';
import UpcomingClassesCard from '../../components/UpcomingClassesCard';
import { isOrphanSchoolUser } from '../../utils/orphanSchool';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SHADOW } from '../../theme/spatial';
// --- Depth layer sizing -----------------------------------------------
// The gradient hero covers the greeting + Profile card. It's a separate
// Animated layer sitting behind the ScrollView content, so it can move
// and fade independently of the cards scrolling on top of it.
const HERO_HEIGHT = 430;
const PARALLAX_FACTOR = 0.5; // background travels at half the content's scroll speed

const DARK_TOP = '#1C1C1E';
const DARK_BOTTOM = '#000000';
const PALE_GREEN = '#8FD9AE';
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';
const GLASS_DIVIDER = 'rgba(255,255,255,0.12)';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Inline icons (react-native-svg) ---
function PersonIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <User size={size} color={color} strokeWidth={2} />;
}
function MailIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <Mail size={size} color={color} strokeWidth={2} />;
}
function IdCardIcon({ color = PALE_GREEN, size = 18 }: { color?: string; size?: number }) {
  return <IdCard size={size} color={color} strokeWidth={2} />;
}
function CameraIcon({ color = PALE_GREEN, size = 16 }: { color?: string; size?: number }) {
  return <Camera size={size} color={color} strokeWidth={2} />;
}
function DocCheckIcon({ color = '#FFFFFF', size = 24 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}
function ClipboardCheckIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <ClipboardCheck size={size} color={color} strokeWidth={2} />;
}
function GradeIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <NotebookText size={size} color={color} strokeWidth={2} />;
}
function AnnouncementIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Megaphone size={size} color={color} strokeWidth={2} />;
}
function LessonPlanIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <NotebookText size={size} color={color} strokeWidth={1.8} />;
}
function AssessmentIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <ClipboardCheck size={size} color={color} strokeWidth={1.8} />;
}
function ArrowRightIcon({ color = EMERALD, size = 18 }: { color?: string; size?: number }) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
}
function ChevronRightIcon({ color = EMERALD, size = 15 }: { color?: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2.2} />;
}
function ChevronDownIcon({ color = SUBTLE, size = 14 }: { color?: string; size?: number }) {
  return <ChevronDown size={size} color={color} strokeWidth={2.2} />;
}
function CalendarIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Calendar size={size} color={color} strokeWidth={2} />;
}
function BellIcon({ color = EMERALD, size = 22 }: { color?: string; size?: number }) {
  return <Bell size={size} color={color} strokeWidth={2} />;
}
function DocumentIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <FileText size={size} color={color} strokeWidth={2} />;
}
function StarIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Star size={size} color={color} strokeWidth={2} />;
}
function CheckCircleIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <CircleCheck size={size} color={color} strokeWidth={2} />;
}
function ClockIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Clock size={size} color={color} strokeWidth={2} />;
}
function GearIcon({ color = EMERALD, size = 20 }: { color?: string; size?: number }) {
  return <Settings size={size} color={color} strokeWidth={2} />;
}

function GlassRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.glassRow}>
      <View style={styles.glassRowLeft}>
        {icon}
        <Text style={styles.glassRowLabel}>{label}</Text>
      </View>
      <Text style={styles.glassRowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  badge,
  solid,
  onPress,
}: {
  icon: React.ReactElement;
  title: string;
  description: string;
  badge?: number;
  solid?: boolean;
  onPress: () => void;
}) {
  const fg = solid ? '#FFFFFF' : EMERALD;
  return (
    <TouchableOpacity
      style={[styles.quickCard, solid ? styles.quickCardSolid : styles.quickCardSoft]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={[styles.quickIconWrap, solid ? styles.quickIconWrapSolid : styles.quickIconWrapSoft]}>
        {icon}
        {!!badge && badge > 0 ? (
          <View style={styles.quickBadge}>
            <Text style={styles.quickBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.quickTitle, solid ? styles.quickTitleSolid : null]}>{title}</Text>
      <Text style={[styles.quickDescription, solid ? styles.quickDescriptionSolid : null]}>{description}</Text>
      <View style={styles.quickArrowRow}>
        <View style={[styles.quickArrowButton, solid ? styles.quickArrowButtonSolid : styles.quickArrowButtonSoft]}>
          <ArrowRightIcon color={fg} size={16} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatItem({
  icon,
  value,
  unit,
  label,
}: {
  icon: React.ReactElement;
  value: string;
  unit?: string;
  label: string;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIconWrap}>{icon}</View>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

interface TeacherDashboardProps {
  footer?: React.ReactNode;
}

export default function TeacherDashboard({ footer }: TeacherDashboardProps = {}) {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const isQuranTrackingSchool = isQuranTrackingSchoolUser(user);
  const { t } = useLocale();
  const navigation = useNavigation();
  const scrollY = useRef(new Animated.Value(0)).current;
  // The dark hero background is a separate absolutely-positioned layer
  // behind the ScrollView, sized to cover the greeting + profile card.
  // Those two are variable height (profile card rows are conditional on
  // which fields the user has, e.g. Staff Code), so a fixed HERO_HEIGHT
  // falls short whenever the card is taller than the default case,
  // leaving later content rendered half over the dark background's
  // rounded bottom edge. Measure the real height instead of guessing it.
  const [heroHeight, setHeroHeight] = useState(HERO_HEIGHT);

  // Either orphan-school signal is enough - requiring both meant a teacher
  // whose token carried only one of them got the full academic card set.
  const isOrphan = isOrphanSchoolUser(user);

  const [status, setStatus] = useState<TeacherReportStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(isOrphan);

  useEffect(() => {
    // Regular (non-orphan) students have no monthly report feature, so we
    // never hit the report endpoint for them.
    if (!isOrphan || !token) {
      setIsLoadingStatus(false);
      return;
    }
    let cancelled = false;
    setIsLoadingStatus(true);
    fetchTeacherReportStatus(token)
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        // Silent - the overview stats just fall back to placeholders below.
      })
      .finally(() => {
        if (!cancelled) setIsLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOrphan, token]);

  const handlePlaceholderPress = useCallback((title: string) => {
    Alert.alert(
      t('teacher_dashboard.coming_soon_title', 'Coming soon'),
      t('teacher_dashboard.coming_soon_message', "{title} isn't wired up yet - tell me which to build out next.").replace(
        '{title}',
        title,
      ),
    );
  }, [t]);

  // Quick Actions grid - built as an array (like AdminDashboard's Manage
  // grid) so the first entry can always render as the highlighted "solid"
  // card, matching the Manage screen's card design.
  interface QuickAction {
    key: string;
    title: string;
    description: string;
    icon: (color: string) => React.ReactElement;
    badge?: number;
    onPress: () => void;
  }
  const quickActions: QuickAction[] = [
    // My Reports - orphan teachers only.
    ...(isOrphan
      ? [
          {
            key: 'myReports',
            title: t('teacher_dashboard.my_reports_title', 'My Reports'),
            description: t('teacher_dashboard.my_reports_desc', 'View your report submissions'),
            icon: (c: string) => <DocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('Reports'),
          },
        ]
      : []),
    // Academic-subsystem cards - hidden entirely for orphan schools (no
    // classes/subjects/grading/curriculum there).
    ...(!isOrphan
      ? [
          {
            key: 'mySchedule',
            title: t('teacher_dashboard.my_schedule_title', 'My Schedule'),
            description: t('teacher_dashboard.my_schedule_desc', 'See your weekly class timetable'),
            icon: (c: string) => <CalendarIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherMySchedule'),
          },
          {
            key: 'takeAttendance',
            title: t('teacher_dashboard.take_attendance_title', 'Take Attendance'),
            description: t('teacher_dashboard.take_attendance_desc', "Mark today's attendance for your classes"),
            icon: (c: string) => <ClipboardCheckIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherAttendanceClasses'),
          },
          {
            key: 'enterGrades',
            title: t('teacher_dashboard.enter_grades_title', 'Enter Grades'),
            description: t('teacher_dashboard.enter_grades_desc', 'Record marks for your assigned subjects'),
            icon: (c: string) => <GradeIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherGradebookClasses'),
          },
          {
            key: 'announcements',
            title: t('teacher_dashboard.announcements_title', 'Announcements'),
            description: t('teacher_dashboard.announcements_desc', 'Post updates to your classes'),
            icon: (c: string) => <AnnouncementIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherAnnouncements'),
          },
          {
            key: 'behavior',
            title: t('teacher_dashboard.behavior_title', 'Behavior & Discipline'),
            description: t('teacher_dashboard.behavior_desc', 'Log and track student behavior incidents'),
            icon: (c: string) => <ClipboardCheckIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('BehaviorIncidents'),
          },
          {
            key: 'examinations',
            title: t('teacher_dashboard.examinations_title', 'Examinations'),
            description: t('teacher_dashboard.examinations_desc', 'Schedule exams and enter grades'),
            icon: (c: string) => <AssessmentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('Examinations'),
          },
          {
            key: 'studentProgress',
            title: t('teacher_dashboard.student_progress_title', 'Student Progress'),
            description: isQuranTrackingSchool
              ? t(
                  'teacher_dashboard.student_progress_desc_quran',
                  'Attendance, grades, behavior, memorization in one view',
                )
              : t('teacher_dashboard.student_progress_desc', 'Attendance, grades, and behavior in one view'),
            icon: (c: string) => <AssessmentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('StudentProgress'),
          },
          {
            key: 'lessonPlans',
            title: t('teacher_dashboard.lesson_plans_title', 'Lesson Plans'),
            description: t('teacher_dashboard.lesson_plans_desc', 'Draft, submit, and revise your lesson plans'),
            icon: (c: string) => <LessonPlanIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherLessonPlans'),
          },
          {
            key: 'assessments',
            title: t('teacher_dashboard.assessments_title', 'Assessments'),
            description: t(
              'teacher_dashboard.assessments_desc',
              'Create assignments, quizzes, and grade submissions',
            ),
            icon: (c: string) => <AssessmentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherAssessments'),
          },
          {
            key: 'assessmentGrades',
            title: t('teacher_dashboard.assessment_grades_title', 'Assessment Grades'),
            description: t('teacher_dashboard.assessment_grades_desc', 'Weighted grade breakdown for your sections'),
            icon: (c: string) => <StarIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherAssessmentGrades'),
          },
          {
            key: 'materials',
            title: t('teacher_dashboard.materials_title', 'Materials'),
            description: t(
              'teacher_dashboard.materials_desc',
              'Share lecture notes, slides, and other resources',
            ),
            icon: (c: string) => <DocumentIcon color={c} size={20} />,
            onPress: () => (navigation as any).navigate('TeacherMaterials'),
          },
        ]
      : []),
    {
      key: 'notifications',
      title: t('teacher_dashboard.notifications_title', 'Notifications'),
      description: t('teacher_dashboard.notifications_desc', 'Stay updated with important alerts'),
      icon: (c: string) => <BellIcon color={c} size={20} />,
      badge: 0,
      onPress: () => (navigation as any).navigate('Notifications'),
    },
    {
      key: 'security',
      title: t('teacher_dashboard.security_title', 'Security'),
      description: t('teacher_dashboard.security_desc', 'Two-factor authentication and device sessions'),
      icon: (c: string) => <IdCardIcon color={c} size={20} />,
      onPress: () => (navigation as any).navigate('SecuritySettings'),
    },
    {
      key: 'settings',
      title: t('teacher_dashboard.settings_title', 'Settings'),
      description: t('teacher_dashboard.settings_desc', 'Language, theme, privacy and password'),
      icon: (c: string) => <GearIcon color={c} size={20} />,
      onPress: () => (navigation as any).navigate('AccountSettings'),
    },
  ];

  // --- Overview stats: wired to real submission history (orphan-only). ---
  const history = status?.history ?? [];
  const reportsSubmitted = String(history.length);
  const ratings = history.flatMap((r) =>
    [r.teaching_effectiveness_rating, r.classroom_engagement_rating, r.professional_growth_rating].filter(
      (n): n is number => n != null,
    ),
  );
  const averageScore =
    ratings.length > 0
      ? `${Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length / 5) * 100)}`
      : '-';

  const now = new Date();
  const monthLabel = `${MONTH_NAMES[now.getMonth()].slice(0, 3)} ${now.getFullYear()}`;

  // --- Parallax + fade for the background layer only. ---
  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, -heroHeight * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.55, heroHeight],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.flex}>
      <Animated.View
        style={[
          styles.bgLayer,
          { height: heroHeight, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
        ]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={DARK_TOP} />
              <Stop offset="1" stopColor={DARK_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
        </Svg>
        <HeroGlow />
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View
          onLayout={(e) => {
            // The measured height already includes glassCard's own
            // marginBottom (RN's column layout counts trailing margin
            // toward the parent's auto height), so the dark layer's
            // bottom edge lands exactly where the card's margin ends.
            const measured = e.nativeEvent.layout.height;
            if (Math.abs(measured - heroHeight) > 1) setHeroHeight(measured);
          }}
        >
          {/* Greeting */}
          <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
            <View>
              <Text style={styles.greetingSmall}>{t('teacher_dashboard.greeting', 'Assalamu Alaykum,')}</Text>
              <Text style={styles.greetingName}>{user?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
              <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={62} dotColor={null} />
            </TouchableOpacity>
          </View>

          {/* Profile - glass card over the dark hero */}
          <View style={styles.glassCard}>
            <View style={styles.glassHeaderRow}>
              <View style={styles.glassHeaderLeft}>
                <View style={styles.glassIconCircle}>
                  <PersonIcon color={PALE_GREEN} size={22} />
                </View>
                <View>
                  <Text style={styles.glassTitle}>{t('teacher_dashboard.profile_title', 'Profile')}</Text>
                  <Text style={styles.glassSubtitle}>
                    {t('teacher_dashboard.profile_subtitle', 'Your personal information')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => (navigation as any).navigate('EditProfile')}
                hitSlop={8}
              >
                <CameraIcon color={PALE_GREEN} size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.glassDivider} />
            <GlassRow icon={<PersonIcon />} label={t('teacher_dashboard.name_label', 'Name')} value={user?.name} />
            <View style={styles.glassDivider} />
            <GlassRow icon={<MailIcon />} label={t('teacher_dashboard.email_label', 'Email')} value={user?.email} />
            {user?.code ? (
              <>
                <View style={styles.glassDivider} />
                <GlassRow
                  icon={<IdCardIcon />}
                  label={t('teacher_dashboard.staff_code_label', 'Staff Code')}
                  value={user.code}
                />
              </>
            ) : null}
          </View>
        </View>

        {/* Monthly Report hero card - orphan teachers only. Note: TeacherDashboard
            only ever renders for role === 'teacher', so isOrphan here always means
            teacher-orphan, never the child-orphan/student case. We route through the
            "Reports" tab (see MainTabs.tsx ReportsRouter) so this lands on
            TeacherOrphanReportScreen + teacherOrphanService, same as the nav tab -
            not the root-stack "OrphanReport" route, which is hardcoded to the
            child-orphan OrphanReportScreen/orphanService with no role check. */}
        {isOrphan ? (
          <TouchableOpacity
            style={styles.reportCard}
            activeOpacity={0.9}
            onPress={() => (navigation as any).navigate('Reports')}
          >
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="reportGrad" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#12A860" />
                  <Stop offset="1" stopColor="#0B7C46" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#reportGrad)" />
            </Svg>
            <View style={styles.reportIconCircle}>
              <DocCheckIcon color="#FFFFFF" size={24} />
            </View>
            <View style={styles.reportTextWrap}>
              <Text style={styles.reportTitle}>{t('teacher_dashboard.monthly_report_title', 'Monthly Report')}</Text>
              <Text style={styles.reportSubtitle}>
                {status?.submitted_this_month
                  ? t(
                      'teacher_dashboard.monthly_report_submitted',
                      'Submitted for this month - view your history any time',
                    )
                  : t(
                      'teacher_dashboard.monthly_report_pending',
                      'Submit how your month went, and see your submission history',
                    )}
              </Text>
            </View>
            <View style={styles.reportArrowButton}>
              <ArrowRightIcon color={EMERALD} size={18} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Today's class schedule preview - a quick reminder of what the
            teacher is teaching today, without leaving Home. Regular schools
            only - orphan schools have no class/schedule concept (same
            gating as the academic Quick Action tiles below). fetchMySchedule
            already resolves "mine" server-side by role, so this same
            component works unchanged for a teacher. Shown above Quick
            Actions so "what's happening today" is the first thing seen. */}
        {!isOrphan && token ? <UpcomingClassesCard token={token} /> : null}

        {/* Quick Actions */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t('teacher_dashboard.quick_actions', 'Quick Actions')}</Text>
          <TouchableOpacity
            style={styles.viewAllRow}
            onPress={() => handlePlaceholderPress(t('teacher_dashboard.viewing_all_actions', 'Viewing all quick actions'))}
          >
            <Text style={styles.viewAllText}>{t('common.view_all', 'View All')}</Text>
            <ChevronRightIcon color={EMERALD} size={15} />
          </TouchableOpacity>
        </View>

        <View style={styles.quickRow}>
          {quickActions.map((action, index) => (
            <QuickActionCard
              key={action.key}
              icon={action.icon(index === 0 ? '#FFFFFF' : EMERALD)}
              title={action.title}
              description={action.description}
              badge={action.badge}
              solid={index === 0}
              onPress={action.onPress}
            />
          ))}
        </View>

        {/* This Month Overview - orphan students only (it's report-backed) */}
        {isOrphan ? (
          <View style={styles.overviewCard}>
            <View style={styles.overviewHeaderRow}>
              <Text style={styles.overviewTitle}>{t('teacher_dashboard.month_overview_title', 'This Month Overview')}</Text>
              <TouchableOpacity
                style={styles.monthPill}
                onPress={() => handlePlaceholderPress(t('teacher_dashboard.choosing_month', 'Choosing a different month'))}
              >
                <Text style={styles.monthPillText}>{monthLabel}</Text>
                <ChevronDownIcon color={SUBTLE} size={14} />
              </TouchableOpacity>
            </View>

            {isLoadingStatus ? (
              <View style={styles.statsRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.statItem}>
                    <SkeletonCircle size={40} style={styles.mb10} />
                    <Skeleton width={30} height={20} style={styles.mb6} />
                    <Skeleton width={50} height={11} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.statsRow}>
                <StatItem
                  icon={<DocumentIcon color={EMERALD} size={20} />}
                  value={reportsSubmitted}
                  label={t('teacher_dashboard.reports_submitted_label', 'Reports Submitted')}
                />
                <StatItem
                  icon={<StarIcon color={EMERALD} size={20} />}
                  value={averageScore}
                  unit={averageScore !== '-' ? '%' : undefined}
                  label={t('teacher_dashboard.average_score_label', 'Average Score')}
                />
                <StatItem
                  icon={<CheckCircleIcon color={EMERALD} size={20} />}
                  value="-"
                  label={t('teacher_dashboard.activities_completed_label', 'Activities Completed')}
                />
                <StatItem
                  icon={<ClockIcon color={EMERALD} size={20} />}
                  value="-"
                  label={t('teacher_dashboard.time_spent_label', 'Time Spent')}
                />
              </View>
            )}

            <View style={styles.noteBox}>
              <Text style={styles.noteText}>
                {t(
                  'teacher_dashboard.stats_note',
                  'Reports Submitted and Average Score are wired to your real submission history. Activities Completed and Time Spent will connect once those features are built.',
                )}
              </Text>
            </View>
          </View>
        ) : null}
        {footer}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas, overflow: 'hidden' },
  bgLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    zIndex: 0,
    elevation: 0,
  },
  scrollFlex: { flex: 1, zIndex: 1, elevation: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 130 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 24,
  },
  greetingSmall: { fontSize: 14, color: PALE_GREEN },
  greetingName: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
  glassCard: {
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  glassHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  glassHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  glassIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  glassTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  glassSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassDivider: { height: 1, backgroundColor: GLASS_DIVIDER, marginVertical: 4 },
  glassRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  glassRowLeft: { flexDirection: 'row', alignItems: 'center' },
  glassRowLabel: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginLeft: 10 },
  glassRowValue: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', flexShrink: 1, textAlign: 'right', marginLeft: 12 },

  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    padding: 20,
    marginBottom: 28,
    overflow: 'hidden',
    zIndex: 1,
  },
  reportIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reportTextWrap: { flex: 1 },
  reportTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  reportSubtitle: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 5, lineHeight: 17 },
  reportArrowButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  ...SHADOW.level1,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: INK },
  viewAllRow: { flexDirection: 'row', alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '700', color: EMERALD, marginRight: 2 },

  // Matches the "Manage" grid card design (AdminDashboard): big rounded
  // icon badge, bold title + description, circular arrow button bottom
  // right, and a solid-emerald variant for the single highlighted card.
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
  quickCard: {
    width: '48%',
    borderRadius: 22,
    padding: 16,
    minHeight: 176,
    marginBottom: 14,
  },
  quickCardSolid: { backgroundColor: EMERALD },
  quickCardSoft: { backgroundColor: EMERALD_SOFT },
  quickIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  quickIconWrapSolid: { backgroundColor: 'rgba(255,255,255,0.16)' },
  quickIconWrapSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: EMERALD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  quickTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 5 },
  quickTitleSolid: { color: '#FFFFFF' },
  quickDescription: { fontSize: 12.5, color: SUBTLE, lineHeight: 17 },
  quickDescriptionSolid: { color: 'rgba(255,255,255,0.8)' },
  quickArrowRow: { marginTop: 'auto', alignItems: 'flex-end' },
  quickArrowButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickArrowButtonSolid: { backgroundColor: 'rgba(255,255,255,0.2)' },
  quickArrowButtonSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },

  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  overviewHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  overviewTitle: { fontSize: 16, fontWeight: '700', color: INK },
  monthPill: { flexDirection: 'row', alignItems: 'center' },
  monthPillText: { fontSize: 13, color: SUBTLE, fontWeight: '600', marginRight: 4 },
  mb6: { marginBottom: 6 },
  mb10: { marginBottom: 10 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { flex: 1, alignItems: 'center' },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'flex-end' },
  statValue: { fontSize: 22, fontWeight: '800', color: INK },
  statUnit: { fontSize: 12, fontWeight: '700', color: INK, marginLeft: 1, marginBottom: 2 },
  statLabel: { fontSize: 11, color: SUBTLE, textAlign: 'center', marginTop: 4, lineHeight: 14 },

  noteBox: {
    marginTop: 20,
    backgroundColor: EMERALD_SOFT,
    borderRadius: 14,
    padding: 16,
  },
  noteText: { fontSize: 13, color: INK, lineHeight: 19 },
});
