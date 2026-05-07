import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../../types';
import MarkdownEditor from '../markdown/MarkdownEditor';
import MarkdownViewer from '../markdown/MarkdownViewer';
import TaskInput from './TaskInput';
import { formatDateDisplay, getTodayString } from '../../utils/dateUtils';
import './Tasks.css';

import type { ReactNode } from 'react';

interface TaskDetailProps {
  children?: ReactNode;
  task: Task;
  onSaveDescription: (taskId: string, description: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onCreateSnapshot?: (taskId: string) => void;
  onDeleteSnapshot?: (taskId: string) => void;
}

export default function TaskDetail({
  task, onSaveDescription, onAddChild, onCreateSnapshot, onDeleteSnapshot
, children
}: TaskDetailProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'description' | 'children'>('description');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description || '');

  const isFinished = task.status === 'completed' || task.status === 'discarded';

  const parentInfo = task.parent_info;
  const handleParentNavigate = () => {
    if (!parentInfo) return;
    const today = getTodayString();
    if (parentInfo.created_date === today) {
      navigate('/');
    } else {
      navigate(`/history/${parentInfo.created_date}`);
    }
  };

  const activeChildren = useMemo(() => task.children?.filter(c => c.status !== 'discarded') || [], [task.children]);
  const remainingCount = useMemo(() => activeChildren.filter(c => c.status !== 'completed').length, [activeChildren]);
  const childrenTabLabel = useMemo(() => activeChildren.length > 0 && remainingCount > 0
    ? `하위 할일 (${remainingCount})`
    : '하위 할일', [activeChildren.length, remainingCount]);


  const tabs = useMemo(() => [
    { id: 'description' as const, label: '세부 내용', show: true },
    { id: 'children' as const, label: childrenTabLabel, show: !isFinished || (task.children && task.children.length > 0) },
  ].filter(t => t.show), [childrenTabLabel, isFinished, task.children]);

  // "오늘 진행 기록" 버튼은 오늘의 할일 화면에서, 아직 끝나지 않은 작업에만 표시합니다.
  // is_snapshot(다른 날짜의 진행 기록 표시용 행)에서는 노출하지 않습니다.
  const showSnapshotButton =
    !task.is_snapshot &&
    !isFinished &&
    task.created_date === getTodayString() &&
    !!onCreateSnapshot &&
    !!onDeleteSnapshot;

  const handleSaveDescription = () => {
    onSaveDescription(task.id, descriptionDraft);
    setEditingDescription(false);
  };

  return (
    <div className="task-detail">
      {parentInfo && (
        <div className="task-detail-parent-link">
          <span className="task-detail-parent-label">상위 작업</span>
          <button
            type="button"
            className="task-detail-parent-button"
            onClick={handleParentNavigate}
            title={`${formatDateDisplay(parentInfo.created_date)}로 이동`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
            <span className="task-detail-parent-title">{parentInfo.title}</span>
            <span className="task-detail-parent-date">{formatDateDisplay(parentInfo.created_date)}</span>
          </button>
        </div>
      )}
      <div className="task-detail-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`task-detail-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            </button>
        ))}
        {showSnapshotButton && (
          <button
            type="button"
            className={`task-detail-snapshot-btn ${task.has_snapshot ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              if (task.has_snapshot) {
                onDeleteSnapshot?.(task.id);
              } else {
                onCreateSnapshot?.(task.id);
              }
            }}
            title={task.has_snapshot
              ? '오늘의 진행 기록을 취소합니다'
              : '오늘 진행 중임을 기록으로 남깁니다'}
          >
            {task.has_snapshot ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" fill="currentColor" />
                </svg>
                <span>오늘 진행 기록됨</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>오늘 진행 기록</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="task-detail-content">
        {activeTab === 'description' && (
          <div className="task-detail-section">
            {editingDescription ? (
              <div className="task-detail-editor">
                <MarkdownEditor
                  value={descriptionDraft}
                  onChange={setDescriptionDraft}
                  height={200}
                />
                <div className="task-detail-editor-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveDescription}
                  >
                    저장
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setDescriptionDraft(task.description || '');
                      setEditingDescription(false);
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div
                className="task-detail-description"
              >
                {task.description ? (
                  <div className="task-detail-description-content">
                    <MarkdownViewer content={task.description} />
                  </div>
                ) : (
                  <p className="task-detail-placeholder">
                    {isFinished ? '세부 내용 없음' : '세부 내용이 없습니다.'}
                  </p>
                )}
                {!isFinished && !task.is_snapshot && (
                  <button
                    className="btn btn-ghost btn-sm task-detail-edit-btn absolute-top-right"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDescription(true);
                    }}
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        )}



        {activeTab === 'children' && (
          <div className="task-detail-section">
            {children}
            {!isFinished && !task.is_snapshot && (
              <TaskInput
                parentId={task.id}
                onAdd={(title) => onAddChild(task.id, title)}
                placeholder="하위 할일 추가..."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
