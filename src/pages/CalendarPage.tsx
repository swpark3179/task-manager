import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSwipe } from '../hooks/useSwipe';
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
import type { CalendarCellData, Category } from "../types";
import { buildTaskTree } from "../utils/taskUtils";
import TaskInput from "../components/tasks/TaskInput";
import TaskTree from "../components/tasks/TaskTree";
import ScheduleModal from "../components/schedules/ScheduleModal";
import type { Task } from "../types";

import "./Pages.css";

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
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);

  // Touch and Long Press state
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressTriggeredRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);



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

  const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };

  const swipeHandlers = useSwipe({
    onSwipedLeft: nextMonth,
    onSwipedRight: prevMonth
  });

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const getCellData = (dateStr: string): CalendarCellData | undefined => {
    return calendarData.find((c) => c.date === dateStr);
  };

  const handleMouseDown = (dateStr: string, e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
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
    if (target.closest('.calendar-task-item') || target.closest('.calendar-task-more')) {
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
    } else {
      // It was a short tap, handle as click if it wasn't a swipe
      // The swipe hook will handle the swipe
      // For click, we might want to check if it moved much to distinguish from a failed swipe
      // We rely on handleCellClick being called by a normal onClick or onTouchEnd logic if needed
      // Actually handleCellClick handles this nicely in standard onClick so let's not interfere,
      // But we prevent default here if we handled it as a long press above.
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

  return (
    <div className="page calendar-page" {...swipeHandlers}>
      <div className="page-header">
        <div>
          <h1 className="page-title">달력</h1>
          <p className="page-subtitle">작업 현황을 한눈에 확인하세요</p>
        </div>
      </div>

      <div className="page-content">
        <div className="calendar-nav">
          <button className="date-navigator-btn" onClick={prevMonth}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="calendar-month-label">
            {formatMonthYear(new Date(year, month - 1))}
          </span>
          <button className="date-navigator-btn" onClick={nextMonth}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button className="date-navigator-today" onClick={goToToday}>
            오늘
          </button>
        </div>

        <div ref={calendarGridRef} className="calendar-grid" onMouseUp={handleMouseUp} onMouseLeave={() => { if (isDragging) handleMouseUp(); }} onTouchMove={handleTouchMove}>
          {/* Day headers */}
          {dayLabels.map((day) => (
            <div
              key={day}
              className={`calendar-header-cell ${day === "일" ? "sunday" : ""} ${day === "토" ? "saturday" : ""}`}
            >
              {day}
            </div>
          ))}

          {/* Date cells */}
          {grid.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} className="calendar-cell empty" />;
            }

            const dateStr = formatDate(date);
            const cellData = getCellData(dateStr);
            const isToday = dateStr === today;
            const dayOfWeek = date.getDay();
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            return (
              <div
                key={dateStr}
                data-date={dateStr}
                className={`calendar-cell ${isToday ? "today" : ""} ${cellData ? "has-data" : ""} ${isSunday ? "sunday" : ""} ${isSaturday ? "saturday" : ""} ${isDragging && dragStart && dragEnd && ((dragStart <= dragEnd && dateStr >= dragStart && dateStr <= dragEnd) || (dragStart > dragEnd && dateStr <= dragStart && dateStr >= dragEnd)) ? "selected" : ""}`}
                onMouseDown={(e) => handleMouseDown(dateStr, e)}
                onMouseEnter={() => handleMouseEnter(dateStr)}
                onTouchStart={(e) => handleTouchStart(dateStr, e)}
                onTouchEnd={(e) => handleTouchEnd(dateStr, e)}
                onClick={() => handleCellClick(dateStr)}
              >
                <span className="calendar-cell-date">{date.getDate()}</span>
                {cellData && ((cellData.tasks && cellData.tasks.length > 0) || (cellData.schedules && cellData.schedules.length > 0)) && (
                  <div className="calendar-cell-tasks">
                    {cellData.schedules && cellData.schedules.map(schedule => (
                      <div
                        key={schedule.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSchedule(schedule);
                          setDragStart(schedule.start_date);
                          setDragEnd(schedule.end_date);
                          setIsDragging(false);
                          setShowScheduleModal(true);
                        }}
                        className="calendar-task-item schedule-item"
                        style={{ backgroundColor: 'var(--accent-primary)', color: 'white', borderRadius: '4px', padding: '2px 4px', fontSize: '10px' }}
                      >
                        <span className="calendar-task-title">{schedule.title}</span>
                      </div>
                    ))}
                    {cellData.tasks.filter(t => !t.is_snapshot).slice(0, 3).map((task) => {
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
                            {task.title
                              ? task.title.length > 3
                                ? task.title.slice(0, 3) + "..."
                                : task.title
                              : "제목 없음"}
                          </span>
                        </div>
                      );
                    })}
                    {cellData.tasks.filter(t => !t.is_snapshot).length > 3 && (
                      <div className="calendar-task-more">
                        +{cellData.tasks.filter(t => !t.is_snapshot).length - 3}
                      </div>
                    )}
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
              className="modal-content"
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                maxHeight: "80vh",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingBottom: "8px",
                  borderBottom: "1px solid var(--border-light)",
                  marginBottom: "16px",
                }}
              >
                <h2
                  style={{ margin: 0, cursor: "pointer" }}
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
                className="modal-task-list"
                style={{ overflowY: "auto", flex: 1 }}
              >
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

              <div
                style={{
                  marginTop: "16px",
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: "16px",
                }}
              >
                {selectedDate === today && <TaskInput
                  onAdd={async (title) => {
                    try {
                      await createTask({ title, created_date: selectedDate });
                      const freshData = await fetchCalendarData(year, month);
                      setCalendarData(freshData);
                    } catch (e) {
                      console.error("Failed to create task", e);
                    }
                  }}
                />}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
