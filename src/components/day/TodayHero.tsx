import { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { fetchCalendarData } from '../../lib/database';
import { useSyncStatus } from '../common/SyncIndicator';
import { formatDate, getTodayString, getNextDay, getPrevDay } from '../../utils/dateUtils';
import type { CalendarCellData, TaskStatusSummary } from '../../types';

const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface TodayHeroProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Live summary for the currently-selected date (overrides cached value). */
  liveSummary?: TaskStatusSummary;
}

function effectiveTotal(s?: TaskStatusSummary) {
  if (!s) return 0;
  return Math.max(0, s.total - s.discarded);
}

function pct(s?: TaskStatusSummary) {
  const total = effectiveTotal(s);
  if (total === 0) return 0;
  return Math.round(((s?.completed ?? 0) / total) * 100);
}

export default function TodayHero({ selectedDate, onSelectDate, liveSummary }: TodayHeroProps) {
  const today = getTodayString();
  const syncStatus = useSyncStatus();

  const weekDates = useMemo(() => {
    const start = startOfWeek(parseISO(selectedDate), { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => formatDate(addDays(start, i)));
  }, [selectedDate]);

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const d of weekDates) set.add(d.substring(0, 7));
    return Array.from(set);
  }, [weekDates]);

  const [cellsByDate, setCellsByDate] = useState<Record<string, CalendarCellData | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.all(
          months.map((ym) => {
            const [y, m] = ym.split('-').map(Number);
            return fetchCalendarData(y, m).catch(() => [] as CalendarCellData[]);
          }),
        );
        if (cancelled) return;
        const map: Record<string, CalendarCellData | undefined> = {};
        for (const arr of results) for (const cell of arr) map[cell.date] = cell;
        setCellsByDate(map);
      } catch (err) {
        console.error('Failed to load week summary:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [months, syncStatus]);

  const parsed = parseISO(selectedDate);
  const dateBig = format(parsed, 'M월 d일', { locale: ko });
  const year = format(parsed, 'yyyy');
  const dowFull = format(parsed, 'EEEE', { locale: ko });

  const selectedSummary = liveSummary ?? cellsByDate[selectedDate]?.summary;
  const selectedTotal = effectiveTotal(selectedSummary);
  const selectedDone = selectedSummary?.completed ?? 0;
  const selectedPct = pct(selectedSummary);

  return (
    <div className="td-hero">
      <div className="td-hero-left">
        <div className="td-hero-eyebrow">
          {selectedDate === today ? '오늘의 할일' : '할일'}
        </div>
        <div className="td-hero-date">
          <span className="td-hero-date-main">{dateBig}</span>
          <span className="td-hero-date-sub">{year} · {dowFull}</span>
        </div>
        <div className="td-hero-progress">
          <div className="td-hero-prog-bar" aria-hidden="true">
            <div
              className="td-hero-prog-fill"
              style={{ width: `${selectedPct}%` }}
            />
          </div>
          <span className="td-hero-prog-txt">
            {selectedTotal === 0
              ? '작업 없음'
              : `${selectedDone}/${selectedTotal} · ${selectedPct}%`}
          </span>
        </div>
      </div>

      <div className="td-hero-right">
        <button
          type="button"
          className="td-week-nav"
          aria-label="이전 날"
          title="이전 날"
          onClick={() => onSelectDate(getPrevDay(selectedDate))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="td-week" role="tablist">
          {weekDates.map((date) => {
            const dow = parseISO(date).getDay();
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const cell = cellsByDate[date];
            const summary = isSelected ? (liveSummary ?? cell?.summary) : cell?.summary;
            const total = effectiveTotal(summary);
            const done = summary?.completed ?? 0;
            const fillPct = total > 0 ? (done / total) * 100 : 0;
            const isAllDone = total > 0 && done >= total;
            const dayNum = Number(format(parseISO(date), 'd'));
            return (
              <button
                key={date}
                type="button"
                className={[
                  'td-day',
                  isToday && 'is-today',
                  isSelected && 'is-selected',
                  dow === 0 && 'is-sun',
                  dow === 6 && 'is-sat',
                ].filter(Boolean).join(' ')}
                onClick={() => onSelectDate(date)}
                aria-selected={isSelected}
                title={`${date} · 완료 ${done}/${total}`}
              >
                <span className="td-day-dow">{DOW_LABELS[dow]}</span>
                <span className="td-day-num">{dayNum}</span>
                <span className="td-day-count">{total === 0 ? '—' : `${done}/${total}`}</span>
                <span className="td-day-bar" aria-hidden="true">
                  <span
                    className={`td-day-bar-fill ${isAllDone ? 'is-done' : ''}`}
                    style={{ width: `${fillPct}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="td-week-nav"
          aria-label="다음 날"
          title="다음 날"
          onClick={() => onSelectDate(getNextDay(selectedDate))}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
