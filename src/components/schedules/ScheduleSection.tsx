import { useEffect, useState } from 'react';
import type { Schedule, Category } from '../../types';
import { formatDate } from '../../utils/dateUtils';
import { fetchCategories } from '../../lib/database';
import MarkdownViewer from '../markdown/MarkdownViewer';

interface ScheduleSectionProps {
  schedules: Schedule[];
  /** 항목 본문 클릭 시 호출 (펼침/접힘은 내부에서 처리). 현재는 사용되지 않지만 외부 통지용으로 유지. */
  onItemClick?: (schedule: Schedule) => void;
  /** 우측 톱니바퀴 클릭 시 호출 — 일정 수정 모달을 띄우는 용도 */
  onEdit: (schedule: Schedule) => void;
  emptyText?: string;
}

export default function ScheduleSection({
  schedules,
  onItemClick,
  onEdit,
  emptyText = '등록된 일정이 없습니다.',
}: ScheduleSectionProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  const categoryColor = (id?: string | null) => {
    if (!id) return undefined;
    return categories.find(c => c.id === id)?.color || undefined;
  };

  const categoryName = (id?: string | null) => {
    if (!id) return undefined;
    return categories.find(c => c.id === id)?.name || undefined;
  };

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
        const isExpanded = expandedId === s.id;
        const dotColor = categoryColor(s.category_id);
        const catName = categoryName(s.category_id);

        return (
          <div
            key={s.id}
            className={`schedule-list-item-wrapper ${isExpanded ? 'expanded' : ''}`}
          >
            <div className="schedule-list-row">
              <button
                type="button"
                className="schedule-list-toggle"
                aria-expanded={isExpanded}
                onClick={() => {
                  setExpandedId(isExpanded ? null : s.id);
                  onItemClick?.(s);
                }}
              >
                <span
                  className="schedule-list-dot"
                  aria-hidden="true"
                  style={dotColor ? { background: dotColor } : undefined}
                />
                <div className="schedule-list-main">
                  <span className="schedule-list-title">{s.title}</span>
                  <span className="schedule-list-range">
                    {range}
                    {s.estimated_time ? ` · ${s.estimated_time}` : ''}
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="schedule-list-edit-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(s);
                }}
                aria-label="일정 수정"
                title="일정 수정"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
            {isExpanded && (
              <div className="schedule-list-detail">
                <div className="schedule-list-detail-meta">
                  <span>기간: {range}</span>
                  {s.estimated_time && <span>예정 시간: {s.estimated_time}</span>}
                  {catName && <span>카테고리: {catName}</span>}
                </div>
                {s.description ? (
                  <div className="schedule-list-detail-desc">
                    <MarkdownViewer content={s.description} />
                  </div>
                ) : (
                  <p className="schedule-list-detail-empty">세부 내용이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
