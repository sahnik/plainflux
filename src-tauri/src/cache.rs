use regex::Regex;
use rusqlite::{params, Connection};
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Todo {
    pub id: i32,
    pub note_path: String,
    pub line_number: i32,
    pub content: String,
    pub is_completed: bool,
}

pub struct CacheDb {
    conn: Connection,
}

impl CacheDb {
    pub fn new(db_path: &str) -> Result<Self, String> {
        let conn =
            Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))?;

        let db = CacheDb { conn };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> Result<(), String> {
        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS links (
                id INTEGER PRIMARY KEY,
                from_note TEXT NOT NULL,
                to_note TEXT NOT NULL,
                UNIQUE(from_note, to_note)
            )",
                [],
            )
            .map_err(|e| format!("Failed to create links table: {e}"))?;

        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY,
                tag TEXT NOT NULL,
                note_path TEXT NOT NULL,
                UNIQUE(tag, note_path)
            )",
                [],
            )
            .map_err(|e| format!("Failed to create tags table: {e}"))?;

        self.conn
            .execute(
                "CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_note)",
                [],
            )
            .map_err(|e| format!("Failed to create index: {e}"))?;

        self.conn
            .execute(
                "CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_note)",
                [],
            )
            .map_err(|e| format!("Failed to create index: {e}"))?;

        self.conn
            .execute("CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)", [])
            .map_err(|e| format!("Failed to create index: {e}"))?;

        self.conn
            .execute(
                "CREATE TABLE IF NOT EXISTS todos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                note_path TEXT NOT NULL,
                line_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                is_completed BOOLEAN NOT NULL DEFAULT 0,
                UNIQUE(note_path, line_number)
            )",
                [],
            )
            .map_err(|e| format!("Failed to create todos table: {e}"))?;

        self.conn
            .execute(
                "CREATE INDEX IF NOT EXISTS idx_todos_note ON todos(note_path)",
                [],
            )
            .map_err(|e| format!("Failed to create index: {e}"))?;

        self.conn
            .execute(
                "CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(is_completed)",
                [],
            )
            .map_err(|e| format!("Failed to create index: {e}"))?;

        Ok(())
    }

    pub fn update_note_cache(
        &self,
        note_path: &str,
        content: &str,
        notes_dir: &str,
    ) -> Result<(), String> {
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

        let todos = extract_todos(content);
        for todo in todos {
            self.add_todo(note_path, todo.0, &todo.1, todo.2)?;
        }

        Ok(())
    }

    pub fn clear_note_cache(&self, note_path: &str) -> Result<(), String> {
        self.conn
            .execute("DELETE FROM links WHERE from_note = ?1", params![note_path])
            .map_err(|e| format!("Failed to clear links: {e}"))?;

        self.conn
            .execute("DELETE FROM tags WHERE note_path = ?1", params![note_path])
            .map_err(|e| format!("Failed to clear tags: {e}"))?;

        self.conn
            .execute("DELETE FROM todos WHERE note_path = ?1", params![note_path])
            .map_err(|e| format!("Failed to clear todos: {e}"))?;

        Ok(())
    }

    pub fn add_link(&self, from_note: &str, to_note: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR IGNORE INTO links (from_note, to_note) VALUES (?1, ?2)",
                params![from_note, to_note],
            )
            .map_err(|e| format!("Failed to add link: {e}"))?;
        Ok(())
    }

    pub fn add_tag(&self, tag: &str, note_path: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR IGNORE INTO tags (tag, note_path) VALUES (?1, ?2)",
                params![tag, note_path],
            )
            .map_err(|e| format!("Failed to add tag: {e}"))?;
        Ok(())
    }

    pub fn get_backlinks(&self, note_path: &str) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT from_note FROM links WHERE to_note = ?1")
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let links = stmt
            .query_map(params![note_path], |row| row.get(0))
            .map_err(|e| format!("Failed to query backlinks: {e}"))?;

        let mut result = Vec::new();
        for link in links {
            result.push(link.map_err(|e| format!("Failed to get link: {e}"))?);
        }

        Ok(result)
    }

    pub fn get_all_tags(&self) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT DISTINCT tag FROM tags ORDER BY tag")
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let tags = stmt
            .query_map([], |row| row.get(0))
            .map_err(|e| format!("Failed to query tags: {e}"))?;

        let mut result = Vec::new();
        for tag in tags {
            result.push(tag.map_err(|e| format!("Failed to get tag: {e}"))?);
        }

        Ok(result)
    }

    pub fn get_notes_by_tag(&self, tag: &str) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT note_path FROM tags WHERE tag = ?1")
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let notes = stmt
            .query_map(params![tag], |row| row.get(0))
            .map_err(|e| format!("Failed to query notes: {e}"))?;

        let mut result = Vec::new();
        for note in notes {
            result.push(note.map_err(|e| format!("Failed to get note: {e}"))?);
        }

        Ok(result)
    }

    pub fn get_all_links(&self) -> Result<Vec<Link>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT from_note, to_note FROM links")
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let links = stmt
            .query_map([], |row| {
                Ok(Link {
                    from_note: row.get(0)?,
                    to_note: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to query links: {e}"))?;

        let mut result = Vec::new();
        for link in links {
            result.push(link.map_err(|e| format!("Failed to get link: {e}"))?);
        }

        Ok(result)
    }

    pub fn get_links_for_note(&self, note_path: &str) -> Result<Vec<Link>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT from_note, to_note FROM links 
             WHERE from_note = ?1 OR to_note = ?1",
            )
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let links = stmt
            .query_map(params![note_path], |row| {
                Ok(Link {
                    from_note: row.get(0)?,
                    to_note: row.get(1)?,
                })
            })
            .map_err(|e| format!("Failed to query links: {e}"))?;

        let mut result = Vec::new();
        for link in links {
            result.push(link.map_err(|e| format!("Failed to get link: {e}"))?);
        }

        Ok(result)
    }

    pub fn add_todo(
        &self,
        note_path: &str,
        line_number: i32,
        content: &str,
        is_completed: bool,
    ) -> Result<(), String> {
        self.conn.execute(
            "INSERT OR REPLACE INTO todos (note_path, line_number, content, is_completed) VALUES (?1, ?2, ?3, ?4)",
            params![note_path, line_number, content, is_completed],
        ).map_err(|e| format!("Failed to add todo: {e}"))?;

        Ok(())
    }

    pub fn get_incomplete_todos(&self) -> Result<Vec<Todo>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT id, note_path, line_number, content, is_completed FROM todos WHERE is_completed = 0 ORDER BY note_path, line_number"
        ).map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let todos = stmt
            .query_map([], |row| {
                Ok(Todo {
                    id: row.get(0)?,
                    note_path: row.get(1)?,
                    line_number: row.get(2)?,
                    content: row.get(3)?,
                    is_completed: row.get(4)?,
                })
            })
            .map_err(|e| format!("Failed to query todos: {e}"))?;

        let mut result = Vec::new();
        for todo in todos {
            result.push(todo.map_err(|e| format!("Failed to get todo: {e}"))?);
        }

        Ok(result)
    }

    pub fn toggle_todo(&self, note_path: &str, line_number: i32) -> Result<bool, String> {
        // Get current state
        let mut stmt = self
            .conn
            .prepare("SELECT is_completed FROM todos WHERE note_path = ?1 AND line_number = ?2")
            .map_err(|e| format!("Failed to prepare statement: {e}"))?;

        let current_state: bool = stmt
            .query_row(params![note_path, line_number], |row| row.get(0))
            .map_err(|e| format!("Failed to get todo state: {e}"))?;

        let new_state = !current_state;

        // Update state
        self.conn
            .execute(
                "UPDATE todos SET is_completed = ?1 WHERE note_path = ?2 AND line_number = ?3",
                params![new_state, note_path, line_number],
            )
            .map_err(|e| format!("Failed to update todo: {e}"))?;

        Ok(new_state)
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
                if filename
                    .to_string_lossy()
                    .eq_ignore_ascii_case(name_without_ext)
                {
                    return Ok(path.to_string_lossy().to_string());
                }
            }
        }
    }

    Err(format!("Note not found: {link_name}"))
}

fn extract_todos(content: &str) -> Vec<(i32, String, bool)> {
    let mut todos = Vec::new();
    let todo_regex = Regex::new(r"^\s*[-*]\s*\[([ xX])\]\s*(.+)$").unwrap();

    for (line_number, line) in content.lines().enumerate() {
        // Match markdown checkbox syntax: - [ ] or - [x]
        if let Some(captures) = todo_regex.captures(line) {
            let is_completed = captures.get(1).is_some_and(|m| m.as_str() != " ");
            let content = captures
                .get(2)
                .map_or("", |m| m.as_str())
                .trim()
                .to_string();
            todos.push((line_number as i32 + 1, content, is_completed)); // +1 for 1-based line numbers
        }
    }

    todos
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
