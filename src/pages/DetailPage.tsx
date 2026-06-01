import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDayTasks } from '../hooks/useDayTasks';
import MarkdownViewer from '../components/markdown/MarkdownViewer';
import MarkdownEditor from '../components/markdown/MarkdownEditor';
import { getCurrentTauriWindow, isTauriRuntime } from '../lib/runtimeWindow';
import type { Task } from '../types';
import './DetailPage.css';

function findTask(tasks: Task[], id: string): Task | null {
  for (const t of tasks) {
    if (t.id === id) return t;
    if (t.children?.length) {
      const found = findTask(t.children, id);
      if (found) return found;
    }
  }
  return null;
}

export default function DetailPage() {
  const location = useLocation();
  const params = useMemo(() => {
    const search = location.search || (location.hash.includes('?') ? '?' + location.hash.split('?')[1] : '');
    return new URLSearchParams(search);
  }, [location]);

  const taskId = params.get('taskId') || '';
  const date = params.get('date') || '';
  const dayTasks = useDayTasks(date);

  const task = useMemo(() => findTask(dayTasks.tasks, taskId), [dayTasks.tasks, taskId]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!editing) {
      setDraft(task?.description ?? '');
    }
  }, [task?.description, editing]);

  useEffect(() => {
    document.title = task?.title ? `${task.title} — 작업 상세` : '작업 상세';
  }, [task?.title]);

  if (!taskId) {
    return <div className="detailpage detailpage-empty">잘못된 접근입니다.</div>;
  }

  if (dayTasks.loading && !task) {
    return <div className="detailpage detailpage-empty">불러오는 중…</div>;
  }

  if (!task) {
    return <div className="detailpage detailpage-empty">작업을 찾을 수 없어요.</div>;
  }

  const startEditing = () => {
    setDraft(task.description ?? '');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(task.description ?? '');
    setEditing(false);
  };

  const save = async () => {
    await dayTasks.saveDescription(task.id, draft);
    setEditing(false);
    if (isTauriRuntime()) {
      try {
        const win = await getCurrentTauriWindow();
        await win?.close();
      } catch (err) {
        console.warn('Failed to close detail window after save:', err);
      }
    }
  };

  return (
    <div className="detailpage">
      <header className="detailpage-head">
        <div className="detailpage-title" title={task.title}>{task.title || '제목 없음'}</div>
        <div className="detailpage-act">
          {!editing ? (
            <button type="button" className="dp-btn" onClick={startEditing}>편집</button>
          ) : (
            <>
              <button type="button" className="dp-btn dp-btn-ghost" onClick={cancel}>취소</button>
              <button type="button" className="dp-btn dp-btn-primary" onClick={() => void save()}>저장</button>
            </>
          )}
        </div>
      </header>

      <main className="detailpage-body">
        {editing ? (
          <MarkdownEditor
            value={draft}
            onChange={setDraft}
            placeholder={'# 제목\n\n- 항목 1\n- 항목 2'}
            autoFocus
            fill
          />
        ) : task.description && task.description.trim() ? (
          <MarkdownViewer content={task.description} />
        ) : (
          <div className="dp-empty">
            상세 내용이 없어요. '편집'을 눌러 내용을 추가해주세요.
          </div>
        )}
      </main>
    </div>
  );
}
