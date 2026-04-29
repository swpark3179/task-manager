import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipe } from '../hooks/useSwipe';
import { useRubberBandScroll } from '../hooks/useRubberBandScroll';
import {
  fetchCalendarData,
  fetchCategories,
} from "../lib/database";
import {
  getMonthCalendarGrid,
  formatDate,
  formatMonthYear,
  getTodayString,
} from "../utils/dateUtils";
import type { CalendarCellData, Category, Schedule } from "../types";
import { getCalendarFromMemoryCacheSync } from "../lib/cache";
import ScheduleModal from "../components/schedules/ScheduleModal";
import DayView from "../components/day/DayView";
import { useSyncStatus } from "../components/common/SyncIndicator";

import { getContrastColor } from "../utils/colorUtils";
import "./Pages.css";

const BAR_HEIGHT = 16;
const BAR_GAP = 2;
// Combined cap on schedules + tasks displayed in a single calendar cell.
// Anything beyond this is collapsed into a single "+N" indicator so cells
// stay legible when a day has many items.
const MAX_VISIBLE_PER_CELL = 3;

type ScheduleBar = {
  schedule: Schedule;
  startCol: number;
  endCol: number;
  lane: number;
  isActualStart: boolean;
  isActualEnd: boolean;
};

type WeekBarsResult = {
  visibleBars: ScheduleBar[];
  hiddenBars: ScheduleBar[];
};

type ScheduleModalRange = {
  start: string;
  end: string;
};

const DAY_MODAL_CLOSE_DRAG_THRESHOLD = 120;

function normalizeDateRange(start: string, end: string): ScheduleModalRange {
  return start <= end ? { start, end } : { start: end, end: start };
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const today = getTodayString();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [calendarData, setCalendarData] = useState<CalendarCellData[]>(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return getCalendarFromMemoryCacheSync(ym) || [];
  });
  const [loading, setLoading] = useState(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return !getCalendarFromMemoryCacheSync(ym);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const syncStatus = useSyncStatus();

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalRange, setScheduleModalRange] = useState<ScheduleModalRange | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [dayModalDragOffset, setDayModalDragOffset] = useState(0);
  const [isDayModalDragging, setIsDayModalDragging] = useState(false);

  // Touch and Long Press state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const dayModalDragStartYRef = useRef<number | null>(null);
  const dayModalDragOffsetRef = useRef(0);
  const suppressDayModalTitleClickRef = useRef(false);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const previousSyncStatusRef = useRef(syncStatus);

  // 월 전환 슬라이드 애니메이션
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [animKey, setAnimKey] = useState(0);

  // 년/월 선택 피커
  const [showYearMonthPicker, setShowYearMonthPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);
  const yearMonthPickerRef = useRef<HTMLDivElement>(null);

  const modalBodyRef = useRubberBandScroll<HTMLDivElement>();

  useEffect(() => {
    if (!showYearMonthPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (yearMonthPickerRef.current && !yearMonthPickerRef.current.contains(e.target as Node)) {
        setShowYearMonthPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showYearMonthPicker]);



  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  const getCategoryColor = (categoryId?: string | null) => {
    if (!categoryId) return undefined;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || undefined;
  };

  const loadCalendarData = useCallback(async (cancelledRef?: { current: boolean }) => {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const memoryHit = getCalendarFromMemoryCacheSync(yearMonth);

    // 메모리 캐시 히트 시: 스피너 없이 즉시 반영
    if (memoryHit) {
      if (!cancelledRef?.current) {
        setCalendarData(memoryHit);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await fetchCalendarData(year, month, (fresh) => {
        // Stale-while-revalidate: update once the background refresh resolves
        if (!cancelledRef?.current) setCalendarData(fresh);
      });
      if (!cancelledRef?.current) setCalendarData(data);
    } catch (err) {
      console.error("Failed to load calendar data:", err);
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, [year, month]);

  // 월 전환 시 메모리 캐시가 있으면 즉시 표시 (스피너 깜빡임 방지)
  useEffect(() => {
    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
    const memoryHit = getCalendarFromMemoryCacheSync(yearMonth);
    if (memoryHit) {
      setCalendarData(memoryHit);
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    const cancelledRef = { current: false };
    void loadCalendarData(cancelledRef);
    return () => {
      cancelledRef.current = true;
    };
  }, [loadCalendarData]);

  useEffect(() => {
    const previousStatus = previousSyncStatusRef.current;
    previousSyncStatusRef.current = syncStatus;

    if (previousStatus === 'syncing' && syncStatus === 'synced') {
      void loadCalendarData();
    }
  }, [loadCalendarData, syncStatus]);
  // Lock body scroll and swipe when dragging in mobile
  useEffect(() => {
    if (isDragging && isLongPressTriggeredRef.current) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isDragging]);

  // Defensive cleanup: if a pointer is released outside the grid or the window
  // loses focus mid-drag, force-clear the selection so cells don't stay
  // highlighted. The grid's own onMouseUp/onMouseLeave already handles the
  // common path; this guards the rare cases (alt-tab, release on overlay, etc.).
  useEffect(() => {
    if (!isDragging && !dragStart && !dragEnd) return;
    const clearDragState = () => {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') clearDragState();
    };
    window.addEventListener('blur', clearDragState);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('blur', clearDragState);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isDragging, dragStart, dragEnd]);

  const grid = getMonthCalendarGrid(year, month);

  const weeks = useMemo(() => {
    const out: (Date | null)[][] = [];
    for (let i = 0; i < grid.length; i += 7) {
      out.push(grid.slice(i, i + 7));
    }
    return out;
  }, [grid]);

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  const prevMonth = () => {
    setSlideDirection('left');
    setAnimKey((k) => k + 1);
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    setSlideDirection('right');
    setAnimKey((k) => k + 1);
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const swipeHandlers = useSwipe({
    onSwipedLeft: nextMonth,
    onSwipedRight: prevMonth,
    minSwipeDistance: 110,
    horizontalRatio: 1.2,
  });

  const goToToday = () => {
    const now = new Date();
    const isSameMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    if (!isSameMonth) {
      const goingForward =
        now.getFullYear() > year || (now.getFullYear() === year && now.getMonth() + 1 > month);
      setSlideDirection(goingForward ? 'right' : 'left');
      setAnimKey((k) => k + 1);
    }
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const handlePickMonth = (targetMonth: number) => {
    const targetYear = pickerYear;
    if (targetYear === year && targetMonth === month) {
      setShowYearMonthPicker(false);
      return;
    }
    const goingForward =
      targetYear > year || (targetYear === year && targetMonth > month);
    setSlideDirection(goingForward ? 'right' : 'left');
    setAnimKey((k) => k + 1);
    setYear(targetYear);
    setMonth(targetMonth);
    setShowYearMonthPicker(false);
  };

  const toggleYearMonthPicker = () => {
    setPickerYear(year);
    setShowYearMonthPicker((v) => !v);
  };

  const getCellData = (dateStr: string): CalendarCellData | undefined => {
    return calendarData.find((c) => c.date === dateStr);
  };

  // Compute schedule bars with lane assignment for each week
  const computeWeekBars = (week: (Date | null)[]): WeekBarsResult => {
    const scheduleMap = new Map<string, Schedule>();
    for (const d of week) {
      if (!d) continue;
      const ds = formatDate(d);
      const cell = getCellData(ds);
      cell?.schedules?.forEach((s) => scheduleMap.set(s.id, s));
    }

    type Pending = Omit<ScheduleBar, "lane">;
    const items: Pending[] = [];
    for (const schedule of scheduleMap.values()) {
      const sStr = schedule.start_date.split("T")[0];
      const eStr = schedule.end_date.split("T")[0];
      let startCol = -1;
      let endCol = -1;
      week.forEach((d, idx) => {
        if (!d) return;
        const ds = formatDate(d);
        if (ds >= sStr && ds <= eStr) {
          if (startCol === -1) startCol = idx;
          endCol = idx;
        }
      });
      if (startCol === -1) continue;
      items.push({
        schedule,
        startCol,
        endCol,
        isActualStart: formatDate(week[startCol]!) === sStr,
        isActualEnd: formatDate(week[endCol]!) === eStr,
      });
    }

    // Order: earliest startCol first, longer spans first, then stable by start_date/id
    items.sort((a, b) => {
      if (a.startCol !== b.startCol) return a.startCol - b.startCol;
      const aDur = a.endCol - a.startCol;
      const bDur = b.endCol - b.startCol;
      if (aDur !== bDur) return bDur - aDur;
      if (a.schedule.start_date !== b.schedule.start_date) {
        return a.schedule.start_date < b.schedule.start_date ? -1 : 1;
      }
      return a.schedule.id < b.schedule.id ? -1 : 1;
    });

    // Greedy lane assignment
    const laneEnd: number[] = [];
    const allBars: ScheduleBar[] = items.map((item) => {
      let lane = 0;
      while (lane < laneEnd.length && laneEnd[lane] >= item.startCol) lane++;
      laneEnd[lane] = item.endCol;
      return { ...item, lane };
    });

    // Cap visible lanes so that schedule bars never exceed MAX_VISIBLE_PER_CELL.
    // Bars assigned to lanes beyond the cap are kept aside and surfaced as part
    // of the per-cell overflow indicator instead of being rendered.
    const visibleBars = allBars.filter((b) => b.lane < MAX_VISIBLE_PER_CELL);
    const hiddenBars = allBars.filter((b) => b.lane >= MAX_VISIBLE_PER_CELL);
    return { visibleBars, hiddenBars };
  };

  const handleMouseDown = (dateStr: string, e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.calendar-task-item') || target.closest('.calendar-task-more') || target.closest('.calendar-cell-date') || target.closest('.schedule-bar')) {
      return;
    }
    // Defer isDragging until the pointer actually moves to another cell so a
    // simple click never visibly highlights the cell as "selected".
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  const handleMouseEnter = (dateStr: string) => {
    if (!dragStart) return;
    if (!isDragging && dateStr !== dragStart) {
      setIsDragging(true);
    }
    setDragEnd(dateStr);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      window.getSelection()?.removeAllRanges();
      if (dragStart && dragEnd && dragStart !== dragEnd) {
        // Real multi-cell drag: open schedule modal
        setSelectedSchedule(null);
        setScheduleModalRange(normalizeDateRange(dragStart, dragEnd));
        setShowScheduleModal(true);
      } else if (dragStart) {
        // Drag returned to its origin: behave like a normal click
        handleCellClick(dragStart);
      }
      setDragStart(null);
      setDragEnd(null);
    } else if (dragStart || dragEnd) {
      // Mouse released without ever starting a drag — clear pending state.
      // The cell's onClick handler will open the day modal as usual.
      setDragStart(null);
      setDragEnd(null);
    }
  };
  const handleTouchStart = (dateStr: string, e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;

    // Check if touch is on a task item, if so we don't want to start dragging the cell
    const target = e.target as HTMLElement;
    if (target.closest('.calendar-task-item') || target.closest('.calendar-task-more') || target.closest('.calendar-cell-date') || target.closest('.schedule-bar')) {
      return;
    }

    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressTriggeredRef.current = false;

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    longPressTimerRef.current = setTimeout(() => {
      isLongPressTriggeredRef.current = true;
      setIsDragging(true);
      setDragStart(dateStr);
      setDragEnd(dateStr);
      // Haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(50);
      }
    }, 500); // 500ms for long press
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // If moved significantly before long press triggers, cancel long press
    if (!isLongPressTriggeredRef.current && (dx > 10 || dy > 10)) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }

    if (isLongPressTriggeredRef.current && isDragging) {
      // Prevent scrolling while dragging
      e.preventDefault();

      // Find which cell we are currently hovering over
      if (calendarGridRef.current) {
        const cells = calendarGridRef.current.querySelectorAll('.calendar-cell[data-date]');
        for (const cell of Array.from(cells)) {
          const rect = cell.getBoundingClientRect();
          if (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
          ) {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr) {
              setDragEnd(dateStr);
            }
            break;
          }
        }
      }
    }
  };

  const handleTouchEnd = (_dateStr: string, e: React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    touchStartPosRef.current = null;

    if (isLongPressTriggeredRef.current) {
      // It was a long press drag
      isLongPressTriggeredRef.current = false;
      setIsDragging(false);
      window.getSelection()?.removeAllRanges();

      if (dragStart && dragEnd && dragStart !== dragEnd) {
        setSelectedSchedule(null);
        setScheduleModalRange(normalizeDateRange(dragStart, dragEnd));
        setShowScheduleModal(true);
      } else if (dragStart && dragStart === dragEnd) {
        // Just long pressed on a single cell, maybe open schedule modal too
        setSelectedSchedule(null);
        setScheduleModalRange(normalizeDateRange(dragStart, dragStart));
        setShowScheduleModal(true);
      }

      setDragStart(null);
      setDragEnd(null);

      // Prevent the click event that might follow
      if (e.cancelable) e.preventDefault();
    }
  };

  const handleCellClick = (dateStr: string) => {
    setDragStart(null);
    setDragEnd(null);
    setSelectedDate(dateStr);
  };
  const handleNavigate = (dateStr: string) => {
    if (dateStr === today) {
      navigate("/");
    } else {
      navigate(`/history/${dateStr}`);
    }
  };

  const openScheduleBar = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setScheduleModalRange(normalizeDateRange(schedule.start_date, schedule.end_date));
    setDragStart(null);
    setDragEnd(null);
    setIsDragging(false);
    setShowScheduleModal(true);
  };

  const closeDayModal = () => {
    setSelectedDate(null);
    dayModalDragOffsetRef.current = 0;
    setDayModalDragOffset(0);
    setIsDayModalDragging(false);
    dayModalDragStartYRef.current = null;
    suppressDayModalTitleClickRef.current = false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showScheduleModal) {
          return;
        }
        if (selectedDate) {
          closeDayModal();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDate, showScheduleModal, closeDayModal]);

  const handleDayModalHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    dayModalDragStartYRef.current = e.clientY;
    dayModalDragOffsetRef.current = 0;
    suppressDayModalTitleClickRef.current = false;
    setIsDayModalDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDayModalHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dayModalDragStartYRef.current === null) return;
    const offset = Math.max(0, e.clientY - dayModalDragStartYRef.current);
    if (offset > 6) suppressDayModalTitleClickRef.current = true;
    dayModalDragOffsetRef.current = offset;
    setDayModalDragOffset(offset);
  };

  const finishDayModalHeaderDrag = () => {
    if (dayModalDragStartYRef.current === null) return;
    const shouldClose = dayModalDragOffsetRef.current >= DAY_MODAL_CLOSE_DRAG_THRESHOLD;
    dayModalDragStartYRef.current = null;
    dayModalDragOffsetRef.current = 0;
    setIsDayModalDragging(false);
    setDayModalDragOffset(0);
    if (shouldClose) closeDayModal();
  };

  return (
    <div className="page calendar-page" {...swipeHandlers}>
      <div className="page-content">
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={prevMonth} aria-label="이전 달">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="calendar-month-picker-wrapper" ref={yearMonthPickerRef}>
            <button className="calendar-month-label" onClick={toggleYearMonthPicker} type="button">
              {formatMonthYear(new Date(year, month - 1))}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transform: showYearMonthPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showYearMonthPicker && (
              <div className="year-month-picker">
                <div className="year-month-picker-year-row">
                  <button type="button" className="year-month-picker-arrow" onClick={() => setPickerYear((y) => y - 1)} aria-label="이전 년도">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                  </button>
                  <span className="year-month-picker-year">{pickerYear}년</span>
                  <button type="button" className="year-month-picker-arrow" onClick={() => setPickerYear((y) => y + 1)} aria-label="다음 년도">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                  </button>
                </div>
                <div className="year-month-picker-grid">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`year-month-picker-month ${pickerYear === year && m === month ? 'active' : ''} ${pickerYear === new Date().getFullYear() && m === new Date().getMonth() + 1 ? 'current' : ''}`}
                      onClick={() => handlePickMonth(m)}
                    >
                      {m}월
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="calendar-nav-btn" onClick={nextMonth} aria-label="다음 달">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button className="calendar-nav-today" onClick={goToToday} aria-label="오늘로 이동">
            오늘
          </button>
        </div>

        <div className="calendar-header-row calendar-header-fixed">
          {dayLabels.map((day) => (
            <div
              key={day}
              className={`calendar-header-cell ${day === "일" ? "sunday" : ""} ${day === "토" ? "saturday" : ""}`}
            >
              {day}
            </div>
          ))}
        </div>

        <div
          ref={calendarGridRef}
          key={animKey}
          className={`calendar-grid ${slideDirection === 'right' ? 'slide-enter-right' : ''} ${slideDirection === 'left' ? 'slide-enter-left' : ''}`}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isDragging) handleMouseUp(); }}
          onTouchMove={handleTouchMove}
          onAnimationEnd={() => setSlideDirection(null)}
        >
          {weeks.map((week, wIdx) => {
            const { visibleBars: bars, hiddenBars } = computeWeekBars(week);
            const laneCount = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
            const laneAreaHeight = laneCount * (BAR_HEIGHT + BAR_GAP);

            const perCellLaneHeight: number[] = week.map((_, cIdx) => {
              let maxLane = -1;
              for (const bar of bars) {
                if (cIdx >= bar.startCol && cIdx <= bar.endCol) {
                  if (bar.lane > maxLane) maxLane = bar.lane;
                }
              }
              return maxLane === -1 ? 0 : (maxLane + 1) * (BAR_HEIGHT + BAR_GAP);
            });

            // Number of schedule lanes occupying each cell (capped) and the count of
            // schedules that pass through each cell but were dropped because they
            // exceeded the lane cap.
            const perCellVisibleScheduleCount: number[] = week.map((_, cIdx) =>
              bars.reduce(
                (n, b) => (cIdx >= b.startCol && cIdx <= b.endCol ? n + 1 : n),
                0,
              ),
            );
            const perCellHiddenScheduleCount: number[] = week.map((_, cIdx) =>
              hiddenBars.reduce(
                (n, b) => (cIdx >= b.startCol && cIdx <= b.endCol ? n + 1 : n),
                0,
              ),
            );

            return (
              <div
                key={`week-${wIdx}`}
                className="calendar-week-row"
              >
                {week.map((date, cIdx) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${wIdx}-${cIdx}`}
                        className="calendar-cell empty"
                      />
                    );
                  }

                  const dateStr = formatDate(date);
                  const cellData = getCellData(dateStr);
                  const isToday = dateStr === today;
                  const dayOfWeek = date.getDay();
                  const isSunday = dayOfWeek === 0;
                  const isSaturday = dayOfWeek === 6;
                  const tasks = (cellData?.tasks || []).filter(t => !t.is_snapshot);

                  // Combined display cap: schedules occupy lane slots first, tasks
                  // fill the remainder, and any leftover items collapse into a
                  // single "+N" indicator so cells stay readable.
                  const lanesAtCell = perCellVisibleScheduleCount[cIdx];
                  const hiddenSchedulesAtCell = perCellHiddenScheduleCount[cIdx];
                  const taskSlots = Math.max(0, MAX_VISIBLE_PER_CELL - lanesAtCell);
                  const visibleTasks = tasks.slice(0, taskSlots);
                  const overflowCount =
                    hiddenSchedulesAtCell + Math.max(0, tasks.length - visibleTasks.length);

                  return (
                    <div
                      key={dateStr}
                      data-date={dateStr}
                      className={`calendar-cell ${isToday ? "today" : ""} ${cellData ? "has-data" : ""} ${isSunday ? "sunday" : ""} ${isSaturday ? "saturday" : ""} ${isDragging && dragStart && dragEnd && ((dragStart <= dragEnd && dateStr >= dragStart && dateStr <= dragEnd) || (dragStart > dragEnd && dateStr <= dragStart && dateStr >= dragEnd)) ? "selected" : ""}`}
                      style={{ ['--cell-lane-height' as string]: `${perCellLaneHeight[cIdx]}px` }}
                      onMouseDown={(e) => handleMouseDown(dateStr, e)}
                      onMouseEnter={() => handleMouseEnter(dateStr)}
                      onTouchStart={(e) => handleTouchStart(dateStr, e)}
                      onTouchEnd={(e) => handleTouchEnd(dateStr, e)}
                      onClick={() => handleCellClick(dateStr)}
                    >
                      <span className="calendar-cell-date">{date.getDate()}</span>
                      <div className="calendar-cell-body">
                        {(visibleTasks.length > 0 || overflowCount > 0) && (
                          <div className="calendar-cell-tasks">
                            {visibleTasks.map((task) => {
                              const catColor = getCategoryColor(task.category_id);
                              return (
                                <div
                                  key={task.id}
                                  className={`calendar-task-item ${task.status}`}
                                  style={
                                    catColor
                                      ? { borderLeft: `3px solid ${catColor}` }
                                      : undefined
                                  }
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCellClick(dateStr);
                                  }}
                                >
                                  <span className="calendar-task-title">
                                    {task.title ? task.title : "제목 없음"}
                                  </span>
                                </div>
                              );
                            })}
                            {overflowCount > 0 && (
                              <div
                                className="calendar-task-more"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCellClick(dateStr);
                                }}
                              >
                                +{overflowCount}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {bars.length > 0 && (
                  <div
                    className="schedule-lane-overlay"
                    style={{ height: `${laneAreaHeight}px` }}
                  >
                    {bars.map((bar) => {
                      const continuesLeft = !bar.isActualStart;
                      const continuesRight = !bar.isActualEnd;
                      const showTitle = bar.isActualStart || bar.startCol === 0;
                      const catColor = getCategoryColor(bar.schedule.category_id);
                      const fallbackDate = bar.schedule.start_date.split('T')[0];
                      const resolveDateFromPoint = (clientX: number, clientY: number): string => {
                        if (calendarGridRef.current) {
                          const cells = calendarGridRef.current.querySelectorAll('.calendar-cell[data-date]');
                          for (const cell of Array.from(cells)) {
                            const r = cell.getBoundingClientRect();
                            if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
                              const d = cell.getAttribute('data-date');
                              if (d) return d;
                            }
                          }
                        }
                        return fallbackDate;
                      };
                      return (
                        <div
                          key={`${bar.schedule.id}-w${wIdx}`}
                          className={`schedule-bar ${continuesLeft ? "continues-left" : ""} ${continuesRight ? "continues-right" : ""}`}
                          style={{
                            gridColumn: `${bar.startCol + 1} / ${bar.endCol + 2}`,
                            gridRow: bar.lane + 1,
                            ...(catColor ? { background: catColor, color: getContrastColor(catColor) } : undefined),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(resolveDateFromPoint(e.clientX, e.clientY));
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          title={bar.schedule.title}
                        >
                          <span className="schedule-bar-title">
                            {showTitle ? bar.schedule.title : "\u00A0"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>


        {showScheduleModal && scheduleModalRange && (
          <ScheduleModal
            startDate={scheduleModalRange.start}
            endDate={scheduleModalRange.end}
            schedule={selectedSchedule}
            onClose={() => {
              setShowScheduleModal(false);
              setScheduleModalRange(null);
              setDragStart(null);
              setDragEnd(null);
              setSelectedSchedule(null);
            }}
            onSave={async () => {
              const freshData = await fetchCalendarData(year, month);
              setCalendarData(freshData);
              setShowScheduleModal(false);
              setScheduleModalRange(null);
              setDragStart(null);
              setDragEnd(null);
              setSelectedSchedule(null);
            }}
          />
        )}
        {loading && (
          <div className="loading-container">
            <div className="loading-spinner" />
          </div>
        )}
        {selectedDate && (
          <div
            className="modal-overlay"
            onClick={closeDayModal}
          >
            <div
              className={`modal-content calendar-day-modal ${isDayModalDragging ? "dragging" : ""}`}
              style={{ ['--day-modal-drag-offset' as string]: `${dayModalDragOffset}px` }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <div
                className="calendar-day-modal-header"
                onPointerDown={handleDayModalHeaderPointerDown}
                onPointerMove={handleDayModalHeaderPointerMove}
                onPointerUp={finishDayModalHeaderDrag}
                onPointerCancel={finishDayModalHeaderDrag}
              >
                <h2
                  style={{ margin: 0, cursor: "pointer", fontSize: "1.05rem" }}
                  onClick={() => {
                    if (suppressDayModalTitleClickRef.current) {
                      suppressDayModalTitleClickRef.current = false;
                      return;
                    }
                    handleNavigate(selectedDate);
                  }}
                >
                  {selectedDate === today
                    ? "오늘의 작업"
                    : `${selectedDate} 작업`}{" "}
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      fontWeight: "normal",
                    }}
                  >
                    (go)
                  </span>
                </h2>
              </div>

              <div
                ref={modalBodyRef}
                className="modal-body-scroll"
                style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}
              >
                <DayView
                  key={selectedDate}
                  date={selectedDate}
                  isToday={selectedDate === today}
                  onMutate={() => {
                    void loadCalendarData();
                  }}
                />
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
