type TauriWindowModule = typeof import('@tauri-apps/api/window');

const PRIMARY_WINDOW_LABELS = new Set(['main', 'primary']);
const DASHBOARD_HASH_PREFIX = '#/dashboard';

function getHashFallbackLabel(): string {
  if (typeof window === 'undefined') return 'primary';
  return window.location.hash.startsWith(DASHBOARD_HASH_PREFIX) ? 'dashboard' : 'primary';
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function loadTauriWindow(): Promise<TauriWindowModule | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return await import('@tauri-apps/api/window');
  } catch (err) {
    console.warn('Failed to load Tauri window API:', err);
    return null;
  }
}

export async function loadTauriCore(): Promise<typeof import('@tauri-apps/api/core') | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    return await import('@tauri-apps/api/core');
  } catch (err) {
    console.warn('Failed to load Tauri core API:', err);
    return null;
  }
}

export async function getRuntimeWindowLabel(): Promise<string> {
  const tauriWindow = await loadTauriWindow();
  if (!tauriWindow) return getHashFallbackLabel();

  try {
    return tauriWindow.getCurrentWindow().label || getHashFallbackLabel();
  } catch (err) {
    console.warn('Failed to read Tauri window label:', err);
    return getHashFallbackLabel();
  }
}

export async function isPrimaryRuntimeWindow(): Promise<boolean> {
  const label = await getRuntimeWindowLabel();
  return PRIMARY_WINDOW_LABELS.has(label);
}

export async function getCurrentTauriWindow() {
  const tauriWindow = await loadTauriWindow();
  return tauriWindow?.getCurrentWindow() ?? null;
}

export async function getPrimaryTauriWindow() {
  const tauriWindow = await loadTauriWindow();
  if (!tauriWindow) return null;

  for (const label of PRIMARY_WINDOW_LABELS) {
    try {
      const appWindow = await tauriWindow.Window.getByLabel(label);
      if (appWindow) return appWindow;
    } catch (err) {
      console.warn(`Failed to read Tauri window "${label}":`, err);
    }
  }

  return null;
}

export function isDashboardHashRoute(): boolean {
  return getHashFallbackLabel() === 'dashboard';
}
