import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import './Layout.css';

export default function AppShell() {
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleSyncStatus = (status: string) => {
      setIsSyncing(status === 'syncing');
    };
    (window as unknown as Record<string, unknown>).__setSyncStatus = handleSyncStatus;
    return () => {
      delete (window as unknown as Record<string, unknown>).__setSyncStatus;
    };
  }, []);

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <header className="main-header">
          <div className="main-header-left mobile-only">
            <div className="mobile-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              </svg>
              <span>Task Manager</span>
            </div>
          </div>
          <div className="main-header-right">
          </div>
        </header>
        <div className="main-body">
          <Outlet />
        </div>
      </main>
      <MobileNav />
      {isSyncing && (
        <div className="global-sync-overlay">
          <div className="global-sync-spinner"></div>
          <p>동기화 중입니다...</p>
        </div>
      )}
    </div>
  );
}
