import { useCallback, useEffect, useState } from 'react';
import TodayHero from '../components/day/TodayHero';
import TodayTabs from '../components/day/TodayTabs';
import { rolloverFromLastActive } from '../lib/database';
import { getTodayString } from '../utils/dateUtils';
import type { TaskStatusSummary } from '../types';
import './Pages.css';
import '../components/day/today.css';

export default function TodayPage() {
  const today = getTodayString();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [liveSummary, setLiveSummary] = useState<TaskStatusSummary | undefined>(undefined);

  useEffect(() => {
    void (async () => {
      try {
        await rolloverFromLastActive(today);
      } catch (err) {
        console.error('Failed to initialize TodayPage:', err);
      }
    })();
  }, [today]);

  const handleSelectDate = useCallback(
    (date: string) => {
      if (date === selectedDate) return;
      setLiveSummary(undefined);
      setSelectedDate(date);
    },
    [selectedDate],
  );

  return (
    <div className="page today-page">
      <div className="page-content td-page">
        <TodayHero
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          liveSummary={liveSummary}
        />
        <TodayTabs
          key={selectedDate}
          date={selectedDate}
          isToday={selectedDate === today}
          onSummaryChange={setLiveSummary}
        />
      </div>
    </div>
  );
}
