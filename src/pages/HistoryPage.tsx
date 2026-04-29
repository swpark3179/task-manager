import { useParams, useNavigate } from 'react-router-dom';
import DayView from '../components/day/DayView';
import { formatDateFull, getNextDay, getPrevDay, getTodayString } from '../utils/dateUtils';
import './Pages.css';

export default function HistoryPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const today = getTodayString();
  const viewDate = date || today;

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
        <div className="date-navigator">
          <button className="date-navigator-btn" onClick={() => goToDate(getPrevDay(viewDate))} aria-label="이전 날짜" title="이전 날짜">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          {viewDate !== today && (
            <button className="date-navigator-today" onClick={() => goToDate(today)}>오늘</button>
          )}
          <button className="date-navigator-btn" onClick={() => goToDate(getNextDay(viewDate))} aria-label="다음 날짜" title="다음 날짜">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </button>
        </div>
      </div>

      <div className="page-content">
        <DayView key={viewDate} date={viewDate} isToday={viewDate === today} />
      </div>
    </div>
  );
}
