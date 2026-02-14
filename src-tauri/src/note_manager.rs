use crate::utils::safe_write_file;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub path: String,
    pub title: String,
    pub content: String,
    pub last_modified: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteMetadata {
    pub path: String,
    pub title: String,
    pub last_modified: i64,
    pub relative_path: String,
    pub folder: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub note: Note,
    pub match_count: usize,
    pub snippets: Vec<SearchSnippet>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchSnippet {
    pub line_number: usize,
    pub text: String,
    pub match_start: usize,
    pub match_length: usize,
}

pub fn read_note(path: &str) -> Result<Note, String> {
    let content = read_file_with_encoding(path)?;

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get metadata: {e}"))?;

    let last_modified = metadata
        .modified()
        .map_err(|e| format!("Failed to get modified time: {e}"))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to convert time: {e}"))?
        .as_secs() as i64;

    let title = Path::new(path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("Untitled")
        .to_string();

    Ok(Note {
        path: path.to_string(),
        title,
        content,
        last_modified,
    })
}

pub fn write_note(path: &str, content: &str) -> Result<(), String> {
    // Use the safe write utility which handles parent directory creation
    // and atomic writes
    safe_write_file(path, content).map_err(|e| format!("Failed to write note: {e}"))
}

pub fn list_notes(base_path: &str) -> Result<Vec<NoteMetadata>, String> {
    let mut notes = Vec::new();
    let base_path_buf = Path::new(base_path);

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(metadata) = fs::metadata(path) {
                let last_modified = metadata
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);

                let title = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Untitled")
                    .to_string();

                // Calculate relative path and folder
                let relative_path = path
                    .strip_prefix(base_path_buf)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(|_| path.to_string_lossy().to_string());

                let folder = path
                    .parent()
                    .and_then(|p| p.strip_prefix(base_path_buf).ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_else(String::new);

                // Skip notes in hidden internal folders (.plainflux, images)
                let relative_path_obj = Path::new(&relative_path);
                let skip_note = relative_path_obj.components().any(|component| {
                    if let std::path::Component::Normal(name) = component {
                        if let Some(name_str) = name.to_str() {
                            return name_str == ".plainflux"
                                || name_str == "images"
                                || name_str == ".git";
                        }
                    }
                    false
                });

                if !skip_note {
                    notes.push(NoteMetadata {
                        path: path.to_string_lossy().to_string(),
                        title,
                        last_modified,
                        relative_path,
                        folder,
                    });
                }
            }
        }
    }

    // Sort notes alphabetically by folder and then by title
    notes.sort_by(|a, b| match a.folder.cmp(&b.folder) {
        std::cmp::Ordering::Equal => a.title.cmp(&b.title),
        other => other,
    });

    Ok(notes)
}

pub fn get_all_folders(base_path: &str) -> Result<Vec<String>, String> {
    let mut folders = Vec::new();
    let base_path_buf = Path::new(base_path);

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_dir() && path != base_path_buf {
            let relative_path = path
                .strip_prefix(base_path_buf)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| path.to_string_lossy().to_string());

            if !relative_path.is_empty() {
                // Skip hidden internal folders
                let folder_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                if folder_name == ".plainflux"
                    || folder_name == "images"
                    || folder_name == "Daily Notes"
                    || folder_name == ".git"
                {
                    continue;
                }

                // Also skip if any parent folder is .plainflux, images, or Daily Notes
                let relative_path_obj = Path::new(&relative_path);
                let contains_hidden = relative_path_obj.components().any(|component| {
                    if let std::path::Component::Normal(name) = component {
                        if let Some(name_str) = name.to_str() {
                            return name_str == ".plainflux"
                                || name_str == "images"
                                || name_str == "Daily Notes"
                                || name_str == ".git";
                        }
                    }
                    false
                });

                if !contains_hidden {
                    folders.push(relative_path);
                }
            }
        }
    }

    folders.sort();
    Ok(folders)
}

pub fn create_daily_note(base_path: &str, template: Option<&str>) -> Result<String, String> {
    use crate::utils::ensure_dir_exists;
    use chrono::Local;

    let daily_notes_dir = Path::new(base_path).join("Daily Notes");
    ensure_dir_exists(&daily_notes_dir)
        .map_err(|e| format!("Failed to create Daily Notes directory: {e}"))?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let note_path = daily_notes_dir.join(format!("{today}.md"));

    if !note_path.exists() {
        let content = if let Some(template_content) = template {
            apply_template_variables(template_content)
        } else {
            format!("# {today}\n\n")
        };

        safe_write_file(&note_path, &content)
            .map_err(|e| format!("Failed to create daily note: {e}"))?;
    }

    Ok(note_path.to_string_lossy().to_string())
}

fn apply_template_variables(template: &str) -> String {
    use chrono::Local;

    let now = Local::now();
    let mut result = template.to_string();

    // Replace template variables
    result = result.replace("{{date}}", &now.format("%Y-%m-%d").to_string());
    result = result.replace("{{date_long}}", &now.format("%A, %B %d, %Y").to_string());
    result = result.replace("{{time}}", &now.format("%H:%M").to_string());
    result = result.replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M").to_string());
    result = result.replace("{{year}}", &now.format("%Y").to_string());
    result = result.replace("{{month}}", &now.format("%m").to_string());
    result = result.replace("{{day}}", &now.format("%d").to_string());
    result = result.replace("{{weekday}}", &now.format("%A").to_string());

    result
}

/// Helper function to read file contents, preferring UTF-8 with fallback for legacy files
pub fn read_file_with_encoding(path: &str) -> Result<String, String> {
    // On Windows, ensure path uses proper separators
    #[cfg(target_os = "windows")]
    let path = path.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let path = path.to_string();

    // First try reading as UTF-8 (the standard encoding)
    match fs::read_to_string(&path) {
        Ok(content) => Ok(content),
        Err(e) => {
            // If UTF-8 fails, try reading as bytes and convert lossily
            // This handles legacy files that may have been created with other encodings
            if e.kind() == std::io::ErrorKind::InvalidData {
                match fs::read(&path) {
                    Ok(bytes) => {
                        eprintln!("[READ] Warning: File {path} contains invalid UTF-8, using lossy conversion");
                        Ok(String::from_utf8_lossy(&bytes).into_owned())
                    }
                    Err(read_err) => {
                        let err_msg = format!("Failed to read file {path}: {read_err}");
                        eprintln!("[READ] ERROR: {err_msg}");
                        Err(err_msg)
                    }
                }
            } else {
                let err_msg = format!("Failed to read file {path}: {e}");
                eprintln!("[READ] ERROR: {err_msg}");
                Err(err_msg)
            }
        }
    }
}

pub fn search_notes(base_path: &str, query: &str) -> Result<Vec<Note>, String> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    let base_path_buf = Path::new(base_path);

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| {
            if let Err(ref err) = e {
                eprintln!("[SEARCH] WalkDir error: {err}");
            }
            e.ok()
        })
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            // Skip notes in .plainflux and images folders
            if let Ok(relative_path) = path.strip_prefix(base_path_buf) {
                let skip_note = relative_path.components().any(|component| {
                    if let std::path::Component::Normal(name) = component {
                        if let Some(name_str) = name.to_str() {
                            return name_str.eq_ignore_ascii_case(".plainflux")
                                || name_str.eq_ignore_ascii_case("images")
                                || name_str.eq_ignore_ascii_case(".git");
                        }
                    }
                    false
                });

                if skip_note {
                    continue;
                }
            }

            let path_str = path.to_string_lossy();

            match read_file_with_encoding(&path_str) {
                Ok(content) => {
                    if content.to_lowercase().contains(&query_lower) {
                        match read_note(&path.to_string_lossy()) {
                            Ok(note) => {
                                results.push(note);
                            }
                            Err(e) => {
                                eprintln!(
                                    "[SEARCH] ERROR reading matched note {}: {}",
                                    path.display(),
                                    e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "[SEARCH] ERROR reading file content {}: {}",
                        path.display(),
                        e
                    );
                }
            }
        }
    }

    Ok(results)
}

pub fn search_notes_enhanced(
    _base_path: &str,
    query: &str,
    cache_db: &crate::cache::CacheDb,
) -> Result<Vec<SearchResult>, String> {
    // Use FTS5 to get matching note paths
    let note_paths = cache_db.search_notes_fts(query)?;

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    for note_path in note_paths {
        // Read the note
        match read_note(&note_path) {
            Ok(note) => {
                // Extract snippets from the content
                let snippets = extract_search_snippets(&note.content, &query_lower);
                let match_count = snippets.len();

                if match_count > 0 {
                    results.push(SearchResult {
                        note,
                        match_count,
                        snippets,
                    });
                }
            }
            Err(e) => {
                eprintln!("[SEARCH_ENHANCED] ERROR reading note {note_path}: {e}");
            }
        }
    }

    Ok(results)
}

fn extract_search_snippets(content: &str, query_lower: &str) -> Vec<SearchSnippet> {
    let mut snippets = Vec::new();
    const CONTEXT_CHARS: usize = 50; // Characters of context on each side

    for (line_number, line) in content.lines().enumerate() {
        let line_lower = line.to_lowercase();
        let query_len_lower = query_lower.len();

        // Find all matches in the lowercased line, then map byte offsets
        // back to the original string via char counts to avoid panics when
        // case-folding changes byte lengths (e.g. Turkish İ -> i̇).
        let mut search_start = 0;
        while let Some(match_pos_lower) = line_lower[search_start..].find(query_lower) {
            let actual_pos_lower = search_start + match_pos_lower;

            // Map byte offset in lowercased string to the original string
            // by counting chars up to the match position, then finding the
            // corresponding byte offset in the original.
            let char_offset = line_lower[..actual_pos_lower].chars().count();
            let actual_pos = line
                .char_indices()
                .nth(char_offset)
                .map(|(i, _)| i)
                .unwrap_or(line.len());

            // Map the end of the match similarly
            let match_end_char_offset = line_lower[..actual_pos_lower + query_len_lower]
                .chars()
                .count();
            let match_end = line
                .char_indices()
                .nth(match_end_char_offset)
                .map(|(i, _)| i)
                .unwrap_or(line.len());

            // Calculate snippet boundaries using char-aware offsets
            let snippet_start_char = char_offset.saturating_sub(CONTEXT_CHARS);
            let snippet_start = line
                .char_indices()
                .nth(snippet_start_char)
                .map(|(i, _)| i)
                .unwrap_or(0);

            let total_chars = line.chars().count();
            let snippet_end_char = (match_end_char_offset + CONTEXT_CHARS).min(total_chars);
            let snippet_end = line
                .char_indices()
                .nth(snippet_end_char)
                .map(|(i, _)| i)
                .unwrap_or(line.len());

            // Extract the snippet text
            let mut snippet_text = line[snippet_start..snippet_end].to_string();

            // Add ellipsis if we're not at the start/end
            if snippet_start > 0 {
                snippet_text = format!("...{snippet_text}");
            }
            if snippet_end < line.len() {
                snippet_text = format!("{snippet_text}...");
            }

            // Calculate match position within the snippet
            let match_start_in_snippet =
                actual_pos - snippet_start + (if snippet_start > 0 { 3 } else { 0 });

            snippets.push(SearchSnippet {
                line_number: line_number + 1, // 1-based line numbers
                text: snippet_text,
                match_start: match_start_in_snippet,
                match_length: match_end - actual_pos,
            });

            // Move past this match in the lowercased string
            search_start = actual_pos_lower + query_len_lower;
        }
    }

    snippets
}

fn validate_relative_folder_path(folder_path: &str, allow_root: bool) -> Result<(), String> {
    let trimmed = folder_path.trim();

    if trimmed.is_empty() {
        return if allow_root {
            Ok(())
        } else {
            Err("Cannot perform this operation on the root notes folder".to_string())
        };
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("Absolute folder paths are not allowed".to_string());
    }

    let mut has_normal_component = false;

    for component in path.components() {
        match component {
            Component::ParentDir => {
                return Err("Parent directory traversal is not allowed".to_string())
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("Absolute folder paths are not allowed".to_string())
            }
            Component::Normal(_) => has_normal_component = true,
            Component::CurDir => {}
        }
    }

    if !has_normal_component {
        return if allow_root {
            Ok(())
        } else {
            Err("Cannot perform this operation on the root notes folder".to_string())
        };
    }

    Ok(())
}

fn validate_folder_name(name: &str) -> Result<(), String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }

    if trimmed == "." || trimmed == ".." || trimmed.contains('/') || trimmed.contains('\\') {
        return Err("Folder name must not contain path separators or traversal".to_string());
    }

    Ok(())
}

pub fn move_note(old_path: &str, new_folder: &str, base_path: &str) -> Result<String, String> {
    validate_relative_folder_path(new_folder, true)?;

    let old_path_buf = Path::new(old_path);
    let filename = old_path_buf
        .file_name()
        .ok_or_else(|| "Invalid file path".to_string())?;

    let new_path = if new_folder.is_empty() {
        Path::new(base_path).join(filename)
    } else {
        Path::new(base_path).join(new_folder).join(filename)
    };

    // Create the target directory if it doesn't exist
    if let Some(parent) = new_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {e}"))?;
    }

    // Move the file
    fs::rename(old_path, &new_path).map_err(|e| format!("Failed to move note: {e}"))?;

    Ok(new_path.to_string_lossy().to_string())
}

pub fn delete_folder(folder_path: &str, base_path: &str) -> Result<Vec<String>, String> {
    validate_relative_folder_path(folder_path, false)?;

    let base = Path::new(base_path);
    let full_path = base.join(folder_path);

    if !full_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !full_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    // Get all files that will be deleted for confirmation
    let mut files_to_delete = Vec::new();
    collect_files_recursive(&full_path, &mut files_to_delete)?;

    // Convert to relative paths for display
    let relative_files: Vec<String> = files_to_delete
        .iter()
        .filter_map(|path| path.strip_prefix(base).ok())
        .map(|p| p.to_string_lossy().to_string())
        .collect();

    Ok(relative_files)
}

pub fn delete_folder_confirmed(folder_path: &str, base_path: &str) -> Result<(), String> {
    validate_relative_folder_path(folder_path, false)?;

    let base = Path::new(base_path);
    let full_path = base.join(folder_path);

    fs::remove_dir_all(&full_path).map_err(|e| format!("Failed to delete folder: {e}"))?;

    Ok(())
}

pub fn create_folder(folder_path: &str, base_path: &str) -> Result<(), String> {
    validate_relative_folder_path(folder_path, false)?;

    let base = Path::new(base_path);
    let full_path = base.join(folder_path);

    if full_path.exists() {
        return Err("Folder already exists".to_string());
    }

    fs::create_dir_all(&full_path).map_err(|e| format!("Failed to create folder: {e}"))?;

    Ok(())
}

pub fn rename_note(old_path: &str, new_name: &str) -> Result<String, String> {
    let old_path_buf = Path::new(old_path);

    // Ensure the note exists
    if !old_path_buf.exists() {
        return Err("Note does not exist".to_string());
    }

    // Get the parent directory
    let parent = old_path_buf
        .parent()
        .ok_or_else(|| "Invalid note path".to_string())?;

    // Ensure the new name has .md extension
    let new_filename = if new_name.ends_with(".md") {
        new_name.to_string()
    } else {
        format!("{new_name}.md")
    };

    // Create the new path
    let new_path = parent.join(&new_filename);

    // Check if a file with the new name already exists
    if new_path.exists() {
        return Err("A note with this name already exists".to_string());
    }

    // Rename the file
    fs::rename(old_path, &new_path).map_err(|e| format!("Failed to rename note: {e}"))?;

    Ok(new_path.to_string_lossy().to_string())
}

pub fn rename_folder(old_path: &str, new_name: &str, base_path: &str) -> Result<String, String> {
    validate_relative_folder_path(old_path, false)?;
    validate_folder_name(new_name)?;

    let base = Path::new(base_path);
    let old_full_path = base.join(old_path);

    // Ensure the folder exists
    if !old_full_path.exists() {
        return Err("Folder does not exist".to_string());
    }

    if !old_full_path.is_dir() {
        return Err("Path is not a folder".to_string());
    }

    // Get the parent directory of the old folder
    let parent = old_full_path
        .parent()
        .ok_or_else(|| "Invalid folder path".to_string())?;

    // Create the new path
    let new_full_path = parent.join(new_name);

    // Check if a folder with the new name already exists
    if new_full_path.exists() {
        return Err("A folder with this name already exists".to_string());
    }

    // Rename the folder
    fs::rename(&old_full_path, &new_full_path)
        .map_err(|e| format!("Failed to rename folder: {e}"))?;

    // Return the relative path from base_path
    new_full_path
        .strip_prefix(base)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|_| "Failed to calculate relative path".to_string())
}

fn collect_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            files.push(path);
        } else if path.is_dir() {
            collect_files_recursive(&path, files)?;
        }
    }

    Ok(())
}
