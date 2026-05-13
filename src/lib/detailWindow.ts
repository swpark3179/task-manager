import { isTauriRuntime } from './runtimeWindow';

function detailLabel(taskId: string): string {
  // Tauri window labels must be ASCII alphanumeric + `-`/`_`/`/`/`:`.
  return `detail-${taskId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function detailUrl(taskId: string, date: string): string {
  const params = new URLSearchParams({ taskId, date });
  return `index.html#/detail?${params.toString()}`;
}

export async function openDetailWindow(taskId: string, date: string): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof window !== 'undefined') {
      window.location.hash = `#/detail?taskId=${encodeURIComponent(taskId)}&date=${encodeURIComponent(date)}`;
    }
    return;
  }

  try {
    const mod = await import('@tauri-apps/api/webviewWindow');
    const { WebviewWindow } = mod;
    const label = detailLabel(taskId);

    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      try {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        return;
      } catch (err) {
        console.warn('Failed to focus existing detail window:', err);
      }
    }

    const win = new WebviewWindow(label, {
      url: detailUrl(taskId, date),
      title: '작업 상세',
      width: 720,
      height: 640,
      minWidth: 360,
      minHeight: 320,
      resizable: true,
      decorations: true,
      alwaysOnTop: false,
      focus: true,
    });

    win.once('tauri://error', (e) => {
      console.error('Failed to open detail window:', e);
    });
  } catch (err) {
    console.error('Failed to open detail window:', err);
  }
}
