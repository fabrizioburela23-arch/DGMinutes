/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import InterpreterDashboard from './pages/InterpreterDashboard';
import MasterDashboard from './pages/MasterDashboard';

function ProtectedRoute({ children, allowedRole }: { children: React.ReactNode, allowedRole?: 'interpreter' | 'master' }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={user.role === 'master' ? '/master' : '/dashboard'} />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'master' ? '/master' : '/dashboard'} /> : <Login />} />
      <Route path="/register" element={user ? <Navigate to={user.role === 'master' ? '/master' : '/dashboard'} /> : <Register />} />
      <Route path="/dashboard" element={<ProtectedRoute allowedRole="interpreter"><InterpreterDashboard /></ProtectedRoute>} />
      <Route path="/master" element={<ProtectedRoute allowedRole="master"><MasterDashboard /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to={user ? (user.role === 'master' ? '/master' : '/dashboard') : '/login'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
