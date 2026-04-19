import { useState } from 'react';
import type { Task } from '../../types';
import MarkdownEditor from '../markdown/MarkdownEditor';
import MarkdownViewer from '../markdown/MarkdownViewer';
import TaskInput from './TaskInput';
import './Tasks.css';

interface TaskDetailProps {
  task: Task;
  onSaveDescription: (taskId: string, description: string) => void;
  onAddChild: (parentId: string, title: string) => void;
}

export default function TaskDetail({
  task, onSaveDescription, onAddChild
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'children'>('description');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description || '');

  const isFinished = task.status === 'completed' || task.status === 'discarded';

  const tabs = [
    { id: 'description' as const, label: '세부 내용', show: true },
    { id: 'children' as const, label: '하위 할일', show: !isFinished },
  ].filter(t => t.show);

  const handleSaveDescription = () => {
    onSaveDescription(task.id, descriptionDraft);
    setEditingDescription(false);
  };

  return (
    <div className="task-detail">
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
                {!isFinished && (
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
            <TaskInput
              parentId={task.id}
              onAdd={(title) => onAddChild(task.id, title)}
              placeholder="하위 할일 추가..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
