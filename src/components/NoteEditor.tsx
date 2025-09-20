import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note, NoteMetadata } from '../types';
import { createAutocompleteExtension } from '../utils/editorAutocomplete';
import { createPasteHandler } from '../utils/imageHandler';
import { createSearchHighlightExtension, setSearchTerm, scrollToFirstMatch } from '../utils/searchHighlight';
import { createGitBlameExtension, updateBlameInfo } from '../utils/gitBlame';
import { createDynamicTheme, createSyntaxHighlighting } from '../utils/editorThemes';
import { createNoteLinkExtension } from '../utils/editorNoteLinkExtension';
import { useTheme } from '../contexts/ThemeContext';

interface NoteEditorProps {
  note: Note | null;
  isPreview: boolean;
  onChange: (content: string) => void;
  onLinkClick: (noteName: string) => void;
  onLinkOpenInNewTab: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
  onTodoToggle?: (lineNumber: number) => void;
  notes: NoteMetadata[];
  tags: string[];
  searchTerm?: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, isPreview, onChange, onLinkClick, onLinkOpenInNewTab, onTagClick, onTodoToggle, notes, tags, searchTerm }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autocompleteDataRef = useRef({ notes, tags });
  const { settings } = useTheme();

  // Update autocomplete data when notes or tags change
  useEffect(() => {
    autocompleteDataRef.current = { notes, tags };
  }, [notes, tags]);

  // Helper function to check if a note exists
  const noteExists = (noteName: string): boolean => {
    return notes.some(note =>
      note.title.toLowerCase() === noteName.toLowerCase() ||
      note.title.toLowerCase() === noteName.toLowerCase() + '.md'
    );
  };

  useEffect(() => {
    if (!note || isPreview || !editorRef.current) return;

    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const startState = EditorState.create({
      doc: note.content,
      extensions: [
        basicSetup,
        markdown(),
        createDynamicTheme(settings.theme),
        createSyntaxHighlighting(settings.theme),
        EditorView.lineWrapping,
        createAutocompleteExtension(autocompleteDataRef),
        createPasteHandler(note.path),
        createSearchHighlightExtension(),
        createGitBlameExtension(settings.showGitBlame),
        createNoteLinkExtension(onLinkClick, onLinkOpenInNewTab, noteExists),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
      ],
    });

    viewRef.current = new EditorView({
      state: startState,
      parent: editorRef.current,
    });

    // Apply search highlighting immediately if there's a search term
    if (searchTerm) {
      setSearchTerm(viewRef.current, searchTerm);
      scrollToFirstMatch(viewRef.current, searchTerm);
    }

    // Load git blame info for the current note
    updateBlameInfo(viewRef.current, note.path, settings.showGitBlame);

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [note?.path, isPreview, searchTerm, settings.theme, settings.fontSize, settings.showGitBlame]);

  // Update editor content when note changes
  useEffect(() => {
    if (!note || isPreview || !viewRef.current) return;
    
    const currentContent = viewRef.current.state.doc.toString();
    if (currentContent !== note.content) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: note.content,
        },
      });
    }
  }, [note?.content, isPreview]);

  // Update search highlighting when search term changes
  useEffect(() => {
    if (!viewRef.current || isPreview) return;
    
    setSearchTerm(viewRef.current, searchTerm || '');
    if (searchTerm) {
      scrollToFirstMatch(viewRef.current, searchTerm);
    }
  }, [searchTerm, isPreview]);

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