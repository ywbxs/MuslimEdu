import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import StudentListScreen from '../screens/students/StudentListScreen';
import OrphanReportScreen from '../screens/orphan/OrphanReportScreen';
import AdminOrphanOverviewScreen from '../screens/orphan/AdminOrphanOverviewScreen';
import AdminChildReportDetailScreen from '../screens/orphan/AdminChildReportDetailScreen';
import TeacherOrphanChildrenOverviewScreen from '../screens/orphan/TeacherOrphanChildrenOverviewScreen';
import TeacherOrphanChildReportDetailScreen from '../screens/orphan/TeacherOrphanChildReportDetailScreen';
import AdminTeacherListScreen from '../screens/teachers/AdminTeacherListScreen';
import AdminTeacherReportDetailScreen from '../screens/teachers/AdminTeacherReportDetailScreen';
import AdminTeacherProfileScreen from '../screens/teachers/AdminTeacherProfileScreen';
import AdminUserDocumentsScreen from '../screens/teachers/AdminUserDocumentsScreen';
import TeacherMyScheduleScreen from '../screens/teachers/TeacherMyScheduleScreen';
import TeacherClassStudentsScreen from '../screens/teachers/TeacherClassStudentsScreen';
import AdminClassTeacherAssignScreen from '../screens/teachers/AdminClassTeacherAssignScreen';
import AdminClassSubjectsScreen from '../screens/teachers/AdminClassSubjectsScreen';
import DepartmentListScreen from '../screens/teachers/DepartmentListScreen';
import DepartmentFormScreen from '../screens/teachers/DepartmentFormScreen';
import CampusListScreen from '../screens/teachers/CampusListScreen';
import CampusFormScreen from '../screens/teachers/CampusFormScreen';
import GradeLevelListScreen from '../screens/teachers/GradeLevelListScreen';
import GradeLevelFormScreen from '../screens/teachers/GradeLevelFormScreen';
import CurriculumListScreen from '../screens/teachers/CurriculumListScreen';
import CurriculumFormScreen from '../screens/teachers/CurriculumFormScreen';
import CurriculumVersionsScreen from '../screens/teachers/CurriculumVersionsScreen';
import SectionListScreen from '../screens/teachers/SectionListScreen';
import SectionFormScreen from '../screens/teachers/SectionFormScreen';
import SectionStudentsScreen from '../screens/teachers/SectionStudentsScreen';
import ClassListScreen from '../screens/teachers/ClassListScreen';
import ClassDetailScreen from '../screens/teachers/ClassDetailScreen';
import CreateClassScreen from '../screens/teachers/CreateClassScreen';
import TeacherAttendanceClassesScreen from '../screens/teachers/TeacherAttendanceClassesScreen';
import AttendanceMethodChooserScreen from '../screens/teachers/AttendanceMethodChooserScreen';
import TeacherAttendanceRosterScreen from '../screens/teachers/TeacherAttendanceRosterScreen';
import AttendanceScanScreen from '../screens/teachers/AttendanceScanScreen';
import TeacherAttendanceHistoryScreen from '../screens/teachers/TeacherAttendanceHistoryScreen';
import AdminAttendanceAnalyticsScreen from '../screens/teachers/AdminAttendanceAnalyticsScreen';
import StudentIdCardScreen from '../screens/student/StudentIdCardScreen';
import StudentIdCardsScreen from '../screens/admin/StudentIdCardsScreen';
import StaffIdCardsScreen from '../screens/admin/StaffIdCardsScreen';
import IdCardTemplateScreen from '../screens/admin/IdCardTemplateScreen';
import TeacherGradebookClassesScreen from '../screens/teachers/TeacherGradebookClassesScreen';
import TeacherGradebookRosterScreen from '../screens/teachers/TeacherGradebookRosterScreen';
import AdminGradebookReviewScreen from '../screens/teachers/AdminGradebookReviewScreen';
import AdminExamCategoriesScreen from '../screens/teachers/AdminExamCategoriesScreen';
import TeacherAnnouncementsScreen from '../screens/teachers/TeacherAnnouncementsScreen';
import AdminAnnouncementReviewScreen from '../screens/teachers/AdminAnnouncementReviewScreen';
import TeacherMaterialsScreen from '../screens/teachers/TeacherMaterialsScreen';
import AdminMaterialsReviewScreen from '../screens/teachers/AdminMaterialsReviewScreen';
import TeacherLessonPlansScreen from '../screens/teachers/TeacherLessonPlansScreen';
import AdminLessonPlanReviewScreen from '../screens/teachers/AdminLessonPlanReviewScreen';
import TeacherAssessmentsScreen from '../screens/teachers/TeacherAssessmentsScreen';
import TeacherAssessmentGradingScreen from '../screens/teachers/TeacherAssessmentGradingScreen';
import AdminAssessmentReviewScreen from '../screens/teachers/AdminAssessmentReviewScreen';
import StudentAssessmentsScreen from '../screens/student/StudentAssessmentsScreen';
import TeacherAssessmentGradesScreen from '../screens/teachers/TeacherAssessmentGradesScreen';
import AdminAssessmentGradesScreen from '../screens/teachers/AdminAssessmentGradesScreen';
import StudentAssessmentGradesScreen from '../screens/student/StudentAssessmentGradesScreen';
import StudentAnnouncementsScreen from '../screens/student/StudentAnnouncementsScreen';
import StudentMaterialsScreen from '../screens/student/StudentMaterialsScreen';
import StudentScheduleScreen from '../screens/student/StudentScheduleScreen';
import AdmissionScreen from '../screens/admin/AdmissionScreen';
import EnrollmentStagesScreen from '../screens/admin/EnrollmentStagesScreen';
import EnrollmentStageFormScreen from '../screens/admin/EnrollmentStageFormScreen';
import EnrollmentWorkflowListScreen from '../screens/admin/EnrollmentWorkflowListScreen';
import EnrollmentWorkflowDetailScreen from '../screens/admin/EnrollmentWorkflowDetailScreen';
import EnrollmentFeeTypesScreen from '../screens/admin/EnrollmentFeeTypesScreen';
import EnrollmentFeeTypeFormScreen from '../screens/admin/EnrollmentFeeTypeFormScreen';
import SetupChecklistScreen from '../screens/admin/SetupChecklistScreen';
import SyncStatusScreen from '../screens/common/SyncStatusScreen';
import StudentReportScreen from '../screens/common/StudentReportScreen';
import EnrollmentStatusScreen from '../screens/student/EnrollmentStatusScreen';
import AcademicHubScreen from '../screens/student/AcademicHubScreen';
import AcademicYearsScreen from '../screens/admin/AcademicYearsScreen';
import AcademicYearFormScreen from '../screens/admin/AcademicYearFormScreen';
import AcademicTermsScreen from '../screens/admin/AcademicTermsScreen';
import AcademicTermFormScreen from '../screens/admin/AcademicTermFormScreen';
import InstitutionProfileScreen from '../screens/admin/InstitutionProfileScreen';
import GradingSystemsScreen from '../screens/admin/GradingSystemsScreen';
import GradingSystemFormScreen from '../screens/admin/GradingSystemFormScreen';
import GradeScaleBuilderScreen from '../screens/admin/GradeScaleBuilderScreen';
import ProgramsCatalogScreen from '../screens/admin/ProgramsCatalogScreen';
import ProgramFormScreen from '../screens/admin/ProgramFormScreen';
import StudentIdentityScreen from '../screens/student/StudentIdentityScreen';
import AcademicFacilitiesScreen from '../screens/teachers/AcademicFacilitiesScreen';
import BuildingFormScreen from '../screens/teachers/BuildingFormScreen';
import RoomFormScreen from '../screens/teachers/RoomFormScreen';
import AcademicCalendarScreen from '../screens/teachers/AcademicCalendarScreen';
import AcademicAnalyticsScreen from '../screens/teachers/AcademicAnalyticsScreen';
import AcademicCompletionHubScreen from '../screens/teachers/AcademicCompletionHubScreen';
import SubjectFormScreen from '../screens/admin/SubjectFormScreen';
import ChatBoxScreen from '../screens/chat/ChatBoxScreen';
import CreatePostScreen from '../screens/common/CreatePostScreen';
import PostCommentsScreen from '../screens/common/PostCommentsScreen';
import ImageViewerScreen from '../screens/common/ImageViewerScreen';
import MainTabs from './MainTabs';
import AppLaunchSkeleton from '../components/AppLaunchSkeleton';

// SUBJECT_LOADING_ROUTES imports
import SubjectLoadingQueueScreen from '../screens/admin/SubjectLoadingQueueScreen';
import SubjectLoadingBuilderScreen from '../screens/admin/SubjectLoadingBuilderScreen';
import SubjectLoadingDetailScreen from '../screens/admin/SubjectLoadingDetailScreen';
import LoadPolicyScreen from '../screens/admin/LoadPolicyScreen';
import StudentSubjectLoadScreen from '../screens/student/StudentSubjectLoadScreen';
// Previously-built admin screens that existed on disk but were never
// registered on the navigator, so they were unreachable from the app even
// though their services/backend contracts work. Wiring them up, not
// rebuilding them.
import AcademicGraduationScreen from '../screens/admin/AcademicGraduationScreen';
import AcademicPolicyScreen from '../screens/admin/AcademicPolicyScreen';
import AdminClassScheduleScreen from '../screens/admin/AdminClassScheduleScreen';
import AnalyticsDashboardScreen from '../screens/admin/AnalyticsDashboardScreen';
import AuthorizationAuditScreen from '../screens/admin/AuthorizationAuditScreen';
import DocumentTemplateScreen from '../screens/admin/DocumentTemplateScreen';
import GradeReleaseScreen from '../screens/admin/GradeReleaseScreen';
import IntegrationSettingsScreen from '../screens/admin/IntegrationSettingsScreen';
import LocalizationSettingsScreen from '../screens/admin/LocalizationSettingsScreen';
import StudentStaffCodeSetupScreen from '../screens/admin/StudentStaffCodeSetupScreen';
import AttendanceConfigScreen from '../screens/admin/AttendanceConfigScreen';
import PermissionsScreen from '../screens/admin/PermissionsScreen';
import SecuritySettingsScreen from '../screens/admin/SecuritySettingsScreen';
import OrgStructureScreen from '../screens/admin/OrgStructureScreen';
import BehaviorIncidentsScreen from '../screens/admin/BehaviorIncidentsScreen';
import ExaminationsScreen from '../screens/admin/ExaminationsScreen';
import StudentProgressScreen from '../screens/admin/StudentProgressScreen';
import MyProgressScreen from '../screens/student/StudentProgressScreen';
import StudentLifecycleScreen from '../screens/admin/StudentLifecycleScreen';
import TimetableConflictScreen from '../screens/admin/TimetableConflictScreen';
import CommunicationScreen from '../screens/common/CommunicationScreen';
import StudentPortalHomeScreen from '../screens/student/StudentPortalHomeScreen';
// M5 student portal - documents, services, settings (routed this phase;
// backend already existed, see StudentPortalController).
import StudentDocumentsScreen from '../screens/student/StudentDocumentsScreen';
import StudentServicesScreen from '../screens/student/StudentServicesScreen';
import StudentDocumentRequestsScreen from '../screens/admin/StudentDocumentRequestsScreen';
import StudentServiceRequestsScreen from '../screens/admin/StudentServiceRequestsScreen';
import AccountSettingsScreen from '../screens/common/AccountSettingsScreen';
import EditProfileScreen from '../screens/common/EditProfileScreen';
import AdminFeeReportsScreen from '../screens/admin/AdminFeeReportsScreen';
import RecordFeePaymentScreen from '../screens/admin/RecordFeePaymentScreen';
import CashierAccountsScreen from '../screens/admin/CashierAccountsScreen';
import CashierProfileScreen from '../screens/admin/CashierProfileScreen';
import RegistrarAccountsScreen from '../screens/admin/RegistrarAccountsScreen';
import AcademicUnavailableScreen from '../screens/common/AcademicUnavailableScreen';
import SchoolListScreen from '../screens/superadmin/SchoolListScreen';
import SchoolAdminsScreen from '../screens/superadmin/SchoolAdminsScreen';
import ApiLockerScreen from '../screens/superadmin/ApiLockerScreen';
import BackendStatusScreen from '../screens/superadmin/BackendStatusScreen';
import PostModerationScreen from '../screens/superadmin/PostModerationScreen';
import TrashScreen from '../screens/superadmin/TrashScreen';
import ActivityLogScreen from '../screens/superadmin/ActivityLogScreen';
import { ACADEMIC_ROUTES, isOrphanSchoolUser } from '../utils/orphanSchool';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // While the saved-session check runs, show a skeleton shell instead of a
  // blank/spinner screen - same perceived wait, but it reads as "loading
  // content" rather than "app is stuck", and there's no hard flash once
  // the real screen fades in.
  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
  }, [isLoading, fadeAnim]);

  if (isLoading) {
    return <AppLaunchSkeleton />;
  }

  // Orphan schools have no academic subsystem at all. The dashboards already
  // leave those cards out of their menus, but that only covers the entry
  // points we know about - a restored navigation state, a card added later
  // without the check, or a screen reached from another screen would still
  // push a class/grading/enrollment screen with nothing behind it. Guarding
  // the routes themselves closes the whole set in one place.
  const hideAcademic = isOrphanSchoolUser(user);

  return (
    <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{ headerShown: false, animation: 'fade' }}
          screenLayout={({ route, navigation: screenNavigation, children }) =>
            hideAcademic && ACADEMIC_ROUTES.has(route.name) ? (
              <AcademicUnavailableScreen
                onBack={screenNavigation.canGoBack() ? () => screenNavigation.goBack() : undefined}
              />
            ) : (
              children
            )
          }
        >
          {user ? (
            <>
              <Stack.Screen name="MainTabs" component={MainTabs} options={{ animation: 'fade' }} />
              <Stack.Screen
                name="StudentsList"
                component={StudentListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Admission"
                component={AdmissionScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="OrphanReport"
                component={OrphanReportScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminOrphanOverview"
                component={AdminOrphanOverviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminChildReportDetail"
                component={AdminChildReportDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherOrphanChildrenOverview"
                component={TeacherOrphanChildrenOverviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherOrphanChildReportDetail"
                component={TeacherOrphanChildReportDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminTeacherList"
                component={AdminTeacherListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminTeacherReportDetail"
                component={AdminTeacherReportDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminTeacherProfile"
                component={AdminTeacherProfileScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherMySchedule"
                component={TeacherMyScheduleScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherClassStudents"
                component={TeacherClassStudentsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminClassTeacherAssign"
                component={AdminClassTeacherAssignScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentStages"
                component={EnrollmentStagesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentStageForm"
                component={EnrollmentStageFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentWorkflowList"
                component={EnrollmentWorkflowListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentWorkflowDetail"
                component={EnrollmentWorkflowDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentFeeTypes"
                component={EnrollmentFeeTypesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentFeeTypeForm"
                component={EnrollmentFeeTypeFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SetupChecklist"
                component={SetupChecklistScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SyncStatus"
                component={SyncStatusScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentReport"
                component={StudentReportScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EnrollmentStatus"
                component={EnrollmentStatusScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AcademicHub"
                component={AcademicHubScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="GradingSystems"
                component={GradingSystemsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="GradingSystemForm"
                component={GradingSystemFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="GradeScaleBuilder"
                component={GradeScaleBuilderScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ProgramsCatalog"
                component={ProgramsCatalogScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ProgramForm"
                component={ProgramFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SubjectForm"
                component={SubjectFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AcademicYears"
                component={AcademicYearsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AcademicYearForm"
                component={AcademicYearFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AcademicTerms"
                component={AcademicTermsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AcademicTermForm"
                component={AcademicTermFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="InstitutionProfile"
                component={InstitutionProfileScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminClassSubjects"
                component={AdminClassSubjectsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="DepartmentList"
                component={DepartmentListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="DepartmentForm"
                component={DepartmentFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CampusList"
                component={CampusListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CampusForm"
                component={CampusFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="GradeLevelList"
                component={GradeLevelListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="GradeLevelForm"
                component={GradeLevelFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CurriculumList"
                component={CurriculumListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CurriculumForm"
                component={CurriculumFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CurriculumVersions"
                component={CurriculumVersionsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SectionList"
                component={SectionListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SectionForm"
                component={SectionFormScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="SectionStudents"
                component={SectionStudentsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ClassList"
                component={ClassListScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ClassDetail"
                component={ClassDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CreateClass"
                component={CreateClassScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="EditClass"
                component={CreateClassScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAttendanceClasses"
                component={TeacherAttendanceClassesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AttendanceMethodChooser"
                component={AttendanceMethodChooserScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAttendanceRoster"
                component={TeacherAttendanceRosterScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AttendanceScan"
                component={AttendanceScanScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAttendanceHistory"
                component={TeacherAttendanceHistoryScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminAttendanceAnalytics"
                component={AdminAttendanceAnalyticsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherGradebookClasses"
                component={TeacherGradebookClassesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherGradebookRoster"
                component={TeacherGradebookRosterScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminGradebookReview"
                component={AdminGradebookReviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminExamCategories"
                component={AdminExamCategoriesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAnnouncements"
                component={TeacherAnnouncementsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminAnnouncementReview"
                component={AdminAnnouncementReviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherMaterials"
                component={TeacherMaterialsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminMaterialsReview"
                component={AdminMaterialsReviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentMaterials"
                component={StudentMaterialsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentSchedule"
                component={StudentScheduleScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherLessonPlans"
                component={TeacherLessonPlansScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminLessonPlanReview"
                component={AdminLessonPlanReviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAssessments"
                component={TeacherAssessmentsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="TeacherAssessmentGrading"
                component={TeacherAssessmentGradingScreen}
                options={{ animation: 'slide_from_right' }}
              />
              {/* These three were written in a prior session
                  ("Assessment weighted grades") but never actually
                  registered here - found while wiring dashboard entry
                  points. Adding them now; see roadmap. */}
              <Stack.Screen
                name="TeacherAssessmentGrades"
                component={TeacherAssessmentGradesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminAssessmentGrades"
                component={AdminAssessmentGradesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentAssessmentGrades"
                component={StudentAssessmentGradesScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminAssessmentReview"
                component={AdminAssessmentReviewScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentAssessments"
                component={StudentAssessmentsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="StudentAnnouncements"
                component={StudentAnnouncementsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="AdminUserDocuments"
                component={AdminUserDocumentsScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="ChatBox"
                component={ChatBoxScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="CreatePost"
                component={CreatePostScreen}
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen
                name="PostComments"
                component={PostCommentsScreen}
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen
                name="ImageViewer"
                component={ImageViewerScreen}
                options={{ animation: 'fade', presentation: 'transparentModal' }}
              />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
              {/* SUBJECT_LOADING_ROUTES */}
      <Stack.Screen name="SubjectLoadingQueue" component={SubjectLoadingQueueScreen} />
      <Stack.Screen name="SubjectLoadingBuilder" component={SubjectLoadingBuilderScreen} />
      <Stack.Screen name="SubjectLoadingDetail" component={SubjectLoadingDetailScreen} />
      <Stack.Screen name="LoadPolicy" component={LoadPolicyScreen} />
      <Stack.Screen name="StudentSubjectLoad" component={StudentSubjectLoadScreen} />
              {/* ADMIN_ADVANCED_ROUTES - previously orphaned screens, now reachable */}
      <Stack.Screen name="AcademicGraduation" component={AcademicGraduationScreen} />
      <Stack.Screen name="AcademicPolicy" component={AcademicPolicyScreen} />
      <Stack.Screen name="AdminSchedule" component={AdminClassScheduleScreen} />
      <Stack.Screen name="AcademicSchedule" component={AdminClassScheduleScreen} />
      <Stack.Screen name="AcademicFacilities" component={AcademicFacilitiesScreen} />
      <Stack.Screen name="BuildingForm" component={BuildingFormScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RoomForm" component={RoomFormScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AnalyticsDashboard" component={AnalyticsDashboardScreen} />
      <Stack.Screen name="AuthorizationAudit" component={AuthorizationAuditScreen} />
      <Stack.Screen name="DocumentTemplates" component={DocumentTemplateScreen} />
      <Stack.Screen name="GradeRelease" component={GradeReleaseScreen} />
      <Stack.Screen name="IntegrationSettings" component={IntegrationSettingsScreen} />
      <Stack.Screen name="LocalizationSettings" component={LocalizationSettingsScreen} />
      <Stack.Screen name="StudentStaffCodeSetup" component={StudentStaffCodeSetupScreen} />
      <Stack.Screen name="AttendanceConfig" component={AttendanceConfigScreen} />
      <Stack.Screen name="Permissions" component={PermissionsScreen} />
      <Stack.Screen name="SecuritySettings" component={SecuritySettingsScreen} />
      <Stack.Screen name="OrgStructure" component={OrgStructureScreen} />
      <Stack.Screen name="BehaviorIncidents" component={BehaviorIncidentsScreen} />
      <Stack.Screen name="Examinations" component={ExaminationsScreen} />
      <Stack.Screen name="StudentProgress" component={StudentProgressScreen} />
      <Stack.Screen name="MyProgress" component={MyProgressScreen} />
      <Stack.Screen name="StudentLifecycle" component={StudentLifecycleScreen} />
      <Stack.Screen name="TimetableConflicts" component={TimetableConflictScreen} />
      <Stack.Screen name="Notifications" component={CommunicationScreen} />
      <Stack.Screen name="StudentPortalHome" component={StudentPortalHomeScreen} />
      <Stack.Screen name="StudentDocuments" component={StudentDocumentsScreen} />
      <Stack.Screen name="StudentServices" component={StudentServicesScreen} />
      <Stack.Screen name="AdminStudentDocuments" component={StudentDocumentRequestsScreen} />
      <Stack.Screen name="AdminStudentServices" component={StudentServiceRequestsScreen} />
      <Stack.Screen name="AdminFeeReports" component={AdminFeeReportsScreen} />
      <Stack.Screen name="RecordFeePayment" component={RecordFeePaymentScreen} />
      <Stack.Screen name="CashierAccounts" component={CashierAccountsScreen} />
      <Stack.Screen name="CashierProfile" component={CashierProfileScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="RegistrarAccounts" component={RegistrarAccountsScreen} />
      <Stack.Screen name="StudentIdCard" component={StudentIdCardScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="StudentIdCards" component={StudentIdCardsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="StaffIdCards" component={StaffIdCardsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="IdCardTemplate" component={IdCardTemplateScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SuperAdminSchoolList" component={SchoolListScreen} />
      <Stack.Screen name="SuperAdminSchoolAdmins" component={SchoolAdminsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SuperAdminApiLocker" component={ApiLockerScreen} />
      <Stack.Screen name="SuperAdminBackendStatus" component={BackendStatusScreen} />
      <Stack.Screen name="SuperAdminPostModeration" component={PostModerationScreen} />
      <Stack.Screen name="SuperAdminTrash" component={TrashScreen} />
      <Stack.Screen name="SuperAdminActivityLog" component={ActivityLogScreen} />
      </Stack.Navigator>
      </NavigationContainer>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
