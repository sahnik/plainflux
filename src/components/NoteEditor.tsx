import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note, NoteMetadata } from '../types';
import { createAutocompleteExtension } from '../utils/editorAutocomplete';
import { createPasteHandler } from '../utils/imageHandler';
import { createSearchHighlightExtension, setSearchTerm, scrollToFirstMatch } from '../utils/searchHighlight';

interface NoteEditorProps {
  note: Note | null;
  isPreview: boolean;
  onChange: (content: string) => void;
  onLinkClick: (noteName: string) => void;
  onTagClick?: (tag: string) => void;
  onTodoToggle?: (lineNumber: number) => void;
  notes: NoteMetadata[];
  tags: string[];
  searchTerm?: string;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, isPreview, onChange, onLinkClick, onTagClick, onTodoToggle, notes, tags, searchTerm }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const autocompleteDataRef = useRef({ notes, tags });
  
  // Update autocomplete data when notes or tags change
  useEffect(() => {
    autocompleteDataRef.current = { notes, tags };
  }, [notes, tags]);

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
        oneDark,
        EditorView.lineWrapping,
        createAutocompleteExtension(autocompleteDataRef),
        createPasteHandler(note.path),
        createSearchHighlightExtension(),
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

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [note?.path, isPreview, searchTerm]);

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