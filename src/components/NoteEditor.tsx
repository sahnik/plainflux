import React, { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { MarkdownRenderer } from './MarkdownRenderer';
import { Note } from '../types';

interface NoteEditorProps {
  note: Note | null;
  isPreview: boolean;
  onChange: (content: string) => void;
  onLinkClick: (noteName: string) => void;
}

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, isPreview, onChange, onLinkClick }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

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

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy();
      }
    };
  }, [note?.path, isPreview]);

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

  if (!note) {
    return <div className="editor-empty">Select a note to start editing</div>;
  }

  if (isPreview) {
    return (
      <div className="markdown-preview">
        <MarkdownRenderer 
          content={note.content}
          onLinkClick={onLinkClick}
        />
      </div>
    );
  }

  return <div ref={editorRef} className="editor-container" />;
};