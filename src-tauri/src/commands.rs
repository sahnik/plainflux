use crate::cache::{CacheDb, Todo};
use crate::error::AppError;
use crate::git_manager::{GitBlameInfo, GitManager};
use crate::lock_mutex;
use crate::note_manager::{self, read_file_with_encoding, Note, NoteMetadata};
use crate::utils::{ensure_dir_exists, safe_read_file, safe_write_file, validate_path_security};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomTheme {
    pub bg_primary: String,
    pub bg_secondary: String,
    pub text_primary: String,
    pub text_secondary: String,
    pub border_color: String,
    pub accent_color: String,
    pub hover_color: String,
    pub active_color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub theme: String, // "dark", "light", "custom"
    pub font_size: u8, // 12-24
    pub custom_theme: Option<CustomTheme>,
}

#[derive(Debug, Serialize, Clone)]
pub struct RecentNote {
    pub path: String,
    pub title: String,
    pub last_modified: u64,
    pub folder: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
            font_size: 14,
            custom_theme: None,
        }
    }
}

pub struct AppState {
    pub cache_db: Mutex<CacheDb>,
    pub git_manager: Mutex<GitManager>,
    pub notes_dir: String,
    pub recent_notes: Mutex<VecDeque<RecentNote>>,
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

    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during save_note"
    );
    cache_db.update_note_cache(&path, &content, &state.notes_dir)?;

    // Add to recent notes
    let note = note_manager::read_note(&path)?;
    let folder = std::path::Path::new(&path)
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    add_recent_note(&state, &path, &note.title, &folder)?;

    // Trigger auto-commit if git repo exists
    let git_manager = lock_mutex!(
        state.git_manager,
        "Git manager mutex was poisoned during save_note"
    );
    if git_manager.is_git_repo() {
        git_manager.schedule_auto_commit();
    }

    Ok(())
}

#[tauri::command]
pub async fn create_note(filename: String, state: State<'_, AppState>) -> Result<String, String> {
    let path = std::path::Path::new(&state.notes_dir)
        .join(&filename)
        .with_extension("md");

    let path_str = path.to_string_lossy().to_string();

    if path.exists() {
        // Return the existing path instead of an error
        return Ok(path_str);
    }

    let content = format!("# {filename}\n\n");
    note_manager::write_note(&path_str, &content)?;

    // Update cache for the new note
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during create_note"
    );
    cache_db.update_note_cache(&path_str, &content, &state.notes_dir)?;

    // Also need to check if any existing notes link to this new note
    // and update their cache entries
    drop(cache_db);
    rebuild_cache_for_new_note(&filename, &state)?;

    Ok(path_str)
}

#[tauri::command]
pub async fn delete_note(path: String, state: State<'_, AppState>) -> Result<(), String> {
    std::fs::remove_file(&path).map_err(|e| format!("Failed to delete note: {e}"))?;

    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during delete_note"
    );
    cache_db.clear_note_cache(&path)?;

    Ok(())
}

#[tauri::command]
pub async fn search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    println!("[COMMAND] search_notes called with query: '{query}'");
    let notes_dir = &state.notes_dir;
    println!("[COMMAND] Notes directory: {notes_dir}");
    let result = note_manager::search_notes(&state.notes_dir, &query);
    match &result {
        Ok(notes) => {
            let count = notes.len();
            println!("[COMMAND] Search returned {count} results");
        }
        Err(e) => println!("[COMMAND] Search error: {e}"),
    }
    result
}

#[tauri::command]
pub async fn get_daily_note(state: State<'_, AppState>) -> Result<String, String> {
    // Get the template
    let template = get_daily_note_template(state.clone()).await?;
    note_manager::create_daily_note(&state.notes_dir, Some(&template))
}

#[tauri::command]
pub async fn get_backlinks(
    note_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_backlinks(&note_path)
}

#[tauri::command]
pub async fn get_all_tags(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_all_tags()
}

#[tauri::command]
pub async fn get_notes_by_tag(
    tag: String,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;
    cache_db.get_notes_by_tag(&tag)
}

#[tauri::command]
pub async fn set_notes_directory(path: String, _state: State<'_, AppState>) -> Result<(), String> {
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
    if let Some(note) = notes
        .iter()
        .find(|n| n.title.eq_ignore_ascii_case(name_without_ext))
    {
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
    let content =
        read_file_with_encoding(&old_path).map_err(|e| format!("Failed to read note: {e}"))?;

    // Move the note
    let new_path = note_manager::move_note(&old_path, &new_folder, &state.notes_dir)?;

    // Update cache for the new location
    let cache_db = state
        .cache_db
        .lock()
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
pub async fn delete_folder(folder_path: String, state: State<'_, AppState>) -> Result<(), String> {
    // Delete the folder
    note_manager::delete_folder_confirmed(&folder_path, &state.notes_dir)?;

    // Clear cache for all deleted notes
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    // We should clear cache for all notes in the deleted folder
    // For simplicity, we'll rebuild the entire cache
    drop(cache_db);

    // Rebuild cache
    let notes = note_manager::list_notes(&state.notes_dir)?;
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    for note in notes {
        if let Ok(content) = read_file_with_encoding(&note.path) {
            let _ = cache_db.update_note_cache(&note.path, &content, &state.notes_dir);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn create_folder(folder_path: String, state: State<'_, AppState>) -> Result<(), String> {
    note_manager::create_folder(&folder_path, &state.notes_dir)
}

#[tauri::command]
pub async fn get_all_folders(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    note_manager::get_all_folders(&state.notes_dir)
}

fn rebuild_cache_for_new_note(note_name: &str, state: &AppState) -> Result<(), String> {
    // Get all notes
    let notes = note_manager::list_notes(&state.notes_dir)?;
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    // Check each note to see if it contains a link to the new note
    for note in notes {
        if let Ok(content) = read_file_with_encoding(&note.path) {
            // Check if this note contains a link to the new note
            let note_name_without_ext = note_name.trim_end_matches(".md");
            if content.contains(&format!("[[{note_name_without_ext}]]"))
                || content.contains(&format!("[[{note_name_without_ext}.md]]"))
            {
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
    let cache_db = state
        .cache_db
        .lock()
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
pub async fn get_local_graph(
    note_path: String,
    state: State<'_, AppState>,
) -> Result<GraphData, String> {
    let cache_db = state
        .cache_db
        .lock()
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
    let note_dir = note_path_buf
        .parent()
        .ok_or("Failed to get note directory")?;

    // Create images subdirectory if it doesn't exist
    let images_dir = note_dir.join("images");
    if !images_dir.exists() {
        std::fs::create_dir_all(&images_dir)
            .map_err(|e| format!("Failed to create images directory: {e}"))?;
    }

    // Generate unique filename if file already exists
    let mut final_filename = filename.clone();
    let mut counter = 1;
    while images_dir.join(&final_filename).exists() {
        let name_parts: Vec<&str> = filename.rsplitn(2, '.').collect();
        if name_parts.len() == 2 {
            final_filename = format!("{}-{}.{}", name_parts[1], counter, name_parts[0]);
        } else {
            final_filename = format!("{filename}-{counter}");
        }
        counter += 1;
    }

    // Save the image
    let image_path = images_dir.join(&final_filename);
    std::fs::write(&image_path, image_data).map_err(|e| format!("Failed to save image: {e}"))?;

    // Return relative path from note location
    Ok(format!("images/{final_filename}"))
}

#[tauri::command]
pub async fn get_incomplete_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    cache_db.get_incomplete_todos()
}

#[tauri::command]
pub async fn toggle_todo(
    note_path: String,
    line_number: i32,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    // Toggle the todo in the database
    let new_state = cache_db.toggle_todo(&note_path, line_number)?;

    // Read the note content
    let mut content =
        read_file_with_encoding(&note_path).map_err(|e| format!("Failed to read note: {e}"))?;

    // Update the content
    let lines: Vec<&str> = content.lines().collect();
    let line_index = (line_number - 1) as usize;

    if line_index < lines.len() {
        let line = lines[line_index];
        let updated_line = if new_state {
            line.replace("- [ ]", "- [x]").replace("* [ ]", "* [x]")
        } else {
            line.replace("- [x]", "- [ ]")
                .replace("* [x]", "* [ ]")
                .replace("- [X]", "- [ ]")
                .replace("* [X]", "* [ ]")
        };

        // Reconstruct the content
        let mut new_lines = lines.to_vec();
        new_lines[line_index] = &updated_line;
        content = new_lines.join("\n");

        // If original content ended with newline, preserve it
        if read_file_with_encoding(&note_path)
            .map_err(|e| format!("Failed to read note: {e}"))?
            .ends_with('\n')
        {
            content.push('\n');
        }

        // Save the updated content
        std::fs::write(&note_path, &content).map_err(|e| format!("Failed to write note: {e}"))?;
    }

    Ok(content)
}

#[tauri::command]
pub async fn get_daily_note_template(state: State<'_, AppState>) -> Result<String, String> {
    let settings_path = Path::new(&state.notes_dir).join(".plainflux");
    let template_path = settings_path.join("daily_note_template.md");

    match safe_read_file(&template_path) {
        Ok(content) => Ok(content),
        Err(AppError::NotFound(_)) => {
            // Return default template if none exists
            Ok(String::from(
                "# {{date}}\n\n## Tasks\n- [ ] \n\n## Notes\n\n## Reflections\n\n",
            ))
        }
        Err(e) => Err(format!("Failed to read template: {e}")),
    }
}

#[tauri::command]
pub async fn save_daily_note_template(
    template: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings_path = Path::new(&state.notes_dir).join(".plainflux");
    let template_path = settings_path.join("daily_note_template.md");

    // Ensure settings directory exists with proper error handling
    ensure_dir_exists(&settings_path)
        .map_err(|e| format!("Failed to create settings directory: {e}"))?;

    // Validate the template path is within notes directory
    validate_path_security(&template_path, &state.notes_dir)
        .map_err(|e| format!("Security error: {e}"))?;

    // Save the template with atomic write
    safe_write_file(&template_path, &template)
        .map_err(|e| format!("Failed to save template: {e}"))?;

    Ok(())
}

#[tauri::command]
pub async fn rename_note(
    old_path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Rename the file
    let new_path = note_manager::rename_note(&old_path, &new_name)?;

    // Update cache
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    // Clear old cache
    cache_db.clear_note_cache(&old_path)?;

    // Read content and update cache with new path
    if let Ok(content) = read_file_with_encoding(&new_path) {
        cache_db.update_note_cache(&new_path, &content, &state.notes_dir)?;
    }

    Ok(new_path)
}

#[tauri::command]
pub async fn rename_folder(
    old_path: String,
    new_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Get all notes in the folder before renaming
    let notes_in_folder = note_manager::list_notes(&state.notes_dir)?
        .into_iter()
        .filter(|note| note.path.contains(&format!("{}/", &old_path)))
        .collect::<Vec<_>>();

    // Rename the folder
    let new_path = note_manager::rename_folder(&old_path, &new_name, &state.notes_dir)?;

    // Update cache for all notes in the renamed folder
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    for old_note in notes_in_folder {
        // Clear old cache
        cache_db.clear_note_cache(&old_note.path)?;

        // Calculate new note path
        let new_note_path = old_note.path.replace(&old_path, &new_path);

        // Update cache with new path
        if let Ok(content) = read_file_with_encoding(&new_note_path) {
            cache_db.update_note_cache(&new_note_path, &content, &state.notes_dir)?;
        }
    }

    Ok(new_path)
}

#[tauri::command]
pub async fn init_git_repo(state: State<'_, AppState>) -> Result<(), String> {
    let mut git_manager = lock_mutex!(
        state.git_manager,
        "Git manager mutex was poisoned during init_git_repo"
    );
    git_manager.init_repo()
}

#[tauri::command]
pub async fn is_git_repo(state: State<'_, AppState>) -> Result<bool, String> {
    let git_manager = lock_mutex!(
        state.git_manager,
        "Git manager mutex was poisoned during is_git_repo"
    );
    Ok(git_manager.is_git_repo())
}

#[tauri::command]
pub async fn get_git_blame(
    file_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<GitBlameInfo>, String> {
    let git_manager = lock_mutex!(
        state.git_manager,
        "Git manager mutex was poisoned during get_git_blame"
    );
    git_manager.get_blame_info(&file_path)
}

#[tauri::command]
pub async fn git_commit(message: Option<String>, state: State<'_, AppState>) -> Result<(), String> {
    let git_manager = lock_mutex!(
        state.git_manager,
        "Git manager mutex was poisoned during git_commit"
    );
    git_manager.commit_changes(message.as_deref())
}

#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    let settings_path = Path::new(&state.notes_dir).join(".plainflux");
    let settings_file = settings_path.join("settings.json");

    match safe_read_file(&settings_file) {
        Ok(content) => {
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse settings: {e}"))
        }
        Err(AppError::NotFound(_)) => {
            // Return default settings if none exist
            Ok(AppSettings::default())
        }
        Err(e) => Err(format!("Failed to read settings: {e}")),
    }
}

#[tauri::command]
pub async fn save_app_settings(
    settings: AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings_path = Path::new(&state.notes_dir).join(".plainflux");
    let settings_file = settings_path.join("settings.json");

    // Ensure settings directory exists
    ensure_dir_exists(&settings_path)
        .map_err(|e| format!("Failed to create settings directory: {e}"))?;

    // Serialize settings to JSON
    let settings_json = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    // Save settings to file
    safe_write_file(&settings_file, &settings_json)
        .map_err(|e| format!("Failed to save settings: {e}"))
}

#[tauri::command]
pub async fn get_recent_notes(state: State<'_, AppState>) -> Result<Vec<RecentNote>, String> {
    let recent_notes = lock_mutex!(
        state.recent_notes,
        "Recent notes mutex was poisoned during get_recent_notes"
    );

    // Return the notes in reverse order (most recent first)
    Ok(recent_notes.iter().rev().cloned().collect())
}

fn add_recent_note(
    state: &State<'_, AppState>,
    path: &str,
    title: &str,
    folder: &str,
) -> Result<(), String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get timestamp: {e}"))?
        .as_secs();

    let recent_note = RecentNote {
        path: path.to_string(),
        title: title.to_string(),
        last_modified: timestamp,
        folder: folder.to_string(),
    };

    let mut recent_notes = lock_mutex!(
        state.recent_notes,
        "Recent notes mutex was poisoned during add_recent_note"
    );

    // Remove any existing entry for this path
    recent_notes.retain(|note| note.path != path);

    // Add the new entry at the end (most recent)
    recent_notes.push_back(recent_note);

    // Keep only the last 20 notes
    const MAX_RECENT_NOTES: usize = 20;
    while recent_notes.len() > MAX_RECENT_NOTES {
        recent_notes.pop_front();
    }

    Ok(())
}
