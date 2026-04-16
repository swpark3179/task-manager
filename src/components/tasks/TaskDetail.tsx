import { useState } from 'react';
import type { Task } from '../../types';
import ProgressLog from './ProgressLog';
import MarkdownEditor from '../markdown/MarkdownEditor';
import MarkdownViewer from '../markdown/MarkdownViewer';
import TaskInput from './TaskInput';
import './Tasks.css';

interface TaskDetailProps {
  task: Task;
  today: string;
  onSaveProgress: (taskId: string, date: string, content: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
  onAddChild: (parentId: string, title: string) => void;
}

export default function TaskDetail({
  task, today, onSaveProgress, onSaveDescription, onAddChild
}: TaskDetailProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'progress' | 'children'>('progress');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(task.description || '');

  const isFinished = task.status === 'completed' || task.status === 'discarded';

  const tabs = [
    { id: 'progress' as const, label: '수행내용', show: true },
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
            {tab.id === 'progress' && task.progress_logs && task.progress_logs.length > 0 && (
              <span className="task-detail-tab-badge">{task.progress_logs.length}</span>
            )}
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
                onClick={() => !isFinished && setEditingDescription(true)}
              >
                {task.description ? (
                  <MarkdownViewer content={task.description} />
                ) : (
                  <p className="task-detail-placeholder">
                    {isFinished ? '세부 내용 없음' : '클릭하여 세부 내용을 작성하세요...'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'progress' && (
          <ProgressLog
            task={task}
            today={today}
            onSave={onSaveProgress}
            readOnly={isFinished}
          />
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
