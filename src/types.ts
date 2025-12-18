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

export type ViewType = 'notes' | 'tags' | 'search' | 'tag-filter' | 'graph' | 'todos' | 'recent' | 'bookmarks';

export interface Tab {
  note: Note;
  isDirty: boolean;
  scrollPosition?: number;
}

export interface AppState {
  currentView: ViewType;
  selectedNote: Note | null;
  openTabs: Note[];
  activeTabIndex: number;
}

export interface GitBlameInfo {
  line_number: number;
  commit_hash: string;
  author: string;
  timestamp: number;
  summary: string;
}

export interface RecentNote {
  path: string;
  title: string;
  last_modified: number;
  folder: string;
}

export type RecentNotesFilter = 'Today' | 'Week' | 'Month' | 'All';

export interface SearchSnippet {
  line_number: number;
  text: string;
  match_start: number;
  match_length: number;
}

export interface SearchResult {
  note: Note;
  match_count: number;
  snippets: SearchSnippet[];
}

export interface Bookmark {
  id: number;
  url: string;
  title: string | null;
  description: string | null;
  note_path: string | null;
  line_number: number | null;
  domain: string;
  subdomain: string | null;
  path: string | null;
  created_at: string;
  tags: string | null;
}