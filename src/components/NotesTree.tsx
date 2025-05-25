import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText } from 'lucide-react';
import { NoteMetadata } from '../types';

interface NotesTreeProps {
  notes: NoteMetadata[];
  selectedPath?: string;
  onNoteSelect: (note: NoteMetadata) => void;
  onNoteMove: (note: NoteMetadata, targetFolder: string) => void;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  notes: NoteMetadata[];
}

const buildFolderTree = (notes: NoteMetadata[]): FolderNode => {
  const root: FolderNode = {
    name: 'Notes',
    path: '',
    children: [],
    notes: [],
  };

  const folderMap = new Map<string, FolderNode>();
  folderMap.set('', root);

  // First, create all folders
  notes.forEach(note => {
    if (note.folder && !folderMap.has(note.folder)) {
      const parts = note.folder.split('/').filter(p => p);
      let currentPath = '';
      let parent = root;

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (!folderMap.has(currentPath)) {
          const newFolder: FolderNode = {
            name: part,
            path: currentPath,
            children: [],
            notes: [],
          };
          parent.children.push(newFolder);
          folderMap.set(currentPath, newFolder);
        }
        parent = folderMap.get(currentPath)!;
      }
    }
  });

  // Then, assign notes to folders
  notes.forEach(note => {
    const folder = folderMap.get(note.folder) || root;
    folder.notes.push(note);
  });

  // Sort folders and notes alphabetically
  const sortFolders = (folder: FolderNode) => {
    folder.children.sort((a, b) => a.name.localeCompare(b.name));
    folder.notes.sort((a, b) => a.title.localeCompare(b.title));
    folder.children.forEach(sortFolders);
  };
  sortFolders(root);

  return root;
};

export const NotesTree: React.FC<NotesTreeProps> = ({ 
  notes, 
  selectedPath, 
  onNoteSelect, 
  onNoteMove 
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedNote, setDraggedNote] = useState<NoteMetadata | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const folderTree = useMemo(() => buildFolderTree(notes), [notes]);

  // Handle the actual drop
  useEffect(() => {
    const handleMouseUp = () => {
      if (draggedNote && dropTargetFolder !== null && draggedNote.folder !== dropTargetFolder) {
        onNoteMove(draggedNote, dropTargetFolder);
      }
      setDraggedNote(null);
      setDropTargetFolder(null);
    };

    if (draggedNote) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [draggedNote, dropTargetFolder, onNoteMove]);

  const handleToggle = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  return (
    <div className="notes-tree">
      <FolderItem
        folder={folderTree}
        level={0}
        expandedFolders={expandedFolders}
        onToggle={handleToggle}
        selectedPath={selectedPath}
        onNoteSelect={onNoteSelect}
        draggedNote={draggedNote}
        setDraggedNote={setDraggedNote}
        dropTargetFolder={dropTargetFolder}
        setDropTargetFolder={setDropTargetFolder}
      />
    </div>
  );
};

const FolderItem: React.FC<{
  folder: FolderNode;
  level: number;
  expandedFolders: Set<string>;
  onToggle: (path: string) => void;
  selectedPath?: string;
  onNoteSelect: (note: NoteMetadata) => void;
  draggedNote: NoteMetadata | null;
  setDraggedNote: (note: NoteMetadata | null) => void;
  dropTargetFolder: string | null;
  setDropTargetFolder: (folder: string | null) => void;
}> = ({ 
  folder, 
  level, 
  expandedFolders, 
  onToggle, 
  selectedPath, 
  onNoteSelect, 
  draggedNote,
  setDraggedNote,
  dropTargetFolder,
  setDropTargetFolder
}) => {
  const isExpanded = expandedFolders.has(folder.path);
  const hasContent = folder.children.length > 0 || folder.notes.length > 0;
  const isDropTarget = dropTargetFolder === folder.path;
  const canDrop = draggedNote && draggedNote.folder !== folder.path;

  const handleMouseEnter = () => {
    if (canDrop) {
      setDropTargetFolder(folder.path);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    // Only clear if we're leaving to outside the folder, not to a child
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      if (dropTargetFolder === folder.path) {
        setDropTargetFolder(null);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasContent && !draggedNote) {
      onToggle(folder.path);
    }
  };

  if (level === 0) {
    // Root folder
    return (
      <div
        className={`root-folder ${isDropTarget ? 'drag-over' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {folder.notes.map(note => (
          <NoteItem
            key={note.path}
            note={note}
            level={0}
            selected={selectedPath === note.path}
            onSelect={onNoteSelect}
            setDraggedNote={setDraggedNote}
            isDragging={draggedNote?.path === note.path}
          />
        ))}
        {folder.children.map(child => (
          <FolderItem
            key={child.path}
            folder={child}
            level={1}
            expandedFolders={expandedFolders}
            onToggle={onToggle}
            selectedPath={selectedPath}
            onNoteSelect={onNoteSelect}
            draggedNote={draggedNote}
            setDraggedNote={setDraggedNote}
            dropTargetFolder={dropTargetFolder}
            setDropTargetFolder={setDropTargetFolder}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="folder-item">
      <div
        className={`folder-header ${isDropTarget ? 'drag-over' : ''}`}
        style={{ paddingLeft: `${(level - 1) * 16 + 8}px` }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {hasContent && (
          isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        )}
        <Folder size={14} />
        <span className="folder-name">{folder.name}</span>
      </div>
      
      {isExpanded && (
        <>
          {folder.notes.map(note => (
            <NoteItem
              key={note.path}
              note={note}
              level={level}
              selected={selectedPath === note.path}
              onSelect={onNoteSelect}
              setDraggedNote={setDraggedNote}
              isDragging={draggedNote?.path === note.path}
            />
          ))}
          {folder.children.map(child => (
            <FolderItem
              key={child.path}
              folder={child}
              level={level + 1}
              expandedFolders={expandedFolders}
              onToggle={onToggle}
              selectedPath={selectedPath}
              onNoteSelect={onNoteSelect}
              draggedNote={draggedNote}
              setDraggedNote={setDraggedNote}
              dropTargetFolder={dropTargetFolder}
              setDropTargetFolder={setDropTargetFolder}
            />
          ))}
        </>
      )}
    </div>
  );
};

const NoteItem: React.FC<{
  note: NoteMetadata;
  level: number;
  selected: boolean;
  onSelect: (note: NoteMetadata) => void;
  setDraggedNote: (note: NoteMetadata | null) => void;
  isDragging: boolean;
}> = ({ note, level, selected, onSelect, setDraggedNote, isDragging }) => {
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setMouseDownPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos) return;

    // Check if mouse has moved enough to start drag (5px threshold)
    const distance = Math.sqrt(
      Math.pow(e.clientX - mouseDownPos.x, 2) + 
      Math.pow(e.clientY - mouseDownPos.y, 2)
    );

    if (distance > 5) {
      setDraggedNote(note);
      setMouseDownPos(null);
    }
  };

  const handleMouseUp = () => {
    if (mouseDownPos && !isDragging) {
      // This was a click, not a drag
      onSelect(note);
    }
    setMouseDownPos(null);
  };

  return (
    <div
      className={`note-item ${selected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
      style={{ 
        paddingLeft: `${level * 16 + 24}px`,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setMouseDownPos(null)}
    >
      <FileText size={14} />
      <span className="note-title">{note.title}</span>
    </div>
  );
};