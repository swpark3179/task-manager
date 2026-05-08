import {
  getCurrentTauriWindow,
  getPrimaryTauriWindow,
  isTauriRuntime,
  loadTauriCore,
} from './runtimeWindow';

function toHashRoute(route: string): string {
  return route.startsWith('/') ? `#${route}` : `#/${route}`;
}

export async function openFullApp(route: string = '/'): Promise<void> {
  if (typeof window === 'undefined') return;

  const tauriCore = await loadTauriCore();
  if (tauriCore) {
    try {
      await tauriCore.invoke('open_main', { route });
      await tauriCore.invoke('hide_dashboard');
      return;
    } catch (err) {
      console.warn('Failed to invoke open_main:', err);
    }
  }

  if (isTauriRuntime()) {
    const primaryWindow = await getPrimaryTauriWindow();
    if (!primaryWindow) return;

    try {
      await primaryWindow.show();
      await primaryWindow.unminimize();
      await primaryWindow.setFocus();
    } catch (err) {
      console.warn('Failed to focus full app window:', err);
    }
    return;
  }

  window.location.hash = toHashRoute(route);
}

export async function hideDashboard(): Promise<void> {
  const tauriCore = await loadTauriCore();
  if (tauriCore) {
    try {
      await tauriCore.invoke('hide_dashboard');
      return;
    } catch (err) {
      console.warn('Failed to invoke hide_dashboard:', err);
    }
  }

  const currentWindow = await getCurrentTauriWindow();
  if (currentWindow) {
    try {
      await currentWindow.hide();
      return;
    } catch (err) {
      console.warn('Failed to hide dashboard window:', err);
    }
  }

  if (typeof window !== 'undefined' && !isTauriRuntime()) {
    window.location.hash = '#/';
  }
}
