import { getCurrentTauriWindow, isTauriRuntime } from './runtimeWindow';

const DETAIL_WIDTH = 720;
const DETAIL_HEIGHT = 640;

function detailLabel(taskId: string): string {
  // Tauri window labels must be ASCII alphanumeric + `-`/`_`/`/`/`:`.
  return `detail-${taskId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function detailUrl(taskId: string, date: string): string {
  const params = new URLSearchParams({ taskId, date });
  return `index.html#/detail?${params.toString()}`;
}

async function computeDetailPosition(): Promise<{ x: number; y: number } | null> {
  try {
    const current = await getCurrentTauriWindow();
    if (!current) return null;
    const [pos, scale] = await Promise.all([current.outerPosition(), current.scaleFactor()]);
    // Convert physical pos to logical px (Tauri window options use logical units by default).
    const logicalX = pos.x / scale;
    const logicalY = pos.y / scale;
    const targetX = Math.round(logicalX - DETAIL_WIDTH);
    return {
      x: Math.max(0, targetX),
      y: Math.max(0, Math.round(logicalY)),
    };
  } catch (err) {
    console.warn('Failed to compute detail window position:', err);
    return null;
  }
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

    const position = await computeDetailPosition();

    const existing = await WebviewWindow.getByLabel(label);
    if (existing) {
      try {
        if (position) {
          try {
            const dpiMod = await import('@tauri-apps/api/dpi');
            const { LogicalPosition } = dpiMod;
            await existing.setPosition(new LogicalPosition(position.x, position.y));
          } catch (err) {
            console.warn('Failed to reposition existing detail window:', err);
          }
        }
        try {
          await existing.setAlwaysOnTop(true);
        } catch (err) {
          console.warn('Failed to set always-on-top on existing detail window:', err);
        }
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
      width: DETAIL_WIDTH,
      height: DETAIL_HEIGHT,
      minWidth: 360,
      minHeight: 320,
      resizable: true,
      decorations: true,
      alwaysOnTop: true,
      focus: true,
      ...(position ? { x: position.x, y: position.y } : {}),
    });

    win.once('tauri://error', (e) => {
      console.error('Failed to open detail window:', e);
    });
  } catch (err) {
    console.error('Failed to open detail window:', err);
  }
}
