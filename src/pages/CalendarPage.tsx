import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import TaskInput from "../components/tasks/TaskInput";
import TaskSettingsModal from "../components/tasks/modals/TaskSettingsModal";
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

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

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const getCellData = (dateStr: string): CalendarCellData | undefined => {
    return calendarData.find((c) => c.date === dateStr);
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
    <div className="page calendar-page">
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

        <div className="calendar-grid">
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
                className={`calendar-cell ${isToday ? "today" : ""} ${cellData ? "has-data" : ""} ${isSunday ? "sunday" : ""} ${isSaturday ? "saturday" : ""}`}
                onClick={() => handleCellClick(dateStr)}
              >
                <span className="calendar-cell-date">{date.getDate()}</span>
                {cellData && cellData.tasks && cellData.tasks.length > 0 && (
                  <div className="calendar-cell-tasks">
                    {cellData.tasks.slice(0, 3).map((task) => {
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
                    {cellData.tasks.length > 3 && (
                      <div className="calendar-task-more">
                        +{cellData.tasks.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

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
                    (이동하기)
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
                  const allTasks = getCellData(selectedDate)?.tasks || [];

                  let displayTasks = allTasks;
                  if (viewMode === "tree") {
                    displayTasks = allTasks.filter((t) => !t.parent_id);
                  } else {
                    const parentIds = new Set(
                      allTasks.map((t) => t.parent_id).filter(Boolean),
                    );
                    displayTasks = allTasks.filter(
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

                  return displayTasks.map((task) => {
                    const catColor = getCategoryColor(task.category_id);
                    return (
                      <div
                        key={task.id}
                        className={`modal-task-item ${task.status}`}
                        style={{ cursor: "pointer", position: "relative" }}
                        onClick={() => setEditingTaskId(task.task_id)}
                      >
                        {catColor && (
                          <div
                            style={{
                              position: "absolute",
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: "4px",
                              backgroundColor: catColor,
                              borderRadius: "4px 0 0 4px",
                            }}
                          />
                        )}

                        <span>{task.title || "제목 없음"}</span>
                      </div>
                    );
                  });
                })()}
              </div>

              <div
                style={{
                  marginTop: "16px",
                  borderTop: "1px solid var(--border-light)",
                  paddingTop: "16px",
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
            </div>
          </div>
        )}

        {editingTaskId &&
          (() => {
            const selectedCellData = getCellData(selectedDate!);
            const taskSnap = selectedCellData?.tasks.find(
              (t) => t.task_id === editingTaskId,
            );
            if (!taskSnap) return null;

            // Convert snapshot to Task type for TaskSettingsModal
            const mockTask: any = {
              id: taskSnap.task_id,
              title: taskSnap.title || "",
              category_id: taskSnap.category_id || null,
              low_priority: false,
            };

            return (
              <TaskSettingsModal
                task={mockTask}
                onClose={() => setEditingTaskId(null)}
                onUpdate={async (id, updates) => {
                  try {
                    await updateTask(id, updates);
                    const freshData = await fetchCalendarData(year, month);
                    setCalendarData(freshData);
                  } catch (e) {
                    console.error("Failed to update task", e);
                  }
                }}
              />
            );
          })()}
      </div>
    </div>
  );
}
