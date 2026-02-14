#[macro_use]
mod macros;
mod cache;
mod commands;
mod error;
mod git_manager;
mod note_manager;
mod utils;
#[cfg(test)]
mod integration_tests;

use cache::CacheDb;
use commands::AppState;
use error::Result;
use git_manager::GitManager;
use note_manager::read_file_with_encoding;
use std::collections::{HashSet, VecDeque};
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

/// Sync the cache incrementally - only update files that have changed since last cache
fn sync_cache(state: &AppState) -> Result<()> {
    let notes = note_manager::list_notes(&state.notes_dir)?;

    // Handle mutex with proper poisoning recovery
    let cache_db = match state.cache_db.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Error: Cache database mutex was poisoned. Attempting recovery...");
            poisoned.into_inner()
        }
    };

    // Get all currently cached paths to detect deletions
    let cached_paths: HashSet<String> = cache_db
        .get_all_cached_paths()
        .unwrap_or_default()
        .into_iter()
        .collect();

    let mut current_paths: HashSet<String> = HashSet::new();

    for note in notes {
        current_paths.insert(note.path.clone());

        // Get file modification time
        let file_mtime = match std::fs::metadata(&note.path) {
            Ok(meta) => match meta.modified() {
                Ok(mtime) => match mtime.duration_since(UNIX_EPOCH) {
                    Ok(duration) => (duration.as_secs() as i64, duration.subsec_nanos()),
                    Err(_) => {
                        // Time before UNIX epoch - treat as changed
                        (0, 0)
                    }
                },
                Err(_) => continue, // Can't get mtime, skip
            },
            Err(_) => continue, // Can't access file, skip
        };

        // Check if file needs updating
        let needs_update = match cache_db.get_cached_mtime(&note.path) {
            Ok(Some((cached_secs, cached_nanos))) => {
                // Update if mtime differs (handles both newer and older - for clock skew)
                file_mtime.0 != cached_secs || file_mtime.1 != cached_nanos
            }
            Ok(None) => true, // New file, not in cache
            Err(_) => true,   // Error reading cache, rebuild to be safe
        };

        if needs_update {
            if let Ok(content) = read_file_with_encoding(&note.path) {
                // Update cache including FTS5 index
                if let Err(e) = cache_db.update_note_cache_with_fts(
                    &note.path,
                    &note.title,
                    &content,
                    &state.notes_dir,
                ) {
                    let path = &note.path;
                    eprintln!("Warning: Failed to update cache for '{path}': {e}");
                    continue;
                }

                // Store the new mtime
                if let Err(e) = cache_db.set_cached_mtime(&note.path, file_mtime.0, file_mtime.1) {
                    eprintln!("Warning: Failed to store mtime for '{}': {e}", note.path);
                }

                // Cache entry updated/added successfully
            }
        }
    }

    // Find and remove deleted files
    let deleted_paths: Vec<String> = cached_paths.difference(&current_paths).cloned().collect();

    if !deleted_paths.is_empty() {
        if let Err(e) = cache_db.remove_stale_entries(&deleted_paths) {
            eprintln!("Warning: Failed to remove stale cache entries: {e}");
        }
    }

    Ok(())
}

/// Force a full cache rebuild (clears all metadata and rebuilds from scratch)
pub fn force_rebuild_cache(state: &AppState) -> Result<()> {
    let cache_db = match state.cache_db.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Error: Cache database mutex was poisoned. Attempting recovery...");
            poisoned.into_inner()
        }
    };

    // Clear all metadata to force full rebuild
    if let Err(e) = cache_db.clear_all_metadata() {
        eprintln!("Warning: Failed to clear metadata: {e}");
    }

    drop(cache_db); // Release lock before calling sync_cache

    sync_cache(state)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            use tauri::Manager;

            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Create app data dir if it doesn't exist
            if !app_data_dir.exists() {
                std::fs::create_dir_all(&app_data_dir)
                    .expect("Failed to create app data directory");
            }

            let cache_db_path = app_data_dir.join("notes_cache.db");
            let cache_db = CacheDb::new(&cache_db_path.to_string_lossy())
                .expect("Failed to initialize cache database");

            let home_dir =
                dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
            let default_notes_dir = home_dir.join("Notes");

            if !default_notes_dir.exists() {
                std::fs::create_dir_all(&default_notes_dir)
                    .expect("Failed to create default notes directory");
            }

            let git_manager = GitManager::new(&default_notes_dir.to_string_lossy());

            let app_state = AppState {
                cache_db: Mutex::new(cache_db),
                git_manager: Mutex::new(git_manager),
                notes_dir: default_notes_dir.to_string_lossy().to_string(),
                recent_notes: Mutex::new(VecDeque::new()),
            };

            // Sync cache on startup - only updates changed files
            if let Err(e) = sync_cache(&app_state) {
                eprintln!("Warning: Failed to sync cache on startup: {e}");
            }

            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_notes_list,
            commands::read_note,
            commands::save_note,
            commands::create_note,
            commands::delete_note,
            commands::search_notes,
            commands::search_notes_enhanced,
            commands::get_daily_note,
            commands::get_block_reference,
            commands::get_blocks_for_note,
            commands::resolve_transclusion,
            commands::get_backlinks,
            commands::get_outgoing_links,
            commands::get_all_tags,
            commands::get_notes_by_tag,
            commands::set_notes_directory,
            commands::find_note_by_name,
            commands::move_note,
            commands::get_folder_contents,
            commands::delete_folder,
            commands::create_folder,
            commands::get_all_folders,
            commands::get_global_graph,
            commands::get_local_graph,
            commands::get_filtered_graph,
            commands::save_image,
            commands::save_attachment,
            commands::open_file_external,
            commands::get_incomplete_todos,
            commands::get_all_todos,
            commands::toggle_todo,
            commands::get_daily_note_template,
            commands::save_daily_note_template,
            commands::rename_note,
            commands::rename_folder,
            commands::init_git_repo,
            commands::is_git_repo,
            commands::get_git_blame,
            commands::git_commit,
            commands::get_app_settings,
            commands::save_app_settings,
            commands::get_recent_notes,
            commands::save_window_state,
            commands::apply_window_state,
            commands::get_all_bookmarks,
            commands::search_bookmarks,
            commands::get_bookmarks_by_domain,
            commands::add_bookmark_manual,
            commands::update_bookmark,
            commands::delete_bookmark,
            commands::get_all_bookmark_domains,
            commands::open_url_external,
            commands::force_rebuild_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
