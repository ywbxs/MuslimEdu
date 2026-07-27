#!/usr/bin/env bash
set -e
ROOT="${1:-.}"
cd "$ROOT"
required=(
  src/screens/student/StudentIdentityScreen.tsx
  src/screens/teachers/AcademicFacilitiesScreen.tsx
  src/screens/teachers/AcademicScheduleScreen.tsx
  src/screens/teachers/AcademicCalendarScreen.tsx
  src/screens/teachers/AcademicAnalyticsScreen.tsx
  src/screens/teachers/AcademicCompletionHubScreen.tsx
  src/services/studentIdentityService.ts
  src/services/academicFacilitiesService.ts
  src/services/academicScheduleService.ts
  src/services/academicCalendarService.ts
  src/services/academicAnalyticsService.ts
  src/services/academicCompletionService.ts
)
for f in "${required[@]}"; do test -f "$f" || { echo "missing: $f"; exit 1; }; done
for route in StudentIdentity AcademicFacilities AcademicSchedule AcademicCalendar AcademicAnalytics AcademicCompletionHub; do grep -q "name=\"$route\"" src/navigation/RootNavigator.tsx || { echo "missing route: $route"; exit 1; }; done
grep -q "StudentIdentity" src/screens/dashboards/StudentDashboard.tsx || { echo "missing student identity entry"; exit 1; }
for route in AcademicFacilities AcademicSchedule AcademicCalendar AcademicAnalytics AcademicCompletionHub; do grep -q "route: '$route'" src/screens/dashboards/AdminDashboard.tsx || { echo "missing admin entry: $route"; exit 1; }; done
npm run typecheck
echo "MuslimEdu integration verification passed."
