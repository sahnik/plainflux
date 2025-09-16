import React from 'react';
import { FileText, Clock } from 'lucide-react';
import { RecentNote } from '../types';

interface RecentNotesProps {
  recentNotes: RecentNote[];
  selectedPath?: string;
  onNoteSelect: (note: RecentNote) => void;
  onNoteDoubleClick: (note: RecentNote) => void;
}

const formatRelativeTime = (timestamp: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) {
    return 'Just now';
  } else if (diff < 3600) {
    const minutes = Math.floor(diff / 60);
    return `${minutes}m ago`;
  } else if (diff < 86400) {
    const hours = Math.floor(diff / 3600);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400);
    return `${days}d ago`;
  }
};

export const RecentNotes: React.FC<RecentNotesProps> = ({
  recentNotes,
  selectedPath,
  onNoteSelect,
  onNoteDoubleClick,
}) => {
  const handleMouseDown = (e: React.MouseEvent, note: RecentNote) => {
    // Middle mouse button - open in new tab
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      onNoteDoubleClick(note);
      return;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // For now, just show the default context menu
    // Could add "Open in New Tab" option in the future
  };

  return (
    <div className="recent-notes">
      <div className="recent-notes-header">
        <Clock size={16} />
        <span>Recently Edited</span>
      </div>

      {recentNotes.length === 0 ? (
        <div className="recent-notes-empty">
          <span>No recent notes</span>
        </div>
      ) : (
        <div className="recent-notes-list">
          {recentNotes.map((note, index) => (
            <div
              key={`${note.path}-${index}`}
              className={`recent-note-item ${selectedPath === note.path ? 'selected' : ''}`}
              onClick={() => onNoteSelect(note)}
              onDoubleClick={() => onNoteDoubleClick(note)}
              onMouseDown={(e) => handleMouseDown(e, note)}
              onContextMenu={handleContextMenu}
              title={note.path}
            >
              <div className="recent-note-icon">
                <FileText size={16} />
              </div>

              <div className="recent-note-content">
                <div className="recent-note-title">{note.title}</div>
                <div className="recent-note-meta">
                  {note.folder && (
                    <span className="recent-note-folder">{note.folder}</span>
                  )}
                  <span className="recent-note-time">
                    {formatRelativeTime(note.last_modified)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
