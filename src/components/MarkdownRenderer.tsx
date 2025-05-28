import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertFileSrc } from '@tauri-apps/api/core';

interface MarkdownRendererProps {
  content: string;
  onLinkClick: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
  onTodoToggle?: (lineNumber: number) => void;
  notePath?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick, onTagClick, onTodoToggle, notePath }) => {
  // Store link and tag handlers in a ref to avoid stale closures
  const linkHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const tagHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const todoHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  
  // Replace [[Note]] syntax with special markers
  let linkCounter = 0;
  let tagCounter = 0;
  
  // Process content line by line to handle todos
  const lines = content.split('\n');
  const processedLines = lines.map((line, index) => {
    // Handle [[Note]] links
    line = line.replace(/\[\[([^\]]+)\]\]/g, (_match, noteName) => {
      const linkId = `note-link-${linkCounter++}`;
      linkHandlersRef.current[linkId] = () => onLinkClick(noteName);
      return `[${noteName}](#${linkId})`;
    });
    
    // Don't process checkboxes here, we'll handle them in the component
    // Just track line numbers for todos
    if (onTodoToggle && /^(\s*[-*]\s*)\[([ xX])\]/.test(line)) {
      const lineNumber = index + 1;
      const todoId = `todo-line-${lineNumber}`;
      todoHandlersRef.current[todoId] = () => onTodoToggle(lineNumber);
    }
    
    return line;
  });
  
  let processedContent = processedLines.join('\n');
  
  // Replace #tag syntax with clickable links if onTagClick is provided
  if (onTagClick) {
    processedContent = processedContent.replace(/(^|\s)#(\w+)/g, (_match, prefix, tagName) => {
      const tagId = `tag-link-${tagCounter++}`;
      tagHandlersRef.current[tagId] = () => onTagClick(tagName);
      return `${prefix}[#${tagName}](#${tagId})`;
    });
  }

  return (
    <div 
      onClick={(e) => {
        // Handle clicks on links using event delegation
        const target = e.target as HTMLElement;
        const href = target.getAttribute('href');
        
        if (target.tagName === 'A' && href) {
          if (href.startsWith('#note-link-')) {
            e.preventDefault();
            const linkId = href.substring(1);
            if (linkHandlersRef.current[linkId]) {
              linkHandlersRef.current[linkId]();
            }
          } else if (href.startsWith('#tag-link-')) {
            e.preventDefault();
            const tagId = href.substring(1);
            if (tagHandlersRef.current[tagId]) {
              tagHandlersRef.current[tagId]();
            }
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
            
            // Style tag links differently
            if (href.startsWith('#tag-link-')) {
              return (
                <a
                  {...props}
                  style={{ 
                    color: '#e5c07b', 
                    cursor: 'pointer',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(229, 192, 123, 0.1)',
                    padding: '2px 4px',
                    borderRadius: '3px'
                  }}
                />
              );
            }
            
            // Regular external links
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
          img: ({ node, ...props }) => {
            const src = props.src || '';
            
            // If it's a relative path and we have the note path, convert to absolute
            if (notePath && src.startsWith('images/')) {
              // Handle both forward slashes and backslashes for cross-platform compatibility
              const lastSlashIndex = Math.max(notePath.lastIndexOf('/'), notePath.lastIndexOf('\\'));
              const noteDir = notePath.substring(0, lastSlashIndex);
              const absolutePath = `${noteDir}/${src}`;
              const tauriSrc = convertFileSrc(absolutePath);
              
              return (
                <img
                  {...props}
                  src={tauriSrc}
                  style={{
                    maxWidth: '100%',
                    height: 'auto',
                    borderRadius: '4px',
                    margin: '10px 0'
                  }}
                />
              );
            }
            
            // External images
            return <img {...props} style={{ maxWidth: '100%', height: 'auto' }} />;
          },
          li: ({ node, children, ...props }) => {
            // Check if this is a task list item
            const text = node?.children?.[0]?.type === 'text' ? node.children[0].value : '';
            const match = text.match(/^\[([ xX])\]\s*(.*)$/);
            
            if (match && onTodoToggle) {
              const isChecked = match[1] !== ' ';
              const content = match[2];
              
              // Find the line number for this todo
              const lineText = `${isChecked ? '[x]' : '[ ]'} ${content}`;
              const lineIndex = lines.findIndex(line => line.includes(lineText));
              const lineNumber = lineIndex + 1;
              const todoId = `todo-line-${lineNumber}`;
              
              return (
                <li style={{ listStyle: 'none' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (todoHandlersRef.current[todoId]) {
                          todoHandlersRef.current[todoId]();
                        }
                      }}
                      style={{ marginRight: '8px', marginTop: '3px' }}
                    />
                    <span>{content}</span>
                  </label>
                </li>
              );
            }
            
            return <li {...props}>{children}</li>;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};