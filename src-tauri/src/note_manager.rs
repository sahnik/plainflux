use crate::utils::safe_write_file;
use serde::{Deserialize, Serialize};
use std::fs;
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

pub fn read_note(path: &str) -> Result<Note, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read note: {}", e))?;

    let metadata = fs::metadata(path).map_err(|e| format!("Failed to get metadata: {}", e))?;

    let last_modified = metadata
        .modified()
        .map_err(|e| format!("Failed to get modified time: {}", e))?
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| format!("Failed to convert time: {}", e))?
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
    safe_write_file(path, content).map_err(|e| format!("Failed to write note: {}", e))
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
                            return name_str == ".plainflux" || name_str == "images";
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
                                || name_str == "Daily Notes";
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
        .map_err(|e| format!("Failed to create Daily Notes directory: {}", e))?;

    let today = Local::now().format("%Y-%m-%d").to_string();
    let note_path = daily_notes_dir.join(format!("{}.md", today));

    if !note_path.exists() {
        let content = if let Some(template_content) = template {
            apply_template_variables(template_content)
        } else {
            format!("# {}\n\n", today)
        };

        safe_write_file(&note_path, &content)
            .map_err(|e| format!("Failed to create daily note: {}", e))?;
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

pub fn search_notes(base_path: &str, query: &str) -> Result<Vec<Note>, String> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();

    let base_path_buf = Path::new(base_path);

    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            // Skip notes in hidden folders
            if let Ok(relative_path) = path.strip_prefix(base_path_buf) {
                let skip_note = relative_path.components().any(|component| {
                    if let std::path::Component::Normal(name) = component {
                        if let Some(name_str) = name.to_str() {
                            return name_str == ".plainflux"
                                || name_str == "images"
                                || name_str == "Daily Notes";
                        }
                    }
                    false
                });

                if skip_note {
                    continue;
                }
            }

            if let Ok(content) = fs::read_to_string(path) {
                if content.to_lowercase().contains(&query_lower) {
                    if let Ok(note) = read_note(&path.to_string_lossy()) {
                        results.push(note);
                    }
                }
            }
        }
    }

    Ok(results)
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
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Move the file
    fs::rename(old_path, &new_path).map_err(|e| format!("Failed to move note: {}", e))?;

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

    fs::remove_dir_all(&full_path).map_err(|e| format!("Failed to delete folder: {}", e))?;

    Ok(())
}

pub fn create_folder(folder_path: &str, base_path: &str) -> Result<(), String> {
    let base = Path::new(base_path);
    let full_path = base.join(folder_path);

    if full_path.exists() {
        return Err("Folder already exists".to_string());
    }

    fs::create_dir_all(&full_path).map_err(|e| format!("Failed to create folder: {}", e))?;

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
        format!("{}.md", new_name)
    };

    // Create the new path
    let new_path = parent.join(&new_filename);

    // Check if a file with the new name already exists
    if new_path.exists() {
        return Err("A note with this name already exists".to_string());
    }

    // Rename the file
    fs::rename(old_path, &new_path).map_err(|e| format!("Failed to rename note: {}", e))?;

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
        .map_err(|e| format!("Failed to rename folder: {}", e))?;

    // Return the relative path from base_path
    new_full_path
        .strip_prefix(base)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|_| "Failed to calculate relative path".to_string())
}

fn collect_files_recursive(dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = fs::read_dir(dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            files.push(path);
        } else if path.is_dir() {
            collect_files_recursive(&path, files)?;
        }
    }

    Ok(())
}
