import type { Task } from '../../types';
import TaskItem from './TaskItem';
import TaskInput from './TaskInput';
import './Tasks.css';

interface TaskTreeProps {
  tasks: Task[];
  today: string;
  depth?: number;
  onComplete: (id: string) => void;
  onUncomplete?: (id: string) => void;
  onDiscard: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, title: string) => void;
  onAddChild: (parentId: string, title: string) => void;
  onSaveProgress: (taskId: string, date: string, content: string) => void;
  onSaveDescription: (taskId: string, description: string) => void;
  parentId?: string;
  showAddInput?: boolean;
}

export default function TaskTree({
  tasks, today, depth = 0, onComplete, onUncomplete, onDiscard, onDelete,
  onUpdate, onAddChild, onSaveProgress, onSaveDescription,
  parentId, showAddInput = true
}: TaskTreeProps) {
  return (
    <div className={`task-tree ${depth > 0 ? 'task-tree-nested' : ''}`}>
      {tasks.map(task => (
        <TaskItem
          key={task.id}
          task={task}
          today={today}
          depth={depth}
          onComplete={onComplete}
          onUncomplete={onUncomplete}
          onDiscard={onDiscard}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onAddChild={onAddChild}
          onSaveProgress={onSaveProgress}
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
