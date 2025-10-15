import { invoke } from '@tauri-apps/api/core';
import { Note, NoteMetadata, GitBlameInfo, RecentNote, SearchResult, Bookmark } from '../types';

export const tauriApi = {
  async getNotesList(): Promise<NoteMetadata[]> {
    return invoke('get_notes_list');
  },

  async readNote(path: string): Promise<Note> {
    return invoke('read_note', { path });
  },

  async saveNote(path: string, content: string): Promise<void> {
    return invoke('save_note', { path, content });
  },

  async createNote(filename: string): Promise<string> {
    return invoke('create_note', { filename });
  },

  async deleteNote(path: string): Promise<void> {
    return invoke('delete_note', { path });
  },

  async searchNotes(query: string): Promise<Note[]> {
    console.log('[FRONTEND] Searching for:', query);
    try {
      const results = await invoke('search_notes', { query });
      console.log('[FRONTEND] Search returned', results);
      return results as Note[];
    } catch (error) {
      console.error('[FRONTEND] Search error:', error);
      throw error;
    }
  },

  async searchNotesEnhanced(query: string): Promise<SearchResult[]> {
    console.log('[FRONTEND] Enhanced search for:', query);
    try {
      const results = await invoke('search_notes_enhanced', { query });
      console.log('[FRONTEND] Enhanced search returned', results);
      return results as SearchResult[];
    } catch (error) {
      console.error('[FRONTEND] Enhanced search error:', error);
      throw error;
    }
  },

  async getDailyNote(): Promise<string> {
    return invoke('get_daily_note');
  },

  async getBacklinks(notePath: string): Promise<string[]> {
    return invoke('get_backlinks', { notePath });
  },

  async getOutgoingLinks(notePath: string): Promise<string[]> {
    return invoke('get_outgoing_links', { notePath });
  },

  async getAllTags(): Promise<string[]> {
    return invoke('get_all_tags');
  },

  async getNotesByTag(tag: string): Promise<string[]> {
    return invoke('get_notes_by_tag', { tag });
  },

  async setNotesDirectory(path: string): Promise<void> {
    return invoke('set_notes_directory', { path });
  },

  async findNoteByName(name: string): Promise<string | null> {
    return invoke('find_note_by_name', { name });
  },

  async moveNote(oldPath: string, newFolder: string): Promise<string> {
    return invoke('move_note', { oldPath, newFolder });
  },

  async getFolderContents(folderPath: string): Promise<string[]> {
    return invoke('get_folder_contents', { folderPath });
  },

  async deleteFolder(folderPath: string): Promise<void> {
    return invoke('delete_folder', { folderPath });
  },

  async createFolder(folderPath: string): Promise<void> {
    return invoke('create_folder', { folderPath });
  },

  async getAllFolders(): Promise<string[]> {
    return invoke('get_all_folders');
  },

  async getGlobalGraph(): Promise<GraphData> {
    return invoke('get_global_graph');
  },

  async getLocalGraph(notePath: string): Promise<GraphData> {
    return invoke('get_local_graph', { notePath });
  },

  async saveImage(imageData: Uint8Array, filename: string, notePath: string): Promise<string> {
    return invoke('save_image', {
      imageData: Array.from(imageData),
      filename,
      notePath
    });
  },

  async saveAttachment(fileData: Uint8Array, filename: string, notePath: string): Promise<string> {
    return invoke('save_attachment', {
      fileData: Array.from(fileData),
      filename,
      notePath
    });
  },

  async openFileExternal(filePath: string, notePath: string): Promise<void> {
    return invoke('open_file_external', { filePath, notePath });
  },

  async getIncompleteTodos(): Promise<Todo[]> {
    return invoke('get_incomplete_todos');
  },

  async getAllTodos(): Promise<Todo[]> {
    return invoke('get_all_todos');
  },

  async toggleTodo(notePath: string, lineNumber: number): Promise<string> {
    return invoke('toggle_todo', { notePath, lineNumber });
  },

  async getDailyNoteTemplate(): Promise<string> {
    return invoke('get_daily_note_template');
  },

  async saveDailyNoteTemplate(template: string): Promise<void> {
    return invoke('save_daily_note_template', { template });
  },

  async renameNote(oldPath: string, newName: string): Promise<string> {
    return invoke('rename_note', { oldPath, newName });
  },

  async renameFolder(oldPath: string, newName: string): Promise<string> {
    return invoke('rename_folder', { oldPath, newName });
  },

  async initGitRepo(): Promise<void> {
    return invoke('init_git_repo');
  },

  async isGitRepo(): Promise<boolean> {
    return invoke('is_git_repo');
  },

  async getGitBlame(filePath: string): Promise<GitBlameInfo[]> {
    return invoke('get_git_blame', { filePath });
  },

  async gitCommit(message?: string): Promise<void> {
    return invoke('git_commit', { message });
  },

  async getBlockReference(notePath: string, blockId: string): Promise<[number, string] | null> {
    return invoke('get_block_reference', { notePath, blockId });
  },

  async getBlocksForNote(notePath: string): Promise<Array<[string, number, string]>> {
    return invoke('get_blocks_for_note', { notePath });
  },

  async getAppSettings(): Promise<AppSettings> {
    return invoke('get_app_settings');
  },

  async saveAppSettings(settings: AppSettings): Promise<void> {
    return invoke('save_app_settings', { settings });
  },

  async getRecentNotes(): Promise<RecentNote[]> {
    return invoke('get_recent_notes');
  },

  async saveWindowState(): Promise<void> {
    return invoke('save_window_state');
  },

  async applyWindowState(): Promise<void> {
    return invoke('apply_window_state');
  },

  async resolveTransclusion(link: string): Promise<string> {
    return invoke('resolve_transclusion', { link });
  },

  async getAllBookmarks(): Promise<Bookmark[]> {
    return invoke('get_all_bookmarks');
  },

  async searchBookmarks(query: string): Promise<Bookmark[]> {
    return invoke('search_bookmarks', { query });
  },

  async getBookmarksByDomain(domain: string): Promise<Bookmark[]> {
    return invoke('get_bookmarks_by_domain', { domain });
  },

  async addBookmarkManual(url: string, title?: string, description?: string, tags?: string): Promise<void> {
    return invoke('add_bookmark_manual', { url, title, description, tags });
  },

  async updateBookmark(id: number, title?: string, description?: string, tags?: string): Promise<void> {
    return invoke('update_bookmark', { id, title, description, tags });
  },

  async deleteBookmark(id: number): Promise<void> {
    return invoke('delete_bookmark', { id });
  },

  async getAllBookmarkDomains(): Promise<string[]> {
    return invoke('get_all_bookmark_domains');
  },

  async openUrlExternal(url: string): Promise<void> {
    return invoke('open_url_external', { url });
  },
};

export interface GraphNode {
  id: string;
  label: string;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Todo {
  id: number;
  note_path: string;
  line_number: number;
  content: string;
  is_completed: boolean;
  due_date?: string | null;           // ISO 8601 date string (YYYY-MM-DD)
  priority?: string | null;           // "high", "medium", "low"
  indent_level: number;               // Indentation level (0 = root, 1+ = nested)
  parent_line?: number | null;        // Line number of parent todo (if nested)
  recurrence_pattern?: string | null; // Recurrence pattern (e.g., "daily", "weekly", "monday")
}

export interface CustomTheme {
  bg_primary: string;
  bg_secondary: string;
  text_primary: string;
  text_secondary: string;
  border_color: string;
  accent_color: string;
  hover_color: string;
  active_color: string;
}

export interface AppSettings {
  theme: string;
  font_size: number;
  custom_theme?: CustomTheme;
  show_git_blame: boolean;
  window_width?: number;
  window_height?: number;
  window_x?: number;
  window_y?: number;
  window_maximized?: boolean;
}