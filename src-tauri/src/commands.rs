use crate::note_manager::{self, Note, NoteMetadata};
use crate::cache::CacheDb;
use std::sync::Mutex;
use tauri::State;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

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
    cache_db.update_note_cache(&path, &content, &state.notes_dir)?;
    
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
    
    let content = format!("# {}\n\n", filename);
    note_manager::write_note(&path_str, &content)?;
    
    // Update cache for the new note
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.update_note_cache(&path_str, &content, &state.notes_dir)?;
    
    // Also need to check if any existing notes link to this new note
    // and update their cache entries
    drop(cache_db);
    rebuild_cache_for_new_note(&filename, &state)?;
    
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
    cache_db.update_note_cache(&new_path, &content, &state.notes_dir)?;
    
    Ok(new_path)
}

#[tauri::command]
pub async fn get_folder_contents(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    note_manager::delete_folder(&folder_path, &state.notes_dir)
}

#[tauri::command]
pub async fn delete_folder(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Delete the folder
    note_manager::delete_folder_confirmed(&folder_path, &state.notes_dir)?;
    
    // Clear cache for all deleted notes
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    // We should clear cache for all notes in the deleted folder
    // For simplicity, we'll rebuild the entire cache
    drop(cache_db);
    
    // Rebuild cache
    let notes = note_manager::list_notes(&state.notes_dir)?;
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    for note in notes {
        if let Ok(content) = std::fs::read_to_string(&note.path) {
            let _ = cache_db.update_note_cache(&note.path, &content, &state.notes_dir);
        }
    }
    
    Ok(())
}

#[tauri::command]
pub async fn create_folder(
    folder_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    note_manager::create_folder(&folder_path, &state.notes_dir)
}

#[tauri::command]
pub async fn get_all_folders(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    note_manager::get_all_folders(&state.notes_dir)
}

fn rebuild_cache_for_new_note(note_name: &str, state: &AppState) -> Result<(), String> {
    // Get all notes
    let notes = note_manager::list_notes(&state.notes_dir)?;
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    // Check each note to see if it contains a link to the new note
    for note in notes {
        if let Ok(content) = std::fs::read_to_string(&note.path) {
            // Check if this note contains a link to the new note
            let note_name_without_ext = note_name.trim_end_matches(".md");
            if content.contains(&format!("[[{}]]", note_name_without_ext)) || 
               content.contains(&format!("[[{}.md]]", note_name_without_ext)) {
                // Re-update the cache for this note to include the new link
                let _ = cache_db.update_note_cache(&note.path, &content, &state.notes_dir);
            }
        }
    }
    
    Ok(())
}

#[derive(Serialize, Deserialize)]
pub struct GraphNode {
    id: String,
    label: String,
    title: String,
}

#[derive(Serialize, Deserialize)]
pub struct GraphEdge {
    from: String,
    to: String,
}

#[derive(Serialize, Deserialize)]
pub struct GraphData {
    nodes: Vec<GraphNode>,
    edges: Vec<GraphEdge>,
}

#[tauri::command]
pub async fn get_global_graph(state: State<'_, AppState>) -> Result<GraphData, String> {
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    let links = cache_db.get_all_links()?;
    let notes = note_manager::list_notes(&state.notes_dir)?;
    
    // Create a set of all note paths that have links
    let mut linked_notes = HashSet::new();
    for link in &links {
        linked_notes.insert(link.from_note.clone());
        linked_notes.insert(link.to_note.clone());
    }
    
    // Create nodes only for notes that have links
    let mut nodes = Vec::new();
    let mut node_map = HashMap::new();
    
    for note in notes {
        if linked_notes.contains(&note.path) {
            let node_id = note.path.clone();
            node_map.insert(node_id.clone(), note.title.clone());
            nodes.push(GraphNode {
                id: node_id,
                label: note.title.clone(),
                title: note.title,
            });
        }
    }
    
    // Create edges
    let mut edges = Vec::new();
    for link in links {
        edges.push(GraphEdge {
            from: link.from_note,
            to: link.to_note,
        });
    }
    
    Ok(GraphData { nodes, edges })
}

#[tauri::command]
pub async fn get_local_graph(note_path: String, state: State<'_, AppState>) -> Result<GraphData, String> {
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    let links = cache_db.get_links_for_note(&note_path)?;
    let notes = note_manager::list_notes(&state.notes_dir)?;
    
    // Create a map for quick lookup
    let note_map: HashMap<String, String> = notes
        .into_iter()
        .map(|note| (note.path, note.title))
        .collect();
    
    // Collect all connected notes
    let mut connected_notes = HashSet::new();
    connected_notes.insert(note_path.clone());
    
    for link in &links {
        connected_notes.insert(link.from_note.clone());
        connected_notes.insert(link.to_note.clone());
    }
    
    // Create nodes
    let mut nodes = Vec::new();
    for path in &connected_notes {
        if let Some(title) = note_map.get(path) {
            nodes.push(GraphNode {
                id: path.clone(),
                label: title.clone(),
                title: title.clone(),
            });
        }
    }
    
    // Create edges
    let mut edges = Vec::new();
    for link in links {
        edges.push(GraphEdge {
            from: link.from_note,
            to: link.to_note,
        });
    }
    
    Ok(GraphData { nodes, edges })
}
#[tauri::command]
pub async fn save_image(
    image_data: Vec<u8>,
    filename: String,
    note_path: String,
    _state: State<'_, AppState>,
) -> Result<String, String> {
    // Get the directory of the current note
    let note_path_buf = std::path::Path::new(&note_path);
    let note_dir = note_path_buf.parent()
        .ok_or("Failed to get note directory")?;
    
    // Create images subdirectory if it doesn't exist
    let images_dir = note_dir.join("images");
    if !images_dir.exists() {
        std::fs::create_dir_all(&images_dir)
            .map_err(|e| format!("Failed to create images directory: {}", e))?;
    }
    
    // Generate unique filename if file already exists
    let mut final_filename = filename.clone();
    let mut counter = 1;
    while images_dir.join(&final_filename).exists() {
        let name_parts: Vec<&str> = filename.rsplitn(2, '.').collect();
        if name_parts.len() == 2 {
            final_filename = format!("{}-{}.{}", name_parts[1], counter, name_parts[0]);
        } else {
            final_filename = format!("{}-{}", filename, counter);
        }
        counter += 1;
    }
    
    // Save the image
    let image_path = images_dir.join(&final_filename);
    std::fs::write(&image_path, image_data)
        .map_err(|e| format!("Failed to save image: {}", e))?;
    
    // Return relative path from note location
    Ok(format!("images/{}", final_filename))
}
