import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Pages (lazy loaded sẽ thêm sau)
import LoginPage from '../pages/LoginPage/LoginPage';
import DashboardPage from '../pages/DashboardPage/DashboardPage';
import ControlPage from '../pages/ControlPage/ControlPage';
import SchedulePage from '../pages/SchedulePage/SchedulePage';
import AIPage from '../pages/AIPage/AIPage';
import NotificationPage from '../pages/NotificationPage/NotificationPage';
import SettingsPage from '../pages/SettingsPage/SettingsPage';
import UserManagementPage from '../pages/UserManagementPage/UserManagementPage';

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardPage /></ProtectedRoute>
      } />
      <Route path="/control" element={
        <ProtectedRoute><ControlPage /></ProtectedRoute>
      } />
      <Route path="/schedule" element={
        <ProtectedRoute><SchedulePage /></ProtectedRoute>
      } />
      <Route path="/ai" element={
        <ProtectedRoute><AIPage /></ProtectedRoute>
      } />
      <Route path="/notifications" element={
        <ProtectedRoute><NotificationPage /></ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute><SettingsPage /></ProtectedRoute>
      } />

      {/* Admin */}
      <Route path="/admin/users" element={
        <ProtectedRoute requiredRole="admin"><UserManagementPage /></ProtectedRoute>
      } />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
