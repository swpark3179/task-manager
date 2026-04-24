import type { Schedule, Task } from '../types';
import { scheduleCache, taskCache } from './cache';
import { getTodayString } from '../utils/dateUtils';

// =============================================
// Local Scheduled Notifications
// Tauri plugin-notification 기반. 디바이스 OS의 로컬 알림 큐에
// 미리 예약하여 앱이 종료/백그라운드 상태여도 동작합니다.
// =============================================

const STORE_FILE = 'notifications.json';
const SETTINGS_KEY = 'settings';

// 데일리 요약을 미리 N일치 예약. 앱이 자주 열리지 않아도
// 그 기간만큼은 예약된 본문이 디바이스 OS에 보존됩니다.
export const DAILY_SUMMARY_HORIZON_DAYS = 14;

// 개별 일정 알림은 향후 N일 이내인 것만 예약 (과거/너무 먼 미래 제외)
const PER_SCHEDULE_HORIZON_DAYS = 60;

// 알림 ID 범위 분리
//   - 1 ~ 999_999      : 개별 일정(schedule.id 해시)
//   - 1_000_000 ~      : 데일리 요약(1_000_000 + dayOffset)
const DAILY_SUMMARY_BASE_ID = 1_000_000;

// ---------------------------------------------
// Settings (Tauri Store에 로컬 저장; 기기별)
// ---------------------------------------------

export interface NotificationSettings {
  /** 데일리 요약 알림 활성 여부 */
  dailySummaryEnabled: boolean;
  /** 데일리 요약 알림 시각 (HH:MM, 24h, 로컬 타임존) */
  dailySummaryTime: string;
  /** 개별 일정 알림 사용 여부 (off 시 모든 per-schedule 알림 취소) */
  perScheduleEnabled: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  dailySummaryEnabled: false,
  dailySummaryTime: '09:00',
  perScheduleEnabled: true,
};

let cachedSettings: NotificationSettings | null = null;

async function loadStore() {
  try {
    const { Store } = await import('@tauri-apps/plugin-store');
    return await Store.load(STORE_FILE);
  } catch {
    return null;
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  if (cachedSettings) return cachedSettings;
  const store = await loadStore();
  if (!store) {
    cachedSettings = { ...DEFAULT_SETTINGS };
    return cachedSettings;
  }
  try {
    const stored = await store.get<NotificationSettings>(SETTINGS_KEY);
    cachedSettings = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  } catch {
    cachedSettings = { ...DEFAULT_SETTINGS };
  }
  return cachedSettings;
}

export async function setNotificationSettings(
  next: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  const current = await getNotificationSettings();
  const merged: NotificationSettings = { ...current, ...next };
  cachedSettings = merged;
  const store = await loadStore();
  if (store) {
    try {
      await store.set(SETTINGS_KEY, merged);
      await store.save();
    } catch {
      // non-critical
    }
  }
  return merged;
}

// ---------------------------------------------
// Permission
// ---------------------------------------------

let notifModulePromise: Promise<typeof import('@tauri-apps/plugin-notification') | null> | null = null;
async function loadNotifModule() {
  if (!notifModulePromise) {
    notifModulePromise = (async () => {
      try {
        return await import('@tauri-apps/plugin-notification');
      } catch {
        return null;
      }
    })();
  }
  return notifModulePromise;
}

export async function hasPermission(): Promise<boolean> {
  const mod = await loadNotifModule();
  if (!mod) return false;
  try {
    return await mod.isPermissionGranted();
  } catch {
    return false;
  }
}

export async function ensurePermission(): Promise<boolean> {
  const mod = await loadNotifModule();
  if (!mod) return false;
  try {
    if (await mod.isPermissionGranted()) return true;
    const result = await mod.requestPermission();
    return result === 'granted';
  } catch {
    return false;
  }
}

// ---------------------------------------------
// ID hashing (UUID -> stable 32-bit positive int in [1, 999_999])
// ---------------------------------------------

function hashScheduleId(id: string): number {
  let h = 2166136261 >>> 0; // FNV-1a 32bit
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  // 1 ~ 999_999 범위 (0 회피 + 데일리 요약 영역 회피)
  return (h % 999_999) + 1;
}

// ---------------------------------------------
// Cancel helpers
// ---------------------------------------------

async function cancelByIds(ids: number[]) {
  if (!ids.length) return;
  const mod = await loadNotifModule();
  if (!mod) return;
  try {
    await mod.cancel(ids);
  } catch (err) {
    console.error('[notifications] cancel failed:', err);
  }
}

async function getPendingIds(): Promise<number[]> {
  const mod = await loadNotifModule();
  if (!mod) return [];
  try {
    const pending = await mod.pending();
    return (pending || []).map((p: any) => p.id).filter((n: any) => typeof n === 'number');
  } catch {
    return [];
  }
}

// ---------------------------------------------
// Per-schedule notifications
// ---------------------------------------------

function isWithinHorizon(notifyAt: Date): boolean {
  const now = Date.now();
  const horizon = now + PER_SCHEDULE_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const t = notifyAt.getTime();
  return t > now && t <= horizon;
}

async function scheduleOne(schedule: Schedule): Promise<void> {
  if (!schedule.notify_at) return;
  const notifyAt = new Date(schedule.notify_at);
  if (isNaN(notifyAt.getTime())) return;
  if (!isWithinHorizon(notifyAt)) return;

  const mod = await loadNotifModule();
  if (!mod) return;

  try {
    const id = hashScheduleId(schedule.id);
    const dateStr = formatScheduleDate(schedule);
    const body = schedule.description
      ? truncate(stripMarkdown(schedule.description), 120)
      : `예정 일정: ${dateStr}`;

    await mod.sendNotification({
      id,
      title: schedule.title,
      body,
      schedule: mod.Schedule.at(notifyAt, false, true),
    });
  } catch (err) {
    console.error('[notifications] schedule one failed:', err);
  }
}

export async function cancelScheduleNotification(scheduleId: string): Promise<void> {
  await cancelByIds([hashScheduleId(scheduleId)]);
}

// ---------------------------------------------
// Daily summary
// ---------------------------------------------

interface DailySummary {
  date: string;
  total: number;
  inProgress: number;
  pending: number;
  scheduleCount: number;
  firstTitles: string[]; // 본문에 추가할 일부 제목
}

async function buildDailySummary(date: string): Promise<DailySummary> {
  const tasks = (await taskCache.get(date)) ?? [];
  const schedules = (await scheduleCache.get()) ?? [];

  // 해당 날짜에 걸쳐 있는 일정만 필터
  const daySchedules = schedules.filter((s) => s.start_date <= date && s.end_date >= date);

  let inProgress = 0;
  let pending = 0;
  for (const t of tasks as Task[]) {
    if (t.status === 'in_progress') inProgress++;
    else if (t.status === 'pending') pending++;
  }
  const total = (tasks as Task[]).filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  ).length;

  const taskTitles = (tasks as Task[])
    .filter((t) => !t.parent_id && (t.status === 'pending' || t.status === 'in_progress'))
    .slice(0, 2)
    .map((t) => `· ${t.title}`);
  const scheduleTitles = daySchedules.slice(0, 2).map((s) => `· [일정] ${s.title}`);
  const firstTitles = [...taskTitles, ...scheduleTitles].slice(0, 3);

  return {
    date,
    total,
    inProgress,
    pending,
    scheduleCount: daySchedules.length,
    firstTitles,
  };
}

function formatSummaryBody(s: DailySummary): string {
  const headerParts: string[] = [];
  if (s.total > 0) {
    headerParts.push(`할일 ${s.total}건 (진행중 ${s.inProgress})`);
  } else {
    headerParts.push('할일 없음');
  }
  if (s.scheduleCount > 0) headerParts.push(`일정 ${s.scheduleCount}건`);
  const header = headerParts.join(' · ');
  if (s.firstTitles.length === 0) return header;
  return `${header}\n${s.firstTitles.join('\n')}`;
}

function dailySummaryNotificationId(dayOffset: number): number {
  return DAILY_SUMMARY_BASE_ID + dayOffset;
}

function parseHHMM(hhmm: string): { hour: number; minute: number } {
  const [hStr, mStr] = (hhmm || '09:00').split(':');
  const hour = Math.max(0, Math.min(23, parseInt(hStr, 10) || 0));
  const minute = Math.max(0, Math.min(59, parseInt(mStr, 10) || 0));
  return { hour, minute };
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function rescheduleDailySummaries(settings: NotificationSettings): Promise<void> {
  const mod = await loadNotifModule();
  if (!mod) return;

  // 기존 데일리 요약 알림 모두 취소
  const ids: number[] = [];
  for (let i = 0; i < DAILY_SUMMARY_HORIZON_DAYS + 5; i++) {
    ids.push(dailySummaryNotificationId(i));
  }
  await cancelByIds(ids);

  if (!settings.dailySummaryEnabled) return;

  const { hour, minute } = parseHHMM(settings.dailySummaryTime);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < DAILY_SUMMARY_HORIZON_DAYS; offset++) {
    const fireAt = addDays(today, offset);
    fireAt.setHours(hour, minute, 0, 0);
    if (fireAt.getTime() <= Date.now()) continue;

    const dateStr = formatLocalDate(fireAt);
    let summary: DailySummary;
    try {
      summary = await buildDailySummary(dateStr);
    } catch {
      summary = {
        date: dateStr,
        total: 0,
        inProgress: 0,
        pending: 0,
        scheduleCount: 0,
        firstTitles: [],
      };
    }

    try {
      await mod.sendNotification({
        id: dailySummaryNotificationId(offset),
        title: '오늘의 할일 요약',
        body: formatSummaryBody(summary),
        schedule: mod.Schedule.at(fireAt, false, true),
      });
    } catch (err) {
      console.error('[notifications] daily summary schedule failed:', err);
    }
  }
}

// ---------------------------------------------
// Reschedule everything
// ---------------------------------------------

async function rescheduleAllPerSchedule(enabled: boolean): Promise<void> {
  // 기존 per-schedule 예약(< DAILY_SUMMARY_BASE_ID) 모두 취소
  const pending = await getPendingIds();
  const perScheduleIds = pending.filter((id) => id > 0 && id < DAILY_SUMMARY_BASE_ID);
  await cancelByIds(perScheduleIds);

  if (!enabled) return;

  const schedules = (await scheduleCache.get()) ?? [];
  for (const s of schedules) {
    if (s.notify_at) await scheduleOne(s);
  }
}

let rescheduleInFlight: Promise<void> | null = null;

/**
 * 데일리 요약 + 모든 per-schedule 알림을 재예약합니다.
 * 권한이 없으면 조용히 종료합니다.
 * 동시 호출되면 같은 promise를 공유합니다.
 */
export function rescheduleAll(): Promise<void> {
  if (rescheduleInFlight) return rescheduleInFlight;
  rescheduleInFlight = (async () => {
    try {
      if (!(await hasPermission())) return;
      const settings = await getNotificationSettings();
      await rescheduleAllPerSchedule(settings.perScheduleEnabled);
      await rescheduleDailySummaries(settings);
    } catch (err) {
      console.error('[notifications] rescheduleAll failed:', err);
    } finally {
      rescheduleInFlight = null;
    }
  })();
  return rescheduleInFlight;
}

/**
 * 데일리 요약만 재예약합니다 (Task 변경 시 호출).
 */
export async function rescheduleDailySummariesOnly(): Promise<void> {
  if (!(await hasPermission())) return;
  const settings = await getNotificationSettings();
  await rescheduleDailySummaries(settings);
}

// ---------------------------------------------
// Schedule single (called after Schedule CUD)
// ---------------------------------------------

/**
 * 한 일정의 알림을 갱신합니다 (이전 알림 취소 후 재등록).
 * 권한·설정 비활성·notify_at 없음 등은 조용히 무시.
 */
export async function refreshScheduleNotification(schedule: Schedule): Promise<void> {
  await cancelScheduleNotification(schedule.id);
  if (!(await hasPermission())) return;
  const settings = await getNotificationSettings();
  if (!settings.perScheduleEnabled) return;
  if (schedule.notify_at) await scheduleOne(schedule);
}

// ---------------------------------------------
// Helpers for ScheduleModal: notify_at 계산
// ---------------------------------------------

/**
 * "예정 시각 N분 전" 모드의 notify_at을 계산합니다.
 * @param dateStr YYYY-MM-DD (start_date)
 * @param timeStr HH:MM 또는 HH:MM:SS (scheduled_time)
 * @param offsetMinutes N분 전
 * @returns ISO timestamp string (UTC)
 */
export function computeNotifyAtFromOffset(
  dateStr: string,
  timeStr: string,
  offsetMinutes: number
): string {
  const [h, m] = timeStr.split(':');
  const local = new Date(dateStr);
  local.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
  local.setMinutes(local.getMinutes() - offsetMinutes);
  return local.toISOString();
}

/**
 * <input type="datetime-local"> 값을 ISO string(UTC)로 변환합니다.
 */
export function localDateTimeToIso(value: string): string {
  // value 예: "2026-04-30T08:30"
  const d = new Date(value);
  if (isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

/**
 * ISO string(UTC) → datetime-local input 값 (로컬 타임존 보존)
 */
export function isoToLocalDateTimeValue(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------------------------------------------
// internal utils
// ---------------------------------------------

function formatLocalDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatScheduleDate(s: Schedule): string {
  if (s.start_date === s.end_date) return s.start_date;
  return `${s.start_date} ~ ${s.end_date}`;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

// ---------------------------------------------
// Exports for testing/inspection
// ---------------------------------------------

export const _internals = {
  hashScheduleId,
  buildDailySummary,
  formatSummaryBody,
  dailySummaryNotificationId,
  // 미사용 변수 경고 회피용 마커
  _today: getTodayString,
};
