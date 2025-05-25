import React from 'react';
import { NoteMetadata } from '../types';

interface NotesListProps {
  notes: NoteMetadata[];
  selectedPath?: string;
  onNoteSelect: (note: NoteMetadata) => void;
}

export const NotesList: React.FC<NotesListProps> = ({ notes, selectedPath, onNoteSelect }) => {
  return (
    <div className="notes-list">
      {notes.map((note) => (
        <div
          key={note.path}
          className={`note-item ${selectedPath === note.path ? 'selected' : ''}`}
          onClick={() => onNoteSelect(note)}
        >
          <div className="note-title">{note.title}</div>
          <div className="note-date">
            {new Date(note.last_modified * 1000).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
};