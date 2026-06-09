import { memo, useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import './Markdown.css';

interface MarkdownViewerProps {
  content: string;
}

// Mermaid is heavy (it pulls in a layout/parser engine), so we load and
// initialise it lazily — only the first time a diagram actually needs to be
// rendered. Eagerly importing it on every viewer mount was a notable source of
// main-thread stalls on mobile where many viewers can mount at once.
let mermaidInitPromise: Promise<typeof import('mermaid').default> | null = null;
function getMermaid() {
  if (!mermaidInitPromise) {
    mermaidInitPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        fontFamily: 'inherit',
      });
      return mermaid;
    });
  }
  return mermaidInitPromise;
}

function hasMermaidBlock(content: string): boolean {
  return content.includes('```mermaid') || content.includes('~~~mermaid');
}

function MarkdownViewer({ content }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render mermaid diagrams after markdown is rendered. Skip entirely when the
  // content has no mermaid fence so the common case does no extra work, sets no
  // timers and never touches the DOM.
  useEffect(() => {
    if (!hasMermaidBlock(content)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;
      const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
      if (mermaidBlocks.length === 0) return;

      void getMermaid().then((mermaid) => {
        if (cancelled) return;
        const timestamp = Date.now();
        mermaidBlocks.forEach(async (block, index) => {
          const parent = block.parentElement;
          if (parent && parent.tagName === 'PRE') {
            const id = `mermaid-${timestamp}-${index}`;
            try {
              const { svg } = await mermaid.render(id, block.textContent || '');
              if (cancelled) return;
              const wrapper = document.createElement('div');
              wrapper.className = 'mermaid-diagram';
              wrapper.innerHTML = svg;
              parent.replaceWith(wrapper);
            } catch {
              // If mermaid parsing fails, leave original code block
            }
          }
        });
      });
    }, 100);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [content]);

  // Always render in a self-contained, Claude-web–style light theme. The viewer
  // surfaces (e.g. the Windows detail popup) hardcode a light background, so
  // following the app's dark `--fg`/`data-color-mode` produced near-white text
  // on white — unreadable. Pinning a light "paper" theme keeps the markdown
  // crisp and high-contrast regardless of the app's current color mode.
  return (
    <div className="markdown-viewer claude-theme" ref={containerRef} data-color-mode="light">
      <MDEditor.Markdown source={content} />
    </div>
  );
}

export default memo(MarkdownViewer);
