import type { AuthUser } from '../services/authService';

/**
 * Single source of truth for "does this user belong to an orphan school?".
 *
 * Two independent signals reach the client and neither is guaranteed to be
 * present on every role/token:
 *
 *  - `institution_type === 'orphanage'` - the school's type, chosen in the
 *    Academic Setup wizard. Authoritative, but only as fresh as the cached
 *    user object (a session issued before the wizard existed has it
 *    undefined).
 *  - `is_orphan` - set per user by the backend for every member of an orphan
 *    school (admin, teacher and child alike - that's why AdmissionScreen and
 *    StudentListScreen use it to switch to "children" wording, and why
 *    ReportsRouter uses it to route all three roles to a monthly report).
 *
 * Screens used to test these ad hoc - AdminDashboard on institution_type
 * only, TeacherDashboard on *both* (so a single missing field re-exposed the
 * entire academic subsystem), StudentDashboard/AdmissionScreen on is_orphan
 * only. Either signal alone is enough to mean "orphan school", so treat them
 * as an OR and check it in exactly one place.
 */
export function isOrphanSchoolUser(user: Partial<AuthUser> | null | undefined): boolean {
  if (!user) return false;
  return user.institution_type === 'orphanage' || user.is_orphan === true;
}

/**
 * Quran memorization tracking (surah, juz, memorization status) is scoped
 * to Markaz schools only - explicitly not Madrasa/Mahad/Regular/Orphanage,
 * per admin request ("Quran tracker only on markaz can access, not other
 * than that"). Checked in two places: AdminDashboard's tile visibility,
 * and StudentProgressScreen's own render (the backstop - a teacher can
 * still reach that screen via TeacherDashboard's generic "Student
 * Progress" tile regardless of school type, so the memorization section
 * itself has to gate on this too, not just the menu entry point).
 */
export function isQuranTrackingSchoolUser(user: Partial<AuthUser> | null | undefined): boolean {
  if (!user) return false;
  return user.institution_type === 'markaz';
}

/**
 * Root-stack routes that don't apply to an orphan school - the academic
 * subsystem (classes, sections, subjects, curriculum, timetable, attendance,
 * grading, exams, assessments, lesson plans, materials, graduation/promotion,
 * enrollment) plus a handful of admin-only settings screens that are either
 * academic-flavored (student numbering/ID/lifecycle - see below) or simply
 * don't apply where there's no fee/document/service-request pipeline built
 * around a student body organized into classes.
 *
 * Deliberately excludes routes also reached by non-admin roles for reasons
 * that have nothing to do with academics - `SecuritySettings`, `Notifications`
 * and `AccountSettings` are personal to every user (2FA, alerts, profile) and
 * orphan-school teachers/students still need them; gating the route would
 * take those away along with the admin-only academic content.
 *
 * This is the backstop behind the per-dashboard hiding: tiles/cards are
 * filtered out of the menus, and anything that still reaches one of these
 * routes (a stale navigation state restored after the school type changed, a
 * deep link, a card added later without the orphan check) lands on the
 * unavailable screen instead of a half-broken academic screen.
 */
export const ACADEMIC_ROUTES: ReadonlySet<string> = new Set([
  // Classes / sections / org structure
  'AdminClassTeacherAssign',
  'AdminClassSubjects',
  'ClassList',
  'ClassDetail',
  'CreateClass',
  'EditClass',
  'SectionList',
  'SectionForm',
  'SectionStudents',
  'TeacherMyClasses',
  'TeacherClassStudents',
  'DepartmentList',
  'DepartmentForm',
  'CampusList',
  'CampusForm',
  'GradeLevelList',
  'GradeLevelForm',
  'OrgStructure',
  'AcademicFacilities',
  // Curriculum / catalog / subject loading
  'CurriculumList',
  'CurriculumForm',
  'CurriculumVersions',
  'ProgramsCatalog',
  'ProgramForm',
  'SubjectForm',
  'SubjectLoadingQueue',
  'SubjectLoadingBuilder',
  'SubjectLoadingDetail',
  'LoadPolicy',
  'StudentSubjectLoad',
  // Academic year / calendar / timetable
  'AcademicYears',
  'AcademicYearForm',
  'AcademicTerms',
  'AcademicTermForm',
  'AcademicCalendar',
  'AcademicSchedule',
  'AdminSchedule',
  'StudentSchedule',
  'TeacherMySchedule',
  'TimetableConflicts',
  // Attendance
  'AttendanceConfig',
  'TeacherAttendanceClasses',
  'AttendanceMethodChooser',
  'TeacherAttendanceRoster',
  'AttendanceScan',
  'TeacherAttendanceHistory',
  'AdminAttendanceAnalytics',
  // Student ID/QR cards - built to power the QR/ID-scan attendance method
  // above, so it follows the same orphan-hidden scope.
  'StudentIdCards',
  'StudentIdCard',
  'IdCardTemplate',
  // Grading / gradebook / exams
  'GradingSystems',
  'GradingSystemForm',
  'GradeScaleBuilder',
  'GradeRelease',
  'AdminExamCategories',
  'AdminGradebookReview',
  'TeacherGradebookClasses',
  'TeacherGradebookRoster',
  'Examinations',
  // Assessments / lesson plans / materials / announcements
  'TeacherAssessments',
  'TeacherAssessmentGrading',
  'TeacherAssessmentGrades',
  'AdminAssessmentReview',
  'AdminAssessmentGrades',
  'StudentAssessments',
  'StudentAssessmentGrades',
  'TeacherLessonPlans',
  'AdminLessonPlanReview',
  'TeacherMaterials',
  'AdminMaterialsReview',
  'StudentMaterials',
  'TeacherAnnouncements',
  'AdminAnnouncementReview',
  'StudentAnnouncements',
  // Progress / analytics / completion
  'AcademicHub',
  'AcademicAnalytics',
  'AcademicCompletionHub',
  'AcademicGraduation',
  'AcademicPolicy',
  'AnalyticsDashboard',
  'StudentProgress',
  'MyProgress',
  'DocumentTemplates',
  'BehaviorIncidents',
  // Enrollment pipeline (orphan children are never enrolled through it -
  // see the enrollment gate in MainTabs and the wizard's skipped steps)
  'EnrollmentStages',
  'EnrollmentStageForm',
  'EnrollmentWorkflowList',
  'EnrollmentWorkflowDetail',
  'EnrollmentStatus',
  // Student numbering/ID/lifecycle - built around campus/department/academic
  // year codes and class-to-class transfers, none of which exist for an
  // orphan school. Orphan admission already uses a completely different,
  // separate code scheme (a locked school_code prefix + admin-typed suffix,
  // set up via SchoolCodeSetupScreen and applied in AdmissionScreen), so
  // these config screens don't describe how orphan child codes are actually
  // built and would only mislead the admin.
  'StudentNumberConfig',
  'StudentIdConfig',
  'StudentLifecycle',
  // Admin-only settings with nothing to configure for an orphan school - no
  // fee-collection/document-request/service-ticket pipeline tied to a
  // student-in-classes model, no cross-role permission matrix to speak of
  // beyond the three fixed roles, no localization/integration surface unique
  // to this school type.
  'Permissions',
  'IntegrationSettings',
  'LocalizationSettings',
  'AuthorizationAudit',
  'AdminStudentDocuments',
  'AdminStudentServices',
  // Cashier (accountant) role + fee management - orphan schools have no
  // tuition fees to collect (sponsorship payments are the separate,
  // already-existing admin_sponsorship_payment_* flow), so there's nothing
  // for a Cashier account or the fee screens to do there.
  'AdminFeeReports',
  'RecordFeePayment',
  'CashierAccounts',
  // Registrar role - orphan schools have no enrollment pipeline (see
  // EnrollmentStages/EnrollmentWorkflowList above, already hidden), so a
  // Registrar account has nothing to do there either.
  'RegistrarAccounts',
]);

/** Admin dashboard tile keys that map onto the routes above. */
export const ACADEMIC_ADMIN_TILE_KEYS: ReadonlySet<string> = new Set([
  'classes', 'classSchedule', 'academicSetup', 'gradingSystems', 'examCategories',
  'gradebookReview', 'announcementReview', 'lessonPlanReview',
  'assessmentReview', 'assessmentGrades', 'materialsReview',
  'programsSubjects', 'timetableConflicts', 'attendanceConfig',
  'academicFacilities', 'academicSchedule', 'academicCalendar',
  'academicAnalytics', 'completionHub', 'graduation', 'promotionPolicy',
  'documentTemplates', 'gradeRelease', 'orgStructure', 'behaviorIncidents',
  'examinations', 'studentProgress', 'analyticsExtended', 'attendance',
  'enrollment', 'studentNumbers', 'studentIdRules', 'studentLifecycle',
  'permissions', 'integrationSettings', 'localizationSettings',
  'authorizationAudit', 'fees', 'studentDocumentRequests',
  'studentServiceRequests', 'cashiers', 'registrars', 'idCards',
  // Tile only, not the shared 'Notifications' route: the admin card is
  // specifically "academic updates, grade releases and schedule changes",
  // but the same screen also serves the personal notification bell on the
  // teacher/student dashboards, which orphan-school members still need.
  'notifications',
]);
