use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
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
}

pub fn read_note(path: &str) -> Result<Note, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read note: {}", e))?;
    
    let metadata = fs::metadata(path)
        .map_err(|e| format!("Failed to get metadata: {}", e))?;
    
    let last_modified = metadata.modified()
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
    let path_buf = Path::new(path);
    
    if let Some(parent) = path_buf.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    fs::write(path, content)
        .map_err(|e| format!("Failed to write note: {}", e))?;
    
    Ok(())
}

pub fn list_notes(base_path: &str) -> Result<Vec<NoteMetadata>, String> {
    let mut notes = Vec::new();
    
    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            if let Ok(metadata) = fs::metadata(path) {
                let last_modified = metadata.modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                
                let title = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Untitled")
                    .to_string();
                
                notes.push(NoteMetadata {
                    path: path.to_string_lossy().to_string(),
                    title,
                    last_modified,
                });
            }
        }
    }
    
    Ok(notes)
}

pub fn create_daily_note(base_path: &str) -> Result<String, String> {
    use chrono::Local;
    
    let daily_notes_dir = Path::new(base_path).join("Daily Notes");
    fs::create_dir_all(&daily_notes_dir)
        .map_err(|e| format!("Failed to create Daily Notes directory: {}", e))?;
    
    let today = Local::now().format("%Y-%m-%d").to_string();
    let note_path = daily_notes_dir.join(format!("{}.md", today));
    
    if !note_path.exists() {
        let content = format!("# {}\n\n", today);
        fs::write(&note_path, content)
            .map_err(|e| format!("Failed to create daily note: {}", e))?;
    }
    
    Ok(note_path.to_string_lossy().to_string())
}

pub fn search_notes(base_path: &str, query: &str) -> Result<Vec<Note>, String> {
    let mut results = Vec::new();
    let query_lower = query.to_lowercase();
    
    for entry in WalkDir::new(base_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
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