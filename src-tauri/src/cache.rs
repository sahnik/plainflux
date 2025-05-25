use rusqlite::{Connection, params};
use regex::Regex;
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct Link {
    pub from_note: String,
    pub to_note: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Tag {
    pub tag: String,
    pub note_path: String,
}

pub struct CacheDb {
    conn: Connection,
}

impl CacheDb {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;
        
        let db = CacheDb { conn };
        db.init_tables()?;
        Ok(db)
    }
    
    fn init_tables(&self) -> Result<(), String> {
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY,
                from_note TEXT NOT NULL,
                to_note TEXT NOT NULL,
                UNIQUE(from_note, to_note)
            )",
            [],
        ).map_err(|e| format!("Failed to create links table: {}", e))?;
        
        self.conn.execute(
            "CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY,
                tag TEXT NOT NULL,
                note_path TEXT NOT NULL,
                UNIQUE(tag, note_path)
            )",
            [],
        ).map_err(|e| format!("Failed to create tags table: {}", e))?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_note)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_note)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;
        
        self.conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)",
            [],
        ).map_err(|e| format!("Failed to create index: {}", e))?;
        
        Ok(())
    }
    
    pub fn update_note_cache(&self, note_path: &str, content: &str, notes_dir: &str) -> Result<(), String> {
        self.clear_note_cache(note_path)?;
        
        let links = extract_links(content);
        for link in links {
            // Try to find the actual file path for this link
            if let Ok(link_path) = resolve_note_link(&link, notes_dir) {
                self.add_link(note_path, &link_path)?;
            }
        }
        
        let tags = extract_tags(content);
        for tag in tags {
            self.add_tag(&tag, note_path)?;
        }
        
        Ok(())
    }
    
    pub fn clear_note_cache(&self, note_path: &str) -> Result<(), String> {
        self.conn.execute(
            "DELETE FROM links WHERE from_note = ?1",
            params![note_path],
        ).map_err(|e| format!("Failed to clear links: {}", e))?;
        
        self.conn.execute(
            "DELETE FROM tags WHERE note_path = ?1",
            params![note_path],
        ).map_err(|e| format!("Failed to clear tags: {}", e))?;
        
        Ok(())
    }
    
    pub fn add_link(&self, from_note: &str, to_note: &str) -> Result<(), String> {
        self.conn.execute(
            "INSERT OR IGNORE INTO links (from_note, to_note) VALUES (?1, ?2)",
            params![from_note, to_note],
        ).map_err(|e| format!("Failed to add link: {}", e))?;
        Ok(())
    }
    
    pub fn add_tag(&self, tag: &str, note_path: &str) -> Result<(), String> {
        self.conn.execute(
            "INSERT OR IGNORE INTO tags (tag, note_path) VALUES (?1, ?2)",
            params![tag, note_path],
        ).map_err(|e| format!("Failed to add tag: {}", e))?;
        Ok(())
    }
    
    pub fn get_backlinks(&self, note_path: &str) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT from_note FROM links WHERE to_note = ?1"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let links = stmt.query_map(params![note_path], |row| {
            row.get(0)
        }).map_err(|e| format!("Failed to query backlinks: {}", e))?;
        
        let mut result = Vec::new();
        for link in links {
            result.push(link.map_err(|e| format!("Failed to get link: {}", e))?);
        }
        
        Ok(result)
    }
    
    pub fn get_all_tags(&self) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT DISTINCT tag FROM tags ORDER BY tag"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let tags = stmt.query_map([], |row| {
            row.get(0)
        }).map_err(|e| format!("Failed to query tags: {}", e))?;
        
        let mut result = Vec::new();
        for tag in tags {
            result.push(tag.map_err(|e| format!("Failed to get tag: {}", e))?);
        }
        
        Ok(result)
    }
    
    pub fn get_notes_by_tag(&self, tag: &str) -> Result<Vec<String>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT note_path FROM tags WHERE tag = ?1"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let notes = stmt.query_map(params![tag], |row| {
            row.get(0)
        }).map_err(|e| format!("Failed to query notes: {}", e))?;
        
        let mut result = Vec::new();
        for note in notes {
            result.push(note.map_err(|e| format!("Failed to get note: {}", e))?);
        }
        
        Ok(result)
    }
}

pub fn extract_links(content: &str) -> Vec<String> {
    let re = Regex::new(r"\[\[([^\]]+)\]\]").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].to_string())
        .collect()
}

fn extract_tags(content: &str) -> Vec<String> {
    let re = Regex::new(r"#(\w+)").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].to_string())
        .collect()
}

fn resolve_note_link(link_name: &str, notes_dir: &str) -> Result<String, String> {
    // Remove .md extension if present
    let name_without_ext = link_name.trim_end_matches(".md");
    
    // Walk through all files in the notes directory
    for entry in WalkDir::new(notes_dir)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
            // Get the filename without extension
            if let Some(filename) = path.file_stem() {
                if filename.to_string_lossy().eq_ignore_ascii_case(name_without_ext) {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
        }
    }
    
    Err(format!("Note not found: {}", link_name))
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_extract_links() {
        let content = "This is a [[Test Note]] and another [[Second Note]]";
        let links = extract_links(content);
        assert_eq!(links.len(), 2);
        assert_eq!(links[0], "Test Note");
        assert_eq!(links[1], "Second Note");
    }
    
    #[test]
    fn test_extract_tags() {
        let content = "This has #tag1 and #tag2 tags";
        let tags = extract_tags(content);
        assert_eq!(tags.len(), 2);
        assert_eq!(tags[0], "tag1");
        assert_eq!(tags[1], "tag2");
    }
}