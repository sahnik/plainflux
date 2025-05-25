import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  onLinkClick: (noteName: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick }) => {
  // Store link handlers in a ref to avoid stale closures
  const linkHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  
  // Replace [[Note]] syntax with special markers
  let linkCounter = 0;
  const processedContent = content.replace(/\[\[([^\]]+)\]\]/g, (_match, noteName) => {
    const linkId = `note-link-${linkCounter++}`;
    linkHandlersRef.current[linkId] = () => onLinkClick(noteName);
    return `[${noteName}](#${linkId})`;
  });

  return (
    <div 
      onClick={(e) => {
        // Handle clicks on links using event delegation
        const target = e.target as HTMLElement;
        if (target.tagName === 'A' && target.getAttribute('href')?.startsWith('#note-link-')) {
          e.preventDefault();
          const linkId = target.getAttribute('href')?.substring(1);
          if (linkId && linkHandlersRef.current[linkId]) {
            linkHandlersRef.current[linkId]();
          }
        }
      }}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => {
            const href = props.href || '';
            
            // Style note links differently
            if (href.startsWith('#note-link-')) {
              return (
                <a
                  {...props}
                  style={{ 
                    color: '#4ec9b0', 
                    cursor: 'pointer',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(78, 201, 176, 0.1)',
                    padding: '2px 4px',
                    borderRadius: '3px'
                  }}
                />
              );
            }
            
            // Regular external links
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};