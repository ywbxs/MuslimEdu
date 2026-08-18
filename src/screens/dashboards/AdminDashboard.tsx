import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { ArrowRight, BookOpen, CalendarCheck, Camera, ChevronRight, ClipboardCheck, FileText, GraduationCap, IdCard, LayoutList, ListOrdered, Lock, Megaphone, NotebookText, Presentation, Search, Settings, Users, Workflow, X } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import UserAvatar from '../../components/UserAvatar';
import HeroGlow from '../../components/HeroGlow';
import MonthlyReportsCard from '../../components/MonthlyReportsCard';
import AnalyticsCard from '../../components/AnalyticsCard';
import SchoolIdentityCard from '../../components/SchoolIdentityCard';
import SyncStatusCard from '../../components/SyncStatusCard';
import AcademicSetupWizardScreen from '../admin/AcademicSetupWizardScreen';
import {
  fetchAdminSubscriptionStatus,
  AdminSubscriptionStatus,
  SUBSCRIPTION_FEATURE_KEYS,
} from '../../services/subscriptionService';
import SubscriptionStatusCard from '../../components/SubscriptionStatusCard';
import { ACADEMIC_ADMIN_TILE_KEYS, isOrphanSchoolUser, isQuranTrackingSchoolUser } from '../../utils/orphanSchool';

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

// Per-item icon tints for the grouped list below the hero. Wayfinding
// color, not a second accent - EMERALD stays the only brand color (hero,
// CTAs, focus states). A row without a `tint` (anything not explicitly
// assigned below) falls back to EMERALD_SOFT/EMERALD, same as before this
// redesign, so newly un-hidden items never render with a missing color.
const TINT = {
  blue: '#0A84FF',
  indigo: '#5E5CE6',
  teal: '#2FA9B8',
  orange: '#FF9F0A',
  pink: '#FF3B72',
  red: '#FF453A',
  purple: '#BF5AF2',
  gray: '#8E8E93',
  gold: '#D4A64A',
  emerald: EMERALD,
} as const;
type Tint = keyof typeof TINT;

// --- Inline icons (react-native-svg, matches the app's existing approach) ---
function PeopleIcon({ color }: { color: string }) {
  return <Users size={22} color={color} strokeWidth={1.8} />;
}
function PresentationIcon({ color }: { color: string }) {
  return <Presentation size={22} color={color} strokeWidth={1.8} />;
}
function BookIcon({ color }: { color: string }) {
  return <BookOpen size={22} color={color} strokeWidth={1.8} />;
}
function DocumentIcon({ color }: { color: string }) {
  return <FileText size={22} color={color} strokeWidth={1.8} />;
}
function CalendarIcon({ color }: { color: string }) {
  return <CalendarCheck size={22} color={color} strokeWidth={1.8} />;
}
function ReportDocIcon({ color }: { color: string }) {
  return <FileText size={26} color={color} strokeWidth={1.8} />;
}
function StagesIcon({ color }: { color: string }) {
  return <Workflow size={22} color={color} strokeWidth={1.8} />;
}
function QuranTrackerIcon({ color }: { color: string }) {
  return <BookOpen size={22} color={color} strokeWidth={1.8} />;
}
function ChecklistIcon({ color }: { color: string }) {
  return <ClipboardCheck size={22} color={color} strokeWidth={1.8} />;
}
function GearIcon({ color }: { color: string }) {
  return <Settings size={22} color={color} strokeWidth={1.8} />;
}
function GraduationCapIcon({ color }: { color: string }) {
  return <GraduationCap size={22} color={color} strokeWidth={1.8} />;
}
function GradebookIcon({ color }: { color: string }) {
  return <NotebookText size={22} color={color} strokeWidth={1.8} />;
}
function ExamCategoriesIcon({ color }: { color: string }) {
  return <ListOrdered size={22} color={color} strokeWidth={1.8} />;
}
function AnnouncementReviewIcon({ color }: { color: string }) {
  return <Megaphone size={22} color={color} strokeWidth={1.8} />;
}
function LessonPlanReviewIcon({ color }: { color: string }) {
  return <NotebookText size={22} color={color} strokeWidth={1.8} />;
}
function AssessmentReviewIcon({ color }: { color: string }) {
  return <ClipboardCheck size={22} color={color} strokeWidth={1.8} />;
}
function CatalogIcon({ color }: { color: string }) {
  return <LayoutList size={22} color={color} strokeWidth={1.8} />;
}
function IdCardIcon({ color }: { color: string }) {
  return <IdCard size={26} color={color} strokeWidth={1.7} />;
}
function AlumniCapIcon({ color }: { color: string }) {
  return <GraduationCap size={22} color={color} strokeWidth={2} />;
}
function CameraIcon({ color = '#FFFFFF', size = 11 }: { color?: string; size?: number }) {
  return <Camera size={size} color={color} strokeWidth={2.2} />;
}
function LockIcon({ color = '#FFFFFF', size = 11 }: { color?: string; size?: number }) {
  return <Lock size={size} color={color} strokeWidth={2} />;
}
function ArrowRightIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <ArrowRight size={size} color={color} strokeWidth={2} />;
}
function ChevronIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <ChevronRight size={size} color={color} strokeWidth={2} />;
}
function SearchIcon({ color, size = 18 }: { color: string; size?: number }) {
  return <Search size={size} color={color} strokeWidth={2} />;
}
function ClearIcon({ color, size = 16 }: { color: string; size?: number }) {
  return <X size={size} color={color} strokeWidth={2.4} />;
}

// Declutter: this school is only using the foundation pieces for now
// (academic setup, enrollment, cashier/registrar accounts, ID cards,
// attendance, grading, and school-level settings) - everything else stays
// built and reachable by route, just hidden from the menu until the admin
// asks for it back. To bring one back, remove its key from this set.
const HIDDEN_FOR_NOW_KEYS = new Set([
  // "Academic" (assign class teachers to sections) - none of this app's
  // current schools are big enough to need the class/section/department
  // structure this assumes. Kept reachable by route (AdminClassTeacherAssign)
  // for whenever a school that size signs up.
  'classes',
  // Exam features, hidden per admin request. "Exam Categories" is still the
  // mechanism the Quarterly grading wizard's Q1-Q4 tagging relies on
  // (AdminExamCategoriesScreen) - hiding the tile doesn't touch that data or
  // any grade already computed from it, it just removes this dashboard as an
  // entry point. Both routes (AdminExamCategories, Examinations) still work
  // for whenever exams come back into scope.
  'examCategories',
  'examinations',
  'gradebookReview',
  'announcementReview',
  'lessonPlanReview',
  'assessmentReview',
  'assessmentGrades',
  'materialsReview',
  'academicSchedule', // duplicate of classSchedule - same screen
  'academicCalendar',
  'academicAnalytics',
  'completionHub',
  'graduation',
  'promotionPolicy',
  'documentTemplates',
  'gradeRelease',
  'studentLifecycle',
  'timetableConflicts',
  'permissions',
  'security',
  'orgStructure',
  'behaviorIncidents',
  'studentProgress',
  'integrationSettings',
  'localizationSettings',
  'authorizationAudit',
  'analyticsExtended',
  'notifications',
  'fees',
  'studentServiceRequests',
]);

type Variant = 'solid' | 'soft';
type Category = 'people' | 'identity' | 'academics' | 'activity' | 'settings';

interface ManageItem {
  key: string;
  // Only set on non-featured (variant: 'soft') items - featured items render
  // in the hero/quick-actions row above the grouped lists, so they don't
  // belong to a group.
  category?: Category;
  title: string;
  desc: string;
  variant: Variant;
  route: string | null;
  icon: (color: string) => React.ReactElement;
  locked?: boolean;
  lockedMessage?: string;
  // Row icon-square color in the grouped lists - undefined falls back to
  // EMERALD_SOFT/EMERALD (see TINT above).
  tint?: Tint;
}

const CATEGORY_ORDER: Category[] = ['people', 'identity', 'academics', 'activity', 'settings'];

interface AdminDashboardProps {
  footer?: React.ReactNode;
}

export default function AdminDashboard({ footer }: AdminDashboardProps = {}) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, token } = useAuth();
  const { t } = useLocale();
  const scrollY = useRef(new Animated.Value(0)).current;
  // The dark hero background is a separate absolutely-positioned layer
  // meant to sit behind the greeting + (orphan-only) MonthlyReportsCard,
  // with the white "body" panel's rounded top corner riding up over it
  // for a smooth transition. A fixed HERO_HEIGHT can fall short of that
  // foreground content's real height (MonthlyReportsCard's own content is
  // dynamic), leaving a gap of plain canvas background between the hero
  // and the body's rounded corner instead of the intended overlap.
  // Measure the real height instead of guessing it.
  const [heroHeight, setHeroHeight] = useState(HERO_HEIGHT);
  // Live filter for the grouped lists below the hero/bento row.
  const [query, setQuery] = useState('');

  // Orphan schools have no academic-hub concept (no sections/classes to
  // assign teachers to) - only the Monthly Reports feature applies to them,
  // shown separately below via MonthlyReportsCard. Every academic tile is
  // filtered out of `items` below; RootNavigator guards the routes too.
  const isOrphanSchool = isOrphanSchoolUser(user);
  const showQuranTracker = isQuranTrackingSchoolUser(user);

  const childLabel = isOrphanSchool
    ? t('admin_dashboard.children_label', 'children')
    : t('admin_dashboard.students_label', 'students');
  const childTitle = isOrphanSchool
    ? t('admin_dashboard.children_title', 'Children')
    : t('admin_dashboard.students_title', 'Students');

  // Gates the Grading Systems / Exam Categories / Gradebook Review cards.
  // Fail-open by design, same reasoning as StudentDashboard's
  // isAcademicLocked: a null status (still loading, or the check failed)
  // never locks a card - real authorization still lives server-side in
  // admin_grading_systems_* etc.
  const [subscriptionStatus, setSubscriptionStatus] = useState<AdminSubscriptionStatus | null>(null);
  // Distinct from subscriptionStatus === null (still loading) - lets
  // SubscriptionStatusCard render "couldn't load" instead of nothing when
  // the request actually fails, so a broken/undeployed endpoint is visible
  // instead of the card just silently never appearing.
  const [subscriptionStatusError, setSubscriptionStatusError] = useState(false);
  const loadSubscriptionStatus = React.useCallback(() => {
    if (!token) return;
    setSubscriptionStatusError(false);
    fetchAdminSubscriptionStatus(token)
      .then((data) => setSubscriptionStatus(data))
      .catch((err) => {
        // Fail-open for the feature gates below (isFeatureLocked treats a
        // null status as unlocked) - only the status card surfaces this.
        console.warn('[AdminDashboard] admin_subscription_status failed:', err);
        setSubscriptionStatusError(true);
      });
  }, [token]);
  useEffect(() => {
    loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  // A package's `features` list is opt-in: if the superadmin never
  // configured one for this school's package, it stays empty and every
  // feature below falls back to the old all-or-nothing `active` gate.
  // Only a package that explicitly lists some features restricts to just
  // those - see SUBSCRIPTION_FEATURE_KEYS.
  const isFeatureLocked = (featureKey: string) => {
    if (!subscriptionStatus) return false;
    if (subscriptionStatus.active === false) return true;
    const features = subscriptionStatus.features ?? [];
    return features.length > 0 && !features.includes(featureKey);
  };
  const lockedMessageFor = (defaultKey: string, defaultText: string) =>
    subscriptionStatus?.reason === 'expired'
      ? t('admin_dashboard.feature_locked_expired', 'Your subscription has expired. Renew it to unlock this.')
      : t(defaultKey, defaultText);

  const isGradingLocked = isFeatureLocked(SUBSCRIPTION_FEATURE_KEYS.gradingSystems);
  const gradingLockedMessage = lockedMessageFor(
    'admin_dashboard.grading_locked_no_subscription',
    'Grading Systems needs an active subscription. Contact your account owner to unlock it.',
  );
  const isExamCategoriesLocked = isFeatureLocked(SUBSCRIPTION_FEATURE_KEYS.examCategories);
  const examCategoriesLockedMessage = lockedMessageFor(
    'admin_dashboard.exam_categories_locked_no_subscription',
    'Exam Categories needs an active subscription. Contact your account owner to unlock it.',
  );
  const isGradebookReviewLocked = isFeatureLocked(SUBSCRIPTION_FEATURE_KEYS.gradebookReview);
  const gradebookReviewLockedMessage = lockedMessageFor(
    'admin_dashboard.gradebook_review_locked_no_subscription',
    'Gradebook Review needs an active subscription. Contact your account owner to unlock it.',
  );

  const items: ManageItem[] = [
    {
      key: 'setupChecklist',
      title: t('admin_dashboard.setup_checklist_title', 'Setup Checklist'),
      desc: t('admin_dashboard.setup_checklist_desc', 'Everything needed before your portals are ready to use'),
      variant: 'solid',
      route: 'SetupChecklist',
      icon: (c) => <ChecklistIcon color={c} />,
      tint: 'gold',
    },
    {
      key: 'students',
      title: childTitle,
      desc: t('admin_dashboard.students_desc', 'View and manage all {childLabel}').replace('{childLabel}', childLabel),
      variant: 'solid',
      route: 'StudentsList',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'teachers',
      category: 'people',
      title: t('admin_dashboard.teachers_title', 'Teachers'),
      desc: t('admin_dashboard.teachers_desc', 'Manage teachers and permissions'),
      variant: 'soft',
      route: 'AdminTeacherList',
      icon: (c) => <PresentationIcon color={c} />,
      tint: 'blue',
    },
    {
      key: 'cashiers',
      category: 'people',
      title: t('admin_dashboard.cashiers_title', 'Cashiers'),
      desc: t('admin_dashboard.cashiers_desc', 'Add and manage cashier accounts'),
      variant: 'soft',
      route: 'CashierAccounts',
      icon: (c) => <IdCardIcon color={c} />,
      tint: 'teal',
    },
    {
      key: 'registrars',
      category: 'people',
      title: t('admin_dashboard.registrars_title', 'Registrars'),
      desc: t('admin_dashboard.registrars_desc', 'Add and manage registrar accounts'),
      variant: 'soft',
      route: 'RegistrarAccounts',
      icon: (c) => <IdCardIcon color={c} />,
      tint: 'indigo',
    },
    {
      key: 'idCards',
      category: 'identity',
      title: t('admin_dashboard.id_cards_title', 'ID Cards'),
      desc: t('admin_dashboard.id_cards_desc', 'View and export every student’s QR ID card'),
      variant: 'soft',
      route: 'StudentIdCards',
      icon: (c) => <IdCardIcon color={c} />,
      tint: 'purple',
    },
    {
      key: 'staffIdCards',
      category: 'identity',
      title: t('admin_dashboard.staff_id_cards_title', 'Staff ID Cards'),
      desc: t('admin_dashboard.staff_id_cards_desc', 'View and export teacher, cashier, and registrar ID cards'),
      variant: 'soft',
      route: 'StaffIdCards',
      icon: (c) => <IdCardIcon color={c} />,
      tint: 'purple',
    },
    {
      key: 'classesSections',
      category: 'academics',
      title: t('admin_dashboard.classes_sections_title', 'Classes & Sections'),
      desc: t('admin_dashboard.classes_sections_desc', 'Create classes and sections for this school'),
      variant: 'soft',
      route: 'ClassList',
      icon: (c) => <BookIcon color={c} />,
      tint: 'orange',
    },
    {
      key: 'classes',
      category: 'academics',
      title: t('admin_dashboard.classes_title', 'Academic'),
      desc: t('admin_dashboard.classes_desc', 'Assign class teachers to sections'),
      variant: 'soft',
      route: 'AdminClassTeacherAssign',
      icon: (c) => <BookIcon color={c} />,
    },
    {
      key: 'classSchedule',
      category: 'academics',
      title: t('admin_dashboard.class_schedule_title', 'Class Schedule'),
      desc: t('admin_dashboard.class_schedule_desc', 'Build the weekly timetable'),
      variant: 'soft',
      route: 'AdminSchedule',
      icon: (c) => <CalendarIcon color={c} />,
      tint: 'indigo',
    },
    {
      key: 'enrollment',
      category: 'academics',
      title: t('admin_dashboard.enrollment_title', 'Enrollment'),
      desc: t('admin_dashboard.enrollment_desc', 'Configure enrollment stages'),
      variant: 'soft',
      route: 'EnrollmentStages',
      icon: (c) => <StagesIcon color={c} />,
      tint: 'pink',
    },
    {
      key: 'academicSetup',
      category: 'academics',
      title: t('admin_dashboard.academic_setup_title', 'Academic Setup'),
      desc: t('admin_dashboard.academic_setup_desc', 'Manage academic years and terms'),
      variant: 'soft',
      route: 'AcademicYears',
      icon: (c) => <GearIcon color={c} />,
      tint: 'gray',
    },
    {
      key: 'gradingSystems',
      category: 'academics',
      title: t('admin_dashboard.grading_systems_title', 'Grading Systems'),
      desc: t('admin_dashboard.grading_systems_desc', 'Build grading systems and grade scales'),
      variant: 'soft',
      route: 'GradingSystems',
      icon: (c) => <GraduationCapIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
      tint: 'red',
    },
    ...(showQuranTracker
      ? [
          {
            key: 'quranTracker',
      category: 'academics',
            title: t('admin_dashboard.quran_tracker_title', 'Quran Tracker'),
            desc: t('admin_dashboard.quran_tracker_desc', 'Track each student\'s surah, juz, and memorization progress'),
            variant: 'soft' as Variant,
            route: 'StudentProgress',
            icon: (c: string) => <QuranTrackerIcon color={c} />,
            tint: 'emerald' as Tint,
          },
        ]
      : []),
    {
      key: 'examCategories',
      category: 'academics',
      title: t('admin_dashboard.exam_categories_title', 'Exam Categories'),
      desc: t(
        'admin_dashboard.exam_categories_desc',
        'Manage weighted components shared by Gradebook and Assessments',
      ),
      variant: 'soft',
      route: 'AdminExamCategories',
      icon: (c) => <ExamCategoriesIcon color={c} />,
      locked: isExamCategoriesLocked,
      lockedMessage: examCategoriesLockedMessage,
    },
    {
      key: 'gradebookReview',
      category: 'academics',
      title: t('admin_dashboard.gradebook_review_title', 'Gradebook Review'),
      desc: t('admin_dashboard.gradebook_review_desc', 'See the grades teachers have entered, by class and exam'),
      variant: 'soft',
      route: 'AdminGradebookReview',
      icon: (c) => <GradebookIcon color={c} />,
      locked: isGradebookReviewLocked,
      lockedMessage: gradebookReviewLockedMessage,
    },
    {
      key: 'announcementReview',
      category: 'academics',
      title: t('admin_dashboard.announcement_review_title', 'Announcements Review'),
      desc: t('admin_dashboard.announcement_review_desc', 'See what teachers have posted, by class and section'),
      variant: 'soft',
      route: 'AdminAnnouncementReview',
      icon: (c) => <AnnouncementReviewIcon color={c} />,
    },
    {
      key: 'lessonPlanReview',
      category: 'academics',
      title: t('admin_dashboard.lesson_plan_review_title', 'Lesson Plans Review'),
      desc: t(
        'admin_dashboard.lesson_plan_review_desc',
        'Approve or reject submitted lesson plans, by class and section',
      ),
      variant: 'soft',
      route: 'AdminLessonPlanReview',
      icon: (c) => <LessonPlanReviewIcon color={c} />,
    },
    {
      key: 'assessmentReview',
      category: 'academics',
      title: t('admin_dashboard.assessment_review_title', 'Assessments Review'),
      desc: t(
        'admin_dashboard.assessment_review_desc',
        'See assignments, quizzes, and grading progress, by class and section',
      ),
      variant: 'soft',
      route: 'AdminAssessmentReview',
      icon: (c) => <AssessmentReviewIcon color={c} />,
    },
    {
      key: 'assessmentGrades',
      category: 'academics',
      title: t('admin_dashboard.assessment_grades_title', 'Assessment Grades'),
      desc: t('admin_dashboard.assessment_grades_desc', 'Weighted grade breakdown by section and subject'),
      variant: 'soft',
      route: 'AdminAssessmentGrades',
      icon: (c) => <ExamCategoriesIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'materialsReview',
      category: 'academics',
      title: t('admin_dashboard.materials_review_title', 'Materials Review'),
      desc: t('admin_dashboard.materials_review_desc', 'See what teachers have shared, by section and subject'),
      variant: 'soft',
      route: 'AdminMaterialsReview',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      // Deliberately visible for every school type, including orphan
      // schools - unlike the academic tiles filtered out above, this isn't
      // gated by ACADEMIC_ADMIN_TILE_KEYS since orphan children and staff
      // both need a code format too. See StudentStaffCodeSetupScreen.
      key: 'studentStaffCodes',
      category: 'identity',
      title: t('admin_dashboard.student_staff_codes_title', 'Student & Staff Codes'),
      desc: t('admin_dashboard.student_staff_codes_desc', 'Set the code format for new students and staff'),
      variant: 'soft',
      route: 'StudentStaffCodeSetup',
      icon: (c) => <IdCardIcon color={c} />,
      tint: 'pink',
    },
    {
      key: 'programsSubjects',
      category: 'academics',
      title: t('admin_dashboard.programs_subjects_title', 'Subjects'),
      desc: t('admin_dashboard.programs_subjects_desc', "Manage the school's subject catalog"),
      variant: 'soft',
      route: 'ProgramsCatalog',
      icon: (c) => <CatalogIcon color={c} />,
      tint: 'blue',
    },
    {
      key: 'academicFacilities',
      category: 'academics',
      title: t('admin_dashboard.academic_facilities_title', 'Facilities'),
      desc: t('admin_dashboard.academic_facilities_desc', 'Buildings, rooms and learning spaces'),
      variant: 'soft',
      route: 'AcademicFacilities',
      icon: (c) => <CatalogIcon color={c} />,
      tint: 'gray',
    },
    {
      key: 'academicSchedule',
      category: 'academics',
      title: t('admin_dashboard.academic_schedule_title', 'Timetable'),
      desc: t('admin_dashboard.academic_schedule_desc', 'Conflict-checked school schedules'),
      variant: 'soft',
      route: 'AcademicSchedule',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicCalendar',
      category: 'academics',
      title: t('admin_dashboard.academic_calendar_title', 'Calendar'),
      desc: t('admin_dashboard.academic_calendar_desc', 'Exams, holidays and school events'),
      variant: 'soft',
      route: 'AcademicCalendar',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicAnalytics',
      category: 'academics',
      title: t('admin_dashboard.academic_analytics_title', 'Analytics'),
      desc: t('admin_dashboard.academic_analytics_desc', 'Read-only academic KPIs'),
      variant: 'soft',
      route: 'AcademicAnalytics',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'completionHub',
      category: 'academics',
      title: t('admin_dashboard.completion_hub_title', 'Completion Hub'),
      desc: t('admin_dashboard.completion_hub_desc', 'Six-phase release health and audit'),
      variant: 'soft',
      route: 'AcademicCompletionHub',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'graduation',
      category: 'academics',
      title: t('admin_dashboard.graduation_title', 'Graduation & Completion'),
      desc: t('admin_dashboard.graduation_desc', 'Requirement sets, eligibility, and approval decisions'),
      variant: 'soft',
      route: 'AcademicGraduation',
      icon: (c) => <GraduationCapIcon color={c} />,
    },
    {
      key: 'promotionPolicy',
      category: 'academics',
      title: t('admin_dashboard.promotion_policy_title', 'Promotion & Policy'),
      desc: t('admin_dashboard.promotion_policy_desc', 'Promotion, retention, remedial and probation rules'),
      variant: 'soft',
      route: 'AcademicPolicy',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'documentTemplates',
      category: 'academics',
      title: t('admin_dashboard.document_templates_title', 'Document Templates'),
      desc: t('admin_dashboard.document_templates_desc', 'Report cards, transcripts, COR and certificates'),
      variant: 'soft',
      route: 'DocumentTemplates',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'gradeRelease',
      category: 'academics',
      title: t('admin_dashboard.grade_release_title', 'Grade Release'),
      desc: t('admin_dashboard.grade_release_desc', 'Release and lock finalized grades'),
      variant: 'soft',
      route: 'GradeRelease',
      icon: (c) => <GradebookIcon color={c} />,
    },
    {
      key: 'studentLifecycle',
      category: 'academics',
      title: t('admin_dashboard.student_lifecycle_title', 'Student Lifecycle'),
      desc: t('admin_dashboard.student_lifecycle_desc', 'Transfers, withdrawals, reactivation and archive'),
      variant: 'soft',
      route: 'StudentLifecycle',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'timetableConflicts',
      category: 'academics',
      title: t('admin_dashboard.timetable_conflicts_title', 'Timetable Conflicts'),
      desc: t('admin_dashboard.timetable_conflicts_desc', 'Check room and teacher scheduling conflicts'),
      variant: 'soft',
      route: 'TimetableConflicts',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'attendanceConfig',
      category: 'academics',
      title: t('admin_dashboard.attendance_config_title', 'Attendance Config'),
      desc: t('admin_dashboard.attendance_config_desc', 'Statuses and capture methods for your school'),
      variant: 'soft',
      route: 'AttendanceConfig',
      icon: (c) => <GearIcon color={c} />,
      tint: 'teal',
    },
    {
      key: 'permissions',
      category: 'settings',
      title: t('admin_dashboard.permissions_title', 'Permissions'),
      desc: t('admin_dashboard.permissions_desc', 'Role capabilities and optional modules'),
      variant: 'soft',
      route: 'Permissions',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'security',
      category: 'settings',
      title: t('admin_dashboard.security_title', 'Security'),
      desc: t('admin_dashboard.security_desc', 'Two-factor authentication and device sessions'),
      variant: 'soft',
      route: 'SecuritySettings',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'orgStructure',
      category: 'academics',
      title: t('admin_dashboard.org_structure_title', 'Org Structure'),
      desc: t('admin_dashboard.org_structure_desc', 'Faculties, colleges, institutes, streams'),
      variant: 'soft',
      route: 'OrgStructure',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'behaviorIncidents',
      category: 'academics',
      title: t('admin_dashboard.behavior_incidents_title', 'Behavior & Discipline'),
      desc: t('admin_dashboard.behavior_incidents_desc', 'School-wide behavior incidents'),
      variant: 'soft',
      route: 'BehaviorIncidents',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'examinations',
      category: 'academics',
      title: t('admin_dashboard.examinations_title', 'Examinations'),
      desc: t('admin_dashboard.examinations_desc', 'Schedule exams and manage grades'),
      variant: 'soft',
      route: 'Examinations',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'studentProgress',
      category: 'academics',
      title: t('admin_dashboard.student_progress_title', 'Student Progress'),
      desc: t('admin_dashboard.student_progress_desc', 'Attendance, grades, behavior, memorization'),
      variant: 'soft',
      route: 'StudentProgress',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'integrationSettings',
      category: 'settings',
      title: t('admin_dashboard.integration_settings_title', 'Integrations'),
      desc: t('admin_dashboard.integration_settings_desc', 'Finance, library and third-party connections'),
      variant: 'soft',
      route: 'IntegrationSettings',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'localizationSettings',
      category: 'settings',
      title: t('admin_dashboard.localization_settings_title', 'Localization'),
      desc: t('admin_dashboard.localization_settings_desc', 'Languages, RTL and translation management'),
      variant: 'soft',
      route: 'LocalizationSettings',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'authorizationAudit',
      category: 'settings',
      title: t('admin_dashboard.authorization_audit_title', 'Authorization Audit'),
      desc: t('admin_dashboard.authorization_audit_desc', 'Review role access and permission changes'),
      variant: 'soft',
      route: 'AuthorizationAudit',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'analyticsExtended',
      category: 'academics',
      title: t('admin_dashboard.analytics_extended_title', 'Analytics Dashboard'),
      desc: t('admin_dashboard.analytics_extended_desc', 'Extended KPIs and school-wide reporting'),
      variant: 'soft',
      route: 'AnalyticsDashboard',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'notifications',
      category: 'activity',
      title: t('admin_dashboard.notifications_title', 'Notifications'),
      desc: t('admin_dashboard.notifications_desc', 'Academic updates, grade releases and schedule changes'),
      variant: 'soft',
      route: 'Notifications',
      icon: (c) => <AnnouncementReviewIcon color={c} />,
    },
    {
      key: 'fees',
      title: t('admin_dashboard.fees_title', 'Fee Reports'),
      desc: t('admin_dashboard.fees_desc', 'View and manage fee collections'),
      variant: 'solid',
      route: 'AdminFeeReports',
      icon: (c) => <DocumentIcon color={c} />,
    },
    {
      key: 'attendance',
      category: 'activity',
      title: t('admin_dashboard.attendance_title', 'Attendance'),
      desc: t('admin_dashboard.attendance_desc', 'Track daily attendance'),
      variant: 'soft',
      route: 'AdminAttendanceAnalytics',
      icon: (c) => <CalendarIcon color={c} />,
      tint: 'emerald',
    },
    {
      key: 'studentDocumentRequests',
      category: 'activity',
      title: t('admin_dashboard.student_document_requests_title', 'Document Requests'),
      desc: t('admin_dashboard.student_document_requests_desc', 'Issue or reject student document requests'),
      variant: 'soft',
      route: 'AdminStudentDocuments',
      icon: (c) => <ReportDocIcon color={c} />,
      tint: 'blue',
    },
    {
      key: 'alumniApplications',
      category: 'activity',
      title: t('admin_dashboard.alumni_applications_title', 'Alumni Applications'),
      desc: t('admin_dashboard.alumni_applications_desc', 'Review and approve self-service alumni signups'),
      variant: 'soft',
      route: 'AdminAlumniApplications',
      icon: (c) => <AlumniCapIcon color={c} />,
      tint: 'indigo',
    },
    {
      key: 'studentServiceRequests',
      category: 'activity',
      title: t('admin_dashboard.student_service_requests_title', 'Service Requests'),
      desc: t(
        'admin_dashboard.student_service_requests_desc',
        'Guidance, counselling and other student tickets',
      ),
      variant: 'soft',
      route: 'AdminStudentServices',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'accountSettings',
      category: 'settings',
      title: t('admin_dashboard.account_settings_title', 'Account Settings'),
      desc: t('admin_dashboard.account_settings_desc', 'Language, theme, privacy and password'),
      variant: 'soft',
      route: 'AccountSettings',
      icon: (c) => <GearIcon color={c} />,
      tint: 'gray',
    },
  ]
    .filter((item) => !(isOrphanSchool && ACADEMIC_ADMIN_TILE_KEYS.has(item.key)))
    .filter((item) => !HIDDEN_FOR_NOW_KEYS.has(item.key));

  // A flat grid of ~24 identically-sized cards has no hierarchy - everything
  // fights for the same attention, so nothing actually stands out. The 3
  // items already marked `variant: 'solid'` were the codebase's own signal
  // for "this matters more"; they were just rendered as the same-size card
  // in a different color. Surface that signal for real: a hero + two
  // secondary quick actions up top (a 1+2 bento, not 3 equal tiles), then
  // everything else grouped into short, scannable Settings-style lists
  // instead of another wall of big cards.
  const featured = items.filter((item) => item.variant === 'solid');
  const grouped = items.filter((item) => item.variant !== 'solid');
  // Students is deliberately the hero regardless of array order - see the
  // comment above the hero card in the render below for why.
  const hero = featured.find((item) => item.key === 'students') ?? featured[0] ?? null;
  const secondary = featured.filter((item) => item !== hero);

  const CATEGORY_LABELS: Record<Category, string> = {
    people: t('admin_dashboard.group_people', 'People'),
    identity: t('admin_dashboard.group_identity', 'Identity & Codes'),
    academics: t('admin_dashboard.group_academics', 'Academics'),
    activity: t('admin_dashboard.group_activity', 'Activity & Requests'),
    settings: t('admin_dashboard.group_settings', 'Settings'),
  };
  const sections = CATEGORY_ORDER.map((cat) => ({
    key: cat,
    label: CATEGORY_LABELS[cat],
    items: grouped.filter((item) => item.category === cat),
  })).filter((section) => section.items.length > 0);

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const filteredSections = isSearching
    ? sections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.title.toLowerCase().includes(trimmedQuery)),
        }))
        .filter((section) => section.items.length > 0)
    : sections;

  const openItem = (item: ManageItem) => {
    if (item.locked) {
      Alert.alert(
        t('admin_dashboard.locked_title', 'Locked'),
        item.lockedMessage ?? t('admin_dashboard.locked_default_message', 'This feature is currently locked.'),
      );
      return;
    }
    if (item.route) (navigation as any).navigate(item.route);
  };

  // --- Parallax + fade for the background layer only. The ScrollView content
  // (greeting, reports card, grid) scrolls at normal speed on top, so it
  // "moves over" this slower, fading dark layer. That gap is the depth.
  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, heroHeight],
    outputRange: [0, -heroHeight * PARALLAX_FACTOR],
    extrapolate: 'clamp',
  });
  const bgOpacity = scrollY.interpolate({
    inputRange: [0, heroHeight * 0.6, heroHeight],
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

  return (
    <View style={styles.flex}>
      {/* Background depth layer - slower + fading, sits BEHIND the scroll view */}
      <Animated.View
        style={[
          styles.bgLayer,
          { height: heroHeight, opacity: bgOpacity, transform: [{ translateY: bgTranslateY }] },
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
        </Svg>
        <HeroGlow />
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
        <View
          onLayout={(e) => {
            const measured = e.nativeEvent.layout.height;
            if (Math.abs(measured - heroHeight) > 1) setHeroHeight(measured);
          }}
        >
          {/* Greeting + avatar (foreground, scrolls at normal speed over the bg) */}
          <View style={[styles.headerRow, { paddingTop: insets.top }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greetingSmall}>{t('admin_dashboard.greeting', 'Assalamu Alaykum,')}</Text>
              <Text style={styles.greetingName}>{user?.name ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={() => (navigation as any).navigate('Menu')} hitSlop={10} style={styles.avatarWrap}>
              <UserAvatar name={user?.name ?? ''} photo={user?.photo} size={62} dotColor={null} />
              <TouchableOpacity
                style={styles.avatarEditBadge}
                onPress={() => (navigation as any).navigate('EditProfile')}
                hitSlop={8}
              >
                <CameraIcon color={EMERALD} size={11} />
              </TouchableOpacity>
            </TouchableOpacity>
          </View>

          {isOrphanSchool && token ? (
            <>
              {/* AnalyticsCard (below) shows this same school name/address/
                  logo + edit shortcut for non-orphan schools, but orphan
                  schools never render AnalyticsCard at all - it otherwise
                  reports on class-based academic data they don't have.
                  Standalone here so orphan admins can still see and edit
                  their own school's info from the dashboard. */}
              <SchoolIdentityCard token={token} />
              {/* Real data via admin_orphan_report_overview, restored after a
                  later merge silently reverted this to the old static
                  placeholder card (no live counts). See MuslimEdu-Status-8. */}
              <MonthlyReportsCard token={token} />
            </>
          ) : null}

          {/* Non-orphan schools' equivalent of the hero card above - every
              institution type except orphanage has the class-based academic
              subsystem (attendance, grades, enrollment) this reports on,
              same boundary isOrphanSchool already draws for the rest of the
              academic tile set. */}
          {!isOrphanSchool && token ? <AnalyticsCard token={token} /> : null}
        </View>

        {/* White body panel - rounded top edge rides up over the dark layer */}
        <View style={styles.body}>
          <SyncStatusCard />
          {/* Visible read-only status for the platform subscription that
              gates gradingSystems/examCategories/gradebookReview below -
              previously those cards just locked silently with no way for
              the admin to see WHY (package, expiry, days left). Set by the
              superadmin from SuperAdminSchoolSubscription. */}
          <SubscriptionStatusCard
            status={subscriptionStatus}
            loadFailed={subscriptionStatusError}
            onRetry={loadSubscriptionStatus}
            onSubscribePress={() => (navigation as any).navigate('SubscribeRequest')}
          />
          <Text style={styles.sectionLabel}>{t('admin_dashboard.manage_section', 'Manage')}</Text>

          {/* Live filter over the grouped lists below - hero/bento hide while
              searching since they're quick actions, not menu entries. */}
          <View style={styles.searchBar}>
            <SearchIcon color={SUBTLE} size={17} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('admin_dashboard.search_placeholder', 'Search menu')}
              placeholderTextColor={SUBTLE}
              style={styles.searchInput}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              clearButtonMode="never"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
                <ClearIcon color={SUBTLE} size={16} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Hero + secondary bento (1+2, per the 3 featured items - not 3
              equal tiles). Students is the hero: it's the one action every
              admin, regardless of school type or setup progress, comes back
              to constantly. Setup Checklist and Fee Reports are onboarding-
              and finance-flavored respectively - important, but situational
              rather than a daily habit, so they stay secondary. */}
          {!isSearching && hero ? (
            <TouchableOpacity activeOpacity={0.92} style={styles.heroCard} onPress={() => openItem(hero)}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroIcon}>{hero.icon('#FFFFFF')}</View>
                <View style={styles.heroArrow}>
                  <ArrowRightIcon color="#FFFFFF" size={17} />
                </View>
              </View>
              <Text style={styles.heroTitle}>{hero.title}</Text>
              <Text style={styles.heroDesc}>{hero.desc}</Text>
            </TouchableOpacity>
          ) : null}

          {!isSearching && secondary.length > 0 ? (
            <View style={styles.secondaryRow}>
              {secondary.map((item) => {
                const tintColor = item.tint ? TINT[item.tint] : EMERALD;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.88}
                    style={styles.secondaryCard}
                    onPress={() => openItem(item)}
                  >
                    <View style={[styles.secondaryIcon, { backgroundColor: tintColor }]}>
                      {item.icon('#FFFFFF')}
                    </View>
                    <Text style={styles.secondaryTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.secondaryDesc} numberOfLines={2}>
                      {item.desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {/* Everything else, grouped into short Settings-style lists instead
              of another wall of 40+ identical cards - elevation on a single
              card communicates the group, so individual rows don't need
              their own card/shadow (design-taste-frontend 4.4: cards only
              where elevation communicates real hierarchy, group with
              dividers otherwise). */}
          {filteredSections.map((section) => (
            <View key={section.key} style={styles.groupSection}>
              <Text style={styles.groupLabel}>{section.label}</Text>
              <View style={styles.groupCard}>
                {section.items.map((item, idx) => {
                  const tintColor = item.tint ? TINT[item.tint] : EMERALD_SOFT;
                  const iconColor = item.tint ? '#FFFFFF' : EMERALD;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      activeOpacity={0.7}
                      style={[styles.row, idx > 0 && styles.rowDivider]}
                      onPress={() => openItem(item)}
                    >
                      <View style={[styles.rowIconWrap, { backgroundColor: tintColor }]}>
                        {item.icon(iconColor)}
                        {item.locked ? (
                          <View style={styles.rowLockBadge}>
                            <LockIcon color="#FFFFFF" size={9} />
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.rowTextWrap}>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={styles.rowDesc} numberOfLines={1}>
                          {item.desc}
                        </Text>
                      </View>
                      <ChevronIcon color={SUBTLE} size={18} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}

          {isSearching && filteredSections.length === 0 ? (
            <Text style={styles.noResults}>
              {t('admin_dashboard.search_no_results', 'No results. Try a different search.')}
            </Text>
          ) : null}

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

  avatarWrap: { position: 'relative' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFEFF1',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    marginBottom: 18,
  },
  searchInput: { flex: 1, fontSize: 15.5, color: INK, padding: 0 },
  noResults: {
    textAlign: 'center',
    color: SUBTLE,
    fontSize: 14,
    paddingVertical: 36,
  },
  // --- Hero (1 of the 3 featured items) -----------------------------------
  // #1FAE64 (EMERALD) with white text measures 2.88:1 - fails WCAG AA
  // (4.5:1) outright, the same bug the superadmin screen had. This deep
  // variant of the same hue measures 5.42:1, kept local rather than pulled
  // from theme/glass since this file already keeps its palette local
  // (see HERO_TOP/HERO_BOTTOM above).
  heroCard: {
    backgroundColor: '#0F7A3D',
    borderRadius: 26,
    padding: 20,
    marginBottom: 12,
  },
  // Icon + arrow share one row (icon square left, arrow circle right) instead
  // of the arrow floating absolutely at the bottom - that left a dead gap of
  // plain green between the icon and the title. Icon is a rounded square now,
  // not a circle, so it matches every other icon tile in the redesign
  // (secondary cards, grouped-list rows) instead of being the one shape that
  // doesn't match.
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontSize: 21, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  heroDesc: { fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 19 },
  heroArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- Secondary quick actions (the other 2 featured items) ---------------
  // White cards with a colored icon square (per item.tint) instead of a
  // uniform light-green tint - matches the grouped-list rows below so the
  // whole "Manage" section reads as one system, not two different styles.
  secondaryRow: { flexDirection: 'row', gap: 12, marginBottom: 28 },
  secondaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
    padding: 15,
    shadowColor: '#0B3D2E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  secondaryIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  secondaryTitle: { fontSize: 14.5, fontWeight: '700', color: INK, marginBottom: 3 },
  secondaryDesc: { fontSize: 11.5, color: SUBTLE, lineHeight: 15 },

  // --- Grouped lists (everything else) -------------------------------------
  groupSection: { marginBottom: 22 },
  groupLabel: {
    fontSize: 12,
    color: SUBTLE,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  // One elevated card per group - the surface itself communicates "these
  // belong together"; rows inside are flat, separated by a hairline only.
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,24,39,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: 'rgba(17,24,39,0.06)' },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: EMERALD_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  rowLockBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: '#1C1C1E',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextWrap: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600', color: INK },
  rowDesc: { fontSize: 12, color: SUBTLE, marginTop: 1 },
});
