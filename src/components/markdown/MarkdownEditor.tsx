import { useCallback, useRef, useState } from 'react';
import MarkdownViewer from './MarkdownViewer';
import './Markdown.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  placeholder?: string;
  autoFocus?: boolean;
  /** Stretch to fill the parent (height ignored). Useful in full-window editors. */
  fill?: boolean;
}

type Mode = 'write' | 'preview';

interface ToolAction {
  key: string;
  label: string;
  title: string;
  /** Wrap the selection, e.g. `**` for bold. */
  wrap?: string;
  /** Prefix each selected line, e.g. `- ` for a list. */
  linePrefix?: string;
  /** Placeholder text used when there is no selection. */
  sample?: string;
}

// Compact, touch-first toolbar. Each control maps to a single markdown idiom so
// it stays legible on a narrow phone screen; the row scrolls horizontally when
// it can't fit.
const TOOLS: ToolAction[] = [
  { key: 'h', label: '제목', title: '제목', linePrefix: '## ', sample: '제목' },
  { key: 'b', label: 'B', title: '굵게', wrap: '**', sample: '굵게' },
  { key: 'i', label: 'I', title: '기울임', wrap: '*', sample: '기울임' },
  { key: 'ul', label: '목록', title: '글머리 목록', linePrefix: '- ', sample: '항목' },
  { key: 'todo', label: '체크', title: '체크리스트', linePrefix: '- [ ] ', sample: '할 일' },
  { key: 'quote', label: '인용', title: '인용', linePrefix: '> ', sample: '인용' },
  { key: 'code', label: '코드', title: '인라인 코드', wrap: '`', sample: 'code' },
  { key: 'link', label: '링크', title: '링크', sample: '링크' },
];

export default function MarkdownEditor({
  value,
  onChange,
  height = 200,
  placeholder = '마크다운으로 작성하세요…',
  autoFocus,
  fill = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<Mode>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const applyTool = useCallback(
    (tool: ToolAction) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const selected = value.slice(start, end);
      const before = value.slice(0, start);
      const after = value.slice(end);

      let next = value;
      let nextStart = start;
      let nextEnd = end;

      if (tool.key === 'link') {
        const text = selected || tool.sample || '링크';
        const snippet = `[${text}](url)`;
        next = before + snippet + after;
        // Select the "url" placeholder so it can be typed over immediately.
        nextStart = start + text.length + 3;
        nextEnd = nextStart + 3;
      } else if (tool.wrap) {
        const text = selected || tool.sample || '';
        const snippet = `${tool.wrap}${text}${tool.wrap}`;
        next = before + snippet + after;
        if (selected) {
          nextStart = start;
          nextEnd = start + snippet.length;
        } else {
          nextStart = start + tool.wrap.length;
          nextEnd = nextStart + text.length;
        }
      } else if (tool.linePrefix) {
        // Expand the selection to cover full lines, then prefix each one.
        const lineStart = before.lastIndexOf('\n') + 1;
        const region = value.slice(lineStart, end);
        const lines = (region || tool.sample || '').split('\n');
        const prefixed = lines.map((line) => tool.linePrefix + line).join('\n');
        next = value.slice(0, lineStart) + prefixed + after;
        nextStart = lineStart;
        nextEnd = lineStart + prefixed.length;
      }

      onChange(next);
      // Restore focus and selection after React commits the new value.
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(nextStart, nextEnd);
      });
    },
    [value, onChange],
  );

  const bodyStyle = fill ? undefined : { minHeight: height };

  return (
    <div className={`md-editor ${fill ? 'md-editor-fill' : ''}`} data-mode={mode}>
      <div className="md-editor-bar">
        <div className="md-editor-modes" role="tablist" aria-label="편집 모드">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'write'}
            className={`md-editor-mode ${mode === 'write' ? 'is-on' : ''}`}
            onClick={() => setMode('write')}
          >
            쓰기
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'preview'}
            className={`md-editor-mode ${mode === 'preview' ? 'is-on' : ''}`}
            onClick={() => setMode('preview')}
          >
            미리보기
          </button>
        </div>

        {mode === 'write' && (
          <div className="md-editor-tools" role="toolbar" aria-label="서식">
            {TOOLS.map((tool) => (
              <button
                key={tool.key}
                type="button"
                className={`md-editor-tool md-editor-tool-${tool.key}`}
                title={tool.title}
                aria-label={tool.title}
                // Keep textarea focus/selection intact when tapping a tool.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyTool(tool)}
              >
                {tool.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="md-editor-body" style={bodyStyle}>
        {mode === 'write' ? (
          <textarea
            ref={textareaRef}
            className="md-editor-textarea"
            value={value}
            placeholder={placeholder}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            style={bodyStyle}
            spellCheck={false}
          />
        ) : (
          <div className="md-editor-preview" style={bodyStyle}>
            {value.trim() ? (
              <MarkdownViewer content={value} />
            ) : (
              <p className="md-editor-preview-empty">미리볼 내용이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
