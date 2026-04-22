import type { Schedule } from '../../types';
import { formatDate } from '../../utils/dateUtils';

interface ScheduleSectionProps {
  schedules: Schedule[];
  onItemClick: (schedule: Schedule) => void;
  emptyText?: string;
}

export default function ScheduleSection({
  schedules,
  onItemClick,
  emptyText = '등록된 일정이 없습니다.',
}: ScheduleSectionProps) {
  if (schedules.length === 0) {
    return (
      <p
        style={{
          color: 'var(--text-muted)',
          textAlign: 'center',
          padding: '12px 0',
          fontSize: '0.875rem',
          margin: 0,
        }}
      >
        {emptyText}
      </p>
    );
  }

  const sorted = [...schedules].sort((a, b) => {
    if (a.start_date !== b.start_date) {
      return a.start_date < b.start_date ? -1 : 1;
    }
    return a.end_date < b.end_date ? -1 : 1;
  });

  return (
    <div className="schedule-list">
      {sorted.map((s) => {
        const startStr = formatDate(s.start_date);
        const endStr = formatDate(s.end_date);
        const range = startStr === endStr ? startStr : `${startStr} ~ ${endStr}`;
        return (
          <button
            key={s.id}
            type="button"
            className="schedule-list-item"
            onClick={() => onItemClick(s)}
          >
            <span className="schedule-list-dot" aria-hidden="true" />
            <div className="schedule-list-main">
              <span className="schedule-list-title">{s.title}</span>
              <span className="schedule-list-range">
                {range}
                {s.estimated_time ? ` · ${s.estimated_time}` : ''}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
