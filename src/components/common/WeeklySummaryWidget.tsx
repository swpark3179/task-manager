import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startOfWeek, addDays, parseISO, format } from 'date-fns';
import { fetchCalendarData } from '../../lib/database';
import { formatDate, getTodayString } from '../../utils/dateUtils';
import { useSyncStatus } from './SyncIndicator';
import type { CalendarCellData } from '../../types';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface WeeklySummaryWidgetProps {
  referenceDate?: string;
}

export default function WeeklySummaryWidget({ referenceDate }: WeeklySummaryWidgetProps) {
  const navigate = useNavigate();
  const today = getTodayString();
  const baseDate = referenceDate ?? today;
  const syncStatus = useSyncStatus();

  const weekDates = useMemo(() => {
    const start = startOfWeek(parseISO(baseDate), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => formatDate(addDays(start, i)));
  }, [baseDate]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const d of weekDates) set.add(d.substring(0, 7));
    return Array.from(set);
  }, [weekDates]);

  const [cellsByDate, setCellsByDate] = useState<Record<string, CalendarCellData | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const results = await Promise.all(
          months.map((ym) => {
            const [y, m] = ym.split('-').map(Number);
            return fetchCalendarData(y, m).catch(() => [] as CalendarCellData[]);
          }),
        );
        if (cancelled) return;
        const map: Record<string, CalendarCellData | undefined> = {};
        for (const arr of results) {
          for (const cell of arr) map[cell.date] = cell;
        }
        setCellsByDate(map);
      } catch (err) {
        console.error('Failed to load weekly summary:', err);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [months, syncStatus]);

  const handleClick = (date: string) => {
    if (date === today) navigate('/');
    else navigate(`/history/${date}`);
  };

  return (
    <div className="weekly-summary-widget">
      {weekDates.map((date) => {
        const cell = cellsByDate[date];
        const summary = cell?.summary;
        const total = summary?.total ?? 0;
        const completed = summary?.completed ?? 0;
        const remaining = Math.max(0, total - completed - (summary?.discarded ?? 0));
        const dow = parseISO(date).getDay();
        const isToday = date === today;
        const dayNum = Number(format(parseISO(date), 'd'));

        return (
          <button
            key={date}
            type="button"
            className={`weekly-summary-day ${isToday ? 'is-today' : ''} ${dow === 0 ? 'is-sun' : ''} ${dow === 6 ? 'is-sat' : ''}`}
            onClick={() => handleClick(date)}
            title={`${date} · 완료 ${completed}/${total}`}
          >
            <span className="weekly-summary-dow">{DAY_LABELS[dow]}</span>
            <span className="weekly-summary-date">{dayNum}</span>
            <span className="weekly-summary-count">
              {total === 0 ? '–' : `${completed}/${total}`}
            </span>
            {remaining > 0 && <span className="weekly-summary-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
