import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark';
export type DensityMode = 'comfortable' | 'compact';
export type WeekStart = 'sun' | 'mon';

const THEME_KEY = 'tm.appearance.theme';
const DENSITY_KEY = 'tm.appearance.density';
const WEEK_START_KEY = 'tm.appearance.weekStart';

interface AppearanceState {
  theme: ThemeMode;
  density: DensityMode;
  weekStart: WeekStart;
  setTheme: (t: ThemeMode) => void;
  setDensity: (d: DensityMode) => void;
  setWeekStart: (w: WeekStart) => void;
}

const AppearanceContext = createContext<AppearanceState | null>(null);

function loadInitial<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {}
  return fallback;
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => loadInitial<ThemeMode>(THEME_KEY, 'light', ['light', 'dark'] as const));
  const [density, setDensityState] = useState<DensityMode>(() => loadInitial<DensityMode>(DENSITY_KEY, 'comfortable', ['comfortable', 'compact'] as const));
  const [weekStart, setWeekStartState] = useState<WeekStart>(() => loadInitial<WeekStart>(WEEK_START_KEY, 'sun', ['sun', 'mon'] as const));

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem(THEME_KEY, theme); } catch {}
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    if (density === 'compact') root.setAttribute('data-density', 'compact');
    else root.removeAttribute('data-density');
    try { localStorage.setItem(DENSITY_KEY, density); } catch {}
  }, [density]);

  useEffect(() => {
    try { localStorage.setItem(WEEK_START_KEY, weekStart); } catch {}
  }, [weekStart]);

  const value = useMemo<AppearanceState>(() => ({
    theme,
    density,
    weekStart,
    setTheme: setThemeState,
    setDensity: setDensityState,
    setWeekStart: setWeekStartState,
  }), [theme, density, weekStart]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance(): AppearanceState {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error('useAppearance must be used within AppearanceProvider');
  return ctx;
}
