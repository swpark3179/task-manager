import type { Task } from '../../types';
import TaskItem from './TaskItem';
import TaskInput from './TaskInput';
import './Tasks.css';

interface TaskTreeProps {
  tasks: Task[];

  depth?: number;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onUndiscard?: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateSettings: (id: string, updates: { title?: string; category_id?: string | null; low_priority?: boolean }) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
  parentId?: string;
  showAddInput?: boolean;
}

export default function TaskTree({
  tasks, depth = 0, onComplete, onUncomplete, onDiscard, onUndiscard, onDelete,
  onUpdateSettings, onAddChild, onSaveDescription,
  parentId, showAddInput = true
}: TaskTreeProps) {
  return (
    <div className={`task-tree ${depth > 0 ? 'task-tree-nested' : ''}`}>
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}

          depth={depth}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
          onDiscard={onDiscard}
          onUndiscard={onUndiscard}
          onDelete={onDelete}
          onUpdateSettings={onUpdateSettings}
          onAddChild={onAddChild}

          onSaveDescription={onSaveDescription}
        />
      ))}

      {showAddInput && parentId && (
        <div className="task-tree-add" style={{ paddingLeft: `${(depth) * 24 + 8}px` }}>
          <TaskInput
            parentId={parentId}
            onAdd={(title) => onAddChild(parentId, title)}
            placeholder="하위 할일 추가..."
          />
        </div>
      )}
    </div>
  );
}
