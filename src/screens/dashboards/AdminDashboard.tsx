import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from 'react-native-svg';
import { ArrowRight, BookOpen, CalendarCheck, Camera, ClipboardCheck, FileText, GraduationCap, IdCard, LayoutList, ListOrdered, Lock, Megaphone, NotebookText, Presentation, Settings, Users, Workflow } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useLocale } from '../../context/LocaleContext';
import { EMERALD, EMERALD_SOFT, INK, SUBTLE } from './DashboardShell';
import UserAvatar from '../../components/UserAvatar';
import HeroGlow from '../../components/HeroGlow';
import MonthlyReportsCard from '../../components/MonthlyReportsCard';
import SyncStatusCard from '../../components/SyncStatusCard';
import AcademicSetupWizardScreen from '../admin/AcademicSetupWizardScreen';
import { fetchAdminSubscriptionStatus, AdminSubscriptionStatus } from '../../services/subscriptionService';
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

// Declutter: this school is only using the foundation pieces for now
// (academic setup, enrollment, cashier/registrar accounts, ID cards,
// attendance, grading, and school-level settings) - everything else stays
// built and reachable by route, just hidden from the menu until the admin
// asks for it back. To bring one back, remove its key from this set.
const HIDDEN_FOR_NOW_KEYS = new Set([
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
      ? t(
          'admin_dashboard.grading_locked_expired',
          'Your subscription has expired. Renew it to manage grading systems.',
        )
      : t(
          'admin_dashboard.grading_locked_no_subscription',
          'Grading Systems needs an active subscription. Contact your account owner to unlock it.',
        );

  const items: ManageItem[] = [
    {
      key: 'setupChecklist',
      title: t('admin_dashboard.setup_checklist_title', 'Setup Checklist'),
      desc: t('admin_dashboard.setup_checklist_desc', 'Everything needed before your portals are ready to use'),
      variant: 'solid',
      route: 'SetupChecklist',
      icon: (c) => <ChecklistIcon color={c} />,
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
      title: t('admin_dashboard.teachers_title', 'Teachers'),
      desc: t('admin_dashboard.teachers_desc', 'Manage teachers and permissions'),
      variant: 'soft',
      route: 'AdminTeacherList',
      icon: (c) => <PresentationIcon color={c} />,
    },
    {
      key: 'cashiers',
      title: t('admin_dashboard.cashiers_title', 'Cashiers'),
      desc: t('admin_dashboard.cashiers_desc', 'Add and manage cashier accounts'),
      variant: 'soft',
      route: 'CashierAccounts',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'registrars',
      title: t('admin_dashboard.registrars_title', 'Registrars'),
      desc: t('admin_dashboard.registrars_desc', 'Add and manage registrar accounts'),
      variant: 'soft',
      route: 'RegistrarAccounts',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'idCards',
      title: t('admin_dashboard.id_cards_title', 'ID Cards'),
      desc: t('admin_dashboard.id_cards_desc', 'View and export every student’s QR ID card'),
      variant: 'soft',
      route: 'StudentIdCards',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'staffIdCards',
      title: t('admin_dashboard.staff_id_cards_title', 'Staff ID Cards'),
      desc: t('admin_dashboard.staff_id_cards_desc', 'View and export teacher, cashier, and registrar ID cards'),
      variant: 'soft',
      route: 'StaffIdCards',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'classes',
      title: t('admin_dashboard.classes_title', 'Academic'),
      desc: t('admin_dashboard.classes_desc', 'Assign class teachers to sections'),
      variant: 'soft',
      route: 'AdminClassTeacherAssign',
      icon: (c) => <BookIcon color={c} />,
    },
    {
      key: 'classSchedule',
      title: t('admin_dashboard.class_schedule_title', 'Class Schedule'),
      desc: t('admin_dashboard.class_schedule_desc', 'Build the weekly timetable'),
      variant: 'soft',
      route: 'AdminSchedule',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'enrollment',
      title: t('admin_dashboard.enrollment_title', 'Enrollment'),
      desc: t('admin_dashboard.enrollment_desc', 'Configure enrollment stages'),
      variant: 'soft',
      route: 'EnrollmentStages',
      icon: (c) => <StagesIcon color={c} />,
    },
    {
      key: 'academicSetup',
      title: t('admin_dashboard.academic_setup_title', 'Academic Setup'),
      desc: t('admin_dashboard.academic_setup_desc', 'Manage academic years and terms'),
      variant: 'soft',
      route: 'AcademicYears',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'gradingSystems',
      title: t('admin_dashboard.grading_systems_title', 'Grading Systems'),
      desc: t('admin_dashboard.grading_systems_desc', 'Build grading systems and grade scales'),
      variant: 'soft',
      route: 'GradingSystems',
      icon: (c) => <GraduationCapIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    ...(showQuranTracker
      ? [
          {
            key: 'quranTracker',
            title: t('admin_dashboard.quran_tracker_title', 'Quran Tracker'),
            desc: t('admin_dashboard.quran_tracker_desc', 'Track each student\'s surah, juz, and memorization progress'),
            variant: 'soft' as Variant,
            route: 'StudentProgress',
            icon: (c: string) => <QuranTrackerIcon color={c} />,
          },
        ]
      : []),
    {
      key: 'examCategories',
      title: t('admin_dashboard.exam_categories_title', 'Exam Categories'),
      desc: t(
        'admin_dashboard.exam_categories_desc',
        'Manage weighted components shared by Gradebook and Assessments',
      ),
      variant: 'soft',
      route: 'AdminExamCategories',
      icon: (c) => <ExamCategoriesIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'gradebookReview',
      title: t('admin_dashboard.gradebook_review_title', 'Gradebook Review'),
      desc: t('admin_dashboard.gradebook_review_desc', 'See the grades teachers have entered, by class and exam'),
      variant: 'soft',
      route: 'AdminGradebookReview',
      icon: (c) => <GradebookIcon color={c} />,
      locked: isGradingLocked,
      lockedMessage: gradingLockedMessage,
    },
    {
      key: 'announcementReview',
      title: t('admin_dashboard.announcement_review_title', 'Announcements Review'),
      desc: t('admin_dashboard.announcement_review_desc', 'See what teachers have posted, by class and section'),
      variant: 'soft',
      route: 'AdminAnnouncementReview',
      icon: (c) => <AnnouncementReviewIcon color={c} />,
    },
    {
      key: 'lessonPlanReview',
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
      title: t('admin_dashboard.student_staff_codes_title', 'Student & Staff Codes'),
      desc: t('admin_dashboard.student_staff_codes_desc', 'Set the code format for new students and staff'),
      variant: 'soft',
      route: 'StudentStaffCodeSetup',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'programsSubjects',
      title: t('admin_dashboard.programs_subjects_title', 'Programs & Subjects'),
      desc: t('admin_dashboard.programs_subjects_desc', "Manage the school's program and subject catalog"),
      variant: 'soft',
      route: 'ProgramsCatalog',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'academicFacilities',
      title: t('admin_dashboard.academic_facilities_title', 'Facilities'),
      desc: t('admin_dashboard.academic_facilities_desc', 'Buildings, rooms and learning spaces'),
      variant: 'soft',
      route: 'AcademicFacilities',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'academicSchedule',
      title: t('admin_dashboard.academic_schedule_title', 'Timetable'),
      desc: t('admin_dashboard.academic_schedule_desc', 'Conflict-checked school schedules'),
      variant: 'soft',
      route: 'AcademicSchedule',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicCalendar',
      title: t('admin_dashboard.academic_calendar_title', 'Calendar'),
      desc: t('admin_dashboard.academic_calendar_desc', 'Exams, holidays and school events'),
      variant: 'soft',
      route: 'AcademicCalendar',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'academicAnalytics',
      title: t('admin_dashboard.academic_analytics_title', 'Analytics'),
      desc: t('admin_dashboard.academic_analytics_desc', 'Read-only academic KPIs'),
      variant: 'soft',
      route: 'AcademicAnalytics',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'completionHub',
      title: t('admin_dashboard.completion_hub_title', 'Completion Hub'),
      desc: t('admin_dashboard.completion_hub_desc', 'Six-phase release health and audit'),
      variant: 'soft',
      route: 'AcademicCompletionHub',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'graduation',
      title: t('admin_dashboard.graduation_title', 'Graduation & Completion'),
      desc: t('admin_dashboard.graduation_desc', 'Requirement sets, eligibility, and approval decisions'),
      variant: 'soft',
      route: 'AcademicGraduation',
      icon: (c) => <GraduationCapIcon color={c} />,
    },
    {
      key: 'promotionPolicy',
      title: t('admin_dashboard.promotion_policy_title', 'Promotion & Policy'),
      desc: t('admin_dashboard.promotion_policy_desc', 'Promotion, retention, remedial and probation rules'),
      variant: 'soft',
      route: 'AcademicPolicy',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'documentTemplates',
      title: t('admin_dashboard.document_templates_title', 'Document Templates'),
      desc: t('admin_dashboard.document_templates_desc', 'Report cards, transcripts, COR and certificates'),
      variant: 'soft',
      route: 'DocumentTemplates',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'gradeRelease',
      title: t('admin_dashboard.grade_release_title', 'Grade Release'),
      desc: t('admin_dashboard.grade_release_desc', 'Release and lock finalized grades'),
      variant: 'soft',
      route: 'GradeRelease',
      icon: (c) => <GradebookIcon color={c} />,
    },
    {
      key: 'studentLifecycle',
      title: t('admin_dashboard.student_lifecycle_title', 'Student Lifecycle'),
      desc: t('admin_dashboard.student_lifecycle_desc', 'Transfers, withdrawals, reactivation and archive'),
      variant: 'soft',
      route: 'StudentLifecycle',
      icon: (c) => <PeopleIcon color={c} />,
    },
    {
      key: 'timetableConflicts',
      title: t('admin_dashboard.timetable_conflicts_title', 'Timetable Conflicts'),
      desc: t('admin_dashboard.timetable_conflicts_desc', 'Check room and teacher scheduling conflicts'),
      variant: 'soft',
      route: 'TimetableConflicts',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'attendanceConfig',
      title: t('admin_dashboard.attendance_config_title', 'Attendance Config'),
      desc: t('admin_dashboard.attendance_config_desc', 'Statuses and capture methods for your school'),
      variant: 'soft',
      route: 'AttendanceConfig',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'permissions',
      title: t('admin_dashboard.permissions_title', 'Permissions'),
      desc: t('admin_dashboard.permissions_desc', 'Role capabilities and optional modules'),
      variant: 'soft',
      route: 'Permissions',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'security',
      title: t('admin_dashboard.security_title', 'Security'),
      desc: t('admin_dashboard.security_desc', 'Two-factor authentication and device sessions'),
      variant: 'soft',
      route: 'SecuritySettings',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'orgStructure',
      title: t('admin_dashboard.org_structure_title', 'Org Structure'),
      desc: t('admin_dashboard.org_structure_desc', 'Faculties, colleges, institutes, streams'),
      variant: 'soft',
      route: 'OrgStructure',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'behaviorIncidents',
      title: t('admin_dashboard.behavior_incidents_title', 'Behavior & Discipline'),
      desc: t('admin_dashboard.behavior_incidents_desc', 'School-wide behavior incidents'),
      variant: 'soft',
      route: 'BehaviorIncidents',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'examinations',
      title: t('admin_dashboard.examinations_title', 'Examinations'),
      desc: t('admin_dashboard.examinations_desc', 'Schedule exams and manage grades'),
      variant: 'soft',
      route: 'Examinations',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'studentProgress',
      title: t('admin_dashboard.student_progress_title', 'Student Progress'),
      desc: t('admin_dashboard.student_progress_desc', 'Attendance, grades, behavior, memorization'),
      variant: 'soft',
      route: 'StudentProgress',
      icon: (c) => <IdCardIcon color={c} />,
    },
    {
      key: 'integrationSettings',
      title: t('admin_dashboard.integration_settings_title', 'Integrations'),
      desc: t('admin_dashboard.integration_settings_desc', 'Finance, library and third-party connections'),
      variant: 'soft',
      route: 'IntegrationSettings',
      icon: (c) => <CatalogIcon color={c} />,
    },
    {
      key: 'localizationSettings',
      title: t('admin_dashboard.localization_settings_title', 'Localization'),
      desc: t('admin_dashboard.localization_settings_desc', 'Languages, RTL and translation management'),
      variant: 'soft',
      route: 'LocalizationSettings',
      icon: (c) => <GearIcon color={c} />,
    },
    {
      key: 'authorizationAudit',
      title: t('admin_dashboard.authorization_audit_title', 'Authorization Audit'),
      desc: t('admin_dashboard.authorization_audit_desc', 'Review role access and permission changes'),
      variant: 'soft',
      route: 'AuthorizationAudit',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'analyticsExtended',
      title: t('admin_dashboard.analytics_extended_title', 'Analytics Dashboard'),
      desc: t('admin_dashboard.analytics_extended_desc', 'Extended KPIs and school-wide reporting'),
      variant: 'soft',
      route: 'AnalyticsDashboard',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'notifications',
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
      title: t('admin_dashboard.attendance_title', 'Attendance'),
      desc: t('admin_dashboard.attendance_desc', 'Track daily attendance'),
      variant: 'soft',
      route: 'AdminAttendanceAnalytics',
      icon: (c) => <CalendarIcon color={c} />,
    },
    {
      key: 'studentDocumentRequests',
      title: t('admin_dashboard.student_document_requests_title', 'Document Requests'),
      desc: t('admin_dashboard.student_document_requests_desc', 'Issue or reject student document requests'),
      variant: 'soft',
      route: 'AdminStudentDocuments',
      icon: (c) => <ReportDocIcon color={c} />,
    },
    {
      key: 'alumniApplications',
      title: t('admin_dashboard.alumni_applications_title', 'Alumni Applications'),
      desc: t('admin_dashboard.alumni_applications_desc', 'Review and approve self-service alumni signups'),
      variant: 'soft',
      route: 'AdminAlumniApplications',
      icon: (c) => <AlumniCapIcon color={c} />,
    },
    {
      key: 'studentServiceRequests',
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
      title: t('admin_dashboard.account_settings_title', 'Account Settings'),
      desc: t('admin_dashboard.account_settings_desc', 'Language, theme, privacy and password'),
      variant: 'soft',
      route: 'AccountSettings',
      icon: (c) => <GearIcon color={c} />,
    },
  ]
    .filter((item) => !(isOrphanSchool && ACADEMIC_ADMIN_TILE_KEYS.has(item.key)))
    .filter((item) => !HIDDEN_FOR_NOW_KEYS.has(item.key));

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
            // Real data via admin_orphan_report_overview, restored after a
            // later merge silently reverted this to the old static
            // placeholder card (no live counts). See MuslimEdu-Status-8.
            <MonthlyReportsCard token={token} />
          ) : null}
        </View>

        {/* White body panel - rounded top edge rides up over the dark layer */}
        <View style={styles.body}>
          <SyncStatusCard />
          <Text style={styles.sectionLabel}>{t('admin_dashboard.manage_section', 'Manage')}</Text>
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
                      Alert.alert(
                        t('admin_dashboard.locked_title', 'Locked'),
                        item.lockedMessage ?? t('admin_dashboard.locked_default_message', 'This feature is currently locked.'),
                      );
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
                      <ArrowRightIcon color={fg} size={16} />
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
  cardIconSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },
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
  cardArrowSoft: { backgroundColor: 'rgba(31,174,100,0.12)' },
});
