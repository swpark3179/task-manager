import { getCurrentTauriWindow, isTauriRuntime } from './runtimeWindow';

const CALENDAR_WIDTH = 900;
const CALENDAR_HEIGHT = 720;
const CALENDAR_LABEL = 'calendar-popup';
const CALENDAR_URL = 'index.html#/calendar-popup';

async function computeCalendarPosition(): Promise<{ x: number; y: number } | null> {
  try {
    const current = await getCurrentTauriWindow();
    if (!current) return null;
    const [pos, scale] = await Promise.all([current.outerPosition(), current.scaleFactor()]);
    // Convert physical pos to logical px (Tauri window options use logical units by default).
    const logicalX = pos.x / scale;
    const logicalY = pos.y / scale;
    // Open the calendar to the left of the dashboard so the dashboard stays visible.
    const targetX = Math.round(logicalX - CALENDAR_WIDTH - 12);
    return {
      x: Math.max(0, targetX),
      y: Math.max(0, Math.round(logicalY)),
    };
  } catch (err) {
    console.warn('Failed to compute calendar window position:', err);
    return null;
  }
}

export async function openCalendarWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    if (typeof window !== 'undefined') {
      window.location.hash = '#/calendar-popup';
    }
    return;
  }

  try {
    const mod = await import('@tauri-apps/api/webviewWindow');
    const { WebviewWindow } = mod;

    const position = await computeCalendarPosition();

    const existing = await WebviewWindow.getByLabel(CALENDAR_LABEL);
    if (existing) {
      try {
        await existing.show();
        await existing.unminimize();
        await existing.setFocus();
        return;
      } catch (err) {
        console.warn('Failed to focus existing calendar window:', err);
      }
    }

    const win = new WebviewWindow(CALENDAR_LABEL, {
      url: CALENDAR_URL,
      title: '달력',
      width: CALENDAR_WIDTH,
      height: CALENDAR_HEIGHT,
      minWidth: 480,
      minHeight: 520,
      resizable: true,
      decorations: true,
      focus: true,
      ...(position ? { x: position.x, y: position.y } : {}),
    });

    win.once('tauri://error', (e) => {
      console.error('Failed to open calendar window:', e);
    });
  } catch (err) {
    console.error('Failed to open calendar window:', err);
  }
}
