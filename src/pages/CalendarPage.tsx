import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipe } from '../hooks/useSwipe';
import { useRubberBandScroll } from '../hooks/useRubberBandScroll';
import {
  fetchCalendarData,
  fetchCategories,
  createTask,
  updateTask,
} from "../lib/database";
import {
  getMonthCalendarGrid,
  formatDate,
  formatMonthYear,
  getTodayString,
} from "../utils/dateUtils";
import type { CalendarCellData, Category, Schedule } from "../types";
import { buildTaskTree } from "../utils/taskUtils";
import TaskInput from "../components/tasks/TaskInput";
import TaskTree from "../components/tasks/TaskTree";
import ScheduleModal from "../components/schedules/ScheduleModal";
import ScheduleSection from "../components/schedules/ScheduleSection";
import type { Task } from "../types";

import "./Pages.css";

const BAR_HEIGHT = 16;
const BAR_GAP = 2;

type ScheduleBar = {
  schedule: Schedule;
  startCol: number;
  endCol: number;
  lane: number;
  isActualStart: boolean;
  isActualEnd: boolean;
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const today = getTodayString();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [calendarData, setCalendarData] = useState<CalendarCellData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewMode, setViewMode] = useState<"tree" | "leaf">("tree");

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);

  // Touch and Long Press state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);

  // 월 전환 슬라이드 애니메이션
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [animKey, setAnimKey] = useState(0);

  const modalBodyRef = useRubberBandScroll<HTMLDivElement>();



  useEffect(() => {
    fetchCategories().then(setCategories).catch(console.error);
  }, []);

  const getCategoryColor = (categoryId?: string | null) => {
    if (!categoryId) return undefined;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || undefined;
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchCalendarData(year, month, (fresh) => {
          // Stale-while-revalidate: update once the background refresh resolves
          if (!cancelled) setCalendarData(fresh);
        });
        if (!cancelled) setCalendarData(data);
      } catch (err) {
        console.error("Failed to load calendar data:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [year, month]);
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

  const getCellData = (dateStr: string): CalendarCellData | undefined => {
    return calendarData.find((c) => c.date === dateStr);
  };

  // Compute schedule bars with lane assignment for each week
  const computeWeekBars = (week: (Date | null)[]): ScheduleBar[] => {
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
    return items.map((item) => {
      let lane = 0;
      while (lane < laneEnd.length && laneEnd[lane] >= item.startCol) lane++;
      laneEnd[lane] = item.endCol;
      return { ...item, lane };
    });
  };

  const handleMouseDown = (dateStr: string, e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('.calendar-task-item') || target.closest('.calendar-task-more') || target.closest('.calendar-cell-date') || target.closest('.schedule-bar')) {
      return;
    }
    setIsDragging(true);
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  const handleMouseEnter = (dateStr: string) => {
    if (isDragging) {
      setDragEnd(dateStr);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      if (dragStart && dragEnd) {
        if (dragStart === dragEnd) {
          // It's a click, trigger normal cell click
          handleCellClick(dragStart);
        } else {
          // It's a drag, open schedule modal
          setSelectedSchedule(null);
          setShowScheduleModal(true);
        }
      }
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

      if (dragStart && dragEnd && dragStart !== dragEnd) {
        setSelectedSchedule(null);
        setShowScheduleModal(true);
      } else if (dragStart === dragEnd) {
        // Just long pressed on a single cell, maybe open schedule modal too
        setSelectedSchedule(null);
        setShowScheduleModal(true);
      }

      // Prevent the click event that might follow
      if (e.cancelable) e.preventDefault();
    }
  };

  const handleCellClick = (dateStr: string) => {
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
    setDragStart(schedule.start_date);
    setDragEnd(schedule.end_date);
    setIsDragging(false);
    setShowScheduleModal(true);
  };

  const selectedCellSchedules = useMemo(() => {
    if (!selectedDate) return [] as Schedule[];
    return getCellData(selectedDate)?.schedules ?? [];
  }, [selectedDate, calendarData]);

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
          <span className="calendar-month-label">
            {formatMonthYear(new Date(year, month - 1))}
          </span>
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

        <div
          ref={calendarGridRef}
          key={animKey}
          className={`calendar-grid ${slideDirection === 'right' ? 'slide-enter-right' : ''} ${slideDirection === 'left' ? 'slide-enter-left' : ''}`}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { if (isDragging) handleMouseUp(); }}
          onTouchMove={handleTouchMove}
          onAnimationEnd={() => setSlideDirection(null)}
        >
          <div className="calendar-header-row">
            {dayLabels.map((day) => (
              <div
                key={day}
                className={`calendar-header-cell ${day === "일" ? "sunday" : ""} ${day === "토" ? "saturday" : ""}`}
              >
                {day}
              </div>
            ))}
          </div>

          {weeks.map((week, wIdx) => {
            const bars = computeWeekBars(week);
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
                        {tasks.length > 0 && (
                          <div className="calendar-cell-tasks">
                            {tasks.slice(0, 3).map((task) => {
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
                                >
                                  <span className="calendar-task-title">
                                    {task.title ? task.title : "제목 없음"}
                                  </span>
                                </div>
                              );
                            })}
                            {tasks.length > 3 && (
                              <div className="calendar-task-more">
                                +{tasks.length - 3}
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
                      const resolveDateFromX = (clientX: number): string => {
                        if (calendarGridRef.current) {
                          const cells = calendarGridRef.current.querySelectorAll('.calendar-cell[data-date]');
                          for (const cell of Array.from(cells)) {
                            const r = cell.getBoundingClientRect();
                            if (clientX >= r.left && clientX <= r.right) {
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
                            ...(catColor ? { background: catColor } : undefined),
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCellClick(resolveDateFromX(e.clientX));
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


        {showScheduleModal && dragStart && dragEnd && (
          <ScheduleModal
            startDate={dragStart <= dragEnd ? dragStart : dragEnd}
            endDate={dragStart <= dragEnd ? dragEnd : dragStart}
            schedule={selectedSchedule}
            onClose={() => {
              setShowScheduleModal(false);
              setDragStart(null);
              setDragEnd(null);
              setSelectedSchedule(null);
            }}
            onSave={async () => {
              const freshData = await fetchCalendarData(year, month);
              setCalendarData(freshData);
              setShowScheduleModal(false);
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
            onClick={() => {
              setSelectedDate(null);
              setViewMode("tree");
            }}
          >
            <div
              className="modal-content calendar-day-modal"
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                height: "85vh",
                maxHeight: "85vh",
                maxWidth: "480px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "8px",
                  borderBottom: "1px solid var(--border-light)",
                  marginBottom: "12px",
                }}
              >
                <h2
                  style={{ margin: 0, cursor: "pointer", fontSize: "1.05rem" }}
                  onClick={() => handleNavigate(selectedDate)}
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
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    className={`btn btn-sm ${viewMode === "tree" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setViewMode("tree")}
                    title="최상위 작업"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="8" y1="6" x2="21" y2="6"></line>
                      <line x1="8" y1="12" x2="21" y2="12"></line>
                      <line x1="8" y1="18" x2="21" y2="18"></line>
                      <line x1="3" y1="6" x2="3.01" y2="6"></line>
                      <line x1="3" y1="12" x2="3.01" y2="12"></line>
                      <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                  </button>
                  <button
                    className={`btn btn-sm ${viewMode === "leaf" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setViewMode("leaf")}
                    title="최하위 작업"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="3" y1="6" x2="21" y2="6"></line>
                      <line x1="3" y1="12" x2="21" y2="12"></line>
                      <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div
                ref={modalBodyRef}
                className="modal-body-scroll"
                style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}
              >
                {/* 일정 섹션 */}
                <section className="modal-section">
                  <div className="modal-section-header">
                    <h3 className="modal-section-title">일정</h3>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setSelectedSchedule(null);
                        setDragStart(selectedDate);
                        setDragEnd(selectedDate);
                        setShowScheduleModal(true);
                      }}
                    >
                      + 일정 등록
                    </button>
                  </div>
                  <ScheduleSection
                    schedules={selectedCellSchedules}
                    onEdit={(s) => openScheduleBar(s)}
                    emptyText="이 날짜에 걸쳐있는 일정이 없습니다."
                  />
                </section>

                {/* 작업 섹션 */}
                <section className="modal-section">
                  <div className="modal-section-header">
                    <h3 className="modal-section-title">작업</h3>
                  </div>
                  <div className="modal-task-list">
                    {(() => {
                      const allTasks = (getCellData(selectedDate)?.tasks || []).filter(t => !t.is_snapshot);

                      // Remove duplicates based on task_id
                      const uniqueTasksMap = new Map();
                      for (const t of allTasks) {
                        if (!uniqueTasksMap.has(t.task_id)) {
                          uniqueTasksMap.set(t.task_id, t);
                        }
                      }
                      const uniqueTasks = Array.from(uniqueTasksMap.values());

                      let displayTasks = uniqueTasks;
                      if (viewMode === "tree") {
                        displayTasks = uniqueTasks.filter((t) => !t.parent_id);
                      } else {
                        const parentIds = new Set(
                          uniqueTasks.map((t) => t.parent_id).filter(Boolean),
                        );
                        displayTasks = uniqueTasks.filter(
                          (t) => !parentIds.has(t.task_id),
                        );
                      }

                      if (displayTasks.length === 0) {
                        return (
                          <p
                            style={{
                              color: "var(--text-muted)",
                              textAlign: "center",
                              padding: "16px 0",
                              margin: 0,
                            }}
                          >
                            등록된 작업이 없습니다.
                          </p>
                        );
                      }

                      // Map to Task array
                      const mockTasks = uniqueTasks.map(t => ({
                        id: t.task_id,
                        user_id: t.user_id,
                        parent_id: t.parent_id || null,
                        category_id: t.category_id || null,
                        title: t.title || "제목 없음",
                        description: null,
                        status: t.status,
                        low_priority: false,
                        created_date: t.snapshot_date,
                        completed_at: null,
                        discarded_at: null,
                        sort_order: 0,
                        created_at: t.created_at,
                        updated_at: t.created_at,
                        is_snapshot: true // keep true to disable checkbox
                      } as Task));

                      // build tree
                      const treeRoots = buildTaskTree(mockTasks);
                      const displayRoots = viewMode === "tree" ? treeRoots : mockTasks.filter(t => displayTasks.some(dt => dt.task_id === t.id));

                      return (
                        <TaskTree
                          tasks={displayRoots}
                          onComplete={() => {}}
                          onUncomplete={() => {}}
                          onDiscard={() => {}}
                          onUndiscard={() => {}}
                          onDelete={() => {}}
                          onUpdateSettings={async (id, updates) => {
                            try {
                              await updateTask(id, updates);
                              const freshData = await fetchCalendarData(year, month);
                              setCalendarData(freshData);
                            } catch (e) {
                              console.error("Failed to update task", e);
                            }
                          }}
                          onAddChild={() => {}}
                          onSaveDescription={() => {}}
                          showAddInput={false}
                        />
                      );
                    })()}
                  </div>
                </section>
              </div>

              {selectedDate === today && (
                <div
                  style={{
                    marginTop: "12px",
                    borderTop: "1px solid var(--border-light)",
                    paddingTop: "12px",
                  }}
                >
                  <TaskInput
                    onAdd={async (title) => {
                      try {
                        await createTask({ title, created_date: selectedDate });
                        const freshData = await fetchCalendarData(year, month);
                        setCalendarData(freshData);
                      } catch (e) {
                        console.error("Failed to create task", e);
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
