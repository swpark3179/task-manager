import { useEffect, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import mermaid from 'mermaid';
import './Markdown.css';

interface MarkdownViewerProps {
  content: string;
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'neutral',
  fontFamily: 'Inter, sans-serif',
});

export default function MarkdownViewer({ content }: MarkdownViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render mermaid diagrams after markdown is rendered
  useEffect(() => {
    const timer = setTimeout(() => {
      if (containerRef.current) {
        const mermaidBlocks = containerRef.current.querySelectorAll('code.language-mermaid');
        mermaidBlocks.forEach(async (block, index) => {
          const parent = block.parentElement;
          if (parent && parent.tagName === 'PRE') {
            const id = `mermaid-${Date.now()}-${index}`;
            try {
              const { svg } = await mermaid.render(id, block.textContent || '');
              const wrapper = document.createElement('div');
              wrapper.className = 'mermaid-diagram';
              wrapper.innerHTML = svg;
              parent.replaceWith(wrapper);
            } catch {
              // If mermaid parsing fails, leave original code block
            }
          }
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [content]);

  return (
    <div className="markdown-viewer" ref={containerRef} data-color-mode="light">
      <MDEditor.Markdown source={content} />
    </div>
  );
}
