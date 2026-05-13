import TodayTabs from './TodayTabs';
import './today.css';

interface DayViewProps {
  date: string;
  isToday: boolean;
  onMutate?: () => void;
}

export default function DayView({ date, isToday, onMutate }: DayViewProps) {
  return (
    <div className="day-view td-page">
      <TodayTabs
        key={date}
        date={date}
        isToday={isToday}
        onMutate={onMutate}
      />
    </div>
  );
}
