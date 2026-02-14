import React, { useCallback, useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note, NoteMetadata } from '../types';
import { createAutocompleteExtension } from '../utils/editorAutocomplete';
import { createPasteHandler } from '../utils/fileHandler';
import { createSearchHighlightExtension, setSearchTerm, scrollToFirstMatch } from '../utils/searchHighlight';
import { createGitBlameExtension, updateBlameInfo } from '../utils/gitBlame';
import { createDynamicTheme, createSyntaxHighlighting } from '../utils/editorThemes';
import { createNoteLinkExtension } from '../utils/editorNoteLinkExtension';
import { multiCursorKeymap } from '../utils/multiCursor';
import { createFoldingExtension } from '../utils/foldingExtension';
import { scrollToLineAndHighlight, highlightLineExtension } from '../utils/editorScrolling';
import { tauriApi } from '../api/tauri';
import { useTheme } from '../contexts/ThemeContext';

interface NoteEditorProps {
  note: Note | null;
  isPreview: boolean;
  onChange: (content: string) => void;
  onLinkClick: (noteName: string, blockId?: string) => void;
  onLinkOpenInNewTab: (noteName: string, blockId?: string) => void;
  onTagClick?: (tag: string) => void;
  onTodoToggle?: (lineNumber: number) => void;
  notes: NoteMetadata[];
  tags: string[];
  searchTerm?: string;
  scrollToBlockId?: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, isPreview, onChange, onLinkClick, onLinkOpenInNewTab, onTagClick, onTodoToggle, notes, tags, searchTerm, scrollToBlockId }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autocompleteDataRef = useRef({ notes, tags });
  const onChangeRef = useRef(onChange);
  const onLinkClickRef = useRef(onLinkClick);
  const onLinkOpenInNewTabRef = useRef(onLinkOpenInNewTab);
  const { settings } = useTheme();
  const notePath = note?.path;
  const noteContent = note?.content ?? '';
  const noteContentRef = useRef(noteContent);

  // Update autocomplete data when notes or tags change
  useEffect(() => {
    autocompleteDataRef.current = { notes, tags };
  }, [notes, tags]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onLinkClickRef.current = onLinkClick;
  }, [onLinkClick]);

  useEffect(() => {
    onLinkOpenInNewTabRef.current = onLinkOpenInNewTab;
  }, [onLinkOpenInNewTab]);

  useEffect(() => {
    noteContentRef.current = noteContent;
  }, [noteContent]);

  // Helper function to check if a note exists
  const noteExists = useCallback((noteName: string): boolean => {
    return autocompleteDataRef.current.notes.some(note =>
      note.title.toLowerCase() === noteName.toLowerCase() ||
      note.title.toLowerCase() === noteName.toLowerCase() + '.md'
    );
  }, []);

  useEffect(() => {
    if (!notePath || isPreview || !editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const startState = EditorState.create({
      doc: noteContentRef.current,
      extensions: [
        basicSetup,
        markdown(),
        createDynamicTheme(settings.theme),
        createSyntaxHighlighting(settings.theme),
        EditorView.lineWrapping,
        createAutocompleteExtension(autocompleteDataRef),
        createPasteHandler(notePath),
        createSearchHighlightExtension(),
        createGitBlameExtension(settings.showGitBlame),
        createNoteLinkExtension(
          (noteName, blockId) => onLinkClickRef.current(noteName, blockId),
          (noteName, blockId) => onLinkOpenInNewTabRef.current(noteName, blockId),
          noteExists,
        ),
        multiCursorKeymap,
        createFoldingExtension(),
        highlightLineExtension,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    // Load git blame info for the current note
    updateBlameInfo(viewRef.current, notePath, settings.showGitBlame);

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [
    notePath,
    isPreview,
    settings.theme,
    settings.fontSize,
    settings.showGitBlame,
    noteExists,
  ]);

  // Update editor content when note changes
  useEffect(() => {
    if (!notePath || isPreview || !viewRef.current) return;
    
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== noteContent) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: noteContent,
        },
      });
    }
  }, [noteContent, notePath, isPreview]);

  // Update search highlighting when search term changes
  useEffect(() => {
    if (!viewRef.current || isPreview) return;

    setSearchTerm(viewRef.current, searchTerm || '');
    if (searchTerm) {
      scrollToFirstMatch(viewRef.current, searchTerm);
    }
  }, [searchTerm, isPreview]);

  // Scroll to block when scrollToBlockId changes
  useEffect(() => {
    if (!viewRef.current || isPreview || !scrollToBlockId || !notePath) return;

    const scrollToBlock = async () => {
      try {
        // Check if it's a direct line reference (e.g., "line-42")
        if (scrollToBlockId.startsWith('line-')) {
          const lineNumber = parseInt(scrollToBlockId.replace('line-', ''), 10);
          if (!isNaN(lineNumber)) {
            scrollToLineAndHighlight(viewRef.current!, lineNumber);
            return;
          }
        }

        // Otherwise, try to resolve it as a block reference
        const blockInfo = await tauriApi.getBlockReference(notePath, scrollToBlockId);
        if (blockInfo) {
          const [lineNumber] = blockInfo;
          scrollToLineAndHighlight(viewRef.current!, lineNumber);
        }
      } catch (error) {
        console.error('Failed to scroll to block:', error);
      }
    };

    scrollToBlock();
  }, [scrollToBlockId, isPreview, notePath]);

  if (!note) {
    return <div className="editor-empty">Select a note to start editing</div>;
  }

  if (isPreview) {
    return (
      <div className="markdown-preview">
        <MarkdownRenderer 
          content={note.content}
          onLinkClick={onLinkClick}
          onTagClick={onTagClick}
          onTodoToggle={onTodoToggle}
          notePath={note.path}
          notes={notes}
          searchTerm={searchTerm}
        />
      </div>
    );
  }

  return <div ref={editorRef} className="editor-container" />;
};
