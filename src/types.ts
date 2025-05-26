export interface Note {
  path: string;
  title: string;
  content: string;
  last_modified: number;
}

export interface NoteMetadata {
  path: string;
  title: string;
  last_modified: number;
  relative_path: string;
  folder: string;
}

export type ViewType = 'notes' | 'tags' | 'search' | 'tag-filter' | 'graph' | 'todos';

export interface AppState {
  currentView: ViewType;
  selectedNote: Note | null;
  openTabs: Note[];
  activeTabIndex: number;
}