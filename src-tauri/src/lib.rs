mod note_manager;
mod cache;
mod commands;

use cache::CacheDb;
use commands::AppState;
use std::sync::Mutex;

fn rebuild_cache(state: &AppState) -> Result<(), String> {
    let notes = note_manager::list_notes(&state.notes_dir)?;
    let cache_db = state.cache_db.lock()
        .map_err(|_| "Failed to lock cache database")?;
    
    for note in notes {
        if let Ok(content) = std::fs::read_to_string(&note.path) {
            let _ = cache_db.update_note_cache(&note.path, &content, &state.notes_dir);
        }
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data_dir = std::path::PathBuf::from(".");
    
    let cache_db_path = app_data_dir.join("notes_cache.db");
    let cache_db = CacheDb::new(&cache_db_path.to_string_lossy())
        .expect("Failed to initialize cache database");
    
    let home_dir = dirs::home_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    let default_notes_dir = home_dir.join("Notes");
    
    if !default_notes_dir.exists() {
        std::fs::create_dir_all(&default_notes_dir)
            .expect("Failed to create default notes directory");
    }
    
    let app_state = AppState {
        cache_db: Mutex::new(cache_db),
        notes_dir: default_notes_dir.to_string_lossy().to_string(),
    };
    
    // Rebuild cache on startup
    rebuild_cache(&app_state).unwrap_or_else(|e| {
        eprintln!("Failed to rebuild cache: {}", e);
    });
    
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
            commands::get_daily_note,
            commands::get_backlinks,
            commands::get_all_tags,
            commands::get_notes_by_tag,
            commands::set_notes_directory,
            commands::find_note_by_name,
            commands::move_note,
            commands::get_folder_contents,
            commands::delete_folder,
            commands::create_folder,
            commands::get_all_folders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}