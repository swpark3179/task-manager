import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import MarkdownViewer from './MarkdownViewer';
import './MarkdownPopup.css';

interface MarkdownPopupProps {
  title: string;
  detail: string;
  onClose: () => void;
  onSave: (next: string) => void | Promise<void>;
}

const MIN_W = 320;
const MIN_H = 240;

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export default function MarkdownPopup({ title, detail, onClose, onSave }: MarkdownPopupProps) {
  const initial = useMemo(() => {
    const w = Math.min(640, Math.max(MIN_W, window.innerWidth - 80));
    const h = Math.min(560, Math.max(MIN_H, window.innerHeight - 120));
    return {
      w,
      h,
      x: Math.max(20, Math.round((window.innerWidth - w) / 2)),
      y: Math.max(40, Math.round((window.innerHeight - h) / 2)),
    };
  }, []);

  const [size, setSize] = useState({ w: initial.w, h: initial.h });
  const [pos, setPos] = useState({ x: initial.x, y: initial.y });
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [draft, setDraft] = useState(detail || '');
  const detailRef = useRef(detail);

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false);
          setDraft(detailRef.current || '');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, onClose]);

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { ...pos };
    const move = (ev: MouseEvent) => {
      const nx = start.x + (ev.clientX - sx);
      const ny = start.y + (ev.clientY - sy);
      setPos({
        x: Math.min(Math.max(-size.w + 120, nx), window.innerWidth - 120),
        y: Math.min(Math.max(0, ny), window.innerHeight - 40),
      });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const startResize = (dir: ResizeDir) => (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    const startSize = { ...size };
    const startPos = { ...pos };
    const move = (ev: MouseEvent) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      let { w, h } = startSize;
      let { x, y } = startPos;
      if (dir.includes('e')) {
        w = Math.max(MIN_W, startSize.w + dx);
        w = Math.min(w, window.innerWidth - startPos.x - 4);
      }
      if (dir.includes('s')) {
        h = Math.max(MIN_H, startSize.h + dy);
        h = Math.min(h, window.innerHeight - startPos.y - 4);
      }
      if (dir.includes('w')) {
        const maxShrink = startSize.w - MIN_W;
        const maxGrow = startPos.x;
        const clampedDx = Math.min(Math.max(dx, -maxGrow), maxShrink);
        w = startSize.w - clampedDx;
        x = startPos.x + clampedDx;
      }
      if (dir.includes('n')) {
        const maxShrink = startSize.h - MIN_H;
        const maxGrow = startPos.y;
        const clampedDy = Math.min(Math.max(dy, -maxGrow), maxShrink);
        h = startSize.h - clampedDy;
        y = startPos.y + clampedDy;
      }
      setSize({ w, h });
      setPos({ x, y });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const startEditing = () => {
    setDraft(detail || '');
    setTab('write');
    setEditing(true);
  };

  const cancel = () => {
    setDraft(detail || '');
    setEditing(false);
  };

  const save = async () => {
    await onSave(draft);
    setEditing(false);
  };

  const dirs: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

  const popupStyle: CSSProperties = {
    left: pos.x,
    top: pos.y,
    width: size.w,
    height: size.h,
  };

  return (
    <div className="mdpop" style={popupStyle} role="dialog" aria-label="작업 상세">
      <div className="mdpop-head" onMouseDown={startDrag}>
        <div className="mdpop-title">
          <span className="mdpop-grip" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.4" />
              <circle cx="15" cy="6" r="1.4" />
              <circle cx="9" cy="12" r="1.4" />
              <circle cx="15" cy="12" r="1.4" />
              <circle cx="9" cy="18" r="1.4" />
              <circle cx="15" cy="18" r="1.4" />
            </svg>
          </span>
          <span className="mdpop-tname" title={title}>{title}</span>
          {editing && <span className="mdpop-badge">편집 중</span>}
        </div>
        <div className="mdpop-head-act">
          {!editing ? (
            <button type="button" className="mdpop-btn" onClick={startEditing} title="편집">
              <PencilIcon /><span>편집</span>
            </button>
          ) : (
            <>
              <button type="button" className="mdpop-btn mdpop-btn-ghost" onClick={cancel} title="취소">
                취소
              </button>
              <button type="button" className="mdpop-btn mdpop-btn-primary" onClick={() => void save()} title="저장">
                <CheckIcon /><span>저장</span>
              </button>
            </>
          )}
          <button type="button" className="mdpop-iconbtn" onClick={onClose} title="닫기" aria-label="닫기">
            <CloseIcon />
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <div className="mdpop-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={tab === 'write'}
              className={`mdpop-tab ${tab === 'write' ? 'mdpop-tab-on' : ''}`}
              onClick={() => setTab('write')}
            >
              <EditTabIcon /><span>작성</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'preview'}
              className={`mdpop-tab ${tab === 'preview' ? 'mdpop-tab-on' : ''}`}
              onClick={() => setTab('preview')}
            >
              <EyeIcon /><span>미리보기</span>
            </button>
            <div className="mdpop-tab-sp" />
            <span className="mdpop-hint">
              {tab === 'write'
                ? '마크다운 문법 사용 가능'
                : draft.trim()
                ? `${draft.length}자`
                : '미리볼 내용이 없습니다'}
            </span>
          </div>
          <div className="mdpop-body mdpop-body-edit">
            {tab === 'write' ? (
              <textarea
                className="mdpop-editor"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={'# 제목\n\n- 항목 1\n- 항목 2\n\n> 인용\n\n```\n코드 블록\n```'}
                autoFocus
                spellCheck={false}
              />
            ) : (
              <div className="mdpop-preview">
                {draft.trim() ? (
                  <MarkdownViewer content={draft} />
                ) : (
                  <div className="mdpop-blank">
                    <EyeIcon />
                    <div>아직 작성된 내용이 없어요</div>
                    <div className="mdpop-blank-sub">'작성' 탭에서 마크다운으로 입력해주세요</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="mdpop-body">
          {detail && detail.trim() ? (
            <MarkdownViewer content={detail} />
          ) : (
            <div className="mdpop-blank">
              <DocIcon />
              <div>상세 내용이 없어요</div>
              <div className="mdpop-blank-sub">'편집'을 눌러 마크다운으로 내용을 추가해주세요</div>
              <button type="button" className="mdpop-blank-cta" onClick={startEditing}>
                <PencilIcon /> 편집 시작
              </button>
            </div>
          )}
        </div>
      )}

      {dirs.map((d) => (
        <div
          key={d}
          className={`mdpop-rh mdpop-rh-${d}`}
          onMouseDown={startResize(d)}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 20h4l10-10-4-4L4 16v4z M14 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12 M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M9 13h6 M9 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function EditTabIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 4h10 M4 9h16 M4 14h12 M4 19h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
