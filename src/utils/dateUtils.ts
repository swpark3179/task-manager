import { format, parseISO, isToday, isBefore, addDays, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

export function formatDateDisplay(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'M월 d일 (EEE)', { locale: ko });
}

export function formatDateFull(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy년 M월 d일 (EEE)', { locale: ko });
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy년 M월', { locale: ko });
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'MM/dd');
}

export function formatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd HH:mm:ss');
}

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function isDateToday(date: string): boolean {
  return isToday(parseISO(date));
}

export function isDateBefore(date: string, compareDate: string): boolean {
  return isBefore(parseISO(date), parseISO(compareDate));
}

export function getNextDay(date: string): string {
  return format(addDays(parseISO(date), 1), 'yyyy-MM-dd');
}

export function getPrevDay(date: string): string {
  return format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
}

export function getDaysAgo(date: string, days: number): string {
  return format(subDays(parseISO(date), days), 'yyyy-MM-dd');
}

export function getMonthDays(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(new Date(year, month - 1));
  return eachDayOfInterval({ start, end });
}

export function getMonthCalendarGrid(year: number, month: number): (Date | null)[] {
  const days = getMonthDays(year, month);
  const firstDayOfWeek = getDay(days[0]); // 0=Sun
  const grid: (Date | null)[] = [];

  // Fill leading nulls
  for (let i = 0; i < firstDayOfWeek; i++) {
    grid.push(null);
  }

  // Fill dates
  grid.push(...days);

  // Fill trailing nulls to complete last week
  while (grid.length % 7 !== 0) {
    grid.push(null);
  }

  return grid;
}

export type CalendarCell = { date: Date; isCurrentMonth: boolean };

// 달력 그리드를 항상 6주(42칸)로 채워 반환합니다. 이번 달 1일 앞에는
// 전달의 마지막 며칠을, 마지막 날 뒤에는 다음 달의 며칠을 채워서
// 모든 셀이 실제 날짜를 가지도록 합니다. 인접 달 셀은 isCurrentMonth=false 입니다.
export function getMonthCalendarCells(year: number, month: number): CalendarCell[] {
  const days = getMonthDays(year, month);
  const firstDayOfWeek = getDay(days[0]); // 0=Sun
  const cells: CalendarCell[] = [];

  // Leading days from the previous month
  for (let i = firstDayOfWeek; i > 0; i--) {
    cells.push({ date: subDays(days[0], i), isCurrentMonth: false });
  }

  // Current month days
  for (const d of days) {
    cells.push({ date: d, isCurrentMonth: true });
  }

  // Trailing days from the next month, always pad to 42 cells (6 weeks)
  const lastDay = days[days.length - 1];
  let offset = 1;
  while (cells.length < 42) {
    cells.push({ date: addDays(lastDay, offset), isCurrentMonth: false });
    offset++;
  }

  return cells;
}

export function getYearMonth(date: string): string {
  return date.substring(0, 7); // YYYY-MM
}
