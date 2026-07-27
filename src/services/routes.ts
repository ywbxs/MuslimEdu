/**
 * Single source of truth for backend route names used by the app.
 *
 * Why: the contract diff tool (tools/contract/route_contract_diff.mjs) scans
 * string literals. Declaring every route name here makes the diff exact and
 * makes a dead call a build failure instead of a runtime 404.
 *
 * Rule: a service file must never inline a route name. Import it from here.
 * The three known broken contracts are marked so they cannot be forgotten.
 */

export const ROUTES = {
  auth: {
    login: 'auth_login',
    me: 'me',
    logout: 'auth_logout',
  },

  // TODO(F1): these three are referenced by screens but not registered in
  // routes/api.php. Implement the backend route or delete the caller.
  unresolved: {
    adminScheduleDelete: 'admin_schedule_delete',
    mySchedules: 'my_schedules',
    adminAttendanceTrend: 'admin_academic_analytics_attendance_trend',
  },
} as const;

export type RouteName = string;
