import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import UserAvatar from '../../components/UserAvatar';
import MonthlyReportsCard from '../../components/MonthlyReportsCard';
import SchoolCodeSetupScreen from '../admin/SchoolCodeSetupScreen';
import AcademicSetupWizardScreen from '../admin/AcademicSetupWizardScreen';
import { fetchAdminSubscriptionStatus, AdminSubscriptionStatus } from '../../services/subscriptionService';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../../theme/spatial';
// Dark hero palette (kept local so it doesn't leak into other screens).
const HERO_TOP = '#1C1C1E';
const HERO_BOTTOM = '#000000';
const PALE_GREEN = '#7FD9A8';
// Same faux-glass values StudentDashboard's Profile card uses - no blur lib,
// just a translucent white layer + light border on top of the dark hero.
const GLASS_BG = 'rgba(255,255,255,0.07)';
const GLASS_BORDER = 'rgba(255,255,255,0.14)';

// --- Depth layer sizing (mirrors StudentDashboard) --------------------
// The gradient hero is a separate Animated layer BEHIND the scroll content.
// It travels at half speed (parallax) and fades to nothing as you scroll,
// so the white body + cards visibly slide up and over it. Apple-style depth.
const HERO_HEIGHT = 300;
const PARALLAX_FACTOR = 0.5; // background moves at half the content's scroll speed

// --- Inline icons (react-native-svg, matches the app's existing approach) ---
function PeopleIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M16 6.2a3 3 0 0 1 0 5.6M18 19c0-2.2-1-4-2.6-4.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function PresentationIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="12" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 20l4-4 4 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="12" cy="10" r="2" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
function BookIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5A1.5 1.5 0 0 1 20 20.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
    </Svg>
  );
}
function DocumentIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v4h4M9 12h6M9 16h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function CalendarIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="5" width="17" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M8.5 14l2 2 4-4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function ReportDocIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Path d="M6 3h8l4 4v14H6z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M14 3v4h4M9 12h6M9 16h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function StagesIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="5" cy="6" r="2.2" stroke={color} strokeWidth={1.8} />
      <Circle cx="12" cy="12" r="2.2" stroke={color} strokeWidth={1.8} />
      <Circle cx="19" cy="18" r="2.2" stroke={color} strokeWidth={1.8} />
      <Path d="M7 7l3.5 3.5M14 14l3.5 3.5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3.2" stroke={color} strokeWidth={1.8} />
      <Path
        d="M12 3.5v2.4M12 18.1v2.4M20.5 12h-2.4M5.9 12H3.5M17.7 6.3l-1.7 1.7M8 16l-1.7 1.7M17.7 17.7L16 16M8 8L6.3 6.3"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}
function GraduationCapIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M2 8.5L12 4l10 4.5-10 4.5-10-4.5z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M6 10.7v4.3c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-4.3" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 9v6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function GradebookIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M6 4h9a3 3 0 0 1 3 3v13H9a3 3 0 0 0-3 3V4z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 9h5M9 13h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function ExamCategoriesIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 6h16M4 12h10M4 18h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M17 15v6M14 18h6" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function AnnouncementReviewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M3 11v2a2 2 0 0 0 2 2h1l2 4h2l-1-4h6l5 3V6l-5 3H8L6 5H4a2 2 0 0 0-2 2v2" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function LessonPlanReviewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Path d="M9 8h7M9 12h7" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function AssessmentReviewIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Path d="M9 11l3 3L22 4" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function CatalogIcon({ color }: { color: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      <Rect x="3.5" y="4" width="17" height="16" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M8 8.5h8M8 12h8M8 15.5h5" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
function IdCardIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
      <Rect x={2.5} y={4.5} width={19} height={15} rx={2.5} stroke={color} strokeWidth={1.7} />
      <Circle cx={8.5} cy={11} r={2.1} stroke={color} strokeWidth={1.7} />
      <Path
        d="M5.2 16.4c.6-1.5 1.9-2.3 3.3-2.3s2.7.8 3.3 2.3"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M14.6 9.6h4.6M14.6 12.4h4.6M14.6 15.2h2.9"
        stroke={color}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    </Svg>
  );
}
function LockIcon({ color = '#FFFFFF', size = 11 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5" y="11" width="14" height="9" rx="2" stroke={color} strokeWidth={2} />
      <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
function ArrowRight({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12h13M13 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

type Variant = 'solid' | 'soft';
interface ManageItem {
  key: string;
  title: string;
  desc: string;
  variant: Variant;
  route: string | null;
  icon: (color: string) => React.ReactElement;
  locked?: boolean;
  lockedMessage?: string;
}

interface AdminDashboardProps {
  footer?: React.ReactNode;
}

export default function AdminDashboard({ footer }: AdminDashboardProps = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;

  const childLabel = user?.is_orphan ? 'children' : 'students';
  const childTitle = user?.is_orphan ? 'Children' : 'Students';
  // Orphan schools have no academic-hub concept (no sections/classes to
  // assign teachers to) - only the Monthly Reports feature applies to them,
  // shown separately below via MonthlyReportsCard.
  const isOrphanSchool = user?.institution_type === 'orphanage';

  // Gates the "Grading Systems" card. Fail-open by design, same reasoning
  // as StudentDashboard's isAcademicLocked: a null status (still loading,
  // or the check failed) never locks the card - real authorization still
  // lives server-side in admin_grading_systems_* itself.
  const [subscriptionStatus, setSubscriptionStatus] = useState<AdminSubscriptionStatus | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchAdminSubscriptionStatus(token)
      .then((data) => {
        if (!cancelled) setSubscriptionStatus(data);
      })
      .catch(() => {
        // Silent - fail-open, card stays unlocked-looking until we know otherwise.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const isGradingLocked = subscriptionStatus?.active === false;
  const gradingLockedMessage =
    subscriptionStatus?.reason === 'expired'
      ? 'Your subscription has expired. Renew it to manage grading systems.'
      : 'Grading Systems needs an active subscription. Contact your account owner to unlock it.';

  const items: ManageItem[] = [
    {
      key: 'students',
      title: childTitle,
      desc: `View and manage all ${childLabel}`,
      variant: 'solid',
      route: 'StudentsList',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'teachers',
      title: 'Teachers',
      desc: 'Manage teachers and permissions',
      variant: 'soft',
      route: 'AdminTeacherList',
      icon: (c) => <PresentationIcon color={c} />,
    },
    {
      key: 'classes',
      title: 'Academic',
      desc: 'Assign class teachers to sections',
      variant: 'soft',
      route: 'AdminClassTeacherAssign',
      icon: (c) => <BookIcon color={c} />,
    },
    {
      key: 'enrollment',
      title: 'Enrollment',
      desc: 'Configure enrollment stages',
      variant: 'soft',
      route: 'EnrollmentStages',
      icon: (c) => <StagesIcon color={c} />,
    },
    {
      key: 'academicSetup',
      title: 'Academic Setup',
      desc: 'Manage academic years and terms',
      variant: 'soft',
      route: 'AcademicYears',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'gradingSystems',
      title: 'Grading Systems',
      desc: 'Build grading systems and grade scales',
      variant: 'soft',
      route: 'GradingSystems',
      icon: (c) => <GraduationCapIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'examCategories',
      title: 'Exam Categories',
      desc: 'Manage weighted components shared by Gradebook and Assessments',
      variant: 'soft',
      route: 'AdminExamCategories',
      icon: (c) => <ExamCategoriesIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'gradebookReview',
      title: 'Gradebook Review',
      desc: 'See the grades teachers have entered, by class and exam',
      variant: 'soft',
      route: 'AdminGradebookReview',
      icon: (c) => <GradebookIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'announcementReview',
      title: 'Announcements Review',
      desc: 'See what teachers have posted, by class and section',
      variant: 'soft',
      route: 'AdminAnnouncementReview',
      icon: (c) => <AnnouncementReviewIcon color={c} />,
    },
    {
      key: 'lessonPlanReview',
      title: 'Lesson Plans Review',
      desc: 'Approve or reject submitted lesson plans, by class and section',
      variant: 'soft',
      route: 'AdminLessonPlanReview',
      icon: (c) => <LessonPlanReviewIcon color={c} />,
    },
    {
      key: 'assessmentReview',
      title: 'Assessments Review',
      desc: 'See assignments, quizzes, and grading progress, by class and section',
      variant: 'soft',
      route: 'AdminAssessmentReview',
      icon: (c) => <AssessmentReviewIcon color={c} />,
    },
    {
      key: 'assessmentGrades',
      title: 'Assessment Grades',
      desc: 'Weighted grade breakdown by section and subject',
      variant: 'soft',
      route: 'AdminAssessmentGrades',
      icon: (c) => <ExamCategoriesIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'materialsReview',
      title: 'Materials Review',
      desc: 'See what teachers have shared, by section and subject',
      variant: 'soft',
      route: 'AdminMaterialsReview',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'programsSubjects',
      title: 'Programs & Subjects',
      desc: 'Manage the school\'s program and subject catalog',
      variant: 'soft',
      route: 'ProgramsCatalog',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'studentNumbers',
      title: 'Student Numbers',
      desc: 'Set how student numbers are built and previewed',
      variant: 'soft',
      route: 'StudentNumberConfig',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'academicFacilities',
      title: 'Facilities',
      desc: 'Buildings, rooms and learning spaces',
      variant: 'soft',
      route: 'AcademicFacilities',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'academicSchedule',
      title: 'Timetable',
      desc: 'Conflict-checked school schedules',
      variant: 'soft',
      route: 'AcademicSchedule',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicCalendar',
      title: 'Calendar',
      desc: 'Exams, holidays and school events',
      variant: 'soft',
      route: 'AcademicCalendar',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicAnalytics',
      title: 'Analytics',
      desc: 'Read-only academic KPIs',
      variant: 'soft',
      route: 'AcademicAnalytics',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'completionHub',
      title: 'Completion Hub',
      desc: 'Six-phase release health and audit',
      variant: 'soft',
      route: 'AcademicCompletionHub',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'graduation',
      title: 'Graduation & Completion',
      desc: 'Requirement sets, eligibility, and approval decisions',
      variant: 'soft',
      route: 'AcademicGraduation',
      icon: (c) => <GraduationCapIcon color={c} />,
    },
    {
      key: 'promotionPolicy',
      title: 'Promotion & Policy',
      desc: 'Promotion, retention, remedial and probation rules',
      variant: 'soft',
      route: 'AcademicPolicy',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'documentTemplates',
      title: 'Document Templates',
      desc: 'Report cards, transcripts, COR and certificates',
      variant: 'soft',
      route: 'DocumentTemplates',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'gradeRelease',
      title: 'Grade Release',
      desc: 'Release and lock finalized grades',
      variant: 'soft',
      route: 'GradeRelease',
      icon: (c) => <GradebookIcon color={c} />,
    },
    {
      key: 'studentIdRules',
      title: 'Student ID Rules',
      desc: 'Configure the student ID format and preview',
      variant: 'soft',
      route: 'StudentIdConfig',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'studentLifecycle',
      title: 'Student Lifecycle',
      desc: 'Transfers, withdrawals, reactivation and archive',
      variant: 'soft',
      route: 'StudentLifecycle',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'timetableConflicts',
      title: 'Timetable Conflicts',
      desc: 'Check room and teacher scheduling conflicts',
      variant: 'soft',
      route: 'TimetableConflicts',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'attendanceConfig',
      title: 'Attendance Config',
      desc: 'Statuses and capture methods for your school',
      variant: 'soft',
      route: 'AttendanceConfig',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'permissions',
      title: 'Permissions',
      desc: 'Role capabilities and optional modules',
      variant: 'soft',
      route: 'Permissions',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'orgStructure',
      title: 'Org Structure',
      desc: 'Faculties, colleges, institutes, streams',
      variant: 'soft',
      route: 'OrgStructure',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'behaviorIncidents',
      title: 'Behavior & Discipline',
      desc: 'School-wide behavior incidents',
      variant: 'soft',
      route: 'BehaviorIncidents',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'examinations',
      title: 'Examinations',
      desc: 'Schedule exams and manage grades',
      variant: 'soft',
      route: 'Examinations',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'studentProgress',
      title: 'Student Progress',
      desc: 'Attendance, grades, behavior, memorization',
      variant: 'soft',
      route: 'StudentProgress',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'integrationSettings',
      title: 'Integrations',
      desc: 'Finance, library and third-party connections',
      variant: 'soft',
      route: 'IntegrationSettings',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'localizationSettings',
      title: 'Localization',
      desc: 'Languages, RTL and translation management',
      variant: 'soft',
      route: 'LocalizationSettings',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'authorizationAudit',
      title: 'Authorization Audit',
      desc: 'Review role access and permission changes',
      variant: 'soft',
      route: 'AuthorizationAudit',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'analyticsExtended',
      title: 'Analytics Dashboard',
      desc: 'Extended KPIs and school-wide reporting',
      variant: 'soft',
      route: 'AnalyticsDashboard',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'notifications',
      title: 'Notifications',
      desc: 'Academic updates, grade releases and schedule changes',
      variant: 'soft',
      route: 'Notifications',
      icon: (c) => <AnnouncementReviewIcon color={c} />,
    },
    {
      key: 'fees',
      title: 'Fee Reports',
      desc: 'View and manage fee collections',
      variant: 'solid',
      route: null,
      icon: (c) => <DocumentIcon color={c} />,
    },
    {
      key: 'attendance',
      title: 'Attendance',
      desc: 'Track daily attendance',
      variant: 'soft',
      route: 'AdminAttendanceAnalytics',
      icon: (c) => <CalendarIcon color={c} />,
    },
  ].filter((item) => !(isOrphanSchool && item.key === 'classes'));

  // --- Parallax + fade for the background layer only. The ScrollView content
  // (greeting, reports card, grid) scrolls at normal speed on top, so it
  // "moves over" this slower, fading dark layer. That gap is the depth.
  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT],
    outputRange: [0, -HERO_HEIGHT * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, HERO_HEIGHT * 0.6, HERO_HEIGHT],
    outputRange: [1, 1, 0],
    extrapolate: 'clamp',
  });

  // Phase 3 - Academic Setup Wizard. Runs before anything else: a brand-new
  // school shouldn't reach the orphan school-code step, or the dashboard
  // cards, until institution type/profile/first academic year are set.
  // `undefined` (old cached token from before this field existed) is
  // treated as complete - same fail-open default the backend uses for
  // legacy schools. See AcademicSetupWizardScreen + AuthContext.updateUser.
  if (user?.academic_setup_completed === false) {
    return <AcademicSetupWizardScreen />;
  }

  // A fresh orphan school has no student code prefix yet. Show only the
  // one-time setup step - no Teachers/Children/Reports cards - until it's
  // saved (see SchoolCodeSetupScreen + AuthContext.updateUser).
  if (user?.institution_type === 'orphanage' && !user?.school_code) {
    return <SchoolCodeSetupScreen />;
  }

  return (
    <View style={styles.flex}>
      {/* Background depth layer - slower + fading, sits BEHIND the scroll view */}
      <Animated.View
        style={[
          styles.bgLayer,
          { height: HERO_HEIGHT, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
        ]}
        pointerEvents="none"
        renderToHardwareTextureAndroid
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <LinearGradient id="heroGrad" x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={HERO_TOP} />
              <Stop offset="1" stopColor={HERO_BOTTOM} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#heroGrad)" />
          <Circle cx="88%" cy="14%" r="80" fill="rgba(255,255,255,0.05)" />
          <Circle cx="70%" cy="-2%" r="46" fill="rgba(255,255,255,0.04)" />
        </Svg>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollFlex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
      >
        {/* Greeting + avatar (foreground, scrolls at normal speed over the bg) */}
        <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingSmall}>Assalamu Alaykum,</Text>
            <Text style={styles.greetingName}>{user?.name ?? ''}</Text>
          </View>
          <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10}>
            <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={62} />
          </TouchableOpacity>
        </View>

        {user?.institution_type === 'orphanage' && token ? (
          // Real data via admin_orphan_report_overview, restored after a
          // later merge silently reverted this to the old static
          // placeholder card (no live counts). See MuslimEdu-Status-8.
          <MonthlyReportsCard token={token} />
        ) : null}

        {/* White body panel - rounded top edge rides up over the dark layer */}
        <View style={styles.body}>
          <Text style={styles.sectionLabel}>Manage</Text>
          <View style={styles.grid}>
            {items.map((item) => {
              const solid = item.variant === 'solid';
              const fg = solid ? '#FFFFFF' : EMERALD;
              return (
                <TouchableOpacity
                  key={item.key}
                  activeOpacity={item.route ? 0.85 : 1}
                  style={[styles.card, solid ? styles.cardSolid : styles.cardSoft]}
                  onPress={() => {
                    if (item.locked) {
                      Alert.alert('Locked', item.lockedMessage ?? 'This feature is currently locked.');
                      return;
                    }
                    if (item.route) (navigation as any).navigate(item.route);
                  }}
                >
                  <View style={[styles.cardIcon, solid ? styles.cardIconSolid : styles.cardIconSoft]}>
                    {item.icon(fg)}
                    {item.locked ? (
                      <View style={styles.lockBadge}>
                        <LockIcon color="#FFFFFF" size={10} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.cardTitle, solid ? styles.cardTitleSolid : null]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.cardDesc, solid ? styles.cardDescSolid : null]}>
                    {item.desc}
                  </Text>
                  <View style={styles.cardArrowRow}>
                    <View style={[styles.cardArrow, solid ? styles.cardArrowSolid : styles.cardArrowSoft]}>
                      <ArrowRight color={fg} size={16} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {footer}
        </View>
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
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: 'hidden',
    backgroundColor: HERO_BOTTOM,
    // Animated transforms on Android can promote a view to its own layer and
    // paint above later siblings; explicit zIndex keeps this behind content.
    zIndex: 0,
    elevation: 0,
  },
  scrollFlex: { flex: 1, zIndex: 1, elevation: 1 },
  scrollContent: { paddingBottom: 40 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  greetingSmall: { fontSize: 15, color: PALE_GREEN },
  greetingName: { fontSize: 30, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },

  reportsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 20,
  },
  reportsIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  reportsLabel: {
    color: PALE_GREEN,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  reportsTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginBottom: 6, lineHeight: 23 },
  reportsSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12.5, lineHeight: 18 },
  reportsArrow: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },

  // The white panel that scrolls up over the dark layer. Its rounded top +
  // opaque white background is what visually "covers" the hero as you scroll.
  body: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 26,
    marginTop: 24,
    minHeight: 520,
  },
  sectionLabel: {
    fontSize: 13,
    color: SUBTLE,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: {
    width: '48%',
    borderRadius: 22,
    padding: 16,
    minHeight: 176,
    marginBottom: 14,
  },
  cardSolid: { backgroundColor: EMERALD },
  cardSoft: { backgroundColor: EMERALD_SOFT },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  cardIconSolid: { backgroundColor: 'rgba(255,255,255,0.16)' },
  cardIconSoft: { backgroundColor: 'rgba(15,157,88,0.12)' },
  lockBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: INK, marginBottom: 5 },
  cardTitleSolid: { color: '#FFFFFF' },
  cardDesc: { fontSize: 12.5, color: SUBTLE, lineHeight: 17 },
  cardDescSolid: { color: 'rgba(255,255,255,0.8)' },
  cardArrowRow: { marginTop: 'auto', alignItems: 'flex-end' },
  cardArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardArrowSolid: { backgroundColor: 'rgba(255,255,255,0.2)' },
  cardArrowSoft: { backgroundColor: 'rgba(15,157,88,0.12)' },
});
