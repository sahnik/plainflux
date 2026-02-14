import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { convertFileSrc } from '@tauri-apps/api/core';

import { NoteMetadata } from '../types';
import { tauriApi } from '../api/tauri';

interface MarkdownRendererProps {
  content: string;
  onLinkClick: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
  onTodoToggle?: (lineNumber: number) => void;
  notePath?: string;
  notes?: NoteMetadata[];
  searchTerm?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onLinkClick, onTagClick, onTodoToggle, notePath, notes, searchTerm }) => {
  const TODO_LINE_MARKER_PREFIX = '__plainflux_todo_line_';
  const TODO_LINE_MARKER_REGEX = new RegExp(`^${TODO_LINE_MARKER_PREFIX}(\\d+)__$`);

  // Store link and tag handlers in a ref to avoid stale closures
  const linkHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const tagHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const todoHandlersRef = React.useRef<{ [key: string]: () => void }>({});
  const noteExistsRef = React.useRef<{ [key: string]: boolean }>({});
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [transcludedContent, setTranscludedContent] = React.useState<{ [key: string]: string }>({});
  const requestedTransclusions = React.useRef<Set<string>>(new Set());

  // Load transcluded content
  React.useEffect(() => {
    const transclusionRegex = /!\[\[([^\]]+)\]\]/g;
    const matches = [...content.matchAll(transclusionRegex)];

    // Reset tracked requests when content changes to allow re-fetching
    requestedTransclusions.current = new Set();

    matches.forEach(async (match) => {
      const link = match[1];
      if (requestedTransclusions.current.has(link)) return;
      requestedTransclusions.current.add(link);

      try {
        const resolvedContent = await tauriApi.resolveTransclusion(link);
        setTranscludedContent(prev => ({ ...prev, [link]: resolvedContent }));
      } catch (error) {
        setTranscludedContent(prev => ({ ...prev, [link]: `Error: ${error}` }));
      }
    });
  }, [content]);

  // Scroll to first search match when search term changes
  React.useEffect(() => {
    if (searchTerm && containerRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const firstHighlight = containerRef.current?.querySelector('.search-highlight');
        if (firstHighlight) {
          firstHighlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [searchTerm]);
  
  // Replace [[Note]] syntax with special markers
  let linkCounter = 0;
  let tagCounter = 0;
  
  // Process content line by line to handle todos
  const lines = content.split('\n');
  const processedLines = lines.map((line, index) => {
    // Handle transclusions ![[Note]] or ![[Note#block]]
    // Replace with embedded content in a special div
    line = line.replace(/!\[\[([^\]]+)\]\]/g, (_match, link) => {
      const embeddedContent = transcludedContent[link];
      if (embeddedContent) {
        // Create a unique marker that we'll replace later
        const transId = `transclusion-${linkCounter++}`;
        linkHandlersRef.current[transId] = () => {
          // Extract note name (strip block reference if present)
          const noteName = link.split('#')[0];
          onLinkClick(noteName);
        };
        // Return a markdown blockquote with the content
        return `\n\n> **Embedded: ![[${link}]]** [→](#${transId})\n>\n${embeddedContent.split('\n').map(l => '> ' + l).join('\n')}\n\n`;
      } else {
        // Still loading or error
        return `\n\n> **Loading: ![[${link}]]**\n\n`;
      }
    });

    // Handle [[Note]] links
    line = line.replace(/\[\[([^\]]+)\]\]/g, (_match, noteName) => {
      const linkId = `note-link-${linkCounter++}`;
      linkHandlersRef.current[linkId] = () => onLinkClick(noteName);
      
      // Check if the note exists
      const noteExists = notes ? notes.some(note => 
        note.title.toLowerCase() === noteName.toLowerCase() || 
        note.title.toLowerCase() === noteName.toLowerCase() + '.md'
      ) : true; // Default to true if notes not provided
      
      noteExistsRef.current[linkId] = noteExists;
      return `[${noteName}](#${linkId})`;
    });
    
    // Don't process checkboxes here, we'll handle them in the component
    // Just track line numbers for todos
    if (onTodoToggle) {
      const todoMatch = line.match(/^(\s*[-*]\s*)\[([ xX])\]\s*(.*)$/);
      if (todoMatch) {
        const lineNumber = index + 1;
        const todoId = `todo-line-${lineNumber}`;
        todoHandlersRef.current[todoId] = () => onTodoToggle(lineNumber);

        // Inject a stable line marker to avoid ambiguous matching when duplicate todo text exists.
        const prefix = todoMatch[1];
        const checkboxState = todoMatch[2];
        const todoContent = todoMatch[3];
        line = `${prefix}[${checkboxState}] ${TODO_LINE_MARKER_PREFIX}${lineNumber}__ ${todoContent}`;
      }
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
  
  // Store search highlighting info for later use in components
  const searchHighlightRef = React.useRef<{
    searchTerm?: string;
    regex?: RegExp;
  }>({});
  
  if (searchTerm) {
    // Create a regex for case-insensitive search, escaping special regex characters
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    searchHighlightRef.current = { searchTerm, regex: searchRegex };
  } else {
    searchHighlightRef.current = {};
  }
  
  // Helper function to highlight search terms in text
  const highlightText = (text: string): React.ReactNode => {
    if (!searchHighlightRef.current.regex || !searchHighlightRef.current.searchTerm) {
      return text;
    }
    
    const searchTerm = searchHighlightRef.current.searchTerm;
    
    // Create a new regex for each call to avoid state issues
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    
    const parts = text.split(regex);
    
    // If no matches found, return original text
    if (parts.length === 1) {
      return text;
    }
    
    const result: React.ReactNode[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      // Check if this part matches our search term (case-insensitive)
      if (part && part.toLowerCase() === searchTerm.toLowerCase()) {
        result.push(
          <mark
            key={`highlight-${i}`}
            className="search-highlight"
            style={{
              backgroundColor: '#ffeb3b',
              color: '#000',
              padding: '2px',
              borderRadius: '2px'
            }}
          >
            {part}
          </mark>
        );
      } else {
        // Only add non-empty parts
        if (part) {
          result.push(part);
        }
      }
    }
    
    return result;
  };
  
  // Helper function to process children and highlight text nodes
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    if (!searchHighlightRef.current.regex || !searchHighlightRef.current.searchTerm) {
      return children;
    }
    
    if (typeof children === 'string') {
      return highlightText(children);
    }
    
    if (Array.isArray(children)) {
      return children.map((child, index) => {
        if (typeof child === 'string') {
          return <React.Fragment key={index}>{highlightText(child)}</React.Fragment>;
        }
        return child;
      });
    }
    
    return children;
  };

  return (
    <div 
      ref={containerRef}
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
          // Highlight text in paragraphs
          p: ({ node: _node, children, ...props }) => {
            return <p {...props}>{processChildren(children)}</p>;
          },
          // Highlight text in headings  
          h1: ({ node: _node, children, ...props }) => {
            return <h1 {...props}>{processChildren(children)}</h1>;
          },
          h2: ({ node: _node, children, ...props }) => {
            return <h2 {...props}>{processChildren(children)}</h2>;
          },
          h3: ({ node: _node, children, ...props }) => {
            return <h3 {...props}>{processChildren(children)}</h3>;
          },
          h4: ({ node: _node, children, ...props }) => {
            return <h4 {...props}>{processChildren(children)}</h4>;
          },
          h5: ({ node: _node, children, ...props }) => {
            return <h5 {...props}>{processChildren(children)}</h5>;
          },
          h6: ({ node: _node, children, ...props }) => {
            return <h6 {...props}>{processChildren(children)}</h6>;
          },
          a: ({ node: _node, ...props }) => {
            const href = props.href || '';
            
            // Style note links differently
            if (href.startsWith('#note-link-')) {
              const linkId = href.substring(1);
              const exists = noteExistsRef.current[linkId];
              
              return (
                <a
                  {...props}
                  style={{ 
                    color: exists ? '#4ec9b0' : '#ff6b6b', 
                    cursor: 'pointer',
                    textDecoration: 'none',
                    fontStyle: exists ? 'normal' : 'italic',
                    backgroundColor: exists ? 'rgba(78, 201, 176, 0.1)' : 'rgba(255, 107, 107, 0.1)',
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
            
            // Handle attachment links
            if (href && href.startsWith('attachments/') && notePath) {
              return (
                <a
                  {...props}
                  style={{
                    color: '#9cdcfe',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    backgroundColor: 'rgba(156, 220, 254, 0.1)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid rgba(156, 220, 254, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (notePath) {
                      tauriApi.openFileExternal(href, notePath).catch((error) => {
                        console.error('Failed to open file:', error);
                      });
                    }
                  }}
                />
              );
            }

            // Regular external links
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
          img: ({ node: _node, ...props }) => {
            const src = props.src || '';
            
            // If it's a relative path and we have the note path, convert to absolute
            if (notePath && src.startsWith('images/')) {
              // Handle both forward slashes and backslashes for cross-platform compatibility
              const lastSlashIndex = Math.max(notePath.lastIndexOf('/'), notePath.lastIndexOf('\\'));
              const noteDir = notePath.substring(0, lastSlashIndex);
              
              // Use the same path separator as the original path for consistency
              const pathSeparator = notePath.includes('\\') ? '\\' : '/';
              const absolutePath = `${noteDir}${pathSeparator}${src}`;
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
              const rawContent = match[2];

              const [firstToken = '', ...remainingTokens] = rawContent.split(/\s+/);
              const markerMatch = firstToken.match(TODO_LINE_MARKER_REGEX);
              const lineNumber = markerMatch ? parseInt(markerMatch[1], 10) : -1;
              const content = markerMatch ? remainingTokens.join(' ').trim() : rawContent;

              // Fallback if marker is missing for any reason
              const resolvedLineNumber = lineNumber > 0
                ? lineNumber
                : lines.findIndex(line => line.includes(`${isChecked ? '[x]' : '[ ]'} ${content}`)) + 1;
              if (resolvedLineNumber <= 0) {
                return <li {...props}>{children}</li>;
              }

              const todoId = `todo-line-${resolvedLineNumber}`;
              
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
