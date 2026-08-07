import React from 'react';
import { UserRole } from '../services/authService';
import AdminDashboard from '../screens/dashboards/AdminDashboard';
import StudentDashboard from '../screens/dashboards/StudentDashboard';
import TeacherDashboard from '../screens/dashboards/TeacherDashboard';
import CashierDashboard from '../screens/dashboards/CashierDashboard';
import RegistrarDashboard from '../screens/dashboards/RegistrarDashboard';
import PlaceholderDashboard from '../screens/dashboards/PlaceholderDashboard';
import SuperAdminDashboard from '../screens/dashboards/SuperAdminDashboard';

/**
 * Maps each role to the component that should render as their dashboard.
 *
 * The Menu tab (see MenuScreen.tsx) renders this directly - there's no
 * separate "My Dashboard" page anymore. `footer` is the profile card +
 * log out button, appended to the bottom of whichever dashboard renders.
 *
 * To add a real dashboard for a new role later:
 *   1. Build the screen in src/screens/dashboards/<Role>Dashboard.tsx
 *      (copy AdminDashboard.tsx as the starting pattern, accept a `footer`
 *      prop and render it at the bottom of the scroll content)
 *   2. Import it above
 *   3. Replace its line below with <YourDashboard footer={footer} />
 */
export function getDashboardForRole(role: UserRole, footer?: React.ReactNode): React.ReactElement {
  switch (role) {
    case 'admin':
      return <AdminDashboard footer={footer} />;

    case 'superadmin':
      return <SuperAdminDashboard footer={footer} />;

    case 'teacher':
      return <TeacherDashboard footer={footer} />;

    case 'student':
      return <StudentDashboard footer={footer} />;

    case 'parent':
      return <PlaceholderDashboard roleLabel="Parent" footer={footer} />;

    case 'accountant':
      return <CashierDashboard footer={footer} />;

    case 'registrar':
      return <RegistrarDashboard footer={footer} />;

    case 'librarian':
      return <PlaceholderDashboard roleLabel="Librarian" footer={footer} />;

    case 'warden':
      return <PlaceholderDashboard roleLabel="Warden" footer={footer} />;

    case 'alumni':
      return <PlaceholderDashboard roleLabel="Alumni" footer={footer} />;

    default:
      // Covers any future role_id/role added on the backend that the app
      // doesn't have a specific mapping for yet - shows a generic screen
      // instead of crashing.
      return <PlaceholderDashboard roleLabel={role || 'Account'} footer={footer} />;
  }
}
