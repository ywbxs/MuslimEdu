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
 * Root-stack routes that belong to the academic subsystem - classes,
 * sections, subjects, curriculum, timetable, attendance, grading, exams,
 * assessments, lesson plans, materials, graduation/promotion and the
 * enrollment pipeline. Orphan schools have none of these concepts, so these
 * screens are replaced by a short "not available" screen there.
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
  'TimetableConflicts',
  // Attendance
  'AttendanceConfig',
  'TeacherAttendanceClasses',
  'TeacherAttendanceRoster',
  'TeacherAttendanceHistory',
  'AdminAttendanceAnalytics',
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
]);

/** Admin dashboard tile keys that map onto the academic subsystem above. */
export const ACADEMIC_ADMIN_TILE_KEYS: ReadonlySet<string> = new Set([
  'classes', 'academicSetup', 'gradingSystems', 'examCategories',
  'gradebookReview', 'announcementReview', 'lessonPlanReview',
  'assessmentReview', 'assessmentGrades', 'materialsReview',
  'programsSubjects', 'timetableConflicts', 'attendanceConfig',
  'academicFacilities', 'academicSchedule', 'academicCalendar',
  'academicAnalytics', 'completionHub', 'graduation', 'promotionPolicy',
  'documentTemplates', 'gradeRelease', 'orgStructure', 'behaviorIncidents',
  'examinations', 'studentProgress', 'analyticsExtended', 'attendance',
  'enrollment',
]);
