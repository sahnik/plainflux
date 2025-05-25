import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Eye, Edit } from 'lucide-react';
import './App.css';

import { Sidebar } from './components/Sidebar';
import { NotesList } from './components/NotesList';
import { TagsList } from './components/TagsList';
import { SearchPanel } from './components/SearchPanel';
import { NoteEditor } from './components/NoteEditor';
import { BacklinksPanel } from './components/BacklinksPanel';

import { tauriApi } from './api/tauri';
import { ViewType, Note, NoteMetadata } from './types';

const queryClient = new QueryClient();

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewType>('notes');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [searchResults, setSearchResults] = useState<Note[]>([]);

  const { data: notes = [] } = useQuery({
    queryKey: ['notes'],
    queryFn: tauriApi.getNotesList,
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

  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      tauriApi.saveNote(path, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

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
    if (notePaths.length > 0) {
      const note = await tauriApi.readNote(notePaths[0]);
      setSelectedNote(note);
    }
  };

  const handleBacklinkClick = async (path: string) => {
    const note = await tauriApi.readNote(path);
    setSelectedNote(note);
  };

  const renderListPanel = () => {
    switch (currentView) {
      case 'notes':
        return (
          <NotesList
            notes={notes}
            selectedPath={selectedNote?.path}
            onNoteSelect={handleNoteSelect}
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
    }
  };

  return (
    <div className="app">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onDailyNote={handleDailyNote}
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
              <h2>{selectedNote?.title || 'No note selected'}</h2>
              <button
                className={`toolbar-button ${!isPreview ? 'active' : ''}`}
                onClick={() => setIsPreview(false)}
                title="Edit"
              >
                <Edit size={16} />
              </button>
              <button
                className={`toolbar-button ${isPreview ? 'active' : ''}`}
                onClick={() => setIsPreview(true)}
                title="Preview"
              >
                <Eye size={16} />
              </button>
            </div>
            <NoteEditor
              note={selectedNote}
              isPreview={isPreview}
              onChange={handleNoteChange}
            />
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