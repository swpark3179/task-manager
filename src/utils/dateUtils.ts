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

export function getYearMonth(date: string): string {
  return date.substring(0, 7); // YYYY-MM
}
