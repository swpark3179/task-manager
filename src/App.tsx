import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppearanceProvider } from './contexts/AppearanceContext';
import AppShell from './components/layout/AppShell';
import LoginPage from './components/auth/LoginPage';
import SignUpPage from './components/auth/SignUpPage';
import TodayPage from './pages/TodayPage';
import HistoryPage from './pages/HistoryPage';
import CalendarPage from './pages/CalendarPage';
import SettingsPage from './pages/SettingsPage';
import DashboardPage from './pages/DashboardPage';
import ActivityReportPage from './pages/ActivityReportPage';
import DetailPage from './pages/DetailPage';
import SyncBlocker from './components/common/SyncBlocker';
import { isMobilePlatform } from './lib/runtimeWindow';
import './index.css';

function AppRoutes() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'login' | 'signup'>('login');
  const [isMobile, setIsMobile] = useState(() => isMobilePlatform());

  useEffect(() => {
    setIsMobile(isMobilePlatform());
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)',
      }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) {
    return authView === 'login' ? (
      <LoginPage onSwitchToSignUp={() => setAuthView('signup')} />
    ) : (
      <SignUpPage onSwitchToLogin={() => setAuthView('login')} />
    );
  }

  return (
    <Routes>
      <Route path="/dashboard" element={isMobile ? <Navigate to="/" replace /> : <DashboardPage />} />
      <Route path="/activity-report" element={isMobile ? <Navigate to="/" replace /> : <ActivityReportPage />} />
      <Route path="/detail" element={<DetailPage />} />
      <Route element={<AppShell />}>
        <Route path="/" element={<TodayPage />} />
        <Route path="/history/:date" element={<HistoryPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppearanceProvider>
        <AuthProvider>
          <AppRoutes />
          <SyncBlocker />
        </AuthProvider>
      </AppearanceProvider>
    </HashRouter>
  );
}
