import { readFileSync, existsSync } from 'node:fs';

const failures = [];
const read = (path) => readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const cargo = read('src-tauri/Cargo.toml');
assert(/tauri\s*=\s*\{[^\n]*features\s*=\s*\[[^\]]*["']tray-icon["']/s.test(cargo), 'src-tauri/Cargo.toml must enable tauri tray-icon feature');

const tauriConf = JSON.parse(read('src-tauri/tauri.conf.json'));
const windows = tauriConf?.app?.windows ?? [];
const mainWindow = windows.find((win) => win.label === 'main');
const dashboard = windows.find((win) => win.label === 'dashboard');
assert(Boolean(mainWindow), 'tauri.conf.json must label the primary window as main');
assert(Boolean(dashboard), 'tauri.conf.json must define a dashboard window');
if (dashboard) {
  const expected = {
    url: 'index.html#/dashboard',
    visible: false,
    width: 420,
    height: 640,
    minWidth: 360,
    minHeight: 480,
    skipTaskbar: true,
    alwaysOnTop: true,
    resizable: false,
    decorations: true,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert(dashboard[key] === value, `dashboard window must set ${key}=${JSON.stringify(value)}`);
  }
}

const capabilities = ['src-tauri/capabilities/default.json']
  .filter(existsSync)
  .map((path) => ({ path, json: JSON.parse(read(path)) }));
assert(capabilities.some(({ json }) => Array.isArray(json.windows) && json.windows.includes('dashboard')), 'a Tauri capability must include the dashboard window');

const rust = read('src-tauri/src/lib.rs');
for (const token of [
  'TrayIconBuilder',
  'TrayIconEvent::Click',
  'MouseButton::Left',
  'MouseButtonState::Up',
  'show_menu_on_left_click(false)',
  'toggle_dashboard',
  'hide_dashboard',
  'open_main',
  'get_webview_window(DASHBOARD_LABEL)',
  'CloseRequested',
  'prevent_close',
]) {
  assert(rust.includes(token), `src-tauri/src/lib.rs must include ${token}`);
}
assert(
  rust.includes('window.label() == DASHBOARD_LABEL || window.label() == MAIN_LABEL'),
  'src-tauri/src/lib.rs must hide dashboard and main windows on close for tray residency',
);

assert(existsSync('src/hooks/useDayTasks.ts'), 'src/hooks/useDayTasks.ts must exist');
const dayView = read('src/components/day/DayView.tsx');
const dashboardPage = read('src/pages/DashboardPage.tsx');
assert(dayView.includes('useDayTasks'), 'DayView must consume useDayTasks');
assert(dashboardPage.includes('useDayTasks'), 'DashboardPage must consume useDayTasks');

const auth = read('src/contexts/AuthContext.tsx');
assert(auth.includes('isPrimaryRuntimeWindow'), 'AuthContext must use runtime window primary detection');
assert(auth.includes('session?.user && globalSideEffectsEnabled'), 'initial sync side effects must be gated to the primary window');
assert(auth.includes('!error && globalSideEffectsEnabled'), 'signIn full sync side effects must be gated to the primary window');

const commands = read('src/lib/windowCommands.ts');
assert(commands.includes("invoke('open_main'"), 'windowCommands must invoke Rust open_main');
assert(commands.includes("invoke('hide_dashboard'"), 'windowCommands must invoke Rust hide_dashboard');

if (failures.length > 0) {
  console.error('Dashboard static verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Dashboard static verification passed.');
