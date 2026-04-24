import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllDataForExport, forceSync } from '../lib/database';
import { generateMarkdownExport } from '../utils/exportUtils';
import {
  SYNC_INTERVAL_OPTIONS,
  getSyncInterval,
  updateAutoSync,
  getLastSyncLabel,
  getLastSyncTime,
} from '../lib/syncManager';
import {
  ensurePermission,
  hasPermission,
  getNotificationSettings,
  setNotificationSettings,
  rescheduleAll,
  sendTestNotification,
  type NotificationSettings,
} from '../lib/notifications';
import type { ProxySettings } from '../types';
import CategoryManager from '../components/settings/CategoryManager';
import './Pages.css';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [proxyHost, setProxyHost] = useState('');
  const [proxyPort, setProxyPort] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // 동기화 설정
  const [syncInterval, setSyncIntervalState] = useState<number>(0);
  const [lastSyncLabel, setLastSyncLabel] = useState<string>('');

  // 알림 설정
  const [notifSettings, setNotifSettings] = useState<NotificationSettings | null>(null);
  const [notifPermission, setNotifPermission] = useState<boolean>(false);
  const [notifBusy, setNotifBusy] = useState<boolean>(false);
  const [notifTestResult, setNotifTestResult] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 동기화 상태 주기적 갱신
  const refreshSyncLabel = useCallback(() => {
    setLastSyncLabel(getLastSyncLabel());
  }, []);

  useEffect(() => {
    setSyncIntervalState(getSyncInterval());
    refreshSyncLabel();
    const tick = setInterval(refreshSyncLabel, 30_000); // 30초마다 갱신
    return () => clearInterval(tick);
  }, [refreshSyncLabel]);

  // 자동 동기화 주기 변경 핸들러
  const handleSyncIntervalChange = (value: number) => {
    setSyncIntervalState(value);
    updateAutoSync(value);
  };

  // 알림 설정/권한 로드
  useEffect(() => {
    void (async () => {
      const [s, granted] = await Promise.all([getNotificationSettings(), hasPermission()]);
      setNotifSettings(s);
      setNotifPermission(granted);
    })();
  }, []);

  const updateNotif = async (patch: Partial<NotificationSettings>) => {
    setNotifBusy(true);
    try {
      const next = await setNotificationSettings(patch);
      setNotifSettings(next);
      await rescheduleAll();
    } finally {
      setNotifBusy(false);
    }
  };

  const handleRequestNotifPermission = async () => {
    setNotifBusy(true);
    try {
      const granted = await ensurePermission();
      setNotifPermission(granted);
      if (granted) await rescheduleAll();
    } finally {
      setNotifBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    setNotifBusy(true);
    setNotifTestResult('알림을 등록하는 중...');
    try {
      const result = await sendTestNotification();
      if (result.scheduled) {
        setNotifTestResult(
          `✅ 등록 성공 (대기열 ${result.pendingCount}개). 약 10초 뒤 알림이 표시됩니다. iOS 에서는 앱이 화면에 켜져 있으면 보이지 않을 수 있으니 홈으로 빠져나가 주세요.`,
        );
        // 권한 상태도 다시 확인
        setNotifPermission(await hasPermission());
      } else {
        setNotifTestResult(`❌ 등록 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } finally {
      setNotifBusy(false);
      setTimeout(() => setNotifTestResult(null), 12_000);
    }
  };

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { Store } = await import('@tauri-apps/plugin-store');
        const store = await Store.load('settings.json');
        const proxy = await store.get<ProxySettings>('proxy');
        if (proxy) {
          setProxyEnabled(proxy.enabled);
          setProxyHost(proxy.host);
          setProxyPort(String(proxy.port || ''));
        }
      } catch {
        // Store not available
      }
    };
    loadSettings();
  }, []);

  const handleSaveProxy = async () => {
    setSaving(true);
    try {
      const { Store } = await import('@tauri-apps/plugin-store');
      const store = await Store.load('settings.json');
      const settings: ProxySettings = {
        enabled: proxyEnabled,
        host: proxyHost,
        port: parseInt(proxyPort) || 0,
      };
      await store.set('proxy', settings);
      await store.save();
      setTestResult('설정이 저장되었습니다.');
    } catch (err) {
      setTestResult('저장 실패: ' + String(err));
    } finally {
      setSaving(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  };

  const handleTestProxy = async () => {
    setTestResult('연결 테스트 중...');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('proxy_request', {
        url: import.meta.env.VITE_SUPABASE_URL + '/rest/v1/',
        method: 'GET',
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        proxy_host: proxyHost,
        proxy_port: parseInt(proxyPort) || 0,
      });
      setTestResult('✅ 프록시 연결 성공!');
    } catch (err) {
      setTestResult('❌ 연결 실패: ' + String(err));
    }
    setTimeout(() => setTestResult(null), 5000);
  };


  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await forceSync();
      refreshSyncLabel();
      alert('동기화가 완료되었습니다.');
    } catch (err) {
      alert('동기화 실패: ' + String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { tasks } = await fetchAllDataForExport();
      const markdown = generateMarkdownExport({
        tasks,
        userEmail: user?.email || 'unknown',
      });

      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          filters: [{ name: 'Markdown', extensions: ['md'] }],
          defaultPath: `task-manager-export-${new Date().toISOString().split('T')[0]}.md`,
        });

        if (filePath) {
          await writeTextFile(filePath, markdown);
          alert('데이터가 성공적으로 내보내졌습니다.');
        }
      } catch {
        // Fallback: download via blob (non-Tauri environment)
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `task-manager-export-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export failed:', err);
      alert('데이터 내보내기 실패: ' + String(err));
    } finally {
      setExporting(false);
    }
  };

  const lastSyncTime = getLastSyncTime();

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-subtitle">앱 환경을 설정합니다</p>
        </div>
      </div>

      <div className="page-content settings-sections">
        {/* Account */}
        <section className="settings-section card">
          <h3 className="settings-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            계정
          </h3>
          <div className="settings-field">
            <label className="settings-label">이메일</label>
            <span className="settings-value">{user?.email || '-'}</span>
          </div>
          <button className="btn btn-secondary" onClick={signOut}>
            로그아웃
          </button>
        </section>

        {/* Proxy (Desktop only) */}
        {!isMobile && (
          <section className="settings-section card">
            <h3 className="settings-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              프록시 설정
            </h3>

            <div className="settings-field settings-field-row">
              <label className="settings-label">프록시 사용</label>
              <button
                className={`toggle ${proxyEnabled ? 'active' : ''}`}
                onClick={() => setProxyEnabled(!proxyEnabled)}
                type="button"
              />
            </div>

            {proxyEnabled && (
              <div className="settings-proxy-fields animate-fade-in">
                <div className="settings-field">
                  <label className="settings-label" htmlFor="proxy-host">프록시 호스트</label>
                  <input
                    id="proxy-host"
                    className="input"
                    placeholder="192.168.0.1"
                    value={proxyHost}
                    onChange={e => setProxyHost(e.target.value)}
                  />
                </div>
                <div className="settings-field">
                  <label className="settings-label" htmlFor="proxy-port">프록시 포트</label>
                  <input
                    id="proxy-port"
                    className="input"
                    placeholder="8080"
                    type="number"
                    value={proxyPort}
                    onChange={e => setProxyPort(e.target.value)}
                  />
                </div>
              </div>
            )}

            {testResult && (
              <div className="settings-test-result animate-fade-in">
                {testResult}
              </div>
            )}

            <div className="settings-actions">
              {proxyEnabled && (
                <button className="btn btn-secondary btn-sm" onClick={handleTestProxy}>
                  연결 테스트
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveProxy}
                disabled={saving}
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </section>
        )}



        {/* Categories */}
        <section className="settings-section card">
          <h3 className="settings-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            카테고리 관리
          </h3>
          <CategoryManager />
        </section>

        {/* Notifications */}
        <section className="settings-section card">
          <h3 className="settings-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
            알림
          </h3>

          <div className="settings-field settings-field-row" style={{ marginBottom: '0.75rem' }}>
            <label className="settings-label">권한 상태</label>
            <span className="settings-value" style={{ fontSize: '0.85rem' }}>
              {notifPermission ? '✅ 허용됨' : '❌ 미허용'}
            </span>
          </div>

          {!notifPermission && (
            <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRequestNotifPermission}
                disabled={notifBusy}
                type="button"
              >
                알림 권한 요청
              </button>
              <p className="settings-description" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                권한이 거부된 경우 OS 설정에서 직접 허용해야 합니다.
              </p>
            </div>
          )}

          {notifPermission && (
            <div className="settings-field" style={{ marginBottom: '0.75rem' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSendTestNotification}
                disabled={notifBusy}
                type="button"
              >
                10초 후 테스트 알림 보내기
              </button>
              <p className="settings-description" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                실제 알림이 정상적으로 표시되는지 확인합니다. iOS 에서는 앱이 화면에 켜져 있으면 표시되지 않을 수 있으니 홈 화면으로 이동해 주세요.
              </p>
              {notifTestResult && (
                <div
                  className="settings-test-result animate-fade-in"
                  style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
                >
                  {notifTestResult}
                </div>
              )}
            </div>
          )}

          {notifSettings && (
            <>
              <div className="settings-field settings-field-row">
                <label className="settings-label">오늘의 할일 요약 알림</label>
                <button
                  type="button"
                  className={`toggle ${notifSettings.dailySummaryEnabled ? 'active' : ''}`}
                  onClick={() => updateNotif({ dailySummaryEnabled: !notifSettings.dailySummaryEnabled })}
                  disabled={notifBusy || !notifPermission}
                />
              </div>

              {notifSettings.dailySummaryEnabled && (
                <div className="settings-field" style={{ marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                  <label className="settings-label" style={{ marginBottom: '0.25rem', display: 'block' }}>
                    알림 시각
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={notifSettings.dailySummaryTime}
                    disabled={notifBusy || !notifPermission}
                    onChange={(e) => updateNotif({ dailySummaryTime: e.target.value })}
                    style={{ maxWidth: '160px' }}
                  />
                  <p className="settings-description" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                    매일 이 시각에 오늘의 할일과 일정을 요약해서 알려드립니다.
                  </p>
                </div>
              )}

              <div className="settings-field settings-field-row" style={{ marginTop: '0.75rem' }}>
                <label className="settings-label">개별 일정 알림</label>
                <button
                  type="button"
                  className={`toggle ${notifSettings.perScheduleEnabled ? 'active' : ''}`}
                  onClick={() => updateNotif({ perScheduleEnabled: !notifSettings.perScheduleEnabled })}
                  disabled={notifBusy || !notifPermission}
                />
              </div>
              <p className="settings-description" style={{ marginTop: '0.25rem', marginBottom: 0 }}>
                각 일정에 설정한 알림 시각에 푸시 알림을 표시합니다. 이 항목을 끄면 모든 개별 일정 알림이 취소됩니다.
              </p>

              <p className="settings-description" style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.78rem', opacity: 0.75 }}>
                알림 설정은 기기에 저장되며 기기마다 별도로 관리됩니다.
              </p>
            </>
          )}
        </section>

        {/* Sync */}
        <section className="settings-section card">
          <h3 className="settings-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            데이터 동기화
          </h3>

          {/* 마지막 동기화 시간 */}
          <div className="settings-field settings-field-row" style={{ marginBottom: '0.75rem' }}>
            <label className="settings-label">마지막 동기화</label>
            <span className="settings-value" style={{ fontSize: '0.85rem' }}>
              {lastSyncTime
                ? `${lastSyncLabel} (${lastSyncTime.toLocaleString('ko-KR', { hour12: false })})`
                : '동기화 기록 없음'}
            </span>
          </div>

          {/* 자동 동기화 주기 선택 */}
          <div className="settings-field" style={{ marginBottom: '1rem' }}>
            <label className="settings-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              자동 동기화 주기
            </label>
            <div className="sync-interval-options">
              {SYNC_INTERVAL_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`sync-interval-btn${syncInterval === opt.value ? ' active' : ''}`}
                  onClick={() => handleSyncIntervalChange(opt.value)}
                  type="button"
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="settings-description" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
              {syncInterval === 0
                ? '앱 시작 시에만 Supabase와 동기화합니다.'
                : `앱 시작 후 ${SYNC_INTERVAL_OPTIONS.find(o => o.value === syncInterval)?.label ?? ''} 주기로 자동 동기화합니다.`}
            </p>
          </div>

          {/* 수동 동기화 */}
          <div className="settings-field">
            <label className="settings-label" style={{ marginBottom: '0.5rem', display: 'block' }}>
              수동 동기화
            </label>
            <p className="settings-description" style={{ marginBottom: '0.75rem' }}>
              지금 즉시 서버와 데이터를 동기화합니다.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleForceSync}
              disabled={syncing}
              style={{ width: '100%' }}
            >
              {syncing ? (
                <>
                  <span className="auth-spinner" style={{ width: 14, height: 14 }} />
                  동기화 중...
                </>
              ) : (
                '지금 동기화'
              )}
            </button>
          </div>
        </section>

        {/* Data Export */}
        <section className="settings-section card">
          <h3 className="settings-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            데이터 내보내기
          </h3>
          <p className="settings-desc">
            모든 할일과 수행내용을 마크다운(.md) 파일로 내보냅니다.
            사람이 읽을 수 있는 형태로 저장됩니다.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="auth-spinner" style={{ width: 14, height: 14 }} />
                내보내는 중...
              </>
            ) : (
              '전체 데이터 내보내기'
            )}
          </button>
        </section>
      </div>
    </div>
  );
}
