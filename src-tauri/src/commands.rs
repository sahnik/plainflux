use crate::note_manager::{self, Note, NoteMetadata};
use crate::cache::CacheDb;
use std::sync::Mutex;
use tauri::State;

pub struct AppState {
    pub cache_db: Mutex<CacheDb>,
    pub notes_dir: String,
}

#[tauri::command]
pub async fn get_notes_list(state: State<'_, AppState>) -> Result<Vec<NoteMetadata>, String> {
    note_manager::list_notes(&state.notes_dir)
}

#[tauri::command]
pub async fn read_note(path: String) -> Result<Note, String> {
    note_manager::read_note(&path)
}

#[tauri::command]
pub async fn save_note(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    note_manager::write_note(&path, &content)?;
    
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.update_note_cache(&path, &content)?;
    
    Ok(())
}

#[tauri::command]
pub async fn create_note(
    filename: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let path = std::path::Path::new(&state.notes_dir)
        .join(&filename)
        .with_extension("md");
    
    let path_str = path.to_string_lossy().to_string();
    
    if path.exists() {
        // Return the existing path instead of an error
        return Ok(path_str);
    }
    
    note_manager::write_note(&path_str, &format!("# {}\n\n", filename))?;
    Ok(path_str)
}

#[tauri::command]
pub async fn delete_note(path: String, state: State<'_, AppState>) -> Result<(), String> {
    std::fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete note: {}", e))?;
    
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.clear_note_cache(&path)?;
    
    Ok(())
}

#[tauri::command]
pub async fn search_notes(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<Note>, String> {
    note_manager::search_notes(&state.notes_dir, &query)
}

#[tauri::command]
pub async fn get_daily_note(state: State<'_, AppState>) -> Result<String, String> {
    note_manager::create_daily_note(&state.notes_dir)
}

#[tauri::command]
pub async fn get_backlinks(
    note_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_backlinks(&note_path)
}

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_all_tags()
}

#[tauri::command]
pub async fn get_notes_by_tag(
    tag: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_notes_by_tag(&tag)
}

#[tauri::command]
pub async fn set_notes_directory(
    path: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    if !std::path::Path::new(&path).exists() {
        return Err("Directory does not exist".to_string());
    }
    
    // This would need proper state management in a real app
    // For now, we'll just validate the path
    
    Ok(())
}

#[tauri::command]
pub async fn find_note_by_name(
    name: String,
    state: State<'_, AppState>,
) -> Result<Option<String>, String> {
    let notes = note_manager::list_notes(&state.notes_dir)?;
    
    // Try exact match first
    if let Some(note) = notes.iter().find(|n| n.title.eq_ignore_ascii_case(&name)) {
        return Ok(Some(note.path.clone()));
    }
    
    // Try without .md extension
    let name_without_ext = name.trim_end_matches(".md");
    if let Some(note) = notes.iter().find(|n| n.title.eq_ignore_ascii_case(name_without_ext)) {
        return Ok(Some(note.path.clone()));
    }
    
    Ok(None)
}

#[tauri::command]
pub async fn move_note(
    old_path: String,
    new_folder: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // First, get the note content to preserve cache
    let content = std::fs::read_to_string(&old_path)
        .map_err(|e| format!("Failed to read note: {}", e))?;
    
    // Move the note
    let new_path = note_manager::move_note(&old_path, &new_folder, &state.notes_dir)?;
    
    // Update cache for the new location
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    // Clear old cache
    cache_db.clear_note_cache(&old_path)?;
    
    // Update cache with new path
    cache_db.update_note_cache(&new_path, &content)?;
    
    Ok(new_path)
}