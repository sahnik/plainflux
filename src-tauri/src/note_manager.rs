use crate::utils::safe_write_file;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
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

use encoding_rs::WINDOWS_1252;
use encoding_rs_io::DecodeReaderBytesBuilder;

/// Helper function to read file contents with WINDOWS_1252 encoding
pub fn read_file_with_encoding(path: &str) -> Result<String, String> {
    // On Windows, ensure path uses proper separators
    #[cfg(target_os = "windows")]
    let path = path.replace('/', "\\");
    #[cfg(not(target_os = "windows"))]
    let path = path.to_string();

    let file = fs::File::open(&path).map_err(|e| {
        let err_msg = format!("Failed to open file: {e}");
        println!("[READ] ERROR: {err_msg}");
        err_msg
    })?;

    let _file_size = file.metadata().map(|m| m.len()).unwrap_or(0);

    let mut reader = DecodeReaderBytesBuilder::new()
        .encoding(Some(WINDOWS_1252))
        .build(file);
    let mut content = String::new();

    match reader.read_to_string(&mut content) {
        Ok(_) => {
            // Successfully read file
        }
        Err(e) => {
            let err_msg = format!("Failed to read file: {e}");
            println!("[READ] ERROR reading {path}: {err_msg}");
            return Err(err_msg);
        }
    }

    Ok(content)
}

pub fn search_notes(base_path: &str, query: &str) -> Result<Vec<Note>, String> {
    println!("[SEARCH] Starting search for query: '{query}'");
    println!("[SEARCH] Base path: {base_path}");

    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    let base_path_buf = Path::new(base_path);

    let mut total_files = 0;
    let mut md_files = 0;
    let mut skipped_files = 0;
    let mut read_errors = 0;
    let mut matched_files = 0;

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| {
            if let Err(ref err) = e {
                println!("[SEARCH] WalkDir error: {err}");
            }
            e.ok()
        })
    {
        total_files += 1;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            md_files += 1;
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
                    skipped_files += 1;
                    println!(
                        "[SEARCH] Skipping file in excluded folder: {}",
                        path.display()
                    );
                    continue;
                }
            }

            let path_str = path.to_string_lossy();

            // Check for potential path encoding issues
            if path_str.contains('�') {
                println!("[SEARCH] WARNING: Path contains replacement character, may have encoding issues: {path_str}");
            }

            match read_file_with_encoding(&path_str) {
                Ok(content) => {
                    if content.to_lowercase().contains(&query_lower) {
                        matched_files += 1;
                        let path_display = path.display();
                        println!("[SEARCH] Match found in: {path_display}");
                        match read_note(&path.to_string_lossy()) {
                            Ok(note) => {
                                let title = &note.title;
                                println!("[SEARCH] Successfully read note: {title}");
                                results.push(note);
                            }
                            Err(e) => {
                                println!(
                                    "[SEARCH] ERROR reading matched note {}: {}",
                                    path.display(),
                                    e
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    read_errors += 1;
                    println!(
                        "[SEARCH] ERROR reading file content {}: {}",
                        path.display(),
                        e
                    );
                }
            }
        }
    }

    let results_len = results.len();
    println!("[SEARCH] Search complete. Total files: {total_files}, MD files: {md_files}, Skipped: {skipped_files}, Read errors: {read_errors}, Matches: {matched_files}, Results: {results_len}");

    Ok(results)
}

pub fn search_notes_enhanced(
    _base_path: &str,
    query: &str,
    cache_db: &crate::cache::CacheDb,
) -> Result<Vec<SearchResult>, String> {
    println!("[SEARCH_ENHANCED] Starting enhanced search for query: '{query}'");

    // Use FTS5 to get matching note paths
    let note_paths = cache_db.search_notes_fts(query)?;
    println!("[SEARCH_ENHANCED] FTS5 returned {} matches", note_paths.len());

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
                println!("[SEARCH_ENHANCED] ERROR reading note {note_path}: {e}");
            }
        }
    }

    println!("[SEARCH_ENHANCED] Search complete. Found {} results", results.len());
    Ok(results)
}

fn extract_search_snippets(content: &str, query_lower: &str) -> Vec<SearchSnippet> {
    let mut snippets = Vec::new();
    const CONTEXT_CHARS: usize = 50; // Characters of context on each side

    for (line_number, line) in content.lines().enumerate() {
        let line_lower = line.to_lowercase();

        // Find all matches in this line
        let mut start_pos = 0;
        while let Some(match_pos) = line_lower[start_pos..].find(query_lower) {
            let actual_pos = start_pos + match_pos;

            // Calculate snippet boundaries
            let snippet_start = actual_pos.saturating_sub(CONTEXT_CHARS);
            let snippet_end = (actual_pos + query_lower.len() + CONTEXT_CHARS).min(line.len());

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
            let match_start_in_snippet = actual_pos - snippet_start + (if snippet_start > 0 { 3 } else { 0 });

            snippets.push(SearchSnippet {
                line_number: line_number + 1, // 1-based line numbers
                text: snippet_text,
                match_start: match_start_in_snippet,
                match_length: query_lower.len(),
            });

            // Move past this match to find the next one
            start_pos = actual_pos + query_lower.len();
        }
    }

    snippets
}

pub fn move_note(old_path: &str, new_folder: &str, base_path: &str) -> Result<String, String> {
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
    let base = Path::new(base_path);
    let full_path = base.join(folder_path);

    fs::remove_dir_all(&full_path).map_err(|e| format!("Failed to delete folder: {e}"))?;

    Ok(())
}

pub fn create_folder(folder_path: &str, base_path: &str) -> Result<(), String> {
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
