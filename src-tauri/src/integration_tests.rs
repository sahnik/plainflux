use crate::cache::CacheDb;
use crate::note_manager;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

struct TestWorkspace {
    root: PathBuf,
    notes_dir: PathBuf,
    db_path: PathBuf,
}

impl TestWorkspace {
    fn new(name: &str) -> Self {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "plainflux-test-{}-{}-{}",
            name,
            std::process::id(),
            unique_suffix
        ));
        let notes_dir = root.join("notes");
        let db_path = root.join("notes_cache.db");

        fs::create_dir_all(&notes_dir).expect("failed to create notes directory");

        Self {
            root,
            notes_dir,
            db_path,
        }
    }

    fn notes_dir_str(&self) -> &str {
        self.notes_dir
            .to_str()
            .expect("notes directory path should be valid utf-8 for tests")
    }

    fn create_cache(&self) -> CacheDb {
        CacheDb::new(
            self.db_path
                .to_str()
                .expect("db path should be valid utf-8 for tests"),
        )
        .expect("failed to create cache db")
    }

    fn write_note(&self, relative_path: &str, content: &str) -> String {
        let full_path = self.notes_dir.join(relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).expect("failed to create note parent directory");
        }
        fs::write(&full_path, content).expect("failed to write test note");
        full_path
            .to_str()
            .expect("note path should be valid utf-8 for tests")
            .to_string()
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn title_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|name| name.to_str())
        .unwrap_or("Untitled")
        .to_string()
}

#[test]
fn folder_delete_rejects_root_and_traversal_paths() {
    let ws = TestWorkspace::new("folder-delete-safety");
    let _note_path = ws.write_note("Projects/Task.md", "# Task\n");

    let preview = note_manager::delete_folder("Projects", ws.notes_dir_str())
        .expect("expected valid folder preview");
    assert!(
        preview
            .iter()
            .any(|path| path.ends_with("Projects/Task.md")),
        "expected preview to include note in target folder"
    );

    note_manager::delete_folder_confirmed("Projects", ws.notes_dir_str())
        .expect("expected valid folder deletion");
    assert!(
        !ws.notes_dir.join("Projects").exists(),
        "target folder should be deleted"
    );

    assert!(
        note_manager::delete_folder("", ws.notes_dir_str()).is_err(),
        "empty path must not be allowed for delete preview"
    );
    assert!(
        note_manager::delete_folder_confirmed("", ws.notes_dir_str()).is_err(),
        "empty path must not be allowed for delete"
    );
    assert!(
        note_manager::delete_folder("../outside", ws.notes_dir_str()).is_err(),
        "path traversal must be rejected"
    );
    assert!(
        note_manager::delete_folder_confirmed("../outside", ws.notes_dir_str()).is_err(),
        "path traversal must be rejected"
    );

    let absolute_folder = ws.notes_dir.join("Absolute");
    fs::create_dir_all(&absolute_folder).expect("failed to create absolute test folder");
    let absolute_folder_str = absolute_folder
        .to_str()
        .expect("absolute folder path should be valid utf-8 for tests");
    assert!(
        note_manager::delete_folder(absolute_folder_str, ws.notes_dir_str()).is_err(),
        "absolute folder paths must be rejected"
    );
    assert!(
        note_manager::delete_folder_confirmed(absolute_folder_str, ws.notes_dir_str()).is_err(),
        "absolute folder paths must be rejected"
    );
}

#[test]
fn cache_and_fts_track_move_and_rename_without_stale_paths() {
    let ws = TestWorkspace::new("cache-move-rename");
    let cache_db = ws.create_cache();

    let original_path = ws.write_note("Drafts/Plan.md", "# Plan\n\nkeywordalpha\n");
    let original_title = title_from_path(&original_path);
    let original_content = note_manager::read_file_with_encoding(&original_path)
        .expect("failed to read original note");

    cache_db
        .update_note_cache_with_fts(
            &original_path,
            &original_title,
            &original_content,
            ws.notes_dir_str(),
        )
        .expect("failed to index original note");
    cache_db
        .set_cached_mtime(&original_path, 1, 0)
        .expect("failed to set original mtime");

    let initial_results = cache_db
        .search_notes_fts("keywordalpha")
        .expect("initial search should succeed");
    assert!(
        initial_results.contains(&original_path),
        "fts should contain original note path"
    );

    let moved_path = note_manager::move_note(&original_path, "Archive", ws.notes_dir_str())
        .expect("move note should succeed");
    cache_db
        .remove_stale_entries(std::slice::from_ref(&original_path))
        .expect("failed to remove stale original path");

    let moved_content =
        note_manager::read_file_with_encoding(&moved_path).expect("failed to read moved note");
    let moved_title = title_from_path(&moved_path);
    cache_db
        .update_note_cache_with_fts(
            &moved_path,
            &moved_title,
            &moved_content,
            ws.notes_dir_str(),
        )
        .expect("failed to index moved note");
    cache_db
        .set_cached_mtime(&moved_path, 2, 0)
        .expect("failed to set moved mtime");

    let moved_results = cache_db
        .search_notes_fts("keywordalpha")
        .expect("search after move should succeed");
    assert!(
        moved_results.contains(&moved_path),
        "fts should contain moved note path"
    );
    assert!(
        !moved_results.contains(&original_path),
        "fts should not contain stale original path"
    );

    let renamed_path =
        note_manager::rename_note(&moved_path, "Renamed Plan").expect("rename note should succeed");
    cache_db
        .remove_stale_entries(std::slice::from_ref(&moved_path))
        .expect("failed to remove stale moved path");

    let renamed_content =
        note_manager::read_file_with_encoding(&renamed_path).expect("failed to read renamed note");
    let renamed_title = title_from_path(&renamed_path);
    cache_db
        .update_note_cache_with_fts(
            &renamed_path,
            &renamed_title,
            &renamed_content,
            ws.notes_dir_str(),
        )
        .expect("failed to index renamed note");
    cache_db
        .set_cached_mtime(&renamed_path, 3, 0)
        .expect("failed to set renamed mtime");

    let renamed_results = cache_db
        .search_notes_fts("keywordalpha")
        .expect("search after rename should succeed");
    assert!(
        renamed_results.contains(&renamed_path),
        "fts should contain renamed note path"
    );
    assert!(
        !renamed_results.contains(&moved_path),
        "fts should not contain stale moved path"
    );

    let cached_paths = cache_db
        .get_all_cached_paths()
        .expect("failed to fetch cached paths");
    assert!(
        cached_paths.contains(&renamed_path),
        "metadata should include renamed path"
    );
    assert!(
        !cached_paths.contains(&original_path),
        "metadata should not include original path"
    );
    assert!(
        !cached_paths.contains(&moved_path),
        "metadata should not include moved path"
    );
}

#[test]
fn enhanced_search_reflects_content_updates_and_deletions() {
    let ws = TestWorkspace::new("search-mutations");
    let cache_db = ws.create_cache();

    let note_path = ws.write_note("Search.md", "# Search\n\nalpha banana\n");
    let initial_content =
        note_manager::read_file_with_encoding(&note_path).expect("failed to read initial note");
    cache_db
        .update_note_cache_with_fts(&note_path, "Search", &initial_content, ws.notes_dir_str())
        .expect("failed to index initial note");
    cache_db
        .set_cached_mtime(&note_path, 1, 0)
        .expect("failed to set initial mtime");

    let banana_results =
        note_manager::search_notes_enhanced(ws.notes_dir_str(), "banana", &cache_db)
            .expect("banana search should succeed");
    assert!(
        banana_results
            .iter()
            .any(|result| result.note.path == note_path),
        "enhanced search should include note for initial term"
    );

    fs::write(&note_path, "# Search\n\nalpha carrot\n").expect("failed to update note content");
    let updated_content =
        note_manager::read_file_with_encoding(&note_path).expect("failed to read updated note");
    cache_db
        .update_note_cache_with_fts(&note_path, "Search", &updated_content, ws.notes_dir_str())
        .expect("failed to reindex updated note");
    cache_db
        .set_cached_mtime(&note_path, 2, 0)
        .expect("failed to set updated mtime");

    let banana_after_update =
        note_manager::search_notes_enhanced(ws.notes_dir_str(), "banana", &cache_db)
            .expect("banana search after update should succeed");
    assert!(
        banana_after_update.is_empty(),
        "old term should no longer match after content update"
    );

    let carrot_results =
        note_manager::search_notes_enhanced(ws.notes_dir_str(), "carrot", &cache_db)
            .expect("carrot search should succeed");
    assert!(
        carrot_results
            .iter()
            .any(|result| result.note.path == note_path),
        "new term should match after content update"
    );

    fs::remove_file(&note_path).expect("failed to delete note");
    cache_db
        .remove_stale_entries(std::slice::from_ref(&note_path))
        .expect("failed to remove stale deleted note");

    let carrot_after_delete =
        note_manager::search_notes_enhanced(ws.notes_dir_str(), "carrot", &cache_db)
            .expect("carrot search after delete should succeed");
    assert!(
        carrot_after_delete.is_empty(),
        "deleted note should not appear in enhanced search results"
    );
}
