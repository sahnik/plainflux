import { invoke } from '@tauri-apps/api/core';
import { Note, NoteMetadata } from '../types';

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
    return invoke('search_notes', { query });
  },

  async getDailyNote(): Promise<string> {
    return invoke('get_daily_note');
  },

  async getBacklinks(notePath: string): Promise<string[]> {
    return invoke('get_backlinks', { notePath });
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

  async getIncompleteTodos(): Promise<Todo[]> {
    return invoke('get_incomplete_todos');
  },

  async toggleTodo(notePath: string, lineNumber: number): Promise<string> {
    return invoke('toggle_todo', { notePath, lineNumber });
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
}