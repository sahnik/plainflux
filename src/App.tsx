import { useState, useEffect } from 'react';
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

import { tauriApi, Todo } from './api/tauri';
import { ViewType, Note, NoteMetadata } from './types';

const queryClient = new QueryClient();

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('notes');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [showLocalGraph, setShowLocalGraph] = useState(false);
  const [showGlobalGraph, setShowGlobalGraph] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [tagFilteredNotes, setTagFilteredNotes] = useState<NoteMetadata[]>([]);
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

  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      tauriApi.saveNote(path, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['incompleteTodos'] });
    },
  });

  // Open daily note on startup
  useEffect(() => {
    handleDailyNote();
  }, []); // Empty dependency array means this runs once on mount

  const handleNoteSelect = async (noteMetadata: NoteMetadata) => {
    const note = await tauriApi.readNote(noteMetadata.path);
    setSelectedNote(note);
  };

  const handleNoteChange = (content: string) => {
    if (!selectedNote) return;
    
    const updatedNote = { ...selectedNote, content };
    setSelectedNote(updatedNote);
    
    saveMutation.mutate({ path: selectedNote.path, content });
  };

  const handleSearch = async (query: string) => {
    const results = await tauriApi.searchNotes(query);
    setSearchResults(results);
  };

  const handleDailyNote = async () => {
    const path = await tauriApi.getDailyNote();
    const note = await tauriApi.readNote(path);
    setSelectedNote(note);
    setCurrentView('notes');
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
    setSelectedNote(note);
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
        // Note exists, open it
        const note = await tauriApi.readNote(existingNotePath);
        setSelectedNote(note);
      } else {
        // Note doesn't exist, create it
        const newNotePath = await tauriApi.createNote(noteName);
        const note = await tauriApi.readNote(newNotePath);
        setSelectedNote(note);
        // Refresh the notes list
        queryClient.invalidateQueries({ queryKey: ['notes'] });
      }
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
      setSelectedNote(note);
      setCurrentView('notes');
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
            onNoteMove={handleNoteMove}
            onNoteDelete={handleNoteDelete}
            onFolderDelete={handleFolderDelete}
            onFolderCreate={handleFolderCreate}
            onNoteCreate={handleNoteCreate}
          />
        );
      case 'tags':
        return <TagsList tags={tags} onTagSelect={handleTagSelect} />;
      case 'search':
        return (
          <SearchPanel
            onSearch={handleSearch}
            results={searchResults}
            onResultSelect={setSelectedNote}
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
        onHelp={() => {
          setShowHelp(!showHelp);
          setShowLocalGraph(false);
          setShowGlobalGraph(false);
        }}
        showHelp={showHelp}
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
            <div className="editor-toolbar">
              <h2>{showHelp ? 'Help' : showGlobalGraph ? 'Knowledge Graph' : (selectedNote?.title || 'No note selected')}</h2>
              <div className="toolbar-buttons">
                <button
                  className={`toolbar-button ${!isPreview && !showLocalGraph && !showGlobalGraph && !showHelp ? 'active' : ''}`}
                  onClick={() => {
                    setIsPreview(false);
                    setShowLocalGraph(false);
                    setShowGlobalGraph(false);
                    setShowHelp(false);
                  }}
                  title="Edit"
                  disabled={!selectedNote || showHelp}
                >
                  <Edit size={16} />
                </button>
                <button
                  className={`toolbar-button ${isPreview && !showLocalGraph && !showGlobalGraph && !showHelp ? 'active' : ''}`}
                  onClick={() => {
                    setIsPreview(true);
                    setShowLocalGraph(false);
                    setShowGlobalGraph(false);
                    setShowHelp(false);
                  }}
                  title="Preview"
                  disabled={!selectedNote || showHelp}
                >
                  <Eye size={16} />
                </button>
                <button
                  className={`toolbar-button ${showLocalGraph ? 'active' : ''}`}
                  onClick={() => {
                    setShowLocalGraph(true);
                    setShowGlobalGraph(false);
                    setShowHelp(false);
                  }}
                  title="Local Graph"
                  disabled={!selectedNote || showHelp}
                >
                  <Network size={16} />
                </button>
              </div>
            </div>
            {showHelp ? (
              <Help />
            ) : showGlobalGraph ? (
              <GraphView
                data={globalGraphData}
                onNodeClick={async (nodeId) => {
                  const note = await tauriApi.readNote(nodeId);
                  setSelectedNote(note);
                  setShowGlobalGraph(false);
                }}
                isLocal={false}
              />
            ) : showLocalGraph && selectedNote ? (
              <GraphView
                data={localGraphData}
                onNodeClick={async (nodeId) => {
                  const note = await tauriApi.readNote(nodeId);
                  setSelectedNote(note);
                  setShowLocalGraph(false);
                }}
                isLocal={true}
              />
            ) : (
              <NoteEditor
                note={selectedNote}
                isPreview={isPreview}
                onChange={handleNoteChange}
                onLinkClick={handleNoteLinkClick}
                onTagClick={handleTagSelect}
                onTodoToggle={handleTodoToggle}
                notes={notes}
                tags={tags}
              />
            )}
          </div>
        </Panel>
        
        <PanelResizeHandle className="resize-handle" />
        
        <Panel defaultSize={20} minSize={15} maxSize={30}>
          <div className="panel info-panel">
            <BacklinksPanel
              backlinks={backlinks}
              onBacklinkClick={handleBacklinkClick}
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
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;