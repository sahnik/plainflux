import React, { useState, useMemo, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FileText, Trash2, FolderPlus, FilePlus, Edit, ExternalLink } from 'lucide-react';
import { NoteMetadata } from '../types';

interface NotesTreeProps {
  notes: NoteMetadata[];
  folders: string[];
  selectedPath?: string;
  onNoteSelect: (note: NoteMetadata) => void;
  onNoteDoubleClick?: (note: NoteMetadata) => void;
  onNoteMove: (note: NoteMetadata, targetFolder: string) => void;
  onNoteDelete: (note: NoteMetadata) => void;
  onFolderDelete: (folderPath: string) => void;
  onFolderCreate: (parentPath: string) => void;
  onNoteCreate: (folderPath: string) => void;
  onNoteRename?: (note: NoteMetadata) => void;
  onFolderRename?: (folderPath: string, currentName: string) => void;
}

interface FolderNode {
  name: string;
  path: string;
  children: FolderNode[];
  notes: NoteMetadata[];
}

type FolderContextMenuItem = {
  path: string;
  name?: string;
};

type NotesTreeContextMenu =
  | {
      x: number;
      y: number;
      type: 'note';
      item: NoteMetadata;
    }
  | {
      x: number;
      y: number;
      type: 'folder';
      item: FolderContextMenuItem;
    };

const buildFolderTree = (notes: NoteMetadata[], folders: string[]): FolderNode => {
  const root: FolderNode = {
    name: 'Notes',
    path: '',
    children: [],
    notes: [],
  };

  const folderMap = new Map<string, FolderNode>();
  folderMap.set('', root);

  // First, create all folders (from both notes and the folders list)
  const allFolderPaths = new Set([
    ...notes.map(note => note.folder).filter(f => f),
    ...folders
  ]);

  allFolderPaths.forEach(folderPath => {
    if (folderPath && !folderMap.has(folderPath)) {
      // Split on both forward slashes and backslashes to handle Windows paths
      const parts = folderPath.split(/[/\\]/).filter(p => p);
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
  folders,
  selectedPath, 
  onNoteSelect,
  onNoteDoubleClick,
  onNoteMove,
  onNoteDelete,
  onFolderDelete,
  onFolderCreate,
  onNoteCreate,
  onNoteRename,
  onFolderRename
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedNote, setDraggedNote] = useState<NoteMetadata | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<NotesTreeContextMenu | null>(null);
  
  const folderTree = useMemo(() => buildFolderTree(notes, folders), [notes, folders]);

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

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handleToggle = (path: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedFolders(newExpanded);
  };

  const isRootFolderContext =
    contextMenu?.type === 'folder' &&
    (!contextMenu.item?.path || contextMenu.item.path === '.' || contextMenu.item.path === '/' || contextMenu.item.path === '\\');

  return (
    <div className="notes-tree">
      <FolderItem
        folder={folderTree}
        level={0}
        expandedFolders={expandedFolders}
        onToggle={handleToggle}
        selectedPath={selectedPath}
        onNoteSelect={onNoteSelect}
        onNoteDoubleClick={onNoteDoubleClick}
        onNoteDelete={onNoteDelete}
        onFolderDelete={onFolderDelete}
        onFolderCreate={onFolderCreate}
        onNoteCreate={onNoteCreate}
        draggedNote={draggedNote}
        setDraggedNote={setDraggedNote}
        dropTargetFolder={dropTargetFolder}
        setDropTargetFolder={setDropTargetFolder}
        setContextMenu={setContextMenu}
      />
      
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'folder' && (
            <>
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onNoteCreate(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <FilePlus size={14} />
                <span>New note</span>
              </button>
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onFolderCreate(contextMenu.item.path);
                  setContextMenu(null);
                }}
              >
                <FolderPlus size={14} />
                <span>New folder</span>
              </button>
            </>
          )}
          {contextMenu.type === 'note' && (
            <>
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  onNoteDoubleClick?.(contextMenu.item);
                  setContextMenu(null);
                }}
              >
                <ExternalLink size={14} />
                <span>Open in New Tab</span>
              </button>
              <div className="context-menu-separator" />
            </>
          )}
          {(contextMenu.type === 'note' || !isRootFolderContext) && (
            <>
              {contextMenu.type === 'folder' && <div className="context-menu-separator" />}
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  // Trigger rename dialog
                  if (contextMenu.type === 'note') {
                    onNoteRename?.(contextMenu.item);
                  } else {
                    onFolderRename?.(contextMenu.item.path, contextMenu.item.name ?? '');
                  }
                  setContextMenu(null);
                }}
              >
                <Edit size={14} />
                <span>Rename</span>
              </button>
              <div className="context-menu-separator" />
              <button
                className="context-menu-item"
                onClick={(e) => {
                  e.stopPropagation();
                  if (contextMenu.type === 'note') {
                    onNoteDelete(contextMenu.item);
                  } else {
                    onFolderDelete(contextMenu.item.path);
                  }
                  setContextMenu(null);
                }}
              >
                <Trash2 size={14} />
                <span>Delete {contextMenu.type}</span>
              </button>
            </>
          )}
        </div>
      )}
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
  onNoteDoubleClick?: (note: NoteMetadata) => void;
  onNoteDelete: (note: NoteMetadata) => void;
  onFolderDelete: (folderPath: string) => void;
  onFolderCreate: (parentPath: string) => void;
  onNoteCreate: (folderPath: string) => void;
  draggedNote: NoteMetadata | null;
  setDraggedNote: (note: NoteMetadata | null) => void;
  dropTargetFolder: string | null;
  setDropTargetFolder: (folder: string | null) => void;
  setContextMenu: (menu: NotesTreeContextMenu | null) => void;
}> = ({ 
  folder, 
  level, 
  expandedFolders, 
  onToggle, 
  selectedPath, 
  onNoteSelect,
  onNoteDoubleClick,
  onNoteDelete,
  onFolderDelete,
  onFolderCreate,
  onNoteCreate,
  draggedNote,
  setDraggedNote,
  dropTargetFolder,
  setDropTargetFolder,
  setContextMenu
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

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (level > 0) { // Don't allow deleting root folder
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'folder',
        item: { path: folder.path, name: folder.name }
      });
    }
  };

  const handleRootContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'folder',
      item: { path: '' } // Root folder has empty path
    });
  };

  if (level === 0) {
    // Root folder
    return (
      <div
        className={`root-folder ${isDropTarget ? 'drag-over' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleRootContextMenu}
      >
        {folder.notes.map(note => (
          <NoteItem
            key={note.path}
            note={note}
            level={0}
            selected={selectedPath === note.path}
            onSelect={onNoteSelect}
            onDoubleClick={onNoteDoubleClick}
            onDelete={onNoteDelete}
            setDraggedNote={setDraggedNote}
            isDragging={draggedNote?.path === note.path}
            setContextMenu={setContextMenu}
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
            onNoteDoubleClick={onNoteDoubleClick}
            onNoteDelete={onNoteDelete}
            onFolderDelete={onFolderDelete}
            onFolderCreate={onFolderCreate}
            onNoteCreate={onNoteCreate}
            draggedNote={draggedNote}
            setDraggedNote={setDraggedNote}
            dropTargetFolder={dropTargetFolder}
            setDropTargetFolder={setDropTargetFolder}
            setContextMenu={setContextMenu}
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
        onContextMenu={handleContextMenu}
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
              onDoubleClick={onNoteDoubleClick}
              onDelete={onNoteDelete}
              setDraggedNote={setDraggedNote}
              isDragging={draggedNote?.path === note.path}
              setContextMenu={setContextMenu}
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
              onNoteDoubleClick={onNoteDoubleClick}
              onNoteDelete={onNoteDelete}
              onFolderDelete={onFolderDelete}
              onFolderCreate={onFolderCreate}
              onNoteCreate={onNoteCreate}
              draggedNote={draggedNote}
              setDraggedNote={setDraggedNote}
              dropTargetFolder={dropTargetFolder}
              setDropTargetFolder={setDropTargetFolder}
              setContextMenu={setContextMenu}
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
  onDoubleClick?: (note: NoteMetadata) => void;
  onDelete: (note: NoteMetadata) => void;
  setDraggedNote: (note: NoteMetadata | null) => void;
  isDragging: boolean;
  setContextMenu: (menu: NotesTreeContextMenu | null) => void;
}> = ({ note, level, selected, onSelect, onDoubleClick, setDraggedNote, isDragging, setContextMenu }) => {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Single click immediately selects the note (no delay)
    onSelect(note);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Double click opens in new tab
    if (onDoubleClick) {
      onDoubleClick(note);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse button - open in new tab
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      if (onDoubleClick) {
        onDoubleClick(note);
      }
      return;
    }

    // Left mouse button - record position for drag detection
    if (e.button === 0) {
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;

    // Check if mouse has moved enough to start drag (5px threshold)
    const distance = Math.sqrt(
      Math.pow(e.clientX - dragStart.x, 2) + 
      Math.pow(e.clientY - dragStart.y, 2)
    );

    if (distance > 5) {
      setDraggedNote(note);
      setDragStart(null);
    }
  };

  const handleMouseUp = () => {
    setDragStart(null);
  };

  const handleMouseLeave = () => {
    setDragStart(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'note',
      item: note
    });
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
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      <FileText size={14} />
      <span className="note-title">{note.title}</span>
    </div>
  );
};
