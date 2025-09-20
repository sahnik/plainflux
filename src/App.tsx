import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Eye, Edit, FileText, Network } from 'lucide-react';
import './App.css';

import { Sidebar } from './components/Sidebar';
import { NotesTree } from './components/NotesTree';
import { TagsList } from './components/TagsList';
import { SearchPanel } from './components/SearchPanel';
import { NoteEditor } from './components/NoteEditor';
import { BacklinksPanel } from './components/BacklinksPanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InputDialog } from './components/InputDialog';
import { GraphView } from './components/GraphView';
import { TodosList } from './components/TodosList';
import { Help } from './components/Help';
import { TemplateSettings } from './components/TemplateSettings';
import { Settings } from './components/Settings';
import { TabBar } from './components/TabBar';
import { RecentNotes } from './components/RecentNotes';
import { ThemeProvider } from './contexts/ThemeContext';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useWindowState } from './hooks/useWindowState';

import { tauriApi, Todo } from './api/tauri';
import { ViewType, Note, NoteMetadata, Tab, RecentNote } from './types';

const queryClient = new QueryClient();

function AppContent() {
  useKeyboardShortcuts(); // Add keyboard shortcuts for font size
  useWindowState(); // Handle window state persistence
  const [currentView, setCurrentView] = useState<ViewType>('notes');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [isPreview, setIsPreview] = useState(false);
  const [showLocalGraph, setShowLocalGraph] = useState(false);
  const [showGlobalGraph, setShowGlobalGraph] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagFilteredNotes, setTagFilteredNotes] = useState<NoteMetadata[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    type: 'note' | 'folder';
    item: any;
    message: string;
  } | null>(null);
  const [createFolderDialog, setCreateFolderDialog] = useState<{
    isOpen: boolean;
    parentPath: string;
  } | null>(null);
  const [createNoteDialog, setCreateNoteDialog] = useState<{
    isOpen: boolean;
    folderPath: string;
  } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{
    isOpen: boolean;
    type: 'note' | 'folder';
    oldPath: string;
    currentName: string;
  } | null>(null);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: tauriApi.getNotesList,
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: tauriApi.getAllFolders,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: tauriApi.getAllTags,
  });

  const { data: backlinks = [] } = useQuery({
    queryKey: ['backlinks', selectedNote?.path],
    queryFn: () => selectedNote ? tauriApi.getBacklinks(selectedNote.path) : Promise.resolve([]),
    enabled: !!selectedNote,
  });

  const { data: outgoingLinks = [] } = useQuery({
    queryKey: ['outgoingLinks', selectedNote?.path],
    queryFn: () => selectedNote ? tauriApi.getOutgoingLinks(selectedNote.path) : Promise.resolve([]),
    enabled: !!selectedNote,
  });

  const { data: globalGraphData = { nodes: [], edges: [] } } = useQuery({
    queryKey: ['globalGraph'],
    queryFn: tauriApi.getGlobalGraph,
    enabled: showGlobalGraph,
  });

  const { data: localGraphData = { nodes: [], edges: [] } } = useQuery({
    queryKey: ['localGraph', selectedNote?.path],
    queryFn: () => selectedNote ? tauriApi.getLocalGraph(selectedNote.path) : Promise.resolve({ nodes: [], edges: [] }),
    enabled: showLocalGraph && !!selectedNote,
  });

  const { data: incompleteTodos = [] } = useQuery({
    queryKey: ['incompleteTodos'],
    queryFn: tauriApi.getIncompleteTodos,
    enabled: currentView === 'todos',
  });

  const { data: recentNotes = [] } = useQuery({
    queryKey: ['recentNotes'],
    queryFn: tauriApi.getRecentNotes,
    enabled: currentView === 'recent',
  });

  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      tauriApi.saveNote(path, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['incompleteTodos'] });
      queryClient.invalidateQueries({ queryKey: ['recentNotes'] });
      
      // Mark the tab as clean after successful save
      setTabs(currentTabs => {
        const tabIndex = currentTabs.findIndex(tab => tab.note.path === variables.path);
        if (tabIndex !== -1) {
          const updatedTabs = [...currentTabs];
          updatedTabs[tabIndex].isDirty = false;
          return updatedTabs;
        }
        return currentTabs;
      });
    },
  });

  // Tab management functions
  const openInNewTab = useCallback((note: Note) => {
    // Check if the note is already open in a tab
    const existingTabIndex = tabs.findIndex(tab => tab.note.path === note.path);
    
    if (existingTabIndex !== -1) {
      // Note is already open, switch to that tab
      setActiveTabIndex(existingTabIndex);
    } else {
      // Open in new tab
      const newTab: Tab = { note, isDirty: false };
      setTabs([...tabs, newTab]);
      setActiveTabIndex(tabs.length);
    }
    
    setSelectedNote(note);
  }, [tabs]);

  const closeTab = useCallback((index: number) => {
    const tabToClose = tabs[index];
    
    // Check if tab has unsaved changes
    if (tabToClose.isDirty) {
      // For now, just show a confirm dialog using browser's confirm
      // In production, you'd use a proper dialog component
      if (!window.confirm(`"${tabToClose.note.title}" has unsaved changes. Close anyway?`)) {
        return;
      }
    }
    
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    
    // Adjust active tab index
    if (newTabs.length === 0) {
      setSelectedNote(null);
      setActiveTabIndex(0);
    } else if (index === activeTabIndex) {
      // Closing the active tab
      const newActiveIndex = index >= newTabs.length ? newTabs.length - 1 : index;
      setActiveTabIndex(newActiveIndex);
      setSelectedNote(newTabs[newActiveIndex].note);
    } else if (index < activeTabIndex) {
      // Closing a tab before the active one
      setActiveTabIndex(activeTabIndex - 1);
    }
  }, [tabs, activeTabIndex]);

  const switchTab = useCallback((index: number) => {
    if (index >= 0 && index < tabs.length) {
      setActiveTabIndex(index);
      setSelectedNote(tabs[index].note);
    }
  }, [tabs]);


  // Open daily note on startup
  useEffect(() => {
    handleDailyNote();
  }, []); // Empty dependency array means this runs once on mount

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + E: Toggle preview mode
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault();
        if (selectedNote && !showGlobalGraph && !showLocalGraph) {
          setIsPreview(!isPreview);
        }
      }
      
      // Cmd/Ctrl + W: Close current tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        if (tabs.length > 0) {
          closeTab(activeTabIndex);
        }
      }
      
      // Cmd/Ctrl + Tab: Cycle through tabs
      if ((e.metaKey || e.ctrlKey) && e.key === 'Tab') {
        e.preventDefault();
        if (tabs.length > 1) {
          if (e.shiftKey) {
            // Cycle backward
            const newIndex = activeTabIndex === 0 ? tabs.length - 1 : activeTabIndex - 1;
            switchTab(newIndex);
          } else {
            // Cycle forward
            const newIndex = (activeTabIndex + 1) % tabs.length;
            switchTab(newIndex);
          }
        }
      }
      
      // Cmd/Ctrl + 1-9: Jump to specific tab
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const tabIndex = parseInt(e.key) - 1;
        if (tabIndex < tabs.length) {
          switchTab(tabIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreview, selectedNote, showGlobalGraph, showLocalGraph, tabs, activeTabIndex, closeTab, switchTab]);

  const handleNoteSelect = async (noteMetadata: NoteMetadata) => {
    const note = await tauriApi.readNote(noteMetadata.path);
    
    // Single click: replace current tab or open first tab
    if (tabs.length === 0) {
      openInNewTab(note);
    } else {
      // Replace current tab's content
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        note,
        isDirty: false
      };
      setTabs(updatedTabs);
      setSelectedNote(note);
    }
    
    // Clear search term when selecting from non-search views
    if (currentView !== 'search') {
      setSearchTerm('');
    }
  };

  const handleNoteDoubleClick = async (noteMetadata: NoteMetadata) => {
    const note = await tauriApi.readNote(noteMetadata.path);
    openInNewTab(note);
    // Clear search term when selecting from non-search views
    if (currentView !== 'search') {
      setSearchTerm('');
    }
  };

  const handleRecentNoteSelect = async (recentNote: RecentNote) => {
    const note = await tauriApi.readNote(recentNote.path);

    // Single click: replace current tab or open first tab
    if (tabs.length === 0) {
      openInNewTab(note);
    } else {
      // Replace current tab's content
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        note,
        isDirty: false
      };
      setTabs(updatedTabs);
      setSelectedNote(note);
    }

    setSearchTerm('');
  };

  const handleRecentNoteDoubleClick = async (recentNote: RecentNote) => {
    const note = await tauriApi.readNote(recentNote.path);
    openInNewTab(note);
    setSearchTerm('');
  };

  const handleNoteChange = useCallback((notePath: string, content: string) => {
    // Capture current activeTabIndex to avoid stale closures
    const currentActiveTabIndex = activeTabIndex;

    // Use functional update to avoid stale closures and ensure we're updating the correct tab
    setTabs(currentTabs => {
      const tabIndex = currentTabs.findIndex(tab => tab.note.path === notePath);
      if (tabIndex === -1) {
        console.warn(`Tab not found for path: ${notePath}`);
        return currentTabs;
      }

      // Verify this is actually the active tab to prevent race conditions
      if (tabIndex !== currentActiveTabIndex) {
        console.warn(`Attempted to edit non-active tab. Active: ${currentActiveTabIndex}, Edit attempted: ${tabIndex}`);
        return currentTabs;
      }

      const updatedTabs = [...currentTabs];
      updatedTabs[tabIndex] = {
        ...updatedTabs[tabIndex],
        note: { ...updatedTabs[tabIndex].note, content },
        isDirty: true
      };
      return updatedTabs;
    });

    // Update selectedNote with the new content
    setSelectedNote(current =>
      current && current.path === notePath
        ? { ...current, content }
        : current
    );

    // Save with explicit path to avoid closure issues
    saveMutation.mutate({ path: notePath, content });
  }, [activeTabIndex, saveMutation]);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim() === '') {
      setSearchResults([]);
      setSearchTerm('');
      return;
    }
    const results = await tauriApi.searchNotes(query);
    setSearchResults(results);
    setSearchTerm(query);
  }, []);

  const handleDailyNote = async () => {
    const path = await tauriApi.getDailyNote();
    const note = await tauriApi.readNote(path);
    openInNewTab(note);
    setCurrentView('notes');
    setSearchTerm('');
  };

  const handleTagSelect = async (tag: string) => {
    const notePaths = await tauriApi.getNotesByTag(tag);
    
    // Filter notes to show only those with the selected tag
    const filteredNotes = notes.filter(note => 
      notePaths.includes(note.path)
    );
    
    setSelectedTag(tag);
    setTagFilteredNotes(filteredNotes);
    setCurrentView('tag-filter');
  };

  const handleBacklinkClick = async (path: string) => {
    const note = await tauriApi.readNote(path);

    // Backlinks: single click replaces current tab
    if (tabs.length === 0) {
      openInNewTab(note);
    } else {
      const updatedTabs = [...tabs];
      updatedTabs[activeTabIndex] = {
        note,
        isDirty: false
      };
      setTabs(updatedTabs);
      setSelectedNote(note);
    }

    setSearchTerm('');
  };

  const handleOutgoingLinkClick = async (linkName: string) => {
    // Delegate to existing note link handling logic
    await handleNoteLinkClick(linkName);
  };

  const handleBacklinkOpenInNewTab = async (path: string) => {
    const note = await tauriApi.readNote(path);
    openInNewTab(note);
    setSearchTerm('');
  };

  const handleOutgoingLinkOpenInNewTab = async (linkName: string) => {
    try {
      // Check if note exists using the new command
      const existingNotePath = await tauriApi.findNoteByName(linkName);

      if (existingNotePath) {
        // Note exists, open in new tab
        const note = await tauriApi.readNote(existingNotePath);
        openInNewTab(note);
      } else {
        // Note doesn't exist, create it and open in new tab
        const newNotePath = await tauriApi.createNote(linkName);
        const note = await tauriApi.readNote(newNotePath);
        openInNewTab(note);
        // Refresh the notes list
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to handle outgoing link in new tab:', error);
    }
  };

  const handleNoteLinkOpenInNewTab = async (linkName: string) => {
    // Delegate to existing outgoing link handler for new tabs
    await handleOutgoingLinkOpenInNewTab(linkName);
  };

  const handleNoteMove = async (note: NoteMetadata, targetFolder: string) => {
    try {
      const newPath = await tauriApi.moveNote(note.path, targetFolder);
      
      // If this is the currently selected note, update its path
      if (selectedNote && selectedNote.path === note.path) {
        setSelectedNote({ ...selectedNote, path: newPath });
      }
      
      // Refresh the notes list
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (error) {
      console.error('Failed to move note:', error);
    }
  };

  const handleNoteLinkClick = async (noteName: string) => {
    try {
      // Check if note exists using the new command
      const existingNotePath = await tauriApi.findNoteByName(noteName);
      
      if (existingNotePath) {
        // Note exists, replace current tab
        const note = await tauriApi.readNote(existingNotePath);
        if (tabs.length === 0) {
          openInNewTab(note);
        } else {
          const updatedTabs = [...tabs];
          updatedTabs[activeTabIndex] = {
            note,
            isDirty: false
          };
          setTabs(updatedTabs);
          setSelectedNote(note);
        }
      } else {
        // Note doesn't exist, create it and open in new tab
        const newNotePath = await tauriApi.createNote(noteName);
        const note = await tauriApi.readNote(newNotePath);
        openInNewTab(note);
        // Refresh the notes list
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to handle note link:', error);
    }
  };

  const handleNoteDelete = async (note: NoteMetadata) => {
    setDeleteDialog({
      isOpen: true,
      type: 'note',
      item: note,
      message: `Are you sure you want to delete "${note.title}"? This action cannot be undone.`
    });
  };

  const handleFolderDelete = async (folderPath: string) => {
    try {
      const contents = await tauriApi.getFolderContents(folderPath);
      const noteCount = contents.length;
      
      setDeleteDialog({
        isOpen: true,
        type: 'folder',
        item: { path: folderPath },
        message: `Are you sure you want to delete this folder? This will permanently delete ${noteCount} note${noteCount !== 1 ? 's' : ''}. This action cannot be undone.`
      });
    } catch (error) {
      console.error('Failed to get folder contents:', error);
    }
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      if (deleteDialog.type === 'note') {
        await tauriApi.deleteNote(deleteDialog.item.path);
        
        // If the deleted note was selected, clear selection
        if (selectedNote && selectedNote.path === deleteDialog.item.path) {
          setSelectedNote(null);
        }
      } else {
        await tauriApi.deleteFolder(deleteDialog.item.path);
        
        // If a note in the deleted folder was selected, clear selection
        if (selectedNote && selectedNote.path.startsWith(deleteDialog.item.path)) {
          setSelectedNote(null);
        }
      }
      
      // Refresh the notes list
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    } catch (error) {
      console.error(`Failed to delete ${deleteDialog.type}:`, error);
    }
  };

  const handleFolderCreate = (parentPath: string) => {
    setCreateFolderDialog({
      isOpen: true,
      parentPath
    });
  };

  const confirmCreateFolder = async (folderName: string) => {
    if (!createFolderDialog) return;

    try {
      // Create the full folder path
      const fullPath = createFolderDialog.parentPath 
        ? `${createFolderDialog.parentPath}/${folderName}`
        : folderName;
      
      await tauriApi.createFolder(fullPath);
      
      // Refresh the notes and folders list to show the new folder
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleNoteCreate = (folderPath: string) => {
    setCreateNoteDialog({
      isOpen: true,
      folderPath
    });
  };

  const confirmCreateNote = async (noteName: string) => {
    if (!createNoteDialog) return;

    try {
      // Create the full note path
      const fullPath = createNoteDialog.folderPath 
        ? `${createNoteDialog.folderPath}/${noteName}`
        : noteName;
      
      const newNotePath = await tauriApi.createNote(fullPath);
      
      // Open the newly created note
      const note = await tauriApi.readNote(newNotePath);
      setSelectedNote(note);
      
      // Refresh the notes list to show the new note
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleNoteRename = (note: NoteMetadata) => {
    setRenameDialog({
      isOpen: true,
      type: 'note',
      oldPath: note.path,
      currentName: note.title
    });
  };

  const handleFolderRename = (folderPath: string, currentName: string) => {
    setRenameDialog({
      isOpen: true,
      type: 'folder',
      oldPath: folderPath,
      currentName: currentName
    });
  };

  const confirmRename = async (newName: string) => {
    if (!renameDialog) return;

    try {
      if (renameDialog.type === 'note') {
        const newPath = await tauriApi.renameNote(renameDialog.oldPath, newName);
        
        // If the renamed note was selected, update its path
        if (selectedNote?.path === renameDialog.oldPath) {
          const updatedNote = await tauriApi.readNote(newPath);
          setSelectedNote(updatedNote);
        }
      } else {
        await tauriApi.renameFolder(renameDialog.oldPath, newName);
      }
      
      // Refresh the lists
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['folders'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['backlinks'] });
    } catch (error) {
      console.error(`Failed to rename ${renameDialog.type}:`, error);
    }
  };

  const handleTodoToggle = async (lineNumber: number) => {
    if (!selectedNote) return;
    
    try {
      const updatedContent = await tauriApi.toggleTodo(selectedNote.path, lineNumber);
      setSelectedNote({ ...selectedNote, content: updatedContent });
      
      // Invalidate todos query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['incompleteTodos'] });
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleTodoToggleFromList = async (todo: Todo) => {
    try {
      const updatedContent = await tauriApi.toggleTodo(todo.note_path, todo.line_number);
      
      // If this is the currently selected note, update its content
      if (selectedNote && selectedNote.path === todo.note_path) {
        setSelectedNote({ ...selectedNote, content: updatedContent });
      }
      
      // Invalidate todos query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['incompleteTodos'] });
    } catch (error) {
      console.error('Failed to toggle todo:', error);
    }
  };

  const handleTodoNoteClick = async (notePath: string) => {
    try {
      const note = await tauriApi.readNote(notePath);
      
      // Todo notes: replace current tab
      if (tabs.length === 0) {
        openInNewTab(note);
      } else {
        const updatedTabs = [...tabs];
        updatedTabs[activeTabIndex] = {
          note,
          isDirty: false
        };
        setTabs(updatedTabs);
        setSelectedNote(note);
      }
      
      setCurrentView('notes');
      setSearchTerm('');
    } catch (error) {
      console.error('Failed to open note:', error);
    }
  };

  const renderListPanel = () => {
    switch (currentView) {
      case 'notes':
        return (
          <NotesTree
            notes={notes}
            folders={folders}
            selectedPath={selectedNote?.path}
            onNoteSelect={handleNoteSelect}
            onNoteDoubleClick={handleNoteDoubleClick}
            onNoteMove={handleNoteMove}
            onNoteDelete={handleNoteDelete}
            onFolderDelete={handleFolderDelete}
            onFolderCreate={handleFolderCreate}
            onNoteCreate={handleNoteCreate}
            onNoteRename={handleNoteRename}
            onFolderRename={handleFolderRename}
          />
        );
      case 'tags':
        return <TagsList tags={tags} onTagSelect={handleTagSelect} />;
      case 'search':
        return (
          <SearchPanel
            onSearch={handleSearch}
            results={searchResults}
            onResultSelect={async (note) => {
              // Search results: single click replaces current tab
              if (tabs.length === 0) {
                openInNewTab(note);
              } else {
                const updatedTabs = [...tabs];
                updatedTabs[activeTabIndex] = {
                  note,
                  isDirty: false
                };
                setTabs(updatedTabs);
                setSelectedNote(note);
              }
            }}
          />
        );
      case 'tag-filter':
        return (
          <div className="tag-filter-panel">
            <div className="tag-filter-header">
              <span className="tag-filter-label">Notes tagged with</span>
              <span className="tag-filter-tag">#{selectedTag}</span>
            </div>
            <div className="tag-filter-notes">
              {tagFilteredNotes.map(note => (
                <div
                  key={note.path}
                  className={`tag-filter-note ${selectedNote?.path === note.path ? 'selected' : ''}`}
                  onClick={() => handleNoteSelect(note)}
                >
                  <FileText size={16} className="note-icon" />
                  <span className="note-title">{note.title}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'todos':
        return (
          <TodosList
            todos={incompleteTodos}
            onTodoToggle={handleTodoToggleFromList}
            onNoteClick={handleTodoNoteClick}
          />
        );
      case 'recent':
        return (
          <RecentNotes
            recentNotes={recentNotes}
            selectedPath={selectedNote?.path}
            onNoteSelect={handleRecentNoteSelect}
            onNoteDoubleClick={handleRecentNoteDoubleClick}
          />
        );
    }
  };

  return (
    <div className="app">
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => {
          if (view === 'graph') {
            setShowGlobalGraph(true);
            setShowLocalGraph(false);
          } else {
            setCurrentView(view);
            setShowGlobalGraph(false);
            setShowLocalGraph(false);
          }
          setShowHelp(false);
        }}
        onDailyNote={handleDailyNote}
        onHelp={() => setShowHelp(true)}
        onSettings={() => setShowSettings(true)}
      />
      
      <PanelGroup direction="horizontal" className="panels-container">
        <Panel defaultSize={20} minSize={15} maxSize={30}>
          <div className="panel list-panel">
            {renderListPanel()}
          </div>
        </Panel>
        
        <PanelResizeHandle className="resize-handle" />
        
        <Panel defaultSize={60}>
          <div className="panel editor-panel">
            <TabBar
              tabs={tabs}
              activeTabIndex={activeTabIndex}
              onTabClick={switchTab}
              onTabClose={closeTab}
            />
            <div className="editor-toolbar">
              <h2>{showGlobalGraph ? 'Knowledge Graph' : (selectedNote?.title || 'No note selected')}</h2>
              <div className="toolbar-buttons">
                <button
                  className={`toolbar-button ${!isPreview && !showLocalGraph && !showGlobalGraph ? 'active' : ''}`}
                  onClick={() => {
                    setIsPreview(false);
                    setShowLocalGraph(false);
                    setShowGlobalGraph(false);
                  }}
                  title="Edit"
                  disabled={!selectedNote}
                >
                  <Edit size={16} />
                </button>
                <button
                  className={`toolbar-button ${isPreview && !showLocalGraph && !showGlobalGraph ? 'active' : ''}`}
                  onClick={() => {
                    setIsPreview(true);
                    setShowLocalGraph(false);
                    setShowGlobalGraph(false);
                  }}
                  title="Preview"
                  disabled={!selectedNote}
                >
                  <Eye size={16} />
                </button>
                <button
                  className={`toolbar-button ${showLocalGraph ? 'active' : ''}`}
                  onClick={() => {
                    setShowLocalGraph(true);
                    setShowGlobalGraph(false);
                  }}
                  title="Local Graph"
                  disabled={!selectedNote}
                >
                  <Network size={16} />
                </button>
              </div>
            </div>
            {showGlobalGraph ? (
              <GraphView
                data={globalGraphData}
                onNodeClick={async (nodeId) => {
                  const note = await tauriApi.readNote(nodeId);
                  // Graph nodes: replace current tab
                  if (tabs.length === 0) {
                    openInNewTab(note);
                  } else {
                    const updatedTabs = [...tabs];
                    updatedTabs[activeTabIndex] = {
                      note,
                      isDirty: false
                    };
                    setTabs(updatedTabs);
                    setSelectedNote(note);
                  }
                  setShowGlobalGraph(false);
                }}
                isLocal={false}
              />
            ) : showLocalGraph && selectedNote ? (
              <GraphView
                data={localGraphData}
                onNodeClick={async (nodeId) => {
                  const note = await tauriApi.readNote(nodeId);
                  // Graph nodes: replace current tab
                  if (tabs.length === 0) {
                    openInNewTab(note);
                  } else {
                    const updatedTabs = [...tabs];
                    updatedTabs[activeTabIndex] = {
                      note,
                      isDirty: false
                    };
                    setTabs(updatedTabs);
                    setSelectedNote(note);
                  }
                  setShowLocalGraph(false);
                }}
                isLocal={true}
              />
            ) : (
              <NoteEditor
                note={selectedNote}
                isPreview={isPreview}
                onChange={(content) => selectedNote && handleNoteChange(selectedNote.path, content)}
                onLinkClick={handleNoteLinkClick}
                onLinkOpenInNewTab={handleNoteLinkOpenInNewTab}
                onTagClick={handleTagSelect}
                onTodoToggle={handleTodoToggle}
                notes={notes}
                tags={tags}
                searchTerm={searchTerm}
              />
            )}
          </div>
        </Panel>
        
        <PanelResizeHandle className="resize-handle" />
        
        <Panel defaultSize={20} minSize={15} maxSize={30}>
          <div className="panel info-panel">
            <BacklinksPanel
              backlinks={backlinks}
              outgoingLinks={outgoingLinks}
              onBacklinkClick={handleBacklinkClick}
              onBacklinkOpenInNewTab={handleBacklinkOpenInNewTab}
              onOutgoingLinkClick={handleOutgoingLinkClick}
              onOutgoingLinkOpenInNewTab={handleOutgoingLinkOpenInNewTab}
            />
          </div>
        </Panel>
      </PanelGroup>
      
      {deleteDialog && (
        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          onClose={() => setDeleteDialog(null)}
          onConfirm={confirmDelete}
          title={`Delete ${deleteDialog.type === 'note' ? 'Note' : 'Folder'}`}
          message={deleteDialog.message}
          confirmText="Delete"
          cancelText="Cancel"
        />
      )}
      
      {createFolderDialog && (
        <InputDialog
          isOpen={createFolderDialog.isOpen}
          onClose={() => setCreateFolderDialog(null)}
          onConfirm={confirmCreateFolder}
          title="Create New Folder"
          label="Folder name:"
          placeholder="Enter folder name"
          confirmText="Create"
          cancelText="Cancel"
        />
      )}
      
      {createNoteDialog && (
        <InputDialog
          isOpen={createNoteDialog.isOpen}
          onClose={() => setCreateNoteDialog(null)}
          onConfirm={confirmCreateNote}
          title="Create New Note"
          label="Note name:"
          placeholder="Enter note name (without .md extension)"
          confirmText="Create"
          cancelText="Cancel"
        />
      )}
      
      {renameDialog && (
        <InputDialog
          isOpen={renameDialog.isOpen}
          onClose={() => setRenameDialog(null)}
          onConfirm={confirmRename}
          title={`Rename ${renameDialog.type === 'note' ? 'Note' : 'Folder'}`}
          label="New name:"
          placeholder={`Enter new ${renameDialog.type} name`}
          initialValue={renameDialog.currentName}
          confirmText="Rename"
          cancelText="Cancel"
        />
      )}
      
      <TemplateSettings
        isOpen={showTemplateSettings}
        onClose={() => setShowTemplateSettings(false)}
      />

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <Help
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;