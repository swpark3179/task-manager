import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DayView from '../components/day/DayView';
import WeeklySummaryWidget from '../components/common/WeeklySummaryWidget';
import { rolloverFromLastActive } from '../lib/database';
import { getTodayString, formatDateDisplay, getPrevDay, getNextDay } from '../utils/dateUtils';
import './Pages.css';

export default function TodayPage() {
  const navigate = useNavigate();
  const today = getTodayString();

  useEffect(() => {
    const init = async () => {
      try {
        await rolloverFromLastActive(today);
      } catch (err) {
        console.error('Failed to initialize TodayPage:', err);
      }
    };

    void init();
  }, [today]);

  return (
    <div className="page today-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">오늘의 할일</h1>
          <p className="page-subtitle">{formatDateDisplay(today)}</p>
        </div>
        <div className="date-navigator">
          <button className="date-navigator-btn" onClick={() => navigate(`/history/${getPrevDay(today)}`)} aria-label="어제" title="어제">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <button className="date-navigator-btn" onClick={() => navigate(`/history/${getNextDay(today)}`)} aria-label="내일" title="내일">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="page-content">
        <WeeklySummaryWidget referenceDate={today} />
        <DayView date={today} isToday={true} />
      </div>
    </div>
  );
}
