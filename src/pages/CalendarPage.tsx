import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipe } from '../hooks/useSwipe';
import { useRubberBandScroll } from '../hooks/useRubberBandScroll';
import {
  fetchCalendarData,
  fetchCategories,
  fetchHolidays,
} from "../lib/database";
import { getKoreanHolidaysForYear } from "../utils/koreanHolidays";
import {
  getMonthCalendarGrid,
  formatDate,
  formatMonthYear,
  getTodayString,
} from "../utils/dateUtils";
import type { CalendarCellData, Category, Schedule, Holiday } from "../types";
import { getCalendarFromMemoryCacheSync } from "../lib/cache";
import ScheduleModal from "../components/schedules/ScheduleModal";
import DayView from "../components/day/DayView";
import { useSyncStatus } from "../components/common/SyncIndicator";

import { getContrastColor } from "../utils/colorUtils";
import "./Pages.css";

const BAR_HEIGHT = 16;
const BAR_GAP = 2;
const ROW_PITCH = BAR_HEIGHT + BAR_GAP;
// Combined cap on events + schedules + tasks displayed in a single calendar
// cell. Anything beyond this is collapsed into a single "+N" indicator so
// cells stay legible when a day has many items. Events fill slots first,
// then schedules, then tasks.
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
  const [userHolidays, setUserHolidays] = useState<Holiday[]>([]);
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
  const [hiddenFilters, setHiddenFilters] = useState<Set<string>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterPanelRef = useRef<HTMLDivElement>(null);

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
    if (!showFilterPanel) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterPanelRef.current && !filterPanelRef.current.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFilterPanel]);



  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
    fetchHolidays().then(setUserHolidays).catch(console.error);
  }, []);

  // 표시 중인 연도의 빌트인 한국 공휴일 + 사용자 지정 항목을
  // (YYYY-MM-DD → Holiday[]) 맵으로 합쳐 둡니다. 매년 반복 항목은
  // 현재 보고 있는 연도로 펼쳐 줍니다.
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday[]>();
    const push = (h: Holiday) => {
      const arr = map.get(h.date);
      if (arr) arr.push(h);
      else map.set(h.date, [h]);
    };

    // 캘린더 그리드는 인접 달까지 일부 날짜를 포함하므로,
    // 표시 중인 연도와 그 양옆 연도까지 빌트인 공휴일을 펼쳐 둡니다.
    for (const y of [year - 1, year, year + 1]) {
      for (const h of getKoreanHolidaysForYear(y)) push(h);
    }

    for (const h of userHolidays) {
      if (h.recurring_yearly) {
        const md = h.date.slice(5); // MM-DD
        for (const y of [year - 1, year, year + 1]) {
          push({ ...h, date: `${y}-${md}` });
        }
      } else {
        push(h);
      }
    }

    return map;
  }, [year, userHolidays]);

  const getCategoryColor = (categoryId?: string | null) => {
    if (!categoryId) return undefined;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || undefined;
  };

  const filterItems = useMemo(() => {
    const holidayTypes = [
      { id: '__holiday', label: '공휴일', color: 'var(--nord11)' },
      { id: '__anniversary', label: '기념일', color: '#8b5cf6' },
      { id: '__birthday', label: '생일', color: '#ec4899' },
    ];
    const categoryItems = [
      ...categories.map(cat => ({
        id: cat.id,
        label: cat.name,
        color: cat.color || 'var(--accent-primary)',
      })),
      { id: '__no_category', label: '카테고리 없음', color: 'var(--text-muted)' },
    ];
    return { holidayTypes, categoryItems };
  }, [categories]);

  const toggleFilter = (filterId: string) => {
    setHiddenFilters(prev => {
      const next = new Set(prev);
      if (next.has(filterId)) next.delete(filterId);
      else next.add(filterId);
      return next;
    });
  };

  const clearFilters = () => setHiddenFilters(new Set());

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

  // Compute schedule bars with lane assignment for each week. `laneCap` is the
  // number of schedule lanes that fit after events have taken their slots at
  // the top of every cell in the week. Bars beyond the cap are surfaced via
  // the per-cell "+N" overflow indicator instead of being rendered.
  const computeWeekBars = (week: (Date | null)[], laneCap: number): WeekBarsResult => {
    const scheduleMap = new Map<string, Schedule>();
    for (const d of week) {
      if (!d) continue;
      const ds = formatDate(d);
      const cell = getCellData(ds);
      cell?.schedules?.forEach((s) => {
        const filterId = s.category_id ?? '__no_category';
        if (!hiddenFilters.has(filterId)) scheduleMap.set(s.id, s);
      });
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

    const cap = Math.max(0, laneCap);
    const visibleBars = allBars.filter((b) => b.lane < cap);
    const hiddenBars = allBars.filter((b) => b.lane >= cap);
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

  const closeDayModal = useCallback(() => {
    setSelectedDate(null);
    dayModalDragOffsetRef.current = 0;
    setDayModalDragOffset(0);
    setIsDayModalDragging(false);
    dayModalDragStartYRef.current = null;
    suppressDayModalTitleClickRef.current = false;
    // Defensive: ensure no cell stays highlighted after the day modal closes,
    // even if drag state lingered from the path that opened the modal.
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    // Mobile browsers keep :hover/:focus on the tapped cell until another
    // element is touched, which makes the previously selected cell appear
    // stuck in its highlighted state after the modal closes. Drop focus so
    // the cell visually deselects right away.
    if (typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
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
          <button
            className="calendar-nav-today"
            onClick={goToToday}
            aria-label="오늘로 이동"
            title="오늘로 이동"
          >
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
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
          <div className="calendar-filter-wrapper" ref={filterPanelRef}>
            <button
              type="button"
              className={`calendar-nav-btn calendar-filter-btn${hiddenFilters.size > 0 ? ' has-active' : ''}`}
              onClick={() => setShowFilterPanel(v => !v)}
              aria-label="카테고리 필터"
              title="카테고리 필터"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              {hiddenFilters.size > 0 && (
                <span className="calendar-filter-badge">{hiddenFilters.size}</span>
              )}
            </button>
            {showFilterPanel && (
              <div className="calendar-filter-panel">
                <div className="calendar-filter-panel-header">
                  <span className="calendar-filter-panel-title">필터</span>
                  {hiddenFilters.size > 0 && (
                    <button type="button" className="calendar-filter-reset" onClick={clearFilters}>
                      초기화
                    </button>
                  )}
                </div>
                <div className="calendar-filter-section">
                  <div className="calendar-filter-section-label">공휴일 유형</div>
                  <div className="calendar-filter-chips">
                    {filterItems.holidayTypes.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`calendar-filter-chip${hiddenFilters.has(item.id) ? ' chip-hidden' : ''}`}
                        style={{ '--chip-color': item.color } as React.CSSProperties}
                        onClick={() => toggleFilter(item.id)}
                      >
                        <span className="calendar-filter-chip-dot" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="calendar-filter-section">
                  <div className="calendar-filter-section-label">카테고리</div>
                  <div className="calendar-filter-chips">
                    {filterItems.categoryItems.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        className={`calendar-filter-chip${hiddenFilters.has(item.id) ? ' chip-hidden' : ''}`}
                        style={{ '--chip-color': item.color } as React.CSSProperties}
                        onClick={() => toggleFilter(item.id)}
                      >
                        <span className="calendar-filter-chip-dot" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
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
            // Per-cell event lists (filtered by the active category/type filters).
            const cellHolidaysPerCell = week.map((date) => {
              if (!date) return [] as Holiday[];
              const ds = formatDate(date);
              return (holidaysByDate.get(ds) || []).filter(
                (h) => !hiddenFilters.has(`__${h.type}`),
              );
            });

            // Events always render at the top of every cell and take priority
            // for slot allocation. Reserve a uniform height across the week so
            // the schedule overlay below stays aligned horizontally. Cap at
            // MAX_VISIBLE_PER_CELL so an absurdly busy day still leaves room
            // for the "+N" indicator below.
            const rawMaxEventsInWeek = cellHolidaysPerCell.reduce(
              (m, list) => Math.max(m, list.length),
              0,
            );
            const maxEventsInWeek = Math.min(rawMaxEventsInWeek, MAX_VISIBLE_PER_CELL);
            const eventAreaHeight = maxEventsInWeek * ROW_PITCH;

            // Lanes available to schedules after events have taken their slots.
            const laneCapForWeek = Math.max(0, MAX_VISIBLE_PER_CELL - maxEventsInWeek);
            const { visibleBars: bars, hiddenBars } = computeWeekBars(week, laneCapForWeek);
            const laneCount = bars.reduce((m, b) => Math.max(m, b.lane + 1), 0);
            const laneAreaHeight = laneCount * ROW_PITCH;

            const perCellLaneHeight: number[] = week.map((_, cIdx) => {
              let maxLane = -1;
              for (const bar of bars) {
                if (cIdx >= bar.startCol && cIdx <= bar.endCol) {
                  if (bar.lane > maxLane) maxLane = bar.lane;
                }
              }
              return maxLane === -1 ? 0 : (maxLane + 1) * ROW_PITCH;
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
                style={{ ['--week-events-height' as string]: `${eventAreaHeight}px` }}
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
                  const tasks = (cellData?.tasks || []).filter(t => {
                    if (t.is_snapshot) return false;
                    const filterId = t.category_id ?? '__no_category';
                    return !hiddenFilters.has(filterId);
                  });

                  const cellHolidays = cellHolidaysPerCell[cIdx];
                  const lanesAtCell = perCellVisibleScheduleCount[cIdx];
                  const hiddenSchedulesAtCell = perCellHiddenScheduleCount[cIdx];

                  // Priority: events > schedules > tasks. Events fill slots
                  // first, schedules take the remainder (via week-level lane
                  // assignment), and tasks fill whatever is left. Anything
                  // beyond the cap collapses into a single "+N" indicator.
                  const visibleEventCount = Math.min(cellHolidays.length, maxEventsInWeek);
                  const hiddenEventCount = cellHolidays.length - visibleEventCount;
                  const visibleEvents = cellHolidays.slice(0, visibleEventCount);
                  const taskSlots = Math.max(
                    0,
                    MAX_VISIBLE_PER_CELL - visibleEventCount - lanesAtCell,
                  );
                  const visibleTasks = tasks.slice(0, taskSlots);
                  const overflowCount =
                    hiddenEventCount +
                    hiddenSchedulesAtCell +
                    Math.max(0, tasks.length - visibleTasks.length);

                  const hasPublicHoliday = cellHolidays.some((h) => h.is_builtin || h.type === 'holiday');

                  return (
                    <div
                      key={dateStr}
                      data-date={dateStr}
                      className={`calendar-cell ${isToday ? "today" : ""} ${cellData ? "has-data" : ""} ${isSunday || hasPublicHoliday ? "sunday" : ""} ${isSaturday ? "saturday" : ""} ${isDragging && dragStart && dragEnd && ((dragStart <= dragEnd && dateStr >= dragStart && dateStr <= dragEnd) || (dragStart > dragEnd && dateStr <= dragStart && dateStr >= dragEnd)) ? "selected" : ""}`}
                      style={{
                        ['--cell-lane-height' as string]: `${perCellLaneHeight[cIdx]}px`,
                        ['--cell-events-height' as string]: `${eventAreaHeight}px`,
                      }}
                      onMouseDown={(e) => handleMouseDown(dateStr, e)}
                      onMouseEnter={() => handleMouseEnter(dateStr)}
                      onTouchStart={(e) => handleTouchStart(dateStr, e)}
                      onTouchEnd={(e) => handleTouchEnd(dateStr, e)}
                      onClick={() => handleCellClick(dateStr)}
                    >
                      <span className="calendar-cell-date">{date.getDate()}</span>
                      {maxEventsInWeek > 0 && (
                        <div className="calendar-cell-events">
                          {visibleEvents.map((h, i) => (
                            <div
                              key={`${h.id}-${i}`}
                              className={`calendar-holiday-item type-${h.type}`}
                              style={h.color ? { color: h.color } : undefined}
                              title={h.title}
                            >
                              {h.title}
                            </div>
                          ))}
                        </div>
                      )}
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
                            openScheduleBar(bar.schedule);
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
