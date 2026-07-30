import React from 'react';
import { UserRole } from '../services/authService';
import AdminDashboard from '../screens/dashboards/AdminDashboard';
import StudentDashboard from '../screens/dashboards/StudentDashboard';
import PlaceholderDashboard from '../screens/dashboards/PlaceholderDashboard';

/**
 * Maps each role to the component that should render as their dashboard.
 *
 * To add a real dashboard for a new role later:
 *   1. Build the screen in src/screens/dashboards/<Role>Dashboard.tsx
 *      (copy AdminDashboard.tsx as the starting pattern)
 *   2. Import it above
 *   3. Replace its line below with <YourDashboard />
 *
 * Everything else (navigation, header, logout) is handled automatically
 * by DashboardShell - you only write the content specific to that role.
 */
export function getDashboardForRole(role: UserRole): React.ReactElement {
  switch (role) {
    case 'admin':
      return <AdminDashboard />;

    case 'superadmin':
      return <PlaceholderDashboard roleLabel="Super Admin" />;

    case 'teacher':
      return <PlaceholderDashboard roleLabel="Teacher" />;

    case 'student':
      return <StudentDashboard />;

    case 'parent':
      return <PlaceholderDashboard roleLabel="Parent" />;

    case 'accountant':
      return <PlaceholderDashboard roleLabel="Accountant" />;

    case 'librarian':
      return <PlaceholderDashboard roleLabel="Librarian" />;

    case 'warden':
      return <PlaceholderDashboard roleLabel="Warden" />;

    default:
      // Covers any future role_id/role added on the backend that the app
      // doesn't have a specific mapping for yet - shows a generic screen
      // instead of crashing.
      return <PlaceholderDashboard roleLabel={role || 'Account'} />;
  }
}
