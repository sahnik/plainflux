#[macro_use]
mod macros;
mod cache;
mod commands;
mod error;
mod git_manager;
mod note_manager;
mod utils;

use cache::CacheDb;
use commands::AppState;
use error::Result;
use git_manager::GitManager;
use note_manager::read_file_with_encoding;
use std::collections::VecDeque;
use std::sync::Mutex;

fn rebuild_cache(state: &AppState) -> Result<()> {
    let notes = note_manager::list_notes(&state.notes_dir)?;

    // Handle mutex with proper poisoning recovery
    let cache_db = match state.cache_db.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            eprintln!("Error: Cache database mutex was poisoned. Attempting recovery...");
            poisoned.into_inner()
        }
    };

    println!(
        "Rebuilding cache with FTS5 index for {} notes...",
        notes.len()
    );

    for note in notes {
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
            }
        }
    }

    println!("Cache rebuild complete!");

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data_dir = std::path::PathBuf::from(".");

    let cache_db_path = app_data_dir.join("notes_cache.db");
    let cache_db = CacheDb::new(&cache_db_path.to_string_lossy())
        .expect("Failed to initialize cache database");

    let home_dir = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
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

    // Rebuild cache on startup (non-blocking, don't fail app startup)
    if let Err(e) = rebuild_cache(&app_state) {
        eprintln!("Warning: Failed to rebuild cache on startup: {e}");
        // Continue anyway - cache will be rebuilt as notes are accessed
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
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
            commands::save_image,
            commands::save_attachment,
            commands::open_file_external,
            commands::get_incomplete_todos,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
