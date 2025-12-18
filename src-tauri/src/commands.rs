use crate::cache::{Bookmark, CacheDb, Todo};
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
use tauri::{State, WebviewWindow};

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
    pub show_git_blame: bool, // whether to show git blame info in editor
    pub window_width: Option<f64>,
    pub window_height: Option<f64>,
    pub window_x: Option<f64>,
    pub window_y: Option<f64>,
    pub window_maximized: Option<bool>,
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
            show_git_blame: true,
            window_width: None,
            window_height: None,
            window_x: None,
            window_y: None,
            window_maximized: None,
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

    // Add to recent notes and get title
    let note = note_manager::read_note(&path)?;

    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during save_note"
    );
    // Update cache including FTS5 index
    cache_db.update_note_cache_with_fts(&path, &note.title, &content, &state.notes_dir)?;
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
pub async fn search_notes_enhanced(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<note_manager::SearchResult>, String> {
    println!("[COMMAND] search_notes_enhanced called with query: '{query}'");

    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache DB mutex was poisoned during search_notes_enhanced"
    );

    let result = note_manager::search_notes_enhanced(&state.notes_dir, &query, &cache_db);

    match &result {
        Ok(results) => {
            let count = results.len();
            let total_matches: usize = results.iter().map(|r| r.match_count).sum();
            println!("[COMMAND] Enhanced search returned {count} notes with {total_matches} total matches");
        }
        Err(e) => println!("[COMMAND] Enhanced search error: {e}"),
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
pub async fn get_block_reference(
    note_path: String,
    block_id: String,
    state: State<'_, AppState>,
) -> Result<Option<(i32, String)>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache DB mutex was poisoned during get_block_reference"
    );

    cache_db.get_block(&note_path, &block_id)
}

#[tauri::command]
pub async fn get_blocks_for_note(
    note_path: String,
    state: State<'_, AppState>,
) -> Result<Vec<(String, i32, String)>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache DB mutex was poisoned during get_blocks_for_note"
    );

    cache_db.get_blocks_for_note(&note_path)
}

#[tauri::command]
pub async fn resolve_transclusion(
    link: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Parse the link to extract note name and optional block ID
    let (note_name, block_id) = if let Some(pos) = link.find('#') {
        let (name, block) = link.split_at(pos);
        (name, Some(&block[1..])) // Skip the # character
    } else {
        (link.as_str(), None)
    };

    // Find the note path
    let notes = note_manager::list_notes(&state.notes_dir)?;

    let note_path = notes
        .iter()
        .find(|n| n.title.eq_ignore_ascii_case(note_name))
        .or_else(|| {
            let name_without_ext = note_name.trim_end_matches(".md");
            notes
                .iter()
                .find(|n| n.title.eq_ignore_ascii_case(name_without_ext))
        })
        .map(|n| n.path.clone())
        .ok_or_else(|| format!("Note '{}' not found", note_name))?;

    // Read the note content
    let content =
        std::fs::read_to_string(&note_path).map_err(|e| format!("Failed to read note: {e}"))?;

    // If block ID is specified, extract just that block's content
    if let Some(block_id) = block_id {
        let cache_db = lock_mutex!(
            state.cache_db,
            "Cache DB mutex was poisoned during resolve_transclusion"
        );

        if let Some((line_number, _heading_text)) = cache_db.get_block(&note_path, block_id)? {
            // Extract the content from the heading to the next heading of same or higher level
            let lines: Vec<&str> = content.lines().collect();
            if line_number > 0 && (line_number as usize) <= lines.len() {
                let start_idx = (line_number - 1) as usize;
                let start_line = lines[start_idx];

                // Determine the heading level
                let heading_level = start_line.chars().take_while(|&c| c == '#').count();

                // Find the end of this block (next heading of same or higher level)
                let mut block_lines = vec![start_line];
                for line in &lines[(start_idx + 1)..] {
                    if line.starts_with('#') {
                        let line_level = line.chars().take_while(|&c| c == '#').count();
                        if line_level <= heading_level {
                            break;
                        }
                    }
                    block_lines.push(line);
                }

                return Ok(block_lines.join("\n"));
            }
        }

        return Err(format!("Block '{}' not found in note", block_id));
    }

    // Return the entire note content
    Ok(content)
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
pub async fn get_outgoing_links(note_path: String) -> Result<Vec<String>, String> {
    use crate::cache::extract_links;

    // Read the note content
    let content =
        read_file_with_encoding(&note_path).map_err(|e| format!("Failed to read note: {e}"))?;

    // Extract links from the content
    let links = extract_links(&content);

    Ok(links)
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
pub async fn save_attachment(
    file_data: Vec<u8>,
    filename: String,
    note_path: String,
    _state: State<'_, AppState>,
) -> Result<String, String> {
    // Get the directory of the current note
    let note_path_buf = std::path::Path::new(&note_path);
    let note_dir = note_path_buf
        .parent()
        .ok_or("Failed to get note directory")?;

    // Create attachments subdirectory if it doesn't exist
    let attachments_dir = note_dir.join("attachments");
    if !attachments_dir.exists() {
        std::fs::create_dir_all(&attachments_dir)
            .map_err(|e| format!("Failed to create attachments directory: {e}"))?;
    }

    // Generate unique filename if file already exists
    let mut final_filename = filename.clone();
    let mut counter = 1;
    while attachments_dir.join(&final_filename).exists() {
        let name_parts: Vec<&str> = filename.rsplitn(2, '.').collect();
        if name_parts.len() == 2 {
            final_filename = format!("{}-{}.{}", name_parts[1], counter, name_parts[0]);
        } else {
            final_filename = format!("{filename}-{counter}");
        }
        counter += 1;
    }

    // Save the attachment
    let attachment_path = attachments_dir.join(&final_filename);
    std::fs::write(&attachment_path, file_data)
        .map_err(|e| format!("Failed to save attachment: {e}"))?;

    // Return relative path from note location
    Ok(format!("attachments/{final_filename}"))
}

#[tauri::command]
pub async fn open_file_external(
    file_path: String,
    note_path: String,
    window: tauri::WebviewWindow,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    // Get the directory of the current note
    let note_path_buf = std::path::Path::new(&note_path);
    let note_dir = note_path_buf
        .parent()
        .ok_or("Failed to get note directory")?;

    // Construct the full path to the attachment
    let full_path = if file_path.starts_with("attachments/") {
        note_dir.join(&file_path)
    } else {
        // Fallback for absolute paths or other formats
        std::path::PathBuf::from(&file_path)
    };

    // Validate that the file exists and is within the expected directory structure
    if !full_path.exists() {
        return Err("File not found".to_string());
    }

    // Security check: ensure the file is within the note directory or its subdirectories
    if let Ok(canonical_full_path) = full_path.canonicalize() {
        if let Ok(canonical_note_dir) = note_dir.canonicalize() {
            if !canonical_full_path.starts_with(&canonical_note_dir) {
                return Err("Access denied: file is outside the note directory".to_string());
            }
        }
    }

    // Open the file with the default application
    window
        .opener()
        .open_url(
            format!("file://{}", full_path.to_string_lossy()).as_str(),
            None::<String>,
        )
        .map_err(|e| format!("Failed to open file: {e}"))
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
pub async fn get_all_todos(state: State<'_, AppState>) -> Result<Vec<Todo>, String> {
    let cache_db = state
        .cache_db
        .lock()
        .map_err(|_| "Failed to lock cache database")?;

    cache_db.get_all_todos()
}

// Helper function to create a new instance of a recurring todo
fn create_recurring_todo_instance(
    todo: &Todo,
    notes_dir: &str,
    cache_db: &CacheDb,
) -> Result<(), String> {
    use crate::cache::calculate_next_occurrence;
    use chrono::Local;

    // Get the recurrence pattern
    let pattern = todo
        .recurrence_pattern
        .as_ref()
        .ok_or_else(|| "No recurrence pattern".to_string())?;

    // Calculate next due date
    let next_due_date = calculate_next_occurrence(pattern);

    // Get today's daily note path
    let daily_notes_dir = Path::new(notes_dir).join("Daily Notes");
    let today = Local::now().format("%Y-%m-%d").to_string();
    let daily_note_path = daily_notes_dir.join(format!("{}.md", today));

    // Ensure daily note exists
    if !daily_note_path.exists() {
        let template = format!("# {}\n\n## Tasks\n\n", today);
        std::fs::create_dir_all(&daily_notes_dir)
            .map_err(|e| format!("Failed to create Daily Notes directory: {e}"))?;
        std::fs::write(&daily_note_path, template)
            .map_err(|e| format!("Failed to create daily note: {e}"))?;
    }

    // Read current daily note content
    let mut content = std::fs::read_to_string(&daily_note_path)
        .map_err(|e| format!("Failed to read daily note: {e}"))?;

    // Create new todo line with updated due date and same metadata
    let mut new_todo = format!("- [ ] {}", todo.content);

    // Preserve priority
    if let Some(priority) = &todo.priority {
        if !new_todo.contains(&format!("!{}", priority)) {
            new_todo = format!("{} !{}", new_todo, priority);
        }
    }

    // Add new due date if calculated
    if let Some(due_date) = next_due_date {
        // Remove old due date patterns from content if present
        let content_without_date =
            regex::Regex::new(r"(?:@due\([^)]+\)|due:\d{4}-\d{2}-\d{2}|📅\s*\d{4}-\d{2}-\d{2})")
                .unwrap()
                .replace_all(&new_todo, "");
        new_todo = format!("{} @due({})", content_without_date.trim(), due_date);
    }

    // Append the new todo to the daily note
    if !content.ends_with('\n') {
        content.push('\n');
    }
    content.push_str(&format!("{}\n", new_todo));

    // Write back to daily note
    std::fs::write(&daily_note_path, &content)
        .map_err(|e| format!("Failed to write daily note: {e}"))?;

    // Update cache for the daily note
    cache_db.update_note_cache_with_fts(
        &daily_note_path.to_string_lossy(),
        &today, // title is the date
        &content,
        notes_dir,
    )?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_todo(
    note_path: String,
    line_number: i32,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // Extract todo info and toggle state (in a scope to drop the mutex guard)
    let (todo_info, new_state) = {
        let cache_db = state
            .cache_db
            .lock()
            .map_err(|_| "Failed to lock cache database")?;

        // Get todo info before toggling (to check for recurrence)
        let todo = cache_db.get_todo(&note_path, line_number)?;

        // Toggle the todo in the database
        let state = cache_db.toggle_todo(&note_path, line_number)?;

        (todo, state)
    }; // MutexGuard is dropped here

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

        // Handle recurring tasks: if marked as complete and has recurrence pattern, create new instance
        if new_state && todo_info.recurrence_pattern.is_some() {
            // Lock cache again for recurring task creation
            let cache_db = state
                .cache_db
                .lock()
                .map_err(|_| "Failed to lock cache database")?;

            if let Err(e) = create_recurring_todo_instance(&todo_info, &state.notes_dir, &cache_db)
            {
                eprintln!("Failed to create recurring todo instance: {}", e);
                // Don't fail the whole operation if recurring creation fails
            }
        }
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
            serde_json::from_str(&content).map_err(|e| format!("Failed to parse settings: {e}"))
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

/// Time filter for recent notes query
#[derive(Debug, Deserialize)]
pub enum RecentNotesFilter {
    Today,
    Week,
    Month,
    All,
}

#[tauri::command]
pub async fn get_recent_notes(
    state: State<'_, AppState>,
    filter: Option<RecentNotesFilter>,
) -> Result<Vec<RecentNote>, String> {
    let filter = filter.unwrap_or(RecentNotesFilter::Today);

    // Get current time
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("Failed to get current time: {e}"))?
        .as_secs();

    // Calculate cutoff timestamp based on filter
    let cutoff = match filter {
        RecentNotesFilter::Today => {
            // Start of today (midnight)
            let secs_since_midnight = now % 86400;
            now - secs_since_midnight
        }
        RecentNotesFilter::Week => now - (7 * 24 * 60 * 60),
        RecentNotesFilter::Month => now - (30 * 24 * 60 * 60),
        RecentNotesFilter::All => 0,
    };

    // Get all notes from filesystem
    let notes = note_manager::list_notes(&state.notes_dir)?;

    // Filter by time and convert to RecentNote format
    let mut recent_notes: Vec<RecentNote> = notes
        .into_iter()
        .filter(|note| (note.last_modified as u64) >= cutoff)
        .map(|note| RecentNote {
            path: note.path,
            title: note.title,
            last_modified: note.last_modified as u64,
            folder: note.folder,
        })
        .collect();

    // Sort by last_modified descending (most recent first)
    recent_notes.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(recent_notes)
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

#[tauri::command]
pub async fn get_all_bookmarks(state: State<'_, AppState>) -> Result<Vec<Bookmark>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during get_all_bookmarks"
    );

    cache_db.get_all_bookmarks()
}

#[tauri::command]
pub async fn search_bookmarks(
    query: String,
    state: State<'_, AppState>,
) -> Result<Vec<Bookmark>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during search_bookmarks"
    );

    cache_db.search_bookmarks(&query)
}

#[tauri::command]
pub async fn get_bookmarks_by_domain(
    domain: String,
    state: State<'_, AppState>,
) -> Result<Vec<Bookmark>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during get_bookmarks_by_domain"
    );

    cache_db.get_bookmarks_by_domain(&domain)
}

#[tauri::command]
pub async fn add_bookmark_manual(
    url: String,
    title: Option<String>,
    description: Option<String>,
    tags: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during add_bookmark_manual"
    );

    cache_db.add_bookmark(
        &url,
        title.as_deref(),
        description.as_deref(),
        None, // note_path
        None, // line_number
        tags.as_deref(),
    )
}

#[tauri::command]
pub async fn update_bookmark(
    id: i32,
    title: Option<String>,
    description: Option<String>,
    tags: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during update_bookmark"
    );

    cache_db.update_bookmark(
        id,
        title.as_deref(),
        description.as_deref(),
        tags.as_deref(),
    )
}

#[tauri::command]
pub async fn delete_bookmark(id: i32, state: State<'_, AppState>) -> Result<(), String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during delete_bookmark"
    );

    cache_db.delete_bookmark(id)
}

#[tauri::command]
pub async fn get_all_bookmark_domains(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let cache_db = lock_mutex!(
        state.cache_db,
        "Cache database mutex was poisoned during get_all_bookmark_domains"
    );

    cache_db.get_all_domains()
}

#[tauri::command]
pub async fn open_url_external(url: String, window: WebviewWindow) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    // Validate URL format (basic check)
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Invalid URL: must start with http:// or https://".to_string());
    }

    // Open the URL with the default browser
    window
        .opener()
        .open_url(&url, None::<String>)
        .map_err(|e| format!("Failed to open URL: {e}"))
}

#[tauri::command]
pub async fn save_window_state(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), String> {
    // Get current window state
    let size = window
        .inner_size()
        .map_err(|e| format!("Failed to get window size: {e}"))?;
    let position = window
        .outer_position()
        .map_err(|e| format!("Failed to get window position: {e}"))?;
    let is_maximized = window
        .is_maximized()
        .map_err(|e| format!("Failed to get maximized state: {e}"))?;

    // Get current settings
    let mut settings = get_app_settings(state.clone()).await?;

    // Update window state
    settings.window_width = Some(size.width as f64);
    settings.window_height = Some(size.height as f64);
    settings.window_x = Some(position.x as f64);
    settings.window_y = Some(position.y as f64);
    settings.window_maximized = Some(is_maximized);

    // Save settings
    save_app_settings(settings, state).await
}

#[tauri::command]
pub async fn apply_window_state(
    window: WebviewWindow,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let settings = get_app_settings(state).await?;

    // Apply window size if available
    let (window_width, window_height) =
        if let (Some(width), Some(height)) = (settings.window_width, settings.window_height) {
            // Validate dimensions are reasonable
            let width = width.clamp(400.0, 2560.0) as u32;
            let height = height.clamp(300.0, 1440.0) as u32;

            window
                .set_size(tauri::Size::Physical(tauri::PhysicalSize { width, height }))
                .map_err(|e| format!("Failed to set window size: {e}"))?;

            (width, height)
        } else {
            // Get current window size as fallback
            let size = window
                .inner_size()
                .map_err(|e| format!("Failed to get window size: {e}"))?;
            (size.width, size.height)
        };

    // Apply window position if available, with validation for multi-monitor setups
    if let (Some(x), Some(y)) = (settings.window_x, settings.window_y) {
        // Get available monitors to validate the position
        let monitors = window
            .available_monitors()
            .map_err(|e| format!("Failed to get available monitors: {e}"))?;

        // Check if the saved position is visible on any current monitor
        let is_position_valid =
            is_window_position_visible(x as i32, y as i32, window_width, window_height, &monitors);

        if is_position_valid {
            // Position is valid, restore it
            window
                .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: x as i32,
                    y: y as i32,
                }))
                .map_err(|e| format!("Failed to set window position: {e}"))?;
        } else {
            // Position is off-screen, center on primary monitor
            if let Some(primary) = window
                .primary_monitor()
                .map_err(|e| format!("Failed to get primary monitor: {e}"))?
            {
                let monitor_pos = primary.position();
                let monitor_size = primary.size();

                // Center the window on the primary monitor
                let centered_x =
                    monitor_pos.x + (monitor_size.width as i32 - window_width as i32) / 2;
                let centered_y =
                    monitor_pos.y + (monitor_size.height as i32 - window_height as i32) / 2;

                window
                    .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                        x: centered_x,
                        y: centered_y,
                    }))
                    .map_err(|e| format!("Failed to set centered window position: {e}"))?;
            }
            // If we can't get primary monitor, leave window at default position
        }
    }

    // Apply maximized state if specified
    if let Some(is_maximized) = settings.window_maximized {
        if is_maximized {
            window
                .maximize()
                .map_err(|e| format!("Failed to maximize window: {e}"))?;
        }
    }

    Ok(())
}

/// Check if a window position is visible on any of the available monitors
/// A window is considered visible if at least 100x100 pixels of it overlaps with a monitor
fn is_window_position_visible(
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    monitors: &[tauri::Monitor],
) -> bool {
    const MIN_VISIBLE_SIZE: i32 = 100; // Minimum pixels that should be visible

    for monitor in monitors {
        let monitor_pos = monitor.position();
        let monitor_size = monitor.size();

        let monitor_x = monitor_pos.x;
        let monitor_y = monitor_pos.y;
        let monitor_right = monitor_x + monitor_size.width as i32;
        let monitor_bottom = monitor_y + monitor_size.height as i32;

        let window_right = x + width as i32;
        let window_bottom = y + height as i32;

        // Calculate overlap
        let overlap_left = x.max(monitor_x);
        let overlap_top = y.max(monitor_y);
        let overlap_right = window_right.min(monitor_right);
        let overlap_bottom = window_bottom.min(monitor_bottom);

        let overlap_width = (overlap_right - overlap_left).max(0);
        let overlap_height = (overlap_bottom - overlap_top).max(0);

        // Check if there's enough visible area
        if overlap_width >= MIN_VISIBLE_SIZE && overlap_height >= MIN_VISIBLE_SIZE {
            return true;
        }
    }

    false
}

#[tauri::command]
pub async fn force_rebuild_cache(state: State<'_, AppState>) -> Result<String, String> {
    crate::force_rebuild_cache(&state).map_err(|e| e.to_string())?;
    Ok("Cache rebuilt successfully".to_string())
}
