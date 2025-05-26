import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertFileSrc } from '@tauri-apps/api/core';

interface MarkdownRendererProps {
  content: string;
  onLinkClick: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
  notePath?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick, onTagClick, notePath }) => {
  // Store link and tag handlers in a ref to avoid stale closures
  const linkHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const tagHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  
  // Replace [[Note]] syntax with special markers
  let linkCounter = 0;
  let tagCounter = 0;
  
  let processedContent = content.replace(/\[\[([^\]]+)\]\]/g, (_match, noteName) => {
    const linkId = `note-link-${linkCounter++}`;
    linkHandlersRef.current[linkId] = () => onLinkClick(noteName);
    return `[${noteName}](#${linkId})`;
  });
  
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
              const noteDir = notePath.substring(0, notePath.lastIndexOf('/'));
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
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};