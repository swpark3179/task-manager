import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TaskList from '../components/tasks/TaskList';
import {
  fetchTasksByDate, updateTask, deleteTask,
  completeTask, uncompleteTask, discardTask, createTask
} from '../lib/database';
import { formatDateFull, getNextDay, getPrevDay, getTodayString } from '../utils/dateUtils';
import type { Task } from '../types';
import './Pages.css';

export default function HistoryPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getTodayString();
  const viewDate = date || today;

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchTasksByDate(viewDate);
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [viewDate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const goToDate = (newDate: string) => {
    if (newDate === today) {
      navigate('/');
    } else {
      navigate(`/history/${newDate}`);
    }
  };

  return (
    <div className="page history-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">히스토리</h1>
          <p className="page-subtitle">{formatDateFull(viewDate)}</p>
        </div>
        <div className="date-navigator" style={{ gap: '4px', marginTop: '4px' }}>
          <button className="date-navigator-btn" style={{ width: '28px', height: '28px' }} onClick={() => goToDate(getPrevDay(viewDate))} title="이전 날짜">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          {viewDate !== today && (
            <button className="date-navigator-today" onClick={() => goToDate(today)}>오늘</button>
          )}
          <button className="date-navigator-btn" style={{ width: '28px', height: '28px' }} onClick={() => goToDate(getNextDay(viewDate))} title="다음 날짜">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="page-content">
        <TaskList
          tasks={tasks}

          loading={loading}
          onAddTask={async (title) => { await createTask({ title, created_date: viewDate }); await loadTasks(); }}
          isHistory={true}
          onComplete={async (id) => { await completeTask(id); await loadTasks(); }}
          onUncomplete={async (id) => { await uncompleteTask(id); await loadTasks(); }}
          onDiscard={async (id) => { await discardTask(id); await loadTasks(); }}
          onDelete={async (id) => { if (confirm('삭제하시겠습니까?')) { await deleteTask(id); await loadTasks(); } }}
          onUpdateSettings={async (id, updates) => { await updateTask(id, updates); await loadTasks(); }}
          onAddChild={async (parentId, title) => { await createTask({ title, parent_id: parentId, created_date: viewDate }); await loadTasks(); }}
          onSaveDescription={async (taskId, description) => { await updateTask(taskId, { description }); await loadTasks(); }}
        />
      </div>
    </div>
  );
}
