import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchAllDataForExport, forceSync } from '../lib/database';
import { generateMarkdownExport } from '../utils/exportUtils';
import type { ProxySettings } from '../types';
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

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  return (
    <div className="page settings-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">설정</h1>
          <p className="page-subtitle">앱 환경을 설정합니다</p>
        </div>
      </div>

      <div className="settings-sections">
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
          <p className="settings-description">
            서버와 수동으로 데이터를 동기화합니다. 이 작업 중에는 다른 기능을 사용할 수 없습니다.
          </p>
          <button
            className="btn btn-primary"
            onClick={handleForceSync}
            disabled={syncing}
            style={{ marginTop: '1rem', width: '100%' }}
          >
            {syncing ? '동기화 중...' : '일괄 동기화'}
          </button>
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
