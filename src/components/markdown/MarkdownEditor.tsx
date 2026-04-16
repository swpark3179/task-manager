import MDEditor from '@uiw/react-md-editor';
import './Markdown.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

export default function MarkdownEditor({ value, onChange, height = 200 }: MarkdownEditorProps) {
  return (
    <div className="markdown-editor-wrapper" data-color-mode="light">
      <MDEditor
        value={value}
        onChange={(val) => onChange(val || '')}
        height={height}
        preview="edit"
        hideToolbar={false}
        visibleDragbar={false}
      />
    </div>
  );
}
