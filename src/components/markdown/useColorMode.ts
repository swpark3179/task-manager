import { useEffect, useState } from 'react';

export type ColorMode = 'light' | 'dark';

function readColorMode(): ColorMode {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

/**
 * Reads the active color mode from the document's `data-theme` attribute and
 * keeps it in sync as the attribute changes. Works in every Tauri webview
 * (dashboard popup, detail popup, main app) without depending on a React
 * context provider being present in that particular window.
 */
export function useColorMode(): ColorMode {
  const [mode, setMode] = useState<ColorMode>(readColorMode);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setMode(readColorMode()));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    // Sync once in case the attribute changed before the observer attached.
    setMode(readColorMode());
    return () => observer.disconnect();
  }, []);

  return mode;
}
