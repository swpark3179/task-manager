import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCalendarData } from '../lib/database';
import { getMonthCalendarGrid, formatDate, formatMonthYear, getTodayString } from '../utils/dateUtils';
import type { CalendarCellData } from '../types';
import './Pages.css';

export default function CalendarPage() {
  const navigate = useNavigate();
  const today = getTodayString();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [calendarData, setCalendarData] = useState<CalendarCellData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchCalendarData(year, month);
        setCalendarData(data);
      } catch (err) {
        console.error('Failed to load calendar data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, month]);

  const grid = getMonthCalendarGrid(year, month);
  const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };

  const getCellData = (dateStr: string): CalendarCellData | undefined => {
    return calendarData.find(c => c.date === dateStr);
  };

  const handleCellClick = (dateStr: string) => {
    if (dateStr === today) {
      navigate('/');
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

      <div className="calendar-nav">
        <button className="date-navigator-btn" onClick={prevMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <span className="calendar-month-label">
          {formatMonthYear(new Date(year, month - 1))}
        </span>
        <button className="date-navigator-btn" onClick={nextMonth}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <button className="date-navigator-today" onClick={goToToday}>오늘</button>
      </div>

      <div className="calendar-grid">
        {/* Day headers */}
        {dayLabels.map(day => (
          <div key={day} className={`calendar-header-cell ${day === '일' ? 'sunday' : ''} ${day === '토' ? 'saturday' : ''}`}>
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
              className={`calendar-cell ${isToday ? 'today' : ''} ${cellData ? 'has-data' : ''} ${isSunday ? 'sunday' : ''} ${isSaturday ? 'saturday' : ''}`}
              onClick={() => handleCellClick(dateStr)}
            >
              <span className="calendar-cell-date">{date.getDate()}</span>
              {cellData && cellData.summary.total > 0 && (
                <div className="calendar-cell-dots">
                  {cellData.summary.completed > 0 && (
                    <span className="calendar-dot completed" title={`완료 ${cellData.summary.completed}`}>●</span>
                  )}
                  {cellData.summary.inProgress > 0 && (
                    <span className="calendar-dot in-progress" title={`진행 ${cellData.summary.inProgress}`}>◐</span>
                  )}
                  {cellData.summary.pending > 0 && (
                    <span className="calendar-dot pending" title={`대기 ${cellData.summary.pending}`}>○</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="calendar-legend">
        <span className="calendar-legend-item"><span className="calendar-dot completed">●</span> 완료</span>
        <span className="calendar-legend-item"><span className="calendar-dot in-progress">◐</span> 진행</span>
        <span className="calendar-legend-item"><span className="calendar-dot pending">○</span> 대기</span>
      </div>

      {loading && (
        <div className="loading-container">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
}
